/**
 * Playing the score.
 *
 * Web Audio schedules ahead of time rather than on the beat: a note played
 * from a timer fires whenever the browser gets round to it, which on a tablet
 * mid-render is audibly not when you asked. So a timer wakes up often, looks a
 * little way into the future, and books every note due in that window at an
 * exact time. The timer can be late by a hundred milliseconds and the music
 * still keeps perfect time.
 *
 * Everything here is guarded, because audio is the one part of a browser that
 * is allowed to simply refuse: no context, a context that will not start until
 * the player touches something, a tab in the background. Music that does not
 * play is a disappointment. Music that throws takes the game down with it.
 */
import {
  CUES,
  TRACKS,
  eighthSeconds,
  heatGain,
  loopLength,
  beatAt,
  swingShift,
  readPart,
  type CueName,
  type Wave,
  type Track,
  type TrackName,
} from './score'

/** How often the scheduler wakes up. */
const TICK_MS = 25
/** How far ahead it books notes. Comfortably more than a tick. */
const HORIZON = 0.12

let context: AudioContext | null = null
let master: GainNode | null = null
/**
 * The thing between the music and the speaker.
 *
 * Reported as "high pitched, a little loud and not soothing", which is a fair
 * description of a stack of pulse and sawtooth waves going straight out. A
 * square wave's harmonics fall away slowly, so the interesting part of the
 * sound is an octave up from the note and the *unpleasant* part is two or
 * three octaves above that — right in the band the ear is most sensitive to
 * and least able to ignore over an hour.
 *
 * So two filters, and neither is a blanket muffle. One takes about six
 * decibels out of a narrow band around 3 kHz, which is where "bright" turns
 * into "piercing". The other rolls off everything above 6 kHz, which on
 * material made entirely of square waves is fizz rather than music. The tunes
 * are unchanged and still sound like a chip; they just stop hurting.
 */
let softener: BiquadFilterNode | null = null
let timer: ReturnType<typeof setInterval> | null = null
let playing: Track | null = null
/** Where the scheduler has got to, in seconds on the audio clock. */
let cursor = 0
let eighth = 0
let enabled = true

/**
 * How hot things are, 0 to 1.
 *
 * One number, set by whichever game is running, that the loop reads on every
 * scheduling window. Raising it brings in the voices marked with a `from`,
 * swaps the drums for the harder pattern and nudges the tempo up.
 *
 * It is a property of the music, not of a game, so it is reset whenever a new
 * track starts: a screen that never touches it gets the tune as written.
 */
let heat = 0
/** How fast the player is going, 0 to 1. Set by whichever game has a speed. */
let pace = 0

/** The heat at which the harder drum pattern takes over, if a track has one. */
const HOT_DRUMS = 0.55
/*
 * A good deal quieter than it was.
 *
 * 0.55 was chosen against a laptop speaker and is too much on a phone held a
 * foot from your face, which is where this is actually played. How much lower took
 * measuring rather than guessing, twice: a first pass cut this to 0.42 while
 * also nearly doubling every lead's gain, and the two changes together came
 * out louder than what they replaced. The leads went back to roughly their old
 * gains and this came down instead, which is the right place for a change that
 * is about the whole thing being quieter.
 */
let volume = 0.27
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (context) return context
  const Ctor =
    typeof window !== 'undefined'
      ? window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined
  if (!Ctor) return null

  try {
    context = new Ctor()
    master = context.createGain()
    master.gain.value = enabled ? volume : 0

    const harsh = context.createBiquadFilter()
    harsh.type = 'peaking'
    harsh.frequency.value = 3100
    harsh.Q.value = 1.1
    harsh.gain.value = -6.5

    softener = context.createBiquadFilter()
    softener.type = 'lowpass'
    softener.frequency.value = 6000
    softener.Q.value = 0.6

    master.connect(harsh)
    harsh.connect(softener)
    softener.connect(context.destination)
  } catch {
    context = null
  }
  return context
}

/**
 * Browsers will not start audio until the player has touched something, and
 * the attempt before that is refused rather than queued. So this is called
 * again on the first real interaction.
 */
export function unlockAudio(): void {
  const ctx = audio()
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {})
}


