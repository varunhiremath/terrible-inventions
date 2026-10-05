/**
 * The flood, simulated.
 *
 * Pure and fixed-timestep like everything else. The board is one flat array of
 * `COLS * ROWS` blocks, read row by row from the top, each holding a single
 * number or sign. A selection is a straight run of them — along a row or down
 * a column — and if that run reads as something true it goes.
 *
 * The selection is not a path the finger walked. It is an anchor and a head,
 * and everything between them: put a finger on a block, drag to another in the
 * same row or column, and the run between is what you have got. That means a
 * wandering finger cannot tie a knot in its own selection, and shortening one
 * is just dragging back the way you came.
 */
import {
  CELLS, COLS, DRAIN_PER_BLOCK, LEAST_FINDS, LIVES, MOST_COMBO, PLANTED, RISE, RISE_MOST,
  RISE_PER_LEVEL, ROWS, SURGE, TO_CLEAR, WORTH, at, bandFor, colOf, filler, rowOf,
  soulFor, writeFind, type Band, type Soul,
} from './level'
import { makeRng, type Rng } from '../engine/rng'
import { LEAST_FIND, readLine, sayLine, type Find, type FindKind, type Token } from './find'

export const FIXED = 1 / 60

export type FloodEvent =
  | 'grab' | 'stretch' | 'crush' | 'big' | 'combo' | 'miss' | 'drain' | 'saved' | 'soaked'
  | 'over' | 'settle' | 'planted'

/** Loudest first, so a frame with several things in it makes one noise. */
export const LOUDEST: readonly FloodEvent[] = [
  'over', 'saved', 'soaked', 'big', 'combo', 'crush', 'miss', 'planted', 'drain', 'grab',
  'stretch', 'settle',
]

export interface Cell {
  token: Token
  /** How far above its place it still is, in rows. Nought is settled. */
  lift: number
  /** Counts down after a selection that was not a find, so it can shake. */
  shake: number
  id: number
}

export type Status = 'playing' | 'soaked' | 'saved' | 'over'

/** What the banner says after a find, and how long it has left to say it. */
export interface Said {
  says: string
  line: string
  length: number
  worth: number
  life: number
}

export interface Run {
  level: number
  band: Band
  soul: Soul
  cells: Cell[]
  /** The block the finger went down on, and the one it is on now. */
  anchor: number | null
  head: number | null
  /** Everything between them, worked out rather than remembered. */
  picked: number[]
  /** Set while the picked run reads as something true, for the glow. */
  reading: Find | null
  said: Said | null
  water: number
  /** How many blocks this chamber still wants gone. */
  left: number
  lives: number
  score: number
  streak: number
  status: Status
  events: FloodEvent[]
  seed: number
  nextId: number
}

// --- building a board --------------------------------------------------------

/** Where a find of this length could be written, as a list of runs of cells. */
function roomFor(want: number): number[][] {
  const out: number[][] = []
  for (let row = 0; row < ROWS; row++) {
    for (let start = 0; start + want <= COLS; start++) {
      out.push(Array.from({ length: want }, (_, i) => at(start + i, row)))
    }
  }
  for (let col = 0; col < COLS; col++) {
    for (let start = 0; start + want <= ROWS; start++) {
      out.push(Array.from({ length: want }, (_, i) => at(col, start + i)))
    }
  }
  return out
}

/**
 * What to plant next.
 *
 * Equations most of the time at every level, because they are the thing he can
 * always have a go at; the sequences his band has opened up turn up alongside
 * them. Lengths favour the short end — a board of nothing but seven-long finds
 * is a board where every find is a whole row, which is both easier and duller
 * than it sounds.
 */
function pickKind(band: Band, rng: Rng): FindKind {
  if (rng.next() < 0.45 || band.runs.length === 0) return 'sum'
  return rng.pick(band.runs)
}

function wantedLength(kind: FindKind, band: Band, rng: Rng): number {
  if (kind === 'sum' || kind === 'power') return 5
  // Longer runs once he is deep enough for them: a seven-long find takes the
  // whole row and column with it, and it should be a thing that exists.
  return band.twoStep ? rng.pick([4, 4, 5, 5, 6, 6, 7]) : rng.pick([4, 4, 4, 5, 5, 6])
}

