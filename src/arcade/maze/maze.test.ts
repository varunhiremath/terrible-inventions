import { describe, expect, it } from 'vitest'
import {
  BOARDS,
  FULL,
  MEDIUM,
  SMALL,
  TILE,
  boardFor,
  edibleCells,
  isWall,
  key,
  neighbours,
  reachableFrom,
  tileAt,
  wrapCell,
  type Board,
} from './maze'

/**
 * Every board gets the same examination.
 *
 * These checks used to run against the one maze there was. There are three
 * now, and a smaller board is not a safer one — it is a new hand-drawn grid
 * with new chances of a sealed corner, a dot nobody can reach or a chaser
 * starting inside a wall. The flood fill is the only thing that actually knows.
 */
describe.each(BOARDS.map((board) => [board.name, board] as const))('the %s board', (_name, board: Board) => {
  it('is a consistent rectangle', () => {
    expect(new Set(board.rows.map((r) => r.length)).size).toBe(1)
    // Taller than it is wide, like a phone held upright. An almost-square
    // board leaves a band of nothing above and below it on every screen.
    expect(board.height).toBeGreaterThan(board.width)
  })

  it('is left-right symmetric, which is what mirroring buys', () => {
    for (const row of board.rows) expect([...row].reverse().join('')).toBe(row)
  })

  it('only uses tiles the game knows about', () => {
    const known: string[] = Object.values(TILE)
    for (const row of board.rows) for (const tile of row) expect(known).toContain(tile)
  })

  it('is walled all the way round except at the tunnel', () => {
    board.rows.forEach((row, y) => {
      if (y === board.tunnelRow) return
      expect(row[0], `row ${y} left`).toBe(TILE.WALL)
      expect(row[row.length - 1], `row ${y} right`).toBe(TILE.WALL)
    })
    expect(board.rows[board.tunnelRow][0]).not.toBe(TILE.WALL)
  })

  it('wraps around the sides', () => {
    expect(wrapCell(board, { x: -1, y: board.tunnelRow })).toEqual({
      x: board.width - 1,
      y: board.tunnelRow,
    })
    expect(wrapCell(board, { x: board.width, y: board.tunnelRow })).toEqual({
      x: 0,
      y: board.tunnelRow,
    })
  })

  it('joins the two edges into one corridor', () => {
    const left = { x: 0, y: board.tunnelRow }
    const right = { x: board.width - 1, y: board.tunnelRow }
    expect(isWall(board, left)).toBe(false)
    expect(isWall(board, right)).toBe(false)
    expect(neighbours(board, left).map(key)).toContain(key(right))
  })

  it('never wraps vertically', () => {
    expect(tileAt(board, { x: 1, y: -1 })).toBe(TILE.WALL)
    expect(tileAt(board, { x: 1, y: board.height })).toBe(TILE.WALL)
  })

  it('starts everyone somewhere they can stand', () => {
    expect(isWall(board, board.playerStart), 'player').toBe(false)
    expect(isWall(board, board.ghostRespawn), 'respawn').toBe(false)
    board.ghostStarts.forEach((start, i) => {
      expect(isWall(board, start), `chaser ${i}`).toBe(false)
    })
  })

  it('gives everyone four different places to start', () => {
    expect(new Set(board.ghostStarts.map(key)).size).toBe(4)
  })

  it('lets the player reach every single dot', () => {
    const open = reachableFrom(board, board.playerStart)
    const { dots, power } = edibleCells(board)
    for (const cell of [...dots, ...power]) {
      expect(open.has(key(cell)), `${key(cell)} is walled off`).toBe(true)
    }
  })

  it('lets every chaser reach the player', () => {
    for (const start of board.ghostStarts) {
      expect(reachableFrom(board, start).has(key(board.playerStart)), key(start)).toBe(true)
    }
  })

  it('has no open tile walled off from the rest', () => {
    const open = reachableFrom(board, board.playerStart)
    board.rows.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        if (tile === TILE.WALL) return
        expect(open.has(key({ x, y })), `${x},${y} is stranded`).toBe(true)
      }),
    )
  })

  it('puts power pellets on both sides', () => {
    const { power } = edibleCells(board)
    expect(power.length).toBeGreaterThanOrEqual(2)
    expect(power.some((p) => p.x < board.width / 2)).toBe(true)
    expect(power.some((p) => p.x > board.width / 2)).toBe(true)
  })

  it('has enough dots to be a level', () => {
    expect(edibleCells(board).dots.length).toBeGreaterThan(40)
  })

  it('starts the player a long way from the chasers', () => {
    // The first attempt at this put him four steps from the nearest one, which
    // meant dying before the first dot.
    for (const start of board.ghostStarts) {
      const gap = Math.abs(start.y - board.playerStart.y) + Math.abs(start.x - board.playerStart.x)
      expect(gap, key(start)).toBeGreaterThan(4)
    }
  })
})

describe('the boards in order', () => {
  it('gets bigger, never smaller', () => {
    expect(SMALL.width).toBeLessThan(MEDIUM.width)
    expect(MEDIUM.width).toBeLessThan(FULL.width)
    expect(SMALL.height).toBeLessThan(MEDIUM.height)
    expect(MEDIUM.height).toBeLessThan(FULL.height)
  })

  it('opens on the smallest one', () => {
    expect(boardFor(1)).toBe(SMALL)
  })

  it('gives each board more than one level before moving on', () => {
    // A board seen once is a board glimpsed rather than learned.
    for (const board of BOARDS) {
      const levels = [1, 2, 3, 4, 5, 6].filter((n) => boardFor(n) === board)
      expect(levels.length, board.name).toBeGreaterThan(1)
    }
  })

  it('reaches the full maze and stays there', () => {
    expect(boardFor(5)).toBe(FULL)
    for (const level of [5, 9, 20, 99]) expect(boardFor(level), String(level)).toBe(FULL)
  })

  it('makes the first board a good deal smaller than the last', () => {
    const area = (b: Board) => b.width * b.height
    expect(area(SMALL)).toBeLessThan(area(FULL) * 0.45)
  })
})
