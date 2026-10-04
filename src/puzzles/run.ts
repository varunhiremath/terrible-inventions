/**
 * The notebook, played.
 *
 * Pure, like everything else here, but with one real difference from the other
 * nine games: nothing in a puzzle happens on its own. There is no clock, no
 * gravity and nothing coming at you, so `step` only moves the shine along and
 * the whole of the game is in what a dragged finger is allowed to do.
 *
 * Which is deliberate. Eight of these games are about hurrying and one is
 * about hurrying at arithmetic; this is the one he can sit with.
 */
import { makeRng } from '../engine/rng'
import { newFigure, type Figure } from './stroke'
import { newMaze, ways, type Maze } from './maze'
import { newFlow, touching, type Flow } from './flow'
import { kindFor, sizeFor } from './level'

export const FIXED = 1 / 60

export type PuzzleEvent =
  | 'line' | 'back' | 'join' | 'cut' | 'solved' | 'no' | 'wipe' | 'shown'

/** Loudest first, so a frame with several things in it makes one noise. */
export const LOUDEST: readonly PuzzleEvent[] = [
  'solved', 'shown', 'wipe', 'no', 'cut', 'join', 'back', 'line',
]

export type Board =
  | { kind: 'stroke'; figure: Figure }
  | { kind: 'maze'; maze: Maze }
  | { kind: 'flow'; flow: Flow }

export interface Run {
  level: number
  board: Board
  /**
   * The work, kept as one shape for all three: a list of trails, each a list
   * of places. A place is a corner for the stroke and a square for the other
   * two. The stroke and the maze have exactly one trail; joining the dots has
   * one per colour, in the order the colours are listed.
   */
  trails: number[][]
  /** Which trail the finger is on, or null when it is up. */
  drawing: number | null
  /** Set once the puzzle is done, so the screen can stop and say so. */
  solved: boolean
  /** True once somebody has asked to be shown, so it does not count as solved. */
  shown: boolean
  /** Counts up for ever, for the shine on the finished line. */
  clock: number
  events: PuzzleEvent[]
  seed: number
}

export function newRun(level = 1, seed = 1): Run {
  const kind = kindFor(level)
  const size = sizeFor(kind, level)
  const rng = makeRng(seed * 2654435761 + level)
  let board: Board
  let trails: number[][]
  if (kind === 'stroke') {
    board = { kind, figure: newFigure(size.across, size.down, size.want, rng) }
    trails = [[]]
  } else if (kind === 'maze') {
    const maze = newMaze(size.across, size.down, rng)
    board = { kind, maze }
    // The maze starts with the finger already in the doorway, because a trail
    // that has to be begun exactly on one square is a trail nobody can begin.
    trails = [[maze.from]]
  } else {
    const flow = newFlow(size.across, size.down, size.want, rng)
    board = { kind, flow }
    trails = flow.ends.map(() => [])
  }
  return {
    level, board, trails, drawing: null, solved: false, shown: false,
    clock: 0, events: [], seed,
  }
}

export const nextPuzzle = (run: Run): Run => newRun(run.level + 1, run.seed + 1)

// --- what counts as finished -------------------------------------------------

