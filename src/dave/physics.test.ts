import { describe, expect, it } from 'vitest'
import { LEVEL_TILES_X, TILE, normalise, type Level } from './level'
import {
  BODY_H,
  GRAVITY,
  JET_SECONDS,
  JUMP_SPEED,
  NO_INPUT,
  RUN_SPEED,
  TERMINAL_SPEED,
  cameraFor,
  canLeave,
  fillTank,
  floorIsHonest,
  newDave,
  step,
  type Dave,
  type Input,
} from './physics'

const FIXED = 1 / 120

/** A level from a picture of it, floor along the bottom. */
function level(rows: string[], start = { x: 2, y: 8 }): Level {
  return normalise({ name: 'test', start, rows })
}

/**
 * Ten rows: nine of sky and a floor, the full width of a level. Full width
 * matters — a short row gets padded with empty, and an empty bottom row is
 * exactly the invisible floor `floorIsHonest` exists to catch.
 */
function flat(extra: Partial<Record<number, string>> = {}): Level {
  const rows = Array.from({ length: 10 }, (_, y) => {
    const given = extra[y]
    if (given !== undefined) return given.padEnd(LEVEL_TILES_X, ' ')
    return (y === 9 ? '#' : ' ').repeat(LEVEL_TILES_X)
  })
  return level(rows)
}

function run(lv: Level, dave: Dave, input: Input, seconds: number): Dave {
  let out = dave
  for (let t = 0; t < seconds; t += FIXED) out = step(lv, out, input, FIXED)
  return out
}

const held = (over: Partial<Input>): Input => ({ ...NO_INPUT, ...over })

describe('standing and walking', () => {
  it('falls until it finds the floor, and then stops', () => {
    const lv = flat()
    const dave = run(lv, newDave({ x: 2, y: 2 }), NO_INPUT, 2)
    expect(dave.onGround).toBe(true)
    expect(dave.y).toBeCloseTo(9, 2)
    expect(dave.vy).toBe(0)
    expect(dave.alive).toBe(true)
  })

  it('walks at a steady pace', () => {
    const lv = flat()
    const start = run(lv, newDave({ x: 2, y: 8 }), NO_INPUT, 0.5)
    const after = run(lv, start, held({ right: true }), 1)
    expect(after.x - start.x).toBeCloseTo(RUN_SPEED, 0)
  })

  it('faces the way it is going, and keeps facing that way when it stops', () => {
    const lv = flat()
    let dave = run(lv, newDave({ x: 5, y: 8 }), held({ left: true }), 0.2)
    expect(dave.facing).toBe(-1)
    dave = run(lv, dave, NO_INPUT, 0.2)
    expect(dave.facing).toBe(-1)
  })

  it('stops dead at a wall instead of climbing into it', () => {
    const lv = flat({ 8: ' '.repeat(10) + '#' + ' '.repeat(29) })
    const dave = run(lv, newDave({ x: 2, y: 8 }), held({ right: true }), 3)
    expect(dave.x).toBeLessThan(10)
    expect(dave.x).toBeGreaterThan(9)
    expect(dave.alive).toBe(true)
  })

  it('cannot walk off the left edge of the world', () => {
    const lv = flat()
    const dave = run(lv, newDave({ x: 2, y: 8 }), held({ left: true }), 3)
    expect(dave.x).toBeGreaterThanOrEqual(0)
  })
})

