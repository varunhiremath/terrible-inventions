/**
 * One stick.
 *
 * "Just one joystick that lets you run around" — so that is the whole of it:
 * a thumb down anywhere in the lower part of the screen puts the stick there,
 * and dragging from it steers. A stick that appears where the thumb lands
 * beats one painted in a fixed spot, because a thumb cannot see.
 *
 * Pushing it right over also sprints, so there is nothing else to press. The
 * sprint runs out while it is held and comes back when it is not, which is
 * what makes it safe to give away free on the same control as the steering —
 * a thumb that shoves the stick over without meaning to loses a second and a
 * half of sprint and nothing else. It used to be paid for in length, and that
 * turned out to be a bill the player could not see himself being handed.
 */

export interface Stick {
  /** Where the thumb went down, in pixels. */
  fromX: number
  fromY: number
  /** Where it is now. */
  x: number
  y: number
  id: number
}

/** How far the thumb has to travel for the stick to be at full lock. */
export function stickReach(width: number, height: number): number {
  return Math.max(38, Math.min(88, Math.min(width, height) * 0.13))
}

/** Past this much of the lock, it is a dash. */
export const DASH_AT = 0.92

export interface Aim {
  x: number
  y: number
  dash: boolean
}

export const STILL: Aim = { x: 0, y: 0, dash: false }

/**
 * What the stick is asking for.
 *
 * Clamped to the reach, so holding the thumb a mile away is the same as
 * holding it at the edge — otherwise the dash would depend on how big a
 * gesture somebody happened to make.
 */
export function aimOf(stick: Stick | null, reach: number): Aim {
  if (!stick) return STILL
  const dx = stick.x - stick.fromX
  const dy = stick.y - stick.fromY
  const far = Math.hypot(dx, dy)
  if (far < reach * 0.14) return STILL
  const push = Math.min(1, far / reach)
  return { x: (dx / far) * push, y: (dy / far) * push, dash: push >= DASH_AT }
}

/** Where the stick is drawn, so the drawing and the reading agree. */
export function knobOf(stick: Stick, reach: number): { x: number; y: number } {
  const dx = stick.x - stick.fromX
  const dy = stick.y - stick.fromY
  const far = Math.hypot(dx, dy)
  if (far <= reach) return { x: stick.x, y: stick.y }
  return { x: stick.fromX + (dx / far) * reach, y: stick.fromY + (dy / far) * reach }
}

/**
 * And the keyboard, for anybody at a desk and for every probe in `scripts/`.
 *
 * Arrows and WASD give a direction rather than a turn, which is the same thing
 * the stick gives — so the game only ever has one kind of input to read.
 */
export function aimOfKeys(down: Set<string>): Aim {
  let x = 0
  let y = 0
  if (down.has('ArrowLeft') || down.has('a')) x -= 1
  if (down.has('ArrowRight') || down.has('d')) x += 1
  if (down.has('ArrowUp') || down.has('w')) y -= 1
  if (down.has('ArrowDown') || down.has('s')) y += 1
  if (x === 0 && y === 0) return STILL
  const far = Math.hypot(x, y)
  return { x: x / far, y: y / far, dash: down.has(' ') || down.has('Shift') }
}
