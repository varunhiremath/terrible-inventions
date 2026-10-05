import { describe, expect, it } from 'vitest'
import { ARENA, BEAD, CREATURES, NEW_LENGTH, POWER_LASTS, SPEED, TURN } from './level'
import {
  FIXED, LOUDEST, NO_INPUT, bodyOf, dist, headOf, inside, newRun, respawn, ringArea, step,
  type Input, type Run, type SnakeEvent,
} from './run'

/**
 * The garden.
 *
 * Almost nothing here can be checked by looking at it. Whether a ring closed,
 * what was inside it, whether a head met a body rather than passed a pixel
 * from one — all of it is arithmetic that happens in a frame and is gone, and
 * a screenshot of a snake tells you nothing about any of it.
 */

const fly = (run: Run, input: Input, seconds: number): Run => {
  let now = run
  for (let t = 0; t < seconds; t += FIXED) now = step(now, input, FIXED)
  return now
}

/**
 * The player alone in an empty garden, so a test is about one snake.
 *
 * The emptiness has to be asked for rather than cleared afterwards: the garden
 * tops its food up every step, so a run handed an empty pellet list grew a
 * hundred and fifty of them on the first frame, and three tests about a
 * snake's length spent their whole run measuring a snake that was eating.
 */
/*
 * And a goal nobody can reach, so the garden never ends underneath the test.
 * These are tests about what a snake does, and a run that declares itself won
 * halfway through stops stepping — which showed up as "a snake curled on
 * itself for six seconds and never closed a ring", a sentence about rings that
 * was nothing to do with rings.
 */
const alone = (seed = 1): Run =>
  newRun(1, seed, {
    rivals: 0, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6,
  })

describe('a snake', () => {
  it('starts the length it is supposed to be', () => {
    const run = alone()
    const body = run.snakes[0].body
    let along = 0
    for (let i = 1; i < body.length; i++) along += dist(body[i - 1], body[i])
    expect(along).toBeCloseTo(NEW_LENGTH, 1)
  })

  it('goes the way it is pointed, at the pace it is meant to', () => {
    const run = alone()
    const from = { ...headOf(run.snakes[0]) }
    const after = fly({ ...run, snakes: [{ ...run.snakes[0], heading: 0 }] }, NO_INPUT, 1)
    const head = headOf(after.snakes[0])
    expect(head.x - from.x).toBeCloseTo(SPEED, 1)
    expect(head.y - from.y).toBeCloseTo(0, 1)
  })

  it('cannot turn faster than it is allowed to', () => {
    /*
     * The one number the whole feel rests on. Too quick and it corkscrews into
     * itself on a thumb twitch; too slow and the ring needed for an encircle
     * is wider than the garden.
     */
    const run = { ...alone(), snakes: [{ ...alone().snakes[0], heading: 0 }] }
    // Stick hard over to the opposite heading, which is the most it can ever
    // be asked for.
    const after = step(run, { x: -1, y: 0, dash: false }, FIXED)
    const turned = Math.abs(after.snakes[0].heading - 0)
    expect(turned).toBeLessThanOrEqual(TURN * FIXED + 1e-9)
  })

  it('holds its length steady when it is not eating', () => {
    const run = alone()
    const after = fly(run, NO_INPUT, 3)
    const body = after.snakes[0].body
    let along = 0
    for (let i = 1; i < body.length; i++) along += dist(body[i - 1], body[i])
    expect(along).toBeCloseTo(NEW_LENGTH, 1)
  })

  it('grows when it eats, and the body grows with it', () => {
    let run = alone()
    const head = headOf(run.snakes[0])
    run = {
      ...run,
      snakes: [{ ...run.snakes[0], heading: 0 }],
      // An ant, which is the one creature that does not run away — so this
      // stays a test about eating rather than about chasing.
      prey: [{
        id: 99, x: head.x + 0.3, y: head.y, kind: 'ant' as const,
        heading: 0, scare: 0, hop: 0, big: false,
      }],
    }
    const after = fly(run, NO_INPUT, 0.5)
    expect(after.prey).toHaveLength(0)
    expect(after.snakes[0].length).toBeCloseTo(NEW_LENGTH + CREATURES.ant.feeds, 2)
    expect(bodyOf(after.snakes[0]).length).toBeGreaterThan(bodyOf(run.snakes[0]).length)
  })

  it('dies on the garden wall', () => {
    const run = alone()
    const out = { ...run, snakes: [{ ...run.snakes[0], heading: 0, body: run.snakes[0].body.map((p) => ({ ...p, x: p.x + ARENA - 0.1 })) }] }
    const after = fly(out, NO_INPUT, 1)
    expect(after.status).toBe('lost')
    expect(after.snakes[0].alive).toBe(false)
  })

  it('does not die on its own neck, which it is always touching', () => {
    // The beads right behind the head are within a girth of it by definition —
    // that is what being attached means — so a check that counted them would
    // kill every snake on its first step.
    const after = fly(alone(), { x: 1, y: 0, dash: false }, 4)
    expect(after.status).toBe('playing')
    expect(after.snakes[0].alive).toBe(true)
  })
})

