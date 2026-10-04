import { describe, expect, it } from 'vitest'
import {
  CELLS, COLS, DRAIN, LEAST_TRUE, LIVES, MOST_COMBO, ROWS, SURGE, TO_CLEAR, isRight,
} from './level'
import { FIXED, LOUDEST, breakable, newRun, riseFor, step, tap, tryAgain, type Run } from './run'

/** Run a whole run forward, always tapping the first true one. */
function play(run: Run, seconds: number, tapEvery = 0.5): Run {
  let next = run
  let since = 0
  for (let t = 0; t < seconds; t += FIXED) {
    next = step(next, FIXED)
    since += FIXED
    if (since >= tapEvery) {
      since = 0
      const i = next.cells.findIndex((c) => isRight(c.sum))
      if (i >= 0) next = tap(next, i % COLS, Math.floor(i / COLS))
    }
    if (next.status !== 'playing') break
  }
  return next
}

describe('the board', () => {
  it('is the shape it says it is', () => {
    const run = newRun()
    expect(run.cells).toHaveLength(CELLS)
    expect(run.cells.every((c) => c.lift === 0)).toBe(true)
    expect(new Set(run.cells.map((c) => c.id)).size).toBe(CELLS)
  })

  it('always has something that can be broken, however long it is played', () => {
    /*
     * The promise. Everything else in this game can go wrong and still be a
     * game; a board with no legal move is a player watching the water come up
     * with nothing to do about it and no way of knowing it is not their fault.
     *
     * So it is checked after every single tap of a long game rather than on a
     * fresh board, because a fresh board is the easy case — the refills are
     * where a promise like this gets lost.
     */
    for (let seed = 1; seed <= 25; seed++) {
      let run = newRun(1, 1150, 99, 0, seed)
      for (let i = 0; i < 300; i++) {
        expect(breakable(run), `seed ${seed} tap ${i}`).toBeGreaterThanOrEqual(LEAST_TRUE)
        const j = run.cells.findIndex((c) => isRight(c.sum))
        run = tap(run, j % COLS, Math.floor(j / COLS))
        run = { ...run, left: TO_CLEAR, status: 'playing', water: 0 }
      }
    }
  })

  it('keeps every id different, so the drawing can follow a cell', () => {
    let run = newRun()
    const seen = new Set(run.cells.map((c) => c.id))
    for (let i = 0; i < 200; i++) {
      const j = run.cells.findIndex((c) => isRight(c.sum))
      run = tap(run, j % COLS, Math.floor(j / COLS))
      run = { ...run, left: TO_CLEAR, status: 'playing' }
      for (const cell of run.cells) {
        if (!seen.has(cell.id)) seen.add(cell.id)
      }
      expect(new Set(run.cells.map((c) => c.id)).size, `tap ${i}`).toBe(CELLS)
    }
  })
})

describe('a tap', () => {
  it('drops the column and fills the top when it is right', () => {
    let run = newRun(1, 1000, LIVES, 0, 4)
    const i = run.cells.findIndex((c) => isRight(c.sum) && Math.floor(c.id / 1) > COLS * 3)
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const above = run.cells.slice(0, row).map((_, r) => run.cells[r * COLS + col].id)
    run = tap(run, col, row)
    // Everything that was above it is now one row lower, and falling.
    for (let r = 0; r < row; r++) {
      expect(run.cells[(r + 1) * COLS + col].id).toBe(above[r])
      expect(run.cells[(r + 1) * COLS + col].lift).toBeGreaterThan(0)
    }
    expect(run.cells[col].id).toBeGreaterThan(CELLS)
  })

  it('leaves the other columns alone', () => {
    let run = newRun(1, 1000, LIVES, 0, 9)
    const i = run.cells.findIndex((c) => isRight(c.sum))
    const col = i % COLS
    const before = run.cells.map((c) => c.id)
    run = tap(run, col, Math.floor(i / COLS))
    for (let c = 0; c < COLS; c++) {
      if (c === col) continue
      for (let r = 0; r < ROWS; r++) {
        expect(run.cells[r * COLS + c].id).toBe(before[r * COLS + c])
      }
    }
  })

  it('costs water and the streak when it is wrong, and nothing else', () => {
    const run = { ...newRun(1, 1000, LIVES, 0, 2), water: 0.5, streak: 3, lives: 3 }
    const i = run.cells.findIndex((c) => !isRight(c.sum))
    const after = tap(run, i % COLS, Math.floor(i / COLS))
    expect(after.water).toBeCloseTo(0.5 + SURGE)
    expect(after.streak).toBe(0)
    // Not a life, and not the board either: a wrong answer does not take the
    // block away, because the block is the thing you got wrong.
    expect(after.lives).toBe(3)
    expect(after.cells.map((c) => c.id)).toEqual(run.cells.map((c) => c.id))
    expect(after.events).toEqual(['wrong'])
  })

  it('drains the water and never below empty', () => {
    const run = { ...newRun(1, 1000, LIVES, 0, 3), water: DRAIN / 2 }
    const i = run.cells.findIndex((c) => isRight(c.sum))
    const after = tap(run, i % COLS, Math.floor(i / COLS))
    expect(after.water).toBe(0)
    expect(after.events).toContain('drain')
  })

  it('pays more for a run of right answers, up to a point', () => {
    let run = newRun(1, 1000, 99, 0, 6)
    const paid: number[] = []
    for (let i = 0; i < MOST_COMBO + 3; i++) {
      const was = run.score
      const j = run.cells.findIndex((c) => isRight(c.sum))
      run = tap(run, j % COLS, Math.floor(j / COLS))
      run = { ...run, left: TO_CLEAR, status: 'playing' }
      paid.push(run.score - was)
    }
    expect(paid[0]).toBeLessThan(paid[1])
    expect(run.streak).toBe(MOST_COMBO)
    expect(paid[MOST_COMBO + 1]).toBe(paid[MOST_COMBO + 2])
  })

  it('does nothing off the board, or once it is over', () => {
    const run = newRun()
    expect(tap(run, -1, 0)).toBe(run)
    expect(tap(run, COLS, 0)).toBe(run)
    expect(tap(run, 0, ROWS)).toBe(run)
    const done = { ...run, status: 'saved' as const }
    expect(tap(done, 0, 0)).toBe(done)
  })
})

