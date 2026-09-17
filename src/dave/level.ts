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
  /** The six pickups, cheapest first. */
  GUMBALL: '1',
  SHOE: '2',
  COIN: '3',
  RING: '4',
  WAND: '5',
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
  [TILE.GUMBALL]: 15,
  [TILE.SHOE]: 50,
  [TILE.COIN]: 100,
  [TILE.RING]: 200,
  [TILE.WAND]: 250,
  [TILE.CROWN]: 500,
  [TILE.TROPHY]: 1000,
  [TILE.DOOR]: 2000,
}

const SOLID = new Set<string>([TILE.BRICK])
const DEADLY = new Set<string>([TILE.FIRE, TILE.WATER, TILE.TENTACLE])
const PICKUPS = new Set<string>([
  TILE.GUMBALL,
  TILE.SHOE,
  TILE.COIN,
  TILE.RING,
  TILE.WAND,
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

export interface Level {
  name: string
  /** Where Dave comes in, in tiles. */
  start: { x: number; y: number }
  /**
   * Rows of tiles, top to bottom. Authored as strings because a level you
   * cannot read in the source is a level you cannot fix.
   */
  rows: readonly string[]
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
