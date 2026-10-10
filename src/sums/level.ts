/**
 * The flood.
 *
 * "Blocks filled with equations, some correct and some wrong, and you can only
 * crush the correct ones... keep some time challenge like to save a person
 * from water."
 *
 * And then: "he is good with maths so we can really challenge him. We can also
 * add operators like powers. Sequences too. The bigger the sequence he finds
 * the more points he gets and more blocks crushed."
 *
 * So the board is one number or one sign per block, and the game is dragging
 * along a line that reads as something true — `2 + 3 = 5` is five blocks,
 * `1 1 2 3 5 8` is six. Above it somebody is standing in a chamber the water
 * is coming up in: every block crushed takes some of it away, so a long find
 * is visibly a big gulp out of the tank. There is no countdown anywhere; the
 * timer is a person, and the way to stop it is to be right.
 *
 * Nothing on this board is random in the way it looks. A grid of randomly
 * chosen numbers and signs contains a true line about never, so the finds are
 * written in first and the rest of the board is filled in around them.
 */
import type { Rng } from '../engine/rng'
import { EQ, num, op, type FindKind, type Op, type Token } from './find'

export const COLS = 7
export const ROWS = 9
export const CELLS = COLS * ROWS

export const at = (col: number, row: number): number => row * COLS + col
export const colOf = (i: number): number => i % COLS
export const rowOf = (i: number): number => Math.floor(i / COLS)

// --- how hard ----------------------------------------------------------------

export interface Band {
  name: string
  /** What may appear in an equation. */
  ops: readonly Op[]
  /** The biggest number that goes on a block in a planted find. */
  most: number
  /** Which sequences are planted. */
  runs: readonly FindKind[]
  /** Whether equations with two operators in them are planted. */
  twoStep: boolean
}

export const BANDS: readonly Band[] = [
  { name: 'adding', ops: ['+', '-'], most: 20, runs: ['step'], twoStep: false },
  { name: 'tables', ops: ['+', '-', '×'], most: 50, runs: ['step', 'times'], twoStep: false },
  {
    name: 'sharing', ops: ['+', '-', '×', '÷'], most: 99,
    runs: ['step', 'times', 'square', 'triangle'], twoStep: false,
  },
  {
    name: 'powers', ops: ['+', '-', '×', '÷', '^'], most: 144,
    runs: ['step', 'times', 'square', 'triangle', 'fib', 'cube'], twoStep: true,
  },
  {
    name: 'the lot', ops: ['+', '-', '×', '÷', '^'], most: 200,
    runs: ['step', 'times', 'square', 'triangle', 'fib', 'cube', 'prime', 'doubleAdd'],
    twoStep: true,
  },
]

/**
 * Which band, from the rating the rest of the app keeps and how deep he is.
 *
 * Both, rather than the rating alone. The rating says what he can do; the
 * chamber says how long he has been at it, and a game that never shows him
 * anything new until his rating moves is a game that looks finished after
 * twenty minutes.
 */
export function bandFor(rating: number, level = 1): Band {
  const fromRating =
    rating < 950 ? 0 : rating < 1050 ? 1 : rating < 1150 ? 2 : rating < 1300 ? 3 : 4
  const fromDepth = Math.floor((level - 1) / 4)
  return BANDS[Math.min(BANDS.length - 1, fromRating + fromDepth)]
}

// --- writing a find ----------------------------------------------------------

const SQUARES = Array.from({ length: 20 }, (_, i) => (i + 1) * (i + 1))
const TRIANGLES = Array.from({ length: 20 }, (_, i) => ((i + 1) * (i + 2)) / 2)
const CUBES = Array.from({ length: 8 }, (_, i) => (i + 1) ** 3)
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71]

/** A run of `want` consecutive entries from a list, starting somewhere random. */
function fromList(list: readonly number[], want: number, most: number, rng: Rng): Token[] | null {
  const fits = list.filter((_, i) => i + want <= list.length && list[i + want - 1] <= most)
  if (fits.length === 0) return null
  const start = list.indexOf(rng.pick(fits))
  return list.slice(start, start + want).map(num)
}