describe('the geometry an encircle rests on', () => {
  /*
   * Checked on shapes whose answers are known by hand, because every other
   * test in this file would pass with a point-in-polygon that always said yes.
   */
  const square = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]

  it('knows inside from outside', () => {
    expect(inside(square, { x: 1, y: 1 })).toBe(true)
    expect(inside(square, { x: 3, y: 1 })).toBe(false)
    expect(inside(square, { x: 1, y: 3 })).toBe(false)
    expect(inside(square, { x: -1, y: 1 })).toBe(false)
  })

  it('is not fooled by a dent in the shape', () => {
    // A ring made by a snake is rarely convex: it is whatever shape the thumb
    // drew. A C is the case that catches a convex-only test.
    const c = [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 1 },
      { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 0, y: 3 },
    ]
    expect(inside(c, { x: 0.5, y: 1.5 })).toBe(true)
    expect(inside(c, { x: 2, y: 1.5 })).toBe(false)
  })

  it('measures how much ground a ring covers', () => {
    expect(ringArea(square)).toBeCloseTo(4, 6)
  })
})

describe('closing a ring', () => {
  it('is what happens when a long snake turns inside itself', () => {
    let run = alone()
    // Long enough that a full circle fits inside its own body, which is the
    // condition for a ring at all.
    run = { ...run, snakes: [{ ...run.snakes[0], length: 9 }] }
    let saw = false
    let input: Input = { x: 0, y: 0, dash: false }
    for (let t = 0; t < 6; t += FIXED) {
      const want = run.snakes[0].heading + 1
      input = { x: Math.cos(want), y: Math.sin(want), dash: false }
      run = step(run, input, FIXED)
      if (run.events.includes('ring') || run.events.includes('close')) saw = true
    }
    expect(saw, 'a snake curled on itself for six seconds and never closed a ring').toBe(true)
  })

  it('costs the snake the length it looped over', () => {
    let run = alone()
    run = { ...run, snakes: [{ ...run.snakes[0], length: 9 }] }
    const was = run.snakes[0].length
    for (let t = 0; t < 6; t += FIXED) {
      const want = run.snakes[0].heading + 1
      run = step(run, { x: Math.cos(want), y: Math.sin(want), dash: false }, FIXED)
      if (run.snakes[0].length < was) break
    }
    expect(run.snakes[0].length).toBeLessThan(was)
    expect(run.snakes[0].alive, 'closing a ring killed the snake that closed it').toBe(true)
  })

  it('catches a snake whose head is inside it', () => {
    /*
     * Built rather than played: a ring drawn by hand round a rival, so the
     * question is whether the rule fires and not whether a bot can be herded.
     */
    let run = newRun(1, 1, { rivals: 1, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6 })
    const you = run.snakes[0]
    const them = run.snakes[1]
    // A circle of body, head last, with the rival sitting in the middle.
    const ring: { x: number; y: number }[] = []
    const beads = Math.round((Math.PI * 2 * 0.9) / BEAD)
    for (let i = 0; i <= beads; i++) {
      const a = (i / beads) * Math.PI * 2
      ring.push({ x: Math.cos(-a) * 0.9, y: Math.sin(-a) * 0.9 })
    }
    run = {
      ...run,
      snakes: [
        { ...you, body: ring, length: beads * BEAD, heading: Math.PI / 2 },
        { ...them, body: them.body.map((_, i) => ({ x: 0 - i * BEAD, y: 0 })), heading: 0 },
      ],
    }
    const after = step(run, NO_INPUT, FIXED)
    expect(after.snakes[1].alive, 'a snake sitting in the middle of a closed ring survived').toBe(false)
    expect(after.caught).toBe(1)
    expect(after.events).toContain('trap')
  })

  it('leaves what it caught on the ground to be eaten', () => {
    let run = newRun(1, 2, { rivals: 1, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6 })
    const you = run.snakes[0]
    const them = run.snakes[1]
    const ring: { x: number; y: number }[] = []
    const beads = Math.round((Math.PI * 2 * 0.9) / BEAD)
    for (let i = 0; i <= beads; i++) {
      const a = (i / beads) * Math.PI * 2
      ring.push({ x: Math.cos(-a) * 0.9, y: Math.sin(-a) * 0.9 })
    }
    run = {
      ...run,
      snakes: [
        { ...you, body: ring, length: beads * BEAD },
        { ...them, body: them.body.map((_, i) => ({ x: 0 - i * BEAD, y: 0 })) },
      ],
    }
    const after = step(run, NO_INPUT, FIXED)
    expect(after.prey.filter((p) => p.big).length).toBeGreaterThan(3)
  })
})

