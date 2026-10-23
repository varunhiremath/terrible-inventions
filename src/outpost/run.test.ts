import { describe, expect, it } from 'vitest'
import {
  BELT, BUILD, CLOSE, EYE, HOME, LIVES,
  at, buildMap, cellAt, clearLine, middleOf, reach, solid,
  type Dice, type Map,
} from './level'
import {
  FIXED, NO_INPUT, downhill, facing, newRun, pickThatMakes, standing, step,
  type Input, type Run,
} from './run'

/** The same dice the game uses, so a test seed is a game seed. */
function dice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)) }
}

/**
 * A floor cell with room around it, for the set-piece tests.
 *
 * The first go at these put the player at the middle of the map, which on
 * about half the seeds is the middle of a building: every shot was fired from
 * inside a wall, nothing had a clear line to anything, and five tests failed
 * for a reason that had nothing to do with what they were testing.
 */
function clearing(map: Map): { x: number; z: number } {
  // Room for five cells of lane to the north, because north is where these
  // tests put the thing being shot at, and a cell wide either side.
  for (let y = map.tall - 3; y > 6; y--) {
    for (let x = 2; x < map.wide - 2; x++) {
      let room = true
      for (let dy = -5; dy <= 0 && room; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (at(map, x + dx, y + dy) !== 'floor') { room = false; break }
        }
      }
      if (room) return middleOf({ x, y })
    }
  }
  throw new Error('no room anywhere on this map')
}

/** Steps a run on, keeping every event that happened on the way. */
function drive(run: Run, seconds: number, input: Input = NO_INPUT) {
  const heard: string[] = []
  for (let t = 0; t < seconds; t += FIXED) {
    run = step(run, input, FIXED)
    heard.push(...run.events)
    if (run.status !== 'playing') break
  }
  return { run, heard }
}

describe('the compound', () => {
  it('is always in one piece', () => {
    /*
     * The rule this project has had to learn twice, in two other games: a
     * promise made when something is placed does not survive the next thing
     * being placed. Buildings are stamped one at a time and taken out again if
     * they cut the yard in two, and this is what says so.
     */
    for (let seed = 1; seed <= 40; seed++) {
      for (const mission of [1, 3, 6]) {
        const map = buildMap(mission, dice(seed))
        const far = reach(map, map.pad)
        const floors = map.cells.filter((c) => c === 'floor').length
        const got = far.reduce((sum, d) => (d >= 0 ? sum + 1 : sum), 0)
        expect(got, `mission ${mission} seed ${seed}`).toBe(floors)
      }
    }
  })

  it('keeps the pad and the cage clear of buildings', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const map = buildMap(2, dice(seed))
      expect(at(map, map.pad.x, map.pad.y)).toBe('floor')
      expect(at(map, map.cage.x, map.cage.y)).toBe('floor')
    }
  })

  it('walls the outside in', () => {
    const map = buildMap(1, dice(5))
    for (let x = 0; x < map.wide; x++) {
      expect(solid(map, x, 0)).toBe(true)
      expect(solid(map, x, map.tall - 1)).toBe(true)
    }
  })

  it('grows with the missions', () => {
    expect(buildMap(1, dice(1)).wide).toBeLessThan(buildMap(5, dice(1)).wide)
  })
})

describe('seeing', () => {
  const map = (): Map => {
    const wide = 9
    const cells = Array.from({ length: wide * wide }, (_, i) => {
      const x = i % wide
      const y = (i - x) / wide
      return (x === 0 || y === 0 || x === wide - 1 || y === wide - 1) ? 'wall' as const : 'floor' as const
    })
    cells[4 * wide + 4] = 'wall'
    return { wide, tall: wide, cells, pad: { x: 1, y: 1 }, cage: { x: 7, y: 7 } }
  }

  it('stops at a wall', () => {
    const board = map()
    const left = middleOf({ x: 2, y: 4 })
    const right = middleOf({ x: 6, y: 4 })
    expect(clearLine(board, left.x, left.z, right.x, right.z), 'through the block').toBe(false)
  })

  it('lets a clear line through', () => {
    const board = map()
    const low = middleOf({ x: 2, y: 2 })
    const high = middleOf({ x: 2, y: 6 })
    expect(clearLine(board, low.x, low.z, high.x, high.z)).toBe(true)
  })
})

