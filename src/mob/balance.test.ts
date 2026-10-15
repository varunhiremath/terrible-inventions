import { describe, expect, it } from 'vitest'
import { WEAPONS, betterGate, weaponFor, type Block, type Gate } from './level'
import { FIXED, newRun, nextLevel, serve, standing, step, type Input, type Run } from './run'

/**
 * Is it playable, and does the arithmetic actually matter?
 *
 * The second question is the one worth a test, and it is the question that
 * rebuilt this game twice. A version where the gates are decoration — where
 * going through either one works out about the same — looks exactly like this
 * one, plays exactly like this one, and teaches nothing. No unit test of the
 * rules would notice.
 *
 * So three bots play it. One works out which gate is better for the squad it is
 * about to fire; one deliberately takes the other; one stands still. If the
 * first two come out level, the gates are painted on.
 *
 * Both of the faults it found are worth keeping in mind, because neither was
 * visible from the rules:
 *
 *  - Waves of twenty-four machines against the five hundred people a minute of
 *    shooting sends up the lane. Every wave was over in seconds and taking the
 *    worse gate every time cost three per cent. The blocks are four times the
 *    size now.
 *  - Gates that always crossed over near the squad size, which sounds like good
 *    teaching and is bad reward: two numbers that cross over near your squad
 *    are two numbers that are nearly equal near your squad. A quarter of rows
 *    are a mile apart now, and the cost of choosing badly tripled.
 */

/** The block it is most urgent to shoot: the one nearest the line. */
const urgent = (blocks: readonly Block[]): Block | null =>
  blocks.reduce<Block | null>((worst, b) => (worst === null || b.y > worst.y ? b : worst), null)

const inHalf = (gate: Gate, x: number): boolean => x >= gate.from && x < gate.to

/**
 * Where a bot that wants that gate should stand.
 *
 * Lined up with something to shoot where it can, because a squad that goes up
 * an empty lane is wasted however big a gate made it — which is a real part of
 * playing this rather than a detail of the bot.
 */
function standAt(run: Run, want: Gate): number {
  const mine = run.blocks.filter((b) => inHalf(want, b.x) && b.y > -4)
  const target = urgent(mine.length > 0 ? mine : run.blocks.filter((b) => b.y > -4))
  // Nothing to shoot on the side with the better gate: take the shot over the
  // gate, which is what a person does too.
  return target === null ? (want.from + want.to) / 2 : target.x
}

type Pick = 'well' | 'badly' | 'still'

interface Went {
  waves: number
  lost: number
  hits: number
  left: number
}

function play(how: Pick, level: number, seconds: number, seed: number): Went {
  let run = newRun(level, 99, 0, 0, seed)
  let waves = 0
  let lost = 0

  for (let i = 0; i < Math.round(seconds / FIXED); i++) {
    if (run.status === 'cleared') {
      waves++
      run = nextLevel(run)
      continue
    }
    if (run.status === 'lost' || run.status === 'over') {
      lost++
      // Lives are not the thing being measured here, so the bot is given as
      // many as it needs and the losses are counted instead.
      run = serve({ ...run, status: 'lost', lives: 99 })
      continue
    }

    let input: Input = { to: null, left: false, right: false }
    if (how !== 'still' && run.gates.length === 2) {
      const squad = weaponFor(run.hits).squad
      const best = betterGate(run.gates, squad)
      const worst = run.gates.find((gate) => gate.id !== best.id) ?? best
      input = { to: standAt(run, how === 'well' ? best : worst), left: false, right: false }
    }
    run = step(run, input, FIXED)
  }

  return { waves, lost, hits: run.hits, left: standing(run) }
}

/** Five seeds, averaged, because one lane of one wave is not a measurement. */
const SEEDS = [5, 11, 23, 41, 77]

