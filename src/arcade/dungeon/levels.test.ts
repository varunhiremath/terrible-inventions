import { describe, expect, it } from 'vitest'
import { ROOM_COLS, ROOM_ROWS, TILE, findTiles, isSolid, standable, tileAt } from './level'
import { LEVELS, levelFor } from './levels'

describe('the thirteen levels', () => {
  it('there are thirteen of them', () => {
    expect(LEVELS).toHaveLength(13)
  })

  it('picks the right one and does not fall off either end', () => {
    expect(levelFor(1)).toBe(LEVELS[0])
    expect(levelFor(13)).toBe(LEVELS[12])
    expect(levelFor(0)).toBe(LEVELS[0])
    expect(levelFor(99)).toBe(LEVELS[12])
  })

  it('puts the sword on the first level and nowhere else', () => {
    // It is the thing that turns the first level from a walk into a game, and
    // finding a second one later would make the first meaningless.
    expect(findTiles(LEVELS[0], TILE.SWORD)).toHaveLength(1)
    for (const level of LEVELS.slice(1)) {
      expect(findTiles(level, TILE.SWORD)).toEqual([])
    }
  })

  it('leaves the first level unguarded, because he has nothing to fight with', () => {
    expect(LEVELS[0].guards ?? []).toEqual([])
  })

  it('gets harder: the last guards are better than the first', () => {
    const best = (i: number) => Math.max(0, ...(LEVELS[i].guards ?? []).map((g) => g.skill))
    expect(best(12)).toBeGreaterThan(best(1))
  })

  LEVELS.forEach((level, i) => {
    describe(`${i + 1}. ${level.name}`, () => {
      it('is a whole number of rooms', () => {
        expect(level.rows.length % ROOM_ROWS).toBe(0)
        for (const row of level.rows) expect(row.length % ROOM_COLS).toBe(0)
      })

      it('is a consistent rectangle', () => {
        expect(new Set(level.rows.map((r) => r.length)).size).toBe(1)
      })

      it('has exactly one way out', () => {
        expect(findTiles(level, TILE.EXIT)).toHaveLength(1)
      })

      it('starts him on something solid, facing into the level', () => {
        const { col, row, facing } = level.start
        expect(standable(level, col, row)).toBe(true)
        expect(Math.abs(facing)).toBe(1)
      })

      it('does not start him on top of a trap', () => {
        const under = tileAt(level, level.start.col, level.start.row)
        expect([TILE.SPIKES, TILE.CHOMPER, TILE.LOOSE]).not.toContain(under)
      })

      it('gives every gate a plate to open it', () => {
        // A gate with no plate is a wall that looks like a puzzle.
        const gates = findTiles(level, TILE.GATE).length
        const plates = findTiles(level, TILE.BUTTON).length
        if (gates > 0) expect(plates).toBeGreaterThan(0)
      })

      it('stands every guard on solid ground', () => {
        for (const guard of level.guards ?? []) {
          expect(standable(level, guard.col, guard.row)).toBe(true)
          expect(tileAt(level, guard.col, guard.row)).not.toBe(TILE.SPIKES)
        }
      })

      it('puts every torch on a wall', () => {
        for (const torch of level.torches ?? []) {
          expect(torch.row).toBeGreaterThanOrEqual(0)
          expect(torch.row).toBeLessThan(level.rows.length)
        }
      })

      it('walls the level in, so nobody walks out of the world', () => {
        for (let row = 0; row < level.rows.length; row++) {
          expect(isSolid(tileAt(level, 0, row))).toBe(true)
          expect(isSolid(tileAt(level, level.rows[row].length - 1, row))).toBe(true)
        }
      })
    })
  })
})
