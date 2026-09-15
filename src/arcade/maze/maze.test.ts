import { describe, expect, it } from 'vitest'
import {
  GHOST_RESPAWN,
  GHOST_STARTS,
  HEIGHT,
  MAZE,
  PLAYER_START,
  TILE,
  TUNNEL_ROW,
  WIDTH,
  edibleCells,
  isWall,
  key,
  neighbours,
  reachableFrom,
  tileAt,
  wrapCell,
} from './maze'

describe('maze shape', () => {
  it('is a consistent rectangle', () => {
    expect(new Set(MAZE.map((r) => r.length)).size).toBe(1)
    expect(WIDTH).toBe(19)
    expect(HEIGHT).toBe(21)
  })

  it('is left-right symmetric, which is what mirroring buys', () => {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        expect(MAZE[y][x]).toBe(MAZE[y][WIDTH - 1 - x])
      }
    }
  })

  it('only uses tiles the game knows about', () => {
    const known = new Set(Object.values(TILE))
    for (const row of MAZE) for (const tile of row) expect(known.has(tile as never)).toBe(true)
  })

  it('is walled all the way round except at the tunnel', () => {
    for (let x = 0; x < WIDTH; x++) {
      expect(isWall({ x, y: 0 })).toBe(true)
      expect(isWall({ x, y: HEIGHT - 1 })).toBe(true)
    }
    for (let y = 0; y < HEIGHT; y++) {
      const open = y === TUNNEL_ROW
      expect(isWall({ x: 0, y })).toBe(!open)
      expect(isWall({ x: WIDTH - 1, y })).toBe(!open)
    }
  })
})

describe('tunnel', () => {
  it('wraps around the sides', () => {
    expect(wrapCell({ x: -1, y: TUNNEL_ROW })).toEqual({ x: WIDTH - 1, y: TUNNEL_ROW })
    expect(wrapCell({ x: WIDTH, y: TUNNEL_ROW })).toEqual({ x: 0, y: TUNNEL_ROW })
  })

  it('joins the two edges into one corridor', () => {
    const left = { x: 0, y: TUNNEL_ROW }
    const right = { x: WIDTH - 1, y: TUNNEL_ROW }
    expect(neighbours(left).some((n) => n.x === right.x && n.y === right.y)).toBe(true)
  })

  it('never wraps vertically', () => {
    expect(tileAt({ x: 9, y: -1 })).toBe(TILE.WALL)
    expect(tileAt({ x: 9, y: HEIGHT })).toBe(TILE.WALL)
  })
})

describe('playability', () => {
  const reachable = reachableFrom(PLAYER_START)

  it('starts everyone somewhere they can stand', () => {
    expect(isWall(PLAYER_START)).toBe(false)
    expect(isWall(GHOST_RESPAWN)).toBe(false)
    for (const ghost of GHOST_STARTS) expect(isWall(ghost)).toBe(false)
  })

  // The one that matters: an unreachable dot means a level that cannot be
  // finished, and no amount of playtesting finds it reliably.
  it('lets the player reach every single dot', () => {
    const { dots, power } = edibleCells()
    for (const cell of [...dots, ...power]) {
      expect(reachable.has(key(cell))).toBe(true)
    }
  })

  it('lets every ghost reach the player', () => {
    for (const ghost of [...GHOST_STARTS, GHOST_RESPAWN]) {
      expect(reachable.has(key(ghost))).toBe(true)
    }
  })

  it('has no open tile walled off from the rest', () => {
    let open = 0
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) if (!isWall({ x, y })) open++
    }
    expect(reachable.size).toBe(open)
  })

  it('puts a power pellet in each corner region', () => {
    const { power } = edibleCells()
    expect(power).toHaveLength(4)
    expect(new Set(power.map((p) => `${p.x < WIDTH / 2},${p.y < HEIGHT / 2}`)).size).toBe(4)
  })

  it('has enough dots to be a level', () => {
    expect(edibleCells().dots.length).toBeGreaterThan(80)
  })
})
