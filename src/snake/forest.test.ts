import { describe, expect, it } from 'vitest'
import {
  BLOWN, CREATURES, GARDENS, GOAL_GOT, GOAL_SAYS, HIDE_AGAIN, HIDE_FOR, KINDS, NEW_LENGTH, PREY,
  ROSTER, SPECIES, SPEED, SPRINT, STANDOFF, gardenFor, openingLength,
} from './level'
import {
  FIXED, fight, headOf, hiding, newRun, newSnake, powerOf, respawn, step, type Run, type Snake,
} from './run'

/**
 * The forest.
 *
 * "Instead of eating dots, make it realistic — rodents, rats, insects, frogs.
 * Use real snakes. Snakes can fight: find a weaker snake, attack; find a
 * stronger snake, run. There are holes to hide."
 *
 * Which is three new rules on top of a game that had one, so these are the
 * tests for all three: what is worth eating and how hard it is to catch, who
 * wins when two snakes meet, and what a hole is for.
 */

const still = { x: 0, y: 0, dash: false }
const sized = (kind: typeof SPECIES[number], length: number): Snake => {
  const s = newSnake(1, null, { x: 0, y: 0 }, 0, kind)
  s.length = length
  return s
}

describe('the snakes', () => {
  it('is a real animal with a real name', () => {
    for (const kind of SPECIES) {
      const it = KINDS[kind]
      expect(it.name.length).toBeGreaterThan(3)
      // A latin name, which is two words and is the thing that makes it real.
      expect(it.latin.split(' ')).toHaveLength(2)
      expect(it.says.length).toBeGreaterThan(20)
    }
  })

  it('trades speed against strength rather than having a best one', () => {
    /*
     * The mamba is the fastest snake alive and it is slender with it; the puff
     * adder is the slowest and has the longest fangs of any snake. If one of
     * them were quickest *and* hardest hitting there would be no choosing.
     */
    const fastest = SPECIES.reduce((a, b) => (KINDS[a].speed > KINDS[b].speed ? a : b))
    const hardest = SPECIES.reduce((a, b) => (KINDS[a].bite > KINDS[b].bite ? a : b))
    expect(fastest).toBe('mamba')
    expect(hardest).toBe('viper')
    expect(fastest).not.toBe(hardest)
    // And the fastest is not also the hardest to kill.
    expect(KINDS.mamba.bite).toBeLessThan(KINDS.viper.bite)
    expect(KINDS.viper.speed).toBeLessThan(KINDS.mamba.speed)
  })

  it('makes strength mostly a matter of length', () => {
    // Otherwise growing stops being the thing you are doing.
    const bigGrass = sized('grass', 10)
    const smallViper = sized('viper', 4)
    expect(powerOf(bigGrass)).toBeGreaterThan(powerOf(smallViper))
  })
})

