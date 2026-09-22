import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
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
