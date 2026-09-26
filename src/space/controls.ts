/**
 * Controls.
 *
 * Three: left, right, fire. Steering under the left thumb and fire under the
 * right, and fire is the big one because it is held down for most of the run.
 *
 * Same latch as the road and the dungeon: a tap that lands entirely between
 * two simulation steps has to survive until a step reads it, or the button
 * appears broken. That bug has cost this project two evenings already.
 */

export type Button = 'left' | 'right' | 'fire'

export interface Key {
  id: Button
  cx: number
  cy: number
  r: number
  glyph: Button
}

export type Pressed = Record<Button, boolean>

export const NOTHING: Pressed = { left: false, right: false, fire: false }

export function keyRadius(width: number, height: number): number {
  return Math.max(26, Math.min(58, Math.min(width, height) * 0.09))
}

/** The strip along the bottom the pad owns, which the sky must not use. */
export function padHeight(width: number, height: number): number {
  return keyRadius(width, height) * 3.25
}

export function padLayout(width: number, height: number): Key[] {
  const r = keyRadius(width, height)
  const edge = r * 0.8
  const bottom = height - edge - r
  return [
    { id: 'left', cx: edge + r, cy: bottom, r, glyph: 'left' },
    { id: 'right', cx: edge + r + r * 2.3, cy: bottom, r, glyph: 'right' },
    { id: 'fire', cx: width - edge - r * 1.15, cy: bottom - r * 0.04, r: r * 1.15, glyph: 'fire' },
  ]
}

export const TOUCH_SLACK = 1.22

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
  for (const button of buttons) if (button) pressed[button] = true
  return pressed
}

export function createLatch() {
  const down = new Map<number, Button | null>()
  const fresh = new Set<Button>()
  return {
    press(pointer: number, key: Button | null): void {
      down.set(pointer, key)
      if (key) fresh.add(key)
    },
    release(pointer: number): void {
      down.delete(pointer)
    },
    has(pointer: number): boolean {
      return down.has(pointer)
    },
    read(): Pressed {
      return combine([...down.values(), ...fresh])
    },
    consumed(): void {
      fresh.clear()
    },
  }
}