describe('a fight', () => {
  it('is won by the stronger of the two', () => {
    expect(fight(sized('grass', 10), sized('grass', 4))).toBe(1)
    expect(fight(sized('grass', 4), sized('grass', 10))).toBe(-1)
  })

  it('is a standoff between two of a size', () => {
    /*
     * Two snakes of nearly the same size should slide past each other, not
     * have the bigger one win by a hundredth. It is what two real snakes do
     * and it is what stops the game being decided by a rounding error.
     */
    expect(fight(sized('grass', 5), sized('grass', 5))).toBe(0)
    expect(fight(sized('grass', 5), sized('grass', 5 * (1 - STANDOFF / 2)))).toBe(0)
    // And just outside the margin it is settled.
    expect(fight(sized('grass', 5), sized('grass', 5 * (1 - STANDOFF * 2)))).toBe(1)
  })

  it('lets a hard-biting snake beat a longer soft one, but only just', () => {
    /*
     * A puff adder is worth a grass snake half again its length — a real edge
     * and not a free win: the grass snake has to be better than twice as long
     * before the adder is the one that should be running.
     */
    const adder = sized('viper', 5)
    expect(fight(adder, sized('grass', 7.5))).toBe(1)
    expect(fight(adder, sized('grass', 10)), 'should be too close to call').toBe(0)
    expect(fight(adder, sized('grass', 12))).toBe(-1)
  })

  it('kills the weaker one when a head meets a body', () => {
    let run = newRun(1, 4, { rivals: 1, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6 })
    const you = run.snakes[0]
    const them = run.snakes[1]
    you.length = 14
    them.length = 2
    // Put your head right on them.
    const at = headOf(them)
    you.body = you.body.map((_b, i) => ({ x: at.x - i * 0.01, y: at.y }))
    run = step(run, still, FIXED)
    expect(run.snakes[1].alive, 'the weaker one survived being bitten').toBe(false)
    expect(run.snakes[0].alive, 'the stronger one died').toBe(true)
    expect(run.events).toContain('bite')
  })

  it('kills you when you run into something stronger', () => {
    let run = newRun(1, 4, { rivals: 1, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6 })
    const you = run.snakes[0]
    const them = run.snakes[1]
    you.length = 2
    them.length = 14
    const at = headOf(them)
    you.body = you.body.map((_b, i) => ({ x: at.x - i * 0.01, y: at.y }))
    run = step(run, still, FIXED)
    expect(run.snakes[0].alive).toBe(false)
    expect(run.said?.words, 'nothing said who got you').toContain('STRONGER')
  })

  it('leaves both alive when neither is strong enough', () => {
    // The control: if contact simply killed somebody, every test above would
    // pass and the game would still be the old one.
    let run = newRun(1, 4, { rivals: 1, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6 })
    const you = run.snakes[0]
    const them = run.snakes[1]
    you.length = 6
    them.length = 6 * KINDS[you.kind].bite / KINDS[them.kind].bite
    const at = headOf(them)
    you.body = you.body.map((_b, i) => ({ x: at.x - i * 0.01, y: at.y }))
    run = step(run, still, FIXED)
    expect(run.snakes[0].alive, 'a standoff killed somebody').toBe(true)
    expect(run.snakes[1].alive, 'a standoff killed somebody').toBe(true)
  })
})

describe('the creatures', () => {
  it('is worth more the harder it is to catch', () => {
    /*
     * The difficulty curve of the whole forest, and it has to hold in both
     * directions: an ant is worth nothing and does not look up, a rabbit is
     * worth a lot and is gone before you have decided.
     */
    const byWorth = [...PREY].sort((a, b) => CREATURES[a].feeds - CREATURES[b].feeds)
    expect(byWorth).toEqual(['ant', 'frog', 'rat', 'rabbit'])
    for (let i = 1; i < byWorth.length; i++) {
      const slow = CREATURES[byWorth[i - 1]]
      const quick = CREATURES[byWorth[i]]
      expect(quick.flees, `${byWorth[i]} is no harder to catch`).toBeGreaterThanOrEqual(slow.flees)
      expect(quick.notice, `${byWorth[i]} is no warier`).toBeGreaterThanOrEqual(slow.notice)
      expect(quick.share, `${byWorth[i]} is no rarer`).toBeLessThanOrEqual(slow.share)
    }
  })

  it('runs away from a snake, except the ant, which does not care', () => {
    for (const kind of PREY) {
      let run = newRun(1, 2, { rivals: 0, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6 })
      const head = headOf(run.snakes[0])
      // Just out of reach, so this is about fleeing and not about eating.
      const at = { x: head.x + 0.9, y: head.y }
      run = { ...run, prey: [{ id: 99, ...at, kind, heading: 0, scare: 0, hop: 0, spent: 0, big: false }] }
      for (let t = 0; t < 1; t += FIXED) run = step(run, still, FIXED)
      const now = run.prey[0]
      if (!now) continue
      const moved = Math.hypot(now.x - at.x, now.y - at.y)
      if (CREATURES[kind].notice === 0) expect(moved, `${kind} ran`).toBeLessThan(0.05)
      else expect(moved, `${kind} did not run`).toBeGreaterThan(0.3)
    }
  })

  it('stays in the forest rather than running out of it', () => {
    let run = newRun(1, 2, { rivals: 0, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6 })
    // A rabbit at the edge, with a snake inside it, so it runs at the wall.
    const edge = { x: run.arena * 0.95, y: 0 }
    run = {
      ...run,
      prey: [{ id: 99, ...edge, kind: 'rabbit' as const, heading: 0, scare: 2, hop: 0, spent: 0, big: false }],
      snakes: [{ ...run.snakes[0], body: run.snakes[0].body.map(() => ({ x: run.arena * 0.5, y: 0 })) }],
    }
    for (let t = 0; t < 3; t += FIXED) run = step(run, still, FIXED)
    const now = run.prey.find((p) => p.id === 99)
    if (now) expect(Math.hypot(now.x, now.y)).toBeLessThanOrEqual(run.arena)
  })

  it('is what a dead snake leaves, and that does not run', () => {
    let run = newRun(1, 4, { rivals: 1, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6 })
    run.snakes[0].length = 14
    run.snakes[1].length = 2
    const at = headOf(run.snakes[1])
    run.snakes[0].body = run.snakes[0].body.map((_b, i) => ({ x: at.x - i * 0.01, y: at.y }))
    run = step(run, still, FIXED)
    const left = run.prey.filter((p) => p.big)
    expect(left.length, 'a dead snake left nothing').toBeGreaterThan(3)
    // By id, not by position in the list: your head is standing in the middle
    // of it and will eat some, which shuffles everything along one.
    const was = new Map(left.map((p) => [p.id, { x: p.x, y: p.y }]))
    for (let t = 0; t < 1; t += FIXED) run = step(run, still, FIXED)
    let still_there = 0
    for (const p of run.prey) {
      const from = was.get(p.id)
      if (!from) continue
      still_there++
      expect(Math.hypot(p.x - from.x, p.y - from.y), 'what is left ran away').toBeLessThan(0.1)
    }
    expect(still_there, 'it all got eaten, so nothing was measured').toBeGreaterThan(0)
  })

  it('fills the forest with mostly the cheap ones', () => {
    // Or every round opens with a field of rabbits and nothing to learn.
    const run = newRun(1, 9)
    const ants = run.prey.filter((p) => p.kind === 'ant').length
    const rabbits = run.prey.filter((p) => p.kind === 'rabbit').length
    expect(ants).toBeGreaterThan(rabbits * 3)
    expect(rabbits, 'no rabbits at all').toBeGreaterThan(0)
  })
})

