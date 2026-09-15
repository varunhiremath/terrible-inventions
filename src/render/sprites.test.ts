import { describe, expect, it } from 'vitest'
import { SPRITE_SIZE, makeSprite, paletteFor } from './sprites'

const seeds = Array.from({ length: 60 }, (_, i) => i * 7919 + 13)

describe('sprites', () => {
  it('is the declared size', () => {
    const grid = makeSprite(1)
    expect(grid).toHaveLength(SPRITE_SIZE)
    expect(grid.every((row) => row.length === SPRITE_SIZE)).toBe(true)
  })

  it('is the same machine every time', () => {
    expect(makeSprite(42)).toEqual(makeSprite(42))
    expect(makeSprite(42)).not.toEqual(makeSprite(43))
  })

  it('is left-right symmetric', () => {
    for (const seed of seeds) {
      const grid = makeSprite(seed)
      for (let y = 0; y < SPRITE_SIZE; y++) {
        for (let x = 0; x < SPRITE_SIZE / 2; x++) {
          expect(grid[y][x]).toBe(grid[y][SPRITE_SIZE - 1 - x])
        }
      }
    }
  })

  it('always has two eyes, which is what makes it a character', () => {
    for (const seed of seeds) {
      const grid = makeSprite(seed)
      const eyes: [number, number][] = []
      grid.forEach((row, y) => row.forEach((c, x) => c === '#f4f7ff' && eyes.push([y, x])))

      expect(eyes).toHaveLength(2)
      expect(eyes[0][0]).toBe(eyes[1][0]) // level with each other
      expect(eyes[0][0]).toBeLessThan(SPRITE_SIZE / 2) // in the top half
    }
  })

  it('has a body substantial enough to see', () => {
    for (const seed of seeds) {
      const grid = makeSprite(seed)
      const solid = grid.flat().filter((c) => c !== null).length
      expect(solid).toBeGreaterThan(40)
      expect(solid).toBeLessThan(SPRITE_SIZE * SPRITE_SIZE)
    }
  })

  it('gives every machine its own colours', () => {
    const bodies = new Set(seeds.map((s) => paletteFor(s).body))
    expect(bodies.size).toBeGreaterThan(seeds.length * 0.7)
  })
})

describe('colour format', () => {
  it('emits colours three.js can actually parse', () => {
    // Canvas accepts "hsl(200 60% 55%)"; three.js only accepts the comma form,
    // and silently renders anything else white.
    for (const seed of seeds.slice(0, 20)) {
      for (const colour of makeSprite(seed).flat()) {
        if (!colour || colour.startsWith('#')) continue
        expect(colour).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
      }
    }
  })
})
