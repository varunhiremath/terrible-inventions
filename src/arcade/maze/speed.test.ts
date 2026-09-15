import { describe, expect, it } from 'vitest'
import { frightenedSpeed, ghostSpeed, playerSpeed } from './game'

const LEVELS = Array.from({ length: 40 }, (_, i) => i + 1)

describe('how fast the level runs', () => {
  it('opens slowly enough to learn the controls', () => {
    // Roughly three and a half tiles a second: quick enough to feel like an
    // arcade game, slow enough to see a junction coming.
    expect(playerSpeed(1)).toBeLessThan(4)
    expect(playerSpeed(1)).toBeGreaterThan(3)
  })

  it('gives the first level a comfortable head start', () => {
    expect(playerSpeed(1) - ghostSpeed(1)).toBeGreaterThan(0.5)
  })

  it('speeds up every level, but never in a jump', () => {
    for (const level of LEVELS.slice(0, -1)) {
      const step = playerSpeed(level + 1) - playerSpeed(level)
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThan(0.25)
    }
  })

  it('closes the gap as the levels climb, so it gets harder', () => {
    const early = playerSpeed(1) - ghostSpeed(1)
    const later = playerSpeed(10) - ghostSpeed(10)
    expect(later).toBeLessThan(early)
  })

  it('never lets a chaser outrun the player', () => {
    // Being caught should always be a cornering mistake. A chaser that is
    // simply faster than you cannot be escaped at all, which is not a game.
    for (const level of LEVELS) {
      expect(ghostSpeed(level)).toBeLessThan(playerSpeed(level))
    }
  })

  it('keeps a frightened chaser clearly slower than a hunting one', () => {
    for (const level of LEVELS) {
      expect(frightenedSpeed(level)).toBeLessThan(ghostSpeed(level) * 0.8)
      expect(frightenedSpeed(level)).toBeGreaterThan(1)
    }
  })

  it('levels off rather than running away with itself', () => {
    expect(playerSpeed(200)).toBe(playerSpeed(100))
    expect(ghostSpeed(200)).toBe(ghostSpeed(100))
    expect(playerSpeed(100)).toBeLessThan(7)
  })

  it('survives a level number that makes no sense', () => {
    for (const level of [0, -5, Number.NaN]) {
      const speed = playerSpeed(level)
      expect(Number.isFinite(speed) ? speed : playerSpeed(1)).toBeGreaterThan(0)
    }
    expect(playerSpeed(0)).toBe(playerSpeed(1))
    expect(playerSpeed(-5)).toBe(playerSpeed(1))
  })

  it('is slower at level one than the old fixed pace', () => {
    // The change this file exists to lock in.
    expect(playerSpeed(1)).toBeLessThan(5.6)
    expect(ghostSpeed(1)).toBeLessThan(5.0)
  })
})