/**
 * Pulse waves, which are most of why a chip sounds like a chip.
 *
 * Web Audio gives you a square, and a square is a pulse that is high exactly
 * half the time. The sound chips of the era could also be high an eighth or a
 * quarter of the time, and those narrower pulses are the thin, nasal, reedy
 * voice everybody actually remembers — a 50% square on its own sounds like a
 * test tone, which is what this was using for everything.
 *
 * A pulse of width d has harmonics of size (2/n·pi)·sin(n·pi·d), so the wave
 * can be built straight from that and handed to the oscillator.
 */
const pulses = new Map<number, PeriodicWave>()

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const found = pulses.get(duty)
  if (found) return found

  const harmonics = 32
  const real = new Float32Array(harmonics)
  const imag = new Float32Array(harmonics)
  for (let n = 1; n < harmonics; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  }
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false })
  pulses.set(duty, wave)
  return wave
}

function hiss(ctx: BaseAudioContext): AudioBuffer {
  if (noise) return noise
  const frames = Math.floor(ctx.sampleRate * 0.12)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  noise = buffer
  return buffer
}

/**
 * The four instruments, as numbers.
 *
 * `ratio` is the modulator's pitch as a multiple of the note's. A whole number
 * gives harmonics and sounds like a string or a horn; 3.5 does not divide into
 * anything and gives the clang of a bell. `index` is how far it bends the
 * carrier at the start, in multiples of the note's own frequency, and `bite`
 * is how quickly that falls away — the short one is a hammer, the long one is
 * a bow.
 *
 * `hold` is what separates them from everything else in here. A chip voice is
 * on at full until it is told to stop; these fall away on their own from the
 * moment they are struck, which is why `decay` is in seconds of real time and
 * not a fraction of the note. A piano does not know how long the note was
 * written for.
 */
interface Patch {
  carrier: OscillatorType
  ratio: number
  index: number
  bite: number
  attack: number
  decay: number
  /** Where the note settles after the decay, as a fraction of its peak. */
  hold: number
  /** Cents between the two carriers. Nought is one oscillator. */
  spread: number
  /**
   * A lowpass that opens on the strike and closes as the note dies.
   *
   * `tilt` is how far above the note itself it opens, as a multiple of the
   * note's own frequency, so a low note is not handed the same lid as a high
   * one. It was six, which on a middle C put the lid at 1.6 kHz and threw away
   * everything that made the strike sound like a strike: the piano measured
   * three per cent of its energy above a kilohertz, against thirty for the
   * bell. A piano is a bright thing for the first tenth of a second.
   */
  tilt: number
  open: number
  close: number
}

export const PATCHES: Record<string, Patch> = {
  piano: {
    carrier: 'sine', ratio: 1, index: 4.6, bite: 0.16,
    attack: 0.004, decay: 2.8, hold: 0.02, spread: 5,
    tilt: 15, open: 5200, close: 700,
  },
  bell: {
    carrier: 'sine', ratio: 3.5, index: 3.4, bite: 0.5,
    attack: 0.003, decay: 2.6, hold: 0, spread: 0,
    tilt: 8, open: 6000, close: 1600,
  },
  pluck: {
    carrier: 'triangle', ratio: 1, index: 1.6, bite: 0.05,
    attack: 0.004, decay: 0.9, hold: 0.06, spread: 0,
    tilt: 9, open: 2600, close: 420,
  },
  strings: {
    carrier: 'sawtooth', ratio: 2, index: 0.12, bite: 1.2,
    attack: 0.22, decay: 0.5, hold: 0.85, spread: 9,
    tilt: 7, open: 2000, close: 1500,
  },
}

/** Everything about how a part is played, as opposed to what it plays. */
export interface Voice {
  wave: Wave
  /** For a pulse: how much of each cycle is high. Ignored by other waves. */
  duty?: number
  /** Depth in cents, speed in Hz, and how long to wait before it starts. */
  vibrato?: { cents: number; hz: number; delay?: number }
  /**
   * Semitone offsets cycled within one note, fast, to fake a chord.
   *
   * With three oscillators and four parts to play, the chips could not hold a
   * chord down. So they flicked between its notes once per frame instead, and
   * the ear hears a rough, buzzing chord rather than three separate notes. It
   * is the single most recognisable trick in the idiom and no amount of
   * writing better melodies substitutes for it.
   */
  arp?: readonly number[]
  /** How fast to flick through `arp`, in steps per second. */
  arpRate?: number
  /** Semitones sounded together with the note, for the instruments. */
  chord?: readonly number[]
}

