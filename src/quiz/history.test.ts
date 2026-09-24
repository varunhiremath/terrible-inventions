import { describe, expect, it } from 'vitest'
import { HISTORY, historyAt } from './history'

/**
 * The question bank, checked for the mistakes that are invisible on the page.
 *
 * A duplicated option means a question with two right answers or two identical
 * buttons; an id used twice means the "do not repeat" list silently stops
 * working for both. Neither shows up until a child is looking at it.
 */
describe('the history questions', () => {
  it('has enough to not repeat itself for a while', () => {
    expect(HISTORY.length).toBeGreaterThan(20)
  })

  it('gives every question a unique id', () => {
    const ids = new Set(HISTORY.map((q) => q.id))
    expect(ids.size).toBe(HISTORY.length)
  })

  it('never offers the same option twice', () => {
    for (const q of HISTORY) {
      const seen = new Set(q.options.map((o) => o.toLowerCase().trim()))
      expect(seen.size, `${q.id}: ${q.options.join(' / ')}`).toBe(q.options.length)
    }
  })

  it('asks a question and offers a real choice', () => {
    for (const q of HISTORY) {
      expect(q.prompt.trim().endsWith('?'), `${q.id} does not ask anything`).toBe(true)
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3)
      for (const option of q.options) expect(option.trim().length, q.id).toBeGreaterThan(0)
    }
  })

  it('explains itself, because the point is the idea and not the mark', () => {
    for (const q of HISTORY) {
      expect(q.explain.trim().length, q.id).toBeGreaterThan(20)
      // An explanation that only says "correct" teaches nothing.
      expect(q.explain.toLowerCase()).not.toMatch(/^(yes|no|correct|wrong)\b/)
    }
  })

  it('spreads across a range of difficulty', () => {
    const ratings = HISTORY.map((q) => q.rating)
    expect(Math.min(...ratings)).toBeLessThan(800)
    expect(Math.max(...ratings)).toBeGreaterThan(1250)
  })

  it('picks something near the asker rather than anything at all', () => {
    for (const rating of [700, 1000, 1350]) {
      for (const roll of [0, 0.3, 0.6, 0.99]) {
        const q = historyAt(rating, roll)
        expect(Math.abs(q.rating - rating), `${rating} got ${q.id} at ${q.rating}`).toBeLessThan(350)
      }
    }
  })

  it('does not ask again what it just asked', () => {
    const first = historyAt(1000, 0.2)
    const second = historyAt(1000, 0.2, [first.id])
    expect(second.id).not.toBe(first.id)
  })

  it('still finds something when everything has been asked', () => {
    const all = HISTORY.map((q) => q.id)
    expect(historyAt(1000, 0.5, all)).toBeDefined()
  })
})
