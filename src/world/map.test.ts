import { describe, expect, it } from 'vitest'
import { MAP, SPAWN, TILE, isSolid, mapHeight, mapWidth, roomAt, tileAt } from './map'

describe('map', () => {
  it('is enclosed on every side', () => {
    for (let x = 0; x < mapWidth; x++) {
      expect(isSolid({ x, y: 0 }, true)).toBe(true)
      expect(isSolid({ x, y: mapHeight - 1 }, true)).toBe(true)
    }
    for (let y = 0; y < mapHeight; y++) {
      expect(isSolid({ x: 0, y }, true)).toBe(true)
    }
  })

  it('treats everything off the map as wall', () => {
    expect(tileAt({ x: -1, y: 5 })).toBe(TILE.WALL)
    expect(tileAt({ x: 5, y: -1 })).toBe(TILE.WALL)
    expect(tileAt({ x: 9999, y: 9999 })).toBe(TILE.WALL)
  })

  it('spawns the player somewhere they can stand', () => {
    expect(isSolid(SPAWN, false)).toBe(false)
  })

  it('keeps the far door shut until the wing is finished', () => {
    const door = { x: 43, y: 10 }
    expect(tileAt(door)).toBe(TILE.LOCKED)
    expect(isSolid(door, false)).toBe(true)
    expect(isSolid(door, true)).toBe(false)
  })

  it('names the room you are standing in', () => {
    expect(roomAt({ x: 7, y: 4 })).toBe('Kitchen')
    expect(roomAt({ x: 22, y: 4 })).toBe('Garage')
    expect(roomAt({ x: 36, y: 4 })).toBe('Back room')
    expect(roomAt({ x: 21, y: 10 })).toBe('Corridor')
  })

  it('lets you walk from the spawn to every room', () => {
    // Flood fill from the spawn: if a room is unreachable the wing is broken.
    const seen = new Set<string>()
    const queue = [SPAWN]
    while (queue.length) {
      const p = queue.shift()!
      const key = `${p.x},${p.y}`
      if (seen.has(key) || isSolid(p, false)) continue
      seen.add(key)
      queue.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 })
    }

    for (const spot of [
      { x: 7, y: 4 },
      { x: 22, y: 4 },
      { x: 36, y: 4 },
    ]) {
      expect(seen.has(`${spot.x},${spot.y}`)).toBe(true)
    }
  })

  it('has rows of a consistent length', () => {
    // A short row would silently become wall and could seal a room off.
    expect(new Set(MAP.map((r) => r.length)).size).toBe(1)
  })
})