/**
 * One struck or bowed voice.
 *
 * Six nodes a note against the chip path's two, which is worth watching but
 * not worth avoiding: the loudest moment of a game was measured at four live
 * oscillators, and these parts are the sparsest in the tune.
 */
function playPatch(
  ctx: BaseAudioContext,
  out: GainNode,
  patch: Patch,
  voice: Voice,
  frequency: number,
  at: number,
  seconds: number,
  level: number,
): void {
  const env = ctx.createGain()
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.Q.value = 0.7

  // The brightness falls with the note. A struck string loses its top long
  // before it goes quiet, and a filter that stays open is most of what makes a
  // synthesised piano sound like an organ.
  const bright = Math.min(patch.open, Math.max(patch.close, frequency * patch.tilt))
  tone.frequency.setValueAtTime(bright, at)
  tone.frequency.exponentialRampToValueAtTime(patch.close, at + patch.decay)

  const carriers: OscillatorNode[] = []
  const voices = patch.spread > 0 ? 2 : 1
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator()
    osc.type = patch.carrier
    osc.frequency.setValueAtTime(frequency, at)
    // Detuned in opposite directions, which is two strings on one key rather
    // than one string slightly out of tune.
    if (patch.spread > 0) osc.detune.setValueAtTime(i === 0 ? -patch.spread : patch.spread, at)
    carriers.push(osc)
  }

  if (patch.index > 0) {
    const modulator = ctx.createOscillator()
    const depth = ctx.createGain()
    modulator.type = 'sine'
    modulator.frequency.setValueAtTime(frequency * patch.ratio, at)
    depth.gain.setValueAtTime(frequency * patch.index, at)
    // Towards nought rather than to it: an exponential ramp cannot reach zero,
    // and asking it to is the one way to make a Web Audio ramp do nothing at
    // all.
    depth.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, frequency * patch.index * 0.02),
      at + patch.bite,
    )
    modulator.connect(depth)
    for (const osc of carriers) depth.connect(osc.frequency)
    modulator.start(at)
    modulator.stop(at + seconds + 0.3)
  }

  if (voice.vibrato && seconds > (voice.vibrato.delay ?? 0.12) + 0.05) {
    const { cents, hz, delay = 0.12 } = voice.vibrato
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = hz
    depth.gain.setValueAtTime(0, at)
    depth.gain.setValueAtTime(0, at + delay)
    depth.gain.linearRampToValueAtTime(frequency * (Math.pow(2, cents / 1200) - 1), at + delay + 0.08)
    lfo.connect(depth)
    for (const osc of carriers) depth.connect(osc.frequency)
    lfo.start(at)
    lfo.stop(at + seconds + 0.3)
  }

  /*
   * The note rings past the end of what was written, and that is the point.
   *
   * A piano note is not a rectangle. It is struck, it falls away, and it stops
   * when the key is let go — so this decays on its own clock and is only cut
   * off at the end of the note if there is anything left to cut. `tail` is how
   * far past its written length it is allowed to ring, which is what makes a
   * run of eighths overlap into a chord instead of a row of blips.
   */
  const tail = Math.min(patch.decay, 0.45)
  const peak = level / Math.sqrt(voices)
  const settled = Math.max(0.0001, peak * patch.hold)
  const ends = at + seconds + tail

  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(peak, at + patch.attack)
  env.gain.exponentialRampToValueAtTime(settled, at + patch.attack + patch.decay)

  /*
   * Where the decay has got to when the key is let go, worked out rather than
   * read back.
   *
   * `env.gain.value` is the obvious thing to put here and it is wrong in a way
   * that is hard to see: a parameter reads back its *current* value, not the
   * one scheduled for a moment in the future, so on a note booked a tenth of a
   * second ahead it returns the gain the node was created with. The same
   * mistake read 440 Hz off every oscillator in this file once. This is the
   * same curve the ramp above describes, evaluated at the moment it is needed.
   */
  const through = Math.min(1, Math.max(0, (ends - at - patch.attack) / patch.decay))
  const here = Math.max(0.0001, peak * Math.pow(settled / peak, through))
  env.gain.setValueAtTime(here, ends)
  env.gain.exponentialRampToValueAtTime(0.0001, ends + 0.06)

  for (const osc of carriers) {
    osc.connect(tone)
    osc.start(at)
    osc.stop(ends + 0.08)
  }
  tone.connect(env)
  env.connect(out)
}

