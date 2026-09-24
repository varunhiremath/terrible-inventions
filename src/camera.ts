/**
 * Where the camera sits, for any game that scrolls.
 *
 * One rule, asked for in these words: "when he is 20% away from the edge, we
 * move... so you are never really at the edge ever."
 *
 * The implementation is a dead zone rather than a jump to the next screenful.
 * The player is kept inside a band with a margin clear at each side; while he
 * is inside that band the camera does not move at all, and the moment he
 * pushes against the edge of it the camera moves exactly as far as he does.
 * He is therefore never nearer the edge than the margin, which is the part
 * that was asked for, and the view never jumps, which is the part that was
 * complained about in the same breath.
 *
 * The exception is the ends of the world, where the camera stops rather than
 * scrolling past them into nothing. There he really can walk up to the edge of
 * the screen, because there is nothing beyond it to see.
 */

/** How much of the view is kept clear at each side. */
export const MARGIN = 0.2

export function scrollTo(
  current: number,
  target: number,
  span: number,
  world: number,
  margin = MARGIN,
): number {
  // A view as wide as the world, or wider, never scrolls at all.
  if (span >= world) return 0

  const edge = span * margin
  // The camera has to sit between these two for the player to be inside the
  // band. Any position in between is fine, which is what makes it a dead zone.
  const nearest = target - span + edge
  const furthest = target - edge

  const held = Math.min(Math.max(current, nearest), furthest)
  return Math.min(Math.max(held, 0), world - span)
}

/** Where the player appears on screen, 0 at the left edge and 1 at the right. */
export function screenFraction(camera: number, target: number, span: number): number {
  return (target - camera) / span
}
