import { GHOST_STARTS, HEIGHT, WIDTH, isWall, wrapCell, type Cell } from './maze'

/**
 * The four chasers.
 *
 * Pac-Man is still played forty years on because its ghosts are not four random
 * walkers — each one targets a different tile, so they converge on you from
 * different angles and the maze develops a shape you can learn. That design is
 * reproduced faithfully here, because it is the entire game.
 *
 * {papa} is the relentless one, on the grounds that being chased by your own
 * father is funnier than being chased by a stranger.
 */

export type Dir = 'up' | 'left' | 'down' | 'right'

/** Tie-break order at a junction. Stable ordering is what makes ghosts learnable. */
export const DIRS: readonly Dir[] = ['up', 'left', 'down', 'right']

export const STEP: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
}

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export type Personality = 'direct' | 'ambush' | 'flank' | 'shy'
export type Phase = 'scatter' | 'chase' | 'frightened'

export interface GhostSpec {
  id: string
  name: string
  /** Drives the voxel body, so each chaser is recognisably itself. */
  seed: number
  colour: string
  personality: Personality
  /** Where it retreats to when the phase turns. */
  corner: Cell
  start: Cell
}

export const GHOSTS: readonly GhostSpec[] = [
  {
    id: 'papa',
    name: '{papa}',
    seed: 90210,
    colour: '#e8503a',
    personality: 'direct',
    corner: { x: WIDTH - 2, y: 1 },
    start: GHOST_STARTS[0],
  },
  {
    id: 'bolt',
    name: 'Bolt',
    seed: 10427,
    colour: '#f49ac1',
    personality: 'ambush',
    corner: { x: 1, y: 1 },
    start: GHOST_STARTS[1],
  },
  {
    id: 'cog',
    name: 'Cog',
    seed: 55291,
    colour: '#5ad2e0',
    personality: 'flank',
    corner: { x: WIDTH - 2, y: HEIGHT - 2 },
    start: GHOST_STARTS[2],
  },
  {
    id: 'rivet',
    name: 'Rivet',
    seed: 88123,
    colour: '#f0a04b',
    personality: 'shy',
    corner: { x: 1, y: HEIGHT - 2 },
    start: GHOST_STARTS[3],
  },
]

/** Beyond this the shy one joins in; closer than this it loses its nerve. */
export const SHY_DISTANCE = 8

export function ahead(cell: Cell, dir: Dir, tiles: number): Cell {
  const step = STEP[dir]
  return { x: cell.x + step.x * tiles, y: cell.y + step.y * tiles }
}

export function distanceSquared(a: Cell, b: Cell): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

/**
 * The tile a ghost is steering towards.
 *
 * Note that targets are allowed to sit outside the maze or inside a wall — a
 * ghost aims at a point and takes whichever legal turn gets it closest. That is
 * what produces the ambusher cutting you off rather than trailing you.
 */
export function targetFor(
  spec: GhostSpec,
  phase: Phase,
  player: Cell,
  playerDir: Dir,
  papaCell: Cell,
): Cell {
  if (phase === 'scatter') return spec.corner

  switch (spec.personality) {
    case 'direct':
      return player

    case 'ambush':
      // Four tiles in front, so it arrives where you are going.
      return ahead(player, playerDir, 4)

    case 'flank': {
      // Takes the point two ahead of the player and doubles the line from
      // {papa} through it, so it swings round the far side.
      const pivot = ahead(player, playerDir, 2)
      return { x: 2 * pivot.x - papaCell.x, y: 2 * pivot.y - papaCell.y }
    }

    case 'shy':
      // Bold at a distance, loses its nerve up close, which makes it the one
      // that behaves least predictably.
      return distanceSquared(spec.start, player) > SHY_DISTANCE ** 2 ? player : spec.corner
  }
}

/** As `targetFor`, but measured from where the ghost actually is. */
export function targetForAt(
  spec: GhostSpec,
  phase: Phase,
  at: Cell,
  player: Cell,
  playerDir: Dir,
  papaCell: Cell,
): Cell {
  if (spec.personality === 'shy' && phase === 'chase') {
    return distanceSquared(at, player) > SHY_DISTANCE ** 2 ? player : spec.corner
  }
  return targetFor(spec, phase, player, playerDir, papaCell)
}

export function legalDirections(at: Cell, facing: Dir): Dir[] {
  const open = DIRS.filter((dir) => !isWall(wrapCell({ x: at.x + STEP[dir].x, y: at.y + STEP[dir].y })))
  const forward = open.filter((dir) => dir !== OPPOSITE[facing])
  // A dead end leaves turning back as the only option, so it has to be allowed.
  return forward.length > 0 ? forward : open
}

/**
 * Picks the turn that gets closest to the target.
 *
 * Ghosts never reverse of their own accord — that is what lets a player shake
 * one off by doubling back, and it is the single rule that makes the chase
 * feel fair.
 */
export function chooseDirection(at: Cell, facing: Dir, target: Cell): Dir {
  const options = legalDirections(at, facing)

  let best = options[0]
  let bestDistance = Infinity

  // DIRS order breaks ties, so identical situations always resolve identically.
  for (const dir of DIRS) {
    if (!options.includes(dir)) continue
    const next = wrapCell({ x: at.x + STEP[dir].x, y: at.y + STEP[dir].y })
    const d = distanceSquared(next, target)
    if (d < bestDistance) {
      bestDistance = d
      best = dir
    }
  }

  return best
}

/** Frightened ghosts wander, which is what makes them catchable without being free. */
export function randomDirection(at: Cell, facing: Dir, roll: number): Dir {
  const options = legalDirections(at, facing)
  return options[Math.floor(roll * options.length) % options.length]
}

/**
 * Scatter and chase alternate on a fixed schedule, with scatter getting shorter
 * as the level goes on. The alternation is what stops a level becoming one long
 * unbroken pursuit, and the shrinking is what ramps the pressure.
 */
export const PHASE_SCHEDULE: readonly { phase: 'scatter' | 'chase'; seconds: number }[] = [
  { phase: 'scatter', seconds: 7 },
  { phase: 'chase', seconds: 20 },
  { phase: 'scatter', seconds: 7 },
  { phase: 'chase', seconds: 20 },
  { phase: 'scatter', seconds: 5 },
  { phase: 'chase', seconds: 20 },
  { phase: 'scatter', seconds: 5 },
  { phase: 'chase', seconds: Number.POSITIVE_INFINITY },
]

export function phaseAt(elapsedSeconds: number): 'scatter' | 'chase' {
  let remaining = elapsedSeconds
  for (const entry of PHASE_SCHEDULE) {
    if (remaining < entry.seconds) return entry.phase
    remaining -= entry.seconds
  }
  return 'chase'
}
