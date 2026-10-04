import { describe, expect, it } from 'vitest'
import { EQ, LEAST_FIND, num, op, readLine, sayLine, worksOut, type Token } from './find'

/** Write a line the way it reads, so the tests look like the board. */
function line(said: string): Token[] {
  return said.trim().split(/\s+/).map((bit) => {
    if (bit === '=') return EQ
    if (['+', '-', '×', '÷', '^'].includes(bit)) return op(bit as '+')
    return num(Number(bit))
  })
}

const kindOf = (said: string) => readLine(line(said))?.kind ?? null
const saysOf = (said: string) => readLine(line(said))?.says ?? null

describe('working a line out', () => {
  it('does times before plus, because that is what it means', () => {
    expect(worksOut(line('2 + 3 × 4'))).toBe(14)
    expect(worksOut(line('2 × 3 + 4'))).toBe(10)
    expect(worksOut(line('20 - 2 × 5'))).toBe(10)
  })

  it('does powers before times, and reads them right to left', () => {
    expect(worksOut(line('2 × 3 ^ 2'))).toBe(18)
    // 2^(3^2) = 2^9, not (2^3)^2 = 64. Everybody writes it the first way.
    expect(worksOut(line('2 ^ 3 ^ 2'))).toBe(512)
  })

  it('refuses a line that is not a sum at all', () => {
    expect(worksOut(line('2 +'))).toBe(null)
    expect(worksOut(line('+ 2'))).toBe(null)
    expect(worksOut(line('2 3'))).toBe(null)
    expect(worksOut([])).toBe(null)
  })

  it('refuses to divide by nothing, and refuses a number too big to be on a board', () => {
    expect(worksOut(line('6 ÷ 0'))).toBe(null)
    expect(worksOut(line('99 ^ 99'))).toBe(null)
    expect(worksOut(line('9 ^ 9'))).toBe(null)
  })
})

describe('an equation', () => {
  it('is a find when it is true', () => {
    expect(kindOf('2 + 3 = 5')).toBe('sum')
    expect(kindOf('12 ÷ 4 = 3')).toBe('sum')
    expect(kindOf('7 × 8 = 56')).toBe('sum')
    expect(kindOf('2 + 3 × 4 = 14')).toBe('sum')
  })

  it('is not a find when it is not true', () => {
    expect(kindOf('2 + 3 = 6')).toBe(null)
    expect(kindOf('7 × 8 = 54')).toBe(null)
    // Read left to right this is twenty, which is the mistake it is there to
    // catch. With the precedence the notation actually has, it is fourteen.
    expect(kindOf('2 + 3 × 4 = 20')).toBe(null)
  })

  it('knows a power when it sees one', () => {
    expect(kindOf('2 ^ 3 = 8')).toBe('power')
    expect(kindOf('5 ^ 2 = 25')).toBe('power')
    expect(kindOf('2 ^ 3 = 9')).toBe(null)
  })

  it('will not have a half on the board', () => {
    // `7 ÷ 2 = 3.5` cannot be written on blocks, so it is a near miss and not
    // a find; and `7 ÷ 2 = 3` is simply wrong.
    expect(kindOf('7 ÷ 2 = 3')).toBe(null)
    expect(kindOf('7 ÷ 2 = 4')).toBe(null)
    expect(kindOf('8 ÷ 2 = 4')).toBe('sum')
  })

  it('wants something done, not just something stated', () => {
    // True, and not a find: there is no arithmetic in it.
    expect(kindOf('5 = 5')).toBe(null)
    expect(kindOf('12 = 12')).toBe(null)
  })

  it('wants exactly one equals sign', () => {
    expect(kindOf('2 + 2 = 4 = 4')).toBe(null)
    expect(kindOf('1 + 1 = 2 = 2')).toBe(null)
  })

  it('handles a sum on both sides', () => {
    expect(kindOf('2 + 3 = 1 + 4')).toBe('sum')
    expect(kindOf('2 + 3 = 1 + 5')).toBe(null)
  })
})

describe('a sequence', () => {
  it('knows the ones with names, and calls them by them', () => {
    expect(saysOf('1 4 9 16')).toBe('square numbers')
    expect(saysOf('4 9 16 25 36')).toBe('square numbers')
    expect(saysOf('1 3 6 10')).toBe('triangle numbers')
    expect(saysOf('1 8 27 64')).toBe('cube numbers')
    expect(saysOf('2 3 5 7 11')).toBe('prime numbers')
    expect(saysOf('11 13 17 19')).toBe('prime numbers')
  })

  it('knows a step, up or down', () => {
    expect(saysOf('3 6 9 12')).toBe('up in 3s')
    expect(saysOf('20 15 10 5')).toBe('down in 5s')
    // Four of the same number is not a pattern.
    expect(kindOf('7 7 7 7')).toBe(null)
  })

  it('knows a multiplying one, including halving', () => {
    expect(saysOf('3 6 12 24')).toBe('doubling')
    expect(saysOf('2 6 18 54')).toBe('trebling')
    expect(saysOf('80 40 20 10')).toBe('halving')
  })

  it('knows Fibonacci, and says what it is rather than naming it', () => {
    // A name he does not have yet is not an explanation.
    expect(saysOf('1 1 2 3 5')).toBe('each one is the two before it added up')
    expect(saysOf('2 3 5 8 13')).toBe('each one is the two before it added up')
    expect(kindOf('1 1 2 3 6')).toBe(null)
  })

  it('knows doubling with something added each time', () => {
    expect(saysOf('1 3 7 15 31')).toBe('double it and add 1')
    expect(saysOf('5 9 17 33')).toBe('double it and take 1')
  })

  it('wants four of them before it is a pattern at all', () => {
    // Any three numbers at all can be made to look like a rule.
    expect(kindOf('2 4 8')).toBe(null)
    expect(kindOf('1 4 9')).toBe(null)
    expect(LEAST_FIND).toBe(4)
  })

  it('is nothing at all when the numbers are nothing in particular', () => {
    /*
     * The control, and the one that matters most. Every test above shows the
     * reader saying yes; if it said yes to everything they would all still
     * pass. These are four, five and six numbers with no rule between them.
     */
    expect(kindOf('3 8 2 9')).toBe(null)
    expect(kindOf('7 1 4 6 2')).toBe(null)
    expect(kindOf('12 5 9 3 8 1')).toBe(null)
    expect(kindOf('1 4 9 17')).toBe(null)
    expect(kindOf('2 3 5 7 12')).toBe(null)
  })

  it('names an overlap the way a person would', () => {
    /*
     * Several of these rules catch the same run. 1, 2, 4, 8 is doubling and is
     * also "double it and add nought"; nobody says the second one. 1, 4, 9, 16
     * is square numbers and also has a constant second difference.
     */
    expect(saysOf('1 2 4 8')).toBe('doubling')
    expect(kindOf('1 4 9 16')).toBe('square')
    expect(kindOf('2 4 6 8')).toBe('step')
  })

  it('will not call a line of mixed blocks a sequence', () => {
    expect(kindOf('2 + 4 6')).toBe(null)
    expect(kindOf('1 2 3 =')).toBe(null)
  })
})

describe('reading a line out', () => {
  it('writes it the way it is on the board', () => {
    expect(sayLine(line('2 + 3 = 5'))).toBe('2 + 3 = 5')
    expect(sayLine(line('1 1 2 3 5'))).toBe('1 1 2 3 5')
  })

  it('says how long the find was, which is what it is worth', () => {
    expect(readLine(line('2 + 3 = 5'))?.length).toBe(5)
    expect(readLine(line('1 1 2 3 5 8'))?.length).toBe(6)
  })
})
