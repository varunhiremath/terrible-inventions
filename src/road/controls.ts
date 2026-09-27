/**
 * Controls.
 *
 * Four: steer left, steer right, the pedal, the brake. Steering on the left
 * thumb and the pedals on the right, because the pair that get held together
 * is a direction and the pedal — you steer while accelerating for essentially
 * the whole game — and a thumb must never have to leave one to reach the
 * other.
 *
 * The pedal is the biggest button on the pad. It is held down almost
 * continuously, and the brake is the one you stab, so the sizes are the other
 * way round from what a car suggests.
 */

export type Button = 'left' | 'right' | 'go' | 'brake'

export interface Key {
  id: Button
  cx: number
  cy: number
  r: number
  glyph: Button
}

export type Pressed = Record<Button, boolean>

export const NOTHING: Pressed = { left: false, right: false, go: false, brake: false }

export function keyRadius(width: number, height: number): number {
  return Math.max(26, Math.min(58, Math.min(width, height) * 0.09))
}

/** The strip along the bottom the pad owns, which the road must not use. */
export function padHeight(width: number, height: number): number {
  return keyRadius(width, height) * 3.25
}

/**
 * The pad, laid out in a strip of the screen.
 *
 * `from` and `span` are the part of the width this pad owns, which is the
 * whole of it for one player and half of it each for two. Two people sharing
 * a tablet sit one at each end, so each gets steering on the outside and the
 * pedals on the inside — the same shape twice, mirrored, rather than one pad
 * stretched across both of them.
 */
export function padLayout(
  width: number,
  height: number,
  from = 0,
  span = width,
): Key[] {
  const r = keyRadius(span, height)
  const edge = r * 0.8
  const bottom = height - edge - r
  const right = from + span
  return [
    { id: 'left', cx: from + edge + r, cy: bottom, r, glyph: 'left' },
    { id: 'right', cx: from + edge + r + r * 2.3, cy: bottom, r, glyph: 'right' },
    { id: 'brake', cx: right - edge - r - r * 2.6, cy: bottom, r: r * 0.86, glyph: 'brake' },
    { id: 'go', cx: right - edge - r * 1.15, cy: bottom - r * 0.04, r: r * 1.15, glyph: 'go' },
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

/**
 * Holds a press until a simulation step has read it.
 *
 * A tap can land entirely between two samples. In the dungeon that made the
 * jump button do nothing at all, twice, and neither time was it the jump that
 * was broken. Not making that mistake again here.
 */
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
    /** Called once a step has read it, and not before. */
    consumed(): void {
      fresh.clear()
    },
  }
}
