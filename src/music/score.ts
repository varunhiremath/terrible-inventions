/**
 * The music, written down.
 *
 * Original tunes, played by the browser's own oscillators. Nothing is
 * downloaded, nothing is licensed, nothing needs a network, and the whole
 * soundtrack costs a couple of kilobytes of text — which matters for a game
 * that has to work on a tablet with the wifi off.
 *
 * Notation is one token per eighth note, the way a tracker does it:
 *
 *   'A4'  strike that note
 *   '.'   hold the note before it for another eighth
 *   '-'   silence
 *
 * It is verbose, but you can read a bar of it at a glance and hear roughly
 * what it does, which is more than can be said for an array of numbers.
 *
 * This file is only the score. Making a sound is `player.ts`, so the tunes can
 * be tested without an audio context anywhere in sight.
 */

/**
 * `pulse` is the one that matters.
 *
 * A square wave is a pulse that is high exactly half the time, and on its own
 * it sounds like a test tone. The chips could also be high an eighth or a
 * quarter of the time, and those narrower pulses are the thin, reedy voice the
 * era actually sounded like.
 */
export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'pulse' | Instrument

/**
 * The voices that are not a chip.
 *
 * Everything above is one oscillator: that is the whole of what the machines
 * this music is written in the idiom of could do, and it is why five games
 * sound like each other. These four are not — they are small FM instruments,
 * a carrier whose pitch is wobbled thousands of times a second by a second
 * oscillator, which is how an electric piano was made before sampling and is
 * still the cheapest way to get a struck string out of a browser.
 *
 * What makes them sound struck rather than switched on is that the wobble
 * dies away faster than the note does. The first few hundredths of a second
 * are a clatter of harmonics — the hammer — and what is left behind is nearly
 * a sine. No envelope on a square wave does that.
 *
 *   piano    the hammer and the string. Ratio one, a hard bite, a long decay.
 *   bell     the same machine with the modulator at three and a half times
 *            the carrier, which is not a whole number, which is why it rings
 *            instead of singing.
 *   pluck    short, round and low. The bass hand.
 *   strings  the odd one out and barely FM at all: two detuned saws that take
 *            a quarter of a second to arrive and then hold. For the voice
 *            underneath everything else.
 */
export type Instrument = 'piano' | 'bell' | 'pluck' | 'strings'

export const INSTRUMENTS: readonly Wave[] = ['piano', 'bell', 'pluck', 'strings']

export const isInstrument = (wave: Wave): boolean => INSTRUMENTS.includes(wave)

/*
 * A note on why no *background* voice is a sawtooth any more.
 *
 * Every background track used to gain one when the heat climbed past about
 * two thirds: a held sawtooth line up in the fifth octave, arriving exactly
 * when the run was going badly. On paper that is the tension voice. In a room
 * it is the harshest waveform there is, in the register the ear is least able
 * to ignore, switched on at the moment somebody is already having a hard time
 * — which is the opposite of what tension is for.
 *
 * They are triangles now, a little louder to make up for how much softer a
 * triangle is, playing the same notes. The heat still does its work through
 * the extra voice, the tempo and the drums; it just stops doing it by being
 * unpleasant.
 *
 * Two sawtooths survive, in PRANG and STRUCK. Those are one-shot cues a tenth
 * of a second long that fire when you hit something, and a harsh noise is
 * exactly what is wanted for a tenth of a second. The problem was never the
 * waveform; it was a waveform held down for eighty seconds at a time.
 */

export interface Part {
  wave: Wave
  /** 0..1, before the master volume. */
  gain: number
  /** How long a note rings relative to its written length. */
  sustain?: number
  /** For a pulse: how much of each cycle is high. 0.125, 0.25 and 0.5 are the classic three. */
  duty?: number
  /** Depth in cents, speed in Hz, and how long to wait before it starts. */
  vibrato?: { cents: number; hz: number; delay?: number }
  /**
   * Semitone offsets flicked through inside one note, to fake a chord.
   *
   * With three oscillators and four things to play, the chips could not hold a
   * chord down, so they switched between its notes once per frame instead. The
   * ear hears a rough buzzing chord rather than three separate notes, and it
   * is the most recognisable trick in the whole idiom.
   */
  arp?: readonly number[]
  /** How fast to flick through `arp`, in steps per second. */
  arpRate?: number
  /**
   * Semitones sounded *with* the written note, rather than flicked between.
   *
   * The arpeggio above is a workaround for hardware that could not hold a
   * chord down. Nothing here has that problem — it was copied because the
   * sound of it is the idiom — so a part with a real instrument on it can
   * simply play the chord. Each voice is quietened to keep the part as loud
   * as its `gain` says and no louder, so adding a third does not make a part
   * half again as loud as the one next to it.
   */
  chord?: readonly number[]
  pattern: string
  /**
   * The heat this voice waits for, 0 to 1. Absent means it plays throughout.
   *
   * A game raises its own heat as things get worse — the last level, the last
   * life, the last stretch before the finish — and voices marked this way come
   * in as it climbs. It is the cheapest way to make a loop that has to run for
   * eighty seconds say something about how the run is going, and it is why the
   * fifth level sounds nothing like the first while still being the same tune.
   */
  from?: number
}

export interface Track {
  name: string
  beatsPerMinute: number
  parts: Part[]
  /** Per eighth: 'x' hits, anything else does not. */
  drums?: string
  /**
   * Beats a minute this gains at full heat.
   *
   * Small. Ten or so is felt rather than noticed, which is what tension is;
   * thirty is a different tune played faster, which is a novelty.
   */
  hotter?: number
  /** Drums that only arrive once the heat does. */
  hotDrums?: string
  /**
   * Beats a minute this gains when the player is flat out.
   *
   * Absent means the tune does not follow them, which is right for a game
   * where nobody has a speed — the maze runner moves at one pace and the
   * question card is not a race.
   */
  quicker?: number
  /**
   * How many times round before the tune stops for a moment.
   *
   * A loop that never stops stops being music and becomes a room tone: after
   * the third time round nobody is listening to it any more, they are just
   * slightly more tired than they were. A gap fixes that for nothing — the
   * same eight bars are worth hearing again if something happened in between,
   * even if the something was silence.
   *
   * Nought means never stop, which is right for the two-second cue loops and
   * wrong for everything anybody has to sit with.
   */
  restEvery?: number
  /**
   * How much later the off-beats fall, as a fraction of an eighth.
   *
   * Nought is what a computer does: every eighth exactly as long as the last,
   * which is the difference between a tune being played and a tune being
   * typed. A third is a shuffle — the first of each pair held long and the
   * second squeezed in late — and it is most of what "bouncy" means when
   * anybody says a tune bounces.
   *
   * It moves the notes, not the beat: the bar is the same length, the drums
   * stay where they are, and the tune leans.
   */
  swing?: number
}

/** A sensible ceiling: past this the pairs stop reading as pairs. */
export const MOST_SWING = 0.34

/** How late an off-beat falls, in seconds. */
export function swingShift(track: Track, eighth: number, step: number): number {
  const swing = Math.max(0, Math.min(MOST_SWING, track.swing ?? 0))
  return eighth % 2 === 1 ? step * swing : 0
}

/** Loops between rests, for a track that does not say. */
export const REST_EVERY = 2

/**
 * How long the gap is, near enough.
 *
 * Rounded to a whole bar at the track's own tempo so the tune comes back on a
 * downbeat rather than wherever three seconds happened to land. Long enough to
 * register as a pause; short enough that nobody checks whether the sound is
 * broken.
 */
export const REST_SECONDS = 3

export function restEighths(track: Track): number {
  if ((track.restEvery ?? REST_EVERY) === 0) return 0
  const bar = 8
  const wanted = REST_SECONDS / eighthSeconds(track, 0)
  return Math.max(bar, Math.round(wanted / bar) * bar)
}

/**
 * Which eighth of the loop to play at a given moment, or -1 for the gap.
 *
 * Out here rather than inside the scheduler so it can be checked without an
 * audio context and forty seconds of waiting. The scheduler does nothing else
 * with time: it asks this, plays whatever is written at that position, and
 * moves on.
 */
export function beatAt(track: Track, eighth: number): number {
  const bars = loopLength(track)
  if (bars === 0) return -1
  const every = track.restEvery ?? REST_EVERY
  const rest = restEighths(track)
  if (every <= 0 || rest <= 0) return eighth % bars
  const playFor = bars * every
  const at = eighth % (playFor + rest)
  return at < playFor ? at % bars : -1
}

/** How fast a voice has to arrive once its heat is reached. */
const FADE_IN = 0.18

/**
 * How loud a voice is at a given heat: nothing, then a quick fade, then all.
 *
 * Switching a voice on at a threshold is audible as a switch. Fading it in
 * over a little of the range above the threshold is audible as the music
 * getting busier, which is the point.
 */
export function heatGain(part: Part, heat: number): number {
  if (part.from === undefined) return 1
  if (heat <= part.from) return 0
  return Math.min(1, (heat - part.from) / FADE_IN)
}

const SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** Middle A is 440 Hz and everything else follows from equal temperament. */
export function noteFrequency(name: string): number {
  const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim())
  if (!match) throw new Error(`not a note: ${name}`)

  const [, letter, accidental, octave] = match
  const semitone =
    SEMITONES[letter.toUpperCase()] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  const midi = (Number(octave) + 1) * 12 + semitone
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export interface Note {
  /** Eighths from the start of the loop. */
  at: number
  /** In eighths. A held note is one note, not several. */
  length: number
  frequency: number
}

/** Turns a written part into notes, folding every hold into the note it holds. */
export function readPart(pattern: string): Note[] {
  const tokens = pattern.trim().split(/\s+/).filter(Boolean)
  const notes: Note[] = []

  tokens.forEach((token, i) => {
    if (token === '-') return
    if (token === '.') {
      const last = notes[notes.length - 1]
      // A hold with nothing to hold is a rest; better than throwing mid-tune.
      if (last && last.at + last.length === i) last.length += 1
      return
    }
    notes.push({ at: i, length: 1, frequency: noteFrequency(token) })
  })

  return notes
}

/** How many eighths the loop runs for, taken from its longest part. */
export function loopLength(track: Track): number {
  const parts = track.parts.map((p) => p.pattern.trim().split(/\s+/).filter(Boolean).length)
  const drums = track.drums ? track.drums.trim().split(/\s+/).filter(Boolean).length : 0
  return Math.max(0, ...parts, drums)
}

/**
 * Seconds per eighth note.
 *
 * Two things hurry it along and they are not the same thing. `heat` is how
 * badly the run is going — the last level, the last life, the last stretch —
 * and it climbs slowly and stays up. `pace` is how fast the player is moving
 * *right now*, and it goes up and down all the time.
 *
 * Tying the tempo to movement is the thing that makes a tune feel like it is
 * yours rather than something playing near you: stop and it settles, put your
 * foot down and it comes with you. It is a small number on purpose — around
 * eight beats a minute at full tilt — because the tune has to stay the same
 * tune. Anything bigger and it is a novelty the second time.
 */
export function eighthSeconds(track: Track, heat = 0, pace = 0): number {
  const bpm =
    track.beatsPerMinute +
    (track.hotter ?? 0) * Math.max(0, Math.min(1, heat)) +
    (track.quicker ?? 0) * Math.max(0, Math.min(1, pace))
  return 60 / bpm / 2
}

// --- the tunes -------------------------------------------------------------

/*
 * Papa Panic runs on four chords — A minor, G, F, E — going round twice: the
 * first time low and stepping, the second time up an octave and jumpier, so
 * the loop has somewhere to go instead of just repeating. Minor key, but at
 * this tempo it reads as busy rather than sad.
 */

/*
 * Papa Panic.
 *
 * Written twice. It was in A minor with a melody that climbed to A5 on a
 * nasal pulse; then in C major on a triangle, which fixed how it sounded and
 * left it what it had always been — eight bars of the same thing, round and
 * round.
 *
 * What was asked for was the shape of the tune everybody knows from that
 * plumber: "silence, upbeat, slow and fast, happy and tense, all beats nicely
 * mixed". That is a good description of what makes it work, and none of it is
 * about the notes. Three things:
 *
 * REST     Half of that melody is gaps. A phrase that fills every eighth has
 *          no shape, because shape is the difference between the notes and
 *          the spaces. Most bars here start on a rest.
 * SYNCOPE  The famous ones do not land on the beat. Starting a phrase on the
 *          *and* of one is what makes a tune bounce rather than march, and it
 *          costs nothing but moving a note left.
 * SECTIONS Sixteen bars rather than eight, in four parts. Two of the bouncy
 *          thing, then four bars that drop low and go sparse — that is the
 *          tense bit, and it is tense because everything around it is not —
 *          then four that climb back out busier than they started.
 *
 * The four parts are why it survives being heard for an hour. Eight bars of
 * anything is a ringtone; sixteen with a middle that goes somewhere else is a
 * tune, and the gap that follows it makes the return worth having.
 */
const CHASE_LEAD = [
  // A: the bounce. Note the rest on every downbeat.
  '.  C5 C5 .  C5 .  G4 . ',
  'E5 .  .  C5 .  .  G4 . ',
  '.  A4 A4 .  A4 .  C5 . ',
  'D5 .  .  B4 .  .  G4 . ',
  // A again, opened out at the top.
  '.  C5 C5 .  C5 .  G4 . ',
  'E5 .  .  G5 .  E5 C5 . ',
  '.  F4 A4 .  C5 .  A4 . ',
  'G4 .  .  E4 .  .  C4 . ',
  // B: low, slow, and almost nothing in it.
  'A4 .  .  .  G4 .  .  . ',
  'F4 .  .  .  E4 .  .  . ',
  'D4 .  F4 .  A4 .  .  . ',
  'G4 .  .  .  .  .  .  . ',
  // C: out the other side, busier than it went in.
  'C5 D5 E5 F5 G5 .  E5 . ',
  'C5 .  G4 .  E4 .  G4 . ',
  'F4 G4 A4 B4 C5 .  A4 . ',
  'G4 .  B4 .  D5 .  .  . ',
].join(' ')

const CHASE_BASS = [
  'C2 C2 G2 C2 C2 C2 G2 C2',
  'C2 C2 G2 C2 C2 C2 G2 C2',
  'A2 A2 E3 A2 A2 A2 E3 A2',
  'G2 G2 D3 G2 G2 G2 D3 G2',
  'C2 C2 G2 C2 C2 C2 G2 C2',
  'C2 C2 G2 C2 C2 C2 G2 C2',
  'F2 F2 C3 F2 F2 F2 C3 F2',
  'C2 C2 G2 C2 C2 C2 G2 C2',
  // Thinned right out under the quiet part: the bass walking away is most of
  // why those four bars feel like the floor has gone.
  'A2 .  .  .  E3 .  .  . ',
  'F2 .  .  .  C3 .  .  . ',
  'D2 .  .  .  A2 .  .  . ',
  'G2 .  .  .  D3 .  .  . ',
  'C2 C2 G2 C2 C2 C2 G2 C2',
  'C2 C2 G2 C2 C2 C2 G2 C2',
  'F2 F2 C3 F2 F2 F2 C3 F2',
  'G2 G2 D3 G2 G2 D3 G2 G2',
].join(' ')

/** A quiet third voice, holding the chord under everything else. */
const CHASE_PAD = [
  'E3 .  .  .  G3 .  .  . ',
  'E3 .  .  .  G3 .  .  . ',
  'C4 .  .  .  E4 .  .  . ',
  'B3 .  .  .  D4 .  .  . ',
  'E3 .  .  .  G3 .  .  . ',
  'E3 .  .  .  G3 .  .  . ',
  'A3 .  .  .  C4 .  .  . ',
  'E3 .  .  .  G3 .  .  . ',
  // Out entirely for the quiet part.
  '.  .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'E3 .  .  .  G3 .  .  . ',
  'E3 .  .  .  G3 .  .  . ',
  'A3 .  .  .  C4 .  .  . ',
  'B3 .  .  .  D4 .  .  . ',
].join(' ')

/*
 * Sixteen bars, and the middle four nearly stop.
 *
 * The drums are what make the quiet part read as deliberate rather than as
 * something having gone wrong: they do not disappear, they go down to one hit
 * a bar, which is a band waiting rather than a band leaving.
 */
const CHASE_DRUMS =
  ('- x - x - x - x ').repeat(8) +
  ('- - - x - - - - ').repeat(4) +
  ('- x - x - x - x ').repeat(3) +
  '- x - x - x x x'


/*
 * The chase, getting busier.
 *
 * Two voices that are not in the tune as written. The first is an off-beat
 * stab on the root of each chord, which does nothing to the harmony and
 * everything to how hurried it feels. The second holds a long note over the
 * top of it.
 *
 * The second one used to be a grinding semitone — the raised seventh against
 * the root, which is the interval the old key existed for. In a major key
 * there is nothing to grind, and the voice does its job by simply being one
 * more thing playing. Getting busier turns out to work as well as getting
 * nastier, and is a great deal easier to sit next to.
 *
 * Neither plays at the start of a board. They arrive as the last dots go and
 * the machines speed up, and by the last life the tune is the same eight bars
 * with three more voices in it.
 */
const CHASE_PUSH = [
  '.  C3 .  C3 .  C3 .  C3',
  '.  C3 .  C3 .  C3 .  C3',
  '.  A3 .  A3 .  A3 .  A3',
  '.  G3 .  G3 .  G3 .  G3',
  '.  C3 .  C3 .  C3 .  C3',
  '.  C3 .  C3 .  C3 .  C3',
  '.  F3 .  F3 .  F3 .  F3',
  '.  C3 .  C3 .  C3 .  C3',
  // And out for the quiet four, like everything else.
  '.  .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  '.  C3 .  C3 .  C3 .  C3',
  '.  C3 .  C3 .  C3 .  C3',
  '.  F3 .  F3 .  F3 .  F3',
  '.  G3 .  G3 .  G3 G3 G3',
].join(' ')

