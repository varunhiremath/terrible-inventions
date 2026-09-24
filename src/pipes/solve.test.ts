import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import { TILE } from './level'
import { canFinish } from './solve'

/**
 * Written before the levels, not after them.
 *
 * The dungeon shipped thirteen levels that were every one of them sealed in
 * the first room, and it took someone playing it to find out. This runs the
 * game's own physics over each level and checks the flag can be reached.
 */
describe('every level', () => {
  for (const [i, level] of LEVELS.entries()) {
    it(`${i + 1}. ${level.name} can be finished`, () => {
      const out = canFinish(level)
      expect(out.finished, `got as far as column ${out.furthest.toFixed(1)} of ${level.pole} after ${out.seen} states`).toBe(true)
    }, 120_000)
  }
})

describe('what is in every level', () => {
  /*
   * "I don't think I saw any mushrooms in the first level? Is it hidden
   * somewhere?" It was not hidden. There were none.
   *
   * The generator rolled twice for them — a bit over half for a run of blocks,
   * then under a third for one of those blocks to hold a mushroom — so a level
   * with none was ordinary luck, and level one lost. That is the level where
   * you find out what a mushroom does.
   */
  for (const [i, level] of LEVELS.entries()) {
    it(`${i + 1}. ${level.name} has a mushroom in it`, () => {
      const mushrooms = level.rows.reduce(
        (n, row) => n + [...row].filter((t) => t === TILE.QUERY_UP).length,
        0,
      )
      expect(mushrooms).toBeGreaterThan(0)
    })
  }

  it('puts one in the first level, where it is learned', () => {
    const first = LEVELS[0]
    const at = first.rows.flatMap((row) =>
      [...row].map((t, col) => (t === TILE.QUERY_UP ? col : -1)).filter((c) => c >= 0),
    )
    expect(at.length).toBeGreaterThan(0)
    // And not tucked away at the very end, where nobody gets to first time.
    expect(Math.min(...at)).toBeLessThan(first.pole * 0.6)
  })
})
