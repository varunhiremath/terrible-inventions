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
  RISE_MOST, RISE_PER_LEVEL, ROWS, SIGN_SHARE, SURGE, TO_CLEAR, WORTH, aSign, at, bandFor,
  colOf,
  filler, huntFor, rowOf, soulFor, writeFind, type Band, type Hunt, type Soul,
} from './level'
import { makeRng, type Rng } from '../engine/rng'
import {
  EQ, IS_SEQUENCE, LEAST_FIND, num, op, readLine, sayLine, type Find, type FindKind, type Token,
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

// --- where an operator is allowed to be -------------------------------------

/**
 * The rule the board is built to, and repaired to.
 *
 * Every operator and every equals sign has a number above it, below it, to its
 * left and to its right. Nothing else is allowed. That one rule gives all
 * three of the things that were asked for: no two signs touching, no sign on
 * the edge or in a corner, and so no line that reads as nonsense — whichever
 * way you read across the board you get number, sign, number, sign, number.
 *
 * What it cannot give is every whole row and column reading as one complete
 * equation, and that is not a matter of effort: for every row to read
 * `n op n op n` the signs have to sit on alternating columns of every row, and
 * for every column to do the same they have to sit on alternating rows of
 * every column. Those two demands disagree about the block at row nought,
 * column one, and about half the board after it. So a line is always
 * well-formed, and a line is an equation when it happens to carry an equals
 * sign — right or wrong, which is the game.
 */
const isSign = (t: Token): boolean => t.kind === 'op' || t.kind === 'eq'

/** The outer ring, where a sign would have nothing on one side of it. */
const onEdge = (i: number): boolean =>
  colOf(i) === 0 || colOf(i) === COLS - 1 || rowOf(i) === 0 || rowOf(i) === ROWS - 1

const beside = (i: number): number[] => {
  const c = colOf(i)
  const r = rowOf(i)
  const out: number[] = []
  if (c > 0) out.push(at(c - 1, r))
  if (c < COLS - 1) out.push(at(c + 1, r))
  if (r > 0) out.push(at(c, r - 1))
  if (r < ROWS - 1) out.push(at(c, r + 1))
  return out
}

/**
 * Whether an equals sign may stand here: one to a row.
 *
 * Without it, two equations crossing the same row each put an equals in it and
 * the row read `38 42 = 9 28 = 2` — every block of which is fine and neither
 * of which can be taken away, because both belong to a real answer somebody
 * could be about to find. So it is settled when they are laid out.
 *
 * The row and not the column, which was tried and measured and cost more than
 * it was worth. There are seven columns, so one equals sign to a column caps
 * the whole board at seven of them — and the real equations used every one,
 * leaving no room for the wrong sums that stop the equals sign being the
 * answer in itself. A row is seven blocks and is the way the eye reads; a
 * column is nine and longer than any find, so nobody reads one as a single
 * claim anyway.
 */
function eqFits(cells: Cell[], i: number, mine: ReadonlySet<number> = new Set()): boolean {
  const r = rowOf(i)
  for (let k = 0; k < COLS; k++) {
    const j = at(k, r)
    if (j !== i && !mine.has(j) && cells[j].token.kind === 'eq') return false
  }
  return true
}

/** Whether a sign may stand here, given what is already on the board. */
function signFits(cells: Cell[], i: number, mine: ReadonlySet<number> = new Set()): boolean {
  if (onEdge(i)) return false
  return beside(i).every((j) => mine.has(j) || !isSign(cells[j].token))
}

/**
 * Put right anything that breaks the rule.
 *
 * Needed as well as the care taken when laying blocks out, because the board
 * does not stay as it was laid out: every find crushed drops the blocks above
 * it down a place and fills the top with new ones, and a new block knows
 * nothing about what it has landed next to. Most of the nonsense that was
 * reported came from there rather than from the opening board.
 *
 * Blocks that are part of something findable are left alone — putting a board
 * right must never take away the thing the player was about to spot.
 */
export function tidy(cells: Cell[], band: Band, rng: Rng, hunt: Hunt): void {
  if (hunt === 'runs') {
    // A sequences chamber has no signs at all, so there is nothing to arrange.
    for (let i = 0; i < CELLS; i++) {
      if (isSign(cells[i].token)) cells[i] = { ...cells[i], token: filler(band, rng, hunt) }
    }
    return
  }
  const safe = new Set(wanted(cells, hunt).flatMap((it) => it.cells))
  for (let i = 0; i < CELLS; i++) {
    if (!isSign(cells[i].token) || safe.has(i)) continue
    if (signFits(cells, i)) continue
    cells[i] = { ...cells[i], token: filler(band, rng, hunt) }
  }
  /*
   * And at most one equals sign to a row and to a column, so that reading the
   * whole of one is reading one claim rather than a chain of them. The spare
   * becomes an operator rather than a number: the shape of the board stays as
   * it was and only the claim goes.
   */
  for (const line of lines()) {
    let seen = false
    for (const i of line) {
      if (cells[i].token.kind !== 'eq') continue
      if (!seen) { seen = true; continue }
      if (safe.has(i)) continue
      cells[i] = { ...cells[i], token: op(rng.pick(band.ops)) }
    }
  }
}

/** Whether two blocks say exactly the same thing. */
function same(a: Token | undefined, b: Token): boolean {
  if (!a) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'num' && b.kind === 'num') return a.n === b.n
  if (a.kind === 'op' && b.kind === 'op') return a.op === b.op
  return a.kind === 'eq'
}

