/**
 * Tunes nobody has chosen between yet.
 *
 * Not shipped. Nothing in the app imports this; it exists so that
 * `scripts/render-music.mjs` can turn each one into a file and put it on the
 * listening page, because "let's try again for the music" is not a brief that
 * can be answered by guessing a fourth time in the dark.
 *
 * The tune is not obviously the problem — it is already built the way the
 * plumber's one is, with rests on the downbeats and a middle that drops out.
 * What was likelier is the *voice*: after the shrillness was fixed the melody
 * ended up a soft triangle with vibrato under a six-kilohertz lid, which is a
 * music box rather than a game. That is what has changed in the game.
 *
 * So these three differ in the ways that would actually be audible from across
 * a room, rather than in their notes:
 *
 *   NOW      what the game plays today: the melody on a square with a
 *            triangle under it, which is this round's answer to the above.
 *   SOFT     what it played before that — the lone triangle with vibrato. Kept
 *            so the change can be heard rather than described.
 *   BOUNCE   a shuffle. The off-beats fall late, which is the single biggest
 *            difference between a tune marching and a tune bouncing, and a
 *            simpler, hookier melody to hang off it.
 *   FULL     a warm one: triangle melody with a sine under it, a rounder bass,
 *            and no drums at all for the first half. Closest to the covers of
 *            that plumber's tune played on real instruments.
 */
import { CHASE, PIPES, type Track } from './score'

/** The tune as it is in the game today. */
export const NOW: Track = CHASE

/**
 * And as it was before this round: the melody on a lone triangle with a little
 * vibrato on it, which is the version that got "let's try again".
 */
export const SOFT: Track = {
  ...CHASE,
  name: 'Papa Panic (soft)',
  parts: [
    {
      wave: 'triangle',
      gain: 0.18,
      sustain: 0.85,
      vibrato: { cents: 14, hz: 5, delay: 0.14 },
      pattern: CHASE.parts[0].pattern,
    },
    ...CHASE.parts.slice(2),
  ],
}

const BOUNCE_LEAD = [
  // Four bars that say one thing and answer it, and nothing else. A hook has
  // to be short enough to hum after one hearing.
  'G4 .  C5 .  E5 .  C5 . ',
  'D5 .  .  .  .  .  G4 . ',
  'G4 .  C5 .  E5 .  G5 . ',
  'E5 .  C5 .  .  .  .  . ',
  // The same, lifted.
  'A4 .  D5 .  F5 .  D5 . ',
  'E5 .  .  .  .  .  A4 . ',
  'G4 .  C5 .  E5 .  G5 . ',
  'C6 .  .  .  .  .  .  . ',
  // Down into the quiet, on its own.
  '.  .  E4 .  G4 .  A4 . ',
  'C5 .  .  .  A4 .  .  . ',
  '.  .  D4 .  F4 .  G4 . ',
  'B4 .  .  .  .  .  .  . ',
  // And out, busier.
  'C5 D5 E5 G5 .  E5 C5 . ',
  'D5 E5 F5 A5 .  F5 D5 . ',
  'E5 .  C5 .  G4 .  E4 . ',
  'C5 .  .  .  .  .  .  . ',
].join(' ')

const BOUNCE_BASS = [
  'C2 .  C2 G2 .  C2 G2 . ',
  'C2 .  C2 G2 .  C2 G2 . ',
  'C2 .  C2 G2 .  C2 G2 . ',
  'G2 .  G2 D3 .  G2 D3 . ',
  'D2 .  D2 A2 .  D2 A2 . ',
  'D2 .  D2 A2 .  D2 A2 . ',
  'C2 .  C2 G2 .  C2 G2 . ',
  'C2 .  C2 G2 .  C2 G2 . ',
  'A2 .  .  .  E3 .  .  . ',
  'F2 .  .  .  C3 .  .  . ',
  'G2 .  .  .  D3 .  .  . ',
  'G2 .  .  .  .  .  .  . ',
  'C2 .  C2 G2 .  C2 G2 . ',
  'D2 .  D2 A2 .  D2 A2 . ',
  'C2 .  C2 G2 .  C2 G2 . ',
  'C2 .  .  .  C3 .  .  . ',
].join(' ')

const BOUNCE_DRUMS =
  '- - x - - - x - '.repeat(8) +
  '- - - - x - - - '.repeat(4) +
  '- - x - - - x - '.repeat(3) +
  '- - x - x - x x'

/** A shuffle, with a four-bar hook. */
export const BOUNCE: Track = {
  name: 'Papa Panic (bounce)',
  beatsPerMinute: 118,
  hotter: 12,
  restEvery: 1,
  swing: 0.3,
  drums: BOUNCE_DRUMS,
  parts: [
    { wave: 'pulse', duty: 0.5, gain: 0.115, sustain: 0.8, pattern: BOUNCE_LEAD },
    { wave: 'triangle', gain: 0.26, sustain: 0.55, pattern: BOUNCE_BASS },
  ],
}

