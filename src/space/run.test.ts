import { describe, expect, it } from 'vitest'
import {
  COSTS, FLYABLE, MOST_OF, MOST_SHIELDS, NEW_KIT, SCRAP_OF, SHIP_SPEED, SHIP_WIDE,
  SIZE_OF, SOLAR_SYSTEM, WORLDS, reloadFor, worldFor, type Hazard,
} from './level'
import {
  FIXED, NO_INPUT, buy, canBuy, newRubble, newRun, resume, step, widestGap,
  type Input, type Run,
} from './run'

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
/**
 * Somebody flying it.
 *
 * @param reaction seconds between making up its mind, or nought for a machine
 *
 * The default is a machine: it reads every hazard's exact position and flies
 * to the middle of the widest gap at full lock, sixty times a second. That is
 * the right pilot for asking "is there a way through at all", which is what
 * the fairness checks ask.
 *
 * It is the wrong pilot for asking "is this harder than that", and the
 * measurement said so out loud. Deep space got a gravity well that drags the
 * ship, comets two and a half times faster than anything else, and aliens
 * shooting back — and this pilot lost *exactly* as many shields at a black
 * hole as at Neptune, because none of those things trouble something with no
 * reaction time. The instrument could not feel the difference, which is not
 * the same as there not being one.
 *
 * So it can be given a reaction: it looks, decides, and then holds that
 * decision for a fraction of a second whatever happens next. That is what a
 * person does, and it is the difference between a comet being a hazard and a
 * comet being a thing that was not there when you last looked.
 */
export function makePilot(reaction = 0) {
  let held: Input | null = null
  let since = 0

  const decide = (run: Run): Input => {
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

  return (run: Run): Input => {
    if (reaction <= 0) return decide(run)
    since += FIXED
    if (held === null || since >= reaction) {
      held = decide(run)
      since = 0
    }
    return held
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
      rubble: [{ ...newRubble('rock', run.x, 0.97), id: 1 }],
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
      // And then out of the solar system, in the order you would actually meet
      // them: the belt, the cloud round it, the nearest stars, a nebula, the
      // black hole in the middle of this galaxy, and the next galaxy along.
      'The Kuiper Belt', 'The Oort Cloud', 'Proxima Centauri', 'Sirius',
      'Betelgeuse', 'The Crab Nebula', 'Sagittarius A*', 'Andromeda',
    ])
  })

  it('run out of planets where the solar system does', () => {
    expect(WORLDS.slice(0, SOLAR_SYSTEM).every((w) => (w.look ?? 'planet') === 'planet')).toBe(true)
    expect(WORLDS.slice(SOLAR_SYSTEM).every((w) => (w.look ?? 'planet') !== 'planet')).toBe(true)
  })

  it('never run out at all', () => {
    /*
     * He finished this game. Eight planets is a finished story, so that was
     * the right thing to have happened — and the answer to it is that there is
     * no last world any more.
     */
    const far = worldFor(WORLDS.length + 9)
    expect(far.name).toContain('·')
    expect(far.fact.length, 'a generated world still has a real fact').toBeGreaterThan(40)
    expect(far.traffic).toBeGreaterThan(worldFor(WORLDS.length).traffic)

    // And it keeps climbing rather than levelling off straight away.
    const further = worldFor(WORLDS.length + 40)
    expect(further.pull ?? 0).toBeGreaterThan(far.pull ?? 0)
  })

  it('gets harder the further out you go', () => {
    for (let i = 1; i < WORLDS.length; i++) {
      expect(WORLDS[i].fall, WORLDS[i].name).toBeGreaterThanOrEqual(WORLDS[i - 1].fall)
      expect(WORLDS[i].traffic, WORLDS[i].name).toBeGreaterThanOrEqual(WORLDS[i - 1].traffic)
    }
  })
})

