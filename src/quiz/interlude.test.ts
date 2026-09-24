import { describe, expect, it } from 'vitest'
import { HISTORY } from './history'
import { RECENT, idOf, mathsAt, pickQuestion, shuffle } from './interlude'

describe('the question between lives', () => {
  it('asks both kinds', () => {
    const kinds = new Set<string>()
    for (let i = 0; i < 40; i++) kinds.add(pickQuestion(1000, i / 40, i).kind)
    expect(kinds).toEqual(new Set(['maths', 'history']))
  })

  it('does not always put the right answer first', () => {
    /**
     * The one that would ruin it silently. The bank is written with the
     * answer first so it reads properly as source, and if the shuffle ever
     * stopped working every question could be got right by pressing the top
     * button, which is exactly the kind of thing nobody reports.
     */
    const item = HISTORY.find((q) => q.options.length === 4)!
    const positions = new Set<number>()
    for (let i = 0; i < 30; i++) {
      positions.add(shuffle(item.options, i / 30).indexOf(item.options[0]))
    }
    expect(positions.size).toBeGreaterThan(2)
  })

  it('keeps every option when it shuffles them', () => {
    for (const q of HISTORY) {
      const mixed = shuffle(q.options, 0.37)
      expect([...mixed].sort()).toEqual([...q.options].sort())
    }
  })

  it('marks the right answer, wherever it has moved to', () => {
    for (let i = 0; i < 20; i++) {
      const q = pickQuestion(1000, i / 40, i)
      if (q.kind !== 'history') continue
      expect(q.options).toContain(q.answer)
      expect(q.answer).toBe(q.item.options[0])
    }
  })

  it('does not repeat what was just asked', () => {
    const recent: string[] = []
    for (let i = 0; i < 12; i++) {
      const q = pickQuestion(1000, (i * 0.13) % 0.5, i, recent)
      expect(recent).not.toContain(idOf(q))
      recent.unshift(idOf(q))
      recent.length = Math.min(recent.length, RECENT)
    }
  })

  it('pitches the maths at the person answering it', () => {
    for (const rating of [700, 1100, 1500]) {
      const problem = mathsAt(rating, 0.4, 7)
      expect(Math.abs(problem.rating - rating), `${rating} got ${problem.rating}`).toBeLessThan(500)
    }
  })

  it('gives the same question for the same roll, so a reload is not a reroll', () => {
    const a = pickQuestion(1000, 0.31, 99)
    const b = pickQuestion(1000, 0.31, 99)
    expect(idOf(a)).toBe(idOf(b))
  })
})
