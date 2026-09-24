/**
 * The dungeon.
 *
 * A grid of tiles where every row is a floor the prince stands on top of.
 * Vertical movement is never continuous — you fall a whole floor or you climb
 * one — which is what makes a level a set of ledges rather than a landscape,
 * and is why its jumps can be learned by heart.
 *
 * The view moves a room at a time rather than following him, which is the
 * other half of how this kind of game reads: you commit to a room, and what is
 * in the next one is something you remember rather than something you can see
 * coming. A room is ten tiles across and three floors tall.
 */

export const ROOM_COLS = 10
export const ROOM_ROWS = 3

export const TILE = {
  /** Nothing to stand on. Walk off the edge and you drop. */
  SPACE: ' ',
  FLOOR: '#',
  /** Solid all the way up: blocks movement rather than supporting it. */
  WALL: 'X',
  /** A pillar. Blocks, and the room is built around it. */
  PILLAR: 'I',
  /** Gives way a moment after it takes weight. */
  LOOSE: '~',
  SPIKES: '^',
  /** Blades that open and shut. Walk through at the wrong moment and that is that. */
  CHOMPER: 'C',
  /** Shut until a plate is stood on. */
  GATE: '|',
  /** Stand on it and every gate on the level opens for a while. */
  BUTTON: '.',
  POTION_HEAL: 'h',
  POTION_LIFE: 'H',
  POTION_POISON: 'p',
  /** The sword, which is on the first level and nowhere else. */
  SWORD: 's',
  EXIT: 'E',
} as const

export type Tile = (typeof TILE)[keyof typeof TILE]

/** How long a plate holds the gates open, in animation frames. */
export const GATE_OPEN_FRAMES = 150

export interface GuardSpec {
  col: number
  row: number
  facing: 1 | -1
  /** 0 is a doorman, 4 is the vizier's best. Decides parry and timing. */
  skill: number
  /** Which set of robes. */
  colour: 'guard' | 'fat' | 'skeleton' | 'shadow' | 'vizier'
}

export interface Level {
  name: string
  /** Rows of tiles, top floor first. Width must be a whole number of rooms. */
  rows: readonly string[]
  start: { col: number; row: number; facing: 1 | -1 }
  guards?: readonly GuardSpec[]
  /** Torch positions, purely to look at. */
  torches?: readonly { col: number; row: number }[]
  /** Which stone the walls are cut from. */
  palette?: 'dungeon' | 'palace'
}

/** Tiles you can stand on top of. */
const SOLID = new Set<string>([
  TILE.FLOOR, TILE.LOOSE, TILE.SPIKES, TILE.BUTTON, TILE.EXIT, TILE.WALL,
  TILE.PILLAR, TILE.POTION_HEAL, TILE.POTION_LIFE, TILE.POTION_POISON,
  TILE.SWORD, TILE.CHOMPER, TILE.GATE,
])

/** Tiles that stop you walking through them. */
const BLOCKING = new Set<string>([TILE.WALL, TILE.PILLAR])

export function isSolid(tile: string): boolean {
  return SOLID.has(tile)
}

export function blocksMovement(tile: string, gateOpen: boolean): boolean {
  if (BLOCKING.has(tile)) return true
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

export function standable(level: Level, col: number, row: number): boolean {
  return isSolid(floorUnder(level, col, row))
}

/**
 * Whether a floor is one you could climb onto and then stand on.
 *
 * Not the same question as `standable`. A wall is solid, so it is standable in
 * the sense that it holds you up — but a wall over your head is the ceiling,
 * and the first version of the climb happily started one into solid rock.
 */
export function climbable(level: Level, col: number, row: number): boolean {
  const tile = floorUnder(level, col, row)
  return isSolid(tile) && !BLOCKING.has(tile)
}

export function levelCols(level: Level): number {
  return Math.max(...level.rows.map((r) => r.length))
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))

/**
 * Where the camera sits: the top-left corner of what is on screen.
 *
 * It used to snap to fixed rooms, on the reasoning that scrolling shows you a
 * trap before you have had to decide about it. That reasoning was about a
 * screen the shape of the original's. Held sideways, a phone shows one room
 * and nothing else, and walking to the right-hand edge of it meant walking at
 * a wall of black with no way to know what was on the other side. There is no
 * decision to spoil if you cannot see anything at all.
 *
 * So it follows him now, keeping him in the middle, and stops at the edges of
 * the level rather than scrolling past them into nothing. `col` is deliberately
 * fractional: the room slides under him rather than jumping a tile at a time.
 */
export function viewAt(level: Level, col: number, row: number): { col: number; row: number } {
  const lastCol = Math.max(0, levelCols(level) - ROOM_COLS)
  const lastRow = Math.max(0, level.rows.length - ROOM_ROWS)
  return {
    col: clamp(col - (ROOM_COLS - 1) / 2, 0, lastCol),
    // Floors are whole things and half a floor of scroll helps nobody, so the
    // vertical stays in steps: his floor, one above it, one below.
    row: clamp(Math.round(row) - 1, 0, lastRow),
  }
}

/** Every tile of a kind, for wiring up gates and counting potions. */
export function findTiles(level: Level, kind: string): { col: number; row: number }[] {
  const found: { col: number; row: number }[] = []
  level.rows.forEach((line, row) =>
    [...line].forEach((tile, col) => {
      if (tile === kind) found.push({ col, row })
    }),
  )
  return found
}
