import { describe, expect, it } from 'vitest'
import { MAZE, TILE, WIDTH } from '../arcade/maze/maze'
import { wallBars, type WallBar } from './mazeGeometry'

const T = 0.16
const bars = wallBars(MAZE, TILE.WALL, T)

const bounds = (b: WallBar) => ({
  left: b.x - b.width / 2,
  right: b.x + b.width / 2,
  back: b.z - b.depth / 2,
  front: b.z + b.depth / 2,
})

const openSides = (x: number, y: number) =>
  [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].filter(([dx, dy]) => MAZE[y + dy]?.[x + dx] !== TILE.WALL).length

describe('wall outlines', () => {
  it('draws a line on every wall edge that faces open floor', () => {
    let expected = 0
    MAZE.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        if (tile === TILE.WALL) expected += openSides(x, y)
      }),
    )
    expect(bars).toHaveLength(expected)
  })

  it('draws nothing at all inside a solid block', () => {
    // The whole point: a block is a silhouette, not a filled shape.
    const solid = wallBars(['###', '###', '###'], '#', T)
    const middle = solid.filter((b) => Math.abs(b.x - 1) < 0.3 && Math.abs(b.z - 1) < 0.3)
    expect(middle).toHaveLength(0)
  })

  it('draws a lone wall as a full box of four lines', () => {
    const post = wallBars(['   ', ' # ', '   '], '#', T)
    expect(post).toHaveLength(4)
  })

  it('draws a one-tile-thick run as two parallel lines', () => {
    // This is the original's signature: two bright lines with black between.
    const run = wallBars(['     ', '#####', '     '], '#', T)
    const horizontal = run.filter((b) => b.width > b.depth)
    expect(horizontal).toHaveLength(10)
    const above = horizontal.filter((b) => b.z < 1)
    const below = horizontal.filter((b) => b.z > 1)
    expect(above).toHaveLength(5)
    expect(below).toHaveLength(5)
    expect(below[0].z - above[0].z).toBeCloseTo(1 - T, 9)
  })

  it('keeps the lines thin', () => {
    for (const bar of bars) expect(Math.min(bar.width, bar.depth)).toBeCloseTo(T, 9)
  })

  it('never strays into a corridor', () => {
    // A bar may lap a little way into the *wall* tile next door — that overlap
    // is what closes the corners. What it must never do is reach into open
    // floor, where it would look like a wall that is not there.
    const isWall = (x: number, y: number) => MAZE[y]?.[x] === TILE.WALL
    for (const bar of bars) {
      const b = bounds(bar)
      const cx = Math.round(bar.x)
      const cy = Math.round(bar.z)
      if (b.left < cx - 0.5 - 1e-9) expect(isWall(cx - 1, cy)).toBe(true)
      if (b.right > cx + 0.5 + 1e-9) expect(isWall(cx + 1, cy)).toBe(true)
      if (b.back < cy - 0.5 - 1e-9) expect(isWall(cx, cy - 1)).toBe(true)
      if (b.front > cy + 0.5 + 1e-9) expect(isWall(cx, cy + 1)).toBe(true)
      // And never by more than the line is thick.
      expect(b.left).toBeGreaterThanOrEqual(cx - 0.5 - T / 2 - 1e-9)
      expect(b.right).toBeLessThanOrEqual(cx + 0.5 + T / 2 + 1e-9)
    }
  })

  it('closes its corners', () => {
    // An L of wall. Where the two arms meet, the outer lines have to touch, or
    // the corner shows a notch of background through it.
    const ell = wallBars(['##   ', '#    ', '     '], '#', T)
    const top = ell.find((b) => Math.abs(b.z - (0 - 0.5 + T / 2)) < 1e-9 && Math.abs(b.x) < 0.6)
    const side = ell.find((b) => Math.abs(b.x - (0 - 0.5 + T / 2)) < 1e-9 && Math.abs(b.z) < 0.6)
    expect(top).toBeDefined()
    expect(side).toBeDefined()
    // The horizontal bar reaches the vertical one's far edge and vice versa.
    expect(bounds(top!).left).toBeLessThanOrEqual(bounds(side!).left + 1e-9)
    expect(bounds(side!).back).toBeLessThanOrEqual(bounds(top!).back + 1e-9)
  })

  it('stays symmetric, because the maze is', () => {
    for (const bar of bars) {
      const twin = bars.find(
        (b) =>
          Math.abs(b.x - (WIDTH - 1 - bar.x)) < 1e-9 &&
          Math.abs(b.z - bar.z) < 1e-9 &&
          Math.abs(b.width - bar.width) < 1e-9,
      )
      expect(twin).toBeDefined()
    }
  })

  it('refuses a thickness that would erase or flood the maze', () => {
    expect(wallBars([' # '], '#', 0)[0].depth).toBeGreaterThan(0)
    expect(wallBars([' # '], '#', 9)[0].depth).toBeLessThanOrEqual(0.5)
  })
})