const over = (how: Pick, level: number, seconds = 60): Went => {
  const runs = SEEDS.map((seed) => play(how, level, seconds, seed))
  const mean = (of: (went: Went) => number) =>
    runs.reduce((all, went) => all + of(went), 0) / runs.length
  return {
    waves: mean((w) => w.waves),
    lost: mean((w) => w.lost),
    hits: mean((w) => w.hits),
    left: mean((w) => w.left),
  }
}

/**
 * A minute of play, averaged over five seeds, as measured when this was
 * written. The bounds below sit loosely around these: a balance guard, not a
 * pin on exact numbers.
 *
 *              well                badly               still
 *   wave  1  2.0w 0.0L  318h    2.0w 0.2L  265h    0w 5L  22h
 *   wave  3  2.0w 0.2L  424h    1.0w 0.8L  339h    0w 5L  43h
 *   wave  6  1.0w 1.0L  540h    1.0w 1.8L  447h    0w 6L  61h
 *   wave 10  1.0w 1.4L  806h    0.4w 3.6L  571h    0w 7L  85h
 *   wave 14  0.6w 3.0L  903h    0.0w 4.6L  659h    0w 8L 109h
 *   wave 20  0.4w 3.6L 1048h    0.0w 6.0L  613h    0w 8L 145h
 *
 * Choosing well is worth a fifth of the machines early and two fifths by wave
 * twenty, and about half the lives all the way along. With three lives, a run
 * played well ends somewhere past wave ten, which is the arc this wanted.
 */
describe('a minute of it', () => {
  it('opens gently: a careful player loses nothing on the first waves', () => {
    const well = over('well', 1)
    expect(well.waves, `cleared ${well.waves} waves`).toBeGreaterThanOrEqual(1.5)
    expect(well.lost, `lost ${well.lost} lives`).toBeLessThanOrEqual(0.5)
  })

  it('costs real machines to take the worse gate, and more of them deeper in', () => {
    const early = { well: over('well', 6), badly: over('badly', 6) }
    expect(
      early.badly.hits,
      `wave 6: well ${early.well.hits} vs badly ${early.badly.hits}`,
    ).toBeLessThan(early.well.hits * 0.9)

    const deep = { well: over('well', 10), badly: over('badly', 10) }
    expect(
      deep.badly.hits,
      `wave 10: well ${deep.well.hits} vs badly ${deep.badly.hits}`,
    ).toBeLessThan(deep.well.hits * 0.8)
    expect(deep.badly.lost, 'and it costs lives').toBeGreaterThan(deep.well.lost * 1.5)
  })

  it('goes nowhere at all for somebody who stands still', () => {
    const still = over('still', 1)
    const well = over('well', 1)
    expect(still.waves, 'a wave is cleared by shooting it').toBe(0)
    expect(still.lost).toBeGreaterThan(well.lost + 2)
    expect(still.hits).toBeLessThan(well.hits * 0.3)
  })
})

describe('the shape of the climb', () => {
  it('is no longer free ten waves in', () => {
    const early = over('well', 1)
    const later = over('well', 10)
    expect(later.lost, `lost ${later.lost} lives at wave 10`).toBeGreaterThan(early.lost)
    expect(later.waves, `still cleared ${later.waves}`).toBeGreaterThanOrEqual(0.5)
  })

  it('is still playable twenty waves in rather than a wall', () => {
    const deep = over('well', 20)
    expect(deep.hits, `${deep.hits} machines seen off`).toBeGreaterThan(800)
    expect(deep.lost, `and ${deep.lost} lives gone`).toBeLessThan(6)
  })

  it('hands out the better guns over a run rather than in the first ten seconds', () => {
    /*
     * The guns are bought with hits, and a minute of the first waves is about
     * three hundred of them — so the thresholds have to be in the hundreds, or
     * the whole ladder is climbed before the second wave and there is nothing
     * left to earn.
     */
    const minute = over('well', 1).hits
    expect(WEAPONS[1].at).toBeLessThan(minute / 2)
    expect(WEAPONS[2].at).toBeGreaterThan(minute)
    expect(WEAPONS[3].at).toBeGreaterThan(minute * 2.5)
  })
})