describe('jumping', () => {
  const lv = flat()
  const grounded = () => run(lv, newDave({ x: 5, y: 8 }), NO_INPUT, 0.5)

  it('leaves the ground when asked, and only from the ground', () => {
    const dave = step(lv, grounded(), held({ jump: true }), FIXED)
    expect(dave.vy).toBeLessThan(0)
    expect(dave.onGround).toBe(false)
  })

  it('will not jump again in mid-air', () => {
    let dave = step(lv, grounded(), held({ jump: true }), FIXED)
    dave = run(lv, dave, NO_INPUT, 0.15)
    const rising = dave.vy
    dave = step(lv, dave, held({ jump: true }), FIXED)
    // Still falling under gravity, not launched a second time.
    expect(dave.vy).toBeGreaterThan(rising)
  })

  it('clears a useful height and comes back down', () => {
    // Two to three tiles: enough for the gaps this game is made of, not so
    // much that the level design stops mattering.
    let dave = step(lv, grounded(), held({ jump: true }), FIXED)
    const floor = dave.y
    let highest = dave.y
    for (let i = 0; i < 400; i++) {
      dave = step(lv, dave, NO_INPUT, FIXED)
      highest = Math.min(highest, dave.y)
      if (dave.onGround) break
    }
    const height = floor - highest
    // Enough to get on top of a ledge three tiles up, which is what every
    // level is built out of, with margin so it is not a frame-perfect thing.
    expect(height).toBeGreaterThan(3.2)
    expect(height).toBeLessThan(4.2)
    expect(dave.onGround).toBe(true)
  })

  it('matches the height and the reach its numbers promise', () => {
    // If these drift, one of the constants moved and the jump no longer means
    // what the file says it means — and the levels were drawn around the reach.
    expect((JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)).toBeCloseTo(3.6, 1)
    const airTime = (2 * JUMP_SPEED) / GRAVITY
    expect(RUN_SPEED * airTime).toBeGreaterThan(5.4)
  })

  it('gets on top of a ledge three tiles up', () => {
    const ledge = flat({
      6: ' '.repeat(10) + '#'.repeat(6) + ' '.repeat(LEVEL_TILES_X - 16),
    })
    let dave = run(ledge, newDave({ x: 6, y: 8 }), held({ right: true }), 0.1)
    dave = step(ledge, dave, held({ jump: true, right: true }), FIXED)
    let landed = false
    for (let i = 0; i < 400; i++) {
      dave = step(ledge, dave, held({ right: true }), FIXED)
      if (dave.onGround && dave.y < 8) { landed = true; break }
    }
    expect(landed).toBe(true)
  })

  it('clears a four-tile pit, which is the widest the levels use', () => {
    const pit = flat({ 9: '#'.repeat(10) + '^'.repeat(4) + '#'.repeat(LEVEL_TILES_X - 14) })
    let dave = run(pit, newDave({ x: 8, y: 8 }), held({ right: true }), 0.18)
    dave = step(pit, dave, held({ jump: true, right: true }), FIXED)
    for (let i = 0; i < 300 && !dave.onGround; i++) {
      dave = step(pit, dave, held({ right: true }), FIXED)
      if (!dave.alive) break
    }
    expect(dave.alive).toBe(true)
    expect(dave.x).toBeGreaterThan(14)
  })

  it('travels sideways while it is in the air', () => {
    let dave = step(lv, grounded(), held({ jump: true, right: true }), FIXED)
    const from = dave.x
    for (let i = 0; i < 400; i++) {
      dave = step(lv, dave, held({ right: true }), FIXED)
      if (dave.onGround) break
    }
    expect(dave.x - from).toBeGreaterThan(3)
  })

  it('bumps its head on a ceiling rather than passing through it', () => {
    const low = flat({ 6: '#'.repeat(40) })
    let dave = run(low, newDave({ x: 5, y: 8 }), NO_INPUT, 0.5)
    dave = step(low, dave, held({ jump: true }), FIXED)
    for (let i = 0; i < 200; i++) {
      dave = step(low, dave, NO_INPUT, FIXED)
      expect(dave.y - BODY_H).toBeGreaterThan(6.5)
      if (dave.onGround) break
    }
  })

  it('never falls faster than its own limit', () => {
    const deep = level(Array.from({ length: 10 }, () => ' '.repeat(40)), { x: 2, y: 0 })
    let dave = newDave({ x: 2, y: 0 })
    for (let i = 0; i < 600; i++) {
      dave = step(deep, dave, NO_INPUT, FIXED)
      expect(dave.vy).toBeLessThanOrEqual(TERMINAL_SPEED + 1e-9)
    }
  })
})

describe('what kills him', () => {
  for (const [name, tile] of [
    ['fire', TILE.FIRE],
    ['water', TILE.WATER],
    ['a tentacle', TILE.TENTACLE],
  ] as const) {
    it(`dies on touching ${name}`, () => {
      const lv = flat({ 8: ' '.repeat(6) + tile + ' '.repeat(33) })
      const dave = run(lv, newDave({ x: 2, y: 8 }), held({ right: true }), 2)
      expect(dave.alive).toBe(false)
    })
  }

  it('cannot fall out of the world, because the world has edges', () => {
    // Everything past the map counts as solid. That is deliberate — it is what
    // stops anything tunnelling off the end — and it means a level with a hole
    // in its bottom row has an invisible floor. That is an authoring mistake,
    // and there is a check for it rather than a physics rule.
    const hole = level(Array.from({ length: 10 }, () => ' '.repeat(40)), { x: 2, y: 0 })
    const dave = run(hole, newDave({ x: 2, y: 0 }), NO_INPUT, 3)
    expect(dave.alive).toBe(true)
    expect(dave.onGround).toBe(true)
    expect(floorIsHonest(hole).length).toBeGreaterThan(0)
  })

  it('passes a level whose floor you can actually see', () => {
    expect(floorIsHonest(flat())).toEqual([])
    const lava = level([
      ...Array.from({ length: 9 }, () => ' '.repeat(LEVEL_TILES_X)),
      TILE.FIRE.repeat(LEVEL_TILES_X),
    ])
    expect(floorIsHonest(lava)).toEqual([])
  })

  it('stops moving once it is dead', () => {
    const lv = flat({ 8: ' '.repeat(6) + TILE.FIRE + ' '.repeat(33) })
    const dead = run(lv, newDave({ x: 2, y: 8 }), held({ right: true }), 2)
    const later = run(lv, dead, held({ right: true }), 1)
    expect(later).toEqual(dead)
  })

  it('walks safely past a pickup', () => {
    const lv = flat({ 8: ' '.repeat(6) + TILE.CROWN + ' '.repeat(33) })
    const dave = run(lv, newDave({ x: 2, y: 8 }), held({ right: true }), 1)
    expect(dave.alive).toBe(true)
  })
})

