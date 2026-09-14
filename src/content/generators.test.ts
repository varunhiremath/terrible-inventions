import { describe, expect, it } from 'vitest'
import { GENERATORS, generatorFor } from './index'
import { countPaths } from './pathCount'
import { rectangleCount, divisors, band, tier } from './util'
import { __test as kkTest } from './knightsKnaves'
import type { Problem } from '../engine/types'

/** Every generator, swept across its whole declared range. */
function sweep(gen: (typeof GENERATORS)[number]): Problem[] {
  const out: Problem[] = []
  const step = Math.max(25, Math.round((gen.maxRating - gen.minRating) / 40))
  for (let r = gen.minRating; r <= gen.maxRating; r += step) {
    for (let s = 0; s < 12; s++) out.push(gen.generate(r, r * 1000 + s))
  }
  return out
}

describe.each(GENERATORS.map((g) => [g.id, g] as const))('%s', (_id, gen) => {
  const problems = sweep(gen)

  it('produces a well-formed problem everywhere in its range', () => {
    for (const p of problems) {
      expect(p.prompt.trim().length).toBeGreaterThan(0)
      expect(p.explain.trim().length).toBeGreaterThan(0)
      expect(p.hints.length).toBeGreaterThan(0)
      expect(p.hints.every((h) => h.trim().length > 0)).toBe(true)
      expect(p.kind).toBe(gen.id)
    }
  })

  it('produces an answer that can actually be entered and checked', () => {
    for (const p of problems) {
      switch (p.answer.type) {
        case 'number':
          expect(Number.isFinite(p.answer.value)).toBe(true)
          expect(Number.isInteger(p.answer.value)).toBe(true)
          expect(p.answer.value).toBeGreaterThanOrEqual(0)
          break
        case 'choice':
          expect(p.answer.options.length).toBeGreaterThan(1)
          expect(p.answer.correctIndex).toBeGreaterThanOrEqual(0)
          expect(p.answer.correctIndex).toBeLessThan(p.answer.options.length)
          expect(new Set(p.answer.options).size).toBe(p.answer.options.length)
          break
        case 'set':
          expect(Array.isArray(p.answer.values)).toBe(true)
          expect(new Set(p.answer.values).size).toBe(p.answer.values.length)
          break
      }
    }
  })

  it('is deterministic for a given seed', () => {
    const a = gen.generate(1200, 4242)
    const b = gen.generate(1200, 4242)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not produce the same problem for every seed', () => {
    const ids = new Set(Array.from({ length: 30 }, (_, s) => JSON.stringify(gen.generate(1200, s))))
    expect(ids.size).toBeGreaterThan(5)
  })

  it('is reachable through the registry', () => {
    expect(generatorFor(gen.id)).toBe(gen)
  })
})

describe('util', () => {
  it('counts rectangles as divisor pairs', () => {
    expect(rectangleCount(1)).toBe(1) // 1x1
    expect(rectangleCount(12)).toBe(3) // 1x12, 2x6, 3x4
    expect(rectangleCount(16)).toBe(3) // 1x16, 2x8, 4x4
    expect(rectangleCount(7)).toBe(1) // prime: only 1x7
    expect(rectangleCount(36)).toBe(5)
  })

  it('lists divisors in order', () => {
    expect(divisors(28)).toEqual([1, 2, 4, 7, 14, 28])
    expect(divisors(1)).toEqual([1])
  })

  it('interpolates and clamps bands', () => {
    const stops = [
      [0, 10],
      [100, 20],
    ] as const
    expect(band(-50, stops)).toBe(10)
    expect(band(50, stops)).toBe(15)
    expect(band(500, stops)).toBe(20)
  })

  it('buckets ratings into tiers by lower bound', () => {
    const bounds = [400, 800, 1200]
    expect(tier(100, bounds)).toBe(0) // below the floor clamps to the first tier
    expect(tier(500, bounds)).toBe(0)
    expect(tier(900, bounds)).toBe(1)
    expect(tier(1300, bounds)).toBe(2)
    expect(tier(5000, bounds)).toBe(2)
  })
})

