import { describe, expect, it } from 'vitest'
import {
  SHIP_WIDE, SIZE_OF, SOLAR_SYSTEM, SPLITS_INTO, SPLIT_REACH, WORLDS, payoutOf, worldFor,
} from './level'
import {
  FIXED, NO_INPUT, claim, gapNow, newRubble, newRun, resume, step, type Input, type Run,
} from './run'

/**
 * Rocks that come apart.
 *
 * The answer to "you can sit in one place and keep firing": everything falls
 * straight, every bolt goes up, so one column of fire kept one column clear
 * for ever. A rock that breaks into two pieces going sideways means the thing
 * directly above you is the worst thing to shoot.
 *
 * It is also the sixth time something in this game has been allowed to move
 * after it was placed, and the first five all broke the promise that there is
 * a way through. So most of what is here is about that promise.
 */

/** Hold the trigger and never steer: the hardest case for the promise. */
const FIRE: Input = { left: false, right: false, fire: true }

/**
 * A world that sends nothing, so the only thing on the screen is the one put
 * there on purpose.
 *
 * The first go at the two tests below counted every shard in the air and
 * reported three pieces off a rock that makes two, and a piece thrown five
 * times further than it can be thrown. Both numbers were about rubble the
 * world had sent while the test was watching.
 */
const empty = (n: number): Run => {
  const run = newRun(n)
  return { ...run, world: { ...run.world, traffic: 0 } }
}

describe('a rock coming apart', () => {
  it('leaves two pieces where it died, going opposite ways', () => {
    let run: Run = { ...empty(1), x: 0.5 }
    run.rubble.push({ ...newRubble('rock', 0.5, 0.3), id: 1 })
    while (run.rubble.some((r) => r.kind === 'rock')) run = step(run, FIRE, FIXED)
    // And a few frames after it dies, because the pieces are born where their
    // parent was and have not gone anywhere yet on the step that killed it.
    // With the trigger off, or the bolts still in the air shoot one of them
    // and this counts a piece that existed and was dealt with.
    for (let t = 0; t < 0.3; t += FIXED) run = step(run, NO_INPUT, FIXED)
    const shards = run.rubble.filter((r) => r.kind === 'shard')
    expect(shards).toHaveLength(SPLITS_INTO.rock!.count)
    expect(Math.min(...shards.map((s) => s.x))).toBeLessThan(0.5)
    expect(Math.max(...shards.map((s) => s.x))).toBeGreaterThan(0.5)
  })

  it('throws them no further than the spawner was told to expect', () => {
    /*
     * The number the fairness claim is built on. If a piece can get further
     * out than this, every gap the spawner ever measured was a guess.
     */
    let run: Run = { ...empty(1), x: 0.5 }
    run.rubble.push({ ...newRubble('rock', 0.5, 0.1), id: 1 })
    let furthest = 0
    for (let t = 0; t < 12; t += FIXED) {
      run = step(run, FIRE, FIXED)
      for (const r of run.rubble) {
        if (r.kind === 'shard') furthest = Math.max(furthest, Math.abs(r.x - 0.5))
      }
    }
    expect(furthest).toBeGreaterThan(0.01)
    expect(furthest).toBeLessThanOrEqual(SPLIT_REACH + 1e-6)
  })

  it('pays the same for the whole rock as the whole rock used to pay', () => {
    expect(payoutOf('rock')).toBe(3)
  })

  it('keeps every piece inside the claim its parent was placed on', () => {
    /*
     * The invariant itself, stated rather than sampled.
     *
     * The test below flies whole worlds and watches the gap, and it is worth
     * having, but it is not sharp: with the pieces taken back out of the claim
     * it still passed, because the spawner is conservative enough that forty
     * seconds of any world never quite closes. A promise that is only broken
     * once in a while is still broken, and the way to catch it is to check the
     * promise instead of its consequences.
     *
     * So: a rock is placed, its claim is written down, it is shot, and every
     * piece of it is required to stay inside that claim for the whole of its
     * life.
     */
    for (const at of [0.12, 0.3, 0.5, 0.74, 0.9]) {
      let run: Run = { ...empty(1), x: at }
      const rock = { ...newRubble('rock', at, 0.08), id: 1 }
      run.rubble.push(rock)
      /*
       * Asked of the real thing, not worked out again here.
       *
       * The first go at this computed the promise from the same constants
       * `claim` is built from, which made it a test of arithmetic rather than
       * of the code: taking the pieces back out of `claim` left it passing.
       */
      const promised = claim(rock)

      for (let t = 0; t < 10; t += FIXED) {
        run = step(run, t < 2 ? FIRE : NO_INPUT, FIXED)
        for (const piece of run.rubble) {
          const edge = SIZE_OF[piece.kind] / 2
          expect(
            piece.x - edge,
            `a ${piece.kind} off a rock at ${at} reached ${(piece.x - edge).toFixed(4)}`,
          ).toBeGreaterThanOrEqual(promised[0] - 1e-9)
          expect(piece.x + edge).toBeLessThanOrEqual(promised[1] + 1e-9)
        }
      }
    }
  })

  it('never closes the sky, on any world, with the trigger held down', () => {
    /*
     * Measured where things are, not where they were promised to be.
     *
     * The fairness tests elsewhere ask `widestGap`, which reads the same
     * `claim` the spawner used — so if the claim is wrong they are wrong in
     * the same direction and pass anyway. This one reads positions. It is the
     * only check here that can fail if the claim forgot about the pieces.
     *
     * The trigger is held the whole way, because a rock that is never shot is
     * a rock that never splits, and a quiet run proves nothing.
     */
    for (const number of [1, 4, 8, SOLAR_SYSTEM + 1, WORLDS.length]) {
      for (let seed = 1; seed <= 4; seed++) {
        let run = newRun(number, 99, 0, seed * 37)
        let worst = 1
        for (let t = 0; t < 40; t += FIXED) {
          run = step(run, FIRE, FIXED)
          if (run.status !== 'flying') run = resume(run)
          worst = Math.min(worst, gapNow(run.rubble, 0.4, 1.05))
        }
        expect(
          worst,
          `${worldFor(number).name} seed ${seed}: the sky closed to ${worst.toFixed(3)}`,
        ).toBeGreaterThanOrEqual(SHIP_WIDE)
      }
    }
  }, 120_000)
})
