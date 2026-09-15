import {
  CALIBRATION_ATTEMPTS,
  CALIBRATION_SUCCESS,
  WARMUP_ATTEMPTS,
  WARMUP_SUCCESS,
  MISSES_BEFORE_BRAKE,
  RECOVERY_SUCCESS,
  STRETCH_EVERY,
  STRETCH_SUCCESS,
  TARGET_SUCCESS,
  MIN_RATING,
  ratingForSuccessRate,
} from './elo'
import type { Generator, GeneratorId } from './types'
import type { Rng } from './rng'

export interface SelectorState {
  rating: number
  attempts: number
  /** Wrong answers since the last correct one. */
  consecutiveMisses: number
  /** Kinds served this session, most recent first. */
  recentKinds: GeneratorId[]
  /** Problems served since the last stretch problem. */
  sinceStretch: number
}

export interface ProblemSpec {
  kind: GeneratorId
  rating: number
  /** Deliberately above his level. The UI says so out loud; failing is the expected case. */
  stretch: boolean
  /** Frustration brake: served after a run of misses, aimed at near-certain success. */
  brake: boolean
  /** He has outrun every generator. Worth surfacing rather than quietly repeating. */
  atCeiling: boolean
}

/** `attempts` is the lifetime count, not this sitting's — calibration is once, ever. */
export function initialSelectorState(rating: number, attempts = 0): SelectorState {
  return { rating, attempts, consecutiveMisses: 0, recentKinds: [], sinceStretch: 0 }
}

/**
 * Picks what to serve next.
 *
 * Pure — the caller owns the bookkeeping. After serving, push the kind onto
 * `recentKinds`, reset `sinceStretch` on a stretch, and reset
 * `consecutiveMisses` on a brake or a correct answer.
 */
export function selectNext(
  state: SelectorState,
  generators: readonly Generator[],
  rng: Rng,
): ProblemSpec {
  if (generators.length === 0) throw new Error('no generators registered')

  const brake = state.consecutiveMisses >= MISSES_BEFORE_BRAKE
  const warmingUp = !brake && state.attempts < WARMUP_ATTEMPTS
  const calibrating = !brake && !warmingUp && state.attempts < CALIBRATION_ATTEMPTS
  // No point flagging a stretch while every problem is already at the limit of
  // what we know he can do.
  const stretch = !brake && !warmingUp && !calibrating && state.sinceStretch >= STRETCH_EVERY

  const target = brake
    ? RECOVERY_SUCCESS
    : warmingUp
      ? WARMUP_SUCCESS
      : calibrating
        ? CALIBRATION_SUCCESS
        : stretch
          ? STRETCH_SUCCESS
          : TARGET_SUCCESS
  const wanted = Math.max(MIN_RATING, Math.round(ratingForSuccessRate(state.rating, target)))

  const eligible = generators.filter((g) => wanted >= g.minRating && wanted <= g.maxRating)

  if (eligible.length > 0) {
    return { kind: pickKind(eligible, state.recentKinds, rng), rating: wanted, stretch, brake, atCeiling: false }
  }

  // Nothing covers the target. Either he is below the easiest generator (clamp
  // up) or past the hardest one — the honest ceiling, which the UI announces.
  const highestCeiling = Math.max(...generators.map((g) => g.maxRating))
  if (wanted > highestCeiling) {
    const topped = generators.filter((g) => g.maxRating === highestCeiling)
    return {
      kind: pickKind(topped, state.recentKinds, rng),
      rating: highestCeiling,
      stretch,
      brake,
      atCeiling: true,
    }
  }

  const lowestFloor = Math.min(...generators.map((g) => g.minRating))
  const floored = generators.filter((g) => g.minRating === lowestFloor)
  return {
    kind: pickKind(floored, state.recentKinds, rng),
    rating: lowestFloor,
    stretch,
    brake,
    atCeiling: false,
  }
}

/**
 * Least-recently-used, so a session moves through different kinds of thinking
 * rather than drilling one. Ties broken randomly.
 */
function pickKind(
  candidates: readonly Generator[],
  recentKinds: readonly GeneratorId[],
  rng: Rng,
): GeneratorId {
  let best: GeneratorId[] = []
  let bestAge = -1

  for (const g of candidates) {
    const idx = recentKinds.indexOf(g.id)
    const age = idx === -1 ? Number.POSITIVE_INFINITY : idx
    if (age > bestAge) {
      bestAge = age
      best = [g.id]
    } else if (age === bestAge) {
      best.push(g.id)
    }
  }

  return rng.pick(best)
}