/** An equation that is true, with no remainder and nothing below nought. */
function anEquation(band: Band, rng: Rng, twoStep: boolean): Token[] {
  const sign = rng.pick(band.ops)

  if (sign === '^') {
    const base = rng.int(2, 5)
    const power = rng.int(2, base <= 3 ? 4 : 3)
    return [num(base), op('^'), num(power), EQ, num(base ** power)]
  }

  let a: number
  let b: number
  let answer: number
  if (sign === '+') {
    a = rng.int(2, band.most)
    b = rng.int(2, band.most)
    answer = a + b
  } else if (sign === '-') {
    // Built backwards, so it never asks for a number below nought.
    a = rng.int(3, band.most)
    b = rng.int(1, a - 1)
    answer = a - b
  } else if (sign === '×') {
    a = rng.int(2, Math.min(12, Math.max(3, Math.round(band.most / 8))))
    b = rng.int(2, 12)
    answer = a * b
  } else {
    // Also backwards: no remainders.
    b = rng.int(2, 9)
    answer = rng.int(2, Math.min(12, Math.max(3, Math.floor(band.most / b))))
    a = b * answer
  }

  if (!twoStep) return [num(a), op(sign), num(b), EQ, num(answer)]

  /*
   * A second operator, on the answer's side.
   *
   * On the right rather than mixed into the left, which keeps the two-step
   * ones honest without making them a lesson in precedence before he has met
   * one: `56 = 7 × 8` with something added is still read the same way round.
   */
  const extra = rng.int(2, 20)
  return [num(a), op(sign), num(b), EQ, num(answer + extra), op('-'), num(extra)]
}

/** The tokens of one planted find, or null if that kind will not fit here. */
export function writeFind(
  kind: FindKind | 'sum', band: Band, want: number, rng: Rng,
): Token[] | null {
  if (kind === 'sum' || kind === 'power') {
    return anEquation(band, rng, band.twoStep && rng.next() < 0.3)
  }
  if (kind === 'square') return fromList(SQUARES, want, band.most, rng)
  if (kind === 'triangle') return fromList(TRIANGLES, want, band.most, rng)
  if (kind === 'cube') return fromList(CUBES, want, band.most, rng)
  if (kind === 'prime') return fromList(PRIMES, want, band.most, rng)

  if (kind === 'step') {
    const by = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const down = rng.next() < 0.35
    const top = band.most
    if (down) {
      const start = rng.int(by * want, Math.max(by * want, top))
      return Array.from({ length: want }, (_, i) => num(start - by * i))
    }
    const start = rng.int(1, Math.max(1, top - by * (want - 1)))
    return Array.from({ length: want }, (_, i) => num(start + by * i))
  }

  if (kind === 'times') {
    const by = rng.pick([2, 2, 2, 3])
    const most = Math.floor(band.most / by ** (want - 1))
    if (most < 1) return null
    const start = rng.int(1, most)
    const up = Array.from({ length: want }, (_, i) => start * by ** i)
    // Half of them written backwards, which is halving and reads quite
    // differently even though it is the same run of numbers.
    return (rng.next() < 0.4 ? up.reverse() : up).map(num)
  }

  if (kind === 'fib') {
    const a = rng.int(1, 4)
    const b = rng.int(a, a + 4)
    const ns = [a, b]
    while (ns.length < want) ns.push(ns[ns.length - 1] + ns[ns.length - 2])
    return ns[ns.length - 1] > band.most ? null : ns.map(num)
  }

  if (kind === 'doubleAdd') {
    const plus = rng.pick([-2, -1, 1, 2, 3])
    const start = rng.int(2, 8)
    /*
     * Doubling and taking two, starting at two, gives two every time. The rule
     * holds and the run is a row of the same number, which is not a pattern
     * anybody found — so it is refused here as well as by the reader.
     */
    if (start === -plus) return null
    const ns = [start]
    while (ns.length < want) ns.push(ns[ns.length - 1] * 2 + plus)
    return ns[ns.length - 1] > band.most || ns.some((n) => n < 1) ? null : ns.map(num)
  }

  return null
}

// --- filling the rest in -----------------------------------------------------

/**
 * A block for the parts of the board nobody planted anything in.
 *
 * Mostly numbers, because a board that is a third operators looks like soup
 * and has nothing in it to spot. The numbers are drawn from the same range the
 * finds use, so a planted find does not stand out by the size of its digits —
 * which it did, in the first cut, and made the whole board readable at a
 * glance without doing any arithmetic.
 */
export function filler(band: Band, rng: Rng, hunt: Hunt = 'sums'): Token {
  // Kept for the board's plain blocks. A sequences chamber is nothing but
  // these; a sums chamber gets its operators laid on afterwards, by hand,
  // because where an operator may go is not a thing you can decide one block
  // at a time. See `sprinkle` in `run.ts`.
  void hunt
  return num(rng.int(1, band.most))
}

/** An operator or an equals sign, for the blocks that are allowed one. */
export function aSign(band: Band, rng: Rng): Token {
  return rng.next() < 0.6 ? EQ : op(rng.pick(band.ops))
}

/**
 * How many of the blocks that could hold an operator actually hold one.
 *
 * Lower than it was. A quarter of every block on the board used to be an
 * operator or an equals sign, dropped in one block at a time with no thought
 * for its neighbours, which is how `11 + + 39 = 5 8` got onto the board —
 * measured at seven clumps and seven edge-signs per board. Operators now only
 * go where they have a number on all four sides, and there is simply less room
 * for them once that is true.
 */