describe('the jetpack', () => {
  const lv = flat()

  it('does nothing at all without one', () => {
    const dave = run(lv, newDave({ x: 5, y: 8 }), held({ up: true }), 1)
    expect(dave.flying).toBe(false)
    expect(dave.onGround).toBe(true)
  })

  it('lifts him off the ground and holds him up', () => {
    const dave = run(lv, fillTank(run(lv, newDave({ x: 5, y: 8 }), NO_INPUT, 0.5)), held({ up: true }), 1)
    expect(dave.flying).toBe(true)
    expect(dave.y).toBeLessThan(8)
  })

  it('burns fuel whether it moves or not', () => {
    // Which is exactly what makes a tank a decision rather than a free ride.
    const ready = fillTank(run(lv, newDave({ x: 5, y: 8 }), NO_INPUT, 0.5))
    const hovering = run(lv, ready, held({ up: true }), 1)
    const drifting = run(lv, ready, held({ up: true, right: true }), 1)
    expect(hovering.fuel).toBeCloseTo(drifting.fuel, 6)
    expect(hovering.fuel).toBeLessThan(JET_SECONDS)
  })

  it('runs out, and falls when it does', () => {
    const ready = fillTank(run(lv, newDave({ x: 5, y: 8 }), NO_INPUT, 0.5))
    const spent = run(lv, ready, held({ up: true }), JET_SECONDS + 1)
    expect(spent.fuel).toBe(0)
    expect(spent.flying).toBe(false)
  })

  it('cannot be topped up by anything but another jetpack', () => {
    const ready = fillTank(run(lv, newDave({ x: 5, y: 8 }), NO_INPUT, 0.5))
    const half = run(lv, ready, held({ up: true }), 4)
    expect(half.fuel).toBeLessThan(JET_SECONDS)
    expect(fillTank(half).fuel).toBe(JET_SECONDS)
  })
})

describe('the trophy and the door', () => {
  it('will not let him leave without the trophy', () => {
    const lv = flat({ 8: ' '.repeat(3) + TILE.DOOR + ' '.repeat(36) })
    const dave = run(lv, newDave({ x: 3, y: 8 }), NO_INPUT, 0.6)
    expect(canLeave(lv, dave)).toBe(false)
  })

  it('lets him leave once he has it', () => {
    const lv = flat({ 8: ' '.repeat(3) + TILE.DOOR + ' '.repeat(36) })
    const dave = run(lv, newDave({ x: 3, y: 8 }), NO_INPUT, 0.6)
    expect(canLeave(lv, { ...dave, hasTrophy: true })).toBe(true)
  })

  it('is not a door just because he has the trophy', () => {
    const lv = flat()
    const dave = run(lv, newDave({ x: 3, y: 8 }), NO_INPUT, 0.6)
    expect(canLeave(lv, { ...dave, hasTrophy: true })).toBe(false)
  })
})

describe('the camera', () => {
  it('keeps him in the middle once he is away from the ends', () => {
    const dave = { ...newDave({ x: 50, y: 5 }) }
    expect(cameraFor(dave, 20, LEVEL_TILES_X)).toBeCloseTo(40.5, 6)
  })

  it('stops at the start of the level rather than showing the void', () => {
    expect(cameraFor(newDave({ x: 1, y: 5 }), 20, LEVEL_TILES_X)).toBe(0)
  })

  it('stops at the end of the level', () => {
    expect(cameraFor(newDave({ x: 99, y: 5 }), 20, LEVEL_TILES_X)).toBe(LEVEL_TILES_X - 20)
  })
})

describe('being reproducible', () => {
  it('plays out identically from identical input', () => {
    const lv = flat()
    const a = run(lv, newDave({ x: 2, y: 2 }), held({ right: true, jump: true }), 2)
    const b = run(lv, newDave({ x: 2, y: 2 }), held({ right: true, jump: true }), 2)
    expect(a).toEqual(b)
  })

  it('does not depend on how finely it is stepped', () => {
    // The lesson from the maze: a simulation tied to the frame rate plays in
    // slow motion on a slow device.
    const lv = flat()
    const coarse = (() => {
      let d = newDave({ x: 2, y: 2 })
      for (let t = 0; t < 1; t += 1 / 60) d = step(lv, d, held({ right: true }), 1 / 60)
      return d
    })()
    const fine = (() => {
      let d = newDave({ x: 2, y: 2 })
      for (let t = 0; t < 1; t += 1 / 240) d = step(lv, d, held({ right: true }), 1 / 240)
      return d
    })()
    expect(coarse.x).toBeCloseTo(fine.x, 1)
    expect(coarse.y).toBeCloseTo(fine.y, 0)
  })
})
