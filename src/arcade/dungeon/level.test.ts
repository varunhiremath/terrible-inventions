import { describe, expect, it } from 'vitest'
import { ROOM_COLS, ROOM_ROWS, viewAt, type Level } from './level'

describe('the camera', () => {
  /*
   * Reported from a phone held sideways: "when I reach the edge of the screen
   * it doesn't show me what's ahead... I'm on the right edge not visible at
   * all". The camera snapped to fixed rooms, so walking to the edge of one
   * meant walking at a wall of black.
   *
   * The band rule itself is proved in `src/camera.test.ts`. What matters here
   * is that the dungeon is wired to it: the right width, the right world, and
   * floors that move in whole steps.
   */
  const wide: Level = {
    name: 'wide',
    rows: ['#'.repeat(40), '#'.repeat(40), '#'.repeat(40), '#'.repeat(40), '#'.repeat(40), '#'.repeat(40)],
    start: { col: 1, row: 1, facing: 1 as const },
  }

  /** Walks him from one end to the other, carrying the camera as the game does. */
  const walk = (level: Level, to: number, row = 1) => {
    let camera = 0
    for (let col = 0; col <= to; col += 0.25) camera = viewAt(level, camera, col, row).col
    return camera
  }

  it('keeps him on screen the whole way along', () => {
    let camera = 0
    for (let col = 0; col <= 39; col += 0.25) {
      camera = viewAt(wide, camera, col, 1).col
      expect(col, `at ${col}`).toBeGreaterThanOrEqual(camera)
      expect(col, `at ${col}`).toBeLessThanOrEqual(camera + ROOM_COLS)
    }
  })

  it('never lets him get to the edge in the middle of a level', () => {
    // A fifth of the screen kept clear either side, which was the ask.
    let camera = 0
    for (let col = 0; col <= 39; col += 0.25) {
      camera = viewAt(wide, camera, col, 1).col
      const clear = camera > 0 && camera + ROOM_COLS < 40
      if (!clear) continue
      expect(col - camera, `at ${col}`).toBeGreaterThanOrEqual(ROOM_COLS * 0.2 - 1e-9)
      expect(camera + ROOM_COLS - col, `at ${col}`).toBeGreaterThanOrEqual(ROOM_COLS * 0.2 - 1e-9)
    }
  })

  it('follows him back the other way', () => {
    const far = walk(wide, 30)
    expect(viewAt(wide, far, 12, 1).col).toBeLessThan(far)
  })

  it('holds still while he moves about inside the band', () => {
    // Walking right leaves him pressed against the right edge of the band, so
    // the next step right moves the view with him — that is the point of it.
    // The dead zone is what happens when he turns round and comes back.
    const settled = walk(wide, 20)
    expect(viewAt(wide, settled, 19.5, 1).col).toBe(settled)
    expect(viewAt(wide, settled, 17, 1).col).toBe(settled)
  })

  it('stops at the edges rather than scrolling into nothing', () => {
    expect(viewAt(wide, 0, 0, 1).col).toBe(0)
    expect(walk(wide, 39)).toBe(40 - ROOM_COLS)
  })

  it('never scrolls past the top or bottom', () => {
    for (let row = 0; row < 6; row++) {
      const view = viewAt(wide, 0, 5, row)
      expect(view.row, `row ${row}`).toBeGreaterThanOrEqual(0)
      expect(view.row + ROOM_ROWS, `row ${row}`).toBeLessThanOrEqual(wide.rows.length)
    }
  })

  it('keeps his own floor on screen', () => {
    for (let row = 0; row < 6; row++) {
      const view = viewAt(wide, 0, 5, row)
      expect(row, `row ${row}`).toBeGreaterThanOrEqual(view.row)
      expect(row, `row ${row}`).toBeLessThan(view.row + ROOM_ROWS)
    }
  })

  it('moves floors in whole steps', () => {
    for (let row = 0; row < 6; row++) {
      expect(Number.isInteger(viewAt(wide, 0, 5, row).row), `row ${row}`).toBe(true)
    }
  })

  it('copes with a level narrower than the screen', () => {
    const narrow: Level = {
      name: 'narrow',
      rows: ['####', '####', '####'],
      start: { col: 1, row: 1, facing: 1 as const },
    }
    expect(viewAt(narrow, 0, 2, 1).col).toBe(0)
  })
})
