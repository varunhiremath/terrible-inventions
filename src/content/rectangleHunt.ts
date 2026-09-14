import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { divisors, rectangleCount, tier } from './util'

/**
 * Rectangles from a pile of blocks.
 *
 * Starts as division and ends as divisor counting. Nobody has to say the word
 * "factor" — arranging blocks into rectangles *is* factoring, and the player
 * works out on his own that some numbers make exactly one rectangle.
 */

const BOUNDS = [400, 800, 1250, 1700] as const

export const rectangleHunt: Generator = {
  id: 'rectangle-hunt',
  name: 'Rectangle Hunt',
  blurb: 'Blocks into rectangles. Some numbers are stubborn.',
  minRating: 400,
  maxRating: 2600,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const base = { id: `rectangle-hunt:${seed}`, kind: 'rectangle-hunt' as const, rating, seed }

    switch (tier(rating, BOUNDS)) {
      case 0: {
        // Find the missing side.
        const h = rng.int(2, 6)
        const w = rng.int(3, 12)
        const n = w * h
        return {
          ...base,
          prompt: `{papa} has ${n} blocks and wants one solid rectangle exactly ${h} blocks tall. How wide will it be?`,
          answer: { type: 'number', value: w },
          hints: [
            `A rectangle ${h} blocks tall uses ${h} blocks in every column.`,
            `So: how many columns of ${h} fit into ${n}?`,
          ],
          explain: `${n} split into rows of ${h} gives ${w}. Height times width is the block count, so ${h} x ${w} = ${n}.`,
          data: { w, h, n },
        }
      }

      case 1: {
        // Count the rectangles for one number.
        const n = pickInteresting(rng.int(12, 48), 2, 6)
        return {
          ...base,
          prompt: `Using all ${n} blocks every time, how many different rectangles can {kid} build? (A ${2} x ${3} and a ${3} x ${2} count as the same rectangle.)`,
          answer: { type: 'number', value: rectangleCount(n) },
          hints: [
            `Try each height in turn: 1, 2, 3, ... Does that height divide ${n} evenly?`,
            `The sides that work are ${divisors(n).join(', ')} — now pair them up.`,
          ],
          explain: `${n} has these whole-number sides: ${divisors(n).join(', ')}. They pair off into ${rectangleCount(n)} rectangles.`,
          data: { n },
        }
      }

      case 2: {
        // Which number in a range is the most flexible?
        const span = 12
        const lo = rng.int(20, 60)
        const { winner, hi } = uniqueMax(lo, lo + span)
        return {
          ...base,
          prompt: `{papa} wants the most choices. Which number from ${lo} to ${hi} can be built into the most different rectangles?`,
          answer: { type: 'number', value: winner },
          hints: [
            'Numbers with lots of different whole-number sides win.',
            'Even numbers usually beat odd ones. Check the ones divisible by 12 first.',
          ],
          explain: `${winner} makes ${rectangleCount(winner)} rectangles — more than anything else between ${lo} and ${hi}. Numbers that split lots of ways are the flexible ones.`,
          data: { lo, hi },
        }
      }

      default: {
        // Run the question backwards: the count is given, find the number.
        const want = rng.int(3, Math.round(3 + Math.min(4, (rating - 1700) / 260)))
        const from = rng.int(2, 30)
        const answer = smallestWithRectangleCount(want, from)
        return {
          ...base,
          prompt: `What is the smallest number above ${from} that can be built into exactly ${want} different rectangles?`,
          answer: { type: 'number', value: answer },
          hints: [
            `Exactly ${want} rectangles means exactly ${want} ways to pair up its sides.`,
            'Work upward from the number given and count the sides of each one.',
          ],
          explain: `${answer} has sides ${divisors(answer).join(', ')}, which pair into exactly ${want} rectangles — and nothing between ${from} and ${answer} does.`,
          data: { from, want },
        }
      }
    }
  },
}

/** Nudges to a nearby number with a rectangle count in the interesting middle. */
function pickInteresting(n: number, minCount: number, maxCount: number): number {
  for (let step = 0; step < 20; step++) {
    for (const candidate of [n + step, n - step]) {
      if (candidate < 6) continue
      const c = rectangleCount(candidate)
      if (c >= minCount && c <= maxCount) return candidate
    }
  }
  return n
}

/** Widens the window until exactly one number in it holds the record. */
function uniqueMax(lo: number, hi: number): { winner: number; hi: number } {
  for (let end = hi; end < hi + 20; end++) {
    let best = lo
    let bestCount = -1
    let tied = false
    for (let n = lo; n <= end; n++) {
      const c = rectangleCount(n)
      if (c > bestCount) {
        bestCount = c
        best = n
        tied = false
      } else if (c === bestCount) {
        tied = true
      }
    }
    if (!tied) return { winner: best, hi: end }
  }
  return { winner: lo, hi }
}

function smallestWithRectangleCount(want: number, above: number): number {
  for (let n = above + 1; n < 100000; n++) if (rectangleCount(n) === want) return n
  return above + 1
}
