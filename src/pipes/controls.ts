/**
 * Controls.
 *
 * Five buttons: go left, go right, go down, run, jump. Run and jump are on the
 * right thumb and movement on the left, because the two that get held together
 * are run and a direction, and the two that get pressed together are a
 * direction and jump — so every pair a player needs has to be reachable at
 * once.
 *
 * Jump is deliberately the biggest button on the pad. It is pressed more than
 * everything else put together, and how long it is held is the whole of the
 * jumping, so a thumb must never have to search for it.
 *
 * Down is the newest and the smallest, because it does one thing: go into a
 * pipe you are stood on. It was asked for in those words — "can we go inside
 * pipes? I don't see a go down button anywhere" — and it sits above and
 * between left and right, where the same thumb can reach it without leaving
 * the other two.
 */

export type Button = 'left' | 'right' | 'down' | 'run' | 'jump'

export interface Key {
  id: Button
  cx: number
  cy: number
  r: number
  glyph: 'left' | 'right' | 'down' | 'run' | 'jump'
}

export type Pressed = Record<Button, boolean>

export const NOTHING: Pressed = {
  left: false, right: false, down: false, run: false, jump: false,
}

export function keyRadius(width: number, height: number): number {
  return Math.max(26, Math.min(58, Math.min(width, height) * 0.09))
}

/** The strip along the bottom the pad owns, which the level must not use. */
export function padHeight(width: number, height: number): number {
  /*
   * Tall enough for the down button, which sits above the other two on the
   * left and is now the highest thing on the pad. Its middle is 1.55 radii
   * above theirs and it is 0.66 of one across, and theirs sit 1.8 off the foot
   * of the screen: 4.01 radii in all, so 4.1 leaves a little air.
   *
   * It was 3.25 with four buttons, and every tenth of a radius here comes off
   * the height of the level, so this is not a number to round up generously.
   */
  return keyRadius(width, height) * 4.1
}

export function padLayout(width: number, height: number): Key[] {
  const r = keyRadius(width, height)
  const edge = r * 0.8
  const bottom = height - edge - r
  return [
    { id: 'left', cx: edge + r, cy: bottom, r, glyph: 'left' },
    { id: 'right', cx: edge + r + r * 2.3, cy: bottom, r, glyph: 'right' },
    // Above and between the other two: the same thumb, without letting go.
    { id: 'down', cx: edge + r + r * 1.15, cy: bottom - r * 1.55, r: r * 0.66, glyph: 'down' },
    { id: 'run', cx: width - edge - r - r * 2.6, cy: bottom, r: r * 0.86, glyph: 'run' },
    { id: 'jump', cx: width - edge - r * 1.15, cy: bottom - r * 0.04, r: r * 1.15, glyph: 'jump' },
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
 * The screen redraws sixty times a second and the simulation steps faster than
 * that, but a tap can still land entirely between two samples. In the dungeon
 * that made the jump button do nothing at all, twice, and neither time was it
 * the jump that was broken. Not making that mistake again here.
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