describe('walking', () => {
  it('does not go through walls', () => {
    let run = newRun(1, LIVES, 0, 3)
    const was = { x: run.x, z: run.z }
    // Straight at the nearest wall for a good long while.
    const into = { ...NO_INPUT, yaw: Math.PI, walk: 1 }
    run = drive(run, 4, into).run
    const cell = cellAt(run.x, run.z)
    expect(solid(run.map, cell.x, cell.y), 'ended up inside something').toBe(false)
    expect(Math.hypot(run.x - was.x, run.z - was.z), 'went nowhere at all')
      .toBeGreaterThan(0.2)
  })

  it('slides along a wall instead of stopping dead', () => {
    /*
     * Both axes at once and a shoulder against a wall stops you where you
     * stand, which in a corridor is walking on the spot while something
     * catches up. Moving one axis at a time is the whole fix and this is what
     * would notice it going away.
     */
    let run = newRun(1, LIVES, 0, 3)
    // A heading a few degrees off the wall it is walking into.
    const graze = { ...NO_INPUT, yaw: Math.PI * 0.78, walk: 1 }
    const was = { x: run.x, z: run.z }
    run = drive(run, 2.5, graze).run
    expect(Math.hypot(run.x - was.x, run.z - was.z)).toBeGreaterThan(3)
  })

  it('walks where you are looking', () => {
    let run = newRun(1, LIVES, 0, 7)
    const spot = clearing(run.map)
    run = { ...run, yaw: 0, machines: [], x: spot.x, z: spot.z }
    const before = run.z
    run = drive(run, 0.4, { ...NO_INPUT, walk: 1 }).run
    expect(run.z, 'facing north is towards less z').toBeLessThan(before)
  })
})

describe('shooting', () => {
  /** A run with one machine put straight in front of you and nothing else. */
  const duel = (away: number, off = 0): Run => {
    const base = newRun(1, LIVES, 0, 11)
    const look = facing(0, 0)
    // Standing in the open, with the machine straight down the barrel: a
    // long clear lane, so what is being tested is the shooting.
    const spot = clearing(base.map)
    return {
      ...base,
      yaw: 0,
      pitch: 0,
      x: spot.x,
      z: spot.z,
      machines: [{
        id: 1, breed: 'patrol' as const,
        x: spot.x + look.x * away + off,
        z: spot.z + look.z * away,
        facing: Math.PI, beat: { x: 2, y: 2 }, life: 2, reload: 99, alert: 0,
        fuse: 7, down: false, since: 0,
      }],
      bolts: [],
      fuses: [],
    }
  }

  it('hits what is in the middle of the screen', () => {
    const { heard } = drive(duel(12), 0.1, { ...NO_INPUT, firing: true })
    expect(heard).toContain('hit')
  })

  it('misses what is well off to the side', () => {
    const { heard } = drive(duel(12, 3), 0.1, { ...NO_INPUT, firing: true })
    expect(heard).not.toContain('hit')
  })

  it('takes two hits to put a patrol machine down, and drops its fuse', () => {
    const { run, heard } = drive(duel(10), 0.6, { ...NO_INPUT, firing: true })
    expect(heard).toContain('down')
    expect(run.machines[0].down).toBe(true)
    expect(run.fuses, 'nothing to pick up').toHaveLength(1)
    expect(run.fuses[0].number).toBe(7)
  })

  it('will not shoot through a wall', () => {
    const base = duel(10)
    // Wall the machine off behind the block it is standing next to.
    const spot = cellAt(base.machines[0].x, base.machines[0].z)
    const map = { ...base.map, cells: [...base.map.cells] }
    const mine = cellAt(base.x, base.z)
    map.cells[spot.y * map.wide + (mine.x + Math.sign(spot.x - mine.x))] = 'wall'
    map.cells[(mine.y + Math.sign(spot.y - mine.y) || mine.y) * map.wide + spot.x] = 'wall'
    const { heard } = drive({ ...base, map }, 0.2, { ...NO_INPUT, firing: true })
    expect(heard).not.toContain('hit')
  })

  it('leaves a tracer to show where the shot went', () => {
    const run = step(duel(12), { ...NO_INPUT, firing: true }, FIXED)
    expect(run.tracers).toHaveLength(1)
    expect(run.tracers[0].struck).toBe(true)
  })

  it('fires at its own rate however hard the trigger is held', () => {
    const { heard } = drive(duel(30), 1, { ...NO_INPUT, firing: true })
    const shots = heard.filter((e) => e === 'fire').length
    // A second of holding it down, at a shot every quarter of a second.
    expect(shots).toBeGreaterThanOrEqual(4)
    expect(shots).toBeLessThanOrEqual(6)
  })
})

