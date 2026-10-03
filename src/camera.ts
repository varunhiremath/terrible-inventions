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

/**
 * @param behind how much of the view to keep clear behind him
 * @param ahead  and in front — bigger, in a game that only goes one way
 *
 * The two used to be one number, which is right for a world you wander about
 * in and wrong for one you run through. Reported of the pipes: "it's hard to
 * see what's ahead until you reach the edge of the screen". With equal margins
 * he can drift to four fifths of the way across and everything he is about to
 * run into is off the screen. Giving the front a bigger margin than the back
 * pins him to the left half, which is where somebody running to the right
 * should be.
 */
export function scrollTo(
  current: number,
  target: number,
  span: number,
  world: number,
  behind = MARGIN,
  ahead = behind,
): number {
  // A view as wide as the world, or wider, never scrolls at all.
  if (span >= world) return 0

  // The camera has to sit between these two for the player to be inside the
  // band. Any position in between is fine, which is what makes it a dead zone.
  const nearest = target - span * (1 - ahead)
  const furthest = target - span * behind

  const held = Math.min(Math.max(current, nearest), furthest)
  return Math.min(Math.max(held, 0), world - span)
}

/** Where the player appears on screen, 0 at the left edge and 1 at the right. */
export function screenFraction(camera: number, target: number, span: number): number {
  return (target - camera) / span
}
