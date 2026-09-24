import { describe, expect, it } from 'vitest'
import { MARGIN, scrollTo, screenFraction } from './camera'

const SPAN = 20
const WORLD = 200

describe('the scrolling camera', () => {
  it('never lets the player get nearer the edge than the margin', () => {
    // The whole ask. Walk the length of the world, a fraction of a tile at a
    // time, carrying the camera along, and check every single position.
    let camera = 0
    for (let x = SPAN / 2; x < WORLD - SPAN / 2; x += 0.25) {
      camera = scrollTo(camera, x, SPAN, WORLD)
      const at = screenFraction(camera, x, SPAN)
      expect(at, `at ${x}`).toBeGreaterThanOrEqual(MARGIN - 1e-9)
      expect(at, `at ${x}`).toBeLessThanOrEqual(1 - MARGIN + 1e-9)
    }
  })

  it('holds still while he moves about inside the band', () => {
    // A camera that tracks every step makes the background swim under a player
    // who is only shuffling. Inside the band it should not move at all.
    const camera = scrollTo(0, SPAN / 2, SPAN, WORLD)
    expect(scrollTo(camera, SPAN / 2 + 1, SPAN, WORLD)).toBe(camera)
    expect(scrollTo(camera, SPAN / 2 - 1, SPAN, WORLD)).toBe(camera)
  })

  it('follows him back the other way', () => {
    // It used to ratchet forwards only, so walking left took you to the edge
    // of the screen and then off it.
    let camera = scrollTo(0, 100, SPAN, WORLD)
    const forward = camera
    camera = scrollTo(camera, 60, SPAN, WORLD)
    expect(camera).toBeLessThan(forward)
  })

  it('moves exactly as far as he does once he is pushing the band', () => {
    const camera = scrollTo(0, 100, SPAN, WORLD)
    const after = scrollTo(camera, 101, SPAN, WORLD)
    expect(after - camera).toBeCloseTo(1, 9)
  })

  it('stops at both ends of the world rather than showing nothing', () => {
    expect(scrollTo(0, 0, SPAN, WORLD)).toBe(0)
    expect(scrollTo(0, 1, SPAN, WORLD)).toBe(0)
    expect(scrollTo(500, WORLD - 1, SPAN, WORLD)).toBe(WORLD - SPAN)
  })

  it('keeps the whole view inside the world wherever he stands', () => {
    let camera = 0
    for (let x = 0; x <= WORLD; x += 0.5) {
      camera = scrollTo(camera, x, SPAN, WORLD)
      expect(camera, `at ${x}`).toBeGreaterThanOrEqual(0)
      expect(camera + SPAN, `at ${x}`).toBeLessThanOrEqual(WORLD)
    }
  })

  it('keeps him on screen even in the corners where it has stopped', () => {
    for (const x of [0, 0.5, 1, WORLD - 1, WORLD - 0.5]) {
      const camera = scrollTo(0, x, SPAN, WORLD)
      const at = screenFraction(camera, x, SPAN)
      expect(at, `at ${x}`).toBeGreaterThanOrEqual(0)
      expect(at, `at ${x}`).toBeLessThanOrEqual(1)
    }
  })

  it('does not scroll a world that already fits', () => {
    expect(scrollTo(0, 5, 30, 20)).toBe(0)
    expect(scrollTo(0, 19, 30, 20)).toBe(0)
  })
})
