import { describe, expect, it } from 'vitest'
import { makeRng } from '../engine/rng'
import {
  BANDS, CELLS, LEAST_TRUE, TRUE_SHARE, bandFor, isRight, keepPromise, newBoard, newSum,
  trueSum, worksOut, wrongSum,
} from './level'

/**
 * The sums.
 *
 * The thing worth testing here is not whether the arithmetic is right — it is
 * whether a *wrong* block is wrong in a way that has to be worked out. A board
 * where every wrong answer is miles off is a board you clear by glancing at
 * it, which is a fine game and not this one.
 */

describe('a sum that is true', () => {
  it('is true, in every band, every time', () => {
    for (const band of BANDS) {
      const rng = makeRng(7)
      for (let i = 0; i < 400; i++) {
        const sum = trueSum(band, rng)
        expect(isRight(sum), `${band.name}: ${sum.a} ${sum.sign} ${sum.b} = ${sum.claim}`).toBe(true)
      }
    }
  })

  it('never asks for a negative answer or a remainder', () => {
    /*
     * Both are correct arithmetic and both are cruel to put in front of
     * somebody who has not met them: `7-9=-2` is a true equation and `7÷2=3.5`
     * is a true equation, and a block holding either is a block that reads as
     * broken. Subtraction and division are built backwards from the answer so
     * that neither can happen.
     */
    for (const band of BANDS) {
      const rng = makeRng(11)
      for (let i = 0; i < 400; i++) {
        const sum = trueSum(band, rng)
        expect(sum.claim, `${sum.a} ${sum.sign} ${sum.b}`).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(worksOut(sum)), `${sum.a} ${sum.sign} ${sum.b}`).toBe(true)
      }
    }
  })

  it('keeps the numbers inside the band they belong to', () => {
    for (const band of BANDS) {
      const rng = makeRng(13)
      for (let i = 0; i < 300; i++) {
        const sum = trueSum(band, rng)
        expect(band.signs, `${band.name} used ${sum.sign}`).toContain(sum.sign)
        // `most` is the ceiling on each *side*, so an answer is allowed to be
        // twice it (`19+19=38` in a band that stops at twenty) and a
        // times-table answer is allowed to be the table squared. Both sides
        // themselves stay inside the band.
        expect(Math.max(sum.a, sum.b), `${band.name}: ${sum.a} ${sum.sign} ${sum.b}`)
          .toBeLessThanOrEqual(Math.max(band.most, band.table * band.table))
        expect(sum.claim, `${band.name}: ${sum.a} ${sum.sign} ${sum.b} = ${sum.claim}`)
          .toBeLessThanOrEqual(Math.max(band.most * 2, band.table * band.table))
      }
    }
  })
})

describe('a sum that is wrong', () => {
  it('is wrong, in every band, every time', () => {
    for (const band of BANDS) {
      const rng = makeRng(17)
      for (let i = 0; i < 400; i++) {
        const sum = wrongSum(band, rng)
        expect(isRight(sum), `${sum.a} ${sum.sign} ${sum.b} = ${sum.claim}`).toBe(false)
      }
    }
  })

  it('is wrong by an amount that has to be worked out', () => {
    /*
     * The whole difficulty of this game. `7×8=91` is spotted by anybody who
     * knows seven eights is somewhere near fifty; `7×8=54` has to be done.
     *
     * So: never further out than the answer itself, and never more than
     * twenty-five — and most of them much closer than that.
     */
    for (const band of BANDS) {
      const rng = makeRng(19)
      const offs: number[] = []
      for (let i = 0; i < 400; i++) {
        const sum = wrongSum(band, rng)
        const off = Math.abs(sum.claim - worksOut(sum))
        offs.push(off)
        expect(off, `${sum.a} ${sum.sign} ${sum.b} = ${sum.claim}`)
          .toBeLessThanOrEqual(Math.max(25, worksOut(sum)))
      }
      const middling = offs.sort((x, y) => x - y)[Math.floor(offs.length / 2)]
      expect(middling, `${band.name} is out by ${middling} on average`).toBeLessThanOrEqual(10)
    }
  })

  it('never claims a negative answer', () => {
    for (const band of BANDS) {
      const rng = makeRng(23)
      for (let i = 0; i < 400; i++) {
        expect(wrongSum(band, rng).claim).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('a board', () => {
  it('is the size it says it is', () => {
    expect(newBoard(BANDS[0], 1)).toHaveLength(CELLS)
  })

  it('has about four in ten true on it', () => {
    // Too few and the player is hunting; too many and the board is a row of
    // buttons. Measured over a lot of boards rather than asserted about one.
    let right = 0
    let all = 0
    for (let seed = 1; seed <= 40; seed++) {
      for (const sum of newBoard(BANDS[2], seed)) {
        all += 1
        if (isRight(sum)) right += 1
      }
    }
    const share = right / all
    expect(share, `${(share * 100).toFixed(0)}% of the board is true`).toBeGreaterThan(TRUE_SHARE - 0.08)
    expect(share, `${(share * 100).toFixed(0)}% of the board is true`).toBeLessThan(TRUE_SHARE + 0.08)
  })

  it('always holds something that can be broken', () => {
    /*
     * The one promise this game makes. A board with no true sum on it is a
     * player watching the water come up with no legal move and no way of
     * knowing it is not their fault — the same shape of promise as the gap in
     * the space game and the way through on the road.
     */
    for (const band of BANDS) {
      for (let seed = 1; seed <= 200; seed++) {
        const board = newBoard(band, seed)
        expect(board.filter(isRight).length, `${band.name} seed ${seed}`)
          .toBeGreaterThanOrEqual(LEAST_TRUE)
      }
    }
  })

  it('tops a board up when it has run dry', () => {
    // Built with none, on purpose, which is the case the promise is for.
    const rng = makeRng(5)
    const dry = Array.from({ length: CELLS }, () => wrongSum(BANDS[1], rng))
    expect(dry.filter(isRight)).toHaveLength(0)
    const topped = keepPromise(dry, BANDS[1], rng)
    expect(topped.filter(isRight).length).toBeGreaterThanOrEqual(LEAST_TRUE)
  })

  it('pitches the sums at the rating the rest of the app keeps', () => {
    expect(bandFor(800).name).toBe('ones')
    expect(bandFor(1000).name).toBe('tens')
    expect(bandFor(1100).name).toBe('tables')
    expect(bandFor(1200).name).toBe('sharing')
    expect(bandFor(1500).name).toBe('the lot')
  })

  it('gets harder band by band rather than only bigger', () => {
    // Each band has at least as many ways of asking as the one before it, and
    // the last two are the only ones that share.
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].signs.length, BANDS[i].name).toBeGreaterThanOrEqual(BANDS[i - 1].signs.length)
      expect(BANDS[i].most, BANDS[i].name).toBeGreaterThan(BANDS[i - 1].most)
    }
  })

  it('makes a true one when it is told to', () => {
    const rng = makeRng(3)
    for (let i = 0; i < 100; i++) {
      expect(isRight(newSum(BANDS[2], rng, true))).toBe(true)
      expect(isRight(newSum(BANDS[2], rng, false))).toBe(false)
    }
  })
})
