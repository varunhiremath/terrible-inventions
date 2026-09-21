import { describe, expect, it } from 'vitest'
import { NOTHING, combine, keyAt, keyRadius, padHeight, padLayout, type Key } from './controls'

const W = 960
const H = 560
const walking = padLayout(W, H, false)
const fighting = padLayout(W, H, true)
const find = (keys: Key[], id: string) => keys.find((k) => k.id === id)!

describe('the pad', () => {
  it('keeps walking on the left and the big action on the right', () => {
    // So that when a fight starts, the thumbs are already in the right places
    // and only the meanings have moved.
    for (const keys of [walking, fighting]) {
      expect(find(keys, 'left').cx).toBeLessThan(W / 2)
      expect(find(keys, 'right').cx).toBeLessThan(W / 2)
    }
    expect(find(walking, 'up').cx).toBeGreaterThan(W / 2)
    expect(find(fighting, 'strike').cx).toBeGreaterThan(W / 2)
  })

  it('swaps the meanings when a guard turns up, rather than adding more buttons', () => {
    expect(walking.map((k) => k.id).sort()).toEqual(['care', 'down', 'left', 'right', 'up'])
    expect(fighting.map((k) => k.id).sort()).toEqual(['left', 'parry', 'right', 'strike'])
  })

  it('never overlaps two buttons', () => {
    for (const keys of [walking, fighting]) {
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const apart = Math.hypot(keys[i].cx - keys[j].cx, keys[i].cy - keys[j].cy)
          expect(apart).toBeGreaterThanOrEqual(keys[i].r + keys[j].r)
        }
      }
    }
  })

  it('keeps every button on the screen and inside its own strip', () => {
    const strip = padHeight(W, H)
    for (const keys of [walking, fighting]) {
      for (const key of keys) {
        expect(key.cx - key.r).toBeGreaterThanOrEqual(0)
        expect(key.cx + key.r).toBeLessThanOrEqual(W)
        expect(key.cy - key.r).toBeGreaterThanOrEqual(H - strip)
        expect(key.cy + key.r).toBeLessThanOrEqual(H)
      }
    }
  })

  it('stays a thumb on a phone and does not become a plate on a desktop', () => {
    expect(keyRadius(360, 200)).toBeGreaterThanOrEqual(24)
    expect(keyRadius(2400, 1500)).toBeLessThanOrEqual(54)
  })

  it('gives every button something to draw in it', () => {
    for (const key of [...walking, ...fighting]) expect(key.glyph).toBeTruthy()
  })
})

describe('pressing them', () => {
  it('reads a touch on a button, and a little outside it', () => {
    const up = find(walking, 'up')
    expect(keyAt(up.cx, up.cy, walking)).toBe('up')
    expect(keyAt(up.cx, up.cy + up.r * 1.15, walking)).toBe('up')
  })

  it('reads nothing in the middle of the room', () => {
    expect(keyAt(W / 2, H / 3, walking)).toBeNull()
  })

  it('lets one thumb walk while the other strikes', () => {
    const left = find(fighting, 'left')
    const strike = find(fighting, 'strike')
    const both = combine([keyAt(left.cx, left.cy, fighting), keyAt(strike.cx, strike.cy, fighting)])
    expect(both.left).toBe(true)
    expect(both.strike).toBe(true)
  })

  it('asks for nothing when nothing is touching', () => {
    expect(combine([])).toEqual(NOTHING)
  })

  it('cannot reach a fighting button while walking', () => {
    const strike = find(fighting, 'strike')
    expect(keyAt(strike.cx, strike.cy, walking)).not.toBe('strike')
  })
})
