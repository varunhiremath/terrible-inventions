import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { band, tier } from './util'

/**
 * {papa}'s shop: percentages, forwards and backwards.
 *
 * A percentage is a ratio wearing a hat, and the thing that makes it hard is
 * never the arithmetic — it is keeping hold of *what the hundred is*. So the
 * ladder is a ladder of which hundred is in question:
 *
 *  - a percentage of a number you have been given;
 *  - a number after it has gone up or down by one;
 *  - the number it started as, which is the first rung where the hundred is
 *    not the number on the ticket and almost everybody divides by the wrong
 *    thing;
 *  - two changes one after the other, where the second hundred is the result
 *    of the first — which is why up ten and down ten does not come back;
 *  - and the single change that would have done both, which is the idea the
 *    whole topic exists to reach.
 *
 * Everything is in whole bolts and whole pence. A percentage that lands on
 * 37.4 of a thing is a lesson about rounding, and this is not that lesson.
 */

const BOUNDS = [400, 800, 1200, 1650, 2100] as const

/** What is on the shelf. Priced in whole pence, counted in whole things. */
const GOODS: readonly (readonly [string])[] = [
  ['brass cogs'],
  ['copper rivets'],
  ['spare fuses'],
  ['steel springs'],
  ['rubber washers'],
  ['glass valves'],
]

/** Percentages a person can actually hold in their head. */
const EASY = [10, 20, 25, 50, 75] as const

export const offThePrice: Generator = {
  id: 'off-the-price',
  name: "{papa}'s Prices",
  blurb: 'Percentages. The hard part is what the hundred is.',
  minRating: 400,
  maxRating: 2800,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const base = { id: `off-the-price:${seed}`, kind: 'off-the-price' as const, rating, seed }
    const [goods] = rng.pick(GOODS)

    switch (tier(rating, BOUNDS)) {
      case 0: {
        // A percentage of a number, with the hundred right there on the page.
        const pct = rng.pick(EASY)
        const whole = rng.int(2, 24) * lumpFor(pct)
        const want = (whole * pct) / 100
        return {
          ...base,
          prompt:
            `{papa} has ${whole} ${goods} in a tray and says ${pct}% of them ` +
            `are bent. How many are bent?`,
          answer: { type: 'number', value: want },
          hints: [
            `${pct}% means ${pct} out of every hundred.`,
            `${pct}% is the same as ${fraction(pct)}, so take ${fraction(pct)} of ${whole}.`,
          ],
          explain:
            `${pct}% is ${fraction(pct)}, and ${fraction(pct)} of ${whole} is ` +
            `${want}. Finding a percentage of something is finding a fraction ` +
            `of it — the per-cent only says which fraction.`,
          data: { whole, pct },
        }
      }

      case 1: {
        // Up or down by a percentage: the hundred is still the number given.
        const pct = rng.pick(EASY)
        const whole = rng.int(2, 20) * lumpFor(pct)
        const up = rng.next() < 0.5
        const change = (whole * pct) / 100
        const want = up ? whole + change : whole - change
        return {
          ...base,
          prompt:
            `{papa}'s machine turned out ${whole} ${goods} an hour. He ` +
            `tightened a belt and now it makes ${pct}% ${up ? 'more' : 'fewer'}. ` +
            `How many an hour now?`,
          answer: { type: 'number', value: want },
          hints: [
            `${pct}% of ${whole} is the bit that ${up ? 'goes on' : 'comes off'}.`,
            `That bit is ${change}, so ${up ? 'add' : 'take'} it ${up ? 'on' : 'off'}.`,
          ],
          explain:
            `${pct}% of ${whole} is ${change}, so it goes to ${want}. The ` +
            `quicker way is to notice the answer is ${100 + (up ? pct : -pct)}% ` +
            `of what it was, and take that in one go.`,
          data: { whole, pct, up },
        }
      }

      case 2: {
        /*
         * Backwards. The number on the ticket is not the hundred, and taking
         * the same percentage off it again is the mistake everybody makes
         * once: 20% off 48 is 38.40, which is not 60.
         */
        const pct = rng.pick(EASY.filter((p) => p !== 75))
        const was = rng.int(2, 20) * lumpFor(pct)
        const now = was - (was * pct) / 100
        return {
          ...base,
          prompt:
            `{papa} knocked ${pct}% off a box of ${goods} and it came to ` +
            `${now}p. What did it cost before?`,
          answer: { type: 'number', value: was },
          hints: [
            `${now} is not the hundred. It is what is *left* after ${pct}% went.`,
            `So ${now}p is ${100 - pct}% of the old price. What is 1% of it?`,
          ],
          explain:
            `${now}p is ${100 - pct}% of the old price, so 1% is ` +
            `${now / (100 - pct)}p and the whole thing is ${was}p. Taking ` +
            `${pct}% off ${now} instead would give ${now - (now * pct) / 100}, ` +
            `which is the trap: the hundred moved when the price did.`,
          data: { now, pct },
        }
      }

      case 3: {
        /*
         * Two changes, one after the other. The second percentage is of the
         * new number, not the old one, which is why up ten and down ten lands
         * below where it started and never anywhere else.
         */
        const first = rng.pick([10, 20, 25, 50] as const)
        const second = rng.pick([10, 20, 25, 50] as const)
        const upFirst = rng.next() < 0.5
        const upSecond = rng.next() < 0.5
        const start = startFor(first, second, upFirst, upSecond, rng)
        const middle = step(start, first, upFirst)
        const end = step(middle, second, upSecond)
        return {
          ...base,
          prompt:
            `A tray of ${goods} held ${start}. {papa} ` +
            `${upFirst ? `put ${first}% on` : `took ${first}% off`}, then ` +
            `${upSecond ? `put ${second}% on` : `took ${second}% off`} ` +
            `what was there then. How many now?`,
          answer: { type: 'number', value: end },
          hints: [
            'Do them one at a time. The second one is not of the number you started with.',
            `After the first change there are ${middle}, and the ${second}% is of that.`,
          ],
          explain:
            `${start} goes to ${middle}, and ${second}% of ${middle} is ` +
            `${Math.abs(end - middle)}, so it ends at ${end}. The two ` +
            `percentages never add up, because each one is counted out of a ` +
            `different hundred.`,
          data: { start, first, second, upFirst, upSecond },
        }
      }

      default: {
        /*
         * The one change that would have done all of them. This is the rung
         * where percentages stop being a procedure and become multipliers,
         * and it is the only idea in the topic that is worth carrying away.
         *
         * Two changes at the bottom of the rung and three further up, which
         * is a real step rather than bigger numbers: two can be held in the
         * head as "ten on, ten off", and three cannot be held at all without
         * actually multiplying.
         */
        const howMany = Math.round(band(rating, [[2100, 2], [2600, 3]]))
        const changes = netChain(rng, howMany)
        const net = changes.reduce((n, c) => step(n, c.pct, c.up), 100) - 100
        const rose = net > 0
        const said = changes.map(
          (c, i) => `${c.up ? 'puts' : 'takes'} ${c.pct}% ${c.up ? 'on' : 'off'} ` +
            (i === 0 ? 'a price' : 'the new one'),
        )
        const walk: number[] = []
        changes.reduce((n, c) => {
          const next = step(n, c.pct, c.up)
          walk.push(next)
          return next
        }, 100)
        return {
          ...base,
          prompt:
            `{papa} ${said.join(', then ')}. Whatever the price was, it has ` +
            `${rose ? 'gone up' : 'come down'} by the same percentage in the ` +
            `end. What percentage?`,
          answer: { type: 'number', value: Math.abs(net) },
          hints: [
            'Try it on 100 and see where it lands. The answer is the same for any price.',
            `Each change multiplies: ` +
            changes.map((c) => `${(c.up ? 100 + c.pct : 100 - c.pct) / 100}`).join(' then ') +
            `.`,
          ],
          explain:
            `Start at 100 and it goes ${walk.join(', then ')} — which is ` +
            `${Math.abs(net)}% ${rose ? 'up' : 'down'}. Multiplying the ` +
            `changes together is what makes this one number rather than ` +
            `${howMany}, and it is why a price put up and then back down by ` +
            `the same per cent never comes home.`,
          data: { changes, net },
        }
      }
    }
  },
}

