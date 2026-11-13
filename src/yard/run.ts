/**
 * The Yard, simulated.
 *
 * Pure and fixed-step like every other game here. There is one order on the
 * board at a time and one rectangle chalked on the sheet, and everything the
 * player does is one of three things: drag the rectangle, change the depth, or
 * press the press.
 *
 * The cut is kept separate from the drag on purpose. A game that stamped the
 * panel out the moment the finger lifted would be a game of flinching; here
 * you draw it, read what it comes to off the board — the width, the height,
 * the area, the edge — and then decide. The reading is where the learning is.
 */
import {
  DEEPEST, LIVES, TALL, WIDE,
  areaOf, cubesOf, edgeOf, fills, newOrder, offBy, ordersFor,
  type Cut, type Dice, type Order,
} from './level'

export const FIXED = 1 / 60

export type YardEvent =
  | 'chalk' | 'cut' | 'offcut' | 'order' | 'scrapped' | 'cleared' | 'over'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, like every other game in here:
 * `events.test.ts` reads this list and the event union together, because an
 * event missing from the list is never the loudest thing in any frame and so
 * is silent for ever with nothing to notice.
 */
export const LOUDEST: readonly YardEvent[] = [
  'over', 'cleared', 'scrapped', 'cut', 'offcut', 'order', 'chalk',
]

export type Status = 'playing' | 'cleared' | 'over'

export interface Run {
  level: number
  status: Status
  score: number
  lives: number
  /** The order on the board, and how many are behind it. */
  order: Order
  left: number
  /** Seconds before the lorry goes without this one. */
  clock: number
  /** The rectangle chalked on the sheet. */
  cut: Cut
  /** How deep the tank is being built, for the orders that want cubes. */
  deep: number
  /** How many orders have been filled, and how many went unfilled. */
  done: number
  missed: number
  /** What the board is saying about the last bad cut, and for how long. */
  grumble: string
  grumbleFor: number
  /** Seconds of green after a good one. */
  cheer: number
  events: YardEvent[]
  seed: number
  nextId: number
}

// --- the dice ----------------------------------------------------------------

function makeDice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)) }
}

const stir = (seed: number): number => (seed * 1103515245 + 12345) >>> 0

// --- starting -----------------------------------------------------------------

/** Where the chalk starts: a two by two in the corner, so there is always one. */
const FIRST: Cut = { x: 1, y: 1, wide: 2, tall: 2 }

export function newRun(level = 1, lives = LIVES, score = 0, seed = 1): Run {
  const dice = makeDice(seed)
  const order = newOrder(1, level, dice)
  return {
    level,
    status: 'playing',
    score,
    lives,
    order,
    left: ordersFor(level) - 1,
    clock: order.seconds,
    cut: { ...FIRST },
    deep: order.deep ?? 2,
    done: 0,
    missed: 0,
    grumble: '',
    grumbleFor: 0,
    cheer: 0,
    events: [],
    seed: stir(seed),
    nextId: 2,
  }
}

export const nextLevel = (run: Run): Run =>
  newRun(run.level + 1, run.lives, run.score, run.seed + 1)

/** Carrying on after a lorry has gone without one. */
export const serve = (run: Run): Run => ({ ...run, status: 'playing', events: [] })

// --- what the player can do ------------------------------------------------------

export type Move =
  /** Drag: a corner, and wherever the finger is now, both in squares. */
  | { kind: 'drag'; fromX: number; fromY: number; toX: number; toY: number }
  /** Deeper or shallower, for a tank. */
  | { kind: 'deep'; by: number }
  /** Stamp it out. */
  | { kind: 'cut' }

