/**
 * Reading a platformer off a sheet of glass.
 *
 * Pac-Man's "tap where you want to go" does not transfer: Dave has to walk and
 * jump at the same time, and one finger cannot mean two things at once.
 *
 * So the screen is divided into zones and nothing is drawn on top of them.
 * Hold anywhere on the left of the board to walk left, the right to walk
 * right, and touch the upper band to jump — or, once he has a jetpack, to
 * fly, because holding up is what a jetpack is for. Two thumbs do what two
 * thumbs do on a console, without a console painted on the screen.
 *
 * The zones are worked out here, away from the DOM, so they can be tested and
 * so the boundaries can be moved by changing one number.
 */

/** How much of the height, from the top, means up. */
export const UP_BAND = 0.42
/** How much of the height, from the bottom, means down. */
export const DOWN_BAND = 0.16
/**
 * A strip up the middle that means neither left nor right, so standing still
 * is something you can actually ask for.
 */
export const DEAD_STRIP = 0.12

export interface Zones {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

/**
 * What a touch at (x, y) is asking for, on a board `width` by `height`.
 *
 * A touch can mean two things at once — up and right is a jump to the right —
 * which is the whole reason for bands rather than buttons.
 */
export function zoneFor(x: number, y: number, width: number, height: number): Zones {
  const across = width > 0 ? x / width : 0.5
  const down = height > 0 ? y / height : 0.5

  const middle = Math.abs(across - 0.5) < DEAD_STRIP / 2
  return {
    left: !middle && across < 0.5,
    right: !middle && across > 0.5,
    up: down < UP_BAND,
    down: down > 1 - DOWN_BAND,
  }
}

/** Every finger on the glass at once, folded into one set of intentions. */
export function combine(touches: Zones[]): Zones {
  return {
    left: touches.some((t) => t.left),
    right: touches.some((t) => t.right),
    up: touches.some((t) => t.up),
    down: touches.some((t) => t.down),
  }
}
