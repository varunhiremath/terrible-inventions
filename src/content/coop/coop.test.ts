import { describe, expect, it } from 'vitest'
import { COOP_GENERATORS, coopGeneratorFor, renderClue } from './index'
import { countSolutions, permutations, satisfies } from './solver'
import type { Clue, CoopProblem } from './types'

const splitClues = coopGeneratorFor('split-clues')

function sweep(): CoopProblem[] {
  const out: CoopProblem[] = []
  for (let r = splitClues.minRating; r <= splitClues.maxRating; r += 100) {
    for (let s = 0; s < 6; s++) out.push(splitClues.generate(r, r * 31 + s))
  }
  return out
}

const problems = sweep()

describe('solver', () => {
  it('enumerates permutations', () => {
    expect(permutations(1)).toEqual([[0]])
    expect(permutations(3)).toHaveLength(6)
    expect(permutations(4)).toHaveLength(24)
    expect(new Set(permutations(4).map(String)).size).toBe(24)
  })

  it('counts every assignment when nothing is constrained', () => {
    expect(countSolutions(3, 1, [], 100)).toBe(6) // 3!
    expect(countSolutions(3, 2, [], 100)).toBe(36) // 3! squared
  })

  it('stops counting at the limit', () => {
    expect(countSolutions(4, 2, [], 5)).toBe(5)
  })

  it('applies each clue form', () => {
    // Two machines, one category: only two assignments exist.
    expect(countSolutions(2, 1, [{ kind: 'is', subject: 0, cat: 0, value: 0 }], 10)).toBe(1)
    expect(countSolutions(2, 1, [{ kind: 'isNot', subject: 0, cat: 0, value: 0 }], 10)).toBe(1)

    const link: Clue = { kind: 'link', catA: 0, valA: 0, catB: 1, valB: 0 }
    expect(countSolutions(2, 2, [link], 10)).toBe(2)
    const notLink: Clue = { kind: 'notLink', catA: 0, valA: 0, catB: 1, valB: 0 }
    expect(countSolutions(2, 2, [notLink], 10)).toBe(2)
    expect(countSolutions(2, 2, [link, notLink], 10)).toBe(0)
  })

  it('returns zero for contradictory clues', () => {
    expect(
      countSolutions(3, 1, [
        { kind: 'is', subject: 0, cat: 0, value: 0 },
        { kind: 'isNot', subject: 0, cat: 0, value: 0 },
      ]),
    ).toBe(0)
  })
})

describe('split clues', () => {
  it('is reachable through the registry', () => {
    expect(COOP_GENERATORS).toContain(splitClues)
  })

  it('states only true things', () => {
    for (const p of problems) {
      for (const clue of [...p.cluesA, ...p.cluesB]) {
        expect(satisfies(clue, p.solution)).toBe(true)
      }
    }
  })

  it('has exactly one answer once both halves are on the table', () => {
    for (const p of problems) {
      const all = [...p.cluesA, ...p.cluesB]
      expect(countSolutions(p.subjects.length, p.categories.length, all, 5)).toBe(1)
    }
  })

  // The whole mode rests on this. If either half were ever sufficient, one
  // player could solve it alone and the other would be watching.
  it('cannot be solved from either half alone', () => {
    for (const p of problems) {
      const n = p.subjects.length
      const m = p.categories.length
      expect(countSolutions(n, m, p.cluesA, 5)).toBeGreaterThan(1)
      expect(countSolutions(n, m, p.cluesB, 5)).toBeGreaterThan(1)
    }
  })

  it('deals a real share to both people', () => {
    for (const p of problems) {
      expect(p.cluesA.length).toBeGreaterThan(0)
      expect(p.cluesB.length).toBeGreaterThan(0)
      // Dealt alternately, so the hands never differ by more than one clue.
      expect(Math.abs(p.cluesA.length - p.cluesB.length)).toBeLessThanOrEqual(1)
    }
  })

  it('uses a minimal clue set, which is what guarantees the split works', () => {
    for (const p of problems) {
      const all = [...p.cluesA, ...p.cluesB]
      for (let i = 0; i < all.length; i++) {
        const without = all.filter((_, j) => j !== i)
        expect(countSolutions(p.subjects.length, p.categories.length, without, 5)).toBeGreaterThan(1)
      }
    }
  })

  it('builds a well-formed puzzle at every rating', () => {
    for (const p of problems) {
      expect(p.subjects.length).toBeGreaterThanOrEqual(3)
      expect(new Set(p.subjects).size).toBe(p.subjects.length)
      expect(new Set(p.categories.map((c) => c.name)).size).toBe(p.categories.length)
      expect(p.solution).toHaveLength(p.categories.length)

      // Every category assigns each machine a different value.
      for (const row of p.solution) {
        expect(row).toHaveLength(p.subjects.length)
        expect(new Set(row).size).toBe(row.length)
      }

      expect(p.brief.trim().length).toBeGreaterThan(0)
      expect(p.hints.length).toBeGreaterThan(0)
      expect(p.explain).toContain('exactly one')
    }
  })

  it('is deterministic for a given seed, and varies across seeds', () => {
    const a = JSON.stringify(splitClues.generate(1200, 99).cluesA)
    const b = JSON.stringify(splitClues.generate(1200, 99).cluesA)
    expect(a).toBe(b)

    const many = new Set(
      Array.from({ length: 20 }, (_, s) => JSON.stringify(splitClues.generate(1200, s).solution)),
    )
    expect(many.size).toBeGreaterThan(5)
  })

  it('gets harder as the rating climbs', () => {
    const sizeAt = (rating: number) => splitClues.generate(rating, 7).subjects.length
    expect(sizeAt(2400)).toBeGreaterThan(sizeAt(700))
  })

  it('renders every clue form as a readable sentence', () => {
    for (const p of problems.slice(0, 40)) {
      for (const clue of [...p.cluesA, ...p.cluesB]) {
        const text = renderClue(clue, p.subjects, p.categories)
        expect(text).toMatch(/^[A-Z].*\.$/)
        expect(text).not.toContain('undefined')
      }
    }
  })
})

describe('anchoring', () => {
  it('almost always gives the pair somewhere to start', () => {
    // A grid of nothing but "is not" clues is solvable but has no foothold.
    // Not guaranteed — minimality wins over this preference — but it should be
    // the overwhelming majority.
    const anchored = problems.filter((p) =>
      [...p.cluesA, ...p.cluesB].some((c) => c.kind === 'is'),
    )
    expect(anchored.length / problems.length).toBeGreaterThan(0.9)
  })

  it('never trades away the fair split to get an anchor', () => {
    for (const p of problems) {
      const n = p.subjects.length
      const m = p.categories.length
      expect(countSolutions(n, m, p.cluesA, 5)).toBeGreaterThan(1)
      expect(countSolutions(n, m, p.cluesB, 5)).toBeGreaterThan(1)
      expect(countSolutions(n, m, [...p.cluesA, ...p.cluesB], 5)).toBe(1)
    }
  })
})
