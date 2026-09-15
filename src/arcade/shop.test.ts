import { describe, expect, it } from 'vitest'
import { CONTINUE_DELTA, SHOP, itemById, ratingFor } from './shop'
import { emptyPowerUps } from './maze/game'
import { TAUNTS, taunt, type TauntMoment } from './taunts'

describe('shop', () => {
  it('offers distinct items', () => {
    expect(new Set(SHOP.map((i) => i.id)).size).toBe(SHOP.length)
    expect(new Set(SHOP.map((i) => i.name)).size).toBe(SHOP.length)
  })

  // The whole design rests on this: a better prize must cost a harder problem,
  // or the reward stops being contingent on performance.
  it('charges a harder problem for a better prize', () => {
    const byStars = [...SHOP].sort((a, b) => a.stars - b.stars)
    for (let i = 1; i < byStars.length; i++) {
      if (byStars[i].stars === byStars[i - 1].stars) continue
      expect(byStars[i].ratingDelta).toBeGreaterThan(byStars[i - 1].ratingDelta)
    }
  })

  it('makes the cheapest item genuinely gettable', () => {
    const easiest = SHOP.reduce((a, b) => (a.ratingDelta < b.ratingDelta ? a : b))
    expect(easiest.ratingDelta).toBeLessThan(-100)
  })

  it('keeps the compulsory continue easier than anything in the shop', () => {
    for (const item of SHOP) expect(CONTINUE_DELTA).toBeLessThan(item.ratingDelta)
  })

  it('offsets from the player’s own rating, so it scales with him', () => {
    const item = SHOP[0]
    expect(ratingFor(item, 1000)).toBe(1000 + item.ratingDelta)
    expect(ratingFor(item, 1800)).toBe(1800 + item.ratingDelta)
  })

  it('grants what it promises, without touching anything else', () => {
    for (const item of SHOP) {
      const before = emptyPowerUps()
      const after = item.apply(before)
      expect(after).not.toEqual(before)
      expect(before).toEqual(emptyPowerUps()) // never mutates
    }
    expect(itemById('life')!.apply(emptyPowerUps()).spareLives).toBe(1)
    expect(itemById('twoLives')!.apply(emptyPowerUps()).spareLives).toBe(2)
    expect(itemById('freeze')!.apply(emptyPowerUps()).freezes).toBe(1)
    expect(itemById('pellet')!.apply(emptyPowerUps()).pelletBoost).toBeGreaterThan(1)
  })

  it('accumulates when bought repeatedly', () => {
    let p = emptyPowerUps()
    for (let i = 0; i < 3; i++) p = itemById('freeze')!.apply(p)
    expect(p.freezes).toBe(3)
  })
})

describe('taunts', () => {
  const moments = Object.keys(TAUNTS) as TauntMoment[]

  it('has something to say at every moment', () => {
    for (const moment of moments) {
      expect(TAUNTS[moment].length).toBeGreaterThan(1)
      for (const line of TAUNTS[moment]) expect(line.trim().length).toBeGreaterThan(0)
    }
  })

  it('always returns a real line, whatever the roll', () => {
    for (const moment of moments) {
      for (let roll = 0; roll < 1; roll += 0.07) {
        expect(TAUNTS[moment]).toContain(taunt(moment, roll))
      }
      expect(TAUNTS[moment]).toContain(taunt(moment, 1))
    }
  })

  it('is smug rather than unkind — never disappointed in the player', () => {
    const unkind = /\b(stupid|idiot|useless|rubbish at|bad at|disappointed|thick)\b/i
    for (const moment of moments) {
      for (const line of TAUNTS[moment]) expect(line).not.toMatch(unkind)
    }
  })
})
