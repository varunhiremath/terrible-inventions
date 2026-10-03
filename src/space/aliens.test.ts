import { describe, expect, it } from 'vitest'
import {
  ALIEN_RELOAD, ALIEN_SWEEP, FLYABLE, SHIP_WIDE, SHOT_WIDE, SIZE_OF, SOLAR_SYSTEM,
  WORLDS, worldFor,
} from './level'
import { FIXED, NO_INPUT, newRubble, newRun, resume, step, widestGap, type Run } from './run'
import { makePilot } from './run.test'

/**
 * The ones that are flying it.
 *
 * Asked for in a line — "how about fighting aliens when you are in deep
 * space" — and everything out here until now was weather. A rock falls. An
 * alien patrols a stretch of sky and shoots back, and both of those are things
 * this game has refused before for the best of reasons.
 *
 * Sideways movement is the refusal that matters. The promise this whole game
 * is built on is that there is always a gap wide enough to fly through, and
 * that promise is measured when something is sent — so anything that moves
 * afterwards can walk into the gap it was measured against. That exact fault
 * took three goes to kill on the road.
 *
 * The answer is not to stop it moving. It is to measure the whole stretch it
 * will ever occupy, from the moment it arrives, so a gap that is there is
 * there for good. These are the checks that say so.
 */

const fly = (run: Run, seconds: number, input = NO_INPUT) => {
  let at = run
  for (let t = 0; t < seconds; t += FIXED) at = step(at, input, FIXED)
  return at
}

/** One alien, parked where it is wanted, with everything else cleared away. */
const DEEP = 10
const withAlien = (x = 0.5, y = 0.3): Run => ({
  ...newRun(DEEP, 99, 0, 5),
  rubble: [{ ...newRubble('alien', x, y, ALIEN_SWEEP), id: 1 }],
})

