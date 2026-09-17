/**
 * Drawing between two simulation states.
 *
 * The simulation steps in fixed slices and the screen refreshes on its own
 * schedule, so a frame almost never lands on a slice boundary. Drawing the
 * newest state means everything moves by however many slices happened to fit
 * in that frame — one, two, sometimes three — which reads as a fine stutter,
 * and gets worse the faster the screen refreshes.
 *
 * Only what moves needs blending: where Dave is and which way, and where the
 * creatures are. Everything else about him is a fact rather than a position
 * and comes from the newest state.
 */
import type { Monster } from './game'
import type { Dave } from './physics'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** How far apart two positions have to be to be a teleport rather than a move. */
const JUMP_CUT = 3

export function blendDave(before: Dave, after: Dave, alpha: number): Dave {
  const t = Math.min(1, Math.max(0, alpha))
  // Respawning puts him back at the start of the level. Sliding him across the
  // whole room to get there would look like a bug, so a big move just snaps.
  if (Math.abs(after.x - before.x) > JUMP_CUT || Math.abs(after.y - before.y) > JUMP_CUT) {
    return after
  }
  return { ...after, x: lerp(before.x, after.x, t), y: lerp(before.y, after.y, t) }
}

export function blendMonster(before: Monster | undefined, after: Monster, alpha: number): Monster {
  if (!before) return after
  const t = Math.min(1, Math.max(0, alpha))
  if (Math.abs(after.x - before.x) > JUMP_CUT || Math.abs(after.y - before.y) > JUMP_CUT) {
    return after
  }
  return { ...after, x: lerp(before.x, after.x, t), y: lerp(before.y, after.y, t) }
}
