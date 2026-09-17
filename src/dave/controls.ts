/**
 * Dave's controls: round buttons in the bottom corners, drawn where you can
 * see them.
 *
 * The first go divided the whole screen into invisible bands — hold the left
 * half to walk left, the top to jump. It reads well on paper and plays badly:
 * your hands end up in the middle of the glass, over the very thing you are
 * trying to look at, and nothing on screen tells you any of it exists.
 *
 * Buttons in the corners instead, where thumbs already rest when a tablet is
 * held in two hands: walking on the left, jumping on the right, and the two
 * extras only when there is anything to use them for. Visible, because a
 * control you have to be told about is a control that does not work.
 */

export type Button = 'left' | 'right' | 'up' | 'down' | 'fire'

export interface Key {
  id: Button
  /** Centre and radius, in pixels. */
  cx: number
  cy: number
  r: number
}

export interface Pressed {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  fire: boolean
}

export const NOTHING_PRESSED: Pressed = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
}

export interface PadOptions {
  /** Show the fire button. */
  gun?: boolean
  /** Show the descend button. */
  jetpack?: boolean
}

/**
 * How big a button is: sized from the smaller side, so it stays thumb-sized on
 * a phone and does not become a dinner plate on a desktop.
 */
export function keyRadius(width: number, height: number): number {
  return Math.max(26, Math.min(58, Math.min(width, height) * 0.085))
}

/**
 * How much room the pad needs along the bottom.
 *
 * The room has to be *reserved*, not borrowed. The first go drew the buttons
 * over the board and Dave starts in the bottom left corner, directly under the
 * walk-left button — so the first thing the player saw was a level with no
 * Dave in it.
 */
export function padHeight(width: number, height: number): number {
  return keyRadius(width, height) * 2.9
}

/** Where the buttons sit, in the strip along the bottom. */
export function padLayout(width: number, height: number, options: PadOptions = {}): Key[] {
  const r = keyRadius(width, height)
  const edge = r * 0.85
  const bottom = height - edge - r
  const gap = r * 2.25

  const keys: Key[] = [
    { id: 'left', cx: edge + r, cy: bottom, r },
    { id: 'right', cx: edge + r + gap, cy: bottom, r },
    { id: 'up', cx: width - edge - r, cy: bottom, r },
  ]
  if (options.gun) keys.push({ id: 'fire', cx: width - edge - r - gap, cy: bottom, r })
  if (options.jetpack) keys.push({ id: 'down', cx: width - edge - r, cy: bottom - gap, r })
  return keys
}

/**
 * Which button a touch at (x, y) is on, if any.
 *
 * A touch counts a little way outside the circle it is drawn as. A thumb is
 * wider than the point the browser reports and nobody aims at the middle.
 */
export const TOUCH_SLACK = 1.25

export function keyAt(x: number, y: number, keys: Key[]): Button | null {
  let best: Button | null = null
  let nearest = Infinity
  for (const key of keys) {
    const distance = Math.hypot(x - key.cx, y - key.cy)
    if (distance <= key.r * TOUCH_SLACK && distance < nearest) {
      nearest = distance
      best = key.id
    }
  }
  return best
}

/** Every finger on the glass, folded into one set of intentions. */
export function combine(buttons: (Button | null)[]): Pressed {
  const pressed = { ...NOTHING_PRESSED }
  for (const button of buttons) {
    if (button) pressed[button] = true
  }
  return pressed
}