describe('the aliens', () => {
  it('are out in deep space and nowhere near the solar system', () => {
    /*
     * Asked for in one line: "aliens should appear only in deep space, not in
     * the solar system". Which is right, and is the better story — the first
     * eight worlds are rock and weather and nothing out there wants anything;
     * past Neptune something does.
     */
    for (let n = 1; n <= SOLAR_SYSTEM; n++) {
      expect(worldFor(n).sends, worldFor(n).name).not.toContain('alien')
    }
    const deep = WORLDS.slice(SOLAR_SYSTEM)
    expect(deep.filter((w) => w.sends.includes('alien')).length).toBeGreaterThan(deep.length / 2)
  })

  it('fly a beat rather than falling straight', () => {
    let run = withAlien()
    const seen: number[] = []
    for (let t = 0; t < 2.4; t += FIXED) {
      run = step(run, NO_INPUT, FIXED)
      const one = run.rubble.find((r) => r.kind === 'alien')
      if (one) seen.push(one.x)
    }
    const swung = Math.max(...seen) - Math.min(...seen)
    expect(swung, 'it never went anywhere').toBeGreaterThan(ALIEN_SWEEP)
  })

  it('never leave the stretch they were measured against', () => {
    let run = withAlien(0.5, -0.05)
    for (let t = 0; t < 6; t += FIXED) {
      run = step(run, NO_INPUT, FIXED)
      for (const one of run.rubble) {
        if (one.kind !== 'alien') continue
        expect(Math.abs(one.x - one.home), 'wandered off its beat').toBeLessThanOrEqual(
          one.sweep + 1e-9,
        )
      }
    }
  })

  it('leave a way through on every world, the whole way out', () => {
    /*
     * The same promise as `the sky`, asserted again here because this is the
     * check the aliens could have broken and the one that would not have been
     * noticed until somebody flew into a wall. `widestGap` counts where a
     * thing can get to, so this passing is what says the claim is honest.
     */
    for (let number = SOLAR_SYSTEM + 1; number <= WORLDS.length; number++) {
      for (let seed = 1; seed <= 4; seed++) {
        let run = newRun(number, 99, 0, seed * 29)
        const pilot = makePilot()
        for (let t = 0; t < 30; t += FIXED) {
          run = step(run, pilot(run), FIXED)
          if (run.status !== 'flying') run = resume(run)
          const gap = widestGap(run.rubble, 0.5, 1)
          expect(
            gap,
            `${worldFor(number).name} seed ${seed}: the sky closed to ${gap.toFixed(3)}`,
          ).toBeGreaterThanOrEqual(FLYABLE - 1e-9)
        }
      }
    }
  }, 240_000)

  it('shoot back, and only once they are on the screen', () => {
    // Up at the top it holds its fire: something that shoots before you have
    // seen where it came from is an ambush rather than a fight.
    let run = fly({ ...withAlien(0.5, -0.1), rubble: [{ ...newRubble('alien', 0.5, -0.1, ALIEN_SWEEP), id: 1, reload: 0 }] }, 0.05)
    expect(run.shots.length, 'fired before it was on screen').toBe(0)

    run = fly({ ...withAlien(0.5, 0.3), rubble: [{ ...newRubble('alien', 0.5, 0.3, ALIEN_SWEEP), id: 1, reload: 0 }] }, 0.05)
    expect(run.shots.length, 'never fired').toBeGreaterThan(0)
  })

  it('cannot fire faster than they are allowed to', () => {
    const run = fly(withAlien(0.5, 0.3), ALIEN_RELOAD * 2.4)
    // Three reloads' worth at most, and the ones that have reached the bottom
    // are gone, so this is a ceiling rather than a count.
    expect(run.shots.length).toBeLessThanOrEqual(3)
  })

  it('what they fire can take a shield, and can be shot out of the air', () => {
    const atYou: Run = {
      ...newRun(DEEP, 99, 0, 5),
      rubble: [],
      x: 0.5,
      shots: [{ id: 1, x: 0.5, y: 0.9 }],
    }
    expect(fly(atYou, 0.4).shields).toBe(newRun(DEEP, 99).shields - 1)

    // And the same shot, met head on. Yours climbs faster than theirs falls,
    // so one well-aimed bolt is enough.
    const met = fly(
      { ...atYou, shots: [{ id: 1, x: 0.5, y: 0.45 }], reload: 0 },
      0.35,
      { left: false, right: false, fire: true },
    )
    expect(met.shields, 'shooting it down did not save the shield').toBe(newRun(DEEP, 99).shields)
  })

  it('fire that cannot wall the screen', () => {
    /*
     * Their shots are deliberately left out of the gap measure — a thing that
     * small and that fast is dodged, not threaded — so the honest check is
     * that they could never add up to a wall even if they were counted.
     * Measured over whole runs rather than argued about.
     */
    for (let number = SOLAR_SYSTEM + 1; number <= WORLDS.length; number++) {
      let run = newRun(number, 99, 0, number * 13)
      const pilot = makePilot()
      let worst = 1
      for (let t = 0; t < 30; t += FIXED) {
        run = step(run, pilot(run), FIXED)
        if (run.status !== 'flying') run = resume(run)
        const asRubble = run.shots.map((s) => ({
          ...newRubble('shard', s.x, s.y),
          id: s.id,
        }))
        // Their shots are much smaller than a shard, so this overstates them.
        worst = Math.min(worst, widestGap([...run.rubble, ...asRubble], 0.5, 1))
      }
      expect(
        worst,
        `${worldFor(number).name}: counting their fire as rubble shuts it to ${worst.toFixed(3)}`,
      ).toBeGreaterThan(SHIP_WIDE)
    }
  }, 240_000)

  it('are big enough to hit and small enough to be a fight', () => {
    expect(SIZE_OF.alien).toBeGreaterThan(SHIP_WIDE)
    expect(SIZE_OF.alien).toBeLessThan(SIZE_OF.rock)
    // And what it fires is small: the ship can go round one.
    expect(SHOT_WIDE * 2 + SHIP_WIDE).toBeLessThan(FLYABLE)
  })
})
