/**
 * The world, as tiles.
 *
 * Sixteen pixels to a tile and everything measured in tiles per second, the
 * same as the other two platformers here, so the numbers in `physics.ts` can
 * be read as distances on the screen rather than as pixels at some frame rate.
 *
 * A level is one long strip. There is no vertical scrolling: the screen is
 * fifteen tiles tall and so is the level, which is what makes a jump readable
 * — you can always see the thing you are jumping onto.
 */

export const TILE = {
  SKY: ' ',
  /** Packed earth with a grass top. The floor of the world. */
  GROUND: '#',
  /** Brick. Bump it small and it shakes; bump it big and it breaks. */
  BRICK: 'B',
  /** A question block: one bump, one prize, then it is spent. */
  QUERY: '?',
  /** Same, but it holds a mushroom rather than a coin. */
  QUERY_UP: '!',
  /** Solid block, never breaks, never gives anything. */
  SOLID: 'S',
  /** The lip of a pipe, two tiles wide. Left half and right half. */
  PIPE_TOP_L: '[',
  PIPE_TOP_R: ']',
  PIPE_L: '(',
  PIPE_R: ')',
  COIN: 'o',
  /** The flagpole at the end, and the block it stands on. */
  POLE: '|',
  BASE: '=',
  /** Where a goomba starts. Not a tile once the level is loaded. */
  GOOMBA: 'g',
  /** Where a koopa starts. */
  KOOPA: 'k',
} as const

export type Tile = (typeof TILE)[keyof typeof TILE]

/** Tiles you cannot walk or fall through. */
const SOLID = new Set<string>([
  TILE.GROUND, TILE.BRICK, TILE.QUERY, TILE.QUERY_UP, TILE.SOLID,
  TILE.PIPE_TOP_L, TILE.PIPE_TOP_R, TILE.PIPE_L, TILE.PIPE_R, TILE.BASE,
])

/** Tiles a bump from below does something to. */
const BUMPABLE = new Set<string>([TILE.BRICK, TILE.QUERY, TILE.QUERY_UP])

/** Where the enemies start out, which is written into the map for convenience. */
const SPAWNS = new Set<string>([TILE.GOOMBA, TILE.KOOPA])

export const ROWS = 15
/**
 * The topmost row the screen shows.
 *
 * The level is fifteen rows because that is the shape the genre uses, but the
 * top four are always empty sky — nothing is ever built up there, and a jump
 * from the floor cannot reach it. Showing them anyway made every tile
 * two-thirds the size it could be and the player a speck. So the screen shows
 * rows four down, and the sky above is drawn as sky rather than as tiles.
 */
export const VIEW_TOP = 4
export const VIEW_ROWS = ROWS - VIEW_TOP

export interface Spawn {
  col: number
  row: number
  kind: 'goomba' | 'koopa'
}

export interface Level {
  name: string
  /** Rows of tiles, sky first. Every row is the same length. */
  rows: string[]
  spawns: Spawn[]
  /** Which column the flagpole is in, for knowing when the level is done. */
  pole: number
}

export function isSolid(tile: string): boolean {
  return SOLID.has(tile)
}

export function isBumpable(tile: string): boolean {
  return BUMPABLE.has(tile)
}

export function tileAt(level: Level, col: number, row: number): string {
  if (row < 0) return TILE.SKY
  // Below the world is a hole you fall down for ever, which is the point.
  if (row >= level.rows.length) return TILE.SKY
  const line = level.rows[row]
  if (col < 0) return TILE.SOLID
  if (col >= line.length) return TILE.SKY
  return line[col]
}

export function solidAt(level: Level, col: number, row: number): boolean {
  return isSolid(tileAt(level, col, row))
}

export function levelCols(level: Level): number {
  return Math.max(...level.rows.map((r) => r.length))
}

/**
 * Reads a written map into a level, lifting the enemies out of it.
 *
 * Writing where a goomba starts into the map itself keeps a level to one
 * picture you can read, rather than a picture and a list of coordinates that
 * have to be kept in step with it by hand.
 */
export function readLevel(name: string, rows: readonly string[]): Level {
  const width = Math.max(...rows.map((r) => r.length))
  const padded = rows.map((r) => r.padEnd(width, TILE.SKY))
  const spawns: Spawn[] = []

  const clean = padded.map((row, r) =>
    [...row]
      .map((tile, c) => {
        if (!SPAWNS.has(tile)) return tile
        spawns.push({ col: c, row: r, kind: tile === TILE.KOOPA ? 'koopa' : 'goomba' })
        return TILE.SKY
      })
      .join(''),
  )

  let pole = width - 2
  clean.forEach((row) => {
    const at = row.indexOf(TILE.POLE)
    if (at >= 0) pole = at
  })

  return { name, rows: clean, spawns, pole }
}

/** The ground under a column, for putting things on top of it. */
export function groundUnder(level: Level, col: number, from = 0): number {
  for (let row = from; row < level.rows.length; row++) {
    if (solidAt(level, col, row)) return row
  }
  return level.rows.length
}
