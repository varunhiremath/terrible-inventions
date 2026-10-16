import { describe, expect, it } from 'vitest'
import {
  CRATE_H, GUNS, LANE, LINE_Y, MON_H, TOP_RUNG,
  cratePair, gunAt, insideFor, monHealth, rateOf, walkSpeed, waveFor, waveSize,
  type Crate, type Dice, type Monster,
} from './level'
import {
  FIXED, NO_INPUT, arriveIn, costOf, newRun, serve, standing, step, weaponOf,
  type Input, type Run,
} from './run'

/**
 * The swarm.
 *
 * The rules worth pinning here are the ones a player would notice and a glance
 * at the screen would not: that a shot goes into exactly one thing, that the
 * clock at the top is telling the truth, and that a crate costs what it says it
 * costs. Those three together are the decision the whole game is made of, and
 * any of them being slightly wrong would make the sum on the screen a lie.
 */

/** Real dice, seeded, matching what the game uses. */
function dice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return { next, int, pick: (items) => items[int(0, items.length - 1)] }
}

const idFrom = (from: number) => {
  let id = from
  return () => id++
}

const drive = (run: Run, seconds: number, input: Input = NO_INPUT): Run => {
  let now = run
  for (let i = 0; i < Math.round(seconds / FIXED); i++) {
    if (now.status !== 'playing') break
    now = step(now, input, FIXED)
  }
  return now
}

/**
 * A lane with nothing in it but what the test puts there.
 *
 * With one exception: a keeper monster a long way above the lane. An empty lane
 * is a cleared wave, so without it a run ends on the first step and every test
 * that drives for a second measures one step instead.
 */
const KEEPER: Monster = {
  id: 9000, x: LANE / 2, y: -80, breed: 'blob', health: 9999, max: 9999, pace: 1, flash: 0,
}

const empty = (set: Partial<Run> = {}): Run => ({
  ...newRun(1),
  crowd: [KEEPER],
  crates: [],
  shots: [],
  says: [],
  cool: 999,
  ...set,
})

const monster = (set: Partial<Monster> = {}): Monster => ({
  id: 1, x: 5, y: 6, breed: 'blob', health: 10, max: 10, pace: 1, flash: 0, ...set,
})

const crate = (set: Partial<Crate> = {}): Crate => ({
  id: 2, x: 5, y: 9, need: 6, got: 0, step: 1, flash: 0, ...set,
})

/** The rung whose gun hits for exactly this much, for tests about damage. */
const rungHitting = (hit: number): number => GUNS.findIndex((gun) => gun.hit === hit)

describe('shooting a monster', () => {
  it('takes the gun off its health, and says how much', () => {
    const run = empty({
      crowd: [KEEPER, monster({ health: 10 })],
      cool: 0,
      gun: 5,
      rung: rungHitting(3),
    })
    // A second and a bit: a shot takes most of a second to cross the lane.
    const after = drive(run, 1.2)
    const mine = after.crowd.find((m) => m.id === 1)
    expect(mine, 'it is still standing').toBeTruthy()
    expect(mine && mine.health).toBeLessThan(10)
    expect(after.says.some((s) => s.text === '-3')).toBe(true)
  })

  it('spends a shot on one thing only', () => {
    // Two monsters in a line. One shot cannot take both.
    const run = empty({
      crowd: [KEEPER, monster({ id: 1, y: 7 }), monster({ id: 3, y: 5 })],
      shots: [{ id: 50, x: 5, y: 9 }],
      cool: 999,
    })
    const after = drive(run, 0.35)
    const health = [1, 3].map((id) => after.crowd.find((m) => m.id === id)?.health ?? 0)
    expect(health.filter((h) => h < 10), 'only one of them was touched').toHaveLength(1)
  })

  it('never takes more than it has left, so the last hit is not wasted twice', () => {
    const run = empty({
      crowd: [KEEPER, monster({ health: 2, max: 20 })],
      shots: [{ id: 50, x: 5, y: 7.2 }],
      rung: rungHitting(8),
      cool: 999,
      score: 0,
    })
    const after = drive(run, 0.3)
    expect(after.crowd.find((m) => m.id === 1)).toBeUndefined()
    expect(after.killed).toBe(1)
    // Two of health left, so two points of damage, plus the ten for killing it.
    expect(after.score).toBe(12)
  })

  it('does not let a shot jump clean over a monster', () => {
    /*
     * The slices are for this: a monster is a unit and a half tall and a shot
     * moves fifteen units a second, so any step longer than a frame can put a
     * shot above something it never touched.
     */
    const run = empty({
      crowd: [KEEPER, monster({ y: 6 })],
      shots: [{ id: 50, x: 5, y: 11 }],
      cool: 999,
    })
    const after = step(run, NO_INPUT, 0.4)
    expect(after.crowd.find((m) => m.id === 1)?.health).toBe(9)
  })
})

