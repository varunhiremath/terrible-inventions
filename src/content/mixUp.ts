import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { band, tier } from './util'

/**
 * {papa}'s mixtures: ratio and proportion.
 *
 * Ratio is the grade five idea that everything after it leans on — fractions
 * of a whole, scale, rate, similar shapes, and eventually gradient — and it is
 * also the one most often taught as a cross-multiplying ritual. So the ladder
 * here is a ladder of *what you have to find*, not of how big the numbers are:
 *
 *  - the share, given the whole;
 *  - the whole, given one share;
 *  - the other share, given one of them;
 *  - what happens to a ratio when something is added to one side;
 *  - and two ratios that have to be linked through the thing they share.
 *
 * Every one of them is the same single idea — the parts are equal-sized lumps
 * and the question is how big a lump is — and a player who finds that out does
 * not need any of the rituals. The hints all point at the lump.
 *
 * The numbers are chosen so that a lump is always a whole number of things.
 * Three and a half bolts is a different lesson.
 */

const BOUNDS = [400, 800, 1150, 1600, 2050] as const

/** What is being mixed, so that the problems are about something. */
const STUFF: readonly (readonly [string, string, string])[] = [
  ['rust remover', 'engine grease', 'tins'],
  ['red paint', 'white paint', 'pots'],
  ['iron filings', 'sawdust', 'scoops'],
  ['cold tea', 'bicarbonate', 'cups'],
  ['copper wire', 'string', 'reels'],
  ['gravel', 'cement', 'barrows'],
]

export const mixUp: Generator = {
  id: 'mix-up',
  name: "{papa}'s Mixture",
  blurb: 'Two things in a fixed ratio. One number is missing.',
  minRating: 400,
  maxRating: 2800,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const base = { id: `mix-up:${seed}`, kind: 'mix-up' as const, rating, seed }
    const [a, b, unit] = rng.pick(STUFF)

    switch (tier(rating, BOUNDS)) {
      case 0: {
        // The share, given the whole. The lump is the whole over the parts.
        const [p, q] = smallRatio(rng, 5)
        const lump = rng.int(2, 9)
        const whole = (p + q) * lump
        const bigger = p >= q
        const want = (bigger ? p : q) * lump
        return {
          ...base,
          prompt:
            `{papa} mixes ${a} and ${b} in the ratio ${p} to ${q}. ` +
            `He makes ${whole} ${unit} altogether. How many ${unit} of ` +
            `${bigger ? a : b} are in it?`,
          answer: { type: 'number', value: want },
          hints: [
            `${p} and ${q} makes ${p + q} equal lumps in every batch.`,
            `So ${whole} ${unit} split into ${p + q} lumps makes a lump of ${lump}.`,
          ],
          explain:
            `${p} + ${q} is ${p + q} lumps, and ${whole} shared into ${p + q} ` +
            `makes each lump ${lump}. ${bigger ? a : b} is ${bigger ? p : q} ` +
            `lumps, so ${bigger ? p : q} x ${lump} = ${want}.`,
          data: { p, q, whole },
        }
      }

      case 1: {
        // The whole, given one share. The same lump, found from the other end.
        const [p, q] = smallRatio(rng, 7)
        const lump = rng.int(3, 12)
        const known = p * lump
        return {
          ...base,
          prompt:
            `The mix is ${p} parts ${a} to ${q} parts ${b}. {papa} has used ` +
            `${known} ${unit} of ${a}. How many ${unit} will the whole batch be?`,
          answer: { type: 'number', value: (p + q) * lump },
          hints: [
            `${known} ${unit} is ${p} lumps, not one. How big is one lump?`,
            `A lump is ${known} / ${p} = ${lump}, and the batch is ${p + q} of them.`,
          ],
          explain:
            `${known} is ${p} lumps, so a lump is ${lump}. The batch is ` +
            `${p} + ${q} = ${p + q} lumps, which is ${(p + q) * lump}.`,
          data: { p, q, known },
        }
      }

      case 2: {
        // The other share. Now neither the whole nor the lump is handed over.
        const [p, q] = awkwardRatio(rng)
        const lump = rng.int(3, 14)
        const known = p * lump
        return {
          ...base,
          prompt:
            `{papa} keeps ${a} and ${b} at ${p} to ${q}. There are ${known} ` +
            `${unit} of ${a} in the vat. How many ${unit} of ${b} should go in?`,
          answer: { type: 'number', value: q * lump },
          hints: [
            'Neither number here is the whole batch. Find one lump first.',
            `${known} is ${p} lumps, so a lump is ${lump}, and ${b} wants ${q} of them.`,
          ],
          explain:
            `A lump is ${known} / ${p} = ${lump}. ${b} is ${q} lumps, so ` +
            `${q} x ${lump} = ${q * lump}. Notice that the two numbers never ` +
            `had to be added together at all.`,
          data: { p, q, known },
        }
      }

      case 3: {
        /*
         * A ratio that changes. This is where the lump stops being a trick and
         * starts being the only way through: the first side does not move, so
         * its number of lumps is the same before and after, and that is the
         * one thing the two ratios have in common.
         */
        /*
         * Both ratios in their lowest terms, before and after. A vat that is
         * 6 to 1 and becomes "6 to 3" is correct and nobody writes it down
         * that way: the second one is 2 to 1, and a child who spots that and
         * is told he has misread the question has been taught the wrong
         * lesson. So the pair is chosen so neither one can be cancelled.
         */
        const { p, q, after, extraLumps } = poach(rng)
        const lump = rng.int(2, 9)
        const poured = extraLumps * lump
        return {
          ...base,
          prompt:
            `The vat holds ${a} and ${b} at ${p} to ${q}. {papa} pours in ` +
            `${poured} more ${unit} of ${b} and nothing else, and now it is ` +
            `${p} to ${after}. How many ${unit} of ${a} are in the vat?`,
          answer: { type: 'number', value: p * lump },
          hints: [
            `Nothing was added to the ${a}, so its share of lumps never changed.`,
            `${b} went from ${q} lumps to ${after}, so ${poured} ${unit} is ` +
            `${lumps(extraLumps)}.`,
          ],
          explain:
            `${b} gained ${lumps(after - q)} and that cost ${poured} ${unit}, so ` +
            `a lump is ${lump}. ${a} was ${p} lumps all along, which is ` +
            `${p * lump}. The ${a} never moved — only the way it was counted did.`,
          data: { p, q, poured, after },
        }
      }

      default: {
        /*
         * Two ratios sharing a middle term, which have to be put on the same
         * footing before they can be joined. The whole difficulty is that the
         * middle thing is counted in different-sized lumps by each of them.
         */
        /*
         * The two ratios have to count the middle thing differently, or there
         * is nothing to put on a common footing and the hint reads "it is 5
         * in one and 5 in the other". That version is a one-step problem with
         * an extra number in it.
         */
        const { x, y, u, v } = chain(rng, Math.round(band(rating, [[2050, 6], [2800, 14]])))
        const c = rng.pick(STUFF.filter((s) => s[0] !== a && s[0] !== b))[0]
        // Put the middle on y * u so both ratios measure it in whole lumps.
        const middle = y * u
        // And the batch grows with the rating, so the generator does not run
        // out of road halfway up its own declared range.
        const scale = rng.int(1, Math.round(band(rating, [[2050, 4], [2800, 15]])))
        const first = x * u * scale
        const last = y * v * scale
        return {
          ...base,
          prompt:
            `{papa} keeps ${a} to ${b} at ${x} to ${y}, and ${b} to ${c} at ` +
            `${u} to ${v}. There are ${last} ${unit} of ${c}. How many ${unit} ` +
            `of ${a} are there?`,
          answer: { type: 'number', value: first },
          hints: [
            `${b} is in both ratios, but it is ${y} in one and ${u} in the other.`,
            `Make them agree: ${x} to ${y} is the same as ${x * u} to ` +
            `${y * u}, and ${u} to ${v} is the same as ${y * u} to ${y * v}.`,
            `So all three together are ${x * u} to ${middle} to ${y * v}.`,
          ],
          explain:
            `Rewritten so ${b} is ${middle} in both, the three of them are ` +
            `${x * u} to ${middle} to ${y * v}. ${last} of ${c} is ${scale} ` +
            `lump${scale === 1 ? '' : 's'}, so ${a} is ${x * u} x ${scale} = ${first}.`,
          data: { x, y, u, v, last },
        }
      }
    }
  },
}

