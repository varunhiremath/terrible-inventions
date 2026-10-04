import { describe, expect, it } from 'vitest'
import { makeRng } from '../engine/rng'
import {
  BANDS, CELLS, COLS, DRAIN_PER_BLOCK, LEAST_FINDS, LIVES, NUDGE_AT, NUDGE_SAYS, ROWS, SURGE,
  TO_CLEAR, at, bandFor, colOf, rowOf, writeFind,
} from './level'
import { LEAST_FIND, readLine } from './find'
import {
  FIXED, LOUDEST, askNudge, blastOf, findsOn, grab, letGo, newRun, reach, release, riseFor,
  runBetween, step, tryAgain, worthOf, type FloodEvent, type Run,
} from './run'

/** Play a find through the real finger: down on the first block, up on the last. */
function take(run: Run, cells: number[]): Run {
  let on = grab(run, cells[0])
  for (const cell of cells.slice(1)) on = reach(on, cell)
  return release(on)
}

/** The first find on the board, as the player would have to see it. */
const firstFind = (run: Run) => findsOn(run.cells, 1)[0] ?? null

describe('a board', () => {
  it('is the size it says it is, with every block different', () => {
    const run = newRun()
    expect(run.cells).toHaveLength(CELLS)
    expect(new Set(run.cells.map((c) => c.id)).size).toBe(CELLS)
    expect(run.cells.every((c) => c.lift === 0)).toBe(true)
  })

  it('always has something to find on it, in every band', () => {
    /*
     * The promise. A grid of randomly chosen numbers and signs holds a true
     * line about never, so the finds are written in first — and this checks the
     * board that comes out, not the writing that went in.
     */
    for (let rating = 800; rating <= 1500; rating += 100) {
      for (let seed = 1; seed <= 60; seed++) {
        const run = newRun(1, rating, LIVES, 0, seed)
        expect(findsOn(run.cells, LEAST_FINDS).length, `rating ${rating} seed ${seed}`)
          .toBeGreaterThanOrEqual(LEAST_FINDS)
      }
    }
  })

  it('keeps the promise through a long game, not just on a fresh board', () => {
    // The refills are where a promise like this gets lost.
    for (let seed = 1; seed <= 12; seed++) {
      let run = newRun(1, 1200, 99, 0, seed)
      for (let go = 0; go < 60; go++) {
        const found = firstFind(run)
        expect(found, `seed ${seed} go ${go}: nothing to find`).not.toBe(null)
        if (!found) break
        run = take(run, found.cells)
        run = { ...run, left: TO_CLEAR, status: 'playing', water: 0 }
      }
    }
  })

  it('does not give the planted finds away by the size of their numbers', () => {
    /*
     * The filler is drawn from the same range the finds use. It was not, in the
     * first cut — the filler went up to the band's maximum while a planted
     * step started small — and a board where the answer is the group of small
     * numbers is a board you can read without doing any arithmetic.
     */
    const run = newRun(1, 1200, LIVES, 0, 4)
    const inFinds = new Set(findsOn(run.cells).flatMap((f) => f.cells))
    const sizeOf = (only: boolean) => {
      const ns = run.cells
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => c.token.kind === 'num' && inFinds.has(i) === only)
        .map(({ c }) => (c.token as { n: number }).n)
      return ns.reduce((a, b) => a + b, 0) / Math.max(1, ns.length)
    }
    const inside = sizeOf(true)
    const outside = sizeOf(false)
    expect(Math.abs(inside - outside) / Math.max(inside, outside),
      `planted ${inside.toFixed(0)} vs filler ${outside.toFixed(0)}`).toBeLessThan(0.6)
  })

  it('gets harder with the rating and with how deep he is', () => {
    expect(bandFor(800, 1).name).toBe('adding')
    expect(bandFor(1500, 1).name).toBe('the lot')
    // Four chambers in, the same rating has opened something new up.
    expect(BANDS.indexOf(bandFor(800, 9))).toBeGreaterThan(BANDS.indexOf(bandFor(800, 1)))
    // And it stops at the top rather than running off the end.
    expect(bandFor(1500, 99).name).toBe('the lot')
  })

  it('only ever writes a find that reads as one', () => {
    // The generator and the reader are separate pieces of code and have to
    // agree; this is the only place they are put in a room together.
    for (const band of BANDS) {
      const rng = makeRng(9)
      for (const kind of ['sum', ...band.runs] as const) {
        for (let go = 0; go < 120; go++) {
          const want = kind === 'sum' ? 5 : rng.pick([4, 5, 6])
          const tokens = writeFind(kind, band, want, rng)
          if (!tokens) continue
          expect(readLine(tokens), `${band.name}/${kind}: ${tokens.map((t) => 'n' in t ? t.n : 'op' in t ? t.op : '=').join(' ')}`)
            .not.toBe(null)
          // And backwards, since half of them are written that way.
          expect(tokens.length).toBeGreaterThanOrEqual(LEAST_FIND)
        }
      }
    }
  })
})