const CHASE_DREAD = [
  'E4 .  .  .  .  .  .  . ',
  'C4 .  .  .  .  .  .  . ',
  'A3 .  .  .  .  .  .  . ',
  'B3 .  .  .  .  .  .  . ',
  'E4 .  .  .  .  .  .  G4',
  'C4 .  .  .  .  .  .  . ',
  'A3 .  .  .  .  .  .  . ',
  'B3 .  .  .  .  .  .  . ',
  // It stays for the quiet part. With everything else gone it is the only
  // thing left, which is the most use it has ever been.
  'A3 .  .  .  .  .  .  . ',
  'F3 .  .  .  .  .  .  . ',
  'D3 .  .  .  .  .  .  . ',
  'G3 .  .  .  .  .  .  . ',
  'E4 .  .  .  .  .  .  . ',
  'C4 .  .  .  .  .  .  . ',
  'A3 .  .  .  .  .  .  . ',
  'B3 .  .  .  .  .  .  . ',
].join(' ')

const CHASE_HOT_DRUMS =
  ('x - x x - x x x ').repeat(8) +
  ('x - - x - - x - ').repeat(4) +
  ('x - x x - x x x ').repeat(3) +
  'x - x x x x x x'

export const CHASE: Track = {
  name: 'Papa Panic',
  beatsPerMinute: 126,
  hotter: 12,
  // Once round, not twice. The others are eight bars and want two passes
  // before a gap; this one is sixteen and takes half a minute on its own,
  // which is already longer than anybody listens to anything uninterrupted.
  restEvery: 1,
  drums: CHASE_DRUMS,
  hotDrums: CHASE_HOT_DRUMS,
  parts: [
    /*
     * The melody, twice: a square for the edge and a triangle for the body.
     *
     * This was a quarter-duty pulse once, and that was genuinely too much — a
     * pulse that narrow is the most nasal thing the idiom has, its harmonics
     * fall away slowly, and up at the fifth octave carrying the tune it was
     * the loudest thing in the mix whatever its gain said. Reported as high
     * pitched and not soothing, and rightly.
     *
     * Replacing it with a lone triangle fixed that and went too far the other
     * way. A triangle has almost nothing above its third harmonic, and under
     * the master's six-kilohertz lid with a bit of vibrato on it the result is
     * a music box: pleasant, and not a game. Reported as "let's try again".
     *
     * So both. A fifty-per-cent square is the *least* nasal pulse there is —
     * all its even harmonics cancel — and at this gain it supplies presence
     * rather than volume; the triangle under it supplies the weight. Together
     * they are a little over half what the original narrow pulse was set to.
     *
     * Three other goes at this are in `candidates.ts` and on the listening
     * page, so swapping is one word rather than another guess.
     */
    { wave: 'pulse', duty: 0.5, gain: 0.105, sustain: 0.85, pattern: CHASE_LEAD },
    { wave: 'triangle', gain: 0.075, sustain: 0.85, pattern: CHASE_LEAD },
    { wave: 'triangle', gain: 0.26, sustain: 0.6, pattern: CHASE_BASS },
    {
      // Was a held sine, which is a thing no chip of the era could do. Now it
      // flicks root, fifth, octave inside every note instead, which is how one
      // oscillator carried a whole chord.
      wave: 'pulse',
      duty: 0.125,
      gain: 0.07,
      sustain: 0.95,
      arp: [0, 7, 12],
      arpRate: 20,
      pattern: CHASE_PAD,
    },
    { wave: 'pulse', duty: 0.5, gain: 0.09, sustain: 0.28, pattern: CHASE_PUSH, from: 0.3 },
    { wave: 'triangle', gain: 0.072, sustain: 1, pattern: CHASE_DREAD, from: 0.68 },
  ],
}

/*
 * The question between lives. Same four chords as the chase, half the speed
 * and none of the panic — it plays while a question is on screen, so it has to
 * sit still and be ignorable. Music that asks to be listened to while somebody
 * is thinking is just noise.
 */
export const THINKING: Track = {
  name: 'A Quick One',
  beatsPerMinute: 84,
  parts: [
    {
      wave: 'sine',
      gain: 0.12,
      sustain: 0.9,
      pattern: [
        'A4 .  C5 .  E5 .  .  . ',
        'G4 .  B4 .  D5 .  .  . ',
        'F4 .  A4 .  C5 .  .  . ',
        'E4 .  G#4 . B4 .  .  . ',
      ].join(' '),
    },
    {
      wave: 'triangle',
      gain: 0.22,
      sustain: 0.8,
      pattern: [
        'A2 .  .  .  E3 .  .  . ',
        'G2 .  .  .  D3 .  .  . ',
        'F2 .  .  .  C3 .  .  . ',
        'E2 .  .  .  B2 .  .  . ',
      ].join(' '),
    },
  ],
}


/*
 * The pipes.
 *
 * The brief was "completely new music instead of just changing the beat for
 * the current one — use some other musical instruments, like a piano". So the
 * notes are new, the harmony is new, the form is twice as long, and none of
 * the voices playing it existed in this engine a day ago.
 *
 * It stays in C major, which is the one thing that could not change: the coin,
 * the jump and the stomp are cues in C that fire over the top of it, and they
 * are held to that key by a test for exactly this reason. A tune in F with a
 * coin in C is a wrong note several times a second.
 *
 * Sixteen bars rather than eight, because a piano piece that comes round every
 * fourteen seconds is a ringtone. Two halves: the first sits low and walks,
 * the second lifts an octave and reaches. 132 rather than 148, because the
 * speed of this one is in the left hand rather than the tempo — and the tune
 * still quickens when he runs.
 *
 *   C  Am F  G  | C  Em Dm G
 *   F  G  Em Am | F  Dm G  C
 */

/** The right hand. Starts on the off-beat, which is most of why it skips. */
const PIPES_LEAD = [
  '.  G4 C5 .  E5 .  D5 . ',
  'C5 .  .  A4 .  .  .  . ',
  '.  A4 C5 .  F5 .  E5 . ',
  'D5 .  .  B4 .  .  .  . ',
  'E5 .  G5 .  E5 C5 D5 . ',
  'B4 .  E5 .  G5 .  .  . ',
  'F5 .  E5 D5 C5 .  A4 . ',
  'B4 .  D5 .  G4 .  .  . ',
  'F5 G5 A5 .  C6 .  A5 . ',
  'G5 A5 B5 .  D6 .  B5 . ',
  'E5 .  G5 .  B5 .  G5 . ',
  'A5 .  .  E5 C5 .  .  . ',
  'A5 .  C6 .  A5 .  F5 . ',
  'D5 .  F5 .  A5 .  F5 . ',
  'G5 .  B5 .  D6 .  B5 . ',
  'C6 .  .  .  .  .  .  . ',
].join(' ')

/**
 * The left hand, which never stops.
 *
 * Root, fifth, root, third — a walk rather than a pedal. Standing still in
 * this game and hearing the music carry on without you is the whole feeling a
 * side-scroller is after, and it comes from down here.
 */
const PIPES_BASS = [
  'C3 .  G2 .  C3 .  E3 . ',
  'A2 .  E3 .  A2 .  C3 . ',
  'F2 .  C3 .  F2 .  A2 . ',
  'G2 .  D3 .  G2 .  B2 . ',
  'C3 .  G2 .  C3 .  E3 . ',
  'E2 .  B2 .  E3 .  G2 . ',
  'D3 .  A2 .  D3 .  F3 . ',
  'G2 .  D3 .  G2 G2 B2 . ',
  'F2 .  C3 .  F2 .  A2 . ',
  'G2 .  D3 .  G2 .  B2 . ',
  'E2 .  B2 .  E3 .  G2 . ',
  'A2 .  E3 .  A2 .  C3 . ',
  'F2 .  C3 .  F2 .  A2 . ',
  'D3 .  A2 .  D3 .  F3 . ',
  'G2 .  D3 .  G2 .  B2 . ',
  'C3 .  G2 .  C3 C3 G2 . ',
].join(' ')

/**
 * The chord, struck twice a bar on the back of the beat.
 *
 * Root, fifth, octave and no third, which is not laziness: the third is what
 * makes a chord major or minor, and it is held by the voice below so that one
 * part can comp through both without needing a second pattern full of rests.
 */
