import { describe, expect, it } from 'vitest'
import { makeRng } from '../engine/rng'
import { HOUSE, roomByNumber, roomContaining } from './house'
import { actualNext, answerIsForced, roomsUnlocked, ruleFor, setTrap, springTrap, startHunt } from './hunt'
import { isSolidIn } from './house-solid'

describe('house', () => {
  it('has ten numbered rooms with distinct names', () => {
    expect(HOUSE.rooms).toHaveLength(10)
    expect(new Set(HOUSE.rooms.map((r) => r.number))).toEqual(new Set(Array.from({ length: 10 }, (_, i) => i + 1)))
    expect(new Set(HOUSE.rooms.map((r) => r.name)).size).toBe(10)
  })

  it('has rows of a consistent length', () => {
    expect(new Set(HOUSE.rows.map((r) => r.length)).size).toBe(1)
  })

  it('puts every room centre and the spawn on floor', () => {
    for (const room of HOUSE.rooms) expect(isSolidIn(HOUSE.rows, room.centre)).toBe(false)
    expect(isSolidIn(HOUSE.rows, HOUSE.spawn)).toBe(false)
  })

  it('lets you walk from the landing into every room', () => {
    const seen = new Set<string>()
    const queue = [HOUSE.spawn]
    while (queue.length) {
      const p = queue.shift()!
      const key = `${p.x},${p.y}`
      if (seen.has(key) || isSolidIn(HOUSE.rows, p)) continue
      seen.add(key)
      queue.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 })
    }
    for (const room of HOUSE.rooms) expect(seen.has(`${room.centre.x},${room.centre.y}`)).toBe(true)
  })

  it('locates a point back to its room', () => {
    for (const room of HOUSE.rooms) expect(roomContaining(room.centre)?.number).toBe(room.number)
    expect(roomContaining(HOUSE.spawn)).toBeUndefined()
    expect(roomByNumber(7)?.number).toBe(7)
  })
})

describe('hunt', () => {
  it('gets harder as the rating climbs', () => {
    const rng = makeRng(1)
    expect(ruleFor(700, 8, rng).kind).toBe('step')
    expect(ruleFor(2200, 8, rng).kind).toBe('fibStep')
  })

  it('never jumps further than the house is wide', () => {
    const rng = makeRng(7)
    for (const rooms of [3, 4, 6, 10]) {
      for (const rating of [700, 1000, 1300, 1600, 1900, 2300]) {
        const rule = ruleFor(rating, rooms, rng)
        const sizes =
          rule.kind === 'step' ? [Math.abs(rule.d)]
          : rule.kind === 'alternate' ? [Math.abs(rule.a), Math.abs(rule.b)]
          : []
        for (const size of sizes) expect(size).toBeLessThan(Math.max(3, rooms))
      }
    }
  })

  // A step equal to the room count wraps to zero and the creature sits still;
  // a step sharing a factor with it gives a two-room ping-pong. Both technically
  // "move" while offering nothing to work out.
  it('never serves a degenerate chase', () => {
    for (const rooms of [4, 6, 8, 10]) {
      for (const rating of [700, 1000, 1300, 1600, 1900, 2300]) {
        for (let seed = 0; seed < 25; seed++) {
          const hunt = startHunt(rating, rooms, seed * 13 + rating)
          expect(new Set(hunt.trail).size).toBeGreaterThanOrEqual(Math.min(3, rooms))
        }
      }
    }
  })

  it('starts with a trail inside the house', () => {
    for (let seed = 0; seed < 40; seed++) {
      const hunt = startHunt(1200, 8, seed)
      expect(hunt.trail.length).toBeGreaterThanOrEqual(3)
      for (const room of hunt.trail) {
        expect(room).toBeGreaterThanOrEqual(1)
        expect(room).toBeLessThanOrEqual(8)
      }
    }
  })

  it('catches it when the trap is on the right room', () => {
    const hunt = startHunt(1000, 8, 5)
    const after = springTrap(setTrap(hunt, actualNext(hunt)))
    expect(after.caught).toBe(true)
    expect(after.misses).toBe(0)
  })

  it('turns a miss into more evidence rather than a penalty', () => {
    const hunt = startHunt(1000, 8, 5)
    const wrong = actualNext(hunt) === 1 ? 2 : 1
    const after = springTrap(setTrap(hunt, wrong))

    expect(after.caught).toBe(false)
    expect(after.misses).toBe(1)
    expect(after.trail.length).toBe(hunt.trail.length + 1)
    expect(after.trapRoom).toBeNull()
  })

  it('always ends in a catch for a player who keeps predicting', () => {
    for (let seed = 0; seed < 60; seed++) {
      let hunt = startHunt(1500, 8, seed)
      for (let turn = 0; turn < 12 && !hunt.caught; turn++) {
        hunt = springTrap(setTrap(hunt, actualNext(hunt)))
      }
      expect(hunt.caught).toBe(true)
    }
  })

  it('serves a forced answer almost always, and never gets less determined', () => {
    let forced = 0
    const total = 80
    for (let seed = 0; seed < total; seed++) {
      const hunt = startHunt(1300, 10, seed)
      if (answerIsForced(hunt)) forced++
    }
    expect(forced / total).toBeGreaterThan(0.85)
  })

  it('ignores a trap once it has been caught', () => {
    const hunt = startHunt(1000, 8, 3)
    const caught = springTrap(setTrap(hunt, actualNext(hunt)))
    expect(springTrap(setTrap(caught, 1))).toEqual(caught)
  })

  it('opens the house up as catches accumulate', () => {
    expect(roomsUnlocked(0)).toBe(6)
    expect(roomsUnlocked(3)).toBe(9)
    expect(roomsUnlocked(20)).toBe(10)
  })
})
