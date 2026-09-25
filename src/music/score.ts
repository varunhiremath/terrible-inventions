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
export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'pulse'

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
    {
      wave: 'pulse',
      duty: 0.25,
      gain: 0.15,
      sustain: 0.85,
      vibrato: { cents: 22, hz: 5.5, delay: 0.1 },
      pattern: CHASE_LEAD,
    },
    { wave: 'triangle', gain: 0.3, sustain: 0.6, pattern: CHASE_BASS },
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
 * Bright where everything else in here is not. This is the one game of the
 * four that is about going somewhere rather than surviving, so the tune walks:
 * C, A minor, F, G, round twice, the second pass sitting higher and reaching
 * further. The bass never stops moving, which is what gives a side-scroller
 * its feeling of travel — stand still in this game and the music carries on
 * without you.
 */

const PIPES_LEAD = [
  'E5 G5 C6 .  G5 E5 G5 . ',
  'A5 .  E5 .  C5 .  E5 . ',
  'F5 A5 C6 .  A5 F5 A5 . ',
  'G5 .  D5 .  B4 .  D5 . ',
  'C6 .  B5 C6 E6 .  C6 . ',
  'A5 .  G5 A5 C6 .  A5 . ',
  'F5 G5 A5 C6 D6 .  C6 . ',
  'G5 .  B5 .  D6 .  .  . ',
].join(' ')

const PIPES_BASS = [
  'C3 .  C3 G3 E3 .  G3 . ',
  'A2 .  A2 E3 C3 .  E3 . ',
  'F2 .  F2 C3 A2 .  C3 . ',
  'G2 .  G2 D3 B2 .  D3 . ',
  'C3 .  C3 G3 E3 .  G3 . ',
  'A2 .  A2 E3 C3 .  E3 . ',
  'F2 .  F2 C3 A2 .  C3 . ',
  'G2 .  D3 .  G2 G2 B2 . ',
].join(' ')

/** A quiet third voice, holding each chord under the other two. */
const PIPES_PAD = [
  'C4 .  .  .  E4 .  .  . ',
  'A3 .  .  .  C4 .  .  . ',
  'F3 .  .  .  A3 .  .  . ',
  'B3 .  .  .  D4 .  .  . ',
  'E4 .  .  .  G4 .  .  . ',
  'C4 .  .  .  E4 .  .  . ',
  'A3 .  .  .  C4 .  .  . ',
  'B3 .  .  .  D4 .  .  . ',
].join(' ')

/** Off the beat as often as on it, which is what makes it bounce. */
const PIPES_DRUMS = 'x - - x - - x - '.repeat(7) + 'x - x - x - x x'

export const PIPES: Track = {
  name: 'The Pipes',
  beatsPerMinute: 148,
  drums: PIPES_DRUMS,
  parts: [
    {
      // The narrowest pulse of the three, which is the brightest and thinnest.
      wave: 'pulse',
      duty: 0.125,
      gain: 0.14,
      sustain: 0.8,
      vibrato: { cents: 18, hz: 6, delay: 0.14 },
      pattern: PIPES_LEAD,
    },
    { wave: 'triangle', gain: 0.28, sustain: 0.55, pattern: PIPES_BASS },
    {
      wave: 'pulse',
      duty: 0.25,
      gain: 0.07,
      sustain: 0.95,
      arp: [0, 7, 12],
      arpRate: 22,
      pattern: PIPES_PAD,
    },
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
  '-  -  -  -  -  -  A5 - ',
  '-  -  -  -  -  -  G5 - ',
  '-  -  -  -  -  -  F5 - ',
  '-  -  -  -  -  -  E5 - ',
  '-  -  -  -  -  -  D5 - ',
  '-  -  -  -  -  -  F5 - ',
  '-  -  -  -  -  -  G5 - ',
  '-  -  -  -  -  -  A5 - ',
].join(' ')

export const CAVERN: Track = {
  name: "Dave's Caves",
  beatsPerMinute: 104,
  parts: [
    {
      wave: 'pulse',
      duty: 0.5,
      gain: 0.13,
      sustain: 0.9,
      vibrato: { cents: 30, hz: 4.5, delay: 0.2 },
      pattern: CAVERN_LEAD,
    },
    { wave: 'triangle', gain: 0.22, sustain: 1, pattern: CAVERN_BASS },
    { wave: 'pulse', duty: 0.125, gain: 0.05, sustain: 0.3, pattern: CAVERN_DRIP },
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
    { wave: 'triangle', gain: 0.16, sustain: 0.95, pattern: 'A4 .  G4 .  F#4 . Eb4 .  .  .  .  . ' },
    { wave: 'sine', gain: 0.12, sustain: 1, pattern: 'D3 .  .  .  .  .  Bb2 .  .  .  .  . ' },
  ],
}

/** A level done. The same phrase as the dungeon cue, climbing instead. */
export const VICTORY: Track = {
  name: 'Victory',
  beatsPerMinute: 120,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.13, sustain: 0.7, pattern: 'D4 Eb4 F#4 G4 A4 .  D5 .  .  . ' },
    { wave: 'triangle', gain: 0.2, sustain: 0.8, pattern: 'D3 .  .  .  A3 .  D4 .  .  . ' },
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
  parts: [{ wave: 'pulse', duty: 0.125, gain: 0.12, sustain: 0.5, pattern: 'B5 E6 .  . ' }],
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
  beatsPerMinute: 100,
  parts: [
    { wave: 'triangle', gain: 0.16, sustain: 0.9, pattern: 'C5 .  A4 .  F4 .  D4 .  C4 .  .  . ' },
    { wave: 'sine', gain: 0.1, sustain: 1, pattern: 'C3 .  .  .  .  .  G2 .  .  .  .  . ' },
  ],
}

/** The flag. The only thing in the game worth a fanfare. */
export const FLAG: Track = {
  name: 'Flag',
  beatsPerMinute: 140,
  parts: [
    { wave: 'pulse', duty: 0.25, gain: 0.14, sustain: 0.7, pattern: 'G4 C5 E5 G5 .  E5 G5 C6 .  .  .  . ' },
    { wave: 'triangle', gain: 0.18, sustain: 0.8, pattern: 'C3 .  .  .  G3 .  .  C4 .  .  .  . ' },
  ],
}

export const TRACKS = {
  chase: CHASE,
  thinking: THINKING,
  pipes: PIPES,
  cavern: CAVERN,
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

/** The pipes' own set, all in plain C major. */
export const PIPE_CUES = {
  coin: COIN,
  hop: HOP,
  stomp: STOMP,
  grow: GROW,
  fall: FALL,
  flag: FLAG,
} as const

// Two sets, because each one is held to its own scale and mixing them would
// mean holding neither to anything.
export const CUES = { ...DUNGEON_CUES, ...PIPE_CUES } as const
export type CueName = keyof typeof CUES
