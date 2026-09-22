import { describe, expect, it } from 'vitest'
import { createLatch, keyAt, padHeight, padLayout } from './controls'

describe('the pad', () => {
  it('keeps the thumbs apart', () => {
    const keys = padLayout(900, 420)
    const left = keys.filter((k) => k.glyph === 'left' || k.glyph === 'right')
    const right = keys.filter((k) => k.glyph === 'run' || k.glyph === 'jump')
    expect(Math.max(...left.map((k) => k.cx))).toBeLessThan(Math.min(...right.map((k) => k.cx)))
  })

  it('makes jump the biggest button on it', () => {
    // It is pressed more than everything else put together, and how long it is
    // held is the whole of the jumping.
    const keys = padLayout(900, 420)
    const jump = keys.find((k) => k.id === 'jump')!
    for (const other of keys) {
      if (other.id !== 'jump') expect(jump.r).toBeGreaterThan(other.r)
    }
  })

  it('never overlaps two buttons', () => {
    for (const [w, h] of [[900, 420], [1400, 800], [420, 900]] as const) {
      const keys = padLayout(w, h)
      for (const a of keys) {
        for (const b of keys) {
          if (a === b) continue
          expect(Math.hypot(a.cx - b.cx, a.cy - b.cy), `${a.id}/${b.id} at ${w}x${h}`)
            .toBeGreaterThan(a.r + b.r)
        }
      }
    }
  })

  it('leaves the level room above the pad', () => {
    for (const [w, h] of [[900, 420], [420, 900]] as const) {
      const keys = padLayout(w, h)
      const top = Math.min(...keys.map((k) => k.cy - k.r))
      expect(top, `${w}x${h}`).toBeGreaterThan(h - padHeight(w, h) - 1)
    }
  })

  it('finds the button under a thumb, and nothing under an empty patch', () => {
    const keys = padLayout(900, 420)
    const jump = keys.find((k) => k.id === 'jump')!
    expect(keyAt(jump.cx, jump.cy, keys)).toBe('jump')
    expect(keyAt(450, 60, keys)).toBe(null)
  })
})

describe('the latch', () => {
  it('holds a tap that is over before the next step', () => {
    const latch = createLatch()
    latch.press(1, 'jump')
    latch.release(1)
    expect(latch.read().jump).toBe(true)
    latch.consumed()
    expect(latch.read().jump).toBe(false)
  })

  it('keeps a held button down for as long as it is held', () => {
    const latch = createLatch()
    latch.press(1, 'right')
    latch.consumed()
    expect(latch.read().right).toBe(true)
    latch.release(1)
    expect(latch.read().right).toBe(false)
  })

  it('tracks two thumbs at once, which running and jumping needs', () => {
    const latch = createLatch()
    latch.press(1, 'right')
    latch.press(2, 'jump')
    const held = latch.read()
    expect(held.right).toBe(true)
    expect(held.jump).toBe(true)
  })
})