describe('a burrow', () => {
  it('keeps you from being bitten while you are down it', () => {
    let run = newRun(5, 3, { rivals: 1, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6 })
    const hole = run.burrows[0]
    expect(hole, 'the garden has no burrows').toBeTruthy()
    const you = run.snakes[0]
    const them = run.snakes[1]
    you.length = 2
    them.length = 14
    // You down the hole, them right on top of you.
    you.body = you.body.map(() => ({ x: hole.x, y: hole.y }))
    them.body = them.body.map((_b, i) => ({ x: hole.x + i * 0.01, y: hole.y }))
    run = step(run, still, FIXED)
    expect(hiding(run, run.snakes[0]), 'not counted as hidden').toBe(true)
    expect(run.snakes[0].alive, 'bitten while down a hole').toBe(true)
    expect(run.events).toContain('hide')
  })

  it('is used up after a while, so hiding is not the game', () => {
    let run = newRun(5, 3, { rivals: 0, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6 })
    const hole = run.burrows[0]
    // Parked on the hole and kept there: a snake is always moving forward, so
    // without re-pinning it this measures how far it swam, not the clock.
    const sit = () => {
      run.snakes[0].body = run.snakes[0].body.map(() => ({ x: hole.x, y: hole.y }))
    }
    sit()
    for (let t = 0; t < HIDE_FOR - 0.5; t += FIXED) { run = step(run, still, FIXED); sit() }
    expect(hiding(run, run.snakes[0]), 'thrown out early').toBe(true)
    for (let t = 0; t < 1; t += FIXED) { run = step(run, still, FIXED); sit() }
    expect(hiding(run, run.snakes[0]), 'still hiding long past its welcome').toBe(false)
  })

  it('takes a while to be worth anything again', () => {
    let run = newRun(5, 3, { rivals: 0, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6 })
    const hole = run.burrows[0]
    const sit = () => {
      run.snakes[0].body = run.snakes[0].body.map(() => ({ x: hole.x, y: hole.y }))
    }
    sit()
    for (let t = 0; t < HIDE_FOR + 1; t += FIXED) { run = step(run, still, FIXED); sit() }
    expect(hiding(run, run.snakes[0])).toBe(false)
    // And it is still no good a few seconds later.
    for (let t = 0; t < HIDE_AGAIN - 3; t += FIXED) { run = step(run, still, FIXED); sit() }
    expect(hiding(run, run.snakes[0]), 'the hole refilled too soon').toBe(false)
  })

  it('is never laid where somebody comes back to life', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = newRun(9, seed)
      for (const b of run.burrows) {
        expect(Math.hypot(b.x, b.y), `seed ${seed}`).toBeGreaterThan(1.4)
        expect(Math.hypot(b.x, b.y), `seed ${seed}`).toBeLessThan(run.arena)
      }
    }
  })
})

