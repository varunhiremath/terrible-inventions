import { describe, expect, it } from 'vitest'
import { BANK } from './bank'
import { idOf, mathsAt, pickQuestion, shuffle, topicOf } from './interlude'
import type { Topic } from './types'

const rolls = Array.from({ length: 300 }, (_, i) => i / 300)

describe('the question between lives', () => {
  it('always hands back something answerable', () => {
    for (const roll of rolls) {
      const question = pickQuestion(1000, roll, 12345)
      if (question.kind === 'ask') {
        expect(question.options.length, String(roll)).toBeGreaterThanOrEqual(3)
        expect(question.options, String(roll)).toContain(question.answer)
      } else {
        expect(question.problem.prompt.length, String(roll)).toBeGreaterThan(0)
      }
    }
  })

  it('asks all four topics and some typed-in sums', () => {
    const kinds = new Set(rolls.map((roll) => topicOf(pickQuestion(1000, roll, 1))))
    const generated = rolls.filter((roll) => pickQuestion(1000, roll, 1).kind === 'maths')
    expect(kinds.size).toBeGreaterThanOrEqual(4)
    expect(generated.length).toBeGreaterThan(0)
  })

  it('does not always put the right answer first', () => {
    // The bank is written with the correct answer first so it can be read and
    // checked by eye. If the shuffle ever stopped working, every question
    // would still look fine and the top button would always be right.
    const asks = rolls
      .map((roll) => pickQuestion(1000, roll, 7))
      .filter((q) => q.kind === 'ask')
    const onTop = asks.filter((q) => q.kind === 'ask' && q.options[0] === q.answer)
    expect(asks.length).toBeGreaterThan(20)
    expect(onTop.length).toBeLessThan(asks.length * 0.75)
  })

  it('keeps every option, in some order', () => {
    for (const roll of rolls) {
      const q = pickQuestion(1000, roll, 3)
      if (q.kind !== 'ask') continue
      expect([...q.options].sort()).toEqual([...q.item.options].sort())
    }
  })

  it('does not come back with one it was told was recent', () => {
    const first = pickQuestion(1000, 0.6, 9)
    if (first.kind !== 'ask') throw new Error('expected a bank question at this roll')
    for (const roll of rolls) {
      const again = pickQuestion(1000, roll, 9, [first.item.id])
      if (again.kind === 'ask') expect(again.item.id, String(roll)).not.toBe(first.item.id)
    }
  })

  it('does not ask the same topic twice running', () => {
    for (const roll of rolls) {
      for (const last of ['maths', 'history', 'geography', 'trivia'] as Topic[]) {
        const q = pickQuestion(1000, roll, 4, [], last)
        // A generated sum is always maths, and is the one exception: it is a
        // different activity from a multiple-choice number question.
        if (q.kind === 'ask') expect(q.item.topic, `${last} at ${roll}`).not.toBe(last)
      }
    }
  })

  it('gives an easier child easier questions than a harder one', () => {
    const mean = (rating: number) => {
      const asks = rolls
        .map((roll) => pickQuestion(rating, roll, 5))
        .filter((q) => q.kind === 'ask')
      const total = asks.reduce((sum, q) => sum + (q.kind === 'ask' ? q.item.rating : 0), 0)
      return total / asks.length
    }
    expect(mean(750)).toBeLessThan(mean(1300) - 150)
  })

  it('names a question by something stable', () => {
    for (const roll of rolls) {
      const id = idOf(pickQuestion(1000, roll, 2))
      expect(id.length, String(roll)).toBeGreaterThan(0)
    }
  })

  it('can reach most of the bank across many goes', () => {
    // A picker that technically works but only ever reaches a dozen questions
    // makes a bank of two hundred pointless.
    const seen = new Set<string>()
    for (let rating = 700; rating <= 1350; rating += 50) {
      for (const roll of rolls) {
        const q = pickQuestion(rating, roll, 1)
        if (q.kind === 'ask') seen.add(q.item.id)
      }
    }
    expect(seen.size).toBeGreaterThan(BANK.length * 0.6)
  })
})

describe('the generated maths', () => {
  it('builds a problem at any rating it is given', () => {
    for (let rating = 700; rating <= 1400; rating += 25) {
      for (const roll of [0, 0.33, 0.66, 0.99]) {
        const problem = mathsAt(rating, roll, rating)
        expect(problem.prompt.length, `${rating} at ${roll}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('shuffling', () => {
  it('keeps everything it was given', () => {
    const items = ['a', 'b', 'c', 'd']
    for (const roll of rolls) expect([...shuffle(items, roll)].sort()).toEqual(items)
  })
})