describe('the water', () => {
  it('comes up on its own and faster every level', () => {
    const first = step(newRun(1), 1)
    const tenth = step(newRun(10), 1)
    expect(first.water).toBeCloseTo(riseFor(1))
    expect(tenth.water).toBeGreaterThan(first.water)
  })

  it('takes a life when it goes over his head, and ends it on the last one', () => {
    const nearly = { ...newRun(1, 1000, 2), water: 0.999 }
    const soaked = step(nearly, 1)
    expect(soaked.status).toBe('soaked')
    expect(soaked.lives).toBe(1)
    expect(soaked.events).toContain('soaked')

    const last = { ...newRun(1, 1000, 1), water: 0.999 }
    const over = step(last, 1)
    expect(over.status).toBe('over')
    expect(over.events).toContain('over')
  })

  it('can be beaten at a pace a person can read at', () => {
    /*
     * The balance question, and the only one that matters: is there time to
     * *read* the sums? Fourteen right answers at one every two and a half
     * seconds — slow, for a nine-year-old who has to work some of them out —
     * should still get him there with water to spare.
     */
    for (let seed = 1; seed <= 20; seed++) {
      const run = play(newRun(1, 1000, LIVES, 0, seed), 120, 2.5)
      expect(run.status, `seed ${seed} ended ${run.status} at ${run.water.toFixed(2)}`).toBe('saved')
    }
  })

  it('cannot be beaten by ignoring it', () => {
    // The other half: a player who taps nothing goes under, so the water is a
    // real clock and not decoration.
    const run = play(newRun(1, 1000, 1, 0, 1), 120, 1e9)
    expect(run.status).toBe('over')
  })

  it('gets harder every level, but never faster than a person can read', () => {
    /*
     * The pacing, stated as the thing it is: how many seconds a chamber gives
     * you per answer. It must come down level by level, or the game never gets
     * harder; and it must not come down past about a second and a half, or it
     * stops being a game about arithmetic and becomes one about luck.
     *
     * The first draft of these constants demanded an answer every 1.3 seconds
     * by the tenth chamber and was impossible by the thirtieth — which only
     * showed up when it was measured like this.
     */
    const paceOf = (level: number): number => {
      let slowest = 0
      for (let p = 0.6; p <= 5; p += 0.1) {
        let every = true
        for (let seed = 1; seed <= 10; seed++) {
          if (play(newRun(level, 1100, LIVES, 0, seed), 200, p).status !== 'saved') {
            every = false
            break
          }
        }
        if (every) slowest = p
      }
      return slowest
    }

    const paces = [1, 5, 10, 20, 40].map(paceOf)
    const said = paces.map((p, i) => `L${[1, 5, 10, 20, 40][i]} ${p.toFixed(1)}s`).join(', ')
    // Comfortable at the start: time to work one out on your fingers.
    expect(paces[0], said).toBeGreaterThanOrEqual(3)
    // Harder as it goes, and the deepest chamber still has a floor.
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i], said).toBeLessThanOrEqual(paces[i - 1])
    }
    expect(paces[2], said).toBeLessThan(paces[0])
    expect(paces[paces.length - 1], said).toBeGreaterThanOrEqual(1.5)
  })
})

