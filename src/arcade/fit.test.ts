import { describe, expect, it } from 'vitest'
import { boardCentreOnScreen, fitBoard, type Inset } from './fit'

/** The maze, twenty-seven by thirty-one. */
const SPAN_X = 27
const SPAN_Y = 31

/** What the score bar and the lives row measure, read off the running app. */
const BARS: Inset = { top: 52, bottom: 40, left: 0, right: 0 }

/** The devices this is actually played on. */
const screens = [
  { name: 'phone portrait', w: 390, h: 844 },
  { name: 'phone landscape', w: 844, h: 390 },
  { name: 'tablet portrait', w: 820, h: 1180 },
  { name: 'tablet landscape', w: 1180, h: 820 },
  { name: 'small phone portrait', w: 360, h: 640 },
  { name: 'desktop', w: 1440, h: 900 },
]

describe('fitting the board to the screen', () => {
  for (const { name, w, h } of screens) {
    describe(name, () => {
      const fit = fitBoard(w, h, SPAN_X, SPAN_Y, BARS)
      const centre = boardCentreOnScreen(fit, w, h)
      const halfX = SPAN_X / 2 / fit.perPixel
      const halfY = SPAN_Y / 2 / fit.perPixel

      it('keeps the board clear of the score and the lives', () => {
        expect(centre.y - halfY).toBeGreaterThanOrEqual(fit.inset.top - 0.001)
        expect(centre.y + halfY).toBeLessThanOrEqual(h - fit.inset.bottom + 0.001)
      })

      it('shows the whole maze', () => {
        // Never cropped. A maze you cannot see all of is not this game.
        expect(halfX * 2).toBeLessThanOrEqual(w + 0.001)
        expect(halfY * 2).toBeLessThanOrEqual(h + 0.001)
      })

      it('centres the board in the space it has', () => {
        expect(centre.x).toBeCloseTo(w / 2, 6)
        expect(centre.y).toBeCloseTo(fit.inset.top + fit.free.h / 2, 6)
      })

      it('fills that space on at least one axis', () => {
        const filled = Math.max((halfX * 2) / fit.free.w, (halfY * 2) / fit.free.h)
        expect(filled).toBeCloseTo(1, 6)
      })

      it('is big enough to be worth looking at', () => {
        // The bug this guards against is a board reduced to a speck in the
        // corner, which is what the old landscape layout did once the score
        // bar spanned the full width.
        const short = Math.min(w, h)
        expect(Math.min(halfX * 2, halfY * 2) / short).toBeGreaterThan(0.6)
      })
    })
  }

  it('runs the maze right to the left and right edges when the screen is tall', () => {
    // A phone is much taller than the maze, so width is the binding axis and
    // the tunnel mouths land exactly on the edge of the glass.
    const w = 390
    const fit = fitBoard(w, 844, SPAN_X, SPAN_Y, BARS)
    const half = SPAN_X / 2 / fit.perPixel
    const centre = boardCentreOnScreen(fit, w, 844)
    expect(centre.x - half).toBeCloseTo(0, 6)
    expect(centre.x + half).toBeCloseTo(w, 6)
  })

  it('gives the board the whole screen when nothing is on top of it', () => {
    const none: Inset = { top: 0, bottom: 0, left: 0, right: 0 }
    const fit = fitBoard(800, 800, 10, 10, none)
    expect(fit.free).toEqual({ w: 800, h: 800 })
    expect(boardCentreOnScreen(fit, 800, 800)).toEqual({ x: 400, y: 400 })
  })

  it('survives a screen smaller than its own bars', () => {
    const fit = fitBoard(120, 60, SPAN_X, SPAN_Y, BARS)
    expect(fit.free.w).toBeGreaterThan(0)
    expect(fit.free.h).toBeGreaterThan(0)
    expect(Number.isFinite(fit.perPixel)).toBe(true)
    expect(fit.perPixel).toBeGreaterThan(0)
  })

  it('scales the board with the screen', () => {
    const small = fitBoard(400, 600, SPAN_X, SPAN_Y, BARS)
    const large = fitBoard(800, 1200, SPAN_X, SPAN_Y, BARS)
    // Twice the screen, at least twice the board. On a screen this tall it is
    // the width that binds, and the bars do not eat into the width at all, so
    // it comes out at exactly two rather than a little over.
    expect(small.perPixel / large.perPixel).toBeGreaterThanOrEqual(2)
  })
})