/**
 * The scrap, and what it buys.
 *
 * Breaking something leaves a cell that falls, and going back for it is a
 * decision rather than a reward — which is the only reason it is interesting.
 * Every rule below exists because the alternative is either a shop nobody can
 * afford or a ship that cannot be touched by the fourth world.
 */
describe('the scrap', () => {
  const breakOne = (kind: Hazard, kit = NEW_KIT): Run => {
    // Put one thing directly over the ship and shoot it until it goes.
    let run: Run = { ...newRun(1), kit, x: 0.5 }
    run.rubble.push({ ...newRubble(kind, 0.5, 0.5), id: 99 })
    for (let shot = 0; shot < 10 && run.rubble.length > 0; shot++) {
      run = { ...run, reload: 0 }
      run = fly(run, { left: false, right: false, fire: true }, 0.5)
      if (run.status !== 'flying') break
    }
    return run
  }

  it('leaves a cell behind when something breaks up', () => {
    const after = breakOne('rock')
    expect(after.broken).toBeGreaterThan(0)
    // Either still falling, or already collected on the way past.
    expect(after.scrap.length + after.purse).toBeGreaterThan(0)
  })

  it('leaves nothing at all for one of his mines', () => {
    // A mine cannot be shot, so nothing should ever come off one.
    expect(SCRAP_OF.mine).toBe(0)
  })

  it('pays more for the things that are harder to break', () => {
    expect(SCRAP_OF.drone).toBeGreaterThan(SCRAP_OF.rock)
    expect(SCRAP_OF.rock).toBeGreaterThan(SCRAP_OF.shard)
  })

  it('goes in the pocket when the ship flies into it', () => {
    let run: Run = { ...newRun(1), x: 0.5 }
    run.scrap.push({ id: 1, x: 0.5, y: 0.3, worth: 3 })
    run = fly(run, NO_INPUT, 6)
    expect(run.purse).toBe(3)
    expect(run.scrap).toHaveLength(0)
  })

  it('is lost if it falls past you', () => {
    let run: Run = { ...newRun(1), x: 0.1 }
    run.scrap.push({ id: 1, x: 0.9, y: 0.3, worth: 3 })
    run = fly(run, NO_INPUT, 8)
    expect(run.purse).toBe(0)
    expect(run.scrap).toHaveLength(0)
  })

  it('leans towards you once a magnet is fitted, and not before', () => {
    const drop = (magnet: boolean) => {
      let run: Run = { ...newRun(1), x: 0.1, kit: { ...NEW_KIT, magnet } }
      run.scrap.push({ id: 1, x: 0.9, y: 0.1, worth: 3 })
      run = fly(run, NO_INPUT, 1)
      return run.scrap[0]?.x ?? 0
    }
    expect(drop(false)).toBeCloseTo(0.9, 5)
    expect(drop(true)).toBeLessThan(0.9)
  })

  it('never lets a magnet drag a cell off the screen', () => {
    let run: Run = { ...newRun(1), x: 0.5, kit: { ...NEW_KIT, magnet: true } }
    run.scrap.push({ id: 1, x: 0.02, y: 0, worth: 1 })
    run = fly(run, NO_INPUT, 2)
    for (const cell of run.scrap) {
      expect(cell.x).toBeGreaterThanOrEqual(0)
      expect(cell.x).toBeLessThanOrEqual(1)
    }
  })

  it('keeps what is in the air when a shield goes', () => {
    // Losing a shield costs enough already without also emptying your pockets.
    let run: Run = { ...newRun(1), purse: 12 }
    run.scrap.push({ id: 1, x: 0.5, y: 0.1, worth: 3 })
    const back = resume({ ...run, status: 'knocked', shields: 2 })
    expect(back.purse).toBe(12)
    expect(back.scrap).toHaveLength(1)
  })
})