describe('a selection', () => {
  it('is the run between where the finger went down and where it is', () => {
    expect(runBetween(at(1, 2), at(4, 2))).toEqual([at(1, 2), at(2, 2), at(3, 2), at(4, 2)])
    // Backwards is the same blocks, read the other way.
    expect(runBetween(at(4, 2), at(1, 2))).toEqual([at(4, 2), at(3, 2), at(2, 2), at(1, 2)])
    expect(runBetween(at(3, 0), at(3, 3))).toEqual([at(3, 0), at(3, 1), at(3, 2), at(3, 3)])
  })

  it('is nothing at all when the two are not in a line', () => {
    expect(runBetween(at(1, 1), at(3, 4))).toEqual([])
  })

  it('cannot be tied in a knot by a wandering finger', () => {
    /*
     * The selection is an anchor and a head, not a path — so a finger that
     * goes out, comes back and sets off again still leaves a straight run.
     */
    let run = grab(newRun(), at(1, 3))
    run = reach(run, at(5, 3))
    run = reach(run, at(2, 3))
    run = reach(run, at(4, 3))
    expect(run.picked).toEqual([at(1, 3), at(2, 3), at(3, 3), at(4, 3)])
    // And across to another row, which is not a line, so nothing changes.
    const was = run.picked
    run = reach(run, at(4, 6))
    expect(run.picked).toEqual(was)
  })

  it('says while it is being dragged whether it reads as something', () => {
    // So the blocks can light up under the finger before it is let go.
    for (let seed = 1; seed <= 20; seed++) {
      const run = newRun(1, 1200, LIVES, 0, seed)
      const found = firstFind(run)
      if (!found) continue
      let on = grab(run, found.cells[0])
      for (const cell of found.cells.slice(1)) on = reach(on, cell)
      expect(on.reading, `seed ${seed}`).not.toBe(null)
      expect(on.reading?.length).toBe(found.cells.length)
    }
  })
})

