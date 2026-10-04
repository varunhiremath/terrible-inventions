/**
 * The flood.
 *
 * "Blocks filled with equations, some correct and some wrong, and you can only
 * crush the correct ones. The goal is not to match colours but to find correct
 * relationships. And to make the game interesting keep some time challenge
 * like to save a person from water."
 *
 * So the board is sums and the clock is a person. Water rises in a chamber
 * above the board; every equation you break takes some of it away, every one
 * you get wrong puts some back. There is no countdown anywhere — the timer is
 * a thing you are doing something about, which is the difference between a
 * game with a clock in it and a game about hurrying.
 *
 * This is the only game in here where the maths *is* the game rather than the
 * price of another go at one, which is why the sums are pitched off the same
 * rating the rest of the app uses. A wall of sums a year too easy is a wall of
 * tapping; a year too hard is a wall of water.
 */
import { makeRng, type Rng } from '../engine/rng'

export const COLS = 5
export const ROWS = 8

/** How many on the board at once, which is also how many are in play. */
export const CELLS = COLS * ROWS

export type Sign = '+' | '-' | '×' | '÷'

export interface Sum {
  /** The two sides and the sign, kept apart so the drawing can lay them out. */
  a: number
  b: number
  sign: Sign
  /** What the block claims the answer is. */
  claim: number
}

/** What a sum actually comes to. */
export function worksOut(sum: Sum): number {
  switch (sum.sign) {
    case '+': return sum.a + sum.b
    case '-': return sum.a - sum.b
    case '×': return sum.a * sum.b
    case '÷': return sum.a / sum.b
  }
}

/** Whether a block is one you are allowed to break. */
export const isRight = (sum: Sum): boolean => worksOut(sum) === sum.claim

/**
 * How hard the sums are, from the rating the rest of the app keeps.
 *
 * Five bands rather than a smooth curve, because the step from "both numbers
 * under ten" to "one of them over twenty" is a real step for a person and
 * pretending otherwise produces a band of sums that are all slightly wrong for
 * everybody.
 */
export interface Band {
  name: string
  signs: readonly Sign[]
  /** The biggest either side gets. */
  most: number
  /** The biggest a times-table question gets. */
  table: number
}

export const BANDS: readonly Band[] = [
  { name: 'ones', signs: ['+', '-'], most: 9, table: 5 },
  { name: 'tens', signs: ['+', '-'], most: 20, table: 6 },
  { name: 'tables', signs: ['+', '-', '×'], most: 30, table: 9 },
  { name: 'sharing', signs: ['+', '-', '×', '÷'], most: 50, table: 10 },
  { name: 'the lot', signs: ['+', '-', '×', '÷'], most: 99, table: 12 },
]

/** Which band a rating lands in. The thresholds match the Lab's own bands. */
export function bandFor(rating: number): Band {
  if (rating < 950) return BANDS[0]
  if (rating < 1050) return BANDS[1]
  if (rating < 1150) return BANDS[2]
  if (rating < 1300) return BANDS[3]
  return BANDS[4]
}

/**
 * A sum that is true.
 *
 * Division and subtraction are built backwards from the answer, so there are
 * no remainders and no negatives — a block reading `7-9=-2` is a correct
 * equation and a cruel one to put in front of somebody who has not met
 * negative numbers.
 */
export function trueSum(band: Band, rng: Rng): Sum {
  const sign = rng.pick(band.signs)
  if (sign === '+') {
    const a = rng.int(1, band.most)
    const b = rng.int(1, band.most)
    return { a, b, sign, claim: a + b }
  }
  if (sign === '-') {
    const a = rng.int(2, band.most)
    const b = rng.int(1, a - 1)
    return { a, b, sign, claim: a - b }
  }
  if (sign === '×') {
    const a = rng.int(2, band.table)
    const b = rng.int(2, band.table)
    return { a, b, sign, claim: a * b }
  }
  const b = rng.int(2, Math.min(9, band.table))
  const answer = rng.int(2, band.table)
  return { a: b * answer, b, sign, claim: answer }
}

/**
 * How far wrong a wrong one is.
 *
 * This is the whole difficulty of the game and it is not the size of the
 * numbers. A block reading `7×8=91` is spotted without doing the sum, by
 * anybody who knows that seven eights is somewhere near fifty — so a wall of
 * those is a wall of glancing, not of arithmetic. A block reading `7×8=54` has
 * to be worked out.
 *
 * So a wrong one is wrong the way a person is wrong: out by one, out by ten,
 * off by the other number, or the digits the wrong way round.
 */
export const SLIPS = ['near', 'ten', 'other', 'swap'] as const
export type Slip = (typeof SLIPS)[number]