describe('a crate', () => {
  it('costs hits rather than damage: a big gun opens it no faster', () => {
    // Needing more than either can land in the window, so both are still shut
    // at the end and the counts can be compared rather than the fact of it.
    // Two guns that fire at the same rate and hit for wildly different
    // amounts, so the only thing that could differ is whether damage counts.
    const same = GUNS.filter((gun) => gun.every === GUNS[6].every)
    const small = drive(empty({
      crates: [crate({ need: 40 })], cool: 0, gun: 5, rung: GUNS.indexOf(same[0]),
    }), 2.4)
    const big = drive(empty({
      crates: [crate({ need: 40 })], cool: 0, gun: 5, rung: GUNS.indexOf(same[same.length - 1]),
    }), 2.4)
    expect(small.crates[0].got).toBeGreaterThan(3)
    expect(big.crates[0].got).toBe(small.crates[0].got)
  })

  it('opens on the hit it says, and hands over the gun it was showing', () => {
    const one = crate({ need: 3, step: 2 })
    const run = empty({ crates: [one], cool: 0, gun: 5, rung: 2 })
    const promised = insideFor(one, 2)
    const after = drive(run, 1.4)
    expect(after.crates).toHaveLength(0)
    expect(after.rung).toBe(4)
    expect(weaponOf(after)).toEqual(promised)
    expect(after.says.some((s) => s.text === promised.name.toUpperCase())).toBe(true)
  })

  it('takes the other one of the pair with it: a choice, not a shopping list', () => {
    const run = empty({
      crates: [crate({ id: 2, need: 3, x: 2 }), crate({ id: 3, need: 30, x: 8, step: 2 })],
      cool: 0,
      gun: 2,
    })
    const after = drive(run, 1.4)
    expect(after.crates).toHaveLength(0)
  })

  it('eats the shot, so hits spent on it are hits the crowd did not take', () => {
    const run = empty({
      crowd: [KEEPER, monster({ y: 4, health: 50, max: 50 })],
      crates: [crate({ y: 9, need: 99 })],
      cool: 0,
      gun: 5,
    })
    const after = drive(run, 2)
    expect(after.crates[0].got, 'the crate took them').toBeGreaterThan(3)
    expect(after.crowd.find((m) => m.id === 1)?.health, 'and the monster took none').toBe(50)
  })

  it('is lost if it reaches the line before it is open', () => {
    const run = empty({
      crates: [crate({ y: LINE_Y - CRATE_H / 2 - 0.05, need: 99, got: 4 })],
      cool: 999,
    })
    // One step, so the events of that step are the ones being read: `drive`
    // keeps only the last step's, and this one happens immediately.
    const after = step(run, NO_INPUT, 0.2)
    expect(after.crates).toHaveLength(0)
    expect(after.events).toContain('missed')
  })

  it('says what it costs in seconds at the gun you are holding', () => {
    const slow = { hit: 1, every: 0.5, name: 'Slow' }
    const quick = { hit: 1, every: 0.2, name: 'Quick' }
    expect(costOf(crate({ need: 12, got: 0 }), slow)).toBeCloseTo(6, 5)
    expect(costOf(crate({ need: 12, got: 0 }), quick)).toBeCloseTo(2.4, 5)
    expect(costOf(crate({ need: 12, got: 9 }), quick)).toBeCloseTo(0.6, 5)
  })
})

describe('the clock at the top', () => {
  it('counts down the real monster at its own real pace', () => {
    const run = empty({
      crowd: [
        monster({ id: 1, y: 2, pace: 1 }),
        // Further back, but twice as quick: this is the one that arrives first.
        monster({ id: 3, y: 0, pace: 3 }),
      ],
      cool: 999,
    })
    const togo = arriveIn(run)
    const slow = (LINE_Y - (2 + MON_H / 2)) / walkSpeed(1)
    const quick = (LINE_Y - (0 + MON_H / 2)) / (walkSpeed(1) * 3)
    expect(togo).toBeCloseTo(Math.min(slow, quick), 5)
    expect(togo).toBeLessThan(slow)
  })

  it('agrees with how long it actually takes', () => {
    // The test the whole decision rests on: if this number lies, every sum a
    // player does on it is wrong.
    const run = empty({ crowd: [monster({ id: 1, y: 8 })], cool: 999 })
    const predicted = arriveIn(run)
    const after = drive(run, predicted + 0.2)
    expect(after.status).not.toBe('playing')
    const early = drive(run, predicted - 0.5)
    expect(early.status).toBe('playing')
  })

  it('is nothing at all when the lane is clear', () => {
    expect(arriveIn(empty({ crowd: [] }))).toBe(Infinity)
  })
})