const PIPES_COMP = [
  '.  .  C4 .  .  .  C4 . ',
  '.  .  A3 .  .  .  A3 . ',
  '.  .  F3 .  .  .  F3 . ',
  '.  .  G3 .  .  .  G3 . ',
  '.  .  C4 .  .  .  C4 . ',
  '.  .  E3 .  .  .  E3 . ',
  '.  .  D4 .  .  .  D4 . ',
  '.  .  G3 .  .  .  G3 . ',
  '.  .  F3 .  .  .  F3 . ',
  '.  .  G3 .  .  .  G3 . ',
  '.  .  E3 .  .  .  E3 . ',
  '.  .  A3 .  .  .  A3 . ',
  '.  .  F3 .  .  .  F3 . ',
  '.  .  G3 .  .  .  G3 . ',
  '.  .  D4 .  .  .  D4 . ',
  '.  .  C4 .  .  .  C4 C4',
].join(' ')

/**
 * One held note a bar: the third of whatever chord is underneath.
 *
 * This is the part that says major or minor. E over C, C over A minor, G over
 * E minor — nothing else in the tune has to care which kind of chord it is.
 */
const PIPES_COLOUR = [
  'E4 .  .  .  .  .  .  . ',
  'C4 .  .  .  .  .  .  . ',
  'A3 .  .  .  .  .  .  . ',
  'B3 .  .  .  .  .  .  . ',
  'E4 .  .  .  .  .  .  . ',
  'G4 .  .  .  .  .  .  . ',
  'F4 .  .  .  .  .  .  . ',
  'B3 .  .  .  .  .  .  . ',
  'A4 .  .  .  .  .  .  . ',
  'B4 .  .  .  .  .  .  . ',
  'G4 .  .  .  .  .  .  . ',
  'C5 .  .  .  .  .  .  . ',
  'A4 .  .  .  .  .  .  . ',
  'F4 .  .  .  .  .  .  . ',
  'B4 .  .  .  .  .  .  . ',
  'E5 .  .  .  .  .  .  . ',
].join(' ')

/** A bell every other bar, high up, once things start going badly. */
const PIPES_BELL = [
  'C6 .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'A5 .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'E6 .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'D6 .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  '.  .  .  .  .  .  .  . ',
  'D6 .  .  .  .  .  .  . ',
  'E6 .  .  .  .  .  .  . ',
].join(' ')

/*
 * The pipes, with the clock running down.
 *
 * A chip voice, deliberately, in a tune that has none: a narrow pulse on every
 * off-beat, arriving from underneath a piano. The machines he is running away
 * from sound like machines, and they turn up when the clock does.
 */
const PIPES_PUSH = [
  '.  C3 .  C3 .  C3 .  C3',
  '.  A2 .  A2 .  A2 .  A2',
  '.  F2 .  F2 .  F2 .  F2',
  '.  G2 .  G2 .  G2 .  G2',
  '.  C3 .  C3 .  C3 .  C3',
  '.  E2 .  E2 .  E2 .  E2',
  '.  D3 .  D3 .  D3 .  D3',
  '.  G2 .  G2 .  G2 .  G2',
  '.  F2 .  F2 .  F2 .  F2',
  '.  G2 .  G2 .  G2 .  G2',
  '.  E2 .  E2 .  E2 .  E2',
  '.  A2 .  A2 .  A2 .  A2',
  '.  F2 .  F2 .  F2 .  F2',
  '.  D3 .  D3 .  D3 .  D3',
  '.  G2 .  G2 .  G2 .  G2',
  '.  C3 .  C3 .  C3 C3 C3',
].join(' ')

/*
 * And the last of it.
 *
 * B against C — the leading note held under the root instead of resolving to
 * it — sours a major key faster than anything else you can do to it without
 * changing a single note of the tune.
 */
const PIPES_DREAD = [
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  C6',
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  C6',
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
].join(' ')

/** Off the beat as often as on it, which is what makes it bounce. */
const PIPES_DRUMS = 'x - - x - - x - '.repeat(15) + 'x - x - x - x x'

const PIPES_HOT_DRUMS = ('x - x - x - x x ').repeat(15) + 'x - x - x x x x'

export const PIPES: Track = {
  name: 'The Pipes',
  beatsPerMinute: 132,
  hotter: 10,
  quicker: 8,
  // A light lean rather than a shuffle. The left hand is already playing
  // straight eighths; swing them hard and it stops being a walk and starts
  // being a jazz trio.
  swing: 0.14,
  drums: PIPES_DRUMS,
  hotDrums: PIPES_HOT_DRUMS,
  /*
   * These are about half the numbers they were first written with, and the
   * reason is worth keeping: a struck note rings on past the length it was
   * written for, so the next one starts on top of it and three or four are
   * sounding at any moment. At the gains that suited an oscillator this tune
   * measured twice the loudness of every other one in the game and two and a
   * half times the peak — a jump you would hear on walking from one game into
   * the next, and not something the writing of it suggests anywhere.
   */
  parts: [
    { wave: 'piano', gain: 0.1, sustain: 0.9, pattern: PIPES_LEAD },
    { wave: 'pluck', gain: 0.085, sustain: 0.8, pattern: PIPES_BASS },
    { wave: 'piano', gain: 0.042, sustain: 1.4, chord: [0, 7, 12], pattern: PIPES_COMP },
    { wave: 'strings', gain: 0.028, sustain: 0.95, pattern: PIPES_COLOUR },
    { wave: 'bell', gain: 0.026, sustain: 1, pattern: PIPES_BELL, from: 0.45 },
    { wave: 'pulse', duty: 0.25, gain: 0.05, sustain: 0.26, pattern: PIPES_PUSH, from: 0.34 },
    { wave: 'strings', gain: 0.026, sustain: 1, pattern: PIPES_DREAD, from: 0.72 },
  ],
}

/*
 * Dave's caves.
 *
 * Dave was borrowing the maze's music, which made two quite different games
 * feel like one game with two skins. This is his own: D minor, slow, and
 * mostly space. A cave is a place you are careful in, so the tune leaves room
 * to be careful in — a low line walking down, and one high note a bar,
 * dripping.
 */

const CAVERN_LEAD = [
  'D4 .  F4 .  A4 .  F4 . ',
  'C4 .  E4 .  G4 .  E4 . ',
  'Bb3 . D4 .  F4 .  D4 . ',
  'A3 .  C4 .  E4 .  .  . ',
  'D5 .  .  C5 A4 .  F4 . ',
  'G4 .  .  F4 D4 .  A3 . ',
  'Bb3 . C4 .  D4 .  F4 . ',
  'A3 .  .  .  .  .  .  . ',
].join(' ')

const CAVERN_BASS = [
  'D3 .  .  .  A3 .  .  . ',
  'C3 .  .  .  G3 .  .  . ',
  'Bb2 . .  .  F3 .  .  . ',
  'A2 .  .  .  E3 .  .  . ',
  'D3 .  .  .  A3 .  .  . ',
  'G2 .  .  .  D3 .  .  . ',
  'Bb2 . .  .  F3 .  .  . ',
  'A2 .  .  .  .  .  .  . ',
].join(' ')

/** The drip. One note a bar, always on the same eighth, always on its own. */
const CAVERN_DRIP = [
  '-  -  -  -  -  -  A4 - ',
  '-  -  -  -  -  -  G4 - ',
  '-  -  -  -  -  -  F4 - ',
  '-  -  -  -  -  -  E4 - ',
  '-  -  -  -  -  -  D4 - ',
  '-  -  -  -  -  -  F4 - ',
  '-  -  -  -  -  -  G4 - ',
  '-  -  -  -  -  -  A4 - ',
].join(' ')


/*
 * The caves, once the timer is against you.
 *
 * Bb against A: the flat sixth a semitone above the fifth, which is the
 * oldest suspense interval there is. It sits over a tune that is otherwise
 * quite happy to potter about underground.
 */
const CAVERN_PUSH = [
  '.  D3 .  D3 .  D3 .  D3',
  '.  C3 .  C3 .  C3 .  C3',
  '.  Bb2 . Bb2 . Bb2 . Bb2',
  '.  A2 .  A2 .  A2 .  A2',
  '.  D3 .  D3 .  D3 .  D3',
  '.  G2 .  G2 .  G2 .  G2',
  '.  Bb2 . Bb2 . Bb2 . Bb2',
  '.  A2 .  A2 .  A2 A2 A2',
].join(' ')

const CAVERN_DREAD = [
  'Bb5 . .  .  .  .  .  . ',
  'A5 .  .  .  .  .  .  . ',
  'Bb5 . .  .  .  .  .  . ',
  'A5 .  .  .  .  .  .  . ',
  'Bb5 . .  .  .  .  .  A5',
  'Bb5 . .  .  .  .  .  . ',
  'A5 .  .  .  .  .  .  . ',
  'Bb5 . .  .  .  .  .  . ',
].join(' ')

/*
 * The caves have no drum track at all, on purpose: they are a slow errand
 * underground and the pipes are a run, and a drum is most of what separates
 * them. So the caves get only a hot pattern — silence until the timer is
 * against you, and then a pulse that was never there before. That is a
 * stronger effect than speeding up a beat the player has been hearing since
 * the level began.
 */
const CAVERN_HOT_DRUMS = ('- - x - x - - x ').repeat(7) + '- - x - x - x x'

