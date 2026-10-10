import { describe, expect, it } from 'vitest'
import {
  COLS, HUNT_SAYS, OFF_HUNT, ROWS, SPARK_AT, bandFor, huntFor, writeFind, type Hunt,
} from './level'
import { IS_SEQUENCE, readLine, sayLine } from './find'
import { makeRng } from '../engine/rng'
import {
  blastOf, distinctly, findsOn, flipped, grab, newRun, reach, release, step, wanted, type Run,
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
     * like a board of fourteen finds.
     *
     * Two finds crossing each other are a different matter: one running across
     * and one running down, sharing the one number they have in common, are
     * two answers the way two words crossing in a crossword are two words.
     * Treating those as one made a board holding six look like a board holding
     * four, and made letting finds cross look like a change for the worse.
     */
    const run = newRun(2, 1000, 3, 0, 5)
    const raw = findsOn(run.cells).length
    const kept = distinctly(findsOn(run.cells))
    expect(raw).toBeGreaterThan(kept.length)

    const across = (cells: number[]) => cells.every((c) => Math.floor(c / COLS) === Math.floor(cells[0] / COLS))
    for (const [i, a] of kept.entries()) {
      for (const b of kept.slice(i + 1)) {
        const shared = a.cells.filter((c) => b.cells.includes(c))
        if (shared.length === 0) continue
        expect(across(a.cells), 'two answers along the same line were both kept')
          .not.toBe(across(b.cells))
        expect(shared.length, 'two answers crossing should share one block, not several').toBe(1)
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

/**
 * Nothing on the board that is not arithmetic.
 *
 * Reported from play: "sometimes I see 2-3 operators continuously in a line
 * e.g. *+= which is invalid". Measured before anything was changed: across a
 * hundred and sixty boards there were 1258 signs sitting on the outer edge
 * with nothing beyond them, 1125 signs touching another sign, and rows reading
 * `11 + + 39 = 5 8`.
 *
 * Swept over boards that have been played rather than only fresh ones, because
 * that is where it came from: every find crushed drops the blocks above it and
 * fills the top with new ones, and a block arriving from above knows nothing
 * about what it has landed next to.
 */
describe('the board makes sense everywhere', () => {
  const isSign = (t: { kind: string }) => t.kind === 'op' || t.kind === 'eq'
  const colOf = (i: number) => i % COLS
  const rowOf = (i: number) => Math.floor(i / COLS)
  const at = (c: number, r: number) => r * COLS + c

  /** Boards from every band, each played for a few seconds. */
  const boards = () => {
    const out: ReturnType<typeof newRun>[] = []
    for (const level of [1, 3, 7, 11, 15, 19]) {
      for (let seed = 1; seed <= 12; seed++) {
        let run = newRun(level, 1000, 3, 0, seed)
        for (let t = 0; t < 5; t += 1 / 60) run = step(run, 1 / 60)
        out.push(run)
      }
    }
    return out
  }

  it('never puts an operator against another operator', () => {
    for (const run of boards()) {
      for (let i = 0; i < COLS * ROWS; i++) {
        if (!isSign(run.cells[i].token)) continue
        const c = colOf(i)
        const r = rowOf(i)
        const say = (j: number) =>
          `${sayLine([run.cells[i].token])} and ${sayLine([run.cells[j].token])} are touching`
        if (c + 1 < COLS) {
          expect(isSign(run.cells[at(c + 1, r)].token), say(at(c + 1, r))).toBe(false)
        }
        if (r + 1 < ROWS) {
          expect(isSign(run.cells[at(c, r + 1)].token), say(at(c, r + 1))).toBe(false)
        }
      }
    }
  }, 60_000)

  it('never puts an operator on the edge or in a corner', () => {
    // An operator on the outer ring has nothing on one side of it, so no line
    // through it can be read.
    for (const run of boards()) {
      for (let i = 0; i < COLS * ROWS; i++) {
        if (!isSign(run.cells[i].token)) continue
        expect(colOf(i), 'an operator on the left or right edge').toBeGreaterThan(0)
        expect(colOf(i)).toBeLessThan(COLS - 1)
        expect(rowOf(i), 'an operator on the top or bottom edge').toBeGreaterThan(0)
        expect(rowOf(i)).toBeLessThan(ROWS - 1)
      }
    }
  }, 60_000)

  it('gives every operator a number on all four sides', () => {
    // Which is the rule the two above are really two halves of, and the whole
    // of what makes a line readable whichever way you read it.
    for (const run of boards()) {
      for (let i = 0; i < COLS * ROWS; i++) {
        if (!isSign(run.cells[i].token)) continue
        const c = colOf(i)
        const r = rowOf(i)
        for (const j of [at(c - 1, r), at(c + 1, r), at(c, r - 1), at(c, r + 1)]) {
          expect(run.cells[j]?.token.kind, 'an operator without a number beside it').toBe('num')
        }
      }
    }
  }, 60_000)

  it('puts at most one equals sign in any row', () => {
    /*
     * So that reading a row is reading one claim, right or wrong, rather than
     * a chain of them.
     *
     * This was enforced and made no difference at all, for a reason worth
     * writing down: a find was mirrored *after* the legal places for it had
     * been worked out, and mirroring an equation moves its equals sign to a
     * different block — so the sign was checked in one place and written in
     * another. It only started working when the orientation was settled first.
     *
     * Rows and not columns. One to a column as well was tried and measured:
     * there are seven columns, so it caps the whole board at seven equals
     * signs, and the real equations took every one — leaving no room for the
     * wrong sums that stop an equals sign being an answer in itself. A row is
     * seven blocks and is how the eye reads; a column is nine, longer than any
     * find, and nobody reads one as a single claim.
     */
    for (const run of boards()) {
      for (let r = 0; r < ROWS; r++) {
        const eq = Array.from({ length: COLS }, (_, c) => run.cells[at(c, r)].token)
          .filter((t) => t.kind === 'eq').length
        expect(eq, `row ${r} has ${eq} equals signs`).toBeLessThan(2)
      }
    }
  }, 60_000)

  it('does not let the equals sign be the answer by itself', () => {
    /*
     * The trap this whole change walked into. Operators only go where they are
     * legal now, which leaves far less room for them, and that made nearly
     * every equals sign on the board part of a true equation — so dragging
     * round any equals sign would have been a winning move without doing a
     * sum. Wrong equations are laid down on purpose to stop that.
     */
    let signs = 0
    let telling = 0
    for (const run of boards()) {
      const inFinds = new Set(distinctly(findsOn(run.cells)).flatMap((f) => f.cells))
      for (let i = 0; i < COLS * ROWS; i++) {
        if (run.cells[i].token.kind !== 'eq') continue
        signs++
        if (inFinds.has(i)) telling++
      }
    }
    expect(signs, 'no equals signs to judge').toBeGreaterThan(100)
    const tell = telling / signs
    expect(tell, `${(tell * 100).toFixed(0)}% of equals signs sit in a true equation`)
      .toBeLessThan(0.9)
  }, 60_000)

  it('still holds plenty to find, with all of that true', () => {
    // The rules above cost answers, and the answer to that was letting finds
    // cross one another. Without it a board held four; with it, six.
    for (const level of [1, 3, 7, 11]) {
      const counts: number[] = []
      for (let seed = 1; seed <= 25; seed++) {
        counts.push(wanted(newRun(level, 1000, 3, 0, seed).cells, huntFor(level)).length)
      }
      const worst = Math.min(...counts)
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length
      expect(worst, `chamber ${level} can open with only ${worst}`).toBeGreaterThanOrEqual(4)
      expect(mean, `chamber ${level} averages ${mean.toFixed(1)}`).toBeGreaterThanOrEqual(5)
    }
  }, 60_000)
})

/**
 * Sparks.
 *
 * "Add a special candy to the screen when he finds an equation. Merge multiple
 * special candies and you crush entire row and column."
 *
 * A spark rides on an ordinary number block and changes nothing about the sum
 * it is in — which matters, because the board was only just put in order and a
 * special block that broke the arithmetic would undo that.
 */
describe('a spark', () => {
  const take = (run: Run, cells: number[]): Run => {
    let on = grab(run, cells[0])
    for (const cell of cells.slice(1)) on = reach(on, cell)
    return release(on)
  }

  const anyFind = (run: Run) => wanted(run.cells, huntFor(run.level))[0] ?? findsOn(run.cells, 1)[0]

  it('is left behind by a find of five or more', () => {
    let left = 0
    let tried = 0
    for (let seed = 1; seed <= 20; seed++) {
      const run = newRun(1, 1000, 3, 0, seed)
      const found = anyFind(run)
      if (!found || found.cells.length < SPARK_AT) continue
      tried++
      const after = take(run, found.cells)
      if (after.cells.some((c) => c.spark)) left++
    }
    expect(tried, 'no long finds to try').toBeGreaterThan(5)
    expect(left, `${left} of ${tried} long finds left a spark`).toBe(tried)
  })

  it('rides on a plain number, so the board still reads as arithmetic', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let run = newRun(1, 1000, 3, 0, seed)
      const found = anyFind(run)
      if (!found || found.cells.length < SPARK_AT) continue
      run = take(run, found.cells)
      for (const cell of run.cells) {
        if (cell.spark) expect(cell.token.kind, 'a spark landed on an operator').toBe('num')
      }
    }
  })

  it('takes its whole row and column when it is crushed', () => {
    const run = newRun(1, 1000, 3, 0, 4)
    const found = anyFind(run)
    expect(found).toBeTruthy()
    const plain = blastOf(found!.cells, run.cells).length
    // The same find, with a spark on one of its blocks.
    const sparked = run.cells.map((c, i) => (i === found!.cells[0] ? { ...c, spark: true } : c))
    const big = blastOf(found!.cells, sparked).length
    expect(big, 'the spark took nothing extra').toBeGreaterThan(plain)
    expect(big).toBeGreaterThanOrEqual(COLS + ROWS - 1)
  })

  it('takes more when two go off together than the two would on their own', () => {
    /*
     * Against the union of what each would take by itself, not against one of
     * them — which is the test this started as, and it passed with the whole
     * merging rule taken out. Two sparks in different rows take two rows
     * whether or not they are doing anything special together, so comparing
     * two against one proves nothing about the merge.
     */
    const run = newRun(1, 1000, 3, 0, 4)
    const found = anyFind(run)!
    const first = found.cells[0]
    const last = found.cells[found.cells.length - 1]
    const withSpark = (...where: number[]) =>
      run.cells.map((c, i) => (where.includes(i) ? { ...c, spark: true } : c))

    const apart = new Set([
      ...blastOf(found.cells, withSpark(first)),
      ...blastOf(found.cells, withSpark(last)),
    ])
    const together = blastOf(found.cells, withSpark(first, last))
    expect(
      together.length,
      `two together took ${together.length}, the two apart ${apart.size}`,
    ).toBeGreaterThan(apart.size)
  })

  it('pays more and drains more than the same find without one', () => {
    const run = newRun(1, 1000, 3, 0, 4)
    const found = anyFind(run)!
    const wet = { ...run, water: 0.6 }
    const plain = take(wet, found.cells)
    const sparked = take(
      { ...wet, cells: wet.cells.map((c, i) => (i === found.cells[0] ? { ...c, spark: true } : c)) },
      found.cells,
    )
    expect(sparked.score, 'a spark was worth no more').toBeGreaterThan(plain.score)
    expect(sparked.water, 'a spark drained no more').toBeLessThan(plain.water)
  })

  it('does not make another spark out of going off, for ever', () => {
    const run = newRun(1, 1000, 3, 0, 4)
    const found = anyFind(run)!
    const sparked = {
      ...run,
      cells: run.cells.map((c, i) => (i === found.cells[0] ? { ...c, spark: true } : c)),
    }
    const after = take(sparked, found.cells)
    expect(after.cells.filter((c) => c.spark).length, 'sparks breeding').toBe(0)
  })
})
