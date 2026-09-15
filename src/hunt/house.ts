import type { Point } from '../world/map'

/**
 * The house, built rather than drawn.
 *
 * Ten numbered rooms off a central landing, five above and five below. Laid out
 * programmatically because hand-drawing seventeen rows of tiles is how you end
 * up with one row a character short and a room silently sealed off.
 *
 * Only some rooms are in play at the start. Each catch opens another, which
 * makes the house bigger *and* the maths richer: more rooms means a bigger
 * number to wrap around.
 */

export const ROOM_NAMES = [
  'Kitchen',
  'Front room',
  'Bathroom',
  'Landing cupboard',
  'Loft',
  'Cellar',
  'Playroom',
  'Bedroom',
  'Shed',
  'Garage',
] as const

const ROOM_W = 7
const ROOM_H = 5
const CORRIDOR_H = 3
const COLUMNS = 5

/** One hue per room, so a number is also a colour you can remember. */
export const ROOM_COLOURS = [
  '#f08c8c', '#f3b95c', '#e8dd5c', '#8fd97a', '#6fd3c8',
  '#7bb0ef', '#a08ce8', '#e18ad4', '#e8a86a', '#a8cb7e',
] as const

export interface HouseRoom {
  number: number
  name: string
  /** Where the trap is set, and where the creature hides. */
  centre: Point
  bounds: { x0: number; x1: number; y0: number; y1: number }
}

function build(): { rows: string[]; rooms: HouseRoom[]; spawn: Point } {
  const width = COLUMNS * (ROOM_W + 1) + 1
  const height = ROOM_H * 2 + CORRIDOR_H + 4
  const grid: string[][] = Array.from({ length: height }, () => new Array(width).fill('#'))

  const rooms: HouseRoom[] = []
  const topY0 = 1
  const corridorY0 = topY0 + ROOM_H + 1
  const bottomY0 = corridorY0 + CORRIDOR_H + 1

  for (let column = 0; column < COLUMNS; column++) {
    const x0 = 1 + column * (ROOM_W + 1)
    const x1 = x0 + ROOM_W - 1
    const doorX = x0 + Math.floor(ROOM_W / 2)

    for (const [index, y0] of [topY0, bottomY0].entries()) {
      const y1 = y0 + ROOM_H - 1
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = '.'

      // The doorway onto the landing.
      grid[index === 0 ? y1 + 1 : y0 - 1][doorX] = '.'

      rooms.push({
        number: column + 1 + index * COLUMNS,
        name: ROOM_NAMES[column + index * COLUMNS],
        centre: { x: doorX, y: y0 + Math.floor(ROOM_H / 2) },
        bounds: { x0, x1, y0, y1 },
      })
    }
  }

  for (let y = corridorY0; y < corridorY0 + CORRIDOR_H; y++) {
    for (let x = 1; x < width - 1; x++) grid[y][x] = '.'
  }

  rooms.sort((a, b) => a.number - b.number)

  return {
    rows: grid.map((row) => row.join('')),
    rooms,
    spawn: { x: Math.floor(width / 2), y: corridorY0 + 1 },
  }
}

export const HOUSE = build()

export function roomByNumber(n: number): HouseRoom | undefined {
  return HOUSE.rooms.find((r) => r.number === n)
}

/** Which room a point is inside, or undefined for the landing. */
export function colourAt(x: number, y: number): string | undefined {
  const room = roomContaining({ x, y })
  return room ? ROOM_COLOURS[(room.number - 1) % ROOM_COLOURS.length] : undefined
}

export function roomContaining({ x, y }: Point): HouseRoom | undefined {
  return HOUSE.rooms.find(
    (r) => x >= r.bounds.x0 && x <= r.bounds.x1 && y >= r.bounds.y0 && y <= r.bounds.y1,
  )
}
