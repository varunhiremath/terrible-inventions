import { describe, expect, it } from 'vitest'
import { readLevel, type Level } from './level'
import {
  NO_INPUT, RUN_TOP, WALK_TOP, newBody, step, type Body, type Input,
} from './physics'

const DT = 1 / 120

/** Flat ground with sky above it, as wide as you like. */
function flat(width = 200): Level {
  const rows = Array.from({ length: 13 }, () => ' '.repeat(width))
  rows.push('#'.repeat(width), '#'.repeat(width))
  return readLevel('flat', rows)
}

const press = (over: Partial<Input>): Input => ({ ...NO_INPUT, ...over })

/** Runs the body for a while and hands back everything it passed through. */
function play(level: Level, body: Body, seconds: number, input: (t: number) => Input) {
  const frames: Body[] = [body]
  let now = body
  for (let t = 0; t < seconds; t += DT) {
    now = step(now, input(t), level, DT).body
    frames.push(now)
  }
  return { last: now, frames }
}

/**
 * Settles him on the floor first, so nothing starts mid-fall.
 *
 * Dropped from just above the ground rather than from the top of the world: a
 * higher start can begin inside a block that the level has hanging in the air,
 * and a body that starts inside a wall behaves like nothing a player will ever
 * see.
 */
function grounded(level: Level, x = 4): Body {
  return play(level, newBody(x, 12), 0.5, () => NO_INPUT).last
}

describe('running', () => {
  it('takes a moment to get going, and does not stop dead', () => {
    const level = flat()
    const start = grounded(level)
    const quick = play(level, start, 0.1, () => press({ right: true })).last
    const settled = play(level, start, 1.5, () => press({ right: true })).last
    expect(quick.vx).toBeLessThan(settled.vx * 0.5)

    // Let go and he slides, rather than stopping under his own feet.
    const after = play(level, settled, 0.12, () => NO_INPUT).last
    expect(after.vx).toBeGreaterThan(0)
    expect(after.x).toBeGreaterThan(settled.x)
  })

  it('has two top speeds, and the run button is the faster one', () => {
    const level = flat()
    const start = grounded(level)
    const walked = play(level, start, 3, () => press({ right: true })).last
    const ran = play(level, start, 3, () => press({ right: true, run: true })).last
    expect(walked.vx).toBeCloseTo(WALK_TOP, 1)
    expect(ran.vx).toBeCloseTo(RUN_TOP, 1)
    expect(ran.vx).toBeGreaterThan(walked.vx * 1.4)
  })

  it('makes turning round at speed cost you ground', () => {
    // A skid is harder than friction, but it still carries him forwards for a
    // moment before it bites. That overshoot is the thing you have to learn.
    const level = flat()
    const fast = play(level, grounded(level), 3, () => press({ right: true, run: true })).last
    const turning = play(level, fast, 0.1, () => press({ left: true, run: true })).last
    expect(turning.x).toBeGreaterThan(fast.x)
    expect(turning.vx).toBeLessThan(fast.vx)
    expect(turning.facing).toBe(-1)
  })
})

describe('jumping', () => {
  const apex = (level: Level, body: Body, hold: number, extra: Partial<Input> = {}) => {
    const out = play(level, body, 1.6, (t) => press({ jump: t < hold, ...extra }))
    return Math.min(...out.frames.map((f) => f.y))
  }

  it('goes higher the longer the button is held', () => {
    const level = flat()
    const start = grounded(level)
    const tap = start.y - apex(level, start, 0.02)
    const half = start.y - apex(level, start, 0.16)
    const full = start.y - apex(level, start, 1)

    expect(tap).toBeGreaterThan(1.2)
    expect(half).toBeGreaterThan(tap + 0.4)
    expect(full).toBeGreaterThan(half)
    // The whole range has to be worth using: a full jump clears four tiles, a
    // tap clears one. Those two numbers are the vocabulary every level is
    // written in, so they are pinned rather than left to emerge.
    expect(full).toBeGreaterThan(3.8)
    expect(full).toBeLessThan(5.2)
    expect(tap).toBeLessThan(2.4)
  })

  it('cannot be pumped back up once the button is released', () => {
    // Letting go halfway commits him to the lower arc. Without this you could
    // tap-tap-tap your way across the sky.
    const level = flat()
    const start = grounded(level)
    const honest = start.y - apex(level, start, 0.08)
    const cheating = start.y - Math.min(
      ...play(level, start, 1.6, (t) => press({ jump: t < 0.08 || (t > 0.12 && t < 0.5) })).frames.map((f) => f.y),
    )
    expect(cheating).toBeCloseTo(honest, 2)
  })

  it('goes further when he is already running', () => {
    const level = flat()
    const still = grounded(level)
    const moving = play(level, still, 3, () => press({ right: true, run: true })).last

    const standingJump = play(level, still, 1.2, () => press({ jump: true, right: true }))
    const runningJump = play(level, moving, 1.2, () => press({ jump: true, right: true, run: true }))
    const over = (out: { last: Body; frames: Body[] }, from: Body) => out.last.x - from.x
    expect(over(runningJump, moving)).toBeGreaterThan(over(standingJump, still) * 1.8)

    // And higher, because his speed is worth something at the launch.
    const high = Math.min(...runningJump.frames.map((f) => f.y))
    const low = Math.min(...standingJump.frames.map((f) => f.y))
    expect(high).toBeLessThan(low)
  })

  it('will not jump again in mid-air', () => {
    const level = flat()
    const out = play(level, grounded(level), 0.6, () => press({ jump: true }))
    const leftGround = out.frames.filter((f) => f.jumped).length
    expect(leftGround).toBe(1)
  })
})

describe('the world', () => {
  it('stops him dead against a wall rather than letting him through it', () => {
    const rows = [
      ...Array.from({ length: 12 }, () => ' '.repeat(30)),
      '          S                   ',
      '##############################',
      '##############################',
    ]
    const level = readLevel('wall', rows)
    const out = play(level, grounded(level, 4), 3, () => press({ right: true, run: true })).last
    expect(out.x).toBeLessThan(10)
    expect(out.vx).toBe(0)
  })

  it('never lets a fall carry him through the floor', () => {
    // The fast way to find a tunnelling bug: drop him from the top of the
    // world at the highest speed the game allows.
    const level = flat()
    const out = play(level, newBody(4, 0), 3, () => NO_INPUT).last
    expect(out.onGround).toBe(true)
    expect(out.y).toBeCloseTo(13, 3)
  })

  it('tells you which block he hit his head on', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => ' '.repeat(30)),
      '    ?                         ',
      ...Array.from({ length: 3 }, () => ' '.repeat(30)),
      '##############################',
      '##############################',
    ]
    const level = readLevel('head', rows)
    const start = grounded(level, 4.5)
    let hit: { col: number; row: number } | null = null
    let now = start
    for (let t = 0; t < 1; t += DT) {
      const out = step(now, press({ jump: true }), level, DT)
      now = out.body
      if (out.bump) hit = out.bump
    }
    expect(hit).toEqual({ col: 4, row: 9 })
  })
})
