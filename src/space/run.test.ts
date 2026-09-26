import { describe, expect, it } from 'vitest'
import { FLYABLE, SHIP_SPEED, SHIP_WIDE, SIZE_OF, WORLDS, worldFor } from './level'
import { FIXED, NO_INPUT, newRun, resume, step, widestGap, type Input, type Run } from './run'

/**
 * The run out through the solar system.
 *
 * Two of these matter more than the rest, and they are the same two that every
 * other game in this project had to learn the hard way. There is always a gap
 * wide enough to fly through, and a world can actually be reached by somebody
 * no cleverer than a person.
 */

/**
 * A pilot: aim for the roomiest gap in the sky ahead, and keep firing.
 *
 * Deliberately not clever — it looks one band ahead and walks towards the
 * middle of the widest opening. If this cannot get to Neptune, nor can a
 * child.
 */
function makePilot() {
  return (run: Run): Input => {
    /*
     * The clear runs across the band ahead, measured with each hazard's real
     * size. The first version of this assumed everything was a rock, so it
     * flew confidently into shards and drones and took three and a half knocks
     * getting to Mercury — which reads as the game being unfair and was the
     * pilot being wrong.
     */
    const soon = run.rubble.filter((r) => r.y > 0.2 && r.y < 1)
    const shut = soon
      .map((r): [number, number] => {
        const half = SIZE_OF[r.kind] / 2 + SHIP_WIDE / 2
        return [r.x - half, r.x + half]
      })
      .sort((a, b) => a[0] - b[0])

    let best = run.x
    let widest = 0
    let edge = 0
    for (const [left, right] of shut) {
      if (left - edge > widest) { widest = left - edge; best = (edge + left) / 2 }
      edge = Math.max(edge, right)
    }
    if (1 - edge > widest) { widest = 1 - edge; best = (edge + 1) / 2 }
    best = Math.min(1 - SHIP_WIDE / 2, Math.max(SHIP_WIDE / 2, best))

    const off = best - run.x
    return { left: off < -0.01, right: off > 0.01, fire: true }
  }
}

const fly = (run: Run, input: Input, seconds: number) => {
  let at = run
  for (let t = 0; t < seconds; t += FIXED) at = step(at, input, FIXED)
  return at
}

describe('the sky', () => {
  it('always leaves a gap wide enough to fly through', () => {
    /*
     * The one that matters. A screen of rock with no way past it is not
     * difficulty, it is a coin toss you lose, and no amount of skill answers
     * it. Measured over the band the ship is about to meet.
     */
    for (let number = 1; number <= WORLDS.length; number++) {
      for (let seed = 1; seed <= 6; seed++) {
        let run = newRun(number, 99, 0, seed * 17)
        const pilot = makePilot()
        for (let t = 0; t < 40; t += FIXED) {
          run = step(run, pilot(run), FIXED)
          if (run.status !== 'flying') run = resume(run)
          // Exactly the promised width, not a fraction of it. Nothing drifts,
          // so a gap measured when a thing was sent is the gap that arrives —
          // which means this can be asserted honestly rather than fudged.
          const gap = widestGap(run.rubble, 0.5, 1)
          expect(
            gap,
            `${worldFor(number).name} seed ${seed}: the sky closed to ${gap.toFixed(3)}`,
          ).toBeGreaterThanOrEqual(FLYABLE - 1e-9)
        }
      }
    }
  }, 240_000)

  it('can be flown to every world', () => {
    for (let number = 1; number <= WORLDS.length; number++) {
      let run = newRun(number, 99, 0, number * 31)
      const pilot = makePilot()
      for (let t = 0; t < 200 && run.status !== 'arrived'; t += FIXED) {
        run = step(run, pilot(run), FIXED)
        if (run.status === 'knocked') run = resume(run)
      }
      expect(run.status, `${worldFor(number).name} was never reached`).toBe('arrived')
    }
  }, 240_000)

  it('is gentle at Mercury and not at Neptune', () => {
    // Both ends, because capping only the hard end is how the road ended up
    // being finished five levels deep without a scratch.
    const knocks = (number: number) => {
      let total = 0
      for (let seed = 1; seed <= 4; seed++) {
        let run = newRun(number, 99, 0, seed * 23)
        const pilot = makePilot()
        for (let t = 0; t < 200 && run.status !== 'arrived'; t += FIXED) {
          run = step(run, pilot(run), FIXED)
          if (run.status === 'knocked') { total++; run = resume(run) }
        }
      }
      return total / 4
    }
    expect(knocks(1), 'Mercury has to be kind').toBeLessThanOrEqual(2)
    expect(knocks(WORLDS.length), 'Neptune is a stroll').toBeGreaterThan(0)
  }, 240_000)
})

describe('the ship', () => {
  it('stays on the screen', () => {
    const left = fly(newRun(1), { ...NO_INPUT, left: true }, 4)
    expect(left.x).toBeCloseTo(SHIP_WIDE / 2, 5)
    const right = fly(newRun(1), { ...NO_INPUT, right: true }, 4)
    expect(right.x).toBeCloseTo(1 - SHIP_WIDE / 2, 5)
  })

  it('crosses the screen in about a second and a bit', () => {
    // Slow enough to be a decision, quick enough to answer one.
    expect(1 / SHIP_SPEED).toBeGreaterThan(0.8)
    expect(1 / SHIP_SPEED).toBeLessThan(2)
  })

  it('cannot fire faster than the reload', () => {
    const run = fly(newRun(1), { ...NO_INPUT, fire: true }, 1)
    // A second of holding the trigger is a handful of bolts, not sixty.
    expect(run.bolts.length + run.score / 25).toBeLessThan(10)
  })

  it('cannot be knocked twice in a moment', () => {
    const run = newRun(1)
    const hit: Run = {
      ...run,
      rubble: [{ id: 1, kind: 'rock', x: run.x, y: 0.97, drift: 0, health: 3, flash: 0 }],
    }
    const after = step(hit, NO_INPUT, FIXED)
    expect(after.shields).toBe(run.shields - 1)
    // Back in with the shield up, and the thing that hit you cleared away.
    const back = resume(after)
    expect(back.mercy).toBeGreaterThan(0)
    const again = step(back, NO_INPUT, FIXED)
    expect(again.shields).toBe(after.shields)
  })

  it('says so once when the world is nearly in reach', () => {
    let run = { ...newRun(1), progress: 0.84 }
    const heard: string[] = []
    for (let t = 0; t < 3; t += FIXED) {
      run = step(run, NO_INPUT, FIXED)
      heard.push(...run.events)
    }
    expect(heard.filter((e) => e === 'warn').length).toBe(1)
  })
})

describe('the worlds', () => {
  it('all have a fact worth reading', () => {
    for (const world of WORLDS) {
      expect(world.fact.length, world.name).toBeGreaterThan(40)
      expect(world.fact.endsWith('.'), world.name).toBe(true)
    }
  })

  it('are in the order you would meet them', () => {
    expect(WORLDS.map((w) => w.name)).toEqual([
      'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
    ])
  })

  it('gets harder the further out you go', () => {
    for (let i = 1; i < WORLDS.length; i++) {
      expect(WORLDS[i].fall, WORLDS[i].name).toBeGreaterThanOrEqual(WORLDS[i - 1].fall)
      expect(WORLDS[i].traffic, WORLDS[i].name).toBeGreaterThanOrEqual(WORLDS[i - 1].traffic)
    }
  })
})
