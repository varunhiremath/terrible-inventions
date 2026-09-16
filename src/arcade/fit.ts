/**
 * Fitting the board to the screen.
 *
 * Scaling the maze to the viewport is not enough on its own. The score sits
 * above the board and the lives below it, so a maze fitted to the whole screen
 * has its top and bottom rows underneath them.
 *
 * So: subtract the bars, fit the maze to what is left, and slide the camera so
 * the maze lands in the middle of the free space rather than the middle of the
 * screen. The bars are measured rather than guessed at, because how tall they
 * are depends on the text in them.
 *
 * There used to be a second layout here for landscape, which moved the panels
 * into side gutters because that is where a thumb pad wanted to be. The thumb
 * pad is gone — the board itself takes the touches now — and the score and
 * lives sit in a bar above and below in every orientation. Keeping the branch
 * would have been keeping a special case with nothing left to be special
 * about, and while it was still here it reserved the full width of the screen
 * on both sides and pushed the maze out of sight.
 *
 * The maths lives here, away from the DOM, so it can be tested.
 */

/** Margins in pixels that the board must keep clear of. */
export interface Inset {
  top: number
  bottom: number
  left: number
  right: number
}

/** An orthographic camera's frustum, in world units either side of centre. */
export interface Frustum {
  left: number
  right: number
  top: number
  bottom: number
}

export interface Fit {
  inset: Inset
  /** The rectangle the board gets, in pixels. */
  free: { w: number; h: number }
  /** World units per pixel. */
  perPixel: number
  frustum: Frustum
}

/** The smallest a board may be squeezed to before we stop giving ground. */
const MIN_FREE = 40

/**
 * @param spanX how wide the board is in world units
 * @param spanY how tall it is
 */
export function fitBoard(
  w: number,
  h: number,
  spanX: number,
  spanY: number,
  inset: Inset,
): Fit {
  const free = {
    w: Math.max(MIN_FREE, w - inset.left - inset.right),
    h: Math.max(MIN_FREE, h - inset.top - inset.bottom),
  }

  // Whichever axis runs out first decides the scale, so the whole board stays
  // on screen. Filling both would mean cropping it, and a maze you cannot see
  // all of is not this game.
  const perPixel = Math.max(spanX / free.w, spanY / free.h)

  const halfW = (w * perPixel) / 2
  const halfH = (h * perPixel) / 2

  // How far the middle of the free space is from the middle of the screen.
  const shiftX = (inset.left + free.w / 2 - w / 2) * perPixel
  const shiftY = (inset.top + free.h / 2 - h / 2) * perPixel

  return {
    inset,
    free,
    perPixel,
    frustum: {
      left: -halfW - shiftX,
      right: halfW - shiftX,
      top: halfH + shiftY,
      bottom: -halfH + shiftY,
    },
  }
}

/**
 * Where the middle of the board ends up on screen, in pixels from the top
 * left. Only the tests need this, but working it out from the frustum is the
 * whole point: it checks the camera, not a copy of the arithmetic.
 */
export function boardCentreOnScreen(fit: Fit, w: number, h: number) {
  const { left, right, top, bottom } = fit.frustum
  return {
    x: ((0 - left) / (right - left)) * w,
    y: ((top - 0) / (top - bottom)) * h,
  }
}