describe('letting go', () => {
  it('crushes a find, and takes water out for every block of it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = { ...newRun(1, 1200, LIVES, 0, seed), water: 0.8 }
      const found = firstFind(run)
      if (!found) continue
      const after = take(run, found.cells)
      const gone = blastOf(found.cells).length
      expect(after.water, `seed ${seed}`).toBeCloseTo(0.8 - gone * DRAIN_PER_BLOCK, 5)
      expect(after.left).toBe(TO_CLEAR - gone)
      expect(after.score).toBeGreaterThan(0)
      expect(after.said?.length).toBe(found.cells.length)
    }
  })

  it('costs a little water and the streak when it is not a find, and nothing else', () => {
    const run = { ...newRun(1, 1000, LIVES, 0, 3), water: 0.5, streak: 3 }
    // A run that is not a find: four blocks is long enough to be judged.
    const wrong = [at(0, 0), at(1, 0), at(2, 0), at(3, 0)]
    const reads = readLine(wrong.map((i) => run.cells[i].token))
    if (reads) return
    const after = take(run, wrong)
    expect(after.water).toBeCloseTo(0.5 + SURGE, 5)
    expect(after.streak).toBe(0)
    expect(after.lives).toBe(LIVES)
    expect(after.cells.map((c) => c.id)).toEqual(run.cells.map((c) => c.id))
    expect(after.events).toEqual(['miss'])
  })

  it('costs nothing at all for a selection too short to be anything', () => {
    /*
     * Looking is how this game is played. A finger that goes down, drags two
     * blocks and thinks better of it has not made a mistake.
     */
    const run = { ...newRun(1, 1000, LIVES, 0, 3), water: 0.4 }
    const after = take(run, [at(0, 0), at(1, 0), at(2, 0)])
    expect(after.water).toBe(0.4)
    expect(after.streak).toBe(run.streak)
    expect(after.events).toEqual([])
  })

  it('pays far more for a long find than for a short one', () => {
    // Not twice as much for twice as long — much more, because that is the
    // thing worth hunting for.
    expect(worthOf(8, 1) / worthOf(4, 1)).toBeGreaterThan(4)
    for (let n = LEAST_FIND; n < 9; n++) {
      expect(worthOf(n + 1, 1), `${n} to ${n + 1}`).toBeGreaterThan(worthOf(n, 1))
    }
    // And a run of them is worth more again.
    expect(worthOf(5, 3)).toBeGreaterThan(worthOf(5, 1))
  })

  it('takes more of the board than it covers, once a find is long', () => {
    const short = blastOf([at(1, 4), at(2, 4), at(3, 4), at(4, 4)])
    expect(short).toHaveLength(4)

    // Five or six: the blocks either side of it as well.
    const middling = blastOf([at(1, 4), at(2, 4), at(3, 4), at(4, 4), at(5, 4)])
    expect(middling.length).toBeGreaterThan(5)
    expect(middling).toContain(at(1, 3))
    expect(middling).toContain(at(1, 5))

    // Seven: the whole row and the whole column it crosses.
    const whole = blastOf(Array.from({ length: 7 }, (_, i) => at(i, 4)))
    for (let c = 0; c < COLS; c++) expect(whole).toContain(at(c, 4))
    for (let r = 0; r < ROWS; r++) expect(whole).toContain(at(3, r))
  })

  it('reaches the biggest prize going across as well as going down', () => {
    // A row is seven blocks wide, so a threshold of eight would have made the
    // best thing in the game a downwards-only rule nobody would ever guess.
    const across = blastOf(Array.from({ length: COLS }, (_, i) => at(i, 2)))
    const down = blastOf(Array.from({ length: COLS }, (_, i) => at(2, i)))
    expect(across.length).toBeGreaterThan(COLS + 2)
    expect(down.length).toBeGreaterThan(COLS + 2)
  })

  it('drops the blocks above a crush and fills the top', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = newRun(1, 1200, LIVES, 0, seed)
      const found = firstFind(run)
      if (!found) continue
      const after = take(run, found.cells)
      expect(after.cells).toHaveLength(CELLS)
      expect(new Set(after.cells.map((c) => c.id)).size, `seed ${seed}: a block twice`).toBe(CELLS)
      // Something is falling, and nothing is below where it belongs.
      expect(after.cells.some((c) => c.lift > 0), `seed ${seed}`).toBe(true)
      expect(after.cells.every((c) => c.lift >= 0)).toBe(true)
    }
  })

  it('settles everything it set falling', () => {
    let run = newRun(1, 1200, 99, 0, 5)
    const found = firstFind(run)
    if (!found) return
    run = take(run, found.cells)
    for (let i = 0; i < 300; i++) run = step(run, FIXED)
    expect(run.cells.every((c) => c.lift === 0)).toBe(true)
  })
})

