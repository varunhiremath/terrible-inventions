import { describe, expect, it } from 'vitest'
import { GUN_W, LANE, type Crate, type Monster } from './level'
import {
  FIXED, arriveIn, costOf, newRun, nextLevel, serve, step, weaponOf, type Input,
} from './run'

/**
 * Is it playable, and does the decision actually matter?
 *
 * The second question is the one worth a test, and in this game the decision is
 * a sum about time: a crate needing twelve hits at three shots a second is four
 * seconds of not shooting the crowd, and whether that is affordable depends
 * entirely on the clock at the top of the screen. If a player who does that sum
 * comes out level with one who ignores it, the crates are decoration and the
 * game teaches nothing — which is exactly what the first version of this game
 * turned out to be when it was finally measured.
 *
 * So four bots play it:
 *
 *   timed    works out whether the crate fits in the time left, and takes it
 *            only when it does — preferring the one that pays best per hit
 *   greedy   always goes for the dearest crate, whatever the clock says
 *   never    ignores crates entirely and shoots the crowd
 *   still    stands in the middle and never moves
 */

const nearest = (crowd: readonly Monster[]): Monster | null =>
  crowd.reduce<Monster | null>((worst, m) => (worst === null || m.y > worst.y ? m : worst), null)

type Pick = 'timed' | 'greedy' | 'never' | 'still'

interface Went {
  /** The wave it got to, which is the real score of a run like this. */
  wave: number
  lost: number
  killed: number
  opened: number
}

function play(how: Pick, seconds: number, seed: number): Went {
  let run = newRun(1, 99, 0, 0, seed)
  let lost = 0
  let opened = 0

  for (let i = 0; i < Math.round(seconds / FIXED); i++) {
    if (run.status === 'cleared') {
      run = nextLevel(run)
      continue
    }
    if (run.status === 'lost' || run.status === 'over') {
      lost++
      // Lives are not what is being measured, so the bot is given as many as it
      // needs and the losses are counted instead.
      run = serve({ ...run, status: 'lost', lives: 99 })
      continue
    }

    let want: number | null = null
    if (how !== 'still') {
      const weapon = weaponOf(run)
      const clock = arriveIn(run)
      const here = run.crates.filter((c) => c.y > -1)
      let aim: Crate | null = null

      if (how === 'greedy') {
        // The dearest crate, whatever the clock says.
        for (const one of here) if (aim === null || one.step > aim.step) aim = one
      } else if (how === 'timed') {
        /*
         * The sum this whole game is made of: what is left of the crate, in
         * seconds at the gun in hand, against what is left on the clock — with
         * a second spare for whatever arrives while you are walking back.
         */
        for (const one of here) {
          if (costOf(one, weapon) + 1 > clock) continue
          if (aim === null || one.step > aim.step) aim = one
        }
      }

      if (aim) {
        want = aim.x
      } else {
        const target = nearest(run.crowd.filter((m) => m.y > -3))
        want = target ? target.x : LANE / 2
        // Somebody who does not want the crate shoots round it, which is the
        // whole reason a crate can be declined.
        for (const one of run.crates) {
          if (Math.abs(want - one.x) > 1.4) continue
          const away = nearest(run.crowd.filter((m) => m.y > -3 && Math.abs(m.x - one.x) > 1.6))
          if (away) want = away.x
        }
      }
    }

    const rung = run.rung
    run = step(run, { to: want, left: false, right: false } as Input, FIXED)
    if (run.rung !== rung) opened++
  }

  return { wave: run.level, lost, killed: run.killed, opened }
}

/** Five seeds, averaged, because one run is not a measurement. */
const SEEDS = [5, 11, 23, 41, 77]

const over = (how: Pick, seconds = 240): Went => {
  const runs = SEEDS.map((seed) => play(how, seconds, seed))
  const mean = (of: (went: Went) => number) =>
    runs.reduce((all, went) => all + of(went), 0) / runs.length
  return {
    wave: mean((w) => w.wave),
    lost: mean((w) => w.lost),
    killed: mean((w) => w.killed),
    opened: mean((w) => w.opened),
  }
}

/**
 * Four minutes of play, averaged over five seeds, as measured when this was
 * written. The bounds below sit loosely around these.
 *
 *              wave   lives   monsters   crates
 *   timed       9.2    0.0      157        9.2
 *   greedy      8.8    1.4      142        8.4
 *   never       5.0    3.8       67        0.0
 *
 * Which is the shape this game is supposed to have: doing the sum gets you
 * through whole, grabbing the dear crate whenever you see one costs lives, and
 * never spending anything on a gun leaves you jabbing at wave five with a
 * Peashooter while the wave gets forty per cent tougher every time.
 */
describe('four minutes of it', () => {
  it('rewards working out whether the crate fits in the time left', () => {
    const timed = over('timed')
    const greedy = over('greedy')
    expect(timed.lost, `timed lost ${timed.lost} lives`).toBeLessThanOrEqual(0.5)
    expect(
      greedy.lost,
      `and greedy lost ${greedy.lost} going for the big one regardless`,
    ).toBeGreaterThan(timed.lost + 0.5)
  })

  it('punishes never buying a gun at all', () => {
    const timed = over('timed')
    const never = over('never')
    expect(never.opened, 'it opened none, as asked').toBe(0)
    expect(timed.opened, 'and the other kept buying').toBeGreaterThan(5)
    expect(never.wave, `never reached wave ${never.wave}, timed ${timed.wave}`)
      .toBeLessThan(timed.wave - 2)
    expect(never.lost).toBeGreaterThan(timed.lost + 1)
  })

  it('does not let a crate be opened by accident on the way past', () => {
    /*
     * The one that rebuilt the lane. With the crates coming down the same
     * columns the crowd walks down, the bot that never aims at one opened every
     * crate in the game anyway, with shots meant for monsters — so there was no
     * decision in it at all. They have a lane each at the edges now.
     */
    expect(over('never', 120).opened).toBe(0)
  })

  it('goes nowhere at all for somebody who stands still', () => {
    const still = over('still', 120)
    const timed = over('timed', 120)
    expect(still.wave, 'a wave is cleared by shooting it').toBe(1)
    expect(still.lost).toBeGreaterThan(timed.lost + 1)
  })
})

describe('the shape of the climb', () => {
  it('gets somewhere in four minutes, and not to the end of the game', () => {
    const timed = over('timed')
    expect(timed.wave, `reached wave ${timed.wave}`).toBeGreaterThan(5)
    expect(timed.killed, `${timed.killed} monsters seen off`).toBeGreaterThan(100)
  })

  it('leaves room to stand: the lane is wider than you are', () => {
    // Not balance so much as the thing balance rests on — if the gun filled the
    // lane there would be no choosing which side of it to be on.
    expect(LANE / GUN_W).toBeGreaterThan(5)
  })
})
