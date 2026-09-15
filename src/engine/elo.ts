/**
 * Difficulty engine.
 *
 * One rating scale for both the player and every problem instance, so a
 * generator can be asked for "a problem worth 1340" and the selector can aim at
 * a chosen success rate by solving the same curve backwards.
 *
 * Deliberately unbounded above. The brief was to hunt for the player's ceiling,
 * not to hold him in a comfortable band, so nothing here clamps the top.
 */

export const START_RATING = 1000

/** Below this there is no meaningful content, so it is the one hard floor. */
export const MIN_RATING = 400

/** Aim for roughly four out of five. High enough to feel good, low enough to bite. */
export const TARGET_SUCCESS = 0.78

/** Every Nth problem is deliberately over his head. */
export const STRETCH_SUCCESS = 0.4
export const STRETCH_EVERY = 5

/** Where the frustration brake aims. Near-certain success, to rebuild footing. */
export const RECOVERY_SUCCESS = 0.92

/** Two in a row is the trigger. Three is already too late. */
export const MISSES_BEFORE_BRAKE = 2

/**
 * Opening problems spent finding his level rather than sitting at it.
 *
 * Everyone starts at the same rating, but this player is already working above
 * his grade, so settling in at the everyday target from problem one would spend
 * his first few sessions on things far too easy. During calibration the aim is
 * a coin flip instead: problems land at the current estimate, where a right
 * answer moves the estimate furthest, and the rating converges in one sitting.
 */
export const CALIBRATION_ATTEMPTS = 8
export const CALIBRATION_SUCCESS = 0.5

/**
 * Problems spent letting him win before the search for his level begins.
 *
 * Calibrating at a coin flip finds the ceiling fastest, but it means the very
 * first thing a child meets is the hardest thing the app will ever show him,
 * before he has even worked out where the buttons are. These few are pitched to
 * be got right.
 */
export const WARMUP_ATTEMPTS = 3
export const WARMUP_SUCCESS = 0.9

/** Probability the player solves a problem of this rating. Standard Elo curve. */
export function expectedScore(playerRating: number, problemRating: number): number {
  return 1 / (1 + 10 ** ((problemRating - playerRating) / 400))
}

/**
 * The curve solved for problem rating: what is worth serving if we want the
 * player to succeed `target` of the time. This is the whole selection strategy.
 */
export function ratingForSuccessRate(playerRating: number, target: number): number {
  const clamped = Math.min(0.999, Math.max(0.001, target))
  return playerRating + 400 * Math.log10(1 / clamped - 1)
}

/**
 * How hard a single result moves the rating. Large while we still know nothing
 * about him, small once the estimate has settled, so a stray wrong answer on a
 * good day does not undo a month of evidence.
 */
export function kFactor(attempts: number): number {
  if (attempts < CALIBRATION_ATTEMPTS) return 128
  if (attempts < 20) return 64
  if (attempts < 60) return 40
  return 24
}

export function updateRating(
  playerRating: number,
  problemRating: number,
  correct: boolean,
  attempts: number,
): number {
  const expected = expectedScore(playerRating, problemRating)
  const actual = correct ? 1 : 0
  const next = playerRating + kFactor(attempts) * (actual - expected)
  return Math.max(MIN_RATING, Math.round(next))
}
