import { describe, expect, it } from 'vitest'
import { BANK, BY_TOPIC, askFrom, topicFor } from './bank'
import { FLAGS, FLAG_OF } from './flags'
import { TOPICS, type Topic } from './types'

/**
 * A bank this size goes wrong quietly.
 *
 * Nothing crashes if two questions share an id, or if a question lists the
 * same option twice, or if the right answer is accidentally also one of the
 * wrong ones. You just get a question that cannot be answered correctly, once
 * every few hundred goes, to a child who will assume he was wrong. So the
 * checks here are less about logic than about proofreading by machine.
 */
describe('the question bank', () => {
  it('has a decent number of questions in every topic', () => {
    for (const topic of Object.keys(TOPICS) as Topic[]) {
      expect(BY_TOPIC[topic].length, topic).toBeGreaterThan(30)
    }
  })

  it('gives every question a unique id', () => {
    const seen = new Map<string, number>()
    for (const ask of BANK) seen.set(ask.id, (seen.get(ask.id) ?? 0) + 1)
    const twice = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    expect(twice).toEqual([])
  })

  it('files every question under the topic it is listed in', () => {
    for (const topic of Object.keys(TOPICS) as Topic[]) {
      for (const ask of BY_TOPIC[topic]) expect(ask.topic, ask.id).toBe(topic)
    }
  })

  it('never repeats an option inside one question', () => {
    // Two identical buttons means one of them is right and one is wrong.
    for (const ask of BANK) {
      expect(new Set(ask.options).size, `${ask.id}: ${ask.options.join(' / ')}`).toBe(
        ask.options.length,
      )
    }
  })

  it('offers between three and four answers', () => {
    for (const ask of BANK) {
      expect(ask.options.length, ask.id).toBeGreaterThanOrEqual(3)
      expect(ask.options.length, ask.id).toBeLessThanOrEqual(4)
    }
  })

  it('always explains itself', () => {
    for (const ask of BANK) {
      expect(ask.explain.length, ask.id).toBeGreaterThan(20)
      // An explanation that just restates the answer teaches nothing.
      expect(ask.explain.trim(), ask.id).not.toBe(ask.options[0])
    }
  })

  it('asks the question rather than trailing off', () => {
    for (const ask of BANK) {
      expect(ask.prompt.length, ask.id).toBeGreaterThan(10)
      expect(/[?.:]$/.test(ask.prompt.trim()), `${ask.id}: ${ask.prompt}`).toBe(true)
    }
  })

  it('keeps every rating on the same scale the maths uses', () => {
    for (const ask of BANK) {
      expect(ask.rating, ask.id).toBeGreaterThanOrEqual(600)
      expect(ask.rating, ask.id).toBeLessThanOrEqual(1500)
    }
  })

  it('spreads each topic across a range of difficulties', () => {
    // A topic bunched at one rating can only ever be asked of one child.
    for (const topic of Object.keys(TOPICS) as Topic[]) {
      const ratings = BY_TOPIC[topic].map((a) => a.rating)
      expect(Math.max(...ratings) - Math.min(...ratings), topic).toBeGreaterThan(400)
    }
  })

  it('only names flags that exist', () => {
    for (const ask of BANK) {
      if (ask.flag) expect(Object.keys(FLAGS), ask.id).toContain(ask.flag)
      if (ask.showFlags) {
        for (const option of ask.options) {
          expect(Object.keys(FLAG_OF), `${ask.id}: ${option}`).toContain(option)
        }
      }
    }
  })

  it('does not print the answer next to a flag it is asking you to recognise', () => {
    // A question showing four flags must not also label them, and a question
    // showing one flag must not name the country in the prompt.
    for (const ask of BANK) {
      if (!ask.flag) continue
      const country = FLAGS[ask.flag].country
      expect(ask.prompt.includes(country), `${ask.id}: ${ask.prompt}`).toBe(false)
    }
  })
})

describe('choosing a question', () => {
  const rolls = Array.from({ length: 200 }, (_, i) => i / 200)

  it('lands on something at every roll', () => {
    for (const roll of rolls) {
      const ask = askFrom(BANK, 1000, roll)
      expect(ask, String(roll)).toBeDefined()
      expect(BANK, String(roll)).toContain(ask)
    }
  })

  it('stays near the difficulty asked for', () => {
    for (const roll of rolls) {
      const easy = askFrom(BANK, 700, roll)
      const hard = askFrom(BANK, 1350, roll)
      expect(easy.rating, `easy at ${roll}`).toBeLessThan(1100)
      expect(hard.rating, `hard at ${roll}`).toBeGreaterThan(950)
    }
  })

  it('does not hand back one it has just asked', () => {
    const first = askFrom(BANK, 1000, 0.3)
    const again = askFrom(BANK, 1000, 0.3, [first.id])
    expect(again.id).not.toBe(first.id)
  })

  it('still answers when every question has been asked', () => {
    // Running out should feel like repetition, not like a broken screen.
    const all = BANK.map((a) => a.id)
    expect(() => askFrom(BANK, 1000, 0.5, all)).not.toThrow()
    expect(askFrom(BANK, 1000, 0.5, all)).toBeDefined()
  })

  it('reaches every topic', () => {
    const seen = new Set(rolls.map((roll) => topicFor(roll)))
    expect(seen.size).toBe(4)
  })

  it('never asks the same topic twice running', () => {
    for (const roll of rolls) {
      for (const last of Object.keys(TOPICS) as Topic[]) {
        expect(topicFor(roll, last), `${last} at ${roll}`).not.toBe(last)
      }
    }
  })
})

describe('the flags', () => {
  it('draws every flag out of at least one shape', () => {
    for (const [name, flag] of Object.entries(FLAGS)) {
      expect(flag.shapes.length, name).toBeGreaterThan(0)
      expect(flag.country.length, name).toBeGreaterThan(2)
    }
  })

  it('keeps every shape inside the flag', () => {
    // A coordinate outside 0..1 is a typo: it draws off the edge and the flag
    // silently comes out wrong rather than failing.
    const inside = (n: number) => n >= -0.05 && n <= 1.05
    for (const [name, flag] of Object.entries(FLAGS)) {
      for (const shape of flag.shapes) {
        if (shape.kind === 'bands') continue
        if (shape.kind === 'poly') {
          for (const [x, y] of shape.at) {
            expect(inside(x) && inside(y), `${name}: ${x},${y}`).toBe(true)
          }
          continue
        }
        for (const n of shape.at) expect(inside(n), `${name}: ${n}`).toBe(true)
      }
    }
  })

  it('gives every flag its own name', () => {
    const countries = Object.values(FLAGS).map((f) => f.country)
    expect(new Set(countries).size).toBe(countries.length)
  })

  it('finds a flag back from its country name', () => {
    for (const [name, flag] of Object.entries(FLAGS)) {
      expect(FLAG_OF[flag.country], name).toBe(name)
    }
  })

  it('uses real colours everywhere', () => {
    for (const [name, flag] of Object.entries(FLAGS)) {
      for (const shape of flag.shapes) {
        const colors = shape.kind === 'bands' ? shape.colors : [shape.color]
        for (const color of colors) {
          expect(/^#[0-9a-f]{6}$/i.test(color), `${name}: ${color}`).toBe(true)
        }
      }
    }
  })
})