describe('the machines', () => {
  it('wakes when it sees you, and says so once', () => {
    const base = newRun(1, LIVES, 0, 11)
    const look = facing(0, 0)
    const spot = clearing(base.map)
    const run: Run = {
      ...base,
      yaw: 0, x: spot.x, z: spot.z,
      machines: [{
        id: 1, breed: 'patrol', x: spot.x + look.x * 8,
        z: spot.z + look.z * 8,
        // Looking straight back at you.
        facing: Math.PI, beat: { x: 2, y: 2 }, life: 2, reload: 0.4, alert: 0,
        fuse: 3, down: false, since: 0,
      }],
      bolts: [], fuses: [],
    }
    const { heard } = drive(run, 1.2)
    expect(heard.filter((e) => e === 'spotted'), 'shouted more than once').toHaveLength(1)
    expect(heard).toContain('bolt')
  })

  it('does not see you through a building', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const run = newRun(3, LIVES, 0, seed)
      for (const machine of run.machines) {
        if (clearLine(run.map, machine.x, machine.z, run.x, run.z)) continue
        const dx = run.x - machine.x
        const dz = run.z - machine.z
        const pointed = { ...machine, facing: Math.atan2(dx, -dz) }
        const { heard } = drive({ ...run, machines: [pointed] }, 0.4)
        expect(heard, `machine ${machine.id} on seed ${seed}`).not.toContain('spotted')
      }
    }
  })

  it('costs a life when a bolt lands, and then leaves you alone for a moment', () => {
    const base = newRun(1, LIVES, 0, 4)
    const run: Run = {
      ...base,
      machines: [],
      bolts: [0, 1, 2].map((i) => ({
        id: 90 + i, x: base.x, y: 1.1, z: base.z + 2 + i * 0.3,
        vx: 0, vy: 0, vz: -14, age: 0,
      })),
    }
    const { run: after, heard } = drive(run, 0.5)
    expect(heard.filter((e) => e === 'hurt'), 'three bolts at once took three lives')
      .toHaveLength(1)
    expect(after.lives).toBe(LIVES - 1)
  })

  it('is over when the last life goes', () => {
    const base = newRun(1, 1, 0, 4)
    const run: Run = {
      ...base,
      machines: [],
      bolts: [{ id: 90, x: base.x, y: 1.1, z: base.z + 2, vx: 0, vy: 0, vz: -14, age: 0 }],
    }
    const { run: after, heard } = drive(run, 1)
    expect(heard).toContain('over')
    expect(after.status).toBe('over')
  })
})