/** Warm: no edge anywhere, and the drums stay out of the first half. */
export const FULL: Track = {
  name: 'Papa Panic (warm)',
  beatsPerMinute: 120,
  hotter: 10,
  restEvery: 1,
  swing: 0.16,
  drums: '- - - - - - - - '.repeat(8) + '- - - x - - - - '.repeat(4) + '- x - x - x - x '.repeat(4),
  parts: [
    { ...CHASE.parts[0], wave: 'triangle', gain: 0.2, sustain: 0.95 },
    { wave: 'sine', gain: 0.055, sustain: 0.95, pattern: CHASE.parts[0].pattern },
    { ...CHASE.parts[1], wave: 'sine', gain: 0.3 },
    { ...CHASE.parts[2], gain: 0.045 },
  ],
}


/*
 * And the pipes before the piano.
 *
 * Kept whole rather than described, so the two can be heard one after the
 * other instead of taken on trust. Eight bars, C major, 148 beats a minute,
 * every voice an oscillator — this is the tune that was in the game until the
 * brief was "completely new music, not just a different beat on this one".
 *
 * Nothing imports it but the renderer.
 */
const CHIP_LEAD = [
  'E5 G5 C6 .  G5 E5 G5 . ',
  'A5 .  E5 .  C5 .  E5 . ',
  'F5 A5 C6 .  A5 F5 A5 . ',
  'G5 .  D5 .  B4 .  D5 . ',
  'C6 .  B5 C6 E6 .  C6 . ',
  'A5 .  G5 A5 C6 .  A5 . ',
  'F5 G5 A5 C6 D6 .  C6 . ',
  'G5 .  B5 .  D6 .  .  . ',
].join(' ')

const CHIP_BASS = [
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
const CHIP_PAD = [
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
const CHIP_DRUMS = 'x - - x - - x - '.repeat(7) + 'x - x - x - x x'


/*
 * The pipes, with the clock running down.
 *
 * C major is a cheerful key and this tune is a cheerful tune, which is exactly
 * why the last twenty seconds need help. B against C — the leading note held
 * under the root instead of resolving to it — sours a major key faster than
 * anything else you can do to it without changing a single note of the tune.
 */
const CHIP_PUSH = [
  '.  C3 .  C3 .  C3 .  C3',
  '.  A2 .  A2 .  A2 .  A2',
  '.  F2 .  F2 .  F2 .  F2',
  '.  G2 .  G2 .  G2 .  G2',
  '.  C3 .  C3 .  C3 .  C3',
  '.  A2 .  A2 .  A2 .  A2',
  '.  F2 .  F2 .  F2 .  F2',
  '.  G2 .  G2 .  G2 G2 G2',
].join(' ')

const CHIP_DREAD = [
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  C6',
  'B5 .  .  .  .  .  .  . ',
  'C6 .  .  .  .  .  .  . ',
  'B5 .  .  .  .  .  .  . ',
].join(' ')

const CHIP_HOT_DRUMS = ('x - x - x - x x ').repeat(7) + 'x - x - x x x x'

export const PIPES_CHIP: Track = {
  name: 'The Pipes (chip)',
  beatsPerMinute: 148,
  hotter: 11,
  quicker: 8,
  drums: CHIP_DRUMS,
  hotDrums: CHIP_HOT_DRUMS,
  parts: [
    {
      // Was the narrowest pulse of the three, which is the brightest and the
      // thinnest, and in a tune this quick it was relentless. See the note on
      // the chase's lead: same notes, warmer voice, twice the gain to match.
      wave: 'triangle',
      gain: 0.17,
      sustain: 0.8,
      vibrato: { cents: 12, hz: 5.5, delay: 0.16 },
      pattern: CHIP_LEAD,
    },
    { wave: 'triangle', gain: 0.28, sustain: 0.55, pattern: CHIP_BASS },
    {
      wave: 'pulse',
      duty: 0.25,
      gain: 0.07,
      sustain: 0.95,
      arp: [0, 7, 12],
      arpRate: 22,
      pattern: CHIP_PAD,
    },
    { wave: 'pulse', duty: 0.5, gain: 0.08, sustain: 0.26, pattern: CHIP_PUSH, from: 0.34 },
    { wave: 'triangle', gain: 0.064, sustain: 1, pattern: CHIP_DREAD, from: 0.7 },
  ],
}


export const CANDIDATES: Record<string, Track> = {
  now: NOW,
  soft: SOFT,
  bounce: BOUNCE,
  full: FULL,
  // The pipes, before and after. `piano` is what the game plays now; the other
  // is kept so the change can be heard rather than described.
  piano: PIPES,
  chip: PIPES_CHIP,
}