export const CAVERN: Track = {
  name: "Dave's Caves",
  beatsPerMinute: 104,
  hotter: 14,
  quicker: 8,
  hotDrums: CAVERN_HOT_DRUMS,
  parts: [
    {
      wave: 'triangle',
      gain: 0.16,
      sustain: 0.9,
      vibrato: { cents: 20, hz: 4.5, delay: 0.2 },
      pattern: CAVERN_LEAD,
    },
    { wave: 'triangle', gain: 0.22, sustain: 1, pattern: CAVERN_BASS },
    /*
     * The drip, and the last shrill thing in here.
     *
     * An eighth-duty pulse up in the fifth octave, once a bar, all the way
     * through the caves — reported as "a really high pitch noisy sound", and
     * noticed when a question came up because that is the moment everything
     * else stops and it is all you can hear. A sine has no harmonics at all to
     * be shrill with, and a drip of water is about the only thing in the world
     * that actually sounds like one.
     */
    { wave: 'sine', gain: 0.075, sustain: 0.3, pattern: CAVERN_DRIP },
    { wave: 'pulse', duty: 0.5, gain: 0.08, sustain: 0.28, pattern: CAVERN_PUSH, from: 0.32 },
    { wave: 'triangle', gain: 0.072, sustain: 1, pattern: CAVERN_DREAD, from: 0.7 },
  ],
}

/*
 * The dungeon, in cues.
 *
 * The original had twenty-two of these — Prologue, Princess, Jaffar,
 * Heartbeat, Danger, Potion, Victory, Accident, Heroic Death, The Shadow,
 * Float, Timer, Tragic End, Embrace, Epilogue — and no loop at all. That is
 * the part worth copying and the part everyone forgets: the game is silent
 * nearly all of the time, so when eight bars of anything arrive they land.
 * Background music underneath the whole thing would take that away.
 *
 * The idiom is Phrygian dominant on D — D Eb F# G A Bb C — which is the mode
 * with a flattened second and a major third, and so the step of three
 * semitones between them that the ear reads immediately as Persian. Every cue
 * below is built out of that one scale, which is what makes them sound like
 * each other.
 */

/** A cue is a track that plays once and stops. */
export const DUNGEON: Track = {
  name: 'The Dungeon',
  beatsPerMinute: 76,
  parts: [
    {
      wave: 'pulse',
      duty: 0.25,
      gain: 0.13,
      sustain: 0.95,
      vibrato: { cents: 35, hz: 4.8, delay: 0.18 },
      pattern: [
        'D5 .  .  -  C5 .  Bb4 . ',
        'A4 .  .  -  G4 .  F#4 . ',
        'Eb4 . D4 .  .  .  -  - ',
      ].join(' '),
    },
    {
      wave: 'sine',
      gain: 0.1,
      sustain: 1,
      pattern: ['D3 .  .  .  .  .  .  . ', 'D3 .  .  .  .  .  .  . ', 'A2 .  .  .  .  .  .  . '].join(' '),
    },
  ],
}

/** A guard has seen him. Rising, and it does not resolve. */
export const DANGER: Track = {
  name: 'Danger',
  beatsPerMinute: 150,
  parts: [
    { wave: 'pulse', duty: 0.125, gain: 0.12, sustain: 0.6, pattern: 'A4 Bb4 A4 Eb4 - A4 Bb4 A4 Eb4 - D5 . . .' },
    { wave: 'triangle', gain: 0.22, sustain: 0.5, pattern: 'D3 - D3 - - D3 - D3 - - Eb3 . . .' },
  ],
}

/** Steel. Two hits, and the second one higher. */
export const BLADE: Track = {
  name: 'Blade',
  beatsPerMinute: 160,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.12, sustain: 0.35, pattern: 'Bb5 - D6 - - -' }],
}

/** A potion: the only cue in the game that goes up and stays there. */
export const POTION: Track = {
  name: 'Potion',
  beatsPerMinute: 132,
  parts: [
    { wave: 'sine', gain: 0.14, sustain: 0.8, pattern: 'D5 F#5 A5 D6 . . - -' },
    { wave: 'triangle', gain: 0.1, sustain: 0.9, pattern: 'D4 .  .  A4 .  .  - -' },
  ],
}

/** Death. Falls, and the last note is the flattened second. */
export const TRAGIC: Track = {
  name: 'Tragic End',
  beatsPerMinute: 66,
  parts: [
    { wave: 'triangle', gain: 0.16, sustain: 0.95,
      pattern: 'A4 .  .  G4 .  .  F#4 .  .  .  Eb4 .  .  D4 .  .  .  .  .  . ' },
    { wave: 'sine', gain: 0.11, sustain: 1,
      pattern: 'D3 .  .  .  .  .  Bb2 .  .  .  .  .  .  .  D2 .  .  .  .  . ' },
  ],
}

/** A level done. The same phrase as the dungeon cue, climbing instead. */
export const VICTORY: Track = {
  name: 'Victory',
  beatsPerMinute: 144,
  parts: [
    { wave: 'triangle', gain: 0.18, sustain: 0.75,
      pattern: 'D4 D4 D4 .  G4 .  Bb4 . D5 .  .  Bb4 D5 .  G5 .  .  .  .  . ' },
    { wave: 'pulse', gain: 0.07, sustain: 0.6,
      pattern: '.  .  .  .  D4 .  G4 .  Bb4 . .  G4 Bb4 . D5 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.12, sustain: 1,
      pattern: 'G2 .  .  .  G2 .  .  .  D3 .  .  .  .  .  G3 .  .  .  .  . ' },
  ],
}

/**
 * A gate moving. Iron and counterweights rather than music.
 *
 * The same cue serves opening and closing: what you need to know is that
 * something heavy moved somewhere, and the gate you are looking at tells you
 * which way. Two notes that would take a second to tell apart would be worse.
 */
export const GATE: Track = {
  name: 'Gate',
  beatsPerMinute: 150,
  parts: [
    { wave: 'pulse', duty: 0.5, gain: 0.12, sustain: 0.35, pattern: 'D3 A3 D4 .  -  - ' },
    { wave: 'triangle', gain: 0.16, sustain: 0.3, pattern: 'D2 -  D2 -  -  - ' },
  ],
}

/** The clock. One low toll, and a second under it. */
export const TIMER: Track = {
  name: 'Timer',
  beatsPerMinute: 96,
  parts: [
    { wave: 'sine', gain: 0.18, sustain: 1, pattern: 'D3 .  .  Eb3 . . ' },
  ],
}


/*
 * The pipes, in cues.
 *
 * The opposite approach to the dungeon: this game is noisy on purpose. You are
 * meant to hear what you did the instant you do it, so every one of these is
 * under a second and a half, and every one goes up except the two that are
 * bad news. All built from plain C major, which is what keeps them sounding
 * like they belong to the same bright little world as the tune.
 */

/** A coin. Two notes, the second higher, and gone. */
export const COIN: Track = {
  name: 'Coin',
  beatsPerMinute: 200,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.09, sustain: 0.5, pattern: 'B4 E5 .  . ' }],
}

/** A jump. Short, because he does it constantly. */
export const HOP: Track = {
  name: 'Hop',
  beatsPerMinute: 220,
  parts: [{ wave: 'pulse', duty: 0.25, gain: 0.1, sustain: 0.4, pattern: 'C5 G5 -  - ' }],
}

/** Landing on something. Down, not up: this one happened to someone else. */
export const STOMP: Track = {
  name: 'Stomp',
  beatsPerMinute: 190,
  parts: [{ wave: 'triangle', gain: 0.18, sustain: 0.45, pattern: 'G4 .  C4 -  - ' }],
}

/** A mushroom. The one cue that climbs the whole way. */
export const GROW: Track = {
  name: 'Grow',
  beatsPerMinute: 180,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.12, sustain: 0.6, pattern: 'C4 E4 G4 C5 E5 G5 C6 . ' }],
}

/** A life lost. Falls, and keeps falling. */
export const FALL: Track = {
  name: 'Fall',
  beatsPerMinute: 94,
  parts: [
    { wave: 'triangle', gain: 0.17, sustain: 0.9,
      pattern: 'C5 .  B4 .  A4 .  .  .  G4 .  F4 .  E4 .  .  .  .  .  .  . ' },
    { wave: 'sine', gain: 0.11, sustain: 1,
      pattern: 'A2 .  .  .  .  .  .  .  F2 .  .  .  .  .  .  .  C2 .  .  . ' },
  ],
}

/** The flag. The only thing in the game worth a fanfare. */
export const FLAG: Track = {
  name: 'Flag',
  beatsPerMinute: 146,
  parts: [
    { wave: 'triangle', gain: 0.18, sustain: 0.75,
      pattern: 'G4 G4 G4 .  C5 .  E5 .  G5 .  .  E5 G5 .  C6 .  .  .  .  . ' },
    { wave: 'pulse', gain: 0.07, sustain: 0.6,
      pattern: '.  .  .  .  C4 .  E4 .  G4 .  .  E4 G4 .  C5 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.12, sustain: 1,
      pattern: 'C3 .  .  .  C3 .  .  .  G3 .  .  .  .  .  C4 .  .  .  .  . ' },
  ],
}