describe('the line at the bottom', () => {
  it('costs a go when one crosses it, and the monster is still there', () => {
    const run = empty({
      lives: 3,
      crowd: [monster({ id: 1, y: LINE_Y - MON_H / 2 - 0.02 }), monster({ id: 3, y: 4 })],
      cool: 999,
    })
    const after = drive(run, 0.5)
    expect(after.status).toBe('lost')
    expect(after.lives).toBe(2)
    expect(after.crowd.map((m) => m.id).sort()).toEqual([1, 3])
  })

  it('is the end of the run when the last go goes', () => {
    const run = empty({
      lives: 1,
      crowd: [monster({ id: 1, y: LINE_Y - MON_H / 2 - 0.02 })],
      cool: 999,
    })
    const after = drive(run, 0.5)
    expect(after.status).toBe('over')
    expect(after.events).toContain('over')
  })

  it('is never cleared by letting the crowd through', () => {
    let run = empty({ lives: 99, crowd: [monster({ id: 1, y: 10 })], cool: 999 })
    for (let i = 0; i < 8; i++) {
      run = drive(run, 14)
      expect(run.status, 'it costs a life, it does not finish the wave').not.toBe('cleared')
      // `serve` restarts the gun, which is right in the game and would shoot
      // the monster this test is about.
      run = { ...serve(run), cool: 999 }
    }
  })

  it('says the wave is cleared when the last one goes', () => {
    const run = empty({
      crowd: [monster({ id: 1, health: 1, y: 7 })],
      shots: [{ id: 50, x: 5, y: 8 }],
      cool: 999,
    })
    const after = drive(run, 0.4)
    expect(after.status).toBe('cleared')
    expect(standing(after)).toBe(0)
  })
})

describe('the guns', () => {
  it('is a ladder where every rung is better than the one below it', () => {
    for (let rung = 1; rung < GUNS.length; rung++) {
      expect(GUNS[rung].hit, `rung ${rung}`).toBeGreaterThan(GUNS[rung - 1].hit)
      expect(GUNS[rung].every).toBeLessThanOrEqual(GUNS[rung - 1].every)
      expect(GUNS[rung].name).not.toBe(GUNS[rung - 1].name)
    }
  })

  it('keeps pace with the waves, which is what makes a crate the price of staying', () => {
    /*
     * The two curves this game is balanced on. A wave is forty per cent tougher
     * than the one before it and a rung hits about forty per cent harder than
     * the one below it, so one rung a wave stays level. When the ladder grew
     * faster than that, a bot held the best gun in the game two minutes in and
     * nothing could go wrong for the rest of the run.
     */
    const far = GUNS.length - 1
    const climbed = GUNS[far].hit / GUNS[far - 8].hit
    const waves = monHealth(9) / monHealth(1)
    expect(climbed / waves).toBeGreaterThan(0.6)
    expect(climbed / waves).toBeLessThan(1.7)
  })

  it('stops at the top rather than running off the end of the ladder', () => {
    expect(gunAt(TOP_RUNG + 50)).toEqual(GUNS[TOP_RUNG])
    expect(gunAt(-3)).toEqual(GUNS[0])
    expect(insideFor(crate({ step: 2 }), TOP_RUNG)).toEqual(GUNS[TOP_RUNG])
  })

  it('reports a rate a child can do a sum with', () => {
    expect(rateOf({ hit: 1, every: 0.5, name: 'x' })).toBe(2)
    expect(rateOf({ hit: 1, every: 0.25, name: 'x' })).toBe(4)
    expect(rateOf({ hit: 1, every: 1 / 3, name: 'x' })).toBe(3)
  })
})

