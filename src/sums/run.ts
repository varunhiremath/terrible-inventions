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
  CELLS, COLS, DRAIN_PER_BLOCK, LEAST_FINDS, LIVES, MOST_COMBO, OFF_HUNT, PLANTED, RISE,
  RISE_MOST, RISE_PER_LEVEL, ROWS, SURGE, TO_CLEAR, WORTH, at, bandFor, colOf, filler, huntFor,
  rowOf, soulFor, writeFind, type Band, type Hunt, type Soul,
} from './level'
import { makeRng, type Rng } from '../engine/rng'
import {
  EQ, IS_SEQUENCE, LEAST_FIND, readLine, sayLine, type Find, type FindKind, type Token,
} from './find'

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
  /** Whether this was the kind the chamber asked for, for the drawing to say. */
  asked: boolean
  life: number
}

export interface Run {
  level: number
  band: Band
  /** Which question this chamber is asking: sums, or sequences. */
  hunt: Hunt
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
/**
 * The other way round, if there is one.
 *
 * An equation mirrors about its equals sign: `70 ÷ 7 = 10` becomes
 * `10 = 70 ÷ 7`, which is the same claim written the other way about. Anything
 * without an equals sign is a run of numbers, and those reverse outright.
 */
export function flipped(tokens: readonly Token[]): Token[] | null {
  const at = tokens.findIndex((t) => t.kind === 'eq')
  if (at < 0) return [...tokens].reverse()
  return [...tokens.slice(at + 1), EQ, ...tokens.slice(0, at)]
}

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
function pickKind(band: Band, rng: Rng, hunt: Hunt): FindKind {
  // A sums chamber plants sums and a sequences chamber plants sequences. The
  // fallback is a sum, for the opening band, whose only sequence is counting
  // up — it still has one, so this only bites if a band ever has none.
  if (hunt === 'sums' || band.runs.length === 0) return 'sum'
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
  cells: Cell[], band: Band, rng: Rng, hunt: Hunt, nextId: () => number, taken?: Set<number>,
): boolean {
  for (let go = 0; go < 14; go++) {
    const kind = pickKind(band, rng, hunt)
    const want = wantedLength(kind, band, rng)
    const tokens = writeFind(kind, band, want, rng)
    if (!tokens) continue
    /*
     * Never write over a find that is already down.
     *
     * This used to fall back to writing anywhere when nothing clear was left,
     * which is how a board planted with six answers could be handed over
     * holding one: each later find stamped a block out of an earlier one, and
     * a sum with somebody else's equals sign through it is not a sum. Now a
     * find that will not fit is simply not planted, and the caller tries again
     * with another kind and another length — some of which are shorter and do
     * fit.
     */
    const all = roomFor(tokens.length)
    const room = taken ? all.filter((run) => run.every((c) => !taken.has(c))) : all
    if (room.length === 0) continue
    const where = rng.pick(room)
    if (taken) for (const cell of where) taken.add(cell)
    /*
     * Written backwards half the time — but only when backwards is still true.
     *
     * This reversed the token list outright, and for a sequence that is fine
     * (a run of doubles read the other way is a run of halves). For an
     * equation it is a disaster: `70 ÷ 7 = 10` reversed is `10 = 7 ÷ 70`,
     * which is false, and the same goes for every take-away and every power.
     * Roughly half of every planted sum that used −, ÷ or ^ was a wrong
     * answer printed on the board — which is most of the reason the boards
     * were hard to find anything on, and it was invisible because a false
     * equation looks exactly like a true one until you do the arithmetic.
     *
     * An equation is mirrored about its equals sign instead, which swaps the
     * sides and leaves each side's own order alone. And whichever way round it
     * ends up, it is read back before it is written down: nothing is planted
     * that the game cannot then find.
     */
    const other = flipped(tokens)
    const written = other && rng.next() < 0.5 && readLine(other) ? other : tokens
    if (!readLine(written)) continue
    for (const [i, cell] of where.entries()) {
      cells[cell] = { token: written[i], lift: cells[cell]?.lift ?? 0, shake: 0, id: nextId() }
    }
    return true
  }
  return false
}

export function newRun(level = 1, rating = 1000, lives = LIVES, score = 0, seed = 1): Run {
  const band = bandFor(rating, level)
  const hunt = huntFor(level)
  const rng = makeRng(seed * 2654435761 + level)
  let id = 0
  const next = () => (id += 1)
  const cells: Cell[] = Array.from({ length: CELLS }, () => ({
    token: filler(band, rng, hunt), lift: 0, shake: 0, id: next(),
  }))
  const taken = new Set<number>()
  for (let i = 0; i < PLANTED; i++) plant(cells, band, rng, hunt, next, taken)
  // And then checked, rather than assumed: planting six does not mean six
  // survive, and the board that is handed over is the one that has to hold the
  // promise.
  /*
   * `continue`, not `break`.
   *
   * One failed plant is a find that did not fit where it was offered, not a
   * board that cannot hold another one — and giving up on the first failure
   * let a deep chamber open with two answers on it instead of four.
   */
  for (let go = 0; go < 40 && wanted(cells, hunt).length < LEAST_FINDS; go++) {
    plant(cells, band, rng, hunt, next, taken)
  }

  return {
    level,
    band,
    hunt,
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
 * The finds of the kind this chamber is asking for.
 *
 * The promise has to be about these and not about finds in general: a board
 * holding four sequences in a chamber that asked for sums keeps the old
 * promise and is still a board he cannot do the thing he was told to do.
 */
export const wanted = (cells: Cell[], hunt: Hunt): { cells: number[]; find: Find }[] =>
  distinctly(findsOn(cells).filter((it) => IS_SEQUENCE[it.find.kind] === (hunt === 'runs')))

/**
 * Separate answers, not separate readings of the same answer.
 *
 * `findsOn` returns every run of blocks that reads as something, and one
 * planted find yields a pile of them: a seven-long sequence contains four
 * four-long ones, three five-long ones and two six-long ones inside it, all
 * true, all the same answer. So counting raw finds said a sequences board held
 * fourteen things to find when it held two or three — and the promise that
 * there is always something findable was being kept with a number that meant
 * nothing.
 *
 * Longest first, and anything overlapping one already counted is the same
 * answer seen again.
 */
export function distinctly(
  found: { cells: number[]; find: Find }[],
): { cells: number[]; find: Find }[] {
  const out: { cells: number[]; find: Find }[] = []
  const used = new Set<number>()
  for (const it of [...found].sort((a, b) => b.cells.length - a.cells.length)) {
    if (it.cells.some((c) => used.has(c))) continue
    for (const c of it.cells) used.add(c)
    out.push(it)
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
  if (wanted(run.cells, run.hunt).length >= LEAST_FINDS) return false
  let id = run.nextId
  const next = () => (id += 1)
  let planted = false
  /*
   * The blocks the answers already on the board are written in, so topping up
   * mid-chamber cannot take one away to make room for another — which would
   * leave the count where it started and loop.
   */
  const taken = new Set<number>(wanted(run.cells, run.hunt).flatMap((it) => it.cells))
  for (let go = 0; go < 40 && wanted(run.cells, run.hunt).length < LEAST_FINDS; go++) {
    if (!plant(run.cells, run.band, rng, run.hunt, next, taken)) continue
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
          token: filler(run.band, rng, run.hunt),
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
  /*
   * Was this what the chamber asked for?
   *
   * If it was not — a sequence spotted in a chamber of sums — it still
   * crushes, it still drains the water, it still keeps the run of right
   * answers going, and it scores less. That is the whole penalty, and it is
   * deliberately the whole penalty: correct arithmetic is never a miss here.
   */
  const asked = IS_SEQUENCE[find.kind] === (next.hunt === 'runs')
  const worth = Math.round(worthOf(find.length, next.streak) * (asked ? 1 : OFF_HUNT))
  next.score += worth
  next.said = {
    says: find.says,
    line: sayLine(picked.map((i) => run.cells[i].token)),
    length: find.length,
    worth,
    asked,
    life: 2.6,
  }

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