describe('the shop', () => {
  const rich = (purse: number): Run => ({ ...newRun(1), purse })

  it('will not sell what cannot be paid for', () => {
    const skint = rich(COSTS.twin - 1)
    expect(canBuy(skint, 'twin')).toBe(false)
    expect(buy(skint, 'twin')).toBe(skint)
  })

  it('takes the money and fits the thing', () => {
    const after = buy(rich(COSTS.twin), 'twin')
    expect(after.kit.twin).toBe(true)
    expect(after.purse).toBe(0)
  })

  it('sells a shield again and again, up to what the hull holds', () => {
    let run = rich(COSTS.shield * 20)
    for (let i = 0; i < 20; i++) run = buy(run, 'shield')
    expect(run.shields).toBe(MOST_SHIELDS)
    // And stops charging once it stops selling.
    expect(canBuy(run, 'shield')).toBe(false)
  })

  it('sells the trigger twice and no more', () => {
    let run = rich(COSTS.rapid * 5)
    for (let i = 0; i < 5; i++) run = buy(run, 'rapid')
    expect(run.kit.rapid).toBe(MOST_OF.rapid)
  })

  it('will not sell the same one-off twice', () => {
    const once = buy(rich(COSTS.pierce * 2), 'pierce')
    expect(canBuy(once, 'pierce')).toBe(false)
    expect(buy(once, 'pierce').purse).toBe(once.purse)
  })

  it('prices the first stop so it buys something and not everything', () => {
    /*
     * A world drops roughly twenty to sixty cells depending on how much you
     * shoot. If the cheapest thing cost more than a good run at Mercury, the
     * shop would be scenery for the first half of the game; if the dearest
     * were affordable at the first stop, the rest of the game would be over.
     */
    const cheapest = Math.min(...Object.values(COSTS))
    const dearest = Math.max(...Object.values(COSTS))
    expect(cheapest).toBeLessThanOrEqual(40)
    expect(dearest).toBeGreaterThan(60)
  })
})

describe('the kit, once it is fitted', () => {
  it('makes the trigger quicker, and only so quick', () => {
    expect(reloadFor({ ...NEW_KIT, rapid: 1 })).toBeLessThan(reloadFor(NEW_KIT))
    expect(reloadFor({ ...NEW_KIT, rapid: 2 })).toBeLessThan(reloadFor({ ...NEW_KIT, rapid: 1 }))
    // Never so quick that the sky is a solid wall of bolts.
    expect(reloadFor({ ...NEW_KIT, rapid: 9 })).toBeGreaterThan(0.1)
  })

  it('puts two bolts up instead of one', () => {
    const one = fly({ ...newRun(1), kit: NEW_KIT }, { left: false, right: false, fire: true }, FIXED)
    const two = fly({ ...newRun(1), kit: { ...NEW_KIT, twin: true } }, { left: false, right: false, fire: true }, FIXED)
    expect(two.bolts.length).toBe(one.bolts.length * 2)
  })

  it('keeps both of a twin cannon\'s bolts on the screen at the edges', () => {
    for (const x of [0, 1]) {
      const run = fly(
        { ...newRun(1), x, kit: { ...NEW_KIT, twin: true } },
        { left: false, right: false, fire: true },
        FIXED,
      )
      for (const bolt of run.bolts) {
        expect(bolt.x).toBeGreaterThanOrEqual(0)
        expect(bolt.x).toBeLessThanOrEqual(1)
      }
    }
  })

  it('carries a piercing bolt on through what it breaks', () => {
    const stack = (pierces: boolean) => {
      let run: Run = { ...newRun(1), x: 0.5, kit: { ...NEW_KIT, pierce: pierces } }
      // Two shards in a line: one hit each, so a piercing bolt takes both.
      run.rubble.push({ ...newRubble('shard', 0.5, 0.55), id: 1 })
      run.rubble.push({ ...newRubble('shard', 0.5, 0.35), id: 2 })
      return fly(run, { left: false, right: false, fire: true }, 0.35).broken
    }
    expect(stack(false)).toBe(1)
    expect(stack(true)).toBe(2)
  })
})
