import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { band, tier } from './util'

/**
 * A beam balance with sealed crates on it: solving for an unknown.
 *
 * This is algebra, and it is deliberately never written as algebra. A letter
 * standing for a number is a notation problem on top of a reasoning problem,
 * and the reasoning problem is the one worth having. A crate whose weight
 * nobody knows is the same idea with the notation taken off — and a beam is
 * better than a page, because the two rules that matter are things you can see
 * rather than things you are told:
 *
 *  - take the same off both sides and the beam stays level;
 *  - share both sides equally and the beam stays level.
 *
 * Those two are the whole of solving a linear equation. The ladder adds one
 * obstacle at a time: a constant alongside the crates, crates on both sides,
 * then a second kind of crate that needs a second balance to pin down.
 *
 * The weights are chosen so every crate is a whole number of kilos, because a
 * crate weighing four and a half is a different lesson.
 */

const BOUNDS = [400, 820, 1200, 1600, 2050] as const

/**
 * "3 blue crates", or "1 blue crate".
 *
 * Worth a function rather than a ternary at each site, because there are six
 * of them and the one that gets missed always turns up in front of a child as
 * "1 blue crates", which reads as carelessness about the whole question.
 */
const crates = (n: number, colour: string): string =>
  `${n} ${colour} crate${n === 1 ? '' : 's'}`

/** What is in the crates, so the two kinds are told apart by name. */
const CRATES: readonly string[] = [
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'striped',
]

