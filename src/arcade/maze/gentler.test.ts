import { describe, expect, it } from 'vitest'
import { PHASE_SCHEDULE, phaseAt } from './ghosts'
import { frightenedSeconds, ghostSpeed, playerSpeed } from './game'

/**
 * How much easier the first boards are, stated as numbers.
 *
 * The first level could not be cleared — reported from the sofa, which is the
 * report that counts. Three things were changed to fix it and this says by how
 * much, so that a later tweak to any one of them cannot quietly undo it.
 *
 * What this is not: a proof that the level is now winnable. That wants a bot
 * that plays the maze, and the one written for it was not good enough to
 * judge — with the chasers removed from the board entirely it still only ate a
 * quarter of the dots, so every number it produced was about the bot. It was
 * deleted rather than tuned until it agreed, because a test that reports on
 * itself is worse than no test. Whether this is *enough* easier is a question
 * for the person playing it.
 */
describe('the first board, against the fifth', () => {
  it('gives the player half again the speed of a chaser, not a fifth', () => {
    /*
     * The opening gap is the one that decides whether a beginner can escape a
     * corridor. Two things meeting head-on close at the sum of their speeds,
     * and the only way out is a junction already behind you — so the margin
     * has to be big enough to turn round and win the race back.
     */
    const margin = playerSpeed(1) / ghostSpeed(1)
    expect(margin, `player is only ${margin.toFixed(2)}x a chaser`).toBeGreaterThan(1.5)
  })

  it('still closes that gap as the levels go on', () => {
    const first = playerSpeed(1) / ghostSpeed(1)
    const sixth = playerSpeed(6) / ghostSpeed(6)
    expect(sixth, 'the sixth level is no tighter than the first').toBeLessThan(first)
    // And never all the way: being caught stays a mistake, not an outrunning.
    expect(ghostSpeed(20)).toBeLessThan(playerSpeed(20))
  })

  it('makes a pellet last half again as long at the start', () => {
    expect(frightenedSeconds(1)).toBeGreaterThanOrEqual(11)
    expect(frightenedSeconds(1) / frightenedSeconds(6)).toBeGreaterThan(1.5)
    // Eased rather than dropped off a cliff between two levels.
    for (let level = 1; level < 6; level++) {
      expect(frightenedSeconds(level + 1)).toBeLessThanOrEqual(frightenedSeconds(level))
      expect(frightenedSeconds(level) - frightenedSeconds(level + 1)).toBeLessThan(1.5)
    }
  })

  it('spends most of the first board not being chased at all', () => {
    /*
     * Scatter is the half of the cycle where the chasers go to their corners
     * and the board is yours. Sampled rather than reasoned about, because the
     * schedule is a list and the stretching is a multiplier on it.
     */
    const share = (level: number) => {
      let scatter = 0
      const until = 90
      for (let t = 0; t < until; t += 0.25) {
        if (phaseAt(t, level) === 'scatter') scatter += 0.25
      }
      return scatter / until
    }
    expect(share(1), `only ${(share(1) * 100).toFixed(0)}% of the first board is calm`)
      .toBeGreaterThan(0.4)
    expect(share(6), 'the sixth board is as calm as the first').toBeLessThan(share(1))
  })

  it('leaves the written schedule alone once the easing is spent', () => {
    // By the fifth level it is the schedule as written, unmultiplied.
    const written = PHASE_SCHEDULE[0].seconds
    expect(phaseAt(written - 0.1, 9)).toBe('scatter')
    expect(phaseAt(written + 0.1, 9)).toBe('chase')
  })
})