/**
 * A ratio that changes when something is poured into one side of it.
 *
 * Both halves in lowest terms, and the first side's count left alone, which
 * is what makes the problem solvable: `p` lumps of the first thing before and
 * `p` lumps after, so the lump can be found from what the second side gained.
 */
function poach(rng: ReturnType<typeof makeRng>): {
  p: number; q: number; after: number; extraLumps: number
} {
  for (let tries = 0; tries < 200; tries++) {
    const p = rng.int(2, 7)
    const q = rng.int(1, 6)
    const extraLumps = rng.int(1, 4)
    const after = q + extraLumps
    if (p === q) continue
    if (hcf(p, q) !== 1 || hcf(p, after) !== 1) continue
    return { p, q, after, extraLumps }
  }
  return { p: 3, q: 1, after: 2, extraLumps: 1 }
}

/** Two ratios sharing a middle term that each of them counts differently. */
function chain(rng: ReturnType<typeof makeRng>, top: number): {
  x: number; y: number; u: number; v: number
} {
  for (let tries = 0; tries < 200; tries++) {
    const [x, y] = smallRatio(rng, top)
    const [u, v] = smallRatio(rng, top + 1)
    if (y === u) continue
    // Neither ratio with a one in it at this height: a one makes a side the
    // lump itself, and the lump is the thing this rung is hiding.
    if (x === 1 || y === 1 || u === 1 || v === 1) continue
    if (hcf(x, y) !== 1 || hcf(u, v) !== 1) continue
    return { x, y, u, v }
  }
  return { x: 2, y: 3, u: 4, v: 5 }
}

/** A ratio worth doing: not 1 to 1, and not the same number twice. */
function smallRatio(rng: ReturnType<typeof makeRng>, top: number): [number, number] {
  for (let tries = 0; tries < 40; tries++) {
    const p = rng.int(1, top)
    const q = rng.int(1, top)
    if (p !== q && !(p === 1 && q === 1)) return [p, q]
  }
  return [2, 3]
}

/**
 * A ratio that cannot be read off by eye.
 *
 * Neither side one, and the two sides sharing no factor — because 2 to 4 is
 * answered by doubling without anybody noticing there was a ratio involved,
 * and a share that can be guessed is not a share that teaches anything.
 */
function awkwardRatio(rng: ReturnType<typeof makeRng>): [number, number] {
  for (let tries = 0; tries < 60; tries++) {
    const p = rng.int(2, 9)
    const q = rng.int(2, 9)
    if (p !== q && hcf(p, q) === 1) return [p, q]
  }
  return [3, 5]
}

function hcf(a: number, b: number): number {
  return b === 0 ? a : hcf(b, a % b)
}

/** "1 lump", not "1 lumps". */
const lumps = (n: number): string => `${n} lump${n === 1 ? '' : 's'}`
