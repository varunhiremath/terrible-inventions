import { describe, expect, it } from 'vitest'
import { makeRng } from './rng'
import {
  CALIBRATION_ATTEMPTS,
  MISSES_BEFORE_BRAKE,
  WARMUP_ATTEMPTS,
  START_RATING,
  STRETCH_EVERY,
  TARGET_SUCCESS,
  expectedScore,
  updateRating,
} from './elo'
import { initialSelectorState, selectNext } from './session'
import type { Generator, GeneratorId, Problem } from './types'

function stub(id: string, minRating: number, maxRating: number): Generator {
  return {
    id: id as GeneratorId,
    name: id,
    blurb: '',
    minRating,
    maxRating,
    generate: (rating, seed): Problem => ({
      id: `${id}:${seed}`,
      kind: id as GeneratorId,
      rating,
      seed,
      prompt: '',
      answer: { type: 'number', value: 1 },
      hints: [],
      explain: '',
    }),
  }
}

const wide = [stub('a', 400, 3000), stub('b', 400, 3000), stub('c', 400, 3000)]
const rng = makeRng(1)

/** A lifetime attempt count well past calibration, for tests about steady state. */
const SETTLED = 50

describe('selectNext', () => {
  it('aims at the everyday success target by default', () => {
    const spec = selectNext(initialSelectorState(1200, SETTLED), wide, rng)
    expect(expectedScore(1200, spec.rating)).toBeCloseTo(TARGET_SUCCESS, 2)
    expect(spec.stretch).toBe(false)
    expect(spec.brake).toBe(false)
  })

  it('serves a harder problem once the stretch counter is due', () => {
    const state = { ...initialSelectorState(1200, SETTLED), sinceStretch: STRETCH_EVERY }
    const spec = selectNext(state, wide, rng)
    expect(spec.stretch).toBe(true)
    expect(spec.rating).toBeGreaterThan(1200)
  })

  it('brakes after consecutive misses, and the brake outranks a due stretch', () => {
    const state = {
      ...initialSelectorState(1200, SETTLED),
      consecutiveMisses: MISSES_BEFORE_BRAKE,
      sinceStretch: STRETCH_EVERY,
    }
    const spec = selectNext(state, wide, rng)
    expect(spec.brake).toBe(true)
    expect(spec.stretch).toBe(false)
    expect(spec.rating).toBeLessThan(1200)
    expect(expectedScore(1200, spec.rating)).toBeGreaterThan(0.85)
  })

  it('does not brake before the threshold', () => {
    const state = { ...initialSelectorState(1200), consecutiveMisses: MISSES_BEFORE_BRAKE - 1 }
    expect(selectNext(state, wide, rng).brake).toBe(false)
  })

  it('rotates away from recently served kinds', () => {
    const state = { ...initialSelectorState(1200), recentKinds: ['a', 'b'] as unknown as GeneratorId[] }
    expect(selectNext(state, wide, rng).kind).toBe('c')
  })

  it('only offers generators whose range covers the target', () => {
    const gens = [stub('a', 400, 700), stub('b', 700, 3000)]
    // A strong player's target lands well above the first generator's ceiling.
    expect(selectNext(initialSelectorState(2000), gens, rng).kind).toBe('b')
  })

  it('reports the real ceiling once the player outruns every generator', () => {
    const gens = [stub('a', 400, 900)]
    const spec = selectNext(initialSelectorState(3000), gens, rng)
    expect(spec.atCeiling).toBe(true)
    expect(spec.rating).toBe(900)
  })

  it('clamps up rather than under-serving a beginner', () => {
    const gens = [stub('a', 900, 3000)]
    const spec = selectNext(initialSelectorState(400), gens, rng)
    expect(spec.atCeiling).toBe(false)
    expect(spec.rating).toBe(900)
  })

  it('throws rather than silently serving nothing', () => {
    expect(() => selectNext(initialSelectorState(1000), [], rng)).toThrow()
  })
})

describe('calibration', () => {
  it('aims at a coin flip once the warm-up is over', () => {
    const spec = selectNext(initialSelectorState(1000, WARMUP_ATTEMPTS), wide, rng)
    expect(expectedScore(1000, spec.rating)).toBeCloseTo(0.5, 2)
    expect(spec.stretch).toBe(false)
  })

  it('switches to the everyday target once calibration is spent', () => {
    const spec = selectNext(initialSelectorState(1000, CALIBRATION_ATTEMPTS), wide, rng)
    expect(expectedScore(1000, spec.rating)).toBeCloseTo(TARGET_SUCCESS, 2)
  })

  it('still brakes on a bad run mid-calibration', () => {
    const state = { ...initialSelectorState(1000, 1), consecutiveMisses: MISSES_BEFORE_BRAKE }
    expect(selectNext(state, wide, rng).brake).toBe(true)
  })

  it('warms up first, then calibrates, then settles', () => {
    const targetAt = (attempts: number) =>
      expectedScore(1000, selectNext(initialSelectorState(1000, attempts), wide, rng).rating)

    expect(targetAt(0)).toBeGreaterThan(0.85)
    expect(targetAt(WARMUP_ATTEMPTS)).toBeCloseTo(0.5, 2)
    expect(targetAt(CALIBRATION_ATTEMPTS)).toBeCloseTo(TARGET_SUCCESS, 2)
  })

  it('closes most of the gap in a single sitting', () => {
    // A player who solves anything up to 1700 and nothing beyond, starting from
    // the same 1000 as everyone else. The warm-up costs some of this: three
    // problems he is meant to get right carry little information, so the first
    // session lands lower than it did without one. Worth it for not opening on
    // the hardest thing the app will ever show him.
    const TRUE = 1700
    let rating = START_RATING
    for (let attempts = 0; attempts < 8; attempts++) {
      const spec = selectNext(initialSelectorState(rating, attempts), wide, rng)
      rating = updateRating(rating, spec.rating, spec.rating <= TRUE, attempts)
    }
    expect(rating).toBeGreaterThan(1300)
  })
})

describe('warm-up', () => {
  it('opens with problems he is meant to get right', () => {
    const spec = selectNext(initialSelectorState(1000, 0), wide, rng)
    expect(expectedScore(1000, spec.rating)).toBeGreaterThan(0.85)
    expect(spec.stretch).toBe(false)
  })

  it('hands over to calibration once the warm-up is spent', () => {
    const spec = selectNext(initialSelectorState(1000, WARMUP_ATTEMPTS), wide, rng)
    expect(expectedScore(1000, spec.rating)).toBeCloseTo(0.5, 2)
  })

  it('still finds a strong player quickly despite the gentler opening', () => {
    const TRUE = 1700
    let rating = START_RATING
    for (let attempts = 0; attempts < 11; attempts++) {
      const spec = selectNext(initialSelectorState(rating, attempts), wide, rng)
      rating = updateRating(rating, spec.rating, spec.rating <= TRUE, attempts)
    }
    expect(rating).toBeGreaterThan(1400)
  })
})