/** Every row and every column, as lists of blocks. */
function lines(): number[][] {
  const out: number[][] = []
  for (let r = 0; r < ROWS; r++) out.push(Array.from({ length: COLS }, (_, c) => at(c, r)))
  for (let c = 0; c < COLS; c++) out.push(Array.from({ length: ROWS }, (_, r) => at(c, r)))
  return out
}

/** Lay operators over a board of numbers, wherever the rule allows one. */
function sprinkle(cells: Cell[], band: Band, rng: Rng, spare: ReadonlySet<number>): void {
  const order = Array.from({ length: CELLS }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (const i of order) {
    if (!spare.has(i)) continue
    if (rng.next() > SIGN_SHARE) continue
    if (!signFits(cells, i)) continue
    const sign = aSign(band, rng)
    if (sign.kind === 'eq' && !eqFits(cells, i)) continue
    cells[i] = { ...cells[i], token: sign }
  }
}

/**
 * Worked out once for each length and kept.
 *
 * Where a find of a given length can go does not depend on anything but the
 * length, and this was being built from scratch on every attempt — about four
 * hundred times a board, each time allocating fifty little arrays. It is the
 * same fifty every time.
 */
const roomBy = new Map<number, number[][]>()

function roomFor(want: number): number[][] {
  const had = roomBy.get(want)
  if (had) return had
  const made = roomsFor(want)
  roomBy.set(want, made)
  return made
}

function roomsFor(want: number): number[][] {
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
/**
 * Bend a find until it is wrong, without changing its shape.
 *
 * One number moved by a little, so `7 × 6 = 42` becomes `7 × 6 = 43` — still a
 * sum, still laid out like every other sum on the board, and false.
 */
function bend(tokens: readonly Token[], rng: Rng): Token[] | null {
  const spots = tokens.map((t, i) => (t.kind === 'num' ? i : -1)).filter((i) => i >= 0)
  for (let go = 0; go < 12; go++) {
    const where = rng.pick(spots)
    const was = tokens[where]
    if (was.kind !== 'num') continue
    const by = rng.pick([-3, -2, -1, 1, 2, 3])
    if (was.n + by < 1) continue
    const bent = [...tokens]
    bent[where] = num(was.n + by)
    if (!readLine(bent)) return bent
  }
  return null
}

function plant(
  cells: Cell[], band: Band, rng: Rng, hunt: Hunt, nextId: () => number, taken?: Set<number>,
  wrong = false,
): boolean {
  /*
   * Plenty of tries. A find has to miss every block already spoken for, keep
   * its operators off the edge and away from other operators, and put its
   * equals sign in a row and a column that have not got one — which is a lot
   * to satisfy by throwing darts, and fourteen throws was not enough once all
   * of it was true at once.
   */
  for (let go = 0; go < 24; go++) {
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
    /*
     * Which way round it goes is settled first, before anywhere is chosen.
     *
     * It used to be settled last, after the legal places had been worked out
     * — and mirroring an equation moves its equals sign to a different block,
     * so the sign was checked in one place and written in another. Which is
     * why one equals sign to a row, carefully enforced, made no difference to
     * the number of rows with two of them.
     */
    const other = flipped(tokens)
    const right = other && rng.next() < 0.5 && readLine(other) ? other : tokens
    if (!readLine(right)) continue
    /*
     * A decoy: the same thing, one number out.
     *
     * Needed because of what the rest of this does. Once operators only go
     * where they are legal there is far less room for them, and every equals
     * sign on the board was part of a true equation 98 times out of 100 — so
     * the game stopped being arithmetic and became "find the equals sign and
     * drag round it". A board wants wrong sums on it as much as right ones.
     */
    const written = wrong ? bend(right, rng) : right
    if (!written) continue

    const all = roomFor(written.length)
    /*
     * Finds may cross, where they agree.
     *
     * A block already spoken for can be shared when both finds want the very
     * same thing written in it — which in practice means two equations
     * crossing at a number they happen to have in common, the way words cross
     * in a crossword. It costs nothing and it is the difference between a
     * board that holds four answers and one that holds six, because every
     * other rule here is about keeping finds apart.
     */
    const free = taken
      ? all.filter((run) => run.every((c, k) => !taken.has(c) || same(cells[c].token, written[k])))
      : all
    /*
     * And it has to land somewhere its own operators are legal — off the edge,
     * and not up against a sign already on the board. A find's own signs are
     * two apart, so they never argue with each other.
     */
    const room = free.filter((where) => {
      const mine = new Set(where)
      return where.every((cell, k) => {
        if (written[k].kind === 'eq' && !eqFits(cells, cell, mine)) return false
        return !isSign(written[k]) || signFits(cells, cell, mine)
      })
    })
    if (room.length === 0) continue
    const where = rng.pick(room)
    if (taken) for (const cell of where) taken.add(cell)
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
  /*
   * The right ones first, up to the promise, then right and wrong together.
   *
   * Order matters because the board fills up: sixty-three blocks hold about
   * eight finds of five blocks each, and after that nothing else goes on. Wrong
   * sums laid last never landed at all — nought out of five on two boards in
   * three. Laid first they crowded out the real answers instead. So the floor
   * is secured first and everything after it is shared out.
   */
  /*
   * Counted again only when something has actually been written.
   *
   * Counting what is findable means reading every window of the board, which
   * is four hundred lines; doing it in the condition of a loop that mostly
   * fails to place anything meant doing it for nothing most of the time, and
   * a slow machine timed out building boards because of it.
   */
  let have = wanted(cells, hunt).length
  for (let go = 0; go < 24 && have < LEAST_FINDS + 1; go++) {
    if (plant(cells, band, rng, hunt, next, taken)) have = wanted(cells, hunt).length
  }
  for (let i = 0; i < PLANTED; i++) {
    plant(cells, band, rng, hunt, next, taken, hunt === 'sums' && i % 2 === 0)
  }

  /*
   * `continue`, not `break`.
   *
   * One failed plant is a find that did not fit where it was offered, not a
   * board that cannot hold another one — and giving up on the first failure
   * let a deep chamber open with two answers on it instead of four.
   */
  have = wanted(cells, hunt).length
  for (let go = 0; go < 40 && have < LEAST_FINDS; go++) {
    if (plant(cells, band, rng, hunt, next, taken)) have = wanted(cells, hunt).length
  }
  /*
   * The operators go on last, into whatever is left.
   *
   * They used to be rolled per block before anything else, which is why the
   * board could hand you `11 + + 39 = 5 8`: a block cannot tell whether it is
   * allowed to be an operator without looking at its neighbours, and nothing
   * was looking.
   */
  if (hunt === 'sums') {
    const spare = new Set(
      Array.from({ length: CELLS }, (_, i) => i).filter((i) => !taken.has(i)),
    )
    sprinkle(cells, band, rng, spare)
  }
  tidy(cells, band, rng, hunt)

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
export function findsOn(
  cells: Cell[], most = Infinity, hunt?: Hunt,
): { cells: number[]; find: Find }[] {
  const out: { cells: number[]; find: Find }[] = []
  const look = (run: number[]) => {
    /*
     * A quick look before the real one.
     *
     * Working out what is findable means reading every window of the board,
     * four hundred of them, and it is done several times while a board is laid
     * out. Counting the equals signs in a window throws most of them away for
     * almost nothing: a sum has exactly one, and a run of numbers has none and
     * nothing else either.
     */
    if (hunt) {
      let eqs = 0
      let signs = 0
      for (const i of run) {
        const kind = cells[i].token.kind
        if (kind === 'eq') eqs++
        else if (kind === 'op') signs++
      }
      if (hunt === 'sums' ? eqs !== 1 : eqs + signs > 0) return
    }
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
  distinctly(findsOn(cells, Infinity, hunt).filter(
    (it) => IS_SEQUENCE[it.find.kind] === (hunt === 'runs'),
  ))

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
  for (const it of [...found].sort((a, b) => b.cells.length - a.cells.length)) {
    /*
     * Two finds are the same answer only when they lie along the same line.
     *
     * Overlapping was the test at first, and it is wrong in a way that only
     * showed up when finds were allowed to cross: an equation running across
     * and an equation running down, sharing the one number they have in
     * common, are two answers and not one — the way two words crossing in a
     * crossword are two words. Counting them as one made a board that held
     * six look like a board that held four, and made crossing look like a
     * change for the worse when it was a change for the better.
     */
    const mineRow = sameRow(it.cells)
    if (out.some((kept) => sameRow(kept.cells) === mineRow
      && onSameLine(kept.cells, it.cells, mineRow)
      && it.cells.some((c) => kept.cells.includes(c)))) continue
    out.push(it)
  }
  return out
}

/** Whether a find runs across rather than down. */
const sameRow = (cells: number[]): boolean => cells.every((c) => rowOf(c) === rowOf(cells[0]))

/** Whether two finds of the same direction sit on the very same line. */
const onSameLine = (a: number[], b: number[], across: boolean): boolean =>
  across ? rowOf(a[0]) === rowOf(b[0]) : colOf(a[0]) === colOf(b[0])

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
  let have = wanted(run.cells, run.hunt).length
  for (let go = 0; go < 40 && have < LEAST_FINDS; go++) {
    if (!plant(run.cells, run.band, rng, run.hunt, next, taken)) continue
    planted = true
    have = wanted(run.cells, run.hunt).length
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
/** Drops what is above the gap, fills the top, and says which blocks are new. */
function collapse(run: Run, gone: number[], rng: Rng): Set<number> {
  const dead = new Set(gone)
  const made = new Set<number>()
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
        made.add(at(col, row))
      }
    }
  }
  return made
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

  const made = collapse(next, gone, rng)

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
  /*
   * New blocks arrive as plain numbers, and then the ones that are allowed to
   * be operators are picked out — the same way the opening board is built, and
   * for the same reason. Refills are where most of the nonsense came from: a
   * block dropped in from the top knows nothing about what it has landed next
   * to.
   */
  if (next.hunt === 'sums') sprinkle(next.cells, next.band, rng, made)
  if (keepPromise(next, rng)) next.events.push('planted')
  tidy(next.cells, next.band, rng, next.hunt)

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