export const SIGN_SHARE = 0.6

/**
 * Sparks: the one thing on the board that is not arithmetic.
 *
 * A find of five blocks or more leaves one behind where its middle was. A
 * spark does nothing by itself and changes nothing about the sum it is sitting
 * on — it rides on an ordinary number block, so the board stays as readable as
 * it was. Take it into a find and it goes off, and the whole row and column it
 * stands in goes with it. Two in one find and the rows and columns either side
 * go too.
 *
 * Which is the part of a matching game that makes somebody lean in: not the
 * find itself but the thing the find sets up, and then the moment of putting
 * two of them together on purpose.
 */
export const SPARK_AT = 5
export const SPARK_WORTH = 3
export const SPARK_DRAIN = 1.8

/**
 * What this chamber is asking for.
 *
 * A board used to hold equations and sequences at once, with no way of telling
 * which you were meant to be looking for — so scanning it meant holding both
 * questions in your head at the same time ("does this line work out?" *and*
 * "is this run going up by sevens?"), which is twice the work and half as
 * clear. One chamber, one question.
 */
export type Hunt = 'sums' | 'runs'

/**
 * Chambers alternate, and the first one is sums.
 *
 * Sums first because they are the thing anybody can have a go at: a line
 * either works out or it does not, and you can check it block by block. A
 * sequence has to be recognised before it can be checked, which is a harder
 * thing and a worse place to start.
 */
export const huntFor = (level: number): Hunt => (level % 2 === 1 ? 'sums' : 'runs')

export const HUNT_SAYS: Record<Hunt, { name: string; wants: string; like: string; tint: string }> = {
  sums: {
    name: 'SUMS',
    wants: 'Find lines that work out.',
    like: 'like  3 + 4 = 7',
    tint: '#7fd4f0',
  },
  runs: {
    name: 'SEQUENCES',
    wants: 'Find runs of numbers that follow a rule.',
    like: 'like  2  4  8  16',
    tint: '#f0c27f',
  },
}

/**
 * How many finds are written into a fresh board.
 *
 * Six rather than four. Four was enough to keep the promise and not enough to
 * make the board feel findable: with two of them guaranteed, a board could sit
 * there with exactly two answers on it while the water came up, and hunting
 * for the only sum in sixty-three blocks is a puzzle rather than a game.
 */
/**
 * How many finds are written into a fresh board.
 *
 * Nine attempted, of which five or six survive: every rule about where a find
 * may go — off the edge, clear of other operators, one equals sign to a row
 * and one to a column — turns some attempts down, and finds may now cross each
 * other where they agree, so attempting more is cheap and lands more.
 */
/**
 * How many finds are laid down once the promise of four is already met, and
 * half of them are wrong on purpose.
 *
 * Measured, after the operators were put in order: with signs only where they
 * are legal there is far less room for them, and 98 of every 100 equals signs
 * ended up inside a true equation — so the game would have stopped being
 * arithmetic and become "find the equals sign and drag round it", which is the
 * same fault the hints had. Wrong sums bring that to about four in five.
 *
 * It does not go lower without going below the promised number of right ones,
 * and that is a limit of the board rather than of the trying: sixty-three
 * blocks hold about six statements of five blocks each, and every one that is
 * wrong is one that is not right.
 */
export const PLANTED = 8



/** The promise: there is always at least this many findable things. */
export const LEAST_FINDS = 4

/**
 * What a find of the kind this chamber did *not* ask for is worth.
 *
 * Not nothing, and not a miss. Spotting a Fibonacci run in a chamber of sums
 * is good arithmetic and good eyes, and telling somebody that correct maths is
 * wrong is the sort of thing that makes them stop looking. So it crushes, it
 * scores, and it goes without the chamber's bonus — which is the whole of the
 * difference.
 */
export const OFF_HUNT = 0.6

// --- the water ---------------------------------------------------------------

/**
 * How fast the water comes up, as a share of the chamber a second.
 *
 * Far slower than the tapping version this replaced, and it has to be: finding
 * a line is not tapping a block. Somebody scanning a board of sixty-three
 * blocks for a run of square numbers is working for twenty seconds, not two,
 * and the old numbers gave him about four.
 *
 * The figure that matters is seconds per find, and it is measured rather than
 * reasoned about — about twenty-five on the first chamber, down to eleven by
 * the tenth, and never under ten however deep it goes.
 */