describe('a finished run', () => {
  it('raises no events, ever again', () => {
    /*
     * The crackle. An event raised every frame of a finished game is a noise
     * played sixty times a second, which is what it sounds like.
     */
    let run = { ...newRun(1, 1000, 1), water: 0.999 }
    run = step(run, 1)
    expect(run.events).toContain('over')
    for (let i = 0; i < 600; i++) {
      run = step(run, FIXED)
      expect(run.events).toEqual([])
    }
  })

  it('does not let the water keep rising after it is lost', () => {
    let run = { ...newRun(1, 1000, 1), water: 0.999 }
    run = step(run, 1)
    const level = run.water
    for (let i = 0; i < 120; i++) run = step(run, FIXED)
    expect(run.water).toBe(level)
  })

  it('says it is saved the moment the last one is broken, not a frame later', () => {
    let run = { ...newRun(1, 1000, LIVES, 0, 8), left: 1 }
    const i = run.cells.findIndex((c) => isRight(c.sum))
    run = tap(run, i % COLS, Math.floor(i / COLS))
    expect(run.status).toBe('saved')
    expect(run.events).toContain('saved')
  })

  it('comes back with the score and the lives it had', () => {
    const run = { ...newRun(1, 1000, 2, 1700), status: 'soaked' as const }
    const again = tryAgain(run, 1000)
    expect(again.status).toBe('playing')
    expect(again.score).toBe(1700)
    expect(again.lives).toBe(2)
    expect(again.water).toBe(0)
    expect(again.left).toBe(TO_CLEAR)
  })
})

describe('the flashes', () => {
  it('outlive the cell they came from', () => {
    // The whole reason they are kept beside the board: the crushed cell is
    // replaced by its neighbour before anything could draw it.
    let run = newRun(1, 1000, LIVES, 0, 5)
    const i = run.cells.findIndex((c) => isRight(c.sum))
    run = tap(run, i % COLS, Math.floor(i / COLS))
    expect(run.pops).toHaveLength(1)
    expect(run.pops[0].good).toBe(true)
    run = step(run, FIXED)
    expect(run.pops).toHaveLength(1)
  })

  it('clear themselves up rather than piling up for ever', () => {
    let run = newRun(1, 1000, 99, 0, 5)
    for (let i = 0; i < 20; i++) {
      const j = run.cells.findIndex((c) => isRight(c.sum))
      run = tap(run, j % COLS, Math.floor(j / COLS))
      run = { ...run, left: TO_CLEAR, status: 'playing' }
      for (let f = 0; f < 30; f++) run = step(run, FIXED)
    }
    expect(run.pops).toHaveLength(0)
  })
})

describe('the noises', () => {
  it('has a place in the order for every event the game can raise', () => {
    // An event missing from this list is an event the screen silently drops.
    const raised = new Set<string>()
    const watch = (run: Run) => { for (const e of run.events) raised.add(e) }

    // Somebody playing well: mostly right, so a streak builds, with the odd
    // wrong one. This is where everything but the drowning comes from.
    for (let seed = 1; seed <= 30; seed++) {
      let run = newRun(1, 1000, 2, 0, seed)
      for (let t = 0; t < 60; t += FIXED) {
        run = step(run, FIXED)
        watch(run)
        if (t % 0.5 < FIXED) {
          const slip = Math.floor(t / 0.5) % 7 === 6
          const i = run.cells.findIndex((c) => (slip ? !isRight(c.sum) : isRight(c.sum)))
          if (i >= 0) {
            run = tap(run, i % COLS, Math.floor(i / COLS))
            watch(run)
          }
        }
        if (run.status !== 'playing') run = { ...run, status: 'playing', left: TO_CLEAR }
      }
    }

    // And somebody doing nothing at all, twice over, which is the only way to
    // hear the water take a life and then the last one.
    for (const lives of [2, 1]) {
      let run = newRun(1, 1000, lives)
      for (let t = 0; t < 120 && run.status === 'playing'; t += FIXED) {
        run = step(run, FIXED)
        watch(run)
      }
    }
    for (const e of raised) expect(LOUDEST, `${e} is not in the order`).toContain(e)
    // And the other way: nothing in the order that the game never raises.
    expect([...raised].sort()).toEqual([...LOUDEST].sort())
  })
})
