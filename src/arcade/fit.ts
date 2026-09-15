/**
 * Fitting the board to the screen.
 *
 * Scaling the maze to the viewport is not enough. The score sits over the top
 * of the board and the thumb pad over the bottom or the side, so a maze fitted
 * to the whole screen still had its corners buried under the controls — worst
 * on a phone held sideways, which is how the game is actually played.
 *
 * So: subtract the panels, fit the maze to what is left, and slide the camera
 * so the maze lands in the middle of the free space rather than the middle of
 * the screen. The panels are measured rather than guessed at, because how big
 * they are depends on the text in them.
 *
 * The maths lives here, away from the DOM, so it can be tested.
 */

/** A measured panel. Null when it is not on screen. */
export type Panel = { width: number; height: number } | null

export type Panels = {
  /** Lives and the clock. */
  hud: Panel
  /** The thumb pad. */
  pad: Panel
  /** Whatever sits opposite the pad, such as the swipe hint. */
  extras: Panel
  /** Shop and settings. */
  topRight: Panel
}

/** Margins in pixels that the board must keep clear of. */
export type Inset = { top: number; bottom: number; left: number; right: number }

/** An orthographic camera's frustum, in world units either side of centre. */
export type Frustum = { left: number; right: number; top: number; bottom: number }

export type Fit = {
  inset: Inset
  /** The rectangle the board gets, in pixels. */
  free: { w: number; h: number }
  /** World units per pixel. */
  perPixel: number
  frustum: Frustum
}

const width = (p: Panel) => p?.width ?? 0
const height = (p: Panel) => p?.height ?? 0

/** The smallest a board may be squeezed to before we stop giving ground. */
const MIN_FREE = 40

export function insetFor(w: number, h: number, panels: Panels, gap: number): Inset {
  // Turned sideways, the score and the shop button move into the same gutters
  // as the controls rather than sitting over the board, so the board keeps its
  // full height — which is the scarce axis on a phone in landscape. Held
  // upright the score spans the top and the board starts below it.
  return w > h
    ? {
        top: gap,
        bottom: gap,
        left: Math.max(width(panels.pad), width(panels.hud)) + gap,
        right: Math.max(width(panels.extras), width(panels.topRight)) + gap,
      }
    : {
        top: height(panels.hud) + gap,
        bottom: Math.max(height(panels.pad), height(panels.extras)) + gap,
        left: gap,
        right: gap,
      }
}

/**
 * @param spanX  how wide the board is in world units
 * @param spanY  how tall it looks after the camera tilt foreshortens it
 */
export function fitBoard(
  w: number,
  h: number,
  spanX: number,
  spanY: number,
  panels: Panels,
  gap: number,
): Fit {
  const inset = insetFor(w, h, panels, gap)

  const free = {
    w: Math.max(MIN_FREE, w - inset.left - inset.right),
    h: Math.max(MIN_FREE, h - inset.top - inset.bottom),
  }

  // Whichever axis runs out first decides the scale.
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
