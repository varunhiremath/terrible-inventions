import { describe, expect, it } from 'vitest'
import { allRules, fairness, fits, nextRoom, revealUntilFair, runRule, wrap, type Rule } from './rules'

describe('wrap', () => {
  it('keeps rooms in 1..n', () => {
    expect(wrap(1, 8)).toBe(1)
    expect(wrap(8, 8)).toBe(8)
    expect(wrap(9, 8)).toBe(1)
    expect(wrap(0, 8)).toBe(8)
    expect(wrap(-1, 8)).toBe(7)
    expect(wrap(17, 8)).toBe(1)
  })

  it('never leaves the house', () => {
    for (let rooms = 2; rooms <= 14; rooms++) {
      for (let v = -40; v <= 40; v++) {
        const w = wrap(v, rooms)
        expect(w).toBeGreaterThanOrEqual(1)
        expect(w).toBeLessThanOrEqual(rooms)
      }
    }
  })
})

describe('rules', () => {
  it('skip counts', () => {
    expect(runRule({ kind: 'step', d: 3 }, 2, 12, 5)).toEqual([2, 5, 8, 11, 2])
  })

  it('counts backwards through the wrap', () => {
    expect(runRule({ kind: 'step', d: -2 }, 3, 8, 4)).toEqual([3, 1, 7, 5])
  })

  it('doubles', () => {
    // Doubling is done on the 0-based room, so 1 stays put and 2 -> 3 -> 5 -> 9.
    expect(runRule({ kind: 'multiply', r: 2 }, 2, 16, 4)).toEqual([2, 3, 5, 9])
  })

  it('grows its jumps', () => {
    expect(runRule({ kind: 'growStep', start: 1, grow: 1 }, 1, 20, 5)).toEqual([1, 2, 4, 7, 11])
  })

  it('alternates', () => {
    expect(runRule({ kind: 'alternate', a: 4, b: -1 }, 1, 12, 5)).toEqual([1, 5, 4, 8, 7])
  })

  it('adds the last two jumps', () => {
    expect(runRule({ kind: 'fibStep', first: 1, second: 1 }, 1, 30, 6)).toEqual([1, 2, 3, 5, 8, 13])
  })

  it('recognises the trail it produced', () => {
    for (const rooms of [8, 12, 20]) {
      for (const rule of allRules(rooms)) {
        expect(fits(rule, runRule(rule, 1, rooms, 6), rooms)).toBe(true)
      }
    }
  })
})

describe('fairness', () => {
  it('accepts agreement even when the rule is ambiguous', () => {
    // Two rooms cannot distinguish much, but that is only a problem if the
    // surviving rules disagree about where it goes next.
    const result = fairness([1, 3], 10)
    expect(result.fitting.length).toBeGreaterThan(1)
    expect(result.forced).toBe(result.predictions.length === 1)
  })

  it('is forced once the evidence pins the next room down', () => {
    const trail = [2, 5, 8, 11]
    const result = fairness(trail, 12)
    expect(result.forced).toBe(true)
    expect(result.predictions).toEqual([2])
  })

  it('reports disagreement rather than hiding it', () => {
    const result = fairness([1, 2], 12)
    if (!result.forced) expect(result.predictions.length).toBeGreaterThan(1)
  })

  // The load-bearing guarantee: a hunt is never served with two defensible
  // answers, so a wrong guess is always genuinely wrong.
  it('never serves a trail with two defensible answers', () => {
    for (const rooms of [6, 8, 10, 12, 16]) {
      for (const rule of allRules(rooms)) {
        for (const start of [1, 3, rooms]) {
          const trail = revealUntilFair(rule, start, rooms)
          const result = fairness(trail, rooms)
          if (result.forced) {
            expect(result.predictions).toHaveLength(1)
            // And the forced answer must be the one the real rule gives.
            expect(result.predictions[0]).toBe(nextRoom(rule, trail, rooms))
          }
        }
      }
    }
  })

  it('reaches a forced answer for the vast majority of hunts', () => {
    let total = 0
    let forced = 0
    for (const rooms of [8, 10, 12]) {
      for (const rule of allRules(rooms)) {
        total++
        if (fairness(revealUntilFair(rule, 2, rooms), rooms).forced) forced++
      }
    }
    expect(forced / total).toBeGreaterThan(0.9)
  })

  it('gets more determined as the trail grows, never less', () => {
    const rule: Rule = { kind: 'growStep', start: 2, grow: 1 }
    const rooms = 16
    let previous = Infinity
    for (let n = 2; n <= 6; n++) {
      const count = fairness(runRule(rule, 1, rooms, n), rooms).fitting.length
      expect(count).toBeLessThanOrEqual(previous)
      previous = count
    }
  })
})