describe('running into somebody', () => {
  /**
   * Their body laid flat across the garden, with their head at the far end of
   * it and well clear of yours.
   *
   * The far end matters. Written the other way round, their head sat inside
   * the stretch of garden your own body occupies — so the test for "the one
   * that was run into survives" was watching them die of running into you.
   *
   * And the length has to be set with the body. A snake is trimmed to the
   * length it says it is on every step, so a body laid out five units long on
   * a snake that says it is two and a half becomes two and a half on the first
   * frame — the wall simply was not there any more by the time anybody
   * reached it, and the test reported that running into somebody is survivable.
   */
  const laidOut = (seed: number) => {
    const run = newRun(1, seed, { rivals: 1, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6 })
    const wall = Array.from({ length: 40 }, (_, i) => ({ x: 3.46 - i * BEAD, y: 0 }))
    const mine = Array.from({ length: 18 }, (_, i) => ({ x: -0.5 - i * BEAD, y: 0 }))
    return { run, wall, mine, wallLong: wall.length * BEAD, mineLong: mine.length * BEAD }
  }

  it('kills the one that did the running', () => {
    const { run: base, wall, mine, wallLong, mineLong } = laidOut(3)
    const run = {
      ...base,
      snakes: [
        { ...base.snakes[0], heading: 0, body: mine, length: mineLong },
        { ...base.snakes[1], body: wall, length: wallLong },
      ],
    }
    const after = fly(run, NO_INPUT, 0.6)
    expect(after.snakes[0].alive).toBe(false)
    expect(after.status).toBe('lost')
  })

  it('does not kill the one that was run into', () => {
    const { run: base, wall, mine, wallLong, mineLong } = laidOut(3)
    const run = {
      ...base,
      snakes: [
        { ...base.snakes[0], heading: 0, body: mine, length: mineLong },
        { ...base.snakes[1], body: wall, length: wallLong },
      ],
    }
    const after = fly(run, NO_INPUT, 0.6)
    expect(after.snakes[1].alive).toBe(true)
  })

  it('lets a ghost through', () => {
    const { run: base, wall, mine, wallLong, mineLong } = laidOut(3)
    const run = {
      ...base,
      snakes: [
        { ...base.snakes[0], heading: 0, held: { ghost: POWER_LASTS.ghost }, body: mine, length: mineLong },
        { ...base.snakes[1], body: wall, length: wallLong },
      ],
    }
    const after = fly(run, NO_INPUT, 0.6)
    expect(after.snakes[0].alive).toBe(true)
  })
})

