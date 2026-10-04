/**
 * Find the way through.
 *
 * A perfect maze — every square reachable, exactly one way between any two of
 * them — grown by walking a random spanning tree over the grid. Perfect is
 * doing a lot of work here: it means there is always exactly one answer, so
 * the way out can be shown when somebody has had enough, and there are no dead
 * ends that are secretly loops.
 *
 * The walls are kept as "is there a wall between these two squares", not as a
 * picture, because a maze stored as a picture is a maze somebody has to parse
 * before they can ask it anything.
 */
import type { Rng } from '../engine/rng'

export interface Maze {
  across: number
  down: number
  /** Walls to the right of, and below, each square. Outer edges are implied. */
  right: boolean[]
  below: boolean[]
  from: number
  to: number
  /** The one way through, as square indices. */
  answer: number[]
}

export const spot = (maze: { across: number }, x: number, y: number): number =>
  y * maze.across + x

/** The squares next to this one with no wall in between. */
export function ways(maze: Maze, cell: number): number[] {
  const x = cell % maze.across
  const y = Math.floor(cell / maze.across)
  const out: number[] = []
  if (x > 0 && !maze.right[y * maze.across + (x - 1)]) out.push(cell - 1)
  if (x < maze.across - 1 && !maze.right[cell]) out.push(cell + 1)
  if (y > 0 && !maze.below[(y - 1) * maze.across + x]) out.push(cell - maze.across)
  if (y < maze.down - 1 && !maze.below[cell]) out.push(cell + maze.across)
  return out
}

export function newMaze(across: number, down: number, rng: Rng): Maze {
  const cells = across * down
  const right = new Array<boolean>(cells).fill(true)
  const below = new Array<boolean>(cells).fill(true)

  /*
   * Grown depth first with an explicit stack.
   *
   * Depth first rather than Prim's, because the two make visibly different
   * mazes and this one makes long winding corridors — which is the kind a
   * person enjoys tracing with a finger. Prim's makes a shrub: short branches
   * everywhere and a solution four squares long.
   */
  const seen = new Array<boolean>(cells).fill(false)
  const stack = [rng.int(0, cells - 1)]
  seen[stack[0]] = true
  while (stack.length > 0) {
    const here = stack[stack.length - 1]
    const x = here % across
    const y = Math.floor(here / across)
    const open: number[] = []
    if (x > 0 && !seen[here - 1]) open.push(here - 1)
    if (x < across - 1 && !seen[here + 1]) open.push(here + 1)
    if (y > 0 && !seen[here - across]) open.push(here - across)
    if (y < down - 1 && !seen[here + across]) open.push(here + across)
    if (open.length === 0) { stack.pop(); continue }
    const there = rng.pick(open)
    if (there === here + 1) right[here] = false
    else if (there === here - 1) right[there] = false
    else if (there === here + across) below[here] = false
    else below[there] = false
    seen[there] = true
    stack.push(there)
  }

  // In at the top left, out at the bottom right, which is what everybody
  // expects a maze on paper to do.
  const from = 0
  const to = cells - 1
  const maze: Maze = { across, down, right, below, from, to, answer: [] }
  return { ...maze, answer: wayThrough(maze, from, to) }
}

/** The one path between two squares, or an empty list if there is none. */
export function wayThrough(maze: Maze, from: number, to: number): number[] {
  const came = new Map<number, number>([[from, -1]])
  const queue = [from]
  while (queue.length > 0) {
    const here = queue.shift()
    if (here === undefined) break
    if (here === to) break
    for (const there of ways(maze, here)) {
      if (came.has(there)) continue
      came.set(there, here)
      queue.push(there)
    }
  }
  if (!came.has(to)) return []
  const path: number[] = []
  for (let at = to; at !== -1; at = came.get(at) ?? -1) path.push(at)
  return path.reverse()
}
