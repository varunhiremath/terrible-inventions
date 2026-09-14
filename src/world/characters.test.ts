import { describe, expect, it } from 'vitest'
import { MACHINES, PAPA_AT, machineAt, isPapaAt, wingComplete } from './characters'
import { isSolid, roomAt } from './map'
import { GENERATORS } from '../content'

describe('characters', () => {
  it('stands everyone somewhere reachable, not inside a wall', () => {
    for (const m of MACHINES) expect(isSolid(m.at, false)).toBe(false)
    expect(isSolid(PAPA_AT, false)).toBe(false)
  })

  it('does not stack two characters on one tile', () => {
    const spots = [...MACHINES.map((m) => `${m.at.x},${m.at.y}`), `${PAPA_AT.x},${PAPA_AT.y}`]
    expect(new Set(spots).size).toBe(spots.length)
  })

  it('spreads the machines across the rooms', () => {
    expect(new Set(MACHINES.map((m) => roomAt(m.at))).size).toBe(MACHINES.length)
  })

  it('only asks for problem kinds that exist', () => {
    const known = new Set(GENERATORS.map((g) => g.id))
    for (const m of MACHINES) {
      expect(m.kinds.length).toBeGreaterThan(0)
      for (const k of m.kinds) expect(known.has(k)).toBe(true)
    }
  })

  it('gives every machine something to say in all three states', () => {
    for (const m of MACHINES) {
      expect(m.broken.length).toBeGreaterThan(1)
      expect(m.success.length).toBeGreaterThan(0)
      expect(m.working.length).toBeGreaterThan(1)
      expect(m.mission.trim().length).toBeGreaterThan(0)
      expect(m.length).toBeGreaterThan(0)
    }
  })

  it('gives every machine its own look', () => {
    expect(new Set(MACHINES.map((m) => m.seed)).size).toBe(MACHINES.length)
  })

  it('finds who is standing on a tile', () => {
    expect(machineAt(MACHINES[0].at)?.id).toBe(MACHINES[0].id)
    expect(machineAt({ x: 1, y: 1 })).toBeUndefined()
    expect(isPapaAt(PAPA_AT)).toBe(true)
  })

  it('opens the far door only when the whole wing works', () => {
    expect(wingComplete([])).toBe(false)
    expect(wingComplete(MACHINES.slice(0, 2).map((m) => m.id))).toBe(false)
    expect(wingComplete(MACHINES.map((m) => m.id))).toBe(true)
  })
})
