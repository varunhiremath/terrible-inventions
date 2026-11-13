import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { band, divisors, gcd, tier } from './util'

/**
 * Two cogs meshing: factors, primes, and the two numbers nobody names.
 *
 * The lowest common multiple and the highest common factor are taught as a
 * pair of procedures with a pair of acronyms, and most children come out of it
 * able to do both and knowing what neither one *is*. Which is a shame, because
 * a machine full of cogs says both of them out loud:
 *
 *  - two cogs meshing come back round together after the lowest common
 *    multiple of their teeth, and that is not a definition, it is a thing that
 *    happens on a bench;
 *  - and the biggest cog that drives two belts evenly has the highest common
 *    factor of their links.
 *
 * So nothing here says "LCM" or "HCF" until the explanation, and the question
 * is always about the machine. The ladder goes: factors, then primes, then the
 * two of them, then both at once, then backwards from both at once — which is
 * where it stops being arithmetic and becomes a search with a reason.
 *
 * Every answer is computed from the numbers, never authored.
 */

const BOUNDS = [400, 780, 1150, 1550, 2000] as const

export const cogs: Generator = {
  id: 'cogs',
  name: 'The Gearbox',
  blurb: 'Two cogs, meshed. When do the marks line up again?',
  minRating: 400,
  maxRating: 2800,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const base = { id: `cogs:${seed}`, kind: 'cogs' as const, rating, seed }

    switch (tier(rating, BOUNDS)) {
      case 0: {
        /*
         * Prime factors, asked as a machine that can only be built out of
         * small cogs. Starts as dividing and ends as the idea that there is
         * only one way to do it.
         */
        const n = pickComposite(rng, 20, 90)
        const primes = primeFactors(n)
        return {
          ...base,
          prompt:
            `{papa} builds a ${n}-tooth cog by stacking cogs with a prime ` +
            `number of teeth. How many cogs does he need?`,
          answer: { type: 'number', value: primes.length },
          hints: [
            'A prime has no whole-number sides except itself and one: 2, 3, 5, 7, 11, 13...',
            `Keep splitting ${n}: halve it while you can, then thirds, then fifths.`,
          ],
          explain:
            `${n} is ${primes.join(' x ')}, which is ${primes.length} cogs. ` +
            `Every number comes apart into primes exactly one way, however you ` +
            `start splitting it — so it does not matter which end you begin at.`,
          data: { n, primes },
        }
      }

      case 1: {
        // The biggest cog that drives both: the highest common factor.
        const [a, b] = pairWith(rng, (x, y) => gcd(x, y) >= 3 && gcd(x, y) < Math.min(x, y))
        const want = gcd(a, b)
        return {
          ...base,
          prompt:
            `Two belts have ${a} links and ${b} links. {papa} wants one cog ` +
            `that drives both of them with no link left over. What is the most ` +
            `teeth it can have?`,
          answer: { type: 'number', value: want },
          hints: [
            `The cog has to divide ${a} evenly, and ${b} evenly, both.`,
            `${a} goes evenly into sizes ${divisors(a).join(', ')}. Which of ` +
            `those also divides ${b}?`,
          ],
          explain:
            `${want} divides both ${a} and ${b}, and nothing bigger does. ` +
            `That is what a highest common factor is: the biggest thing that ` +
            `fits whole into both of them.`,
          data: { a, b },
        }
      }

      case 2: {
        // And the other one: when the marks come round together again.
        const [a, b] = pairWith(rng, (x, y) => lcm(x, y) > Math.max(x, y) && lcm(x, y) <= 400)
        const want = lcm(a, b)
        return {
          ...base,
          prompt:
            `A ${a}-tooth cog is meshed into a ${b}-tooth cog, and {papa} has ` +
            `painted one tooth on each of them. They start side by side. How ` +
            `many teeth go by before the two marks meet again?`,
          answer: { type: 'number', value: want },
          hints: [
            `The marks meet when the same number of teeth has gone past both.`,
            `So count up in ${a}s and in ${b}s and find where the two lists meet.`,
          ],
          explain:
            `After ${want} teeth the small cog has gone round ${want / a} ` +
            `times and the big one ${want / b}, both exactly — so the marks ` +
            `line up. ${want} is the lowest common multiple, and it is ` +
            `${a} x ${b} divided by the ${gcd(a, b)} they share.`,
          data: { a, b },
        }
      }

      case 3: {
        /*
         * Three cogs, which is where counting up in twos stops working and the
         * primes have to be used. Deliberately chosen so no pair of them
         * already gives the answer.
         */
        const [a, b, c] = tripleWith(rng, Math.round(band(rating, [[1550, 18], [2000, 30]])))
        const want = lcm(lcm(a, b), c)
        return {
          ...base,
          prompt:
            `Three cogs — ${a}, ${b} and ${c} teeth — all driven by the same ` +
            `chain, all marked and all starting level. How many teeth go by ` +
            `before all three marks are level again?`,
          answer: { type: 'number', value: want },
          hints: [
            'Three lists to count up is a long way round. Break each cog into its primes instead.',
            `${a} is ${primeFactors(a).join(' x ')}, ${b} is ` +
            `${primeFactors(b).join(' x ')}, ${c} is ${primeFactors(c).join(' x ')}.`,
            'Take the most of each prime that any one of them needs, and multiply.',
          ],
          explain:
            `${want}. Take each prime as many times as the greediest cog wants ` +
            `it — that is the smallest number all three divide into. Doing the ` +
            `first two and then the third gives the same answer, which is worth ` +
            `knowing: it means three cogs is no harder than two, twice.`,
          data: { a, b, c },
        }
      }

      default: {
        /*
         * Backwards from both at once. The product of two numbers is always
         * their highest common factor times their lowest common multiple, so
         * being handed both and one of the numbers pins the other down — and
         * that relationship is the one thing in this topic that is genuinely
         * worth carrying away.
         */
        const big = Math.round(band(rating, [[2000, 120], [2800, 600]]))
        const want = pickComposite(rng, 12, big)
        const other = partnerFor(want, rng, big)
        const h = gcd(want, other)
        const l = lcm(want, other)
        return {
          ...base,
          prompt:
            `{papa} has lost a cog. All he has written down is that the ` +
            `biggest cog that drives both it and the ${other}-tooth one has ` +
            `${h} teeth, and that their two marks meet again after ${l}. ` +
            `How many teeth had the lost one?`,
          answer: { type: 'number', value: want },
          hints: [
            'Multiply the two numbers he does know together. Then look at the one he has.',
            `${h} x ${l} is ${h * l}, and that is the two cogs multiplied together.`,
          ],
          explain:
            `${h} x ${l} = ${h * l}, and that is always the two cogs ` +
            `multiplied: every prime is counted once as the most they share and ` +
            `once as the most either needs. So the lost one is ` +
            `${h * l} / ${other} = ${want}.`,
          data: { other, h, l },
        }
      }
    }
  },
}