describe('the lock', () => {
  it('asks for something that is really out there', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const mission of [1, 4, 6]) {
        const run = newRun(mission, LIVES, 0, seed)
        const fuses = run.machines.map((m) => m.fuse)
        expect(pickThatMakes(fuses, run.sockets, run.wants), `mission ${mission} seed ${seed}`)
          .not.toBeNull()
      }
    }
  })

  it('opens for the right fuses and grumbles at the wrong ones', () => {
    const base = newRun(1, LIVES, 0, 9)
    const door = middleOf(base.map.cage)
    const wrong: Run = { ...base, x: door.x, z: door.z - 1, belt: [1], machines: [] }
    const { run: stuck, heard: no } = drive(wrong, 0.3)
    expect(no).toContain('refused')
    expect(stuck.open).toBe(false)

    const right: Run = { ...wrong, belt: [base.wants - 1, 1] }
    const { run: opened, heard: yes } = drive(right, 0.3)
    expect(yes).toContain('open')
    expect(opened.open).toBe(true)
    expect(opened.friend, 'nobody came out').not.toBeNull()
    expect(opened.belt, 'it kept the fuses it used').toHaveLength(0)
  })

  it('does not grumble over and over', () => {
    const base = newRun(1, LIVES, 0, 9)
    const door = middleOf(base.map.cage)
    const { heard } = drive({ ...base, x: door.x, z: door.z - 1, belt: [1], machines: [] }, 3)
    expect(heard.filter((e) => e === 'refused').length).toBeLessThan(4)
  })

  it('picks the pair out of a beltful', () => {
    expect(pickThatMakes([3, 9, 4, 7], 2, 11)).toEqual([4, 7])
    expect(pickThatMakes([3, 9, 4, 7], 2, 20)).toBeNull()
    expect(pickThatMakes([3, 9, 4, 7], 3, 16)).toEqual([3, 9, 4])
  })
})

describe('fuses', () => {
  it('swaps the oldest out when the belt is full, rather than refusing', () => {
    /*
     * Refusing is how a mission quietly becomes unfinishable: four wrong
     * numbers in your pockets and the one you need lying at your feet.
     */
    const base = newRun(1, LIVES, 0, 6)
    const run: Run = {
      ...base,
      machines: [],
      belt: [1, 2, 3, 4],
      fuses: [{ id: 50, x: base.x, z: base.z, number: 9, age: 0, cool: 0 }],
    }
    const after = drive(run, 0.2).run
    expect(after.belt).toHaveLength(BELT)
    expect(after.belt).toContain(9)
    expect(after.belt, 'the oldest should have gone').not.toContain(1)
    expect(after.fuses.map((f) => f.number), 'and be on the floor').toContain(1)
  })

  it('is picked up by walking over it', () => {
    const base = newRun(1, LIVES, 0, 6)
    const run: Run = {
      ...base,
      machines: [],
      fuses: [{ id: 50, x: base.x + CLOSE * 0.5, z: base.z, number: 5, age: 0, cool: 0 }],
    }
    const { run: after, heard } = drive(run, 0.1)
    expect(heard).toContain('pick')
    expect(after.belt).toEqual([5])
  })
})

/*
 * And the whole mission, played by a bot.
 *
 * This is the one that matters. Every other test here says a rule is obeyed;
 * this one says the thing is finishable — that on a map nobody has ever looked
 * at, a player who shoots what it sees, picks up what it drops, works out which
 * numbers make the total and walks back to the chopper, gets out. The app's
 * standing promise is that there is always a way through, and the only way to
 * keep a promise like that is to send somebody through.
 */
