/**
 * The dungeon.
 *
 * A grid of tiles where each row is a floor the prince stands on top of.
 * Vertical movement is never continuous — you fall a whole floor or you climb
 * one — which is what makes the level a set of ledges rather than a landscape,
 * and is why the original's jumps can be learned by heart.
 */

export const TILE = {
  /** Nothing to stand on. Walk off the edge and you drop. */
  SPACE: ' ',
  FLOOR: '#',
  /** Solid all the way up: blocks movement rather than supporting it. */
  WALL: 'X',
  /** Gives way a moment after it takes weight. */
  LOOSE: '~',
  SPIKES: '^',
  /** Shut until its button is pressed. */
  GATE: '|',
  BUTTON: '.',
  POTION_HEAL: 'h',
  POTION_LIFE: 'H',
  POTION_POISON: 'p',
  EXIT: 'E',
  START: 'S',
} as const

export type Tile = (typeof TILE)[keyof typeof TILE]

export interface Level {
  name: string
  rows: string[]
  /** Seconds on the clock when this level begins. Shared across the whole run. */
  start: { col: number; row: number }
}

/** Tiles you can stand on top of. */
export function isSolid(tile: string): boolean {
  return tile === TILE.FLOOR || tile === TILE.LOOSE || tile === TILE.SPIKES ||
    tile === TILE.BUTTON || tile === TILE.EXIT || tile === TILE.WALL ||
    tile === TILE.POTION_HEAL || tile === TILE.POTION_LIFE || tile === TILE.POTION_POISON ||
    tile === TILE.START
}

/** Tiles that stop you walking through them. */
export function blocksMovement(tile: string, gateOpen: boolean): boolean {
  if (tile === TILE.WALL) return true
  if (tile === TILE.GATE) return !gateOpen
  return false
}

export function tileAt(level: Level, col: number, row: number): string {
  if (row < 0 || row >= level.rows.length) return TILE.SPACE
  const line = level.rows[row]
  if (col < 0 || col >= line.length) return TILE.WALL
  return line[col]
}

/** What is under the prince's feet at a given floor. */
export function floorUnder(level: Level, col: number, row: number): string {
  return tileAt(level, col, row)
}

/** Whether there is ground to stand on at this spot. */
export function standable(level: Level, col: number, row: number): boolean {
  return isSolid(floorUnder(level, col, row))
}

export const LEVEL_ONE: Level = {
  name: 'The Dungeon',
  // Each row is a floor. The prince stands on top of the tiles in his row.
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'X##S###  ###h##   ####EX',
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'X##.##   ##~~##  ^^####X',
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'X####  ####   ####  ###X',
    'XXXXXXXXXXXXXXXXXXXXXXXX',
  ],
  start: { col: 3, row: 1 },
}