describe('the water', () => {
  it('comes up on its own and faster every chamber, up to a limit', () => {
    expect(step(newRun(1), 1).water).toBeCloseTo(riseFor(1))
    expect(riseFor(10)).toBeGreaterThan(riseFor(1))
    expect(riseFor(400)).toBe(riseFor(200))
  })

  it('takes a life when it goes over his head, and ends it on the last one', () => {
    const soaked = step({ ...newRun(1, 1000, 2), water: 0.999 }, 1)
    expect(soaked.status).toBe('soaked')
    expect(soaked.lives).toBe(1)
    const over = step({ ...newRun(1, 1000, 1), water: 0.999 }, 1)
    expect(over.status).toBe('over')
  })

  it('gives him time to actually look for a find', () => {
    /*
     * The balance question, and the only one that matters now that the game is
     * hunting rather than tapping. Scanning sixty-three blocks for a run of
     * square numbers is twenty seconds of work for a nine-year-old, not two —
     * so the question is how many seconds a chamber allows per find, and the
     * answer has to be measured.
     */
    const paceOf = (level: number, rating: number): number => {
      let slowest = 0
      for (let gap = 2; gap <= 40; gap += 2) {
        let every = true
        for (let seed = 1; seed <= 8; seed++) {
          let run = newRun(level, rating, LIVES, 0, seed)
          let since = 0
          for (let t = 0; t < 600; t += FIXED) {
            run = step(run, FIXED)
            since += FIXED
            if (since >= gap) {
              since = 0
              const found = firstFind(run)
              if (found) run = take(run, found.cells)
            }
            if (run.status !== 'playing') break
          }
          if (run.status !== 'saved') { every = false; break }
        }
        if (every) slowest = gap
      }
      return slowest
    }

    const first = paceOf(1, 1000)
    const tenth = paceOf(10, 1200)
    const said = `first ${first}s a find, tenth ${tenth}s`
    // Room to think at the start.
    expect(first, said).toBeGreaterThanOrEqual(14)
    // Harder later, but never a game of luck.
    expect(tenth, said).toBeLessThan(first)
    expect(tenth, said).toBeGreaterThanOrEqual(8)
  }, 60_000)

  it('cannot be beaten by ignoring it', () => {
    let run = newRun(1, 1000, 1)
    for (let t = 0; t < 400 && run.status === 'playing'; t += FIXED) run = step(run, FIXED)
    expect(run.status).toBe('over')
  })
})

describe('a finished run', () => {
  it('raises no events, ever again', () => {
    let run = step({ ...newRun(1, 1000, 1), water: 0.999 }, 1)
    expect(run.events).toContain('over')
    for (let i = 0; i < 600; i++) {
      run = step(run, FIXED)
      expect(run.events).toEqual([])
    }
    // And a finger does nothing on it.
    expect(grab(run, 0)).toBe(run)
    expect(release(run)).toBe(run)
  })

  it('comes back with the score and the lives it had', () => {
    const again = tryAgain({ ...newRun(1, 1000, 2, 1700), status: 'soaked' as const }, 1000)
    expect(again.status).toBe('playing')
    expect(again.score).toBe(1700)
    expect(again.lives).toBe(2)
    expect(again.water).toBe(0)
    expect(again.left).toBe(TO_CLEAR)
  })
})

