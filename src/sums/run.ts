/**
 * The flood, simulated.
 *
 * Pure and fixed-timestep like everything else. The board is one flat array of
 * `COLS * ROWS` sums, read row by row from the top — so index 0 is the top
 * left, and a column is every `COLS`th entry. Falling is the only fiddly part
 * and it is fiddly in the way every game of this shape is: a crushed cell is a
 * hole, everything above it comes down one, and the top of that column is
 * filled with something new.
 */
import { makeRng, type Rng } from '../engine/rng'
import {
  CELLS, COLS, DRAIN, LEAST_TRUE, LIVES, MOST_COMBO, RISE, RISE_PER_LEVEL, ROWS, SURGE,
  RISE_MOST, TO_CLEAR, WORTH, bandFor, isRight, keepPromise, newBoard, newSum, soulFor,
  type Band, type Soul, type Sum,
} from './level'

export const FIXED = 1 / 60

export type FloodEvent =
  | 'crush' | 'combo' | 'wrong' | 'drain' | 'saved' | 'soaked' | 'over' | 'settle'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen: a list in a screen is a list no
 * test can reach, and an event missing from one took the whole app down twice
 * in an afternoon.
 */
export const LOUDEST: readonly FloodEvent[] = [
  'over', 'saved', 'soaked', 'wrong', 'combo', 'crush', 'drain', 'settle',
]

/** A cell, mid-fall, so the drawing can show it moving rather than jumping. */
export interface Cell {
  sum: Sum
  /** How far above its place it still is, in rows. Nought is settled. */
  lift: number
  /** Counts down after a tap, so the drawing can shake a wrong one. */
  shake: number
  /** A fresh id each time a cell is filled, so the drawing can tell them apart. */
  id: number
}

/**
 * A flash where a cell used to be.
 *
 * Beside the board rather than on the cell, because the crushed cell does not
 * survive its own crush: everything above it comes down one, so the slot it
 * was in belongs to its neighbour by the time anything could draw it.
 */
export interface Pop {
  col: number
  row: number
  /** Counts down to nought. */
  life: number
  /** Whether this one was a crush or a miss, since they flash differently. */
  good: boolean
}

export type Status = 'playing' | 'soaked' | 'saved' | 'over'

export interface Run {
  level: number
  band: Band
  soul: Soul
  cells: Cell[]
  /** How full the chamber is, 0 empty and 1 over his head. */
  water: number
  /** How many right ones this level still needs. */
  left: number
  lives: number
  score: number
  /** How many right in a row, which is what the multiplier runs on. */
  streak: number
  status: Status
  pops: Pop[]
  events: FloodEvent[]
  seed: number
  nextId: number
}

const at = (col: number, row: number) => row * COLS + col

export function newRun(level = 1, rating = 1000, lives = LIVES, score = 0, seed = 1): Run {
  const band = bandFor(rating)
  const sums = newBoard(band, seed)
  return {
    level,
    band,
    soul: soulFor(level),
    cells: sums.map((sum, i) => ({ sum, lift: 0, shake: 0, id: i + 1 })),
    water: 0,
    left: TO_CLEAR,
    lives,
    score,
    streak: 0,
    status: 'playing',
    pops: [],
    events: [],
    seed,
    nextId: CELLS + 1,
  }
}

/** The next chamber, keeping what has been earned. */
export function nextLevel(run: Run, rating: number): Run {
  return newRun(run.level + 1, rating, run.lives, run.score, run.seed + 1)
}

/** Back in, after one has gone under. */
export function tryAgain(run: Run, rating: number): Run {
  return { ...newRun(run.level, rating, run.lives, run.score, run.seed + 7), status: 'playing' }
}

/** How fast the water is coming up at this level. */
export const riseFor = (level: number): number =>
  Math.min(RISE_MOST, RISE + (level - 1) * RISE_PER_LEVEL)

/** How many on the board can be broken right now. */
export const breakable = (run: Run): number => run.cells.filter((c) => isRight(c.sum)).length

