/**
 * Can this level actually be finished?
 *
 * Level one shipped with its first room sealed: solid wall above, solid floor
 * below, and a wall to the right. There was no way out of it and no way to
 * find that out except by playing, which is how it was found. Every level
 * here is hand-written, and a hand-written level in a game with committed
 * movement is very easy to get wrong in a way that is invisible on the page.
 *
 * So this plays the level. Not a model of the movement — the movement, by
 * calling `tick` exactly as the game does, with the same frame tables and the
 * same rules about what can interrupt what. A search over a model would only
 * prove the model completable.
 *
 * What it leaves out, and why:
 *
 *   Guards. A guard can be fought past or slipped past, and which of those
 *   happens depends on the fight, so treating one as a wall would call
 *   solvable levels unsolvable. A level that needs a guard beaten to open a
 *   route is still counted as passable here.
 *
 *   The clock. Whether an hour is enough is a question about difficulty, not
 *   about whether the geometry works.
 */
import { TILE, tileAt, type Level } from './level'
import { NO_INPUT, newPrince, tick, type Input, type Prince } from './prince'

/** Every way the player can hold the pad down for one frame. */
const INPUTS: Input[] = [
  NO_INPUT,
  { ...NO_INPUT, right: true },
  { ...NO_INPUT, left: true },
  { ...NO_INPUT, up: true },
  { ...NO_INPUT, right: true, up: true },
  { ...NO_INPUT, left: true, up: true },
  { ...NO_INPUT, right: true, shift: true },
  { ...NO_INPUT, left: true, shift: true },
  { ...NO_INPUT, shift: true },
  { ...NO_INPUT, down: true },
]

/**
 * How finely a position counts as its own state.
 *
 * Quarter of a tile. Finer wastes the search on positions the player cannot
 * tell apart; coarser collapses two positions that a running jump lands
 * differently from, and the search then believes in jumps that do not exist.
 */
const GRAIN = 4

function keyOf(p: Prince, gateFrames: number): string {
  return [
    Math.round(p.col * GRAIN),
    p.row,
    p.facing,
    p.action,
    p.frame,
    // Gates change what is passable, so two otherwise identical positions
    // with the gates open and shut are genuinely different places to be.
    gateFrames > 0 ? 1 : 0,
    p.collapsed.length ? [...p.collapsed].sort().join('|') : '',
  ].join(',')
}

export interface Reached {
  /** Whether the way out can be got to from the start. */
  finished: boolean
  /** How many distinct states the search looked at. */
  seen: number
  /** The furthest column reached, which says where a level dead-ends. */
  furthest: number
  /** The rooms the search managed to stand in, for saying where it got stuck. */
  rooms: string[]
}

const GATE_HOLD = 150

/** Plays the level every way there is, and says whether the exit comes up. */
export function canFinish(level: Level, budget = 400_000): Reached {
  const start = newPrince(level)
  const queue: { prince: Prince; gate: number }[] = [{ prince: start, gate: 0 }]
  const seen = new Set<string>([keyOf(start, 0)])
  const rooms = new Set<string>()
  let furthest = start.col

  while (queue.length > 0 && seen.size < budget) {
    const here = queue.shift()!
    rooms.add(`${Math.floor(here.prince.col / 10)},${Math.floor(here.prince.row / 3)}`)
    furthest = Math.max(furthest, here.prince.col)

    for (const input of INPUTS) {
      const gateOpen = here.gate > 0
      const next = tick(here.prince, level, input, gateOpen)
      if (next.dead) continue
      if (next.atExit) return { finished: true, seen: seen.size, furthest, rooms: [...rooms] }

      // Standing on a plate holds every gate open for a while.
      const under = tileAt(level, Math.round(next.col), next.row)
      const gate = under === TILE.BUTTON ? GATE_HOLD : Math.max(0, here.gate - 1)

      const key = keyOf(next, gate)
      if (seen.has(key)) continue
      seen.add(key)
      queue.push({ prince: next, gate })
    }
  }

  return { finished: false, seen: seen.size, furthest, rooms: [...rooms] }
}

/**
 * Whether a particular tile can be stood on, playing the level for real.
 *
 * `canFinish` proves the way out is reachable and says nothing about anything
 * else in the level. The sword on floor one sat on a ledge with solid floor
 * directly above it and a four-tile gap either side — so it could not be
 * fallen onto and could not be jumped to, and the only pickup in the game that
 * matters was decoration. Nobody noticed until somebody tried to collect it.
 */
export function canReach(level: Level, want: string, budget = 400_000): boolean {
  const start = newPrince(level)
  const queue: { prince: Prince; gate: number }[] = [{ prince: start, gate: 0 }]
  const seen = new Set<string>([keyOf(start, 0)])

  while (queue.length > 0 && seen.size < budget) {
    const here = queue.shift()!
    if (tileAt(level, Math.round(here.prince.col), here.prince.row) === want) return true

    for (const input of INPUTS) {
      const next = tick(here.prince, level, input, here.gate > 0)
      if (next.dead) continue

      const under = tileAt(level, Math.round(next.col), next.row)
      const gate = under === TILE.BUTTON ? GATE_HOLD : Math.max(0, here.gate - 1)
      const key = keyOf(next, gate)
      if (seen.has(key)) continue
      seen.add(key)
      queue.push({ prince: next, gate })
    }
  }
  return false
}

/**
 * Every tile he can stand on, playing the level for real.
 *
 * The same question `canReach` asks, asked once for the whole level instead of
 * once per tile. Used to check that what is lying about in a level can be
 * picked up, and to find somewhere to put it when it cannot.
 */
export function reachableTiles(level: Level, budget = 400_000): Set<string> {
  const start = newPrince(level)
  const queue: { prince: Prince; gate: number }[] = [{ prince: start, gate: 0 }]
  const seen = new Set<string>([keyOf(start, 0)])
  const tiles = new Set<string>()

  while (queue.length > 0 && seen.size < budget) {
    const here = queue.shift()!
    tiles.add(`${Math.round(here.prince.col)},${here.prince.row}`)

    for (const input of INPUTS) {
      const next = tick(here.prince, level, input, here.gate > 0)
      if (next.dead) continue

      const under = tileAt(level, Math.round(next.col), next.row)
      const gate = under === TILE.BUTTON ? GATE_HOLD : Math.max(0, here.gate - 1)
      const key = keyOf(next, gate)
      if (seen.has(key)) continue
      seen.add(key)
      queue.push({ prince: next, gate })
    }
  }
  return tiles
}
