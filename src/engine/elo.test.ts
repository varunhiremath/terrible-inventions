import { describe, expect, it } from 'vitest'
import {
  MIN_RATING,
  START_RATING,
  RECOVERY_SUCCESS,
  STRETCH_SUCCESS,
  TARGET_SUCCESS,
  expectedScore,
  kFactor,
  ratingForSuccessRate,
  updateRating,
} from './elo'

describe('expectedScore', () => {
  it('is a coin flip against an equal problem', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10)
  })

  it('rises as the problem gets easier and falls as it gets harder', () => {
    expect(expectedScore(1000, 600)).toBeGreaterThan(0.9)
    expect(expectedScore(1000, 1400)).toBeLessThan(0.1)
  })

  it('is monotonic in problem rating', () => {
    let prev = 1
    for (let r = 400; r <= 2000; r += 50) {
      const e = expectedScore(1000, r)
      expect(e).toBeLessThan(prev)
      prev = e
    }
  })
})

describe('ratingForSuccessRate', () => {
  it('inverts expectedScore', () => {
    for (const target of [0.3, 0.5, TARGET_SUCCESS, 0.9]) {
      const r = ratingForSuccessRate(1200, target)
      expect(expectedScore(1200, r)).toBeCloseTo(target, 10)
    }
  })

  it('puts the everyday target below the player and a stretch above', () => {
    expect(ratingForSuccessRate(1000, TARGET_SUCCESS)).toBeLessThan(1000)
    expect(ratingForSuccessRate(1000, STRETCH_SUCCESS)).toBeGreaterThan(1000)
    expect(ratingForSuccessRate(1000, RECOVERY_SUCCESS)).toBeLessThan(
      ratingForSuccessRate(1000, TARGET_SUCCESS),
    )
  })

  it('clamps absurd targets instead of returning infinity', () => {
    expect(Number.isFinite(ratingForSuccessRate(1000, 0))).toBe(true)
    expect(Number.isFinite(ratingForSuccessRate(1000, 1))).toBe(true)
  })
})

describe('kFactor', () => {
  it('shrinks as evidence accumulates', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(30))
    expect(kFactor(30)).toBeGreaterThan(kFactor(200))
  })
})

describe('updateRating', () => {
  it('rewards a correct answer and punishes a wrong one', () => {
    expect(updateRating(1000, 1000, true, 0)).toBeGreaterThan(1000)
    expect(updateRating(1000, 1000, false, 0)).toBeLessThan(1000)
  })

  it('pays little for an easy win and a lot for a hard one', () => {
    const easy = updateRating(1000, 400, true, 0) - 1000
    const hard = updateRating(1000, 1600, true, 0) - 1000
    expect(hard).toBeGreaterThan(easy)
    expect(easy).toBeGreaterThanOrEqual(0)
  })

  it('costs little to fail a stretch problem', () => {
    const stretchLoss = 1000 - updateRating(1000, 1600, false, 0)
    const easyLoss = 1000 - updateRating(1000, 400, false, 0)
    expect(stretchLoss).toBeLessThan(easyLoss)
  })

  it('never falls through the floor', () => {
    let r = MIN_RATING
    for (let i = 0; i < 50; i++) r = updateRating(r, r + 400, false, i)
    expect(r).toBeGreaterThanOrEqual(MIN_RATING)
  })

  it('converges on the true ability of a simulated player', () => {
    // A player who reliably solves anything at 1500 and below, and nothing above.
    const TRUE = 1500
    let rating = START_RATING
    for (let i = 0; i < 400; i++) {
      const problem = Math.round(ratingForSuccessRate(rating, TARGET_SUCCESS))
      rating = updateRating(rating, problem, problem <= TRUE, i)
    }
    // The target success rate parks him a fixed offset below the wall he cannot pass.
    const offset = TRUE - ratingForSuccessRate(TRUE, TARGET_SUCCESS)
    expect(Math.abs(rating - (TRUE + offset))).toBeLessThan(150)
  })

  it('climbs without bound for a player who never misses', () => {
    let rating = START_RATING
    for (let i = 0; i < 200; i++) {
      rating = updateRating(rating, ratingForSuccessRate(rating, TARGET_SUCCESS), true, i)
    }
    expect(rating).toBeGreaterThan(START_RATING + 600)
  })
})