/**
 * Write one find into the board somewhere it fits.
 *
 * `taken` is the blocks earlier finds were written into, and runs that cross
 * them are avoided where there is anywhere else to go. Without it the four
 * finds a fresh board starts with were four finds written partly on top of
 * each other, and the board could come out with one — which is a board a
 * player can be stuck on at the first glance.
 */
function plant(
  cells: Cell[], band: Band, rng: Rng, nextId: () => number, taken?: Set<number>,
): boolean {
  for (let go = 0; go < 14; go++) {
    const kind = pickKind(band, rng)
    const want = wantedLength(kind, band, rng)
    const tokens = writeFind(kind, band, want, rng)
    if (!tokens) continue
    const all = roomFor(tokens.length)
    const clear = taken ? all.filter((run) => run.every((c) => !taken.has(c))) : all
    const room = clear.length > 0 ? clear : all
    if (room.length === 0) continue
    const where = rng.pick(room)
    if (taken) for (const cell of where) taken.add(cell)
    const written = rng.next() < 0.5 ? tokens : [...tokens].reverse()
    for (const [i, cell] of where.entries()) {
      cells[cell] = { token: written[i], lift: cells[cell]?.lift ?? 0, shake: 0, id: nextId() }
    }
    return true
  }
  return false
}

export function newRun(level = 1, rating = 1000, lives = LIVES, score = 0, seed = 1): Run {
  const band = bandFor(rating, level)
  const rng = makeRng(seed * 2654435761 + level)
  let id = 0
  const next = () => (id += 1)
  const cells: Cell[] = Array.from({ length: CELLS }, () => ({
    token: filler(band, rng), lift: 0, shake: 0, id: next(),
  }))
  const taken = new Set<number>()
  for (let i = 0; i < PLANTED; i++) plant(cells, band, rng, next, taken)
  // And then checked, rather than assumed: planting four does not mean four
  // survive, and the board that is handed over is the one that has to hold the
  // promise.
  for (let go = 0; go < 20 && findsOn(cells, LEAST_FINDS).length < LEAST_FINDS; go++) {
    if (!plant(cells, band, rng, next, taken)) break
  }

  return {
    level,
    band,
    soul: soulFor(level),
    cells,
    anchor: null,
    head: null,
    picked: [],
    reading: null,
    said: null,
    water: 0,
    left: TO_CLEAR,
    lives,
    score,
    streak: 0,
    status: 'playing',
    events: [],
    seed,
    nextId: id + 1,
  }
}

export const nextLevel = (run: Run, rating: number): Run =>
  newRun(run.level + 1, rating, run.lives, run.score, run.seed + 1)

export const tryAgain = (run: Run, rating: number): Run =>
  newRun(run.level, rating, run.lives, run.score, run.seed + 7)

export const riseFor = (level: number): number =>
  Math.min(RISE_MOST, RISE + (level - 1) * RISE_PER_LEVEL)

// --- what is on the board ----------------------------------------------------

/**
 * Every find on the board, or the first few of them.
 *
 * Used for the promise that there is always something to find, and for showing
 * one when somebody is stuck. It reads every run of four or more blocks along
 * every row and column, which is about nine hundred reads — only ever done
 * when the board changes, never in a frame.
 */
export function findsOn(cells: Cell[], most = Infinity): { cells: number[]; find: Find }[] {
  const out: { cells: number[]; find: Find }[] = []
  const look = (run: number[]) => {
    const find = readLine(run.map((i) => cells[i].token))
    if (find) out.push({ cells: run, find })
  }
  for (let row = 0; row < ROWS && out.length < most; row++) {
    for (let start = 0; start < COLS && out.length < most; start++) {
      for (let len = LEAST_FIND; start + len <= COLS && out.length < most; len++) {
        look(Array.from({ length: len }, (_, i) => at(start + i, row)))
      }
    }
  }
  for (let col = 0; col < COLS && out.length < most; col++) {
    for (let start = 0; start < ROWS && out.length < most; start++) {
      for (let len = LEAST_FIND; start + len <= ROWS && out.length < most; len++) {
        look(Array.from({ length: len }, (_, i) => at(col, start + i)))
      }
    }
  }
  return out
}

