/**
 * The world Dave runs through.
 *
 * The original stores each level as a hundred tiles by ten, sixteen pixels
 * each, and shows twenty by ten of it at a time — so a level is ten screens
 * wide and exactly one screen tall, and the view scrolls sideways only. That
 * shape is not incidental: it is why the game is a series of committed runs
 * left to right rather than somewhere to explore, and it is why you can always
 * see the whole height of the room you are about to jump into.
 *
 * These levels are our own. The tile vocabulary and the proportions are the
 * original's; the layouts are not lifted from it.
 */

export const TILE = {
  EMPTY: ' ',
  /** Blue brick. Stands on, walks into. */
  BRICK: '#',
  /** The red stuff along the floor. Touch it and you are dead. */
  FIRE: '^',
  /** Also dead, and it moves. */
  WATER: '~',
  /** Hangs from the ceiling. Dead. */
  TENTACLE: '!',
  /** Take it, then the door opens. */
  TROPHY: 'T',
  /** The way out, once the trophy is taken. */
  DOOR: 'D',
  JETPACK: 'J',
  GUN: 'G',
  /**
   * The six pickups, cheapest first.
   *
   * Named for what they look like rather than for what the original called
   * them. The values are the original's — fifteen up to five hundred — but a
   * table of prices is not what anyone remembers about this game. What they
   * remember is the cyan diamonds, which are everywhere, and the gold crown,
   * which is not.
   */
  SPHERE: '1',
  GEM: '2',
  DIAMOND: '3',
  RING: '4',
  RUBY: '5',
  CROWN: '6',
} as const

export type Tile = (typeof TILE)[keyof typeof TILE]

/** A level is ten screens wide and one screen tall. */
export const VIEW_TILES_X = 20
export const VIEW_TILES_Y = 10
export const LEVEL_TILES_X = 100
export const LEVEL_TILES_Y = 10

/** What each pickup is worth, as in the original. */
export const WORTH: Record<string, number> = {
  [TILE.SPHERE]: 15,
  [TILE.GEM]: 50,
  [TILE.DIAMOND]: 100,
  [TILE.RING]: 200,
  [TILE.RUBY]: 250,
  [TILE.CROWN]: 500,
  [TILE.TROPHY]: 1000,
  [TILE.DOOR]: 2000,
}

const SOLID = new Set<string>([TILE.BRICK])
const DEADLY = new Set<string>([TILE.FIRE, TILE.WATER, TILE.TENTACLE])
const PICKUPS = new Set<string>([
  TILE.SPHERE,
  TILE.GEM,
  TILE.DIAMOND,
  TILE.RING,
  TILE.RUBY,
  TILE.CROWN,
])

export function isSolid(tile: string): boolean {
  return SOLID.has(tile)
}

export function isDeadly(tile: string): boolean {
  return DEADLY.has(tile)
}

export function isPickup(tile: string): boolean {
  return PICKUPS.has(tile)
}

/**
 * A closed loop the creatures walk, as offsets in tiles from wherever each one
 * started.
 *
 * One path per level and every creature on it, which is how the original does
 * it: it stores a single list of relative moves, and each monster is just a
 * different distance along the same loop. It sounds like a shortcut and it is
 * the opposite — a roomful of things moving in the same shape at different
 * phases reads as choreography, and a roomful of things each doing their own
 * thing reads as noise.
 */
export interface Path {
  points: readonly { x: number; y: number }[]
  /** How fast a creature travels along it, in tiles per second. */
  speed: number
}

export interface MonsterSpec {
  at: { x: number; y: number }
  /** Which drawing to use. They behave identically; only the look differs. */
  kind: 'spider' | 'orb' | 'saucer'
  /** How far round the loop this one starts, 0 to 1. */
  phase: number
}

/**
 * What a level is built out of, which changes from one to the next.
 *
 * Half of what makes the original feel like ten places rather than one is that
 * the brick changes colour: red for the first rooms, blue deeper in, purple
 * further still. The frame around the room and the ledges inside it are
 * usually different colours from each other, which is the other half.
 */
export interface Theme {
  /** The border, and the floor the room stands on. */
  frame: string
  /** The ledges inside it. */
  platform: string
}

export interface Level {
  name: string
  theme?: Theme
  /** Where Dave comes in, in tiles. */
  start: { x: number; y: number }
  /**
   * Rows of tiles, top to bottom. Authored as strings because a level you
   * cannot read in the source is a level you cannot fix.
   */
  rows: readonly string[]
  monsters?: readonly MonsterSpec[]
  path?: Path
}

/**
 * Where a creature is, `t` of the way round its loop.
 *
 * `t` runs 0 to 1 and wraps, so a creature never stops or reverses — it goes
 * round for ever, which is what makes a level learnable.
 */
export function onPath(path: Path, t: number): { x: number; y: number } {
  const points = path.points
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0] }

  const wrapped = ((t % 1) + 1) % 1
  const scaled = wrapped * points.length
  const i = Math.floor(scaled) % points.length
  const j = (i + 1) % points.length
  const f = scaled - Math.floor(scaled)

  return {
    x: points[i].x + (points[j].x - points[i].x) * f,
    y: points[i].y + (points[j].y - points[i].y) * f,
  }
}

/** How long the loop is, in tiles, so speed can mean tiles per second. */
export function pathLength(path: Path): number {
  const points = path.points
  let total = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

/** The tile at a position, treating everything off the map as solid wall. */
export function tileAt(level: Level, x: number, y: number): string {
  if (y < 0 || y >= level.rows.length) return TILE.BRICK
  const row = level.rows[y]
  if (x < 0 || x >= row.length) return TILE.BRICK
  return row[x]
}

/** A level with every row padded to the full width, so lookups never fall off. */
export function normalise(level: Level): Level {
  return {
    ...level,
    rows: level.rows.map((row) => row.padEnd(LEVEL_TILES_X, TILE.EMPTY).slice(0, LEVEL_TILES_X)),
  }
}
