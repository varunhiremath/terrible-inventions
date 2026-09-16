import { describe, expect, it } from 'vitest'
import {
  SWIPE_THRESHOLD,
  TAP_DEADZONE,
  directionFromGesture,
  directionFromSwipe,
  directionFromTap,
  toScreen,
} from './steer'

const at = (x: number, y: number) => ({ x, y })
const PLAYER = at(500, 400)

describe('tapping', () => {
  it('reads a tap to each side of the player', () => {
    expect(directionFromTap(at(700, 400), PLAYER)).toBe('right')
    expect(directionFromTap(at(300, 400), PLAYER)).toBe('left')
    expect(directionFromTap(at(500, 600), PLAYER)).toBe('down')
    expect(directionFromTap(at(500, 200), PLAYER)).toBe('up')
  })

  it('is measured against the player, not the middle of the screen', () => {
    // The same point on screen means different things depending on where he
    // is, which is the whole idea.
    const point = at(500, 400)
    expect(directionFromTap(point, at(200, 400))).toBe('right')
    expect(directionFromTap(point, at(800, 400))).toBe('left')
    expect(directionFromTap(point, at(500, 100))).toBe('down')
    expect(directionFromTap(point, at(500, 700))).toBe('up')
  })

  it('ignores a tap on the player himself', () => {
    expect(directionFromTap(PLAYER, PLAYER)).toBeNull()
    expect(directionFromTap(at(510, 405), PLAYER)).toBeNull()
  })

  it('takes a tap just outside the dead zone', () => {
    expect(directionFromTap(at(500 + TAP_DEADZONE + 1, 400), PLAYER)).toBe('right')
  })

  it('takes the longer axis when the tap is off the diagonal', () => {
    expect(directionFromTap(at(700, 450), PLAYER)).toBe('right')
    expect(directionFromTap(at(550, 700), PLAYER)).toBe('down')
  })

  it('never returns a direction it cannot mean', () => {
    for (let i = 0; i < 360; i += 7) {
      const rad = (i * Math.PI) / 180
      const touch = at(500 + Math.cos(rad) * 200, 400 + Math.sin(rad) * 200)
      const dir = directionFromTap(touch, PLAYER)
      expect(['up', 'down', 'left', 'right']).toContain(dir)
    }
  })
})

describe('swiping', () => {
  it('reads a flick in each direction', () => {
    expect(directionFromSwipe(at(100, 100), at(300, 100))).toBe('right')
    expect(directionFromSwipe(at(300, 100), at(100, 100))).toBe('left')
    expect(directionFromSwipe(at(100, 100), at(100, 300))).toBe('down')
    expect(directionFromSwipe(at(100, 300), at(100, 100))).toBe('up')
  })

  it('reads a scroll up and down as moving up and down', () => {
    // Asked for by name: a vertical drag is the most natural thing to try.
    expect(directionFromSwipe(at(640, 500), at(645, 120))).toBe('up')
    expect(directionFromSwipe(at(640, 120), at(636, 500))).toBe('down')
  })

  it('does not care where on the screen the swipe started', () => {
    expect(directionFromSwipe(at(20, 20), at(20, 400))).toBe('down')
    expect(directionFromSwipe(at(1100, 700), at(1100, 300))).toBe('up')
  })

  it('ignores a finger that barely moved', () => {
    expect(directionFromSwipe(at(100, 100), at(110, 110))).toBeNull()
    expect(directionFromSwipe(at(100, 100), at(100, 100))).toBeNull()
  })

  it('needs a real flick, not a wobble', () => {
    const short = SWIPE_THRESHOLD - 1
    expect(directionFromSwipe(at(0, 0), at(short, short))).toBeNull()
  })
})

describe('the whole gesture', () => {
  it('treats a drag as a swipe, wherever the player is', () => {
    // Swiping left while the tap would have meant right: the swipe wins,
    // because the finger said so explicitly.
    expect(directionFromGesture(at(900, 400), at(600, 400), at(100, 400))).toBe('left')
  })

  it('treats a press and release in one place as a tap', () => {
    expect(directionFromGesture(at(800, 402), at(803, 400), PLAYER)).toBe('right')
  })

  it('still swipes when the player is not on screen', () => {
    expect(directionFromGesture(at(100, 500), at(100, 100), null)).toBe('up')
  })

  it('does nothing on a stray touch with no player to aim at', () => {
    expect(directionFromGesture(at(100, 100), at(105, 102), null)).toBeNull()
  })

  it('does nothing when a tap lands on the player', () => {
    expect(directionFromGesture(PLAYER, PLAYER, PLAYER)).toBeNull()
  })
})

describe('finding the player on screen', () => {
  /** Stands in for the camera: clip space straight through. */
  const flat = (v: { x: number; y: number; z: number }) => ({ x: v.x, y: v.y })

  it('puts the middle of clip space in the middle of the canvas', () => {
    expect(toScreen({ x: 0, y: 0, z: 0 }, flat, { width: 800, height: 600 })).toEqual({
      x: 400,
      y: 300,
    })
  })

  it('flips the vertical axis, because screens count downwards', () => {
    expect(toScreen({ x: 0, y: 1, z: 0 }, flat, { width: 800, height: 600 }).y).toBe(0)
    expect(toScreen({ x: 0, y: -1, z: 0 }, flat, { width: 800, height: 600 }).y).toBe(600)
  })

  it('maps the corners of clip space to the corners of the canvas', () => {
    const size = { width: 1000, height: 500 }
    expect(toScreen({ x: -1, y: 1, z: 0 }, flat, size)).toEqual({ x: 0, y: 0 })
    expect(toScreen({ x: 1, y: -1, z: 0 }, flat, size)).toEqual({ x: 1000, y: 500 })
  })
})
