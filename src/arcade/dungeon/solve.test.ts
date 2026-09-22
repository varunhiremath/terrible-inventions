import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import { canFinish } from './solve'

/**
 * The check that was missing.
 *
 * Level one shipped with its first room sealed — wall above, floor below,
 * wall to the right — and the only way anyone found out was by playing it and
 * getting stuck. Thirteen hand-written levels in a game where every move is
 * committed is thirteen chances to build a box by accident, and none of them
 * look wrong on the page.
 */
describe('every level', () => {
  for (const [i, level] of LEVELS.entries()) {
    it(`${i + 1}. ${level.name} can be finished`, () => {
      const out = canFinish(level)
      const where = `stuck after ${out.seen} states; furthest column ${out.furthest.toFixed(1)}; reached rooms ${out.rooms.join(' ')}`
      expect(out.finished, where).toBe(true)
    }, 120_000)
  }
})