/**
 * Take a cell out, drop everything above it, and fill the top.
 *
 * The new one comes in above the board and falls, which is what `lift` is for:
 * it is not where a cell is, it is how far it still has to come. Nothing in
 * the rules waits for it to land — a board that cannot be tapped while it is
 * settling is a board that spends a third of a hurried game refusing to be
 * tapped.
 */
function collapse(run: Run, col: number, row: number, rng: Rng): void {
  for (let r = row; r > 0; r--) {
    const above = run.cells[at(col, r - 1)]
    run.cells[at(col, r)] = { ...above, lift: above.lift + 1 }
  }
  run.cells[at(col, 0)] = {
    sum: newSum(run.band, rng),
    lift: 1,
    shake: 0,
    id: run.nextId++,
  }
}

/** What a tap on a cell does. */
export function tap(run: Run, col: number, row: number): Run {
  if (run.status !== 'playing') return run
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return run

  const rng = makeRng(run.seed)
  const next: Run = {
    ...run,
    cells: run.cells.map((c) => ({ ...c })),
    pops: run.pops.slice(),
    events: [],
    seed: (run.seed * 1103515245 + 12345) >>> 0,
  }
  const cell = next.cells[at(col, row)]

  if (!isRight(cell.sum)) {
    /*
     * A wrong one is not a life and not a lecture: it shakes, the water comes
     * up a little, and the run of right answers is over. The whole of the
     * cost is the water, which is the thing the player is already watching.
     */
    cell.shake = 0.3
    next.water = Math.min(1, next.water + SURGE)
    next.streak = 0
    next.pops.push({ col, row, life: 0.3, good: false })
    next.events.push('wrong')
    return next
  }

  next.pops.push({ col, row, life: 0.26, good: true })
  collapse(next, col, row, rng)
  next.cells = keepPromise(next.cells.map((c) => c.sum), next.band, rng)
    .map((sum, i) => (sum === next.cells[i].sum ? next.cells[i] : { ...next.cells[i], sum }))

  next.streak = Math.min(MOST_COMBO, next.streak + 1)
  next.score += WORTH * next.streak
  next.water = Math.max(0, next.water - DRAIN)
  next.left = Math.max(0, next.left - 1)
  next.events.push(next.streak > 1 ? 'combo' : 'crush')
  if (next.water === 0) next.events.push('drain')

  if (next.left === 0) {
    next.status = 'saved'
    next.events.push('saved')
  }
  return next
}

export function step(run: Run, dt: number): Run {
  /*
   * A finished run is finished: no water, no falling, and above all no events,
   * because an event raised every frame of a game-over screen is a noise
   * played sixty times a second.
   */
  if (run.status !== 'playing') {
    return run.events.length === 0 ? run : { ...run, events: [] }
  }

  const next: Run = {
    ...run,
    cells: run.cells.map((c) => ({ ...c })),
    pops: run.pops
      .map((p) => ({ ...p, life: p.life - dt }))
      .filter((p) => p.life > 0),
    events: [],
  }

  let landed = false
  for (const cell of next.cells) {
    if (cell.lift > 0) {
      // Quick enough that it never gets in the way, slow enough to be seen.
      cell.lift = Math.max(0, cell.lift - dt * 9)
      if (cell.lift === 0) landed = true
    }
    if (cell.shake > 0) cell.shake = Math.max(0, cell.shake - dt)
  }
  if (landed) next.events.push('settle')

  next.water = Math.min(1, next.water + riseFor(next.level) * dt)
  if (next.water >= 1) {
    next.lives -= 1
    next.status = next.lives > 0 ? 'soaked' : 'over'
    next.events.push(next.lives > 0 ? 'soaked' : 'over')
  }

  return next
}

/** Everything the board is worth right now, for the bar along the top. */
export const standing = (run: Run): number => breakable(run)

export { COLS, ROWS, CELLS, LEAST_TRUE, TO_CLEAR, isRight }
