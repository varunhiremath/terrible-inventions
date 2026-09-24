import { describe, expect, it } from 'vitest'
import { FULL } from './maze'

const board = FULL
import { positionBetween, positionOf, type Mover } from './game'

const mover = (x: number, y: number, dir: Mover['dir'], progress = 0): Mover => ({
  cell: { x, y },
  dir,
  progress,
})

describe('drawing between two simulation steps', () => {
  it('sits on the earlier state at the start of the slice', () => {
    const a = mover(5, 5, 'right', 0.2)
    const b = mover(5, 5, 'right', 0.6)
    expect(positionBetween(board, a, b, 0)).toEqual(positionOf(a))
  })

  it('sits on the later state at the end of it', () => {
    const a = mover(5, 5, 'right', 0.2)
    const b = mover(5, 5, 'right', 0.6)
    expect(positionBetween(board, a, b, 1)).toEqual(positionOf(b))
  })

  it('lands halfway in between halfway through', () => {
    const a = mover(5, 5, 'right', 0.2)
    const b = mover(5, 5, 'right', 0.6)
    expect(positionBetween(board, a, b, 0.5).x).toBeCloseTo(5.4, 9)
  })

  it('carries smoothly over a tile boundary', () => {
    // The moment the cell advances and progress resets is exactly where a
    // naive blend would jump backwards by a whole tile.
    const a = mover(5, 5, 'right', 0.9)
    const b = mover(6, 5, 'right', 0.1)
    const mid = positionBetween(board, a, b, 0.5)
    expect(mid.x).toBeGreaterThan(5.9)
    expect(mid.x).toBeLessThan(6.1)
  })

  it('moves in one direction across the whole slice', () => {
    const a = mover(5, 5, 'right', 0.9)
    const b = mover(6, 5, 'right', 0.1)
    let last = -Infinity
    for (let t = 0; t <= 1; t += 0.05) {
      const x = positionBetween(board, a, b, t).x
      expect(x).toBeGreaterThanOrEqual(last)
      last = x
    }
  })

  it('snaps through the tunnel rather than flying back across the maze', () => {
    const a = mover(board.width - 1, 10, 'right', 0.9)
    const b = mover(0, 10, 'right', 0.1)
    const mid = positionBetween(board, a, b, 0.5)
    expect(mid).toEqual(positionOf(b))
  })

  it('clamps a blend that has run past its slice', () => {
    const a = mover(5, 5, 'right', 0)
    const b = mover(5, 5, 'right', 0.5)
    expect(positionBetween(board, a, b, 4)).toEqual(positionOf(b))
    expect(positionBetween(board, a, b, -2)).toEqual(positionOf(a))
  })

  it('stays put when nothing moved', () => {
    const still = mover(9, 19, 'left')
    expect(positionBetween(board, still, still, 0.37)).toEqual(positionOf(still))
  })

  it('never jumps further in a frame than the actors actually moved', () => {
    // The stutter this exists to remove is uneven per-frame movement. Sampling
    // the blend at even intervals must give even steps.
    const a = mover(3, 7, 'down', 0.1)
    const b = mover(3, 7, 'down', 0.9)
    // `t` comes from the index rather than an accumulator: adding 0.1 ten
    // times does not reach 1, and the drift shows up as a fake uneven step.
    const steps: number[] = []
    for (let i = 0; i < 10; i++) {
      const from = positionBetween(board, a, b, i / 10).y
      const to = positionBetween(board, a, b, (i + 1) / 10).y
      steps.push(to - from)
    }
    const biggest = Math.max(...steps)
    const smallest = Math.min(...steps)
    expect(biggest - smallest).toBeLessThan(1e-12)
  })
})
