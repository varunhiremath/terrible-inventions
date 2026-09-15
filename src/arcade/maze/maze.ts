/**
 * The maze for Papa Panic.
 *
 * Authored as a left half and mirrored, so it is symmetric and correctly sized
 * by construction. Hand-drawing twenty-one rows of nineteen characters is how
 * you end up with one row a character short and a corner sealed off — the tests
 * below flood-fill the whole thing rather than trusting the drawing.
 *
 * There is deliberately no ghost house. The pen, its exit rules and the
 * eyes-return-home behaviour are a lot of machinery for something an eight year
 * old will not notice; eaten ghosts simply reappear at the centre after a pause.
 */

export const TILE = {
  WALL: '#',
  DOT: '.',
  /** Makes the ghosts edible for a while. One in each corner. */
  POWER: 'O',
  EMPTY: ' ',
} as const

/** Columns 0..9; column 9 is the centre and is not mirrored. */
const LEFT_HALF = [
  '##########',
  '#........#',
  '#O##.###.#',
  '#..#.....#',
  '##.#.###.#',
  '#....#...#',
  '#.####.###',
  '#......#..',
  '####.#.#.#',
  '#....#....',
  '..........',
  '#....#....',
  '####.#.#.#',
  '#......#..',
  '#.####.###',
  '#....#...#',
  '##.#.###.#',
  '#..#.....#',
  '#O##.###.#',
  '#........#',
  '##########',
] as const

function mirror(): string[] {
  return LEFT_HALF.map((row) => {
    const left = [...row]
    const right = left.slice(0, -1).reverse()
    return [...left, ...right].join('')
  })
}

export const MAZE: readonly string[] = mirror()
export const WIDTH = MAZE[0].length
export const HEIGHT = MAZE.length

export interface Cell {
  x: number
  y: number
}

/** The middle row runs off both edges; walking out of one side comes back the other. */
export const TUNNEL_ROW = 10

/** Below the middle, so the first move is a real choice rather than a corridor. */
export const PLAYER_START: Cell = { x: 9, y: 13 }

/** All four start clustered in the middle and fan out from there. */
export const GHOST_STARTS: readonly Cell[] = [
  { x: 9, y: 9 },
  { x: 8, y: 9 },
  { x: 10, y: 9 },
  { x: 9, y: 11 },
]

/** Where a ghost reappears after being eaten. */
export const GHOST_RESPAWN: Cell = { x: 9, y: 9 }

/** Wraps x through the tunnel; y never wraps. */
export function wrapCell({ x, y }: Cell): Cell {
  return { x: ((x % WIDTH) + WIDTH) % WIDTH, y }
}

export function tileAt(cell: Cell): string {
  const { x, y } = wrapCell(cell)
  if (y < 0 || y >= HEIGHT) return TILE.WALL
  return MAZE[y][x]
}

export function isWall(cell: Cell): boolean {
  return tileAt(cell) === TILE.WALL
}

/** Every tile that starts with something to eat on it. */
export function edibleCells(): { dots: Cell[]; power: Cell[] } {
  const dots: Cell[] = []
  const power: Cell[] = []

  MAZE.forEach((row, y) =>
    [...row].forEach((tile, x) => {
      if (tile === TILE.DOT) dots.push({ x, y })
      if (tile === TILE.POWER) power.push({ x, y })
    }),
  )

  return { dots, power }
}

export function key({ x, y }: Cell): string {
  return `${x},${y}`
}

/** Open neighbours, following the tunnel round. */
export function neighbours(cell: Cell): Cell[] {
  return [
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x + 1, y: cell.y },
  ]
    .map(wrapCell)
    .filter((n) => !isWall(n))
}

/** Every cell you can walk to from a starting point. */
export function reachableFrom(start: Cell): Set<string> {
  const seen = new Set<string>()
  const queue: Cell[] = [start]

  while (queue.length > 0) {
    const cell = queue.shift()!
    const id = key(cell)
    if (seen.has(id) || isWall(cell)) continue
    seen.add(id)
    queue.push(...neighbours(cell))
  }

  return seen
}