/** The rectangle between two corners, kept on the sheet. */
export function between(fromX: number, fromY: number, toX: number, toY: number): Cut {
  const x = Math.max(0, Math.min(WIDE - 1, Math.min(fromX, toX)))
  const y = Math.max(0, Math.min(TALL - 1, Math.min(fromY, toY)))
  const right = Math.max(0, Math.min(WIDE - 1, Math.max(fromX, toX)))
  const low = Math.max(0, Math.min(TALL - 1, Math.max(fromY, toY)))
  return { x, y, wide: right - x + 1, tall: low - y + 1 }
}

// --- a step -----------------------------------------------------------------------

export function step(run: Run, move: Move | null, dt: number): Run {
  if (run.status !== 'playing') return { ...run, events: [] }

  const next: Run = { ...run, cut: { ...run.cut }, events: [] }
  next.clock = Math.max(0, next.clock - dt)
  next.cheer = Math.max(0, next.cheer - dt)
  next.grumbleFor = Math.max(0, next.grumbleFor - dt)
  if (next.grumbleFor <= 0) next.grumble = ''

  if (move) apply(next, move)

  if (next.clock <= 0 && next.status === 'playing') {
    // The lorry went without it. It costs a go, and nothing is said about
    // whose fault that was.
    next.lives -= 1
    next.missed += 1
    next.events.push('scrapped')
    if (next.lives <= 0) {
      next.status = 'over'
      next.events.push('over')
    } else {
      bringOn(next)
    }
  }

  return next
}

function apply(run: Run, move: Move): void {
  if (move.kind === 'drag') {
    const was = `${run.cut.x},${run.cut.y},${run.cut.wide},${run.cut.tall}`
    run.cut = between(move.fromX, move.fromY, move.toX, move.toY)
    if (`${run.cut.x},${run.cut.y},${run.cut.wide},${run.cut.tall}` !== was) {
      run.events.push('chalk')
    }
    return
  }

  if (move.kind === 'deep') {
    if (run.order.job !== 'tank') return
    const want = Math.max(1, Math.min(DEEPEST, run.deep + move.by))
    if (want !== run.deep) {
      run.deep = want
      run.events.push('chalk')
    }
    return
  }

  // The press.
  if (fills(run.order, run.cut, run.deep)) {
    run.done += 1
    run.cheer = 0.9
    // Quickly is worth more, but never so much that taking your time loses.
    run.score += 70 + Math.round(run.clock) * 3
    run.events.push('cut')
    if (run.left <= 0) {
      run.status = 'cleared'
      run.score += 250 + (run.missed === 0 ? 250 : 0)
      run.events.push('cleared')
      return
    }
    bringOn(run)
    return
  }

  /*
   * A bad cut costs three seconds and a piece of ply, and the board says what
   * was wrong with it — "20 squares, not 24" — rather than just no. Being told
   * which way you are out is the difference between guessing again and
   * thinking again, and it is the only teaching this game does out loud.
   */
  run.grumble = offBy(run.order, run.cut, run.deep)
  run.grumbleFor = 2.4
  run.clock = Math.max(0, run.clock - 3)
  run.events.push('offcut')
}

/** The next order on the board. */
function bringOn(run: Run): void {
  const dice = makeDice(run.seed)
  run.seed = stir(run.seed)
  const order = newOrder(run.nextId++, run.level, dice)
  run.order = order
  run.left -= 1
  run.clock = order.seconds
  run.cut = { ...FIRST }
  run.deep = order.deep ?? 2
  run.grumble = ''
  run.grumbleFor = 0
  run.events.push('order')
}

// --- what the screen asks ----------------------------------------------------------

/** What the chalked rectangle comes to, for the board along the bottom. */
export const measures = (run: Run): {
  wide: number; tall: number; area: number; edge: number; cubes: number
} => ({
  wide: run.cut.wide,
  tall: run.cut.tall,
  area: areaOf(run.cut),
  edge: edgeOf(run.cut),
  cubes: cubesOf(run.cut, run.deep),
})

/** Whether the press would take what is chalked at the moment. */
export const ready = (run: Run): boolean => fills(run.order, run.cut, run.deep)