describe('a pair of crates', () => {
  it('is a choice: one cheap and small, one dear and big', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const pair = cratePair(5, 3, dice(seed), idFrom(1))
      expect(pair).toHaveLength(2)
      const [a, b] = pair
      const cheap = a.need <= b.need ? a : b
      const dear = a.need <= b.need ? b : a
      expect(dear.need, `${cheap.need} vs ${dear.need}`).toBeGreaterThan(cheap.need)
      // And what is inside follows the price: the dear one carries you further
      // up the ladder, so nobody is ever asked to pay more for less.
      expect(dear.step).toBeGreaterThan(cheap.step)
    }
  })

  it('prices them in threes, so the sums stay doable in a head', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const one of cratePair(4, 2, dice(seed), idFrom(1))) {
        expect(one.need % 3, `${one.need} hits`).toBe(0)
        expect(one.need).toBeGreaterThanOrEqual(3)
        expect(one.need).toBeLessThanOrEqual(90)
      }
    }
  })

  it('puts one on each side of the lane, so taking one means leaving the other', () => {
    const pair = cratePair(3, 0, dice(11), idFrom(1))
    expect(pair[0].x).toBeLessThan(LANE / 2)
    expect(pair[1].x).toBeGreaterThan(LANE / 2)
  })

  it('comes down once a wave, at the start of it', () => {
    // One pair a wave and no more: the choice is made once, properly.
    expect(newRun(3).crates).toHaveLength(2)
    const after = drive(newRun(3), 12, { to: 5, left: false, right: false })
    expect(after.crates.length).toBeLessThanOrEqual(2)
  })
})

describe('the ladder of waves', () => {
  it('gets bigger, tougher and faster, and never goes backwards', () => {
    for (let level = 2; level <= 25; level++) {
      expect(waveSize(level)).toBeGreaterThanOrEqual(waveSize(level - 1))
      expect(monHealth(level)).toBeGreaterThan(monHealth(level - 1))
      expect(walkSpeed(level)).toBeGreaterThanOrEqual(walkSpeed(level - 1))
    }
    expect(waveSize(12)).toBeGreaterThan(waveSize(1))
  })

  it('starts every wave above the lane with nothing on the line', () => {
    for (let level = 1; level <= 20; level++) {
      const crowd = waveFor(level, dice(level), idFrom(1))
      expect(crowd.length).toBe(waveSize(level))
      for (const mon of crowd) {
        expect(mon.y).toBeLessThan(0)
        expect(mon.health).toBeGreaterThan(0)
        expect(mon.health).toBe(mon.max)
        expect(mon.x).toBeGreaterThan(0)
        expect(mon.x).toBeLessThan(LANE)
      }
    }
  })

  it('opens with nothing but blobs, and brings the rest in later', () => {
    const first = waveFor(1, dice(3), idFrom(1))
    expect(new Set(first.map((m) => m.breed))).toEqual(new Set(['blob']))
    const later = waveFor(8, dice(3), idFrom(1))
    expect(new Set(later.map((m) => m.breed)).size).toBeGreaterThan(1)
  })
})

describe('the simulation itself', () => {
  it('plays the same way twice from the same seed', () => {
    const once = drive(newRun(2, 3, 0, 0, 1234), 8, { to: 3, left: false, right: false })
    const twice = drive(newRun(2, 3, 0, 0, 1234), 8, { to: 3, left: false, right: false })
    expect(twice.score).toBe(once.score)
    expect(twice.killed).toBe(once.killed)
    expect(twice.crowd.map((m) => m.health)).toEqual(once.crowd.map((m) => m.health))
  })

  it('does not depend on how finely it is stepped', () => {
    const fine = drive(newRun(3, 3, 0, 0, 99), 6, { to: 4, left: false, right: false })
    let coarse = newRun(3, 3, 0, 0, 99)
    for (let i = 0; i < Math.round(6 / (FIXED * 8)); i++) {
      if (coarse.status !== 'playing') break
      coarse = step(coarse, { to: 4, left: false, right: false }, FIXED * 8)
    }
    expect(coarse.clock).toBeCloseTo(fine.clock, 1)
    const low = (run: Run) => Math.max(...run.crowd.map((m) => m.y), -99)
    expect(Math.abs(low(coarse) - low(fine))).toBeLessThan(0.3)
  })

  it('stops stepping once it is over', () => {
    const over = { ...empty({ lives: 0, status: 'over' as const }), score: 40 }
    const after = step(over, NO_INPUT, FIXED)
    expect(after.score).toBe(40)
    expect(after.clock).toBe(over.clock)
    expect(after.events).toHaveLength(0)
  })
})