export const crateWeight: Generator = {
  id: 'crate-weight',
  name: "{papa}'s Crates",
  blurb: 'Sealed crates on a beam. Work out what one weighs.',
  minRating: 400,
  maxRating: 2800,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const base = { id: `crate-weight:${seed}`, kind: 'crate-weight' as const, rating, seed }
    const [one, two] = rng.shuffle(CRATES)

    switch (tier(rating, BOUNDS)) {
      case 0: {
        // Crates on one side, kilos on the other. Sharing out, with a reason.
        const each = rng.int(3, 20)
        const count = rng.int(3, 8)
        return {
          ...base,
          prompt:
            `${crates(count, one)}, all the same, balance ${count * each} kg of ` +
            `scrap. What does one ${one} crate weigh?`,
          answer: { type: 'number', value: each },
          hints: [
            `All ${count} crates weigh the same, so they share the ${count * each} kg equally.`,
            `${count * each} shared between ${count} of them.`,
          ],
          explain:
            `${count * each} / ${count} = ${each} kg. Share both sides of a ` +
            `level beam out equally and it stays level, which is the only ` +
            `rule this one needs — and it is the same rule however many ` +
            `crates there are.`,
          data: { many: count, total: count * each },
        }
      }

      case 1: {
        /*
         * A loose weight alongside the crates, which has to come off both
         * sides before the sharing can start. Doing it the other way round —
         * sharing first — is the mistake, and the beam shows why it is one.
         */
        const each = rng.int(3, 18)
        const many = rng.int(2, 7)
        const extra = rng.int(2, 25)
        const other = many * each + extra
        return {
          ...base,
          prompt:
            `${many} ${one} crates and a ${extra} kg anvil balance ${other} kg ` +
            `of scrap. What does one ${one} crate weigh?`,
          answer: { type: 'number', value: each },
          hints: [
            'Take the anvil off. What has to come off the other side to keep it level?',
            `Without the anvil, ${many} crates balance ${many * each} kg.`,
          ],
          explain:
            `Lift the ${extra} kg anvil off one side and ${extra} kg of scrap ` +
            `off the other, and the beam is still level: ${many} crates against ` +
            `${many * each} kg. So one is ${each} kg. Sharing before taking the ` +
            `anvil off would have shared the anvil out too.`,
          data: { many, extra, other },
        }
      }

      case 2: {
        /*
         * Crates on both sides. The move is taking crates off both, which is
         * the same rule as taking the anvil off and is the step that turns a
         * balance into an equation.
         */
        const each = rng.int(3, 16)
        const left = rng.int(4, 9)
        const right = rng.int(1, left - 2)
        const kilos = (left - right) * each
        return {
          ...base,
          prompt:
            `${left} ${one} crates on one pan balance ${right} ${one} crates ` +
            `and ${kilos} kg of scrap on the other. What does one crate weigh?`,
          answer: { type: 'number', value: each },
          hints: [
            `There are crates on both sides. Take ${right} off each pan.`,
            `That leaves ${left - right} crates balancing ${kilos} kg.`,
          ],
          explain:
            `Take ${right} crates off both pans and the beam stays level: ` +
            `${left - right} crates against ${kilos} kg, so one is ${each} kg. ` +
            `Crates coming off both sides is the same move as the anvil coming ` +
            `off both sides — the beam cannot tell the difference.`,
          data: { left, right, kilos },
        }
      }

      case 3: {
        /*
         * Two kinds of crate and two balances. Neither weighing is enough on
         * its own, and the way in is that the first one says what a blue crate
         * is *worth in reds* — so it can be swapped for reds on the second
         * beam and the second kind disappears.
         */
        const red = rng.int(2, 12)
        const swap = rng.int(2, 4)
        const blue = red * swap
        const reds = rng.int(2, 6)
        const blues = rng.int(1, 3)
        const total = reds * red + blues * blue
        return {
          ...base,
          prompt:
            `One ${two} crate balances ${swap} ${one} crates exactly. And ` +
            `${crates(reds, one)} with ${crates(blues, two)} balance ${total} kg ` +
            `of scrap. What does one ${one} crate weigh?`,
          answer: { type: 'number', value: red },
          hints: [
            `The first beam is a swap: every ${two} crate can be replaced by ` +
            `${swap} ${one} ones without the beam moving.`,
            `Do that on the second beam and there are ` +
            `${reds + blues * swap} ${one} crates against ${total} kg.`,
          ],
          explain:
            `Swap each ${two} crate for ${swap} ${one} ones: the second beam ` +
            `becomes ${reds + blues * swap} ${one} crates against ${total} kg, ` +
            `so one is ${red} kg. Two unknowns is one too many for one beam, ` +
            `and the first beam is there to turn one of them into the other.`,
          data: { swap, reds, blues, total },
        }
      }

      default: {
        /*
         * Two beams and no swap handed over, so the swap has to be found. Both
         * weighings mix both kinds, and the way through is to scale one beam
         * until one of the crates appears the same number of times on both —
         * and then take that beam off this one.
         */
        // The beams get more loaded as the rating climbs: at the bottom of
        // this rung one of the two kinds often appears once and can be moved
        // across in a step, and higher up neither of them can.
        const { red, blue, a1, b1, t1, a2, b2, t2 } =
          twoBeams(rng, Math.round(band(rating, [[2050, 4], [2800, 11]])))
        return {
          ...base,
          prompt:
            `${crates(a1, one)} and ${crates(b1, two)} balance ${t1} kg. ` +
            `${crates(a2, one)} and ${crates(b2, two)} balance ${t2} kg. ` +
            `What does one ${one} crate weigh?`,
          answer: { type: 'number', value: red },
          hints: [
            'Neither weighing is enough on its own. Make one of the crates ' +
            'appear the same number of times in both.',
            `Load the first beam ${b2} times over and the second ${b1} times ` +
            `over: both then have ${b1 * b2} ${two} crates on them.`,
            `Take the smaller of those two from the bigger and the ${two} ` +
            `crates cancel out entirely.`,
          ],
          explain:
            `Scale the first weighing by ${b2} and the second by ${b1} and ` +
            `both carry ${b1 * b2} ${two} crates. Subtracting one from the ` +
            `other leaves ${Math.abs(a1 * b2 - a2 * b1)} ${one} crates against ` +
            `${Math.abs(t1 * b2 - t2 * b1)} kg, so a ${one} crate is ${red} kg ` +
            `and a ${two} one is ${blue}. That is two equations solved by ` +
            `elimination, done with crates instead of letters.`,
          data: { a1, b1, t1, a2, b2, t2 },
        }
      }
    }
  },
}

/**
 * Two weighings that pin down both crates.
 *
 * The pair has to be genuinely independent — two beams saying the same thing
 * in different sizes leave both crates unknown and the problem unanswerable —
 * so the cross product is checked before the numbers go out.
 */
function twoBeams(rng: ReturnType<typeof makeRng>, top: number): {
  red: number; blue: number
  a1: number; b1: number; t1: number
  a2: number; b2: number; t2: number
} {
  for (let tries = 0; tries < 300; tries++) {
    const red = rng.int(2, 10 + top)
    const blue = rng.int(2, 12 + top)
    if (red === blue) continue
    const a1 = rng.int(1, top + 1)
    const b1 = rng.int(1, top)
    const a2 = rng.int(1, top + 1)
    const b2 = rng.int(1, top)
    // Parallel beams say one thing twice and settle nothing.
    if (a1 * b2 - a2 * b1 === 0) continue
    return {
      red, blue,
      a1, b1, t1: a1 * red + b1 * blue,
      a2, b2, t2: a2 * red + b2 * blue,
    }
  }
  return { red: 3, blue: 5, a1: 2, b1: 1, t1: 11, a2: 1, b2: 2, t2: 13 }
}