function missionBot(run: Run): Input {
  const look = (tx: number, tz: number) => Math.atan2(tx - run.x, -(tz - run.z))

  // Anything standing, close, and in clear view gets shot at.
  let target: { x: number; z: number; far: number } | null = null
  for (const machine of run.machines) {
    if (machine.down) continue
    const far = Math.hypot(machine.x - run.x, machine.z - run.z)
    if (far > 22) continue
    if (!clearLine(run.map, run.x, run.z, machine.x, machine.z)) continue
    if (target === null || far < target.far) target = { x: machine.x, z: machine.z, far }
  }
  if (target) {
    const yaw = look(target.x, target.z)
    const pitch = Math.atan2(0.95 - EYE, Math.max(0.5, target.far))
    // Walk in a little as it fires, which is what stops a duel at the edge of
    // sight going on for ever.
    return { yaw, pitch, walk: target.far > 7 ? 0.6 : 0, side: 0, firing: true }
  }

  // Otherwise: somewhere to be — as a point on the floor, not just a cell.
  const where = (): { x: number; z: number } => {
    if (run.friend) return middleOf(run.map.pad)

    /*
     * Which numbers it is actually short of.
     *
     * Walking to the nearest fuse whatever you are carrying spends the whole
     * mission shuffling the same four numbers round the yard — with a full
     * belt, picking one up puts another down. And only going for a fuse that
     * finishes the sum on its own is not enough either: when the pair you need
     * is two numbers you have *neither* of, nothing finishes it on its own and
     * the bot stands at the door being refused until the clock runs out. It
     * did, three times out of nine.
     *
     * So it works out the pair the way a player does — out of everything on
     * the floor and everything on the belt — and then goes and fetches
     * whichever halves of it are not in its pockets yet.
     */
    const lying = run.fuses.filter((f) => f.cool <= 0)
    const world = [...run.belt, ...lying.map((f) => f.number)]
    const set = pickThatMakes(world, run.sockets, run.wants)
    if (set) {
      const spare = [...run.belt]
      const missing: number[] = []
      for (const n of set) {
        const had = spare.indexOf(n)
        if (had >= 0) spare.splice(had, 1)
        else missing.push(n)
      }
      const fetch = lying.filter((f) => missing.includes(f.number))
      if (fetch.length > 0) {
        return fetch.reduce((best, f) =>
          Math.hypot(f.x - run.x, f.z - run.z) < Math.hypot(best.x - run.x, best.z - run.z) ? f : best)
      }
    }

    if (pickThatMakes(run.belt, run.sockets, run.wants)) return middleOf(run.map.cage)
    const up = run.machines.filter((m) => !m.down)
    if (up.length > 0) {
      return up.reduce((best, m) =>
        Math.hypot(m.x - run.x, m.z - run.z) < Math.hypot(best.x - run.x, best.z - run.z) ? m : best)
    }
    return middleOf(run.map.cage)
  }

  const goal = where()
  const far = Math.hypot(goal.x - run.x, goal.z - run.z)
  /*
   * The last few metres are walked straight at the thing.
   *
   * Pathfinding works in cells and picking a fuse up works in metres, and a
   * cell is three metres across — so a bot that walks to the right *cell* can
   * stand two metres from the fuse it came for, with the field telling it it
   * has arrived, for ever. It did: four hundred seconds in the right square of
   * an empty compound with eight fuses on the floor.
   */
  if (far < 5 && clearLine(run.map, run.x, run.z, goal.x, goal.z)) {
    return { yaw: look(goal.x, goal.z), pitch: 0, walk: 1, side: 0, firing: false }
  }

  const field = reach(run.map, cellAt(goal.x, goal.z))
  const way = downhill(run.map, field, run.x, run.z)
  if (way.x === 0 && way.z === 0) {
    return { yaw: look(goal.x, goal.z), pitch: 0, walk: 1, side: 0, firing: false }
  }
  return {
    yaw: Math.atan2(way.x, -way.z), pitch: 0, walk: 1, side: 0, firing: false,
  }
}