describe('the noises', () => {
  it('has a place in the order for everything that can happen', () => {
    /*
     * Played, not listed.
     *
     * This was two hand-written lists compared with each other, neither of
     * them derived from the game — so adding an event to the game and to one
     * list kept it green while the screen silently dropped the new noise. It
     * now drives a garden and collects what actually comes out.
     */
    const raised = new Set<SnakeEvent>()
    const watch = (run: Run) => { for (const e of run.events) raised.add(e) }

    // A full garden, flown at the wall and through everybody, which between
    // them produce eating, charms, kills and deaths.
    for (let seed = 1; seed <= 6; seed++) {
      let run = newRun(1, seed * 7)
      for (let t = 0; t < 60; t += FIXED) {
        const you = run.snakes[0]
        const head = headOf(you)
        // Steer at the nearest rival, which is the quickest route to most of
        // these happening to somebody.
        const prey = run.snakes.slice(1).filter((o) => o.alive)[0]
        const want = prey
          ? { x: headOf(prey).x - head.x, y: headOf(prey).y - head.y }
          : { x: 1, y: 0 }
        run = step(run, { x: want.x, y: want.y, dash: t % 4 < 1 }, FIXED)
        watch(run)
        if (run.status === 'lost') run = respawn(run)
        if (run.status === 'won') break
      }
    }

    /*
     * And a ring, closed on purpose with somebody in it.
     *
     * A pilot that only steers at things never turns inside itself, so the
     * three noises the whole game is named for — the loop shutting, the cost
     * of one that caught nothing, and the catch itself — never happened. The
     * rival is held in the middle rather than left to wander: a snake travels
     * six units in the time a circle takes, so one left to itself is never
     * still there when the loop shuts.
     */
    {
      let run = newRun(1, 3, {
        rivals: 1, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6,
      })
      run.snakes[0].length = 9
      for (let t = 0; t < 10; t += FIXED) {
        const you = run.snakes[0]
        const prey = run.snakes[1]
        /*
         * Held at the middle of the loop, not at the origin — the origin is
         * where the player starts, so a rival pinned there is inside the
         * player before the first frame and they both die on the spot. The
         * middle of the loop is the average of the body, which is the one
         * place a closing ring is certain to enclose.
         */
        if (prey?.alive && you.alive && t > 1.5) {
          const mid = you.body.reduce(
            (a, b) => ({ x: a.x + b.x / you.body.length, y: a.y + b.y / you.body.length }),
            { x: 0, y: 0 },
          )
          prey.body = prey.body.map(() => mid)
        }
        run = step(run, { x: Math.cos(t * 2.6), y: Math.sin(t * 2.6), dash: false }, FIXED)
        watch(run)
      }
    }

    // And one round nothing, which is the costly half of the same move.
    {
      let run = alone(3)
      run.snakes[0].length = 9
      for (let t = 0; t < 8; t += FIXED) {
        run = step(run, { x: Math.cos(t * 2.6), y: Math.sin(t * 2.6), dash: false }, FIXED)
        watch(run)
      }
    }

    // And a head down a hole, which is the only thing that saves a small snake
    // from a big one and which a pilot steering at rivals never does.
    {
      let run = newRun(5, 2, { goal: 'last', want: 1e6 })
      const hole = run.burrows[0]
      if (hole) {
        run.snakes[0].body = run.snakes[0].body.map(() => ({ x: hole.x, y: hole.y }))
        for (let t = 0; t < 0.5; t += FIXED) { run = step(run, NO_INPUT, FIXED); watch(run) }
      }
    }

    // And a garden cleared, which needs a goal somebody can reach.
    {
      let run = newRun(1, 5, { goal: 'last', want: 2 })
      for (let t = 0; t < 4 && run.status === 'playing'; t += FIXED) {
        run = step(run, NO_INPUT, FIXED)
        watch(run)
      }
      expect(raised.has('cleared'), 'a garden was never cleared').toBe(true)
    }

    for (const e of raised) expect(LOUDEST, `${e} is not in the order`).toContain(e)
    const missing = LOUDEST.filter((e) => !raised.has(e))
    expect(missing, `never raised: ${missing.join(' ')}`).toEqual([])
  }, 30_000)

  it('says nothing more once the round is over', () => {
    // The crackle, which cost an afternoon in four other games: a finished run
    // handed back untouched re-announces its ending sixty times a second.
    let run: Run = { ...alone(), status: 'lost', events: ['died'] }
    for (let i = 0; i < 5; i++) {
      run = step(run, NO_INPUT, FIXED)
      expect(run.events).toHaveLength(0)
    }
  })
})
