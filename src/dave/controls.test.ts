import { describe, expect, it } from 'vitest'
import { DEAD_STRIP, UP_BAND, combine, zoneFor } from './controls'

const W = 800
const H = 400
const at = (fx: number, fy: number) => zoneFor(fx * W, fy * H, W, H)

describe('reading a touch', () => {
  it('walks towards the side you are touching', () => {
    expect(at(0.15, 0.7).left).toBe(true)
    expect(at(0.15, 0.7).right).toBe(false)
    expect(at(0.85, 0.7).right).toBe(true)
    expect(at(0.85, 0.7).left).toBe(false)
  })

  it('jumps from the upper band, wherever across it is', () => {
    expect(at(0.15, 0.1).up).toBe(true)
    expect(at(0.85, 0.1).up).toBe(true)
    expect(at(0.5, 0.1).up).toBe(true)
  })

  it('lets one finger mean a jump to the right', () => {
    // The whole reason for bands instead of buttons.
    const touch = at(0.85, 0.15)
    expect(touch.right).toBe(true)
    expect(touch.up).toBe(true)
  })

  it('leaves a strip up the middle that asks for nothing', () => {
    // Standing still has to be something you can ask for, or a platformer is
    // unplayable: you cannot line up a jump you cannot stop for.
    const middle = at(0.5, 0.7)
    expect(middle.left).toBe(false)
    expect(middle.right).toBe(false)
  })

  it('makes the dead strip narrow enough to be hard to hit by accident', () => {
    expect(DEAD_STRIP).toBeLessThan(0.2)
    expect(at(0.5 - DEAD_STRIP, 0.7).left).toBe(true)
    expect(at(0.5 + DEAD_STRIP, 0.7).right).toBe(true)
  })

  it('reads the very bottom as down, for flying back to the ground', () => {
    expect(at(0.3, 0.97).down).toBe(true)
    expect(at(0.3, 0.6).down).toBe(false)
  })

  it('gives the walking band most of the screen', () => {
    // Most of a touch's life is spent walking, so most of the glass should
    // mean walking rather than jumping.
    expect(UP_BAND).toBeLessThan(0.5)
  })

  it('never asks for left and right at once from one finger', () => {
    for (let i = 0; i <= 20; i++) {
      const touch = at(i / 20, 0.7)
      expect(touch.left && touch.right).toBe(false)
    }
  })

  it('survives a board with no size yet', () => {
    const none = zoneFor(0, 0, 0, 0)
    expect(none.left).toBe(false)
    expect(none.right).toBe(false)
  })
})

describe('several fingers at once', () => {
  it('adds them together, because that is how two thumbs work', () => {
    const both = combine([at(0.15, 0.7), at(0.85, 0.1)])
    expect(both.left).toBe(true)
    expect(both.right).toBe(true)
    expect(both.up).toBe(true)
  })

  it('asks for nothing when nothing is touching', () => {
    expect(combine([])).toEqual({ left: false, right: false, up: false, down: false })
  })

  it('lets a thumb walk while the other jumps', () => {
    const run = combine([at(0.8, 0.75), at(0.2, 0.12)])
    expect(run.right).toBe(true)
    expect(run.up).toBe(true)
  })
})