describe('the noises', () => {
  it('has a place in the order for every event the game can raise', () => {
    const raised = new Set<FloodEvent>()
    const watch = (run: Run) => { for (const e of run.events) raised.add(e) }

    for (let seed = 1; seed <= 25; seed++) {
      let run = newRun(1, 1200, 2, 0, seed)
      for (let go = 0; go < 30; go++) {
        const found = firstFind(run)
        if (!found) break
        // Played well.
        let on = grab(run, found.cells[0]); watch(on)
        for (const cell of found.cells.slice(1)) { on = reach(on, cell); watch(on) }
        run = release(on); watch(run)
        for (let f = 0; f < 60; f++) { run = step(run, FIXED); watch(run) }
        // And badly: a run that is almost certainly not a find.
        const wrong = [at(0, 8), at(1, 8), at(2, 8), at(3, 8), at(4, 8)]
        let bad = grab(run, wrong[0])
        for (const cell of wrong.slice(1)) bad = reach(bad, cell)
        const judged = release(bad)
        watch(judged)
        if (judged.events.includes('miss')) run = judged
        if (run.status !== 'playing') run = { ...run, status: 'playing', left: TO_CLEAR, water: 0.2 }
      }
    }

    // And somebody sitting looking at it, which is the only way to be offered
    // a hand. Driven on purpose rather than left to happen: it did happen, by
    // the timing of the loop above, which is not the same as being covered.
    {
      let idle = newRun(1, 1100, 3, 0, 2)
      for (let t = 0; t < 20; t += FIXED) { idle = step(idle, FIXED); watch(idle) }
    }

    // And the two ends of the game, which only happen by doing nothing.
    for (const lives of [2, 1]) {
      let run = newRun(1, 1000, lives)
      for (let t = 0; t < 400 && run.status === 'playing'; t += FIXED) {
        run = step(run, FIXED); watch(run)
      }
    }
    // And a chamber cleared.
    let won = newRun(1, 1200, 3, 0, 2)
    won = { ...won, left: 1 }
    const found = firstFind(won)
    if (found) watch(take(won, found.cells))

    for (const e of raised) expect(LOUDEST, `${e} is not in the order`).toContain(e)
    expect([...raised].sort()).toEqual([...LOUDEST].sort())
  }, 60_000)

  it('lets a drag be abandoned without judging it', () => {
    const run = reach(grab(newRun(), at(0, 0)), at(4, 0))
    const gone = letGo(run)
    expect(gone.picked).toEqual([])
    expect(gone.events).toEqual([])
    expect(gone.water).toBe(run.water)
  })
})

