import { describe, expect, it } from 'vitest'
import { HUNT_SAYS, OFF_HUNT, bandFor, huntFor, writeFind, type Hunt } from './level'
import { IS_SEQUENCE, readLine, sayLine } from './find'
import { makeRng } from '../engine/rng'
import {
  distinctly, findsOn, flipped, grab, newRun, reach, release, wanted, type Run,
} from './run'

/**
 * One chamber, one question.
 *
 * A board used to hold equations and sequences at once with nothing to say
 * which you were meant to be hunting, so scanning it meant carrying both
 * questions at the same time.
 */
describe('what a chamber asks for', () => {
  it('alternates, and starts with sums', () => {
    expect(huntFor(1)).toBe('sums')
    expect(huntFor(2)).toBe('runs')
    for (let level = 1; level <= 30; level++) {
      expect(huntFor(level + 1), `chambers ${level} and ${level + 1}`).not.toBe(huntFor(level))
    }
  })

  it('says what it wants in words, with an example', () => {
    for (const hunt of ['sums', 'runs'] as Hunt[]) {
      const it_ = HUNT_SAYS[hunt]
      expect(it_.wants.length).toBeGreaterThan(10)
      expect(it_.like).toMatch(/\d/)
    }
  })

  it('plants only the kind it asked for', () => {
    for (const level of [1, 2, 5, 8, 11, 14, 19, 22]) {
      const hunt = huntFor(level)
      for (let seed = 1; seed <= 12; seed++) {
        const run = newRun(level, 1000, 3, 0, seed)
        for (const found of distinctly(findsOn(run.cells))) {
          expect(
            IS_SEQUENCE[found.find.kind],
            `chamber ${level} wants ${hunt} and has a ${found.find.says} on it`,
          ).toBe(hunt === 'runs')
        }
      }
    }
  })

  it('puts no equals sign at all on a sequences board', () => {
    /*
     * The clearest way of saying what the chamber wants, because the board
     * says it rather than a label: a wall of plain numbers reads as runs. One
     * equals sign on it and the eye starts hunting sums again.
     */
    for (const level of [2, 4, 8, 12, 20]) {
      for (let seed = 1; seed <= 10; seed++) {
        const run = newRun(level, 1000, 3, 0, seed)
        const signs = run.cells.filter((c) => c.token.kind === 'eq').length
        const ops = run.cells.filter((c) => c.token.kind === 'op').length
        expect(signs, `chamber ${level} seed ${seed}`).toBe(0)
        expect(ops, `chamber ${level} seed ${seed}`).toBe(0)
      }
    }
    // And a sums board does have them, or the test above proves nothing.
    const sums = newRun(1, 1000, 3, 0, 3)
    expect(sums.cells.filter((c) => c.token.kind === 'eq').length).toBeGreaterThan(0)
  })
})

describe('what is written on the board', () => {
  it('writes an equation the other way round without making it false', () => {
    /*
     * The one that mattered, and it is tested here rather than on the board
     * because on the board it cannot be seen: a false equation is only ever a
     * line the game does not recognise, so a test that checks the lines the
     * game *does* recognise is a test that cannot fail.
     *
     * Finds were written backwards half the time, which is harmless for a run
     * of numbers and ruinous for an equation: `70 ÷ 7 = 10` reversed is
     * `10 = 7 ÷ 70`. About half of every planted take-away, share and power
     * was a wrong answer printed on the board looking exactly like a right
     * one, and the only symptom was that the game felt hard.
     */
    const rng = makeRng(11)
    const band = bandFor(1300, 9)
    let checked = 0
    let naiveBroke = 0
    for (let i = 0; i < 800; i++) {
      const tokens = writeFind('sum', band, 5, rng)
      if (!tokens || !readLine(tokens)) continue
      checked++
      const mirror = flipped(tokens)
      expect(mirror, 'an equation has another way round').toBeTruthy()
      expect(
        readLine(mirror!),
        `"${sayLine(tokens)}" became "${sayLine(mirror!)}"`,
      ).toBeTruthy()
      // The control: the old way of doing it really does break them, so this
      // test is about a real difference and not about nothing.
      if (!readLine([...tokens].reverse())) naiveBroke++
    }
    expect(checked, 'no equations were generated to check').toBeGreaterThan(200)
    expect(naiveBroke, 'reversing never broke one, so there was no bug to fix')
      .toBeGreaterThan(checked * 0.2)
  })

  it('hands over a board with several answers on it, not one', () => {
    /*
     * "Add multiple equations every window, so it's not hard to find one."
     * Measured by playing, not by counting what was planted: planting six does
     * not mean six survive.
     */
    for (const level of [1, 2, 7, 8, 11, 12, 17, 20]) {
      const counts: number[] = []
      for (let seed = 1; seed <= 25; seed++) {
        counts.push(wanted(newRun(level, 1000, 3, 0, seed).cells, huntFor(level)).length)
      }
      /*
       * Flat numbers, not `LEAST_FINDS` and `PLANTED`.
       *
       * Written against the constants first, which meant the test graded
       * itself: halving them back to what they were made the boards thin again
       * and every assertion still passed.
       */
      const worst = Math.min(...counts)
      expect(worst, `chamber ${level} can open with only ${worst}`).toBeGreaterThanOrEqual(4)
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length
      expect(mean, `chamber ${level} averages ${mean.toFixed(1)}`).toBeGreaterThanOrEqual(5)
    }
  })

  it('counts separate answers, not separate readings of one', () => {
    /*
     * A seven-long sequence contains four four-long ones inside it, all true
     * and all the same answer. Counting those made a board of two runs look
     * like a board of fourteen finds, and the promise was being kept with a
     * number that meant nothing.
     */
    const run = newRun(2, 1000, 3, 0, 5)
    const raw = findsOn(run.cells).length
    const real = distinctly(findsOn(run.cells)).length
    expect(raw).toBeGreaterThan(real)
    const kept = distinctly(findsOn(run.cells))
    for (const [i, a] of kept.entries()) {
      for (const b of kept.slice(i + 1)) {
        expect(a.cells.some((c) => b.cells.includes(c)), 'two answers share a block').toBe(false)
      }
    }
  })
})

describe('finding the other kind', () => {
  /** Play a find through the real finger: down on the first block, up on the last. */
  const take = (run: Run, cells: number[]): Run => {
    let on = grab(run, cells[0])
    for (const cell of cells.slice(1)) on = reach(on, cell)
    return release(on)
  }

  it('still crushes and still scores, for less', () => {
    /*
     * Spotting a Fibonacci run in a chamber of sums is good arithmetic and
     * good eyes. Telling somebody that correct maths is a miss is how you stop
     * them looking.
     */
    const run = newRun(1, 1000, 3, 0, 4)
    const here = wanted(run.cells, 'sums')[0]
    expect(here, 'no sum on a sums board').toBeTruthy()
    const scored = take(run, here.cells)
    expect(scored.score).toBeGreaterThan(0)
    expect(scored.said?.asked).toBe(true)
    expect(scored.events).not.toContain('miss')
  })

  it('is worth less than the kind the chamber asked for', () => {
    expect(OFF_HUNT).toBeLessThan(1)
    expect(OFF_HUNT, 'so little it may as well be a miss').toBeGreaterThan(0.4)
  })
})
