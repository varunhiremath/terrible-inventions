import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import { isSolid, tileAt, warpUnder, type Level } from './level'
import { FIXED, WARP_SECONDS, newRun, stepRun } from './run'
import { NO_INPUT } from './physics'

/**
 * Going down a pipe.
 *
 * Asked for in one line — "can we go inside pipes? I don't see a go down
 * button anywhere" — and it is the move this whole genre is named after.
 *
 * The warps are worked out from the pipes each level already has rather than
 * written into the level, so the thing that has to be checked is that every
 * pair that survives is one somebody can actually use: further on than where
 * they started, and with somewhere to stand at the far end.
 */
describe('the pipes you can go down', () => {
  it('exist at all, in most levels', () => {
    const with_ = LEVELS.filter((level) => level.warps.length > 0)
    expect(with_.length).toBeGreaterThan(LEVELS.length / 2)
  })

  it('always come out further along than they went in', () => {
    for (const level of LEVELS) {
      for (const warp of level.warps) {
        expect(warp.to, level.name).toBeGreaterThan(warp.from)
      }
    }
  })

  it('come out somewhere he can stand', () => {
    for (const level of LEVELS) {
      for (const warp of level.warps) {
        // The lip itself holds him up.
        expect(isSolid(tileAt(level, warp.to, warp.toRow)), level.name).toBe(true)
        // And there is head room above it, or he surfaces inside a brick.
        for (let row = warp.toRow - 2; row < warp.toRow; row++) {
          for (const col of [warp.to, warp.to + 1]) {
            expect(isSolid(tileAt(level, col, row)), `${level.name} at ${col},${row}`).toBe(false)
          }
        }
      }
    }
  })

  it('only answers to down where there is actually a pipe', () => {
    const level = LEVELS.find((l) => l.warps.length > 0) as Level
    const warp = level.warps[0]
    expect(warpUnder(level, warp.from, warp.fromRow)).toEqual(warp)
    expect(warpUnder(level, warp.from + 1, warp.fromRow)).toEqual(warp)
    expect(warpUnder(level, warp.from, warp.fromRow + 1)).toBeNull()
    expect(warpUnder(level, warp.from - 4, warp.fromRow)).toBeNull()
  })

  it('takes him down one and up the other, and hands him back the controls', () => {
    const level = LEVELS.find((l) => l.warps.length > 0) as Level
    const warp = level.warps[0]
    let run = newRun(level, 1)
    // Put him on the lip, as if he had just walked up onto it.
    run = { ...run, body: { ...run.body, x: warp.from + 1, y: warp.fromRow, onGround: true } }

    run = stepRun(run, { ...NO_INPUT, down: true }, FIXED)
    expect(run.warp, 'pressing down on a pipe starts the trip').not.toBeNull()
    expect(run.events).toContain('pipe')

    /*
     * And the clock does not run while he is in there. Running out of time
     * inside a pipe would be a joke at the player's expense.
     */
    const clockWas = run.seconds
    let took = 0
    while (run.warp && took < WARP_SECONDS * 3) {
      run = stepRun(run, NO_INPUT, FIXED)
      took += FIXED
    }
    expect(run.seconds, 'the clock stands still down there').toBe(clockWas)
    expect(took, 'and it takes about as long as it says').toBeCloseTo(WARP_SECONDS * 2, 1)

    expect(run.warp, 'and it ends').toBeNull()
    expect(run.body.x).toBeCloseTo(warp.to + 1, 5)
    expect(run.body.y).toBeCloseTo(warp.toRow, 5)
    expect(run.body.onGround).toBe(true)
  })

  it('leaves him where he is if he presses down anywhere else', () => {
    const level = LEVELS[0]
    let run = newRun(level, 1)
    for (let t = 0; t < 0.4; t += FIXED) run = stepRun(run, NO_INPUT, FIXED)
    const before = { ...run.body }
    run = stepRun(run, { ...NO_INPUT, down: true }, FIXED)
    expect(run.warp).toBeNull()
    expect(run.body.x).toBeCloseTo(before.x, 5)
  })
})