function playNote(
  ctx: BaseAudioContext,
  out: GainNode,
  voice: Voice,
  frequency: number,
  at: number,
  seconds: number,
  level: number,
): void {
  const patch = PATCHES[voice.wave]
  if (patch) {
    // A real instrument can hold a chord down, so a part asking for one gets
    // every note of it at once rather than flicked through. Quietened by the
    // root of the count, which keeps three notes about as loud as one.
    const notes = voice.chord && voice.chord.length > 0 ? voice.chord : [0]
    const share = level / Math.sqrt(notes.length)
    for (const semitones of notes) {
      playPatch(ctx, out, patch, voice, frequency * Math.pow(2, semitones / 12), at, seconds, share)
    }
    return
  }

  const osc = ctx.createOscillator()
  const env = ctx.createGain()

  if (voice.wave === 'pulse') osc.setPeriodicWave(pulseWave(ctx, voice.duty ?? 0.25))
  else osc.type = voice.wave as OscillatorType

  if (voice.arp && voice.arp.length > 1) {
    // Stepped, not ramped: the flick between notes is the whole point, and a
    // slide between them sounds like a broken tape.
    const rate = voice.arpRate ?? 18
    const steps = Math.max(1, Math.ceil(seconds * rate))
    for (let i = 0; i < steps; i++) {
      const semitones = voice.arp[i % voice.arp.length]
      osc.frequency.setValueAtTime(frequency * Math.pow(2, semitones / 12), at + i / rate)
    }
  } else {
    osc.frequency.setValueAtTime(frequency, at)
  }

  if (voice.vibrato) {
    // A held note that does not move sounds synthetic in a way a held note
    // that wavers very slightly does not.
    const { cents, hz, delay = 0.12 } = voice.vibrato
    if (seconds > delay + 0.05) {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = hz
      // Cents are a ratio, so the depth in Hz depends on the note.
      depth.gain.setValueAtTime(0, at)
      depth.gain.setValueAtTime(0, at + delay)
      depth.gain.linearRampToValueAtTime(
        frequency * (Math.pow(2, cents / 1200) - 1),
        at + delay + 0.08,
      )
      lfo.connect(depth)
      depth.connect(osc.frequency)
      lfo.start(at)
      lfo.stop(at + seconds + 0.02)
    }
  }

  // A hard start and stop clicks. A few milliseconds of fade at each end is
  // the difference between a chiptune and a fault.
  /*
   * A little longer than it takes to avoid a click.
   *
   * Six milliseconds is enough to stop a pop and short enough that every note
   * still arrives with an edge on it. Eighteen rounds the front of the note
   * off, which across a whole tune is most of the difference between a chip
   * and a chip you can listen to. The release is longer for the same reason.
   */
  const attack = 0.018
  const release = Math.min(0.09, seconds * 0.45)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(level, at + attack)
  env.gain.setValueAtTime(level, Math.max(at + attack, at + seconds - release))
  env.gain.linearRampToValueAtTime(0, at + seconds)

  osc.connect(env)
  env.connect(out)
  osc.start(at)
  osc.stop(at + seconds + 0.02)
}

function playHit(ctx: BaseAudioContext, out: GainNode, at: number): void {
  const source = ctx.createBufferSource()
  source.buffer = hiss(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 7000
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.09, at)
  env.gain.exponentialRampToValueAtTime(0.001, at + 0.05)

  source.connect(filter)
  filter.connect(env)
  env.connect(out)
  source.start(at)
  source.stop(at + 0.06)
}