/*
 * The maze, in cues.
 *
 * The board had one loop and nothing else: the same bars whether you were
 * clearing a corner in peace or being run down in a dead end. Asked for, and
 * fairly: "I want the sound beat to change on special events."
 *
 * All of these are A harmonic minor — A B C D E F G G# — which is what the
 * chase tune is built from, so they belong to it rather than sitting on top of
 * it. The one with the raised seventh is the one that sounds like a chase.
 *
 * The chomp is the hard one. It fires several times a second for the length of
 * a board, so it has to be two notes, quiet, and over before it is noticed —
 * a cue you hear properly the four-hundredth time is a cue you hate.
 */

/**
 * A dot. As small as a sound can be and still be one.
 *
 * An octave lower than it was, along with the coin and the overtake. All three
 * were narrow pulses up at the fifth and sixth octave, which is the right
 * shape for a blip and the wrong register for one that fires several times a
 * second for twenty minutes — and the dot is the most frequent sound in the
 * whole project by a distance. Same waveform, same shape, one octave down: it
 * still reads as a blip and stops accumulating into a headache.
 */
export const CHOMP: Track = {
  name: 'Chomp',
  beatsPerMinute: 260,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.05, sustain: 0.3, pattern: 'A4 E4' }],
}

/** A power pellet. The board is about to change hands. */
export const PELLET: Track = {
  name: 'Pellet',
  beatsPerMinute: 190,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.12, sustain: 0.5, pattern: 'A4 C5 E5 A5 .  . ' },
    { wave: 'triangle', gain: 0.16, sustain: 0.8, pattern: 'A2 .  .  E3 .  . ' },
  ],
}

/** Catching one of them, which is the only time the chase runs the other way. */
export const CATCH: Track = {
  name: 'Catch',
  beatsPerMinute: 210,
  parts: [{ wave: 'pulse', duty: 0.5, gain: 0.13, sustain: 0.45, pattern: 'E5 A5 C6 E6 .  . ' }],
}

/** Caught. Down the whole scale, one note at a time, no hurry. */
export const CAUGHT: Track = {
  name: 'Caught',
  beatsPerMinute: 96,
  parts: [
    { wave: 'triangle', gain: 0.17, sustain: 0.9,
      pattern: 'A4 .  G4 .  F4 .  .  .  E4 .  D4 .  C4 .  .  .  .  .  .  . ' },
    { wave: 'sine', gain: 0.11, sustain: 1,
      pattern: 'A2 .  .  .  .  .  .  .  F2 .  .  .  .  .  .  .  A1 .  .  . ' },
  ],
}

/** A board cleared. */
export const CLEARED: Track = {
  name: 'Cleared',
  beatsPerMinute: 150,
  parts: [
    { wave: 'triangle', gain: 0.18, sustain: 0.75,
      pattern: 'G4 G4 G4 .  C5 .  E5 .  G5 .  .  E5 G5 .  C6 .  .  .  .  . ' },
    { wave: 'pulse', gain: 0.07, sustain: 0.6,
      pattern: '.  .  .  .  E4 .  G4 .  C5 .  .  G4 C5 .  E5 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.12, sustain: 1,
      pattern: 'C3 .  .  .  C3 .  .  .  G3 .  .  .  .  .  C4 .  .  .  .  . ' },
  ],
}

/*
 * The caves, in cues.
 *
 * D natural minor — D E F G A Bb C — which is where the cave loop lives, so
 * these sit inside it the way the maze's sit inside the chase.
 */

/** A diamond. He takes a great many, so it is two notes and gone. */
export const GEM: Track = {
  name: 'Gem',
  beatsPerMinute: 250,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.07, sustain: 0.35, pattern: 'D5 A5' }],
}

/** The trophy: the thing the whole cave is for. */
export const TROPHY: Track = {
  name: 'Trophy',
  beatsPerMinute: 165,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.13, sustain: 0.65, pattern: 'D4 F4 A4 D5 F5 A5 D6 .  .  . ' },
    { wave: 'triangle', gain: 0.18, sustain: 0.9, pattern: 'D3 .  .  A3 .  .  D4 .  .  . ' },
  ],
}

/** The door, once the trophy is his. */
export const EXIT: Track = {
  name: 'Exit',
  beatsPerMinute: 148,
  parts: [
    { wave: 'triangle', gain: 0.18, sustain: 0.75,
      pattern: 'A4 A4 A4 .  D5 .  F5 .  A5 .  .  F5 A5 .  D6 .  .  .  .  . ' },
    { wave: 'pulse', gain: 0.07, sustain: 0.6,
      pattern: '.  .  .  .  A4 .  D5 .  F5 .  .  D5 F5 .  A5 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.12, sustain: 1,
      pattern: 'D3 .  .  .  D3 .  .  .  A3 .  .  .  .  .  D4 .  .  .  .  . ' },
  ],
}

/** A jump. He does it constantly, so it barely happens. */
export const LEAP: Track = {
  name: 'Leap',
  beatsPerMinute: 240,
  parts: [{ wave: 'pulse', duty: 0.25, gain: 0.07, sustain: 0.3, pattern: 'A4 D5' }],
}

/** The jetpack, which climbs because that is what it is for. */
export const JETPACK: Track = {
  name: 'Jetpack',
  beatsPerMinute: 200,
  parts: [{ wave: 'pulse', duty: 0.5, gain: 0.09, sustain: 0.5, pattern: 'D4 E4 F4 G4 A4 Bb4 C5 D5 .  . ' }],
}

/** Fire, water, a tentacle, or a very long drop. */
export const LOST: Track = {
  name: 'Lost',
  beatsPerMinute: 92,
  parts: [
    { wave: 'triangle', gain: 0.17, sustain: 0.9,
      pattern: 'D5 .  C5 .  Bb4 . .  .  A4 .  G4 .  F4 .  .  .  .  .  .  . ' },
    { wave: 'sine', gain: 0.11, sustain: 1,
      pattern: 'D3 .  .  .  .  .  .  .  Bb2 .  .  .  .  .  .  .  D2 .  .  . ' },
  ],
}

/*
 * The road, in cues.
 *
 * E natural minor — E F# G A B C D — which is what the driving loop is built
 * from, so a cue interrupts the tune rather than arriving from somewhere else.
 *
 * The overtake is the hard one, as the chomp was in the maze: you pass a car
 * every couple of seconds for the length of a level, so it is two notes and
 * gone before it is noticed.
 */

/** The road itself: four bars that go round and do not ask to be listened to. */
const ROAD_LEAD = [
  'E4 .  G4 .  B4 .  G4 . ',
  'D4 .  F#4 . A4 .  F#4 .',
  'C4 .  E4 .  G4 .  E4 . ',
  'B3 .  D4 .  F#4 . B4 . ',
  'E5 .  D5 .  B4 .  G4 . ',
  'A4 .  .  F#4 D4 .  A3 . ',
  'C5 .  B4 .  G4 .  E4 . ',
  'F#4 . B4 .  E4 .  .  . ',
].join(' ')
const ROAD_BASS = [
  'E2 .  E3 .  E2 .  B2 . ',
  'D2 .  D3 .  D2 .  A2 . ',
  'C2 .  C3 .  C2 .  G2 . ',
  'B1 .  B2 .  F#2 . B2 . ',
  'E2 .  E3 .  E2 .  B2 . ',
  'D2 .  D3 .  A2 .  D3 . ',
  'C2 .  C3 .  G2 .  C3 . ',
  'B1 .  F#2 . B2 .  B1 . ',
].join(' ')
/*
 * The third voice: root, fifth, octave flicked inside every note, which is how
 * one oscillator carried a whole chord. Without it the road is a line and a
 * bass and nothing holding them together — and a tune played under a whole
 * game needs something to sit on.
 */
const ROAD_PAD = [
  'E3 .  .  .  E3 .  .  . ',
  'D3 .  .  .  D3 .  .  . ',
  'C3 .  .  .  C3 .  .  . ',
  'B2 .  .  .  F#3 . .  . ',
  'E3 .  .  .  E3 .  .  . ',
  'D3 .  .  .  A2 .  .  . ',
  'C3 .  .  .  G2 .  .  . ',
  'B2 .  .  .  B2 .  .  . ',
].join(' ')


/*
 * The road, as the traffic thickens.
 *
 * The push is the root on every off-beat, which on a driving tune reads as
 * speed. The dread is C against B — the flat sixth leaning on the fifth, held
 * high — and it is the only thing in this track that is not going anywhere.
 */