/**
 * Make sure there is something to find.
 *
 * The one promise this game makes, and the refills are where it gets lost: a
 * board nobody can do anything with is somebody watching the water come up
 * with no legal move and no way of knowing it is not their fault.
 */
function keepPromise(run: Run, rng: Rng): boolean {
  if (findsOn(run.cells, LEAST_FINDS).length >= LEAST_FINDS) return false
  let id = run.nextId
  const next = () => (id += 1)
  let planted = false
  while (findsOn(run.cells, LEAST_FINDS).length < LEAST_FINDS) {
    if (!plant(run.cells, run.band, rng, next)) break
    planted = true
  }
  run.nextId = id + 1
  return planted
}

// --- the finger --------------------------------------------------------------

/** The run of blocks between two, if they are in a line. Empty if they are not. */
export function runBetween(anchor: number, head: number): number[] {
  if (anchor === head) return [anchor]
  if (rowOf(anchor) === rowOf(head)) {
    const row = rowOf(anchor)
    const from = Math.min(colOf(anchor), colOf(head))
    const to = Math.max(colOf(anchor), colOf(head))
    const out = Array.from({ length: to - from + 1 }, (_, i) => at(from + i, row))
    return colOf(head) < colOf(anchor) ? out.reverse() : out
  }
  if (colOf(anchor) === colOf(head)) {
    const col = colOf(anchor)
    const from = Math.min(rowOf(anchor), rowOf(head))
    const to = Math.max(rowOf(anchor), rowOf(head))
    const out = Array.from({ length: to - from + 1 }, (_, i) => at(col, from + i))
    return rowOf(head) < rowOf(anchor) ? out.reverse() : out
  }
  return []
}

const lineOf = (run: Run, picked: number[]): Token[] => picked.map((i) => run.cells[i].token)

/** A finger going down. */
export function grab(run: Run, cell: number): Run {
  if (run.status !== 'playing') return run
  if (cell < 0 || cell >= CELLS) return run
  return {
    ...run,
    anchor: cell,
    head: cell,
    picked: [cell],
    reading: null,
    events: ['grab'],
  }
}

/** A finger dragging to another block. */
export function reach(run: Run, cell: number): Run {
  if (run.status !== 'playing' || run.anchor === null) return run
  if (cell < 0 || cell >= CELLS || cell === run.head) return run
  const picked = runBetween(run.anchor, cell)
  if (picked.length === 0) return run
  return {
    ...run,
    head: cell,
    picked,
    reading: readLine(lineOf(run, picked)),
    events: ['stretch'],
  }
}

/**
 * How much of the board a find takes with it.
 *
 * "The bigger the sequence he finds the more points he gets and more blocks
 * crushed, extra juicy." So a long find does not only score more, it clears
 * more than it covers: five or six takes the blocks either side of it as well,
 * and seven or more takes the whole row and the whole column it crosses.
 *
 * Seven and not eight, because a row is seven blocks wide: at eight the best
 * prize in the game could only ever be won downwards, which is a rule nobody
 * would guess and half a game nobody would find.
 */
export function blastOf(picked: number[]): number[] {
  const hit = new Set<number>(picked)
  const flat = picked.length > 1 && rowOf(picked[0]) === rowOf(picked[1])

  if (picked.length >= 5) {
    for (const cell of picked) {
      const col = colOf(cell)
      const row = rowOf(cell)
      if (flat) {
        if (row > 0) hit.add(at(col, row - 1))
        if (row < ROWS - 1) hit.add(at(col, row + 1))
      } else {
        if (col > 0) hit.add(at(col - 1, row))
        if (col < COLS - 1) hit.add(at(col + 1, row))
      }
    }
  }

  if (picked.length >= 7) {
    const middle = picked[Math.floor(picked.length / 2)]
    for (let c = 0; c < COLS; c++) hit.add(at(c, rowOf(middle)))
    for (let r = 0; r < ROWS; r++) hit.add(at(colOf(middle), r))
  }

  return [...hit]
}

/** What a find is worth: much more than its length, on purpose. */
export const worthOf = (length: number, streak: number): number =>
  WORTH * length * Math.max(1, length - 3) * Math.min(MOST_COMBO, Math.max(1, streak))

