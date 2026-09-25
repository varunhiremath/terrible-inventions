import { describe, expect, it } from 'vitest'
import { CUT, blend, tweenGuard, tweenPrince, tweenRun } from './smooth'
import { liftOf } from './draw'
import { newPrince } from './prince'
import { newRun } from './run'
import { levelFor } from './levels'

/**
 * Drawing between two steps.
 *
 * The simulation runs at fifteen a second and must keep doing so — the whole
 * movement engine is built on those steps landing exactly. Only the drawing
 * slides. So what these check is that the blending never changes where anyone
 * actually is, and that it knows when not to blend at all.
 */

const level = levelFor(1)
const prince = newPrince(level)

describe('blending a number', () => {
  it('lands on each end at each end', () => {
    expect(blend(2, 3, 0)).toBe(2)
    expect(blend(2, 3, 1)).toBe(3)
    expect(blend(2, 3, 0.5)).toBe(2.5)
  })

  it('cuts rather than glides when the gap is too big to be a step', () => {
    /*
     * Nothing in this game travels more than about a tile in a fifteenth of a
     * second. A bigger jump is a death, a respawn or a new level — and blending
     * across one of those sends the figure sailing across the room to his new
     * position.
     */
    expect(blend(2, 2 + CUT + 0.1, 0.5)).toBe(2 + CUT + 0.1)
    expect(blend(20, 2, 0.5)).toBe(2)
  })
})

describe('blending the prince', () => {
  it('leaves him exactly where the simulation put him at the end of a step', () => {
    const next = { ...prince, col: prince.col + 1 }
    const drawn = tweenPrince(prince, next, 1)
    expect(drawn.col).toBeCloseTo(next.col, 9)
    expect(drawn.row).toBeCloseTo(next.row, 9)
  })

  it('puts him half a tile along at half a step', () => {
    const next = { ...prince, col: prince.col + 1 }
    expect(tweenPrince(prince, next, 0.5).col).toBeCloseTo(prince.col + 0.5, 9)
  })

  it('keeps the pose on its own fifteen', () => {
    // Poses are drawn frames, not samples of a continuous motion. Blending two
    // of them would not be smoother, it would be rubbery.
    const next = { ...prince, col: prince.col + 1, frame: 4, action: 'run' as const }
    const drawn = tweenPrince({ ...prince, frame: 3 }, next, 0.5)
    expect(drawn.frame).toBe(4)
    expect(drawn.action).toBe('run')
  })

  it('smooths the arc of a jump, not just the ground he covers', () => {
    /*
     * The lift comes out of the frame table, so it steps at fifteen like
     * everything else — and it is the most visible movement in the game.
     * Blending the row alone gives a smooth run and a jump that still climbs
     * in four lurches.
     */
    const was = { ...prince, action: 'runJump' as const, frame: 1 }
    const now = { ...prince, action: 'runJump' as const, frame: 2 }
    const drawn = tweenPrince(was, now, 0.5)

    const height = (p: { row: number; action: string; frame: number }) =>
      p.row - liftOf(p.action, p.frame)
    // What the drawing will actually put on screen, after it subtracts the lift
    // for itself.
    const shown = drawn.row - liftOf(now.action, now.frame)
    expect(shown).toBeCloseTo((height(was) + height(now)) / 2, 9)
    expect(shown).not.toBeCloseTo(height(now), 4)
  })

  it('cuts on a death rather than sliding into it', () => {
    const dead = { ...prince, dead: true, col: prince.col + 0.2 }
    expect(tweenPrince(prince, dead, 0.5).col).toBe(dead.col)
  })

  it('has nothing to blend on the very first frame', () => {
    expect(tweenPrince(null, prince, 0.5)).toBe(prince)
  })
})

describe('blending a run', () => {
  it('cuts everybody when the level changes', () => {
    /*
     * The guards are a different set of people on a different floor. Matching
     * them up by position in the array would blend one man into another.
     */
    const here = newRun(levelFor(2), 2)
    const there = newRun(levelFor(3), 3)
    const drawn = tweenRun(here, there, 0.5)
    expect(drawn.prince).toBe(there.prince)
    expect(drawn.guards).toBe(there.guards)
  })

  it('blends everyone in the room while the level holds', () => {
    const here = newRun(levelFor(2), 2)
    const moved = {
      ...here,
      prince: { ...here.prince, col: here.prince.col + 1 },
      guards: here.guards.map((g) => ({ ...g, col: g.col - 1 })),
    }
    const drawn = tweenRun(here, moved, 0.5)
    expect(drawn.prince.col).toBeCloseTo(here.prince.col + 0.5, 9)
    drawn.guards.forEach((guard, i) => {
      expect(guard.col).toBeCloseTo(here.guards[i].col - 0.5, 9)
    })
  })

  it('leaves a guard alone if he has just arrived', () => {
    const here = newRun(levelFor(2), 2)
    const extra = { ...here, guards: [...here.guards, { ...here.guards[0], col: 4 }] }
    const drawn = tweenRun(here, extra, 0.5)
    expect(drawn.guards[drawn.guards.length - 1].col).toBe(4)
  })
})

describe('a guard', () => {
  it('slides between steps like everyone else', () => {
    const run = newRun(levelFor(2), 2)
    const guard = run.guards[0]
    expect(tweenGuard(guard, { ...guard, col: guard.col + 1 }, 0.5).col)
      .toBeCloseTo(guard.col + 0.5, 9)
  })
})
