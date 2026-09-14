import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { tier } from './util'

/**
 * Counting routes through a grid, moving only right or down.
 *
 * Chosen because it needs no arithmetic to state and has no ceiling. A player
 * who starts by drawing every route eventually notices he can add the number of
 * ways into each square instead — which is Pascal's triangle, discovered rather
 * than taught. Blocked squares then break any formula he memorised.
 */

const BOUNDS = [500, 900, 1400, 1900] as const

interface Grid {
  cols: number
  rows: number
  /** `[row, col]` pairs the machine cannot pass through. */
  blocked: [number, number][]
}

export const pathCount: Generator = {
  id: 'path-count',
  name: 'Short Circuit',
  blurb: 'How many ways through? Right and down only.',
  minRating: 500,
  maxRating: 2800,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const t = tier(rating, BOUNDS)

    const size = [
      () => ({ cols: rng.int(2, 3), rows: rng.int(2, 3) }),
      () => ({ cols: rng.int(3, 4), rows: rng.int(3, 4) }),
      () => ({ cols: rng.int(4, 5), rows: rng.int(3, 5) }),
      () => ({ cols: rng.int(5, 7), rows: rng.int(4, 6) }),
    ][t]()

    const wantBlocks = [0, 0, rng.int(1, 2), rng.int(2, 4)][t]
    const grid = withBlocks(size.cols, size.rows, wantBlocks, rng)
    const total = countPaths(grid)

    return {
      id: `path-count:${seed}`,
      kind: 'path-count',
      rating,
      seed,
      prompt:
        grid.blocked.length > 0
          ? `{papa}'s delivery bot can only move right or down, and the dark squares are broken. How many different routes get it from the top-left corner to the bottom-right?`
          : `{papa}'s delivery bot can only move right or down. How many different routes get it from the top-left corner to the bottom-right?`,
      answer: { type: 'number', value: total },
      hints: [
        'There is exactly one way to reach any square in the top row, and one way to reach any square in the left column.',
        'For every other square: the ways in are the ways to the square above plus the ways to the square on its left.',
        grid.blocked.length > 0 ? 'A broken square has zero ways in, and passes zero on.' : 'Fill in the whole grid square by square and read off the corner.',
      ],
      explain:
        'Write the number of routes into each square. The top row and left column are all 1s, and every other square is the square above plus the square to its left. The bottom-right corner is the answer.',
      data: grid,
    }
  },
}

/** Adds blocked squares one at a time, keeping at least one route alive. */
function withBlocks(
  cols: number,
  rows: number,
  want: number,
  rng: ReturnType<typeof makeRng>,
): Grid {
  const grid: Grid = { cols, rows, blocked: [] }

  for (let attempt = 0; attempt < want * 25 && grid.blocked.length < want; attempt++) {
    const r = rng.int(0, rows - 1)
    const c = rng.int(0, cols - 1)
    const isCorner = (r === 0 && c === 0) || (r === rows - 1 && c === cols - 1)
    if (isCorner) continue
    if (grid.blocked.some(([br, bc]) => br === r && bc === c)) continue

    grid.blocked.push([r, c])
    if (countPaths(grid) === 0) grid.blocked.pop()
  }

  return grid
}

export function countPaths(grid: Grid): number {
  const { cols, rows, blocked } = grid
  const isBlocked = (r: number, c: number) => blocked.some(([br, bc]) => br === r && bc === c)

  const ways: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isBlocked(r, c)) continue
      if (r === 0 && c === 0) {
        ways[r][c] = 1
        continue
      }
      ways[r][c] = (r > 0 ? ways[r - 1][c] : 0) + (c > 0 ? ways[r][c - 1] : 0)
    }
  }

  return ways[rows - 1][cols - 1]
}
