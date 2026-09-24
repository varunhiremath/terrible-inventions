import { describe, expect, it } from 'vitest'
import { ROOM_COLS, ROOM_ROWS, viewAt, type Level } from './level'

describe('the camera', () => {
  /*
   * Reported from a phone held sideways: "when I reach the edge of the screen
   * it doesn't show me what's ahead... I'm on the right edge not visible at
   * all". The camera snapped to fixed rooms, so walking to the edge of one
   * meant walking at a wall of black.
   */
  const wide: Level = {
    name: 'wide',
    rows: ['#'.repeat(40), '#'.repeat(40), '#'.repeat(40), '#'.repeat(40), '#'.repeat(40), '#'.repeat(40)],
    start: { col: 1, row: 1, facing: 1 as const },
  }

  const sees = (view: { col: number }, col: number) =>
    col >= view.col && col <= view.col + ROOM_COLS - 1

  it('keeps him on screen wherever he is', () => {
    // Up to the last column, not past it: the outermost column of every level
    // is wall, so there is no standing at 39.5 on a level 40 wide.
    for (let col = 0; col <= 39; col += 0.5) {
      expect(sees(viewAt(wide, col, 1), col), `at ${col}`).toBe(true)
    }
  })

  it('shows him what is ahead, not just what is behind', () => {
    // The whole complaint: standing anywhere in the middle of a level, there
    // has to be floor visible in front of him.
    for (let col = 6; col < 34; col += 0.5) {
      const view = viewAt(wide, col, 1)
      expect(view.col + ROOM_COLS - 1 - col, `at ${col}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps him in the middle while there is room either side', () => {
    const view = viewAt(wide, 20, 1)
    const left = 20 - view.col
    const right = view.col + ROOM_COLS - 1 - 20
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
  })

  it('stops at the edges rather than scrolling into nothing', () => {
    expect(viewAt(wide, 0, 1).col).toBe(0)
    expect(viewAt(wide, 1, 1).col).toBe(0)
    expect(viewAt(wide, 39, 1).col).toBe(40 - ROOM_COLS)
  })

  it('moves smoothly rather than a tile at a time', () => {
    // Snapping a whole tile at 127 pixels a step reads as a judder.
    const a = viewAt(wide, 20, 1).col
    const b = viewAt(wide, 20.25, 1).col
    expect(b).toBeGreaterThan(a)
    expect(b - a).toBeCloseTo(0.25, 6)
  })

  it('never scrolls past the top or bottom', () => {
    for (let row = 0; row < 6; row++) {
      const view = viewAt(wide, 5, row)
      expect(view.row, `row ${row}`).toBeGreaterThanOrEqual(0)
      expect(view.row + ROOM_ROWS, `row ${row}`).toBeLessThanOrEqual(wide.rows.length)
    }
  })

  it('keeps his own floor on screen', () => {
    for (let row = 0; row < 6; row++) {
      const view = viewAt(wide, 5, row)
      expect(row, `row ${row}`).toBeGreaterThanOrEqual(view.row)
      expect(row, `row ${row}`).toBeLessThan(view.row + ROOM_ROWS)
    }
  })

  it('copes with a level narrower than the screen', () => {
    const narrow: Level = {
      name: 'narrow',
      rows: ['####', '####', '####'],
      start: { col: 1, row: 1, facing: 1 as const },
    }
    expect(viewAt(narrow, 2, 1).col).toBe(0)
  })
})