describe('path counting', () => {
  it('matches the binomial coefficient on an open grid', () => {
    expect(countPaths({ cols: 3, rows: 3, blocked: [] })).toBe(6)
    expect(countPaths({ cols: 4, rows: 4, blocked: [] })).toBe(20)
    expect(countPaths({ cols: 1, rows: 5, blocked: [] })).toBe(1)
    expect(countPaths({ cols: 6, rows: 3, blocked: [] })).toBe(21)
  })

  it('routes around blocked squares', () => {
    expect(countPaths({ cols: 3, rows: 3, blocked: [[1, 1]] })).toBe(2)
    expect(countPaths({ cols: 2, rows: 2, blocked: [[0, 1]] })).toBe(1)
  })

  it('returns zero when the grid is sealed off', () => {
    expect(
      countPaths({
        cols: 3,
        rows: 3,
        blocked: [
          [0, 1],
          [1, 0],
        ],
      }),
    ).toBe(0)
  })

  it('never serves an unsolvable grid', () => {
    const gen = generatorFor('path-count')
    for (let r = gen.minRating; r <= gen.maxRating; r += 50) {
      for (let s = 0; s < 15; s++) {
        const p = gen.generate(r, r + s * 31)
        const grid = p.data as Parameters<typeof countPaths>[0]
        expect(countPaths(grid)).toBeGreaterThan(0)
        expect(p.answer).toEqual({ type: 'number', value: countPaths(grid) })
      }
    }
  })
})

describe('fraction duel', () => {
  it('marks the genuinely larger fraction as correct', () => {
    const gen = generatorFor('fraction-duel')
    for (let r = gen.minRating; r <= gen.maxRating; r += 40) {
      for (let s = 0; s < 15; s++) {
        const p = gen.generate(r, r * 13 + s)
        if (p.answer.type !== 'choice') throw new Error('expected a choice')

        const values = p.answer.options.map((o) => {
          const [n, d] = o.split('/').map(Number)
          return n / d
        })
        const [x, y] = values
        expect(x).not.toBe(y)
        expect(p.answer.correctIndex).toBe(x > y ? 0 : 1)
      }
    }
  })
})

describe("papa's mistake", () => {
  it('breaks exactly one step, and keeps every later step self-consistent', () => {
    const gen = generatorFor('papas-mistake')

    for (let r = gen.minRating; r <= gen.maxRating; r += 40) {
      for (let s = 0; s < 15; s++) {
        const p = gen.generate(r, r * 7 + s)
        const { lines, badIndex } = p.data as { lines: string[]; badIndex: number }

        const parsed = lines.map((line) => {
          const m = line.match(/Step \d+:\s+(-?\d+) ([-+x/]) (-?\d+) = (-?\d+)$/)
          if (!m) throw new Error(`unparseable step: ${line}`)
          return { left: +m[1], op: m[2], right: +m[3], shown: +m[4] }
        })

        const truth = ({ left, op, right }: (typeof parsed)[number]) =>
          op === '+' ? left + right : op === '-' ? left - right : op === 'x' ? left * right : left / right

        parsed.forEach((step, i) => {
          if (i === badIndex) {
            expect(step.shown).not.toBe(truth(step))
          } else {
            expect(step.shown).toBe(truth(step))
          }
          // The chain must actually flow: each line starts where the last ended.
          if (i > 0) expect(step.left).toBe(parsed[i - 1].shown)
        })

        if (p.answer.type !== 'choice') throw new Error('expected a choice')
        expect(p.answer.correctIndex).toBe(badIndex)
      }
    }
  })
})

describe('faulty wiring', () => {
  it('always has exactly one consistent solution, and names it', () => {
    const gen = generatorFor('knights-knaves')

    for (let r = gen.minRating; r <= gen.maxRating; r += 40) {
      for (let s = 0; s < 10; s++) {
        const p = gen.generate(r, r * 17 + s)
        const { names } = p.data as { names: string[]; lines: { name: string; text: string }[] }

        if (p.answer.type !== 'set') throw new Error('expected a set')
        for (const v of p.answer.values) expect(names).toContain(v)
      }
    }
  })

  it('brute-forces consistency the same way the generator claims to', () => {
    // Bolt: "at least one of us is lying". Cog: "I tell the truth".
    // Only Bolt-truthful, Cog-lying survives: if Bolt were lying, nobody would
    // be lying, which is itself a contradiction.
    const statements = [{ kind: 'atLeastOneLies' as const }, { kind: 'selfTruthful' as const }]
    const found = kkTest.solutions(statements, 2)
    expect(found).toHaveLength(1)
    expect(found[0]).toEqual([true, false])
  })

  it('treats "I tell the truth" as saying nothing', () => {
    expect(kkTest.solutions([{ kind: 'selfTruthful' as const }], 1)).toHaveLength(2)
  })

  it('rejects an ambiguous pair rather than serving it', () => {
    // Bolt: "Cog is lying". Cog: "I tell the truth". Both labellings hold up,
    // so the generator's uniqueness check must throw this puzzle away.
    const statements = [{ kind: 'otherLies' as const, target: 1 }, { kind: 'selfTruthful' as const }]
    expect(kkTest.solutions(statements, 2)).toHaveLength(2)
  })
})
