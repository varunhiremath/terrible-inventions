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

/**
 * The full-sized board, and the last one you reach.
 *
 * Columns 0..13; column 13 is the centre spine and is not mirrored, so the
 * maze comes out twenty-seven wide with single-tile corridors down the middle.
 *
 * Twenty-seven by thirty-one, which is the shape of the arcade original and
 * very nearly the shape of a phone held upright. The first maze here was
 * nineteen by twenty-one — almost square, which left a band of nothing above
 * and below it on every phone it was played on.
 *
 * The block in the middle is the chasers' room. It has no door and no rules
 * about leaving: the pen, its timers and the eyes-go-home behaviour are a lot
 * of machinery for something an eight year old will not notice. It is there
 * because the shape of it is half of what makes a maze look like this one.
 */
const FULL_HALF = [
  '##############',
  '#............#',
  '#.####.#####.#',
  '#O####.#####.#',
  '#.####.#####.#',
  '#.............',
  '#.####.##.####',
  '#.####.##.####',
  '#......##....#',
  '######.#####.#',
  '######.#####.#',
  '######.##....#',
  '######.##.#..#',
  '######.##.#   ',
  '..........#   ',
  '######.##.#   ',
  '######.##.####',
  '######.##....#',
  '######.#####.#',
  '######.#####.#',
  '#......##....#',
  '#.####.##.####',
  '#.####.##.####',
  '#...##........',
  '###.##.##.####',
  '###.##.##.####',
  '#O.....##....#',
  '#.##########.#',
  '#.##########.#',
  '#.............',
  '##############',
] as const


/**
 * The first board.
 *
 * Fifteen by seventeen, which is about a third of the area of the full one,
 * with an open corridor straight down the middle and no dead ends worth the
 * name. Opening on the full maze meant learning the layout, the chasers and
 * the controls all at once, and the person it was built for said so: make the
 * first level a little easier.
 *
 * Smaller is also bigger on screen. The board is fitted to the space it has,
 * so fewer tiles means each one is drawn larger, which on a phone is most of
 * what "easier" actually means.
 */
const SMALL_HALF = [
  '########',
  '#O......',
  '#.##.##.',
  '#.##.##.',
  '#.......',
  '#.##.#..',
  '#....#..',
  '##.#.#..',
  '...#.#..',
  '##.#.#..',
  '#....#..',
  '#.##.#..',
  '#.......',
  '#.##.##.',
  '#.##.##.',
  '#O......',
  '########',
] as const

/**
 * The middle board: twenty-one by twenty-three.
 *
 * Between the two in every way — more corridors to learn than the small one,
 * more room to get away in than the full one. The two banks of wall that break
 * the outer ring are the first thing here that can corner you.
 */
const MEDIUM_HALF = [
  '###########',
  '#O.........',
  '#.####.###.',
  '#.####.###.',
  '#..........',
  '#.####.#...',
  '#......#.##',
  '#####..#.##',
  '#####.....#',
  '#####.###..',
  '#.....#....',
  '...##......',
  '#.....#....',
  '#####.###..',
  '#####.....#',
  '#####..#.##',
  '#......#.##',
  '#.####.#...',
  '#..........',
  '#.####.###.',
  '#.####.###.',
  '#O.........',
  '###########',
] as const

function mirror(half: readonly string[]): string[] {
  return half.map((row) => {
    const left = [...row]
    const right = left.slice(0, -1).reverse()
    return [...left, ...right].join('')
  })
}

export interface Cell {
  x: number
  y: number
}

/**
 * Everything that makes one board different from another.
 *
 * This used to be a handful of module-level constants, which worked perfectly
 * while there was exactly one maze and stopped working the moment there were
 * three. A board is passed in now rather than reached for.
 */
export interface Board {
  name: string
  rows: readonly string[]
  width: number
  height: number
  /** This row runs off both edges; walking out of one side comes back the other. */
  tunnelRow: number
  /** Bottom centre, a long way from the chasers. */
  playerStart: Cell
  /** All four start in the middle and fan out from there. */
  ghostStarts: readonly Cell[]
  /** Where a chaser reappears after being eaten. */
  ghostRespawn: Cell
}

function board(
  name: string,
  half: readonly string[],
  tunnelRow: number,
  playerStart: Cell,
  ghostStarts: readonly Cell[],
  ghostRespawn: Cell,
): Board {
  const rows = mirror(half)
  return {
    name,
    rows,
    width: rows[0].length,
    height: rows.length,
    tunnelRow,
    playerStart,
    ghostStarts,
    ghostRespawn,
  }
}

export const SMALL = board(
  'small',
  SMALL_HALF,
  8,
  { x: 7, y: 15 },
  [
    { x: 7, y: 7 },
    { x: 6, y: 8 },
    { x: 8, y: 8 },
    { x: 7, y: 9 },
  ],
  { x: 7, y: 8 },
)

export const MEDIUM = board(
  'medium',
  MEDIUM_HALF,
  11,
  { x: 10, y: 21 },
  [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 11, y: 10 },
    { x: 10, y: 12 },
  ],
  { x: 10, y: 10 },
)

/*
 * The first attempt at a start put the player four steps from the nearest
 * chaser, which meant dying before the first dot. Distance is not a detail
 * here — it is the whole opening.
 */
export const FULL = board(
  'full',
  FULL_HALF,
  14,
  { x: 13, y: 23 },
  [
    { x: 13, y: 13 },
    { x: 12, y: 14 },
    { x: 14, y: 14 },
    { x: 13, y: 15 },
  ],
  { x: 13, y: 14 },
)

export const BOARDS: readonly Board[] = [SMALL, MEDIUM, FULL]

/**
 * Which board a level is played on.
 *
 * Two goes on each of the first two, then the full one for good. Slow enough
 * that each board is learned rather than glimpsed, and it still arrives at the
 * real maze by level five.
 */
export function boardFor(level: number): Board {
  if (level <= 2) return SMALL
  if (level <= 4) return MEDIUM
  return FULL
}

/** Wraps x through the tunnel; y never wraps. */
export function wrapCell(board: Board, { x, y }: Cell): Cell {
  return { x: ((x % board.width) + board.width) % board.width, y }
}

export function tileAt(board: Board, cell: Cell): string {
  const { x, y } = wrapCell(board, cell)
  if (y < 0 || y >= board.height) return TILE.WALL
  return board.rows[y][x]
}

export function isWall(board: Board, cell: Cell): boolean {
  return tileAt(board, cell) === TILE.WALL
}

/** Every tile that starts with something to eat on it. */
export function edibleCells(board: Board): { dots: Cell[]; power: Cell[] } {
  const dots: Cell[] = []
  const power: Cell[] = []

  board.rows.forEach((row, y) =>
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
export function neighbours(board: Board, cell: Cell): Cell[] {
  return [
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x + 1, y: cell.y },
  ]
    .map((n) => wrapCell(board, n))
    .filter((n) => !isWall(board, n))
}

/** Every cell you can walk to from a starting point. */
export function reachableFrom(board: Board, start: Cell): Set<string> {
  const seen = new Set<string>()
  const queue: Cell[] = [start]

  while (queue.length > 0) {
    const cell = queue.shift()!
    const id = key(cell)
    if (seen.has(id) || isWall(board, cell)) continue
    seen.add(id)
    queue.push(...neighbours(board, cell))
  }

  return seen
}
