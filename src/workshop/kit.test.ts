import { describe, expect, it } from 'vitest'
import { emptySave } from '../engine/storage'
import {
  COINS_PER, UPGRADES, extraSeconds, jetScale, nextCost, owned, spareLives,
  spareShields, tankScale, worthOf,
} from './kit'

/**
 * The workshop.
 *
 * Two changes that belong together: the maths came out of the games, and
 * everything now pays into one purse. What has to hold is that sums are worth
 * doing without ever being required — fast to earn with, and never the only
 * way.
 */
describe('the shelf', () => {
  it('prices everything so it is worth a few runs or a few sums', () => {
    for (const upgrade of UPGRADES) {
      expect(upgrade.costs.length, upgrade.id).toBeGreaterThan(0)
      // Each step dearer than the last, or there is no reason to buy in order.
      for (let i = 1; i < upgrade.costs.length; i++) {
        expect(upgrade.costs[i], upgrade.id).toBeGreaterThan(upgrade.costs[i - 1])
      }
      // The first one is within reach of an evening, not a fortnight.
      const sums = upgrade.costs[0] / worthOf(1000)
      expect(sums, `${upgrade.id} needs ${sums.toFixed(0)} sums`).toBeLessThan(12)
    }
  })

  it('says where each one applies, so nothing is bought blind', () => {
    for (const upgrade of UPGRADES) {
      expect(upgrade.where.length, upgrade.id).toBeGreaterThan(3)
      expect(upgrade.says.length, upgrade.id).toBeGreaterThan(10)
    }
  })

  it('pays more for a harder question', () => {
    expect(worthOf(1400)).toBeGreaterThan(worthOf(800))
    // But never nothing, and never so much that one lucky sum buys the shop.
    expect(worthOf(0)).toBeGreaterThanOrEqual(3)
    expect(worthOf(2000)).toBeLessThan(20)
  })

  it('makes playing worth something and maths worth more', () => {
    /*
     * The whole design in one test. A good run at any game is worth a few
     * coins; a handful of sums is worth an upgrade. Nobody is ever made to do
     * a sum — it is the shortcut, not the toll.
     */
    const goodRun = Math.floor(4000 / COINS_PER)
    const fewSums = worthOf(1000) * 5
    expect(goodRun).toBeGreaterThan(0)
    expect(fewSums).toBeGreaterThan(goodRun)
  })

  it('counts what has been bought and stops at the top', () => {
    const save = { workshop: { spare: 2 } }
    expect(owned(save, 'spare')).toBe(2)
    expect(nextCost(save, 'spare')).toBeNull()
    expect(nextCost({ workshop: {} }, 'spare')).toBe(UPGRADES[0].costs[0])
  })

  it('hands each game exactly one number', () => {
    const none = emptySave()
    expect(spareLives(none)).toBe(0)
    expect(spareShields(none)).toBe(0)
    expect(tankScale(none)).toBe(1)
    expect(extraSeconds(none)).toBe(0)
    expect(jetScale(none)).toBe(1)

    const kitted = { workshop: { spare: 1, shield: 2, tank: 1, clock: 2, jets: 1 } }
    expect(spareLives(kitted)).toBe(1)
    expect(spareShields(kitted)).toBe(2)
    expect(tankScale(kitted)).toBeGreaterThan(1)
    expect(extraSeconds(kitted)).toBe(90)
    expect(jetScale(kitted)).toBeGreaterThan(1)
  })

  it('survives a save written before any of this existed', () => {
    // Old saves have no `workshop` at all. Reading one must not throw.
    const ancient = {} as { workshop: Record<string, number> }
    expect(spareLives(ancient)).toBe(0)
    expect(tankScale(ancient)).toBe(1)
  })
})
