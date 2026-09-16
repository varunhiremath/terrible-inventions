/**
 * Working out which way a touch means.
 *
 * The first version put a d-pad on the screen, which is a games-console answer
 * to a question a phone already knows how to answer. Nobody taps a arrow on a
 * map to scroll it.
 *
 * So: touch anywhere, and the direction is read from where you touched
 * relative to where the player currently is. Tap ahead of him and he carries
 * on; tap to his left and he turns left. Because it is measured against the
 * player rather than against the middle of the screen, it keeps working as he
 * moves around the maze — the gesture means the same thing wherever he is.
 *
 * A drag is read as a swipe instead, so flicking up moves up regardless of
 * where the flick started. Both end up in the same place.
 */
import type { Dir } from './maze/ghosts'

export interface Point {
  x: number
  y: number
}

/**
 * How far from the player a tap has to land before it means anything, in
 * pixels. Tapping the player himself is ambiguous, and a stray tap while
 * resting a thumb on the glass should do nothing.
 */
export const TAP_DEADZONE = 28

/**
 * How far a finger must travel to count as a swipe rather than a tap. Below
 * this it is read as a tap, because a finger never lands perfectly still.
 */
export const SWIPE_THRESHOLD = 24

/**
 * The direction a tap at `touch` means, for a player drawn at `player`.
 *
 * Screen coordinates: y grows downward, which is also how the maze is laid
 * out, so down is down in both.
 */
export function directionFromTap(touch: Point, player: Point): Dir | null {
  const dx = touch.x - player.x
  const dy = touch.y - player.y
  if (Math.hypot(dx, dy) < TAP_DEADZONE) return null

  // Whichever axis the touch is furthest along. On the diagonal, across beats
  // along: a maze is read in rows, and sideways is the more common intention.
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
}

/** The direction a drag means, or null if the finger barely moved. */
export function directionFromSwipe(from: Point, to: Point): Dir | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return null
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
}

/**
 * The whole gesture: a drag is a swipe, a press-and-release in one place is a
 * tap aimed at the player.
 *
 * `player` can be null when the player is not on screen — during the opening
 * pause, say — and then a tap has nothing to be relative to and is ignored,
 * while a swipe still works.
 */
export function directionFromGesture(from: Point, to: Point, player: Point | null): Dir | null {
  const swipe = directionFromSwipe(from, to)
  if (swipe) return swipe
  return player ? directionFromTap(to, player) : null
}

/**
 * Where something in the maze is drawn on screen, in pixels from the top left
 * of the canvas.
 *
 * The camera is orthographic and only ever tilted about the x axis, so this is
 * the standard projection: into clip space, then across to pixels. Taking it
 * from the camera rather than recomputing the layout means it cannot drift out
 * of step with what is actually on screen.
 */
export function toScreen(
  world: { x: number; y: number; z: number },
  project: (v: { x: number; y: number; z: number }) => { x: number; y: number },
  size: { width: number; height: number },
): Point {
  const ndc = project(world)
  return {
    x: ((ndc.x + 1) / 2) * size.width,
    y: ((1 - ndc.y) / 2) * size.height,
  }
}
