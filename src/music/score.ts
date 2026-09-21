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

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine'

export interface Part {
  wave: Wave
  /** 0..1, before the master volume. */
  gain: number
  /** How long a note rings relative to its written length. */
  sustain?: number
  pattern: string
}

export interface Track {
  name: string
  beatsPerMinute: number
  parts: Part[]
  /** Per eighth: 'x' hits, anything else does not. */
  drums?: string
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

/** Seconds per eighth note. */
export function eighthSeconds(track: Track): number {
  return 60 / track.beatsPerMinute / 2
}

// --- the tunes -------------------------------------------------------------

/*
 * Papa Panic runs on four chords — A minor, G, F, E — going round twice: the
 * first time low and stepping, the second time up an octave and jumpier, so
 * the loop has somewhere to go instead of just repeating. Minor key, but at
 * this tempo it reads as busy rather than sad.
 */

const CHASE_LEAD = [
  'A4 C5 E5 C5 A4 .  B4 . ',
  'G4 B4 D5 B4 G4 .  A4 . ',
  'F4 A4 C5 A4 F4 .  G4 . ',
  'E4 G#4 B4 G#4 E4 . B4 .',
  'A5 .  E5 .  C5 .  A4 . ',
  'B4 D5 G5 .  D5 B4 G4 . ',
  'C5 .  A4 C5 F5 .  C5 . ',
  'B4 .  G#4 B4 E5 .  .  .',
].join(' ')

const CHASE_BASS = [
  'A2 A2 E3 A2 A2 A2 E3 A2',
  'G2 G2 D3 G2 G2 G2 D3 G2',
  'F2 F2 C3 F2 F2 F2 C3 F2',
  'E2 E2 B2 E2 E2 E2 B2 E2',
  'A2 A2 E3 A2 A2 A2 E3 A2',
  'G2 G2 D3 G2 G2 G2 D3 G2',
  'F2 F2 C3 F2 F2 F2 C3 F2',
  'E2 E2 B2 E2 E2 B2 E2 E2',
].join(' ')

/** A quiet third voice, holding the chord under everything else. */
const CHASE_PAD = [
  'C4 .  .  .  E4 .  .  . ',
  'B3 .  .  .  D4 .  .  . ',
  'A3 .  .  .  C4 .  .  . ',
  'G#3 . .  .  B3 .  .  . ',
  'E4 .  .  .  A4 .  .  . ',
  'D4 .  .  .  G4 .  .  . ',
  'C4 .  .  .  F4 .  .  . ',
  'B3 .  .  .  G#3 . .  . ',
].join(' ')

const CHASE_DRUMS = ('- x - x - x - x ').repeat(7) + '- x - x - x x x'

export const CHASE: Track = {
  name: 'Papa Panic',
  beatsPerMinute: 126,
  drums: CHASE_DRUMS,
  parts: [
    { wave: 'square', gain: 0.16, sustain: 0.85, pattern: CHASE_LEAD },
    { wave: 'triangle', gain: 0.3, sustain: 0.6, pattern: CHASE_BASS },
    { wave: 'sine', gain: 0.09, sustain: 0.95, pattern: CHASE_PAD },
  ],
}

/*
 * The shop. Same four chords, half the speed and none of the panic — it plays
 * while a maths problem is on screen, so it has to sit still and be ignorable.
 */
export const SHOP: Track = {
  name: 'The Shop',
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
      wave: 'triangle',
      gain: 0.15,
      sustain: 0.95,
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
    { wave: 'square', gain: 0.13, sustain: 0.6, pattern: 'A4 Bb4 A4 Eb4 - A4 Bb4 A4 Eb4 - D5 . . .' },
    { wave: 'triangle', gain: 0.22, sustain: 0.5, pattern: 'D3 - D3 - - D3 - D3 - - Eb3 . . .' },
  ],
}

/** Steel. Two hits, and the second one higher. */
export const BLADE: Track = {
  name: 'Blade',
  beatsPerMinute: 160,
  parts: [{ wave: 'square', gain: 0.12, sustain: 0.35, pattern: 'Bb5 - D6 - - -' }],
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
    { wave: 'triangle', gain: 0.16, sustain: 0.95, pattern: 'A4 .  G4 .  F#4 . Eb4 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.12, sustain: 1, pattern: 'D3 .  .  .  .  .  Bb2 .  .  .  .  . ' },
  ],
}

/** A level done. The same phrase as the dungeon cue, climbing instead. */
export const VICTORY: Track = {
  name: 'Victory',
  beatsPerMinute: 120,
  parts: [
    { wave: 'square', gain: 0.13, sustain: 0.7, pattern: 'D4 Eb4 F#4 G4 A4 .  D5 .  .  . ' },
    { wave: 'triangle', gain: 0.2, sustain: 0.8, pattern: 'D3 .  .  .  A3 .  D4 .  .  . ' },
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

export const TRACKS = { chase: CHASE, shop: SHOP } as const
export type TrackName = keyof typeof TRACKS

export const CUES = {
  dungeon: DUNGEON,
  danger: DANGER,
  blade: BLADE,
  potion: POTION,
  tragic: TRAGIC,
  victory: VICTORY,
  timer: TIMER,
} as const
export type CueName = keyof typeof CUES
