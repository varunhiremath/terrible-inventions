/**
 * Running a fixed-step simulation against a screen that refreshes when it
 * likes.
 *
 * The simulation must step in equal slices or it is not reproducible, and the
 * screen must be drawn whenever it asks or the picture tears. The join between
 * the two is this: keep the real time that has not been simulated yet, and draw
 * part way between the last two states by however much of a slice that is.
 *
 * The part everybody gets wrong — this project twice — is *which* two states.
 * The earlier of them has to survive between frames. When a frame is shorter
 * than one slice no step happens, and if the pair is rebuilt each frame it
 * becomes "the current state, twice", which draws the newest state outright
 * instead of the point a slice behind it. That frame jumps forward and the
 * next one crawls.
 *
 * It hides well, which is why it survived. At sixty frames a second against a
 * hundred-and-twenty step simulation two steps always fit, so it never shows.
 * At a hundred and twenty, and at a hundred and forty-four, the leftover time
 * happens to land back on zero exactly when a frame is skipped, so it does not
 * show there either. At a hundred and sixty-five it swings the drawn step by a
 * quarter either way, and on real hardware, where no two frames are the same
 * length, it does that constantly.
 *
 * With the pair kept across frames, the drawn moment is always exactly one
 * slice behind real time — a constant lag, which nobody can see, rather than a
 * varying one, which everybody can.
 */
export interface Frame<S> {
  /** The earlier of the two states to draw between. */
  previous: S
  /** The later one, and the simulation's true current state. */
  next: S
  /** How far between them to draw, 0 to 1. */
  alpha: number
}

export interface Pacer<S> {
  /**
   * @param current  the simulation's state now, including anything input has
   *                 changed since the last frame
   * @param elapsed  real seconds since the last frame
   * @param step     advances the state by exactly one slice
   */
  advance(current: S, elapsed: number, step: (state: S) => S): Frame<S>
  /** Forget the past, for a fresh level or a resumed game. */
  reset(): void
}

/**
 * @param fixed       seconds per simulation slice
 * @param maxCatchUp  the most real time to spend catching up in one frame, so a
 *                    long pause does not teleport everything
 */
export function createPacer<S>(fixed: number, maxCatchUp: number): Pacer<S> {
  let carry = 0
  let previous: S | null = null

  return {
    advance(current, elapsed, step) {
      carry = Math.min(maxCatchUp, carry + Math.max(0, elapsed))
      if (previous === null) previous = current

      let next = current
      while (carry >= fixed) {
        previous = next
        next = step(next)
        carry -= fixed
      }

      return { previous: previous as S, next, alpha: carry / fixed }
    },
    reset() {
      carry = 0
      previous = null
    },
  }
}