function schedule(): void {
  const ctx = context
  const out = master
  const track = playing
  if (!ctx || !out || !track) return

  /*
   * The heat is read here, once a scheduling window, rather than held.
   *
   * That means a game can move it whenever it likes and the music follows
   * within a fraction of a second, without anything having to be restarted.
   * The loop length is deliberately worked out over every part, including the
   * silent ones, so the bar count does not change as voices come in — a loop
   * that changes length mid-run goes out of phase with its own bass line.
   */
  const step = eighthSeconds(track, heat, pace)
  const bars = loopLength(track)
  if (bars === 0) return

  /*
   * Where in the breathing cycle each moment falls — playing, or the gap
   * between — is `beatAt`'s business, over in the score. The cycle is a few
   * times round the loop and then a few bars of nothing, counted off the same
   * eighth counter that drives everything else, so the tune comes back exactly
   * where it left off and in phase with its own bass line.
   */

  const parts = track.parts
    .map((part) => ({ part, notes: readPart(part.pattern), level: heatGain(part, heat) }))
    .filter((p) => p.level > 0)
  const written = track.drums ? track.drums.trim().split(/\s+/) : []
  const hot = track.hotDrums ? track.hotDrums.trim().split(/\s+/) : []
  const drums = heat >= HOT_DRUMS && hot.length > 0 ? hot : written

  while (cursor < ctx.currentTime + HORIZON) {
    // Behind the clock after a stall: skip forward rather than dump a backlog
    // of notes into the speaker all at once.
    if (cursor < ctx.currentTime) cursor = ctx.currentTime + 0.01

    // -1 is the gap: the clock runs on and nothing is put into it.
    const beat = beatAt(track, eighth)
    /*
     * The tune leans; the drums do not.
     *
     * Holding the first of each pair of eighths long and squeezing the second
     * in late is what a shuffle is, and it is most of what anybody means by a
     * tune bouncing. The drums stay on the grid, because a shuffle is the
     * melody playing against a straight beat rather than everything arriving
     * at once somewhere else.
     */
    const lean = swingShift(track, eighth, step)
    if (beat >= 0) for (const { part, notes, level } of parts) {
      for (const note of notes) {
        if (note.at !== beat) continue
        playNote(
          ctx,
          out,
          part,
          note.frequency,
          cursor + lean,
          // A note that starts late still ends where it was going to, or a
          // swung pair runs into the next beat.
          Math.max(0.03, note.length * step * (part.sustain ?? 0.9) - lean),
          part.gain * level,
        )
      }
    }
    if (beat >= 0 && drums[beat] === 'x') playHit(ctx, out, cursor)

    cursor += step
    eighth += 1
  }
}

/** Set by a game as things get worse. Clamped, and cheap enough to call often. */
export function setHeat(next: number): void {
  heat = Math.max(0, Math.min(1, next))
}

/**
 * How fast the player is moving, 0 to 1, set as often as a game likes.
 *
 * Eased rather than taken as given. A speed read off a car changes sixty times
 * a second and a tempo that followed it exactly would wobble audibly on every
 * bump; this catches up over about a second, which is slow enough to sound
 * like the music deciding and quick enough to feel like it is following.
 */
export function setPace(next: number): void {
  const want = Math.max(0, Math.min(1, next))
  pace += (want - pace) * 0.08
}

export function heatNow(): number {
  return heat
}

export function startMusic(name: TrackName): void {
  // Turned off means no scheduler at all, not a scheduler running into a
  // silent gain. It would be inaudible either way, but it would still be
  // waking up forty times a second on a tablet running off a battery.
  if (!enabled) return

  const track = TRACKS[name]
  if (playing === track && timer) return

  stopMusic()
  const ctx = audio()
  if (!ctx) return
  unlockAudio()

  playing = track
  // A new track starts cold. Otherwise the tension from the level you just
  // failed follows you onto the menu.
  heat = 0
  pace = 0
  eighth = 0
  cursor = ctx.currentTime + 0.08
  try {
    schedule()
  } catch {
    // A refused context should not take the game with it.
  }
  timer = setInterval(() => {
    try {
      schedule()
    } catch {
      stopMusic()
    }
  }, TICK_MS)
}

/**
 * Plays a cue once, over the top of whatever else is happening.
 *
 * A cue is not the loop: it is scheduled in one go, right now, and then
 * forgotten. The dungeon has no background music at all — the original had
 * twenty-two of these and silence in between, and the silence is what makes
 * them land — so there is no scheduler to keep running and nothing to stop.
 */
