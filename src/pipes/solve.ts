/**
 * Can this level be got through?
 *
 * The dungeon shipped thirteen levels that were all sealed inside their first
 * room, and the only way anyone found out was by playing one and getting
 * stuck. This is the same check written before the levels rather than after
 * them.
 *
 * It searches the real physics — the same `step` the game runs — over a coarse
 * grid of positions and speeds, holding each button combination for a short
 * burst at a time. A burst rather than a frame because a jump is decided by
 * how long you hold it, so single frames would explore a space of decisions
 * no player can make and prove jumps nobody could perform.
 *
 * What it leaves out: enemies and the clock. A goomba can be jumped over,
 * stomped or run past, so treating one as a wall would call passable levels
 * impassable; and whether five minutes is enough is a question about
 * difficulty, not about whether the ground goes all the way to the flag.
 */
import { ROWS, type Level } from './level'
import { NO_INPUT, newBody, step, type Body, type Input } from './physics'

const DT = 1 / 60
/** How long one decision is held for, in frames. */
const BURST = 6

/** The buttons, in the combinations a player actually uses. */
const CHOICES: Input[] = [
  { ...NO_INPUT, right: true },
  { ...NO_INPUT, right: true, run: true },
  { ...NO_INPUT, right: true, jump: true },
  { ...NO_INPUT, right: true, run: true, jump: true },
  { ...NO_INPUT, jump: true },
  { ...NO_INPUT, left: true },
  { ...NO_INPUT, left: true, jump: true },
  NO_INPUT,
]

/**
 * How finely a state counts as its own.
 *
 * Eighths of a tile across, quarters down, and speed to the nearest tile a
 * second. Coarser merges a jump that clears a gap with one that does not;
 * finer spends the whole search on positions no player could tell apart.
 */
function keyOf(b: Body): string {
  return [
    Math.round(b.x * 8),
    Math.round(b.y * 4),
    Math.round(b.vx / 2),
    Math.round(b.vy),
    b.onGround ? 1 : 0,
    b.holding ? 1 : 0,
  ].join(',')
}

export interface Reached {
  finished: boolean
  seen: number
  /** How far right the search got, which says where a level dead-ends. */
  furthest: number
}

export function canFinish(level: Level, budget = 400_000): Reached {
  const start = newBody(2.5, 0)
  /**
   * Searched furthest-first rather than breadth-first.
   *
   * Breadth-first spends its whole budget on the thousands of ways to shuffle
   * about at the start of a level: it ran out of states at column fifteen of
   * eighty-three. Taking the furthest-right state next drives the search at
   * the flag, which is the direction the answer is in, and finds a route in a
   * fraction of the states — while still keeping everything it has seen, so a
   * dead end falls back to whatever was next furthest rather than giving up.
   */
  const buckets: Body[][] = []
  const push = (b: Body) => {
    const at = Math.max(0, Math.round(b.x))
    ;(buckets[at] ??= []).push(b)
  }
  push(start)
  const seen = new Set<string>([keyOf(start)])
  let furthest = start.x
  let top = Math.round(start.x)

  while (seen.size < budget) {
    while (top >= 0 && (buckets[top]?.length ?? 0) === 0) top -= 1
    if (top < 0) break
    const here = buckets[top]!.pop()!
    furthest = Math.max(furthest, here.x)
    if (here.x >= level.pole) return { finished: true, seen: seen.size, furthest }

    for (const input of CHOICES) {
      let body = here
      let died = false
      for (let i = 0; i < BURST; i++) {
        const out = step(body, input, level, DT)
        body = out.body
        if (out.fell || body.y > ROWS + 2) {
          died = true
          break
        }
      }
      if (died) continue

      const key = keyOf(body)
      if (seen.has(key)) continue
      seen.add(key)
      push(body)
      top = Math.max(top, Math.round(body.x))
    }
  }

  return { finished: false, seen: seen.size, furthest }
}