/** A percentage said as the fraction it actually is. */
function fraction(pct: number): string {
  switch (pct) {
    case 10: return 'a tenth'
    case 20: return 'a fifth'
    case 25: return 'a quarter'
    case 50: return 'a half'
    case 75: return 'three quarters'
    default: return `${pct}/100`
  }
}

const step = (n: number, pct: number, up: boolean): number =>
  up ? n + (n * pct) / 100 : n - (n * pct) / 100

/**
 * The smallest number this percentage divides into a whole number of.
 *
 * Not 100 over the percentage, which is right for a tenth and a fifth and a
 * quarter and a half and wrong for three quarters: 100/75 is one and a third,
 * and multiplying by it gives a tray holding 26.67 cogs. It is 100 over what
 * the percentage and a hundred have in common.
 */
function lumpFor(pct: number): number {
  const common = (a: number, b: number): number => (b === 0 ? a : common(b, a % b))
  return 100 / common(100, pct)
}

/**
 * A starting number both changes leave whole.
 *
 * Worked out by trying, not by a formula, because the formula is wrong in a
 * way that is easy to miss: the second percentage is taken of the number the
 * first one produced, so it is *that* number which has to divide nicely.
 * Twenty-five per cent on and then off looks safe from a starting number of
 * twenty, and gives fifteen and then eleven and three quarters.
 */
function startFor(
  first: number, second: number, upFirst: boolean, upSecond: boolean,
  rng: ReturnType<typeof makeRng>,
): number {
  const works = (n: number): boolean => {
    const mid = step(n, first, upFirst)
    return Number.isInteger(mid) && mid > 0 && Number.isInteger(step(mid, second, upSecond))
  }
  const from = rng.int(2, 9) * 20
  for (let n = from; n <= from + 2000; n += 4) if (works(n)) return n
  // 1600 survives every pair of tenths, fifths, quarters and halves twice over.
  return 1600
}

/**
 * A run of changes whose combined effect is a whole number of per cent.
 *
 * Worked out rather than listed, so that adding a percentage to the pool
 * above cannot quietly produce a problem whose answer is 23.5% — and so that
 * a third change can be added without anybody having to re-derive the table.
 * A run that comes back to where it started is thrown away: "it has gone up
 * by 0%" is not a question.
 */
function netChain(
  rng: ReturnType<typeof makeRng>, howMany: number,
): { pct: number; up: boolean }[] {
  const pool = [10, 20, 25, 50] as const
  for (let tries = 0; tries < 200; tries++) {
    const changes = Array.from({ length: howMany }, () => ({
      pct: rng.pick(pool),
      up: rng.next() < 0.5,
    }))
    const after = changes.reduce((n, c) => step(n, c.pct, c.up), 100)
    if (after !== 100 && Number.isInteger(after) && after > 0) return changes
  }
  // Up ten then down ten: the classic, and a whole number either way.
  return [{ pct: 10, up: true }, { pct: 10, up: false }]
}
