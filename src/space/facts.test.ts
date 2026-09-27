import { describe, expect, it } from 'vitest'
import { FACTS, pickFact } from './facts'
import { WORLDS } from './level'

/**
 * The facts.
 *
 * These replaced the maths question in this one game, so they are the only
 * thing it has to say for itself between shots. A fact that is wrong, or that
 * turns up three times in a run, is worse than no fact at all.
 */
describe('the facts', () => {
  it('has enough of them that a long run does not repeat', () => {
    // A bad run loses a shield maybe a dozen times. Three times that.
    expect(FACTS.length).toBeGreaterThanOrEqual(36)
  })

  it('says what each one is about', () => {
    for (const fact of FACTS) {
      // Two, not three: Io is a real moon with a two-letter name, and the
      // first go at this rejected it.
      expect(fact.about.length, fact.text).toBeGreaterThanOrEqual(2)
      expect(fact.about, fact.text).toBe(fact.about.trim())
    }
  })

  it('keeps them short enough to read while wanting to get back to it', () => {
    for (const fact of FACTS) {
      expect(fact.text.length, fact.about).toBeGreaterThan(40)
      expect(fact.text.length, fact.about).toBeLessThan(260)
    }
  })

  it('has no two the same', () => {
    expect(new Set(FACTS.map((f) => f.text)).size).toBe(FACTS.length)
  })

  it('covers every world you can fly to, plus the things in between', () => {
    // A child who reaches Saturn and is told something about Mercury has been
    // handed a fact about a place they have already left.
    const subjects = new Set(FACTS.map((f) => f.about.toLowerCase()))
    for (const world of WORLDS) {
      expect([...subjects].some((s) => s.includes(world.name.toLowerCase())), world.name).toBe(true)
    }
    for (const other of ['space', 'the moon', 'the stars']) expect(subjects).toContain(other)
  })

  it('does not hand back one that has just been read', () => {
    const seen: string[] = []
    for (let i = 0; i < FACTS.length; i++) {
      const fact = pickFact(seen, (i * 0.137) % 1)
      expect(seen, `repeat at ${i}`).not.toContain(fact.text)
      seen.push(fact.text)
    }
    // And once they are all used up it carries on rather than failing.
    expect(pickFact(seen, 0.5).text.length).toBeGreaterThan(0)
  })

  it('takes any roll the caller hands it', () => {
    for (const roll of [0, 0.5, 0.999, 1]) {
      expect(pickFact([], roll)).toBeDefined()
    }
  })
})
