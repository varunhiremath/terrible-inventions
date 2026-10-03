import { describe, expect, it } from 'vitest'
import {
  MOST_OF, RUSH_OF, SHIP_SPEED, SHIP_WIDE, SOLAR_SYSTEM, WORLDS, worldFor, type Kit,
} from './level'
import { FIXED, NO_INPUT, newRun, resume, step, type Run } from './run'
import { makePilot } from './run.test'

/**
 * Past Neptune.
 *
 * Two reports, and they are the same report twice: "he already finished the
 * space invader game reaching Neptune", and "once you have all the upgrades
 * the game becomes easy". Eight planets is a finished story, so finishing it
 * was the right thing to happen — what was wrong is that finishing it was the
 * end, and that by the end the gun had answered every question the game knew
 * how to ask.
 *
 * Every upgrade in here makes the gun better: quicker, doubled, piercing. So
 * the far half of the trip had to stop asking about the gun. It asks about
 * steering instead — a gravity well drags you off the middle, and a comet
 * comes down two and a half times faster than there is time to aim at.
 *
 * These are the checks that say it actually got harder rather than just
 * longer, measured with the kit already maxed out, which is the state the
 * report was made from.
 */

/** Everything bought, which is where the complaint came from. */
const LOADED: Kit = { rapid: MOST_OF.rapid, twin: true, pierce: true, magnet: true }

/**
 * How many shields somebody loses getting there, averaged over ten goes.
 *
 * With a reaction, and that is the whole reason this number means anything.
 * The default pilot reads every hazard's exact position and flies to the
 * middle of the widest gap sixty times a second, and measured with that one,
 * a black hole with a gravity well in it cost *exactly* as many shields as
 * Neptune — because none of what is new out here troubles something with no
 * reaction time. The instrument could not feel the difference, which is not
 * the same as there not being one.
 */
function knocks(number: number, kit = LOADED): number {
  let total = 0
  const goes = 10
  for (let seed = 1; seed <= goes; seed++) {
    let run = newRun(number, 99, 0, seed * 23, 0, kit)
    const pilot = makePilot(0.25)
    for (let t = 0; t < 240 && run.status !== 'arrived'; t += FIXED) {
      run = step(run, pilot(run), FIXED)
      if (run.status === 'knocked') { total += 1; run = resume(run) }
    }
  }
  return total / goes
}

describe('deep space', () => {
  it('is harder than the hardest planet, every world of it, kit and all', () => {
    /*
     * The report was "once you have all the upgrades the game becomes easy",
     * so this is measured with everything bought — which is the state the
     * complaint was made from — and against Neptune, which is the hardest
     * thing the old game had.
     */
    const neptune = knocks(SOLAR_SYSTEM)
    const said: string[] = [`Neptune ${neptune.toFixed(1)}`]
    for (let n = SOLAR_SYSTEM + 1; n <= WORLDS.length; n++) {
      const cost = knocks(n)
      said.push(`${worldFor(n).name} ${cost.toFixed(1)}`)
      expect(cost, said.join(' | ')).toBeGreaterThanOrEqual(neptune)
    }
    // And the far end is a long way past the near end of it.
    const far = knocks(WORLDS.length)
    expect(far, said.join(' | ')).toBeGreaterThan(neptune * 1.3)
  }, 600_000)

  it('keeps getting harder after the last one that has a name', () => {
    const andromeda = knocks(WORLDS.length)
    const beyond = knocks(WORLDS.length + 8)
    expect(
      beyond,
      `Andromeda costs ${andromeda.toFixed(1)} and a lap past it costs ${beyond.toFixed(1)}`,
    ).toBeGreaterThanOrEqual(andromeda * 0.9)
  }, 600_000)

  it('can still be flown, which is the other half of that', () => {
    // Harder is only worth having if it is possible. Nothing out here may be a
    // coin toss, however far out it is.
    for (let number = SOLAR_SYSTEM + 1; number <= WORLDS.length; number++) {
      let run = newRun(number, 99, 0, number * 31, 0, LOADED)
      const pilot = makePilot()
      for (let t = 0; t < 240 && run.status !== 'arrived'; t += FIXED) {
        run = step(run, pilot(run), FIXED)
        if (run.status === 'knocked') run = resume(run)
      }
      expect(run.status, `${worldFor(number).name} was never reached`).toBe('arrived')
    }
  }, 240_000)

  it('drags the ship about, and never harder than it can steer', () => {
    // Letting go of the stick at a black hole takes you to the edge.
    const drifting = (() => {
      let run: Run = { ...newRun(15, 99, 0, 7), rubble: [], x: 0.62 }
      for (let t = 0; t < 3; t += FIXED) run = step(run, NO_INPUT, FIXED)
      return run.x
    })()
    expect(drifting, 'nothing pulled it anywhere').toBeGreaterThan(0.75)

    /*
     * And steering still beats it, from the worst place to be. This is the one
     * that makes it hard rather than unfair: a pull the ship cannot out-fly
     * would mean the edges are somewhere you can be put and never leave.
     */
    let back: Run = { ...newRun(15, 99, 0, 7), rubble: [], x: 1 - SHIP_WIDE / 2 }
    for (let t = 0; t < 3; t += FIXED) back = step(back, { ...NO_INPUT, left: true }, FIXED)
    expect(back.x, 'could not fly out of its own gravity well').toBeLessThan(0.52)
  })

  it('leaves the solar system alone', () => {
    for (let n = 1; n <= SOLAR_SYSTEM; n++) {
      expect(worldFor(n).pull ?? 0, worldFor(n).name).toBe(0)
      expect(worldFor(n).sends, worldFor(n).name).not.toContain('comet')
      expect(worldFor(n).sends, worldFor(n).name).not.toContain('alien')
    }
  })

  it('sends comets quicker than anything else, and only out there', () => {
    expect(RUSH_OF.comet).toBeGreaterThan(2)
    for (const kind of ['rock', 'shard', 'drone', 'mine', 'alien'] as const) {
      expect(RUSH_OF[kind], kind).toBe(1)
    }
    // Fast enough that a bolt barely has time to meet one head on, which is
    // the point: it is dodged, not shot.
    const fastest = worldFor(WORLDS.length).fall * RUSH_OF.comet
    expect(fastest).toBeGreaterThan(SHIP_SPEED * 1.2)
  })
})
