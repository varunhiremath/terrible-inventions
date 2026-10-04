/**
 * Draw this without lifting your pen or going over a line twice.
 *
 * The boat, the envelope, the house with a cross in it — the oldest puzzle on
 * paper, and the one everybody's nan knows one of. What it actually is, is a
 * question about whether a graph has an Eulerian path: you can do it exactly
 * when the figure is in one piece and no more than two of its corners have an
 * odd number of lines meeting at them.
 *
 * Which means a generated one is easy to get wrong and impossible to notice:
 * a figure with four odd corners looks exactly like a figure with two, and the
 * only way to find out is to give it to somebody and watch them fail for ten
 * minutes at something that cannot be done.
 *
 * So these are not generated and then checked. They are generated *as their
 * own solution*: a pen is walked about the grid, never going back over a line
 * it has already drawn, and the lines it drew are the puzzle. The walk is a
 * one-stroke solution by construction, because it is literally one stroke.
 */
import type { Rng } from '../engine/rng'

export interface Dot {
  x: number
  y: number
}

/** A line between two corners, named by their indices, smaller one first. */
export interface Line {
  a: number
  b: number
}

export interface Figure {
  dots: Dot[]
  lines: Line[]
  /** The walk that drew it: corner indices, each pair of them a line. */
  answer: number[]
  /** How wide and tall the grid it was drawn on is, for the drawing. */
  across: number
  down: number
}

const nameOf = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`)

/** The eight ways a pen can go from one grid point to the next. */
const WAYS: readonly Dot[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
]

/**
 * Whether a diagonal would cross one already drawn.
 *
 * Two diagonals through the same square of the grid cross in the middle of it,
 * where there is no corner — so the figure looks like it has a junction that
 * cannot be drawn through, and anybody trying to solve it by eye is being
 * lied to.
 */
function crosses(used: Set<string>, across: number, from: Dot, to: Dot): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 || dy === 0) return false
  const at = (x: number, y: number) => y * across + x
  // The other diagonal of the same square.
  return used.has(nameOf(at(from.x, to.y), at(to.x, from.y)))
}

/**
 * A figure, drawn by walking a pen about and keeping what it drew.
 *
 * `want` is how many lines to aim for. The walk stops early if it paints
 * itself into a corner, which is fine: a shorter figure is still a figure.
 */
export function newFigure(across: number, down: number, want: number, rng: Rng): Figure {
  const at = (x: number, y: number) => y * across + x
  const used = new Set<string>()
  const lines: Line[] = []

  let x = rng.int(0, across - 1)
  let y = rng.int(0, down - 1)
  const answer = [at(x, y)]

  for (let drawn = 0; drawn < want; drawn++) {
    const here = { x, y }
    const open = rng.shuffle(WAYS).filter((way) => {
      const to = { x: x + way.x, y: y + way.y }
      if (to.x < 0 || to.x >= across || to.y < 0 || to.y >= down) return false
      if (used.has(nameOf(at(x, y), at(to.x, to.y)))) return false
      return !crosses(used, across, here, to)
    })
    if (open.length === 0) break

    /*
     * Prefer a step that keeps the pen somewhere it can carry on from.
     *
     * A purely random walk on a small grid corners itself after about a dozen
     * lines, and a six-line figure is not a puzzle. Looking one step ahead and
     * preferring the way out with the most ways out after it roughly doubles
     * how long a walk gets before it is stuck.
     */
    let best = open[0]
    let most = -1
    for (const way of open) {
      const to = { x: x + way.x, y: y + way.y }
      let after = 0
      for (const next of WAYS) {
        const on = { x: to.x + next.x, y: to.y + next.y }
        if (on.x < 0 || on.x >= across || on.y < 0 || on.y >= down) continue
        if (used.has(nameOf(at(to.x, to.y), at(on.x, on.y)))) continue
        if (on.x === x && on.y === y) continue
        if (crosses(used, across, to, on)) continue
        after += 1
      }
      if (after > most) { most = after; best = way }
    }

    const to = { x: x + best.x, y: y + best.y }
    const a = at(x, y)
    const b = at(to.x, to.y)
    used.add(nameOf(a, b))
    lines.push({ a: Math.min(a, b), b: Math.max(a, b) })
    answer.push(b)
    x = to.x
    y = to.y
  }

  // Only the corners the pen actually touched, renumbered, so the figure is a
  // drawing rather than a grid with a drawing somewhere in it.
  const seen = new Map<number, number>()
  const dots: Dot[] = []
  const keep = (old: number): number => {
    const found = seen.get(old)
    if (found !== undefined) return found
    const made = dots.length
    seen.set(old, made)
    dots.push({ x: old % across, y: Math.floor(old / across) })
    return made
  }
  // Put the smaller end first *after* renumbering, not before: the new numbers
  // are handed out in the order the corners are met, so a line that was the
  // right way round on the grid is not necessarily the right way round here.
  const out: Line[] = lines.map((l) => {
    const a = keep(l.a)
    const b = keep(l.b)
    return { a: Math.min(a, b), b: Math.max(a, b) }
  })

  /*
   * Moved to its own corner and measured by itself.
   *
   * A pen that never wandered into the left-hand column leaves a figure that
   * is four wide on a grid that says six, and the drawing — which sizes the
   * picture from `across` and `down` — then draws it small and off to one
   * side with a third of the paper empty beside it.
   */
  const left = Math.min(...dots.map((d) => d.x))
  const top = Math.min(...dots.map((d) => d.y))
  const right = Math.max(...dots.map((d) => d.x))
  const bottom = Math.max(...dots.map((d) => d.y))
  const moved = dots.map((d) => ({ x: d.x - left, y: d.y - top }))

  return {
    dots: moved,
    lines: out,
    answer: answer.map(keep),
    across: right - left + 1,
    down: bottom - top + 1,
  }
}

/** How many lines meet at each corner. */
export function degrees(figure: Figure): number[] {
  const count = figure.dots.map(() => 0)
  for (const line of figure.lines) {
    count[line.a] += 1
    count[line.b] += 1
  }
  return count
}

/**
 * Can this be drawn in one stroke, and from where?
 *
 * The real test, run over the real figure: one piece, and no more than two
 * corners with an odd number of lines. Written out rather than assumed from
 * the way they are made, because the point of a check is to disagree with you.
 */
export function oneStroke(figure: Figure): { can: boolean; starts: number[] } {
  if (figure.lines.length === 0) return { can: false, starts: [] }

  const count = degrees(figure)
  const odd = count.map((n, i) => ({ n, i })).filter((d) => d.n % 2 === 1).map((d) => d.i)

  // One piece, counting only corners that have a line at them.
  const next = figure.dots.map((): number[] => [])
  for (const line of figure.lines) {
    next[line.a].push(line.b)
    next[line.b].push(line.a)
  }
  const start = count.findIndex((n) => n > 0)
  const found = new Set<number>([start])
  const todo = [start]
  while (todo.length > 0) {
    const here = todo.pop()
    if (here === undefined) break
    for (const there of next[here]) {
      if (!found.has(there)) { found.add(there); todo.push(there) }
    }
  }
  const whole = count.every((n, i) => n === 0 || found.has(i))

  if (!whole || odd.length > 2) return { can: false, starts: [] }
  // Two odd corners: you must start at one of them. None: anywhere will do.
  return { can: true, starts: odd.length === 2 ? odd : [...found] }
}
