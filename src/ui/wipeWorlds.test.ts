import { describe, expect, it } from 'vitest'
import {
  CAVE_FLOOR,
  CAVE_LOOT,
  CAVE_TUNNEL,
  KEEP_HALL,
  KEEP_WALK,
  MAZE_DOTS,
  MAZE_LANE,
  MAZE_STRIP,
  PIPE_COINS,
  PIPE_GROUND,
  PIPE_RUN,
  PIPE_WALK,
} from './wipeWorlds'
import { TILE as MAZE_TILE } from '../arcade/maze/maze'
import { isSolid as caveSolid } from '../dave/level'
import { solidAt } from '../pipes/level'
import { isSolid as keepSolid } from '../arcade/dungeon/level'
import { ROOM_COLS } from '../arcade/dungeon/level'

/**
 * These are the two and a half seconds between one level and the next, so
 * nobody is going to play them and nothing can go wrong in them — except the
 * one thing, which is a tile left in the corridor. A character who walks into
 * a wall and keeps walking is the whole transition ruined, it looks exactly
 * like a bug, and it is invisible in a diff.
 *
 * So: every strip is a rectangle, and the line each character walks is clear
 * from where it starts to where it ends.
 */

const rectangular = (rows: readonly string[]) =>
  new Set(rows.map((row) => row.length)).size === 1

describe('the corridors between levels', () => {
  it('are all rectangles', () => {
    expect(rectangular(MAZE_STRIP)).toBe(true)
    expect(rectangular(CAVE_TUNNEL.rows)).toBe(true)
    expect(rectangular(PIPE_RUN.rows)).toBe(true)
    expect(rectangular(KEEP_HALL.rows)).toBe(true)
  })

  it('leave the maze passage open from one room to the other', () => {
    const lane = MAZE_STRIP[MAZE_LANE]
    for (let x = 1; x < lane.length - 1; x++) {
      expect(lane[x]).not.toBe(MAZE_TILE.WALL)
    }
    // And there is something to eat along it, which is the point of the scene.
    expect(MAZE_DOTS.filter((dot) => dot.y === MAZE_LANE).length).toBeGreaterThan(10)
  })

  it('leave Dave a tunnel to walk down, with diamonds in it', () => {
    const walk = CAVE_FLOOR - 1
    for (let x = 1; x < CAVE_TUNNEL.rows[walk].length - 1; x++) {
      const tile = CAVE_TUNNEL.rows[walk][x]
      expect(caveSolid(tile)).toBe(false)
    }
    // Standing on something the whole way, or he falls out of the scene.
    for (let x = 1; x < CAVE_TUNNEL.rows[CAVE_FLOOR].length - 1; x++) {
      expect(caveSolid(CAVE_TUNNEL.rows[CAVE_FLOOR][x])).toBe(true)
    }
    expect(CAVE_LOOT.length).toBeGreaterThan(4)
    // A door to open at the far end.
    expect(CAVE_TUNNEL.rows[walk]).toContain('D')
  })

  it('leave the plumber a run under the blocks, with coins in it', () => {
    const walk = PIPE_GROUND - 1
    for (let col = PIPE_WALK.from; col <= PIPE_WALK.to; col++) {
      expect(solidAt(PIPE_RUN, col, walk)).toBe(false)
    }
    expect(PIPE_COINS.length).toBeGreaterThan(6)
    // The flag is where the run ends.
    expect(PIPE_RUN.pole).toBeGreaterThan(PIPE_RUN.rows[0].length - 6)
  })

  it('leave the prince a floor through every room', () => {
    const floor = KEEP_HALL.rows[KEEP_WALK.row]
    for (let col = KEEP_WALK.from; col <= KEEP_WALK.to; col++) {
      expect(keepSolid(floor[col])).toBe(true)
    }
    // Whole rooms, so the camera pans rather than stopping half way across one.
    expect(KEEP_HALL.rows[0].length % ROOM_COLS).toBe(0)
  })
})