describe('who lives in which garden', () => {
  it('opens with grass snakes and finishes with the adder and the mamba', () => {
    const first = gardenFor(1).roster.map((i) => ROSTER[i].kind)
    const last = gardenFor(12).roster.map((i) => ROSTER[i].kind)
    expect(first.every((k) => k === 'grass'), 'something nasty in the first garden').toBe(true)
    expect(last).toContain('viper')
    expect(last).toContain('mamba')
  })

  it('only ever puts in a snake that garden keeps, life after life', () => {
    /*
     * The refill drew from the whole roster, so the opening garden — two grass
     * snakes, on purpose — filled itself with puff adders and black mambas the
     * moment one died.
     */
    const allowed = new Set(gardenFor(1).roster.map((i) => ROSTER[i].name))
    let run: Run = newRun(1, 4, { goal: 'last', want: 1e6 })
    for (let life = 0; life < 4; life++) {
      for (let t = 0; t < 8; t += FIXED) {
        run = step(run, { x: 1, y: 0.3, dash: false }, FIXED)
        if (run.status === 'lost') break
      }
      run = respawn({ ...run, status: 'lost' })
    }
    for (const s of run.snakes) {
      if (!s.who) continue
      expect(allowed, `${s.who.name} turned up in the first garden`).toContain(s.who.name)
    }
  }, 30_000)

  it('starts a bigger species bigger, so it looks like what it is', () => {
    const run = newRun(12, 3)
    for (const s of run.snakes) {
      if (!s.who) continue
      expect(s.length).toBeCloseTo(NEW_LENGTH * s.who.size, 2)
    }
  })
})

describe('seeing a snake off', () => {
  it('counts a bite, not only a ring', () => {
    /*
     * The garden that asks you to see somebody off counted rings alone, which
     * made it the one goal the forest's own rule — find a smaller snake, bite
     * it — could not satisfy. A minute of winning fights left the counter on
     * nought, and the only test on the goal's words checked they were longer
     * than four characters.
     */
    let run = newRun(3, 4, { rivals: 1, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'catch', want: 1 })
    const you = run.snakes[0]
    const them = run.snakes[1]
    you.length = 14
    them.length = 2
    const at = headOf(them)
    you.body = you.body.map((_b, i) => ({ x: at.x - i * 0.01, y: at.y }))
    run = step(run, still, FIXED)
    expect(run.got, 'a bite did not count').toBeGreaterThanOrEqual(1)
    expect(run.status).toBe('won')
  })

  it('tells him which move to make, and the two halves agree', () => {
    /*
     * The goal said "ring 3" and the counter under it said "0 seen off",
     * because the wording was changed in one of the two places and the edit to
     * the other silently did not apply. Nothing failed — the only test on
     * these words checked they were longer than four characters.
     */
    for (const want of [1, 3]) {
      const says = GOAL_SAYS.catch(want)
      const got = GOAL_GOT.catch(0)
      expect(says, `"${says}" names the ring, which is now only half of it`).not.toMatch(/ring/i)
      // The two strings are read one after the other on the same line, so they
      // have to be about the same thing.
      // On the stem, since one of them is in the past tense: "see off 3" and
      // "1 seen off" are the same verb and "ring 3" and "1 seen off" are not.
      const stem = got.replace(/^[\d.]+\s*/, '').split(' ')[0].slice(0, 3)
      expect(says, `"${says}" and "${got}" are not about the same thing`).toContain(stem)
    }
  })

  it('is worth something on the board', () => {
    let run = newRun(3, 4, { rivals: 1, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6 })
    const you = run.snakes[0]
    const them = run.snakes[1]
    you.length = 14
    them.length = 2
    const was = you.score
    const at = headOf(them)
    you.body = you.body.map((_b, i) => ({ x: at.x - i * 0.01, y: at.y }))
    run = step(run, still, FIXED)
    expect(run.snakes[0].score, 'a fight won paid nothing').toBeGreaterThan(was)
  })
})

/**
 * The shape of the ladder, as measured rather than as intended.
 *
 * Both of these came out of taking the last garden apart one variable at a
 * time, which is a thing worth writing down: the guess was that six rivals
 * instead of two was what made it hard, and cutting the rivals to two bought
 * one second of life. What was actually killing you was a forest of radius
 * nine with seven hedges in it.
 */