describe('a mission', () => {
  const play = (run: Run, seconds: number) => {
    const dt = 1 / 60
    for (let t = 0; t < seconds; t += dt) {
      run = step(run, missionBot(run), dt)
      if (run.status !== 'playing') break
    }
    return run
  }

  it('can be finished', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = play(newRun(1, 40, 0, seed), 260)
      const said = `${seed}: ${run.status} at ${run.clock.toFixed(0)}s, ` +
        `${standing(run)} left, open ${run.open}`
      expect(run.status, said).toBe('done')
      /*
       * And takes about as long as a mission should. Too quick and the
       * compound is a corridor with a prize at the end; too slow and a
       * nine-year-old has put the phone down. Somewhere around a minute is
       * what this is aiming at, and the bot walks rather than sprints.
       */
      expect(run.clock, said).toBeGreaterThan(20)
      expect(run.clock, said).toBeLessThan(150)
    }
  }, 90_000)

  it('is finishable on the later, bigger ones too', () => {
    for (const mission of [3, 5, 7]) {
      const run = play(newRun(mission, 40, 0, 12), 420)
      expect(`mission ${mission}: ${run.status} ${run.open}`).toBe(`mission ${mission}: done true`)
    }
  }, 90_000)

  it('cannot be finished by standing on the pad', () => {
    // The mission has to be a mission. Doing nothing for four minutes never
    // opens the cage and never gets anybody home — it gets you shot, which is
    // the other thing this says.
    const { run, heard } = drive(newRun(1, 40, 0, 3), 240)
    expect(run.status).not.toBe('done')
    expect(run.open).toBe(false)
    expect(heard, 'nobody even came looking').toContain('spotted')
  }, 60_000)

  it('pays more for a quick one', () => {
    const quick = play(newRun(1, 40, 0, 2), 300)
    const idled = play({ ...newRun(1, 40, 0, 2), clock: 180 }, 300)
    expect(quick.score).toBeGreaterThan(idled.score)
  }, 60_000)

  it('needs her with you, not just you', () => {
    const base = newRun(1, LIVES, 0, 5)
    const pad = middleOf(base.map.pad)
    const alone: Run = {
      ...base, machines: [], open: true,
      friend: { x: pad.x + 30, z: pad.z },
      x: pad.x, z: pad.z,
    }
    // She is miles away and walled off from the field, so she cannot arrive.
    const after = drive({ ...alone, field: reach(base.map, { x: 1, y: 1 }) }, 0.5).run
    expect(after.status).toBe('playing')
  })

  it('plays the same way twice', () => {
    const once = play(newRun(1, 40, 0, 8), 120)
    const twice = play(newRun(1, 40, 0, 8), 120)
    expect(twice.score).toBe(once.score)
    expect(twice.clock).toBeCloseTo(once.clock, 6)
    expect(twice.x).toBeCloseTo(once.x, 6)
  }, 60_000)
})

describe('the way home', () => {
  it('brings her to the chopper behind you', () => {
    const base = newRun(1, LIVES, 0, 5)
    const pad = middleOf(base.map.pad)
    const door = middleOf(base.map.cage)
    let run: Run = {
      ...base, machines: [], open: true, friend: { x: door.x, z: door.z },
      x: door.x, z: door.z,
    }
    // Walk home the way the bot would.
    const dt = 1 / 60
    for (let t = 0; t < 120; t += dt) {
      const field = reach(run.map, run.map.pad)
      const way = downhill(run.map, field, run.x, run.z)
      const home = Math.hypot(pad.x - run.x, pad.z - run.z) < HOME * 0.6
      run = step(run, {
        yaw: Math.atan2(way.x, -way.z), pitch: 0, walk: home ? 0 : 1, side: 0, firing: false,
      }, dt)
      if (run.status !== 'playing') break
    }
    expect(run.status, 'she never caught up').toBe('done')
  }, 30_000)
})

describe('what the screen is told', () => {
  it('counts what is still standing', () => {
    const run = newRun(2, LIVES, 0, 3)
    expect(standing(run)).toBe(run.machines.length)
    const half = { ...run, machines: run.machines.map((m, i) => ({ ...m, down: i < 2 })) }
    expect(standing(half)).toBe(run.machines.length - 2)
  })

  it('knows a sentry is tougher than a patrol', () => {
    expect(BUILD.sentry.tough).toBeGreaterThan(BUILD.patrol.tough)
    expect(BUILD.sentry.pace).toBe(0)
  })
})
