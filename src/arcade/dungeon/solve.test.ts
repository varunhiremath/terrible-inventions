import { describe, expect, it } from 'vitest'
import { LEVELS, levelFor } from './levels'
import { TILE } from './level'
import { canFinish, canReach } from './solve'

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

describe('the sword on floor one', () => {
  /*
   * "How do you collect the sword? The space is so narrow that I can never
   * make that jump. Is there a way?" There was not.
   *
   * It sat on a ledge with solid floor directly above it, so it could not be
   * fallen onto, and a four-tile gap either side, so it could not be jumped
   * to. The solver had only ever been asked whether the exit was reachable,
   * which it was — so the one pickup in the game that matters was scenery, and
   * the whole sword-and-guard mechanic hung off collecting it.
   */
  it('can actually be picked up', () => {
    expect(canReach(levelFor(1), TILE.SWORD)).toBe(true)
  }, 120_000)

  it('is the only floor that has one to find', () => {
    const swords = (level: (typeof LEVELS)[number]) =>
      level.rows.reduce((n, row) => n + [...row].filter((t) => t === TILE.SWORD).length, 0)
    expect(swords(LEVELS[0])).toBeGreaterThan(0)
  })
})