describe('the board offering a hand', () => {
  /** Sit and look at the board for this long, touching nothing. */
  function wait(run: Run, seconds: number): Run {
    let on = run
    for (let t = 0; t < seconds; t += FIXED) on = step(on, FIXED)
    return on
  }

  it('offers nothing at all while he is still looking', () => {
    // The first stage is fifteen seconds in. Before that the board says
    // nothing, because somebody reading a grid is not somebody stuck.
    const run = wait(newRun(1, 1100, LIVES, 0, 4), NUDGE_AT[0] - 2)
    expect(run.nudge).toBe(null)
  })

  it('blinks one block, and only one, when he has been a while', () => {
    /*
     * The whole point of the first stage: it says where a find starts and not
     * what it is. A hint that lights the answer up has not helped anybody
     * think, it has ended the thinking.
     */
    const run = wait(newRun(1, 1100, LIVES, 0, 4), NUDGE_AT[0] + 1)
    expect(run.nudge?.stage).toBe(1)
    expect(run.nudge?.cells).toHaveLength(1)
  })

  it('gives away more the longer he is stuck, and stops at the whole line', () => {
    let run = wait(newRun(1, 1100, LIVES, 0, 4), NUDGE_AT[0] + 1)
    expect(run.nudge?.cells).toHaveLength(1)
    run = wait(run, NUDGE_AT[1] - NUDGE_AT[0])
    expect(run.nudge?.stage).toBe(2)
    expect(run.nudge?.cells).toHaveLength(2)
    run = wait(run, NUDGE_AT[2] - NUDGE_AT[1])
    expect(run.nudge?.stage).toBe(3)
    expect(run.nudge?.cells.length).toBeGreaterThanOrEqual(4)
    // And it never climbs past the last rung, however long he sits there.
    const was = run.nudge?.cells.length
    run = wait(run, 60)
    expect(run.nudge?.stage).toBe(NUDGE_AT.length)
    expect(run.nudge?.cells.length).toBe(was)
  })

  it('always points at something that really is there', () => {
    /*
     * The one way a hint can be worse than no hint. It is taken from the live
     * board rather than remembered, so it cannot go stale — but "cannot" is
     * what a test is for.
     */
    for (let seed = 1; seed <= 25; seed++) {
      const run = wait(newRun(1, 1200, LIVES, 0, seed), NUDGE_AT[2] + 1)
      const nudge = run.nudge
      expect(nudge, `seed ${seed}`).not.toBe(null)
      if (!nudge) continue
      // The whole line it ends up showing has to read as a find.
      const after = take(run, nudge.cells)
      expect(after.events, `seed ${seed}: the hint was not a find`).not.toContain('miss')
      expect(after.score, `seed ${seed}`).toBeGreaterThan(0)
    }
  })

  it('never interrupts a finger that is already working', () => {
    /*
     * A board that starts blinking at somebody mid-drag is a board talking
     * over them. The clock stops while a finger is down, and it is a pause
     * rather than a reset — otherwise anybody who keeps trying things would
     * never be offered anything at all.
     */
    let run = wait(newRun(1, 1100, LIVES, 0, 4), NUDGE_AT[0] - 3)
    run = grab(run, at(0, 0))
    const held = wait(run, 30)
    expect(held.nudge, 'offered a hand while he was mid-drag').toBe(null)
    expect(held.idle).toBeCloseTo(run.idle, 1)
    // And once the finger comes up, the clock carries on from where it was.
    const after = wait(release(held), 4)
    expect(after.nudge?.stage).toBe(1)
  })

  it('forgets all about it the moment he finds one', () => {
    let run = wait(newRun(1, 1200, LIVES, 0, 6), NUDGE_AT[1] + 1)
    expect(run.nudge).not.toBe(null)
    const found = firstFind(run)
    if (!found) return
    run = take(run, found.cells)
    expect(run.nudge).toBe(null)
    expect(run.idle).toBe(0)
  })

  it('does not treat a wrong try as progress', () => {
    /*
     * Dragging the wrong line is still being stuck — more so, if anything. The
     * clock keeps running, so somebody flailing is offered a hand rather than
     * being left to flail quietly.
     */
    let run = wait(newRun(1, 1100, LIVES, 0, 3), NUDGE_AT[0] - 2)
    const wrong = [at(0, 0), at(1, 0), at(2, 0), at(3, 0)]
    if (!readLine(wrong.map((i) => run.cells[i].token))) {
      run = take(run, wrong)
      expect(run.idle).toBeGreaterThan(NUDGE_AT[0] - 4)
    }
  })

  it('climbs the same ladder a rung at a time when he asks', () => {
    // So somebody who only wants a nudge can take only a nudge.
    let run = newRun(1, 1200, LIVES, 0, 8)
    run = askNudge(run)
    expect(run.nudge?.cells).toHaveLength(1)
    run = askNudge(run)
    expect(run.nudge?.cells).toHaveLength(2)
    run = askNudge(run)
    expect(run.nudge?.stage).toBe(3)
    expect(run.nudge?.cells.length).toBeGreaterThanOrEqual(4)
    // And asking again does not go further than showing it.
    const was = run.nudge?.cells.length
    run = askNudge(run)
    expect(run.nudge?.cells.length).toBe(was)
  })

  it('has a word for every rung', () => {
    expect(NUDGE_SAYS).toHaveLength(NUDGE_AT.length)
    for (const said of NUDGE_SAYS) {
      expect(said.length).toBeGreaterThan(0)
      // Never "you are stuck": it is an offer, not a verdict.
      expect(said.toLowerCase()).not.toContain('stuck')
      expect(said.toLowerCase()).not.toContain('wrong')
    }
  })

  it('says nothing on a run that is over', () => {
    const done = { ...newRun(1, 1000, 1), status: 'over' as const }
    expect(askNudge(done)).toBe(done)
    expect(wait(done, 60).nudge).toBe(null)
  })
})

describe('the shape of the board', () => {
  it('agrees with itself about where a block is', () => {
    for (let i = 0; i < CELLS; i++) expect(at(colOf(i), rowOf(i))).toBe(i)
  })
})
