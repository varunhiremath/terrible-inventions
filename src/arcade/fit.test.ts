import { describe, expect, it } from 'vitest'
import { boardCentreOnScreen, fitBoard, type Panels } from './fit'

const GAP = 12
const SPAN_X = 20
const SPAN_Y = 19

/**
 * What the real panels measure, read off the running app rather than guessed
 * at. Guessing put the pad at a third bigger than it is and made this file
 * accuse the camera of a fault that was in the fixture.
 */
const panels: Panels = {
  hud: { width: 87, height: 56 },
  pad: { width: 198, height: 198 },
  extras: { width: 132, height: 28 },
  topRight: { width: 124, height: 60 },
}

const none: Panels = { hud: null, pad: null, extras: null, topRight: null }

/** The devices this is actually played on. */
const screens = [
  { name: 'phone landscape', w: 844, h: 390 },
  { name: 'phone portrait', w: 390, h: 844 },
  { name: 'tablet landscape', w: 1180, h: 820 },
  { name: 'tablet portrait', w: 820, h: 1180 },
  { name: 'small phone landscape', w: 667, h: 375 },
  { name: 'desktop', w: 1440, h: 900 },
]

describe('fitting the board to the screen', () => {
  for (const { name, w, h } of screens) {
    describe(name, () => {
      const fit = fitBoard(w, h, SPAN_X, SPAN_Y, panels, GAP)
      const centre = boardCentreOnScreen(fit, w, h)
      const halfBoardX = SPAN_X / 2 / fit.perPixel
      const halfBoardY = SPAN_Y / 2 / fit.perPixel

      it('keeps the board clear of the panels', () => {
        expect(centre.x - halfBoardX).toBeGreaterThanOrEqual(fit.inset.left - 0.001)
        expect(centre.x + halfBoardX).toBeLessThanOrEqual(w - fit.inset.right + 0.001)
        expect(centre.y - halfBoardY).toBeGreaterThanOrEqual(fit.inset.top - 0.001)
        expect(centre.y + halfBoardY).toBeLessThanOrEqual(h - fit.inset.bottom + 0.001)
      })

      it('centres the board in the space it has', () => {
        expect(centre.x).toBeCloseTo(fit.inset.left + fit.free.w / 2, 6)
        expect(centre.y).toBeCloseTo(fit.inset.top + fit.free.h / 2, 6)
      })

      it('fills that space on at least one axis', () => {
        const filled = Math.max((halfBoardX * 2) / fit.free.w, (halfBoardY * 2) / fit.free.h)
        expect(filled).toBeCloseTo(1, 6)
      })

      it('uses most of the short side of the screen', () => {
        // The bug this guards against is a board floating in the middle of a
        // mostly empty screen. The panels take a share, but not most of it.
        const short = Math.min(w, h)
        expect(Math.min(halfBoardX * 2, halfBoardY * 2) / short).toBeGreaterThan(0.7)
      })
    })
  }

  it('gives the board the whole screen when nothing is on top of it', () => {
    const fit = fitBoard(800, 800, SPAN_X, SPAN_X, none, 0)
    expect(fit.free).toEqual({ w: 800, h: 800 })
    expect(boardCentreOnScreen(fit, 800, 800)).toEqual({ x: 400, y: 400 })
  })

  it('puts the panels beside the board in landscape and above it in portrait', () => {
    const wide = fitBoard(900, 500, SPAN_X, SPAN_Y, panels, GAP)
    expect(wide.inset.left).toBeGreaterThan(wide.inset.top)

    const tall = fitBoard(500, 900, SPAN_X, SPAN_Y, panels, GAP)
    expect(tall.inset.top).toBeGreaterThan(tall.inset.left)
  })

  it('survives a screen too small for its own panels', () => {
    const fit = fitBoard(120, 90, SPAN_X, SPAN_Y, panels, GAP)
    expect(fit.free.w).toBeGreaterThan(0)
    expect(fit.free.h).toBeGreaterThan(0)
    expect(Number.isFinite(fit.perPixel)).toBe(true)
    expect(fit.perPixel).toBeGreaterThan(0)
  })

  it('scales the board with the screen', () => {
    const small = fitBoard(600, 400, SPAN_X, SPAN_Y, panels, GAP)
    const large = fitBoard(1200, 800, SPAN_X, SPAN_Y, panels, GAP)
    // Twice the screen, and the panels no bigger, so more than twice the board.
    expect(small.perPixel / large.perPixel).toBeGreaterThan(2)
  })
})
