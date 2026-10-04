import { describe, expect, it } from 'vitest'
import { DASH_AT, aimOf, aimOfKeys, knobOf, stickReach } from './controls'

/**
 * The stick.
 *
 * Worth its own tests because a steering bug reads as the game being broken
 * rather than as the controls being wrong, and because every one of these is a
 * thing that works by keyboard and fails by finger.
 */
describe('one stick', () => {
  const reach = 60
  const held = (dx: number, dy: number) => ({ fromX: 100, fromY: 400, x: 100 + dx, y: 400 + dy, id: 1 })

  it('is still until the thumb has actually moved', () => {
    // A thumb resting on a screen wanders a few pixels. Steering on that would
    // make the snake twitch while nobody is doing anything.
    expect(aimOf(held(3, 2), reach)).toEqual({ x: 0, y: 0, dash: false })
  })

  it('points where the thumb is pushed', () => {
    const aim = aimOf(held(0, -reach), reach)
    expect(aim.y).toBeCloseTo(-1, 6)
    expect(aim.x).toBeCloseTo(0, 6)
  })

  it('does not go further than full lock however far the thumb goes', () => {
    const aim = aimOf(held(reach * 9, 0), reach)
    expect(Math.hypot(aim.x, aim.y)).toBeCloseTo(1, 6)
  })

  it('dashes only when it is pushed right over', () => {
    expect(aimOf(held(reach * (DASH_AT - 0.1), 0), reach).dash).toBe(false)
    expect(aimOf(held(reach, 0), reach).dash).toBe(true)
  })

  it('draws the knob where the reading says it is', () => {
    // These have drifted apart in other games and the result is a stick that
    // visibly points one way while the thing steers another.
    const stick = held(reach * 3, 0)
    const knob = knobOf(stick, reach)
    expect(Math.hypot(knob.x - stick.fromX, knob.y - stick.fromY)).toBeCloseTo(reach, 6)
    const aim = aimOf(stick, reach)
    expect(Math.atan2(knob.y - stick.fromY, knob.x - stick.fromX)).toBeCloseTo(Math.atan2(aim.y, aim.x), 6)
  })

  it('has nothing to read when nothing is held', () => {
    expect(aimOf(null, reach)).toEqual({ x: 0, y: 0, dash: false })
  })

  it('gives the same shape of answer from the keyboard', () => {
    expect(aimOfKeys(new Set(['ArrowRight'])).x).toBeCloseTo(1, 6)
    expect(aimOfKeys(new Set(['ArrowUp'])).y).toBeCloseTo(-1, 6)
    const corner = aimOfKeys(new Set(['ArrowUp', 'ArrowRight']))
    expect(Math.hypot(corner.x, corner.y)).toBeCloseTo(1, 6)
    expect(aimOfKeys(new Set()).x).toBe(0)
    expect(aimOfKeys(new Set(['ArrowUp', ' '])).dash).toBe(true)
  })

  it('sizes the stick for a thumb on any screen', () => {
    expect(stickReach(360, 640)).toBeGreaterThanOrEqual(38)
    expect(stickReach(2400, 1600)).toBeLessThanOrEqual(88)
  })
})
