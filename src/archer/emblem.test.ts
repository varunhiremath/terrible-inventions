import { describe, expect, it } from 'vitest'
import { ARROW_R, BALLOON_R, EYE, GRAVITY } from './level'
import { flyAt } from './emblem'

/**
 * The cutscene's arrow, checked for the one thing it promises.
 *
 * The meadow's story is painted rather than played — that game is three.js and
 * a cutscene has to draw in a terminal with no graphics card — so the usual
 * guarantee, that a beat is the game itself, does not hold here. What is
 * offered instead is that the *flight* is real: aimed by the game's `aimFor`,
 * launched at the game's arrow speed, and dropped by the game's gravity.
 *
 * Which is worth nothing unless something checks it. A painted curve that no
 * longer lands would teach a nine-year-old the wrong lob and nothing would
 * say so.
 */
describe('the arrow in the cutscene', () => {
  const target = { x: 6, y: 9.5, z: -19 }

  it('lands on what it was aimed at', () => {
    const shot = flyAt(target)
    expect(shot.miss, `came within ${shot.miss.toFixed(2)}m`)
      .toBeLessThanOrEqual(BALLOON_R + ARROW_R)
  })

  it('is aimed above the balloon and falls onto it', () => {
    /*
     * The whole lesson of the picture, and the honest version of it. At these
     * speeds the arrow does not loop over the target like a catapult — it is
     * sent *above the line to it* and drops the last metre. So what is checked
     * is that the arrow is higher in the middle of its flight than a straight
     * line from the bow to the balloon would be. A shot aimed straight at it
     * would sit on that line the whole way and arrive below it.
     */
    const shot = flyAt(target)
    const end = shot.path[shot.path.length - 1]
    const half = shot.path[Math.floor(shot.path.length / 2)]
    const straight = EYE + (end.y - EYE) * 0.5
    expect(half.y).toBeGreaterThan(straight)
  })

  it('takes a believable moment to get there', () => {
    const shot = flyAt(target)
    expect(shot.seconds).toBeGreaterThan(0.2)
    expect(shot.seconds).toBeLessThan(2)
  })

  it('is gravity doing it, not a drawn curve', () => {
    /*
     * Every step of the path has to be falling at `g`: the second difference
     * of the height is one step of gravity, and nothing else. If the flight
     * were ever replaced by something hand-shaped to look right, this is what
     * would catch it.
     */
    const shot = flyAt(target)
    const slice = 1 / 120
    for (let i = 2; i < Math.min(shot.path.length, 60); i++) {
      const drop = shot.path[i].y - 2 * shot.path[i - 1].y + shot.path[i - 2].y
      expect(drop).toBeCloseTo(-GRAVITY * slice * slice, 4)
    }
  })

  it('starts at eye height, where the archer is', () => {
    const shot = flyAt(target)
    expect(shot.path[0].y).toBe(EYE)
    expect(Math.hypot(shot.path[0].x, shot.path[0].z)).toBeLessThan(0.01)
  })

  it('falls short at a weak draw, which is the other half of the lesson', () => {
    // Further than a light pull can throw an arrow at all, so it ends in the
    // grass: the pull is worth something, which is why there is one.
    const weak = flyAt({ x: 0, y: 2, z: -150 }, 0.2)
    const last = weak.path[weak.path.length - 1]
    expect(last.y, 'a far shot on a light pull should reach the grass').toBeLessThan(1)
    expect(weak.miss).toBeGreaterThan(BALLOON_R + ARROW_R)
  })
})
