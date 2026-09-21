/**
 * Controls for the dungeon.
 *
 * More verbs than the other two games need: walk, run, jump, climb, crouch,
 * and a careful mode that turns a run into a single step and catches a ledge
 * on the way past. Then, the moment a guard is in front of you, the same four
 * buttons have to mean something else entirely.
 *
 * So the pad changes with the situation rather than growing until it covers
 * the screen. Out of a fight it is move, jump and care. In one it is advance,
 * retreat, strike and parry — the same thumbs, four new meanings, and a label
 * on each so nobody has to be told.
 */

export type Button = 'left' | 'right' | 'up' | 'down' | 'care' | 'strike' | 'parry'

export interface Key {
  id: Button
  cx: number
  cy: number
  r: number
  /** What to draw inside it. */
  glyph: 'left' | 'right' | 'up' | 'down' | 'care' | 'sword' | 'shield'
}

export type Pressed = Record<Button, boolean>

export const NOTHING: Pressed = {
  left: false,
  right: false,
  up: false,
  down: false,
  care: false,
  strike: false,
  parry: false,
}

export function keyRadius(width: number, height: number): number {
  return Math.max(24, Math.min(54, Math.min(width, height) * 0.082))
}

/** The strip along the bottom that the pad owns, and the board must not use. */
export function padHeight(width: number, height: number): number {
  return keyRadius(width, height) * 2.9
}

/**
 * Where the buttons are.
 *
 * Walking always stays on the left and the big action always on the right, so
 * that when a fight starts your thumbs are already in the right places and
 * only the meanings have moved.
 */
export function padLayout(width: number, height: number, fighting: boolean): Key[] {
  const r = keyRadius(width, height)
  const edge = r * 0.85
  const bottom = height - edge - r
  const gap = r * 2.25

  if (fighting) {
    return [
      { id: 'left', cx: edge + r, cy: bottom, r, glyph: 'left' },
      { id: 'right', cx: edge + r + gap, cy: bottom, r, glyph: 'right' },
      { id: 'parry', cx: width - edge - r - gap, cy: bottom, r, glyph: 'shield' },
      { id: 'strike', cx: width - edge - r, cy: bottom, r, glyph: 'sword' },
    ]
  }

  return [
    { id: 'left', cx: edge + r, cy: bottom, r, glyph: 'left' },
    { id: 'right', cx: edge + r + gap, cy: bottom, r, glyph: 'right' },
    { id: 'care', cx: edge + r + gap * 2, cy: bottom, r, glyph: 'care' },
    { id: 'down', cx: width - edge - r - gap, cy: bottom, r, glyph: 'down' },
    { id: 'up', cx: width - edge - r, cy: bottom, r, glyph: 'up' },
  ]
}

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

export function combine(buttons: (Button | null)[]): Pressed {
  const pressed = { ...NOTHING }
  for (const button of buttons) {
    if (button) pressed[button] = true
  }
  return pressed
}