const lcm = (a: number, b: number): number => (a * b) / gcd(a, b)

/** A number worth taking apart: not prime, and not a power of two. */
function pickComposite(rng: ReturnType<typeof makeRng>, lo: number, hi: number): number {
  for (let tries = 0; tries < 80; tries++) {
    const n = rng.int(lo, hi)
    const primes = primeFactors(n)
    if (primes.length >= 2 && new Set(primes).size >= 2) return n
  }
  return 36
}

export function primeFactors(n: number): number[] {
  const out: number[] = []
  let rest = n
  for (let d = 2; d * d <= rest; d++) {
    while (rest % d === 0) {
      out.push(d)
      rest /= d
    }
  }
  if (rest > 1) out.push(rest)
  return out
}

/** Two cog sizes that make the question worth asking. */
function pairWith(
  rng: ReturnType<typeof makeRng>,
  good: (a: number, b: number) => boolean,
): [number, number] {
  for (let tries = 0; tries < 120; tries++) {
    const a = rng.int(6, 40)
    const b = rng.int(6, 40)
    if (a !== b && good(a, b)) return a < b ? [a, b] : [b, a]
  }
  return [12, 18]
}

/**
 * Three cogs where the third one actually matters.
 *
 * Without that condition a third cog whose teeth already divide the first
 * two's answer is decoration, and the problem is the easier one wearing an
 * extra number.
 */
function tripleWith(rng: ReturnType<typeof makeRng>, top: number): [number, number, number] {
  for (let tries = 0; tries < 400; tries++) {
    const a = rng.int(4, top)
    const b = rng.int(4, top)
    const c = rng.int(4, top)
    if (a === b || b === c || a === c) continue
    // One cog that simply divides another is a cog that goes round a whole
    // number of times for free, and the pair teaches nothing about multiples.
    if (b % a === 0 || a % b === 0) continue
    const both = lcm(a, b)
    const all = lcm(both, c)
    if (all === both) continue
    if (all > 40 * top) continue
    return [a, b, c]
  }
  return [4, 6, 9]
}

/** A partner for `n` that shares something with it but is not a multiple of it. */
function partnerFor(n: number, rng: ReturnType<typeof makeRng>, top: number): number {
  for (let tries = 0; tries < 200; tries++) {
    const other = rng.int(6, Math.max(12, Math.round(top / 2)))
    if (other === n) continue
    const h = gcd(n, other)
    // Three at least. A cog with two teeth is a thing nobody has ever built,
    // and a problem whose furniture is absurd gets read as a trick.
    if (h < 3) continue
    if (n % other === 0 || other % n === 0) continue
    return other
  }
  return n % 2 === 0 ? 6 : 15
}
