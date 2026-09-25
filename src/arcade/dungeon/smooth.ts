/**
 * Drawing between two simulation steps.
 *
 * The dungeon simulates at fifteen frames a second, because that is what the
 * animation tables are authored at: every action is a fixed list of poses with
 * a distance travelled per frame, and the whole of the movement engine depends
 * on those steps landing exactly. That part is not negotiable.
 *
 * But it was also *drawing* at fifteen. On a screen refreshing at sixty that
 * means the same picture four times, then a jump — reported as the game
 * looking "so choppy", and it did. The pacer has kept the pair of states to
 * draw between all along; nothing was reading them.
 *
 * So the simulation stays exactly where it is and the drawing slides between
 * the last two states. What gets blended is position only. The poses stay on
 * their own fifteen, because they are drawn frames rather than samples of a
 * continuous motion — sliding between two of them would not make the figure
 * smoother, it would make it rubbery.
 */
import { liftOf } from './draw'
import type { Prince } from './prince'
import type { Guard, Run } from './run'

/**
 * How far something can move in one step before it counts as a cut.
 *
 * A step is a fifteenth of a second and nothing in this game legitimately
 * travels more than about a tile in one. Anything bigger is a level change, a
 * death, a respawn — a new scene rather than a continuation of this one — and
 * blending across it would send the figure gliding across the room to his new
 * position like a ghost.
 */
export const CUT = 1.5

/** Part way between two numbers, unless the gap says this is a cut. */
export function blend(from: number, to: number, alpha: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return to
  if (Math.abs(to - from) > CUT) return to
  return from + (to - from) * alpha
}

/**
 * Where he is drawn, as a row the drawing code can use directly.
 *
 * The lift of a jump comes out of the frame table, so it steps at fifteen like
 * everything else — and it is the most visible movement in the game. Blending
 * the row alone would give a smooth run and a jump that still climbs in four
 * lurches.
 *
 * The trick is that `drawPrince` subtracts `liftOf(action, frame)` itself. So
 * the height is blended here, and the lift the drawing is about to subtract is
 * added back on, which leaves the figure exactly where the blend wanted it
 * without the drawing code needing to know any of this happened.
 */
export function tweenPrince(previous: Prince | null, next: Prince, alpha: number): Prince {
  if (!previous) return next
  // Death, and coming back, are cuts however small the distance.
  if (previous.dead !== next.dead) return next

  const was = previous.row - liftOf(previous.action, previous.frame)
  const now = next.row - liftOf(next.action, next.frame)

  return {
    ...next,
    col: blend(previous.col, next.col, alpha),
    row: blend(was, now, alpha) + liftOf(next.action, next.frame),
  }
}

/** The same for a guard, who has no arc to account for. */
export function tweenGuard(previous: Guard | undefined, next: Guard, alpha: number): Guard {
  if (!previous) return next
  return {
    ...next,
    col: blend(previous.col, next.col, alpha),
    row: blend(previous.row, next.row, alpha),
  }
}

/**
 * Everyone in the room, part way between the last two steps.
 *
 * A change of level is a cut for everybody: the guards are a different set of
 * people and matching them up by position in the array would blend one man
 * into another.
 */
export function tweenRun(previous: Run | null, next: Run, alpha: number): {
  prince: Prince
  guards: Guard[]
} {
  const same = previous !== null && previous.level === next.level
  if (!same) return { prince: next.prince, guards: next.guards }

  return {
    prince: tweenPrince(previous.prince, next.prince, alpha),
    guards: next.guards.map((guard, i) => tweenGuard(previous.guards[i], guard, alpha)),
  }
}
