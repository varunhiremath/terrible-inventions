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
import { TRACKS, eighthSeconds, loopLength, readPart, type Track, type TrackName } from './score'

/** How often the scheduler wakes up. */
const TICK_MS = 25
/** How far ahead it books notes. Comfortably more than a tick. */
const HORIZON = 0.12

let context: AudioContext | null = null
let master: GainNode | null = null
let timer: ReturnType<typeof setInterval> | null = null
let playing: Track | null = null
/** Where the scheduler has got to, in seconds on the audio clock. */
let cursor = 0
let eighth = 0
let enabled = true
let volume = 0.55
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
    master.connect(context.destination)
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

function hiss(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  const frames = Math.floor(ctx.sampleRate * 0.12)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  noise = buffer
  return buffer
}

function playNote(
  ctx: AudioContext,
  out: GainNode,
  wave: OscillatorType,
  frequency: number,
  at: number,
  seconds: number,
  level: number,
): void {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = wave
  osc.frequency.setValueAtTime(frequency, at)

  // A hard start and stop clicks. A few milliseconds of fade at each end is
  // the difference between a chiptune and a fault.
  const attack = 0.006
  const release = Math.min(0.05, seconds * 0.4)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(level, at + attack)
  env.gain.setValueAtTime(level, Math.max(at + attack, at + seconds - release))
  env.gain.linearRampToValueAtTime(0, at + seconds)

  osc.connect(env)
  env.connect(out)
  osc.start(at)
  osc.stop(at + seconds + 0.02)
}

function playHit(ctx: AudioContext, out: GainNode, at: number): void {
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

  const step = eighthSeconds(track)
  const bars = loopLength(track)
  if (bars === 0) return

  const parts = track.parts.map((part) => ({ part, notes: readPart(part.pattern) }))
  const drums = track.drums ? track.drums.trim().split(/\s+/) : []

  while (cursor < ctx.currentTime + HORIZON) {
    // Behind the clock after a stall: skip forward rather than dump a backlog
    // of notes into the speaker all at once.
    if (cursor < ctx.currentTime) cursor = ctx.currentTime + 0.01

    const beat = eighth % bars
    for (const { part, notes } of parts) {
      for (const note of notes) {
        if (note.at !== beat) continue
        playNote(
          ctx,
          out,
          part.wave,
          note.frequency,
          cursor,
          note.length * step * (part.sustain ?? 0.9),
          part.gain,
        )
      }
    }
    if (drums[beat] === 'x') playHit(ctx, out, cursor)

    cursor += step
    eighth += 1
  }
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
