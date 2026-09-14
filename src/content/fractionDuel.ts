import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { tier } from './util'

/**
 * Which fraction is bigger.
 *
 * The rating ladder is really a ladder of *strategies*. Low down, the pairs
 * yield to "same top, bigger bottom is smaller". Higher up they are built
 * specifically so that rule fails and the player has to reach for benchmarking
 * against 1/2, and then for distance from 1. Procedure runs out; reasoning does not.
 */

const BOUNDS = [400, 750, 1100, 1500, 1900] as const

interface Frac {
  n: number
  d: number
}

const show = (f: Frac) => `${f.n}/${f.d}`
const value = (f: Frac) => f.n / f.d

export const fractionDuel: Generator = {
  id: 'fraction-duel',
  name: 'Fraction Duel',
  blurb: 'Two fractions enter. One is bigger.',
  minRating: 400,
  maxRating: 2600,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const t = tier(rating, BOUNDS)

    let a: Frac
    let b: Frac
    let hints: string[]
    let explain: string

    switch (t) {
      case 0: {
        const [d1, d2] = distinct(rng, 2, 10)
        a = { n: 1, d: d1 }
        b = { n: 1, d: d2 }
        hints = [
          'One whole thing, cut into more pieces. Are the pieces bigger or smaller?',
          `Would you rather have one slice of a cake cut into ${d1}, or one cut into ${d2}?`,
        ]
        explain = `Cutting a whole into more pieces makes every piece smaller, so ${show(a)} and ${show(b)}: the one with the smaller bottom number wins.`
        break
      }

      case 1: {
        if (rng.next() < 0.5) {
          const n = rng.int(2, 5)
          const [d1, d2] = distinct(rng, n + 1, n + 8)
          a = { n, d: d1 }
          b = { n, d: d2 }
          hints = ['Same number of pieces in each. Only the size of a piece differs.']
          explain = `Both take ${n} pieces. The pieces of ${show(a.d < b.d ? a : b)} are bigger, so that side wins.`
        } else {
          const d = rng.int(5, 12)
          const [n1, n2] = distinct(rng, 1, d - 1)
          a = { n: n1, d }
          b = { n: n2, d }
          hints = ['Same size pieces in each. Just count them.']
          explain = `The pieces are the same size, so more of them is more: ${show(a.n > b.n ? a : b)} wins.`
        }
        break
      }

      case 2: {
        a = belowHalf(rng)
        b = aboveHalf(rng)
        if (rng.next() < 0.5) [a, b] = [b, a]
        hints = [
          'Try comparing each one to a half instead of to each other.',
          'Double the top number. Is it more or less than the bottom?',
        ]
        explain = `One of these is under a half and the other is over it, so they never need to be compared directly. Double the top: if it clears the bottom, the fraction is more than a half.`
        break
      }

      case 3: {
        // Both on the same side of 1/2, and sharing neither top nor bottom, so
        // the easy rules give nothing.
        ;[a, b] = sameSideOfHalf(rng)
        hints = [
          'A half is no help here — both are on the same side of it.',
          'How far is each one from a half? The closer one is the smaller, if both are above.',
        ]
        explain = `Both sit on the same side of a half, so the benchmark alone cannot separate them. Comparing ${a.n} x ${b.d} against ${b.n} x ${a.d} settles it: ${a.n * b.d} against ${b.n * a.d}.`
        break
      }

      default: {
        // Both a whisker under 1: the gap above is what actually differs.
        const [g1, g2] = distinct(rng, 1, 3)
        const d1 = rng.int(5, 14)
        const d2 = rng.int(5, 14)
        a = { n: d1 - g1, d: d1 }
        b = { n: d2 - g2, d: d2 }
        if (value(a) === value(b)) b = { n: d2 - g2 - 1, d: d2 }
        hints = [
          'Both are nearly a whole. Stop looking at what is there.',
          `How much is *missing* from each? ${show(a)} is short by ${g1}/${d1}.`,
        ]
        explain = `${show(a)} is ${g1}/${d1} short of a whole and ${show(b)} is ${g2}/${d2} short. Whichever is missing less is the bigger fraction.`
        break
      }
    }

    if (value(a) === value(b)) b = { n: b.n, d: b.d + 1 }

    const options = [show(a), show(b)]
    const correctIndex = value(a) > value(b) ? 0 : 1

    return {
      id: `fraction-duel:${seed}`,
      kind: 'fraction-duel',
      rating,
      seed,
      prompt: `{papa} says these are the same. Which one is actually bigger?`,
      answer: { type: 'choice', options, correctIndex },
      hints,
      explain,
      data: { a, b },
    }
  },
}

function distinct(rng: ReturnType<typeof makeRng>, lo: number, hi: number): [number, number] {
  const x = rng.int(lo, hi)
  let y = rng.int(lo, hi)
  while (y === x) y = rng.int(lo, hi)
  return [x, y]
}

function belowHalf(rng: ReturnType<typeof makeRng>): Frac {
  const d = rng.int(5, 12)
  return { n: rng.int(1, Math.max(1, Math.ceil(d / 2) - 1)), d }
}

function aboveHalf(rng: ReturnType<typeof makeRng>): Frac {
  const d = rng.int(5, 12)
  return { n: rng.int(Math.floor(d / 2) + 1, d - 1), d }
}

function sameSideOfHalf(rng: ReturnType<typeof makeRng>): [Frac, Frac] {
  const above = rng.next() < 0.5
  for (let i = 0; i < 60; i++) {
    const x = above ? aboveHalf(rng) : belowHalf(rng)
    const y = above ? aboveHalf(rng) : belowHalf(rng)
    if (x.n !== y.n && x.d !== y.d && value(x) !== value(y)) return [x, y]
  }
  return [
    { n: 3, d: 7 },
    { n: 4, d: 11 },
  ]
}
