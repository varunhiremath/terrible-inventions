/** A player's working-out. `null` where a machine has not been placed yet. */
export type BoardRow = (number | null)[]

export function emptyBoard(categoryCount: number, subjectCount: number): BoardRow[] {
  return Array.from({ length: categoryCount }, () => new Array<number | null>(subjectCount).fill(null))
}

/**
 * Assigns a value to one machine within one category.
 *
 * Each value belongs to exactly one machine, so claiming it takes it off
 * whoever held it. Without this the board can reach states the puzzle does not
 * allow — two machines both red — and the pair end up debating the interface
 * instead of the puzzle.
 */
export function placeValue(row: BoardRow, subject: number, value: number): BoardRow {
  return row.map((current, s) => {
    if (s === subject) return value
    return current === value ? null : current
  })
}

export function isComplete(board: readonly BoardRow[]): boolean {
  return board.every((row) => row.every((v) => v !== null))
}

export function matchesSolution(board: readonly BoardRow[], solution: readonly number[][]): boolean {
  return board.every((row, c) => row.every((v, s) => v === solution[c][s]))
}
