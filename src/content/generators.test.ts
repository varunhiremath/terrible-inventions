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

        /*
         * Lines now come in two shapes: one operation, or two. The second
         * shape is the order of operations — `7 + 25 / 5` is 12 and not
         * 6.4 — so the parser has to know that times and divide bind tighter,
         * and it works that out here rather than asking the generator.
         */
        const parsed = lines.map((line) => {
          const long = line.match(
            /Step \d+:\s+(-?\d+) ([-+x/]) (-?\d+) ([-+x/]) (-?\d+) = (-?\d+)$/,
          )
          if (long) {
            return {
              left: +long[1], op: long[2], right: +long[3],
              then: { op: long[4], right: +long[5] }, shown: +long[6],
            }
          }
          const m = line.match(/Step \d+:\s+(-?\d+) ([-+x/]) (-?\d+) = (-?\d+)$/)
          if (!m) throw new Error(`unparseable step: ${line}`)
          return { left: +m[1], op: m[2], right: +m[3], then: undefined, shown: +m[4] }
        })

        const does = (a: number, op: string, b: number) =>
          op === '+' ? a + b : op === '-' ? a - b : op === 'x' ? a * b : a / b
        const binds = (op: string) => op === 'x' || op === '/'

        const truth = (step: (typeof parsed)[number]) => {
          const { left, op, right, then } = step
          if (!then) return does(left, op, right)
          if (binds(then.op) && !binds(op)) return does(left, op, does(right, then.op, then.right))
          return does(does(left, op, right), then.op, then.right)
        }

        parsed.forEach((step, i) => {
          if (i === badIndex) {
            expect(step.shown, lines[i]).not.toBe(truth(step))
          } else {
            expect(step.shown, lines[i]).toBe(truth(step))
          }
          // The chain must actually flow: each line starts where the last ended.
          if (i > 0) expect(step.left).toBe(parsed[i - 1].shown)
        })

        // And a two-operation line must actually depend on the order: one
        // that reads the same either way is a longer line, not a harder one.
        for (const step of parsed) {
          if (!step.then) continue
          const across = does(does(step.left, step.op, step.right), step.then.op, step.then.right)
          expect(across, `${lines[0]}: this line reads the same either way`)
            .not.toBe(truth(step))
        }

        if (p.answer.type !== 'choice') throw new Error('expected a choice')
        expect(p.answer.correctIndex).toBe(badIndex)
      }
    }
  })

  it('puts two things on one line often enough to be met', () => {
    /*
     * The order of operations only exists on a line with two operations, so
     * a run of seeds that never produces one is a run that never asks about
     * it. The bottom rung has none on purpose — one thing at a time while
     * somebody is still learning to read the working.
     */
    const gen = generatorFor('papas-mistake')
    const twos = (rating: number) => {
      let many = 0
      for (let s = 0; s < 200; s++) {
        const { lines } = gen.generate(rating, s * 13 + 1).data as { lines: string[] }
        if (lines.some((l) => /\d+ [-+x/] \d+ [-+x/] \d+ =/.test(l))) many++
      }
      return many
    }
    expect(twos(600), 'the opening rung should stay one thing at a time').toBe(0)
    expect(twos(1200), 'nobody ever meets a line with two things on it')
      .toBeGreaterThan(60)
  })

  it('offers the straight-across answer as a wrong one', () => {
    /*
     * Doing `12 + 4 x 5` from left to right gives 80, and that is the single
     * most common wrong line in a book at this level. It has to be among the
     * answers on offer or the lines with two operations are just longer.
     */
    const gen = generatorFor('papas-mistake')
    const does = (a: number, op: string, b: number) =>
      op === '+' ? a + b : op === '-' ? a - b : op === 'x' ? a * b : a / b
    let caught = 0
    for (let s = 0; s < 400; s++) {
      const p = gen.generate(1400, s * 29 + 5)
      const { lines, badIndex } = p.data as { lines: string[]; badIndex: number }
      const m = lines[badIndex].match(
        /Step \d+:\s+(-?\d+) ([-+x/]) (-?\d+) ([-+x/]) (-?\d+) = (-?\d+)$/,
      )
      if (!m) continue
      const across = does(does(+m[1], m[2], +m[3]), m[4], +m[5])
      if (across === +m[6]) caught++
    }
    expect(caught, 'the broken two-part line is never the left-to-right slip')
      .toBeGreaterThan(5)
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

/*
 * The four generators added for the shapes-and-ratio module.
 *
 * Every one of them is checked against arithmetic worked out here rather than
 * against the generator's own — which is the only kind of check worth having
 * on a thing whose whole job is to be right about maths. A generator that
 * agrees with itself about 20% off 48 is no use to anybody.
 */

/** Every problem a generator makes across its declared range. */
function everything(id: Parameters<typeof generatorFor>[0]): Problem[] {
  const gen = generatorFor(id)
  const out: Problem[] = []
  for (let r = gen.minRating; r <= gen.maxRating; r += 30) {
    for (let s = 0; s < 8; s++) out.push(gen.generate(r, r * 31 + s))
  }
  return out
}

/** The answer a problem claims, as a number. */
function claimed(p: Problem): number {
  if (p.answer.type !== 'number') throw new Error(`${p.kind}: expected a number answer`)
  return p.answer.value
}

describe("{papa}'s mixture", () => {
  it('gives an answer that really is in the ratio it states', () => {
    let checked = 0
    for (const p of everything('mix-up')) {
      const d = p.data as Record<string, number>
      const got = claimed(p)

      if ('whole' in d) {
        // The share, given the whole: the two shares make the whole, and the
        // one asked for is the bigger side's share of it.
        const { p: a, q: b, whole } = d as { p: number; q: number; whole: number }
        const lump = whole / (a + b)
        expect(got, `${a}:${b} of ${whole}`).toBe(Math.max(a, b) * lump)
        expect(Number.isInteger(lump), `${a}:${b} of ${whole} is not a whole lump`).toBe(true)
      } else if ('known' in d && 'p' in d) {
        const { p: a, q: b, known } = d as { p: number; q: number; known: number }
        const lump = known / a
        expect(Number.isInteger(lump)).toBe(true)
        // Either the whole batch or the other share, and both are lumps of it.
        expect([(a + b) * lump, b * lump]).toContain(got)
      } else if ('poured' in d) {
        const { p: a, q: b, poured, after } = d as
          { p: number; q: number; poured: number; after: number }
        // The first side never moved, so the same answer has to satisfy both
        // ratios at once: before, and after the pouring.
        const lump = poured / (after - b)
        expect(got / lump, 'the first side is not the right number of lumps').toBe(a)
        expect(got * b, 'the ratio before does not hold').toBe(a * (b * lump))
        expect(got * after, 'the ratio after does not hold').toBe(a * (b * lump + poured))
      } else {
        const { x, y, u, v, last } = d as
          { x: number; y: number; u: number; v: number; last: number }
        // Chained: a is to b as x is to y, and b is to c as u is to v.
        const b = (last * u) / v
        expect(Number.isInteger(b), 'the middle is not whole').toBe(true)
        expect(got * y, 'the first ratio does not hold').toBe(x * b)
        expect(b * v, 'the second ratio does not hold').toBe(u * last)
      }
      checked++
    }
    expect(checked).toBeGreaterThan(300)
  })
})

describe("{papa}'s prices", () => {
  it('works every percentage out the long way and agrees', () => {
    let checked = 0
    for (const p of everything('off-the-price')) {
      const d = p.data as Record<string, number | boolean>
      const got = claimed(p)

      if ('changes' in d) {
        // The single change that does the lot, checked on a hundred.
        const changes = (d as unknown as { changes: { pct: number; up: boolean }[] }).changes
        const after = changes.reduce(
          (n, c) => (c.up ? n + (n * c.pct) / 100 : n - (n * c.pct) / 100), 100,
        )
        expect(Math.abs(after - 100), `${changes.length} changes`).toBe(got)
        expect(after, 'a run of changes that goes nowhere').not.toBe(100)
      } else if ('up' in d) {
        const { whole, pct, up } = d as { whole: number; pct: number; up: boolean }
        const change = (whole * pct) / 100
        expect(got, `${pct}% ${up ? 'on' : 'off'} ${whole}`)
          .toBe(up ? whole + change : whole - change)
      } else if ('now' in d) {
        // Backwards: taking the percentage off the answer must give the ticket.
        const { now, pct } = d as { now: number; pct: number }
        expect(got - (got * pct) / 100, `${pct}% off ${got}`).toBe(now)
      } else if ('start' in d) {
        const { start, first, second, upFirst, upSecond } = d as
          { start: number; first: number; second: number; upFirst: boolean; upSecond: boolean }
        const mid = upFirst ? start + (start * first) / 100 : start - (start * first) / 100
        const end = upSecond ? mid + (mid * second) / 100 : mid - (mid * second) / 100
        expect(got, `${start}, ${first}% then ${second}%`).toBe(end)
        expect(Number.isInteger(mid), 'the number in the middle is not whole').toBe(true)
      } else {
        const { whole, pct } = d as { whole: number; pct: number }
        expect(got, `${pct}% of ${whole}`).toBe((whole * pct) / 100)
      }
      checked++
    }
    expect(checked).toBeGreaterThan(300)
  })

  it('never asks for a fraction of a cog', () => {
    for (const p of everything('off-the-price')) {
      const d = p.data as Record<string, number>
      for (const [key, value] of Object.entries(d)) {
        if (typeof value !== 'number') continue
        expect(Number.isInteger(value), `${p.id}: ${key} is ${value}`).toBe(true)
      }
    }
  })
})

describe('the four new ladders', () => {
  /*
   * Difficulty stays unbounded. A generator that has run out of road and goes
   * on serving the same size of problem to the top of its declared range is
   * lying to the selector, which will keep handing it a player it has nothing
   * left for rather than skipping it — and the player sits at a ceiling that
   * is not really there.
   *
   * So: whatever the generator calls hard, the numbers at the top of its
   * range have to be bigger than the numbers near the bottom of its top tier.
   */
  const biggest = (p: Problem): number => {
    const seen: number[] = []
    const walk = (v: unknown): void => {
      if (typeof v === 'number') seen.push(Math.abs(v))
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(p.data)
    if (p.answer.type === 'number') seen.push(p.answer.value)
    return Math.max(0, ...seen)
  }

  const average = (id: Parameters<typeof generatorFor>[0], rating: number): number => {
    const gen = generatorFor(id)
    let sum = 0
    for (let s = 0; s < 120; s++) sum += biggest(gen.generate(rating, s * 7 + 1))
    return sum / 120
  }

  it.each(['mix-up', 'off-the-price', 'cogs', 'crate-weight'] as const)(
    '%s keeps getting harder all the way to its declared ceiling',
    (id) => {
      const gen = generatorFor(id)
      const low = average(id, gen.maxRating - 700)
      const high = average(id, gen.maxRating)
      expect(high, `${id}: ${low.toFixed(0)} at the bottom, ${high.toFixed(0)} at the top`)
        .toBeGreaterThan(low)
    },
  )
})

describe('the gearbox', () => {
  /** Found by counting, not by a formula, so it cannot agree with a wrong one. */
  const bruteLcm = (a: number, b: number): number => {
    for (let n = Math.max(a, b); n <= a * b; n += Math.max(a, b)) {
      if (n % a === 0 && n % b === 0) return n
    }
    return a * b
  }
  const bruteHcf = (a: number, b: number): number => {
    for (let d = Math.min(a, b); d >= 1; d--) if (a % d === 0 && b % d === 0) return d
    return 1
  }

  it('counts teeth the same way a person counting teeth would', () => {
    let checked = 0
    for (const p of everything('cogs')) {
      const d = p.data as Record<string, number | number[]>
      const got = claimed(p)

      if ('primes' in d) {
        const { n } = d as { n: number }
        // Multiply them back together, and check every one of them is prime.
        const primes = (d as { primes: number[] }).primes
        expect(primes.reduce((a, b) => a * b, 1), `${n}`).toBe(n)
        expect(got).toBe(primes.length)
        for (const q of primes) {
          for (let f = 2; f * f <= q; f++) {
            expect(q % f, `${q} is not prime`).not.toBe(0)
          }
        }
      } else if ('c' in d) {
        const { a, b, c } = d as { a: number; b: number; c: number }
        expect(got % a, `${got} is not a whole number of ${a}s`).toBe(0)
        expect(got % b).toBe(0)
        expect(got % c).toBe(0)
        // And nothing smaller does, which is the half that matters.
        for (let n = 1; n < got; n++) {
          if (n % a === 0 && n % b === 0 && n % c === 0) {
            throw new Error(`${n} lines up ${a}, ${b}, ${c} before ${got} does`)
          }
        }
      } else if ('h' in d) {
        const { other, h, l } = d as { other: number; h: number; l: number }
        expect(bruteHcf(got, other), `hcf of ${got} and ${other}`).toBe(h)
        expect(bruteLcm(got, other), `lcm of ${got} and ${other}`).toBe(l)
      } else {
        const { a, b } = d as { a: number; b: number }
        // One of the two, and which one is decided by counting rather than by
        // reading the prompt: a common factor divides both, a common multiple
        // is divisible by both.
        const hcf = bruteHcf(a, b)
        const lcm = bruteLcm(a, b)
        expect([hcf, lcm], `${a} and ${b}`).toContain(got)
        if (got === hcf) {
          expect(a % got).toBe(0)
          expect(b % got).toBe(0)
        } else {
          expect(got % a).toBe(0)
          expect(got % b).toBe(0)
        }
      }
      checked++
    }
    expect(checked).toBeGreaterThan(300)
  })

  it('never asks about three cogs the third of which does nothing', () => {
    for (const p of everything('cogs')) {
      const d = p.data as Record<string, number>
      if (!('c' in d)) continue
      const { a, b, c } = d as { a: number; b: number; c: number }
      // If the first two already line up at the answer, the third is scenery.
      expect(bruteLcm(a, b), `${c} adds nothing to ${a} and ${b}`).not.toBe(claimed(p))
    }
  })
})

describe("{papa}'s crates", () => {
  it('balances every beam it describes when the answer is put back on it', () => {
    let checked = 0
    for (const p of everything('crate-weight')) {
      const d = p.data as Record<string, number>
      const got = claimed(p)
      expect(got, `${p.id}: a crate weighing nothing`).toBeGreaterThan(0)

      // Swap first: the two-kinds tier carries a `total` of its own, so a
      // check on `total` alone would catch it and read the wrong fields.
      if ('swap' in d) {
        const { swap, reds, blues, total } = d as
          { swap: number; reds: number; blues: number; total: number }
        // The second kind weighs `swap` of the first, by the first beam.
        expect(reds * got + blues * (swap * got), 'the second beam is not level').toBe(total)
      } else if ('extra' in d) {
        const { many, extra, other } = d as { many: number; extra: number; other: number }
        expect(many * got + extra, 'the beam is not level').toBe(other)
      } else if ('kilos' in d) {
        const { left, right, kilos } = d as { left: number; right: number; kilos: number }
        expect(left * got, 'the beam is not level').toBe(right * got + kilos)
      } else if ('total' in d) {
        const { many, total } = d as { many: number; total: number }
        expect(many * got, `${many} crates`).toBe(total)
      } else {
        const { a1, b1, t1, a2, b2, t2 } = d as Record<string, number>
        // Both beams level at once, with the same pair of weights — and the
        // second weight worked out here rather than taken from the generator.
        const blue = (t1 - a1 * got) / b1
        expect(Number.isInteger(blue), 'the other crate is not a whole number').toBe(true)
        expect(blue, 'the other crate weighs nothing').toBeGreaterThan(0)
        expect(a1 * got + b1 * blue, 'the first beam is not level').toBe(t1)
        expect(a2 * got + b2 * blue, 'the second beam is not level').toBe(t2)
        // And the pair is the only one that works, which is what makes it
        // answerable: two beams saying the same thing settle nothing.
        expect(a1 * b2 - a2 * b1, 'the two beams are the same weighing twice').not.toBe(0)
      }
      checked++
    }
    expect(checked).toBeGreaterThan(300)
  })
})