export function playCue(name: CueName): void {
  if (!enabled) return
  const cue = CUES[name]
  const ctx = audio()
  if (!ctx || !master) return
  unlockAudio()

  const step = eighthSeconds(cue)
  const start = ctx.currentTime + 0.05
  try {
    for (const part of cue.parts) {
      for (const note of readPart(part.pattern)) {
        playNote(
          ctx,
          master,
          part,
          note.frequency,
          start + note.at * step,
          note.length * step * (part.sustain ?? 0.9),
          part.gain,
        )
      }
    }
  } catch {
    // A refused context should not take the game with it.
  }
}

/** How long a cue runs, so a caller can wait for it. */
export function cueSeconds(name: CueName): number {
  const cue = CUES[name]
  return loopLength(cue) * eighthSeconds(cue)
}

export function stopMusic(): void {
  if (timer) clearInterval(timer)
  timer = null
  playing = null
}

export function musicPlaying(): TrackName | null {
  const found = (Object.keys(TRACKS) as TrackName[]).find((k) => TRACKS[k] === playing)
  return found ?? null
}

function applyVolume(target: number, seconds = 0.12): void {
  if (!context || !master) return
  const level = enabled ? target : 0
  try {
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.setValueAtTime(master.gain.value, context.currentTime)
    master.gain.linearRampToValueAtTime(level, context.currentTime + seconds)
  } catch {
    master.gain.value = level
  }
}

export function setMusicEnabled(on: boolean): void {
  enabled = on
  applyVolume(volume)
  if (!on) stopMusic()
}

export function musicEnabled(): boolean {
  return enabled
}

export function setMusicVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  applyVolume(volume)
}

/**
 * Pulls the music down while {papa} talks and lets it back up afterwards.
 *
 * Without this his lines land underneath the bass and the joke is lost, which
 * defeats the point of writing him jokes.
 */
let undim: ReturnType<typeof setTimeout> | null = null
export function duckMusic(seconds: number): void {
  if (!context || !master) return
  applyVolume(volume * 0.3, 0.08)
  if (undim) clearTimeout(undim)
  undim = setTimeout(() => applyVolume(volume, 0.35), Math.max(300, seconds * 1000))
}

/** Roughly how long a line takes to say, for the duck above. */
export function speakingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(12, 0.4 + words / 3.2)
}

/**
 * Lay a whole track onto a context, for rendering it to a file.
 *
 * This exists so that `scripts/render-music.mjs` does not have to own a second
 * copy of the synthesiser. It did, with a comment on it saying it had to be
 * kept in step with this one by hand — and the moment four instruments were
 * added here, that copy would have rendered them as plain oscillators and the
 * file somebody listened to would not have been the tune the game plays. An
 * audition that is not of the real thing is worse than no audition.
 *
 * `out` is whatever the caller has put between this and its destination, so
 * the two filters the game listens through can be the same two filters.
 */
export function renderTrack(
  ctx: BaseAudioContext,
  out: GainNode,
  track: Track,
  seconds: number,
  warmth = 0,
): void {
  const step = eighthSeconds(track, warmth, 0)
  if (loopLength(track) === 0) return

  const parts = track.parts
    .map((part) => ({ part, notes: readPart(part.pattern), level: heatGain(part, warmth) }))
    .filter((p) => p.level > 0)
  const written = track.drums ? track.drums.trim().split(/\s+/) : []
  const hot = track.hotDrums ? track.hotDrums.trim().split(/\s+/) : []
  const drums = warmth >= HOT_DRUMS && hot.length > 0 ? hot : written

  for (let tick = 0; tick * step < seconds; tick++) {
    const beat = beatAt(track, tick)
    if (beat < 0) continue
    const at = tick * step
    const lean = swingShift(track, tick, step)
    for (const { part, notes, level } of parts) {
      for (const note of notes) {
        if (note.at !== beat) continue
        playNote(
          ctx,
          out,
          part,
          note.frequency,
          at + lean,
          Math.max(0.03, note.length * step * (part.sustain ?? 0.9) - lean),
          part.gain * level,
        )
      }
    }
    if (drums[beat] === 'x') playHit(ctx, out, at)
  }
}