const ROAD_PUSH = [
  '.  E3 .  E3 .  E3 .  E3',
  '.  D3 .  D3 .  D3 .  D3',
  '.  C3 .  C3 .  C3 .  C3',
  '.  B2 .  B2 .  B2 .  B2',
  '.  E3 .  E3 .  E3 .  E3',
  '.  D3 .  D3 .  D3 .  D3',
  '.  C3 .  C3 .  C3 .  C3',
  '.  B2 .  B2 .  B2 B2 B2',
].join(' ')

const ROAD_DREAD = [
  'C5 .  .  .  .  .  .  . ',
  'B4 .  .  .  .  .  .  . ',
  'C5 .  .  .  .  .  .  . ',
  'B4 .  .  .  .  .  .  . ',
  'C5 .  .  .  .  .  .  B4',
  'C5 .  .  .  .  .  .  . ',
  'B4 .  .  .  .  .  .  . ',
  'C5 .  .  .  .  .  .  . ',
].join(' ')

const ROAD_DRUMS = '- - x - - - x - '.repeat(8)
const ROAD_HOT_DRUMS = ('x - x - x - x x ').repeat(7) + 'x - x - x x x x'

export const ROAD: Track = {
  name: 'The Road',
  beatsPerMinute: 148,
  hotter: 12,
  quicker: 9,
  drums: ROAD_DRUMS,
  hotDrums: ROAD_HOT_DRUMS,
  parts: [
    {
      wave: 'triangle',
      gain: 0.15,
      sustain: 0.8,
      vibrato: { cents: 12, hz: 5, delay: 0.14 },
      pattern: ROAD_LEAD,
    },
    { wave: 'triangle', gain: 0.26, sustain: 0.55, pattern: ROAD_BASS },
    {
      wave: 'pulse',
      duty: 0.125,
      gain: 0.06,
      sustain: 0.95,
      arp: [0, 7, 12],
      arpRate: 18,
      pattern: ROAD_PAD,
    },
    { wave: 'pulse', duty: 0.5, gain: 0.08, sustain: 0.26, pattern: ROAD_PUSH, from: 0.3 },
    { wave: 'triangle', gain: 0.072, sustain: 1, pattern: ROAD_DREAD, from: 0.68 },
  ],
}

/** Getting past one of his. Two notes, because it happens all game long. */
export const OVERTAKE: Track = {
  name: 'Overtake',
  beatsPerMinute: 260,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.05, sustain: 0.3, pattern: 'B4 E5' }],
}

/** A can of fuel. */
export const REFUEL: Track = {
  name: 'Refuel',
  beatsPerMinute: 190,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.12, sustain: 0.55, pattern: 'E4 G4 B4 E5 .  . ' },
    { wave: 'triangle', gain: 0.15, sustain: 0.8, pattern: 'E2 .  .  B2 .  . ' },
  ],
}

/** Hitting something, or running the tank dry. Down, and not pleasant. */
export const PRANG: Track = {
  name: 'Prang',
  beatsPerMinute: 98,
  parts: [
    { wave: 'triangle', gain: 0.17, sustain: 0.9,
      pattern: 'E5 .  D5 .  B4 .  .  .  A4 .  G4 .  F#4 .  .  .  .  .  .  . ' },
    { wave: 'sine', gain: 0.11, sustain: 1,
      pattern: 'A2 .  .  .  .  .  .  .  F#2 .  .  .  .  .  .  .  B1 .  .  . ' },
  ],
}

/**
 * The tank getting low. Two notes, twice, and not pleasant to ignore.
 *
 * A warning has to be a different shape from everything else in the set or it
 * reads as scenery. This one repeats, which nothing else here does.
 */
export const WARN: Track = {
  name: 'Low',
  beatsPerMinute: 200,
  parts: [{ wave: 'pulse', duty: 0.5, gain: 0.11, sustain: 0.45, pattern: 'B4 .  G4 .  B4 .  G4 . ' }],
}

/** One of his patrols, taking your overtake personally. */
export const SIREN: Track = {
  name: 'Siren',
  beatsPerMinute: 170,
  parts: [{ wave: 'pulse', duty: 0.25, gain: 0.09, sustain: 0.6, pattern: 'B4 E5 B4 E5 .  . ' }],
}

/**
 * One of the three lights coming on. A tick, and nothing more than a tick.
 *
 * The whole point of a countdown is the silence between the beats, so this
 * has to be short enough to leave some.
 */
export const LIGHT: Track = {
  name: 'Light',
  beatsPerMinute: 240,
  parts: [{ wave: 'pulse', duty: 0.5, gain: 0.07, sustain: 0.4, pattern: 'B4 B5' }],
}

/** And them going out. Up, and quick, because you should already be moving. */
export const GREEN: Track = {
  name: 'Green',
  beatsPerMinute: 210,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.14, sustain: 0.55, pattern: 'E5 B5 E6 .  . ' },
    { wave: 'triangle', gain: 0.16, sustain: 0.7, pattern: 'E3 .  E4 .  . ' },
  ],
}

/** The end of a level. */
export const ARRIVE: Track = {
  name: 'Arrive',
  beatsPerMinute: 150,
  parts: [
    { wave: 'triangle', gain: 0.18, sustain: 0.75,
      pattern: 'G4 G4 G4 .  B4 .  D5 .  G5 .  .  D5 G5 .  B5 .  .  .  .  . ' },
    { wave: 'pulse', gain: 0.07, sustain: 0.6,
      pattern: '.  .  .  .  G4 .  B4 .  D5 .  .  B4 D5 .  G5 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.12, sustain: 1,
      pattern: 'G2 .  .  .  G2 .  .  .  D3 .  .  .  .  .  G3 .  .  .  .  . ' },
  ],
}


/*
 * Space, in E Phrygian — E F G A B C D.
 *
 * The flattened second is the whole point. A semitone between the root and the
 * note above it is the interval the ear reads as something being wrong, and it
 * is why this sounds like a long way from home rather than a nice trip to see
 * Saturn. Same seven notes as E minor with one changed, so it sits next to the
 * road's tune in the collection without being it.
 *
 * It is also the first track written around the heat. Three voices play from
 * the start; the pulse arrives as the sky fills up and the high rub arrives
 * near the world, so the eighty seconds out to Neptune are not eighty seconds
 * of the same eight bars.
 */
const SPACE_LEAD = [
  'E4 .  G4 .  B4 .  .  . ',
  'F4 .  A4 .  C5 .  .  . ',
  'G4 .  B4 .  D5 .  .  . ',
  'F4 .  C5 .  A4 .  .  . ',
  'E5 .  D5 .  B4 .  G4 . ',
  'C5 .  B4 .  A4 .  F4 . ',
  'G4 .  A4 .  B4 .  C5 . ',
  'B4 .  .  .  E4 .  .  . ',
].join(' ')

const SPACE_BASS = [
  'E2 .  .  .  E2 .  .  . ',
  'F2 .  .  .  F2 .  .  . ',
  'G2 .  .  .  G2 .  .  . ',
  'F2 .  .  .  C3 .  .  . ',
  'E2 .  .  .  E2 .  .  . ',
  'C2 .  .  .  C2 .  .  . ',
  'G2 .  .  .  A2 .  .  . ',
  'B2 .  .  .  E2 .  .  . ',
].join(' ')

const SPACE_PAD = [
  'E3 .  .  .  .  .  .  . ',
  'F3 .  .  .  .  .  .  . ',
  'G3 .  .  .  .  .  .  . ',
  'F3 .  .  .  .  .  .  . ',
  'E3 .  .  .  .  .  .  . ',
  'C3 .  .  .  .  .  .  . ',
  'G3 .  .  .  .  .  .  . ',
  'B2 .  .  .  .  .  .  . ',
].join(' ')

/** The heartbeat. Comes in once the sky is no longer empty. */
const SPACE_PULSE = [
  'E3 E3 .  .  E3 E3 .  . ',
  'F3 F3 .  .  F3 F3 .  . ',
  'G3 G3 .  .  G3 G3 .  . ',
  'F3 F3 .  .  F3 F3 .  . ',
  'E3 E3 .  .  E3 E3 .  . ',
  'C3 C3 .  .  C3 C3 .  . ',
  'G3 G3 .  .  G3 G3 .  . ',
  'B2 B2 .  .  B2 B2 .  . ',
].join(' ')

/**
 * The rub, held high, and the reason the last stretch is unpleasant.
 *
 * F against E: a semitone apart, an octave and a half above the bass. It is
 * not a tune and it is not supposed to be noticed as one — it is the sound of
 * the run going badly.
 */
const SPACE_DREAD = [
  'F5 .  .  .  .  .  .  . ',
  'E5 .  .  .  .  .  .  . ',
  'F5 .  .  .  .  .  .  . ',
  'E5 .  .  .  .  .  .  . ',
  'F5 .  .  .  .  .  .  E5',
  'F5 .  .  .  .  .  .  . ',
  'E5 .  .  .  .  .  .  . ',
  'F5 .  .  .  .  .  .  . ',
].join(' ')