describe('the ladder', () => {
  it('always opens with something to hunt and something to leave alone', () => {
    /*
     * The one thing every garden has to offer. From garden nine on, every
     * rival used to open stronger than the player — all of them — so there was
     * nothing to hunt and nowhere to go, and the forest's own rule ("find a
     * weaker snake, attack; find a stronger snake, run") described a game that
     * was not on offer.
     */
    for (let level = 1; level <= GARDENS.length; level++) {
      const soft: string[] = []
      const hard: string[] = []
      for (let seed = 1; seed <= 5; seed++) {
        const run = newRun(level, seed)
        const you = run.snakes[0]
        for (const s of run.snakes.slice(1)) {
          if (fight(you, s) > 0) soft.push(s.who?.name ?? '?')
          if (fight(you, s) < 0) hard.push(s.who?.name ?? '?')
        }
      }
      expect(soft.length, `garden ${level}: nothing you can take`).toBeGreaterThan(0)
      // Bar the first two, which are meant to be a gentle start.
      if (level > 2) {
        expect(hard.length, `garden ${level}: nothing to be frightened of`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps room to run in, however late the garden', () => {
    /*
     * A stronger snake is survivable because you can get away from it. In a
     * forest small enough and thorny enough, you cannot, and the rule stops
     * being true. Measured: giving the last garden its old size back bought
     * seven seconds of life and clearing its hedges bought five, against one
     * second for cutting four rivals.
     */
    for (const garden of GARDENS) {
      expect(garden.arena, `${garden.name} is cramped`).toBeGreaterThanOrEqual(10.5)
      // Room per snake, which is what "cramped" actually means.
      const room = (Math.PI * garden.arena ** 2) / (garden.rivals + 1)
      expect(room, `${garden.name}: ${room.toFixed(0)} square units each`).toBeGreaterThan(45)
      expect(garden.hedges, `${garden.name} is more thorn than forest`).toBeLessThanOrEqual(5)
      // And somewhere to hide, once there is anything to hide from.
      expect(garden.burrows, `${garden.name} has nowhere to hide`).toBeGreaterThan(1)
    }
  })

  it('lets you turn up to a late forest grown, like everybody else in it', () => {
    expect(openingLength(1)).toBe(NEW_LENGTH)
    expect(openingLength(12)).toBeGreaterThan(NEW_LENGTH * 1.5)
    // And it stops, so garden forty is not opened by a snake the size of it.
    expect(openingLength(40)).toBe(openingLength(12))
  })
})

/**
 * Catching one.
 *
 * Reported from play: "it's very hard to catch anything — frog, rat, rabbit —
 * as they keep jumping away until they reach the boundary where they act weird
 * and start sliding along the wall." Both halves of that were real, and both
 * are measured here rather than argued about.
 */
describe('a chase', () => {
  /** One creature, one snake, straight after it. Returns how it went. */
  const after = (kind: typeof PREY[number], seed: number) => {
    let run = newRun(1, seed, {
      rivals: 0, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6,
    })
    const from = headOf(run.snakes[0])
    run = {
      ...run,
      prey: [{
        id: 1, x: from.x + 2, y: from.y + 0.5, kind,
        heading: 0, scare: 0, hop: 0, spent: 0, big: false,
      }],
    }
    let t = 0
    let atWall = 0
    let ticks = 0
    while (t < 30 && run.prey.length > 0 && run.status === 'playing') {
      const head = headOf(run.snakes[0])
      const p = run.prey[0]
      const want = Math.atan2(p.y - head.y, p.x - head.x)
      run = step(run, { x: Math.cos(want), y: Math.sin(want), dash: false }, FIXED)
      t += FIXED
      ticks++
      if (run.prey[0] && Math.hypot(run.prey[0].x, run.prey[0].y) > run.arena * 0.9) atWall++
    }
    return { got: run.prey.length === 0, took: t, wall: atWall / Math.max(1, ticks) }
  }

  it('ends with every creature caught', () => {
    for (const kind of PREY) {
      const runs = Array.from({ length: 10 }, (_, i) => after(kind, i + 1))
      const got = runs.filter((r) => r.got)
      expect(got.length, `${kind}: caught ${got.length} of 10`).toBe(10)
      const mean = got.reduce((a, r) => a + r.took, 0) / got.length
      expect(mean, `${kind} takes ${mean.toFixed(1)}s`).toBeLessThan(12)
    }
  }, 60_000)

  it('is not decided at the fence', () => {
    // It was: two thirds of a chase after a rabbit used to be spent out on the
    // rim, because that was the only place the thing could be cornered.
    for (const kind of PREY) {
      const runs = Array.from({ length: 10 }, (_, i) => after(kind, i + 1))
      const wall = runs.reduce((a, r) => a + r.wall, 0) / runs.length
      expect(wall, `${kind} spends ${(wall * 100).toFixed(0)}% of the chase at the fence`)
        .toBeLessThan(0.25)
    }
  }, 60_000)

  it('keeps the creatures in the order they are worth', () => {
    const took = PREY.map((kind) => {
      const runs = Array.from({ length: 10 }, (_, i) => after(kind, i + 1)).filter((r) => r.got)
      return { kind, secs: runs.reduce((a, r) => a + r.took, 0) / runs.length }
    })
    for (let i = 1; i < took.length; i++) {
      expect(took[i].secs, `a ${took[i].kind} is no harder than a ${took[i - 1].kind}`)
        .toBeGreaterThan(took[i - 1].secs)
    }
  }, 60_000)
})

describe('a frightened animal', () => {
  it('runs along the fence rather than in and out of it', () => {
    /*
     * The old code clamped it to the rim and turned it by half a turn; the
     * next frame the fright pointed it at the fence again, so it spun several
     * times a second and appeared to slide. Measured as how much its distance
     * from the middle wobbles once it is out there — a creature running along
     * the fence keeps the same distance, one bouncing off it does not.
     */
    let run = newRun(1, 3, {
      rivals: 0, food: 0, charms: 0, hedges: 0, burrows: 0, goal: 'last', want: 1e6,
    })
    const rim = run.arena * 0.95
    // The rabbit out at the fence, the snake just inside it, driving outwards.
    run = {
      ...run,
      prey: [{
        id: 1, x: rim, y: 0, kind: 'rabbit' as const,
        heading: 0, scare: 1, hop: 0, spent: 0, big: false,
      }],
      snakes: [{
        ...run.snakes[0],
        body: run.snakes[0].body.map((_b, i) => ({ x: rim - 1.2 - i * 0.14, y: 0 })),
      }],
    }
    const out: number[] = []
    for (let t = 0; t < 1.2; t += FIXED) {
      run = step(run, { x: 1, y: 0, dash: false }, FIXED)
      if (run.prey[0]) out.push(Math.hypot(run.prey[0].x, run.prey[0].y))
    }
    expect(out.length, 'it was eaten before anything could be measured').toBeGreaterThan(20)
    // It should stay out near the fence, smoothly, rather than jittering.
    let jitter = 0
    for (let i = 1; i < out.length; i++) jitter += Math.abs(out[i] - out[i - 1])
    const drift = Math.abs(out[out.length - 1] - out[0])
    expect(
      jitter,
      `its distance from the middle moved ${jitter.toFixed(2)} in total to end up ` +
      `${drift.toFixed(2)} from where it started`,
    ).toBeLessThan(drift + 0.6)
  })

  it('runs out of puff, and is slower than a snake once it has', () => {
    for (const kind of PREY) {
      const sort = CREATURES[kind]
      if (sort.flees === 0) continue
      const blown = sort.flees * (sort.hops ? 2.1 : 1) * BLOWN
      expect(blown, `a blown ${kind} still outruns a snake`).toBeLessThan(SPEED)
    }
    // And the burst is a real one, or there is nothing to run out of.
    expect(CREATURES.rabbit.flees).toBeGreaterThan(SPEED)
    expect(SPRINT).toBeGreaterThan(0.5)
  })

  it('does not end up parked on a burrow', () => {
    /*
     * Prey used to be moved onto any hole they came near and left there, so
     * over a round they collected on the burrows and sat on them.
     */
    let run = newRun(9, 5, { rivals: 2, goal: 'last', want: 1e6 })
    for (let t = 0; t < 25; t += FIXED) {
      run = step(run, { x: Math.cos(t * 0.7), y: Math.sin(t), dash: false }, FIXED)
      if (run.status !== 'playing') run = respawn({ ...run, status: 'lost' })
    }
    for (const b of run.burrows) {
      const on = run.prey.filter((p) => Math.hypot(p.x - b.x, p.y - b.y) < 0.2).length
      expect(on, `${on} creatures stacked on one hole`).toBeLessThan(3)
    }
  }, 30_000)
})
