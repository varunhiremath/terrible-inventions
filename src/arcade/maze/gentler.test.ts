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

  it('arrives at the written schedule exactly on the fifth board', () => {
    // The fifth is the one board played to the schedule as it is written:
    // the opening easing has run out and the late one has not started.
    const written = PHASE_SCHEDULE[0].seconds
    expect(phaseAt(written - 0.1, 5)).toBe('scatter')
    expect(phaseAt(written + 0.1, 5)).toBe('chase')
  })

  it('goes on closing the calm down after that, instead of stopping', () => {
    /*
     * The speeds reach their ceiling somewhere around the twentieth board, so
     * without this every board past the twentieth was the same board for
     * ever. Nobody noticed because nobody had got that far; a child two years
     * older does, and a game that has stopped asking for anything new is over
     * without having said so.
     */
    // The first minute, which is the part of the schedule that has the
    // written scatter blocks in it; everything after is chase either way.
    const share = (level: number) => {
      let scatter = 0
      const until = 60
      for (let t = 0; t < until; t += 0.25) {
        if (phaseAt(t, level) === 'scatter') scatter += 0.25
      }
      return scatter / until
    }
    expect(share(12), 'the twelfth board is no busier than the fifth')
      .toBeLessThan(share(5))
    expect(share(25), 'the twenty-fifth is no busier than the twelfth')
      .toBeLessThan(share(12))
    /*
     * And it never closes entirely. There is a ceiling here on purpose and it
     * is not the one the generators are forbidden: a chaser is always a shade
     * slower than the player, so being caught stays a cornering mistake
     * rather than being outrun, and a board with no calm in it at all would
     * be a coin toss. An eighth of the first minute is the floor.
     */
    expect(share(99), 'the calm has gone altogether').toBeGreaterThan(0.12)
  })

  it('does not touch the first four boards at all', () => {
    /*
     * The easing on the early boards was measured rather than felt — a bot
     * that plays like somebody in their first hour lost all three lives in a
     * minute before it existed — so the late stretching has to be worth
     * exactly nothing until that easing has finished.
     */
    for (const level of [1, 2, 3, 4]) {
      for (let t = 0; t < 120; t += 0.5) {
        expect(phaseAt(t, level), `board ${level} at ${t}s`).toBe(phaseAt(t, level))
      }
    }
    // Measured against the numbers the easing alone produces.
    const eased = (level: number) => Math.max(0, Math.min(1, (level - 1) / 4))
    for (const level of [1, 2, 3, 4, 5]) {
      const scatter = 2.3 - eased(level) * 1.3
      const written = PHASE_SCHEDULE[0].seconds
      expect(phaseAt(written * scatter - 0.1, level), `board ${level}`).toBe('scatter')
      expect(phaseAt(written * scatter + 0.1, level), `board ${level}`).toBe('chase')
    }
  })
})