export function wrongSum(band: Band, rng: Rng): Sum {
  const right = trueSum(band, rng)
  const truth = right.claim
  for (let tries = 0; tries < 8; tries++) {
    const slip = rng.pick(SLIPS)
    let claim = truth
    if (slip === 'near') claim = truth + rng.pick([-2, -1, 1, 2])
    else if (slip === 'ten') claim = truth + rng.pick([-20, -10, 10, 20])
    else if (slip === 'other') claim = right.sign === '÷' ? right.a : right.b
    else {
      const digits = String(truth)
      claim = digits.length > 1
        ? Number([...digits].reverse().join(''))
        : truth + rng.pick([-1, 1])
    }
    // Never negative, never the right answer by accident, and never so far out
    // that it is answered by glancing at it.
    if (claim < 0 || claim === truth) continue
    if (Math.abs(claim - truth) > Math.max(25, truth)) continue
    return { ...right, claim }
  }
  return { ...right, claim: truth + 1 }
}

/** How much of a fresh board is true. */
export const TRUE_SHARE = 0.42

/**
 * The fewest true ones the board is ever allowed to hold.
 *
 * The one promise this game makes, and the same shape as the promise the road
 * and the space game make: if it is ever broken the player is sitting in front
 * of a board with no legal move on it, watching the water come up, and there
 * is nothing they could have done. Enforced after every refill.
 */
export const LEAST_TRUE = 4

export function newSum(band: Band, rng: Rng, mustBeTrue?: boolean): Sum {
  const wantTrue = mustBeTrue ?? rng.next() < TRUE_SHARE
  return wantTrue ? trueSum(band, rng) : wrongSum(band, rng)
}

// --- the water --------------------------------------------------------------

/**
 * How fast the water comes up, as a share of the chamber a second.
 *
 * These three numbers are the whole difficulty, and they are set from the one
 * thing that matters: how long a person gets per answer. With a chamber that
 * holds `1 / RISE` seconds of slack and a drain of `DRAIN` an answer, the
 * slowest pace that still gets somebody out is
 *
 *     (1 + TO_CLEAR * DRAIN) / (TO_CLEAR * rise)
 *
 * seconds per answer — about 3.7 on the first level, 2.4 by the tenth, and
 * never under 1.8 however deep it gets, because the point of the water is to
 * make him hurry and not to make him guess. The first draft grew by 0.006 a
 * level, which demanded an answer every 1.3 seconds by the tenth chamber and
 * was arithmetically impossible by the thirtieth.
 */
export const RISE = 0.034
/** And how much faster each level after that. */
export const RISE_PER_LEVEL = 0.002
/** As fast as it ever comes up, so a deep chamber is hard and not hopeless. */
export const RISE_MOST = 0.07

/** What one right answer takes off, and what one wrong answer puts back. */
export const DRAIN = 0.055
export const SURGE = 0.045

/** How many right answers it takes to get somebody out and move on. */
export const TO_CLEAR = 14

/** Score, and how much a run of right answers is worth on top. */
export const WORTH = 60
export const MOST_COMBO = 5

export const LIVES = 3

/** The people in the chamber, so it is somebody rather than a shape. */
export interface Soul {
  name: string
  coat: string
  trim: string
  skin: string
}

export const SOULS: readonly Soul[] = [
  { name: 'Nan', coat: '#d64fb7', trim: '#741f5f', skin: '#e8b08a' },
  { name: 'The cat', coat: '#f0a04b', trim: '#8a5417', skin: '#f0a04b' },
  { name: 'Postman', coat: '#4f7fe0', trim: '#1c3a7a', skin: '#8a5a3a' },
  { name: 'The milkman', coat: '#8ad48a', trim: '#2f6b35', skin: '#f0c9a8' },
  { name: 'Next door', coat: '#e8503a', trim: '#7d1f14', skin: '#6b4423' },
  { name: 'The vicar', coat: '#2a2f3d', trim: '#14161f', skin: '#e8b08a' },
]

export const soulFor = (level: number): Soul => SOULS[(level - 1) % SOULS.length]

/** A board, as sums, with the promise kept. */
export function newBoard(band: Band, seed: number): Sum[] {
  const rng = makeRng(seed)
  const board: Sum[] = []
  for (let i = 0; i < CELLS; i++) board.push(newSum(band, rng))
  return keepPromise(board, band, rng)
}

/**
 * Make sure there is something to break.
 *
 * Counted and topped up rather than hoped for: with four in ten true, a board
 * of forty has a vanishing chance of holding none — but vanishing is not never,
 * and the one time it happens is a player watching the water rise with no legal
 * move and no way of knowing it is not their fault.
 */
export function keepPromise(board: Sum[], band: Band, rng: Rng): Sum[] {
  const out = [...board]
  let have = out.filter(isRight).length
  // From the bottom up, because that is where the eye starts on a board that
  // falls downwards.
  for (let i = out.length - 1; i >= 0 && have < LEAST_TRUE; i--) {
    if (isRight(out[i])) continue
    out[i] = trueSum(band, rng)
    have += 1
  }
  return out
}
