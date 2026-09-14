/**
 * The east wing of the workshop.
 *
 * One continuous map rather than separate rooms with loading between them, so
 * walking from the kitchen to the garage feels like walking, not navigating a
 * menu. Three rooms open onto a corridor; the door at the far end stays shut
 * until every machine in the wing is working again.
 */

export const TILE = {
  WALL: '#',
  FLOOR: '.',
  /** Benches and crates: solid, but they break up the floor. */
  BENCH: '=',
  /** Shut until the wing is finished. The reason to come back. */
  LOCKED: 'D',
} as const

// x0 wall | kitchen 1-13 | wall 14,15 | garage 16-28 | wall 29,30 | workshop 31-42 | wall 43
export const MAP: readonly string[] = [
  '############################################',
  '#.............##.............##............#',
  '#..==.........##....==.......##......==....#',
  '#.............##.............##............#',
  '#.............##.............##............#',
  '#.........==..##.......==....##...==.......#',
  '#.............##.............##............#',
  '#.............##.............##............#',
  '#######.##############.#############.#######',
  '#..........................................#',
  '#..........................................D',
  '#..........................................#',
  '############################################',
]

export interface Point {
  x: number
  y: number
}

export const ROOMS: { name: string; at: Point }[] = [
  { name: 'Kitchen', at: { x: 7, y: 1 } },
  { name: 'Garage', at: { x: 22, y: 1 } },
  { name: 'Back room', at: { x: 36, y: 1 } },
]

export const SPAWN: Point = { x: 21, y: 10 }

export const mapWidth = Math.max(...MAP.map((row) => row.length))
export const mapHeight = MAP.length

export function tileAt({ x, y }: Point): string {
  if (y < 0 || y >= MAP.length) return TILE.WALL
  const row = MAP[y]
  if (x < 0 || x >= row.length) return TILE.WALL
  return row[x]
}

/** Terrain only. Characters standing in the way are handled separately. */
export function isSolid(point: Point, unlocked: boolean): boolean {
  const tile = tileAt(point)
  if (tile === TILE.LOCKED) return !unlocked
  return tile === TILE.WALL || tile === TILE.BENCH
}

export function roomAt({ x, y }: Point): string {
  if (y >= 9) return 'Corridor'
  if (x <= 13) return 'Kitchen'
  if (x <= 28) return 'Garage'
  return 'Back room'
}