/**
 * How much is already in the tank when a chamber opens.
 *
 * It used to open empty, and measured over a whole chamber the water sat at
 * six per cent and peaked at thirteen: Papa stood in a puddle, and the peril
 * the game is named for was barely on the screen. Every find drained almost
 * half the tank, so the level slammed to the floor and stayed there.
 *
 * Starting it part full costs nothing in difficulty — you still drain faster
 * than it rises — and it changes what the chamber looks like completely. He is
 * in it from the first second, and the game is holding it back rather than
 * waiting for it to begin.
 */
export const STARTS_AT = 0.42

/**
 * And it never drains away entirely.
 *
 * A find used to take the level to the floor and leave it there: measured
 * across a chamber, the water sat at six per cent. So the tank was empty
 * almost all of the time and the one thing the game is about was invisible.
 *
 * The floor costs nothing in difficulty — what can kill you is the top of the
 * tank, not the bottom — and it means he is always in it. The game stops being
 * "wait for the water to start" and becomes "hold it down", which is the same
 * game and reads completely differently.
 */
export const NEVER_BELOW = 0.26

export const RISE = 0.005
export const RISE_PER_LEVEL = 0.0006
export const RISE_MOST = 0.012

/** What one crushed block takes off the tank. */
export const DRAIN_PER_BLOCK = 0.022

/**
 * What a selection that is not a find costs.
 *
 * Small, and deliberately smaller than the old one. Dragging along a line to
 * see whether it works is how this game is *played* — it is the looking, not a
 * mistake — so trying one and being wrong has to cost less than finding one
 * is worth, or the right move is to sit still and never try anything.
 */
export const SURGE = 0.012

/** How many blocks have to go before the chamber drains. */
export const TO_CLEAR = 140

/** Score. Longer finds are worth much more than their length suggests. */
export const WORTH = 20
export const MOST_COMBO = 5
export const LIVES = 3

/**
 * Who is in the chamber.
 *
 * It was a rotating cast — Nan, the postman, the vicar — and then the game got
 * its name: it is Papa in there, every time. Which is better. The joke of the
 * whole app is that he built ten terrible machines; the tenth one has him
 * standing in it with the water coming up, being got out by somebody who can
 * do arithmetic faster than he can plumb.
 *
 * The variety moved to what he says about it on the way out.
 */
/**
 * What Papa is in, which changes every chamber.
 *
 * The mechanic never changes — a thing rises, and he is got out by finding
 * sums — so the peril is colour and words rather than new rules. That is
 * deliberately cheap and it is most of what the chamber feels like: the same
 * climb reads differently when it is flames instead of water, and a game whose
 * tenth chamber looks exactly like its first is a game that looks finished
 * after one.
 */
export interface Soul {
  name: string
  coat: string
  trim: string
  skin: string
}

export const PAPA: Soul = {
  name: 'Papa',
  coat: '#c0392b',
  trim: '#7b241c',
  skin: '#e8b08a',
}

export interface Peril {
  /** What is rising, in a word, for the top of the screen. */
  name: string
  /** What Papa is doing about it, for the chamber's title. */
  says: string
  /** The far side of the stuff, and its surface. */
  deep: string
  top: string
  /** How high the surface rolls, and how fast. */
  swell: number
  churn: number
  /** What he says once he is out of it. */
  out: readonly string[]
}

export const PERILS: readonly Peril[] = [
  {
    name: 'water',
    says: 'Papa is drowning',
    deep: '#1b4f72',
    top: '#5dade2',
    swell: 1,
    churn: 1,
    out: ['Papa is out, and dripping.', 'Papa is out. He would like a towel.'],
  },
  {
    name: 'fire',
    says: 'Papa is getting toasted',
    deep: '#7e2d12',
    top: '#f0932b',
    // Flames jump about more than water does, and faster.
    swell: 2.1,
    churn: 2.4,
    out: ['Papa is out, and a bit crispy.', 'Papa is out. He says that explains the smell.'],
  },
  {
    name: 'sand',
    says: 'Papa is sinking',
    deep: '#7d6608',
    top: '#d4ac0d',
    // Sand barely moves, which is what makes it frightening.
    swell: 0.3,
    churn: 0.35,
    out: ['Papa is out, and full of sand.', 'Papa is out. He will be finding that for weeks.'],
  },
  {
    name: 'jelly',
    says: 'Papa is stuck',
    deep: '#145a32',
    top: '#52be80',
    swell: 1.4,
    churn: 0.7,
    out: ['Papa is out, and sticky.', 'Papa is out. He says it was raspberry.'],
  },
]

export const perilFor = (level: number): Peril => PERILS[(level - 1) % PERILS.length]

export const soulFor = (_level: number): Soul => PAPA

/** What he says when he is got out, which depends on what he was got out of. */
export const gotOut = (level: number): string => {
  const peril = perilFor(level)
  return peril.out[Math.floor((level - 1) / PERILS.length) % peril.out.length]
}