const SPACE_DRUMS = '- - - - x - - - '.repeat(8)
const SPACE_HOT_DRUMS = '- - x - x - x - '.repeat(7) + '- - x - x - x x'

export const SPACE: Track = {
  name: 'The Long Way Out',
  beatsPerMinute: 104,
  hotter: 14,
  drums: SPACE_DRUMS,
  hotDrums: SPACE_HOT_DRUMS,
  parts: [
    {
      wave: 'triangle',
      gain: 0.15,
      sustain: 0.9,
      vibrato: { cents: 12, hz: 4.5, delay: 0.18 },
      pattern: SPACE_LEAD,
    },
    { wave: 'triangle', gain: 0.26, sustain: 0.9, pattern: SPACE_BASS },
    {
      wave: 'pulse',
      duty: 0.125,
      gain: 0.06,
      sustain: 0.98,
      arp: [0, 7, 12],
      arpRate: 16,
      pattern: SPACE_PAD,
    },
    { wave: 'pulse', duty: 0.5, gain: 0.1, sustain: 0.3, pattern: SPACE_PULSE, from: 0.28 },
    { wave: 'triangle', gain: 0.080, sustain: 1, pattern: SPACE_DREAD, from: 0.66 },
  ],
}

/** A bolt going. Fires four times a second when the fire button is held. */
export const LASER: Track = {
  name: 'Laser',
  beatsPerMinute: 280,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.05, sustain: 0.3, pattern: 'B5 E5' }],
}

/** A hit that did not finish it. */
export const PING: Track = {
  name: 'Ping',
  beatsPerMinute: 300,
  parts: [{ wave: 'pulse', duty: 0.25, gain: 0.06, sustain: 0.3, pattern: 'G5 E5' }],
}

/** Something coming apart. */
export const BURST: Track = {
  name: 'Burst',
  beatsPerMinute: 200,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.12, sustain: 0.5, pattern: 'E5 G5 B5 E6 .  . ' },
    { wave: 'triangle', gain: 0.14, sustain: 0.7, pattern: 'E3 .  B3 .  .  . ' },
  ],
}

/** Taking one on the hull. Down, and a long way down. */
export const STRUCK: Track = {
  name: 'Struck',
  beatsPerMinute: 94,
  parts: [
    { wave: 'triangle', gain: 0.17, sustain: 0.9,
      pattern: 'E5 .  D5 .  B4 .  .  .  A4 .  G4 .  F4 .  .  .  .  .  .  . ' },
    { wave: 'sine', gain: 0.11, sustain: 1,
      pattern: 'A2 .  .  .  .  .  .  .  F2 .  .  .  .  .  .  .  A1 .  .  . ' },
  ],
}

/** Arriving somewhere real. */
export const ORBIT: Track = {
  name: 'Orbit',
  beatsPerMinute: 150,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.14, sustain: 0.7, pattern: 'E4 G4 B4 E5 .  D5 C5 B4 E5 .  .  . ' },
    { wave: 'triangle', gain: 0.18, sustain: 0.85, pattern: 'E2 .  .  .  B2 .  .  .  E3 .  .  . ' },
  ],
}

/** The world filling the screen. Repeats, which nothing else in the set does. */
export const CLOSING: Track = {
  name: 'Closing',
  beatsPerMinute: 200,
  parts: [{ wave: 'pulse', duty: 0.5, gain: 0.1, sustain: 0.45, pattern: 'C5 .  B4 .  C5 .  B4 . ' }],
}

/** A cell of scrap, pocketed. Fires as often as the laser nearly. */
export const CELL: Track = {
  name: 'Cell',
  beatsPerMinute: 300,
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.06, sustain: 0.35, pattern: 'B5 E6' }],
}

/** Space's own set, all in E Phrygian, like the loop they interrupt. */
/**
 * Somebody shooting back.
 *
 * Downwards, where yours goes up, and on a sawtooth where yours is a thin
 * pulse — the two have to be told apart with your eyes somewhere else. E
 * Phrygian, like everything out here.
 */
export const INCOMING: Track = {
  name: 'Incoming',
  beatsPerMinute: 280,
  parts: [{ wave: 'sawtooth', gain: 0.045, sustain: 0.35, pattern: 'A4 E4' }],
}

/**
 * The gun shutting itself.
 *
 * Two notes falling away, and quiet — it is not a disaster, it is the thing
 * telling you to let go for a moment. Loud enough to be noticed over a full
 * screen, because the one thing worse than the gun cutting out is the gun
 * cutting out without saying so and the player deciding the game is broken.
 */
export const COOLING: Track = {
  name: 'Cooling',
  beatsPerMinute: 230,
  parts: [
    { wave: 'pulse', duty: 0.125, gain: 0.1, sustain: 0.5, pattern: 'B4 .  E4 .  .  . ' },
    { wave: 'triangle', gain: 0.12, sustain: 0.9, pattern: 'E3 .  .  .  .  . ' },
  ],
}

export const SPACE_CUES = {
  laser: LASER,
  incoming: INCOMING,
  ping: PING,
  cell: CELL,
  burst: BURST,
  struck: STRUCK,
  orbit: ORBIT,
  closing: CLOSING,
  cooling: COOLING,
} as const

export const TRACKS = {
  chase: CHASE,
  thinking: THINKING,
  pipes: PIPES,
  cavern: CAVERN,
  road: ROAD,
  space: SPACE,
} as const
export type TrackName = keyof typeof TRACKS

/** The dungeon's own set, all in the one Persian scale. */
export const DUNGEON_CUES = {
  dungeon: DUNGEON,
  danger: DANGER,
  blade: BLADE,
  potion: POTION,
  tragic: TRAGIC,
  victory: VICTORY,
  timer: TIMER,
  gate: GATE,
} as const

/** The maze's own set, all in A harmonic minor, like the chase. */
export const MAZE_CUES = {
  chomp: CHOMP,
  pellet: PELLET,
  catchOne: CATCH,
  caught: CAUGHT,
  cleared: CLEARED,
} as const

/** The caves' own set, all in D natural minor, like the cave loop. */
export const CAVE_CUES = {
  gem: GEM,
  trophy: TROPHY,
  exit: EXIT,
  leap: LEAP,
  jetpack: JETPACK,
  lost: LOST,
} as const

/** The road's own set, all in E natural minor, like the driving loop. */
export const ROAD_CUES = {
  light: LIGHT,
  green: GREEN,
  overtake: OVERTAKE,
  refuel: REFUEL,
  prang: PRANG,
  arrive: ARRIVE,
  warn: WARN,
  siren: SIREN,
} as const

/** The pipes' own set, all in plain C major. */
/**
 * Down a pipe.
 *
 * A stepped slide, the whole scale downwards and then nothing, because what it
 * is announcing is a disappearance. C major, like everything else that happens
 * here.
 */
export const PIPE_DOWN: Track = {
  name: 'Down We Go',
  beatsPerMinute: 240,
  parts: [{ wave: 'pulse', duty: 0.25, gain: 0.1, sustain: 0.5,
            pattern: 'C5 B4 A4 G4 F4 E4 D4 C4 .  . ' }],
}

export const PIPE_CUES = {
  coin: COIN,
  hop: HOP,
  stomp: STOMP,
  grow: GROW,
  fall: FALL,
  flag: FLAG,
  pipeDown: PIPE_DOWN,
} as const

// Six sets, because each is held to its own scale — and each scale is the
// one its game's own loop is built from, so a cue sounds like the tune it
// interrupts. Mixing them would mean holding none of them to anything.
/** Something cheerful to walk to. */
export const TRAVEL: Track = {
  name: 'On We Go',
  beatsPerMinute: 132,
  parts: [
    { wave: 'triangle', gain: 0.17, sustain: 0.7,
      pattern: 'C5 .  E5 G5 .  E5 G5 .  C6 .  .  G5 C6 .  .  .  .  . ' },
    { wave: 'pulse', duty: 0.5, gain: 0.055, sustain: 0.5,
      pattern: '.  .  C5 E5 .  C5 E5 .  G5 .  .  E5 G5 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.11, sustain: 1,
      pattern: 'C3 .  .  .  G2 .  .  .  C3 .  .  .  G3 .  C4 .  .  . ' },
  ],
}

/**
 * The walk between levels.
 *
 * Its own group rather than any game's, because it plays over a scene that
 * belongs to no game's key — the same two and a half seconds runs after the
 * maze in C, the caves in D minor and the road in E minor, and pinning it to
 * one of them would put it a tone out from the other two. A short phrase that
 * goes up and stops has nothing to clash with anyway: by the time it plays,
 * the level's own music has already stopped.
 */
export const WIPE_CUES = {
  travel: TRAVEL,
} as const

export const CUES = {
  ...DUNGEON_CUES, ...PIPE_CUES, ...MAZE_CUES, ...CAVE_CUES, ...ROAD_CUES, ...SPACE_CUES,
  ...WIPE_CUES,
} as const
export type CueName = keyof typeof CUES