/**
 * Take a set of blocks out, drop what is above them, and fill the top.
 *
 * Each column's survivors are read off before anything is written, with the
 * row each came from, because how far a block falls is the difference between
 * the two. The first cut asked the board where a block was *while* rewriting
 * the board, which is a question with no answer once the first one has moved.
 */
function collapse(run: Run, gone: number[], rng: Rng): void {
  const dead = new Set(gone)
  for (let col = 0; col < COLS; col++) {
    const kept: { cell: Cell; from: number }[] = []
    for (let row = ROWS - 1; row >= 0; row--) {
      if (!dead.has(at(col, row))) kept.push({ cell: run.cells[at(col, row)], from: row })
    }
    const fresh = ROWS - kept.length
    for (let row = ROWS - 1, k = 0; row >= 0; row--, k++) {
      const taken = kept[k]
      if (taken) {
        run.cells[at(col, row)] = { ...taken.cell, lift: taken.cell.lift + (row - taken.from) }
      } else {
        // All the new ones share a lift, which stacks them above the board in
        // the order they will land rather than dropping them in on top of
        // each other.
        run.cells[at(col, row)] = {
          token: filler(run.band, rng),
          lift: fresh,
          shake: 0,
          id: run.nextId++,
        }
      }
    }
  }
}

/** The finger coming up: the moment a selection is judged. */
export function release(run: Run): Run {
  if (run.status !== 'playing' || run.anchor === null) return run

  const picked = run.picked
  const next: Run = {
    ...run,
    cells: run.cells.map((c) => ({ ...c })),
    anchor: null,
    head: null,
    picked: [],
    reading: null,
    events: [],
    seed: (run.seed * 1103515245 + 12345) >>> 0,
  }

  // Too short to be anything: a tap, or a change of mind. Costs nothing, which
  // matters — looking is how this game is played.
  if (picked.length < LEAST_FIND) return next

  const find = readLine(picked.map((i) => run.cells[i].token))
  if (!find) {
    /*
     * Not a find. The blocks shake, a little water comes back, and the run of
     * right answers is over — and that is the whole of it. Dragging along a
     * line to see whether it works *is* the game, so being wrong has to cost
     * less than being right is worth.
     */
    for (const i of picked) next.cells[i].shake = 0.3
    next.water = Math.min(1, next.water + SURGE)
    next.streak = 0
    next.events.push('miss')
    return next
  }

  const rng = makeRng(next.seed)
  const gone = blastOf(picked)
  next.streak = Math.min(MOST_COMBO, next.streak + 1)
  const worth = worthOf(find.length, next.streak)
  next.score += worth
  next.said = { says: find.says, line: sayLine(picked.map((i) => run.cells[i].token)), length: find.length, worth, life: 2.6 }

  collapse(next, gone, rng)

  next.water = Math.max(0, next.water - gone.length * DRAIN_PER_BLOCK)
  next.left = Math.max(0, next.left - gone.length)
  /*
   * 'big' means the biggest prize, not merely a long find.
   *
   * It fired at six, which is about a third of everything found, so the best
   * moment in a chamber sounded exactly as often as an ordinary one. Seven is
   * the length that takes the whole row and column, so that is what gets the
   * noise.
   */
  next.events.push(find.length >= 7 ? 'big' : 'crush')
  if (next.streak > 1) next.events.push('combo')
  if (next.water === 0) next.events.push('drain')
  if (keepPromise(next, rng)) next.events.push('planted')

  if (next.left === 0) {
    next.status = 'saved'
    next.events.push('saved')
  }
  return next
}

/** Give up on the current drag without judging it. */
export const letGo = (run: Run): Run =>
  run.anchor === null ? run : { ...run, anchor: null, head: null, picked: [], reading: null, events: [] }

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
    said: run.said && run.said.life > dt ? { ...run.said, life: run.said.life - dt } : null,
    events: [],
  }

  let landed = false
  for (const cell of next.cells) {
    if (cell.lift > 0) {
      cell.lift = Math.max(0, cell.lift - dt * 7)
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

export { COLS, ROWS, CELLS, TO_CLEAR, LEAST_FINDS, at, colOf, rowOf }