const nameOf = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`)

/** The lines of a stroke trail, as names. */
export function strokeLines(trail: number[]): Set<string> {
  const out = new Set<string>()
  for (let i = 1; i < trail.length; i++) out.add(nameOf(trail[i - 1], trail[i]))
  return out
}

/** How much of the puzzle is done, nought to one, for the bar along the top. */
export function howFar(run: Run): number {
  const board = run.board
  if (board.kind === 'stroke') {
    const want = board.figure.lines.length
    return want === 0 ? 0 : Math.min(1, strokeLines(run.trails[0]).size / want)
  }
  if (board.kind === 'maze') {
    // How near the end the trail has got, which is the only honest measure in
    // a maze: a long wrong trail is not progress.
    const route = board.maze.answer
    const head = run.trails[0][run.trails[0].length - 1]
    const at = route.indexOf(head)
    return at < 0 ? 0 : at / Math.max(1, route.length - 1)
  }
  const cells = board.flow.across * board.flow.down
  let filled = 0
  for (const trail of run.trails) filled += trail.length
  return Math.min(1, filled / cells)
}

export function isDone(run: Run): boolean {
  const board = run.board
  if (board.kind === 'stroke') {
    return strokeLines(run.trails[0]).size === board.figure.lines.length
      && board.figure.lines.length > 0
  }
  if (board.kind === 'maze') {
    const trail = run.trails[0]
    return trail[trail.length - 1] === board.maze.to
  }
  /*
   * Both halves, and the second one is the one people forget.
   *
   * Every colour joined is not finished: the board has to be full as well, and
   * a board with every pair joined by the short way round has most of itself
   * empty. It is the rule the original is built on and it is what stops the
   * puzzle being trivial.
   */
  const flow = board.flow
  let filled = 0
  for (const [i, trail] of run.trails.entries()) {
    const [from, to] = flow.ends[i]
    if (trail.length < 2) return false
    if (trail[0] !== from && trail[0] !== to) return false
    if (trail[trail.length - 1] !== from && trail[trail.length - 1] !== to) return false
    filled += trail.length
  }
  return filled === flow.across * flow.down
}

// --- the finger --------------------------------------------------------------

/** Which trail, if any, a touch on this place should pick up. */
function graspOf(run: Run, place: number): number | null {
  const board = run.board
  if (board.kind === 'stroke' || board.kind === 'maze') return 0
  const flow = board.flow
  // A dot picks up its own colour and starts it again; a square already drawn
  // picks up the colour that drew it and rubs out the rest of it.
  for (const [i, ends] of flow.ends.entries()) {
    if (ends[0] === place || ends[1] === place) return i
  }
  for (const [i, trail] of run.trails.entries()) {
    if (trail.includes(place)) return i
  }
  return null
}

/** A finger going down on a place. Returns the run unchanged if it is no use. */
export function touch(run: Run, place: number): Run {
  if (run.solved) return run
  const which = graspOf(run, place)
  if (which === null) return { ...run, drawing: null }

  const board = run.board
  const trails = run.trails.map((t) => t.slice())

  if (board.kind === 'stroke') {
    // Anywhere on the figure starts a fresh stroke from there — there is only
    // ever one stroke, and picking the pen up and putting it somewhere else is
    // the same as starting again.
    const started = trails[0].length > 0
    trails[0] = [place]
    return {
      ...run, trails, drawing: 0,
      events: started ? ['wipe'] : [],
    }
  }

  if (board.kind === 'maze') {
    // Touching somewhere already on the trail rubs the rest of it out, which
    // is how anybody uses a pencil in a maze.
    const at = trails[0].indexOf(place)
    if (at >= 0) {
      const cut = trails[0].length - 1 - at
      trails[0] = trails[0].slice(0, at + 1)
      return { ...run, trails, drawing: 0, events: cut > 0 ? ['back'] : [] }
    }
    return { ...run, drawing: 0, events: [] }
  }

  const flow = board.flow
  const ends = flow.ends[which]
  if (ends[0] === place || ends[1] === place) {
    const had = trails[which].length
    trails[which] = [place]
    return { ...run, trails, drawing: which, events: had > 1 ? ['wipe'] : [] }
  }
  // Picked up in the middle: keep the part up to here and carry on from it.
  const at = trails[which].indexOf(place)
  trails[which] = trails[which].slice(0, at + 1)
  return { ...run, trails, drawing: which, events: [] }
}

/**
 * The finger moving onto a place.
 *
 * One step at a time: a finger moving fast crosses several squares between
 * frames, and the screen is responsible for handing them over one by one. The
 * rules here are about one step, which is the only way they stay simple enough
 * to be right.
 */
export function drag(run: Run, place: number): Run {
  if (run.solved || run.drawing === null) return run
  const which = run.drawing
  const board = run.board
  const trail = run.trails[which]
  if (trail.length === 0) return run
  const head = trail[trail.length - 1]
  if (head === place) return run

  const trails = run.trails.map((t) => t.slice())
  const done = (events: PuzzleEvent[], next: Run): Run => {
    if (!next.solved && isDone(next)) return { ...next, solved: true, events: [...events, 'solved'] }
    return { ...next, events }
  }

  if (board.kind === 'stroke') {
    // Back one: rubbing out the last line by going back along it.
    if (trail.length > 1 && trail[trail.length - 2] === place) {
      trails[0] = trail.slice(0, -1)
      return done(['back'], { ...run, trails })
    }
    const has = board.figure.lines.some(
      (l) => (l.a === head && l.b === place) || (l.b === head && l.a === place),
    )
    if (!has) return { ...run, events: [] }
    if (strokeLines(trail).has(nameOf(head, place))) {
      // Over a line already drawn, which is the one thing this puzzle forbids.
      return { ...run, events: ['no'] }
    }
    trails[0] = [...trail, place]
    return done(['line'], { ...run, trails })
  }

  if (board.kind === 'maze') {
    if (trail.length > 1 && trail[trail.length - 2] === place) {
      trails[0] = trail.slice(0, -1)
      return done(['back'], { ...run, trails })
    }
    if (!ways(board.maze, head).includes(place)) return { ...run, events: [] }
    if (trail.includes(place)) {
      // Doubling back onto the trail: rub out the loop rather than draw one.
      trails[0] = trail.slice(0, trail.indexOf(place) + 1)
      return done(['back'], { ...run, trails })
    }
    trails[0] = [...trail, place]
    return done(['line'], { ...run, trails })
  }

  const flow = board.flow
  if (!touching(flow, head, place)) return { ...run, events: [] }

  if (trail.length > 1 && trail[trail.length - 2] === place) {
    trails[which] = trail.slice(0, -1)
    return done(['back'], { ...run, trails })
  }
  if (trail.includes(place)) {
    trails[which] = trail.slice(0, trail.indexOf(place) + 1)
    return done(['back'], { ...run, trails })
  }

  const ends = flow.ends[which]
  const other = flow.ends.findIndex((e, i) => i !== which && (e[0] === place || e[1] === place))
  if (other >= 0) return { ...run, events: [] }   // somebody else's dot: no.

  // Another colour's line: cut it where it was crossed, which is how the
  // original behaves and is much kinder than refusing to move.
  const events: PuzzleEvent[] = []
  for (const [i, t] of trails.entries()) {
    if (i === which) continue
    const at = t.indexOf(place)
    if (at >= 0) { trails[i] = t.slice(0, at); events.push('cut') }
  }

  trails[which] = [...trail, place]
  const closed = place === ends[0] || place === ends[1]
  events.push(closed ? 'join' : 'line')
  return done(events, { ...run, trails })
}

/** The finger coming up. */
export const lift = (run: Run): Run =>
  run.drawing === null ? run : { ...run, drawing: null, events: [] }

/** Start this one again. */
export function wipe(run: Run): Run {
  const fresh = newRun(run.level, run.seed)
  return { ...fresh, shown: run.shown, clock: run.clock, events: ['wipe'] }
}

/**
 * Show me.
 *
 * Fills the answer in. It is marked `shown` so it is not celebrated as though
 * it had been solved — being shown is not the same as working it out, and a
 * game that pretends otherwise is a game whose praise means nothing.
 */
export function showMe(run: Run): Run {
  const board = run.board
  const trails =
    board.kind === 'stroke' ? [board.figure.answer.slice()]
    : board.kind === 'maze' ? [board.maze.answer.slice()]
    : board.flow.answer.map((arc) => arc.slice())
  return { ...run, trails, drawing: null, solved: true, shown: true, events: ['shown'] }
}

export function step(run: Run, dt: number): Run {
  // A finished puzzle raises nothing further, for ever: the alternative is a
  // noise sixty times a second on the screen that says well done.
  if (run.events.length === 0 && run.solved) return { ...run, clock: run.clock + dt }
  return { ...run, clock: run.clock + dt, events: [] }
}
