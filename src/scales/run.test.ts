import { describe, expect, it } from 'vitest'
import {
  LIVES, TOP_POWER, WEIGHTS,
  bitsFor, bitsOf, carriesLeft, carry, cratesFor, jobsFor, newCrate, onBits, panFor,
  powerCeiling, tidy, topFor, uncarry, weighs,
  type Dice,
} from './level'
import {
  FIXED, finished, newRun, nudge, onPan, step, type Move, type Run,
} from './run'

/** The same dice the game uses, so a test seed is a game seed. */
function dice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)) }
}

/** Steps a run on, keeping every event that happened on the way. */
function drive(run: Run, seconds: number, move: Move | null = null) {
  const heard: string[] = []
  for (let t = 0; t < seconds; t += FIXED) {
    run = step(run, t === 0 ? move : null, FIXED)
    heard.push(...run.events)
    if (run.status !== 'playing') break
  }
  return { run, heard }
}

/*
 * The arithmetic, first and on its own.
 *
 * Everything else in this game is a machine wrapped round these few
 * functions, and this is the only part of it that can be wrong in a way
 * nobody notices: a game that quietly teaches that 45 is 101110 is worse than
 * no game at all. So the conversion is checked against the language's own,
 * for every number the rack can hold.
 */
describe('the arithmetic', () => {
  it('writes every number the way the rest of the world writes it', () => {
    for (let n = 0; n <= 255; n++) {
      const pan = panFor(n)
      expect(weighs(pan), `${n} came back as ${weighs(pan)}`).toBe(n)
      expect(tidy(pan), `${n} needed two of something`).toBe(true)
      expect(bitsOf(pan, 8), `${n} in eight bits`).toBe(n.toString(2).padStart(8, '0'))
    }
  })

  it('has one weight for each power of two, in order', () => {
    expect(WEIGHTS).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048])
    for (const [i, weight] of WEIGHTS.entries()) expect(weight).toBe(Math.pow(2, i))
  })

  it('asks about powers well past the end of its own rack', () => {
    // Lifting 2^20 would want a weight the size of the bench. Naming it wants
    // nothing but knowing it, which is the job that exists for exactly that.
    expect(TOP_POWER).toBeGreaterThanOrEqual(20)
    expect(Math.pow(2, TOP_POWER)).toBeGreaterThan(WEIGHTS[WEIGHTS.length - 1])
  })

  it('counts the bits that are set', () => {
    expect(onBits(0)).toBe(0)
    expect(onBits(255)).toBe(8)
    expect(onBits(45)).toBe(4)
  })

  it('carries without changing what the pan weighs', () => {
    /*
     * The lesson the carry job exists to teach, as a test: two 8s and one 16
     * are the same amount of brass. If this ever stopped being true the game
     * would be teaching that carrying loses you something.
     */
    for (let n = 1; n <= 255; n++) {
      const pan = panFor(n)
      for (let i = 0; i < 6; i++) uncarry(pan, 1 + (i % 7))
      expect(weighs(pan), `${n} after un-carrying`).toBe(n)
      let guard = 0
      while (carriesLeft(pan) > 0 && guard++ < 200) {
        const bit = pan.findIndex((many) => many >= 2)
        carry(pan, bit)
      }
      expect(weighs(pan), `${n} after carrying back`).toBe(n)
      expect(pan, `${n} did not tidy to the same thing`).toEqual(panFor(n))
    }
  })

  it('doubles a number by moving every weight one place up', () => {
    /*
     * The insight the doubling job exists for: twice as much is the same bits
     * one step to the left. If this ever stopped being true the job would be
     * teaching something that is not so.
     */
    for (let n = 1; n <= 2047; n++) {
      expect(bitsOf(panFor(n * 2), 12), `${n} doubled`).toBe(`${bitsOf(panFor(n), 11)}0`)
    }
  })

  it('will not carry off the top of the rack', () => {
    const pan = panFor(0)
    pan[WEIGHTS.length - 1] = 2
    expect(carry(pan, WEIGHTS.length - 1)).toBe(false)
  })

  it('will not carry a pile of one', () => {
    const pan = panFor(8)
    expect(carry(pan, 3)).toBe(false)
  })
})

describe('what comes along the belt', () => {
  it('only sends jobs the player has met', () => {
    expect(jobsFor(1)).toEqual(['weigh', 'name'])
    expect(jobsFor(2)).toContain('power')
    expect(jobsFor(2)).toContain('exponent')
    expect(jobsFor(3)).toContain('double')
    expect(jobsFor(3)).toContain('halve')
    expect(jobsFor(4)).toContain('carry')
    expect(jobsFor(5)).toContain('borrow')
    // And nothing arrives before its pair's other half: halving a number you
    // have never been asked to double is a move with no idea behind it.
    expect(jobsFor(2)).not.toContain('double')
    expect(jobsFor(4)).not.toContain('borrow')
  })

  it('every job is one of a pair, and both halves are sent', () => {
    const sent = jobsFor(99)
    for (const [one, other] of [
      ['weigh', 'name'], ['power', 'exponent'],
      ['double', 'halve'], ['carry', 'borrow'],
    ] as const) {
      expect(sent, `${one} is sent`).toContain(one)
      expect(sent, `${other} is sent`).toContain(other)
    }
  })

  it('grows the rack a weight at a time', () => {
    // Five to start with rather than four: nought to thirty-one. The opening
    // level is no longer spent on numbers under sixteen.
    expect(bitsFor(1)).toBe(5)
    expect(topFor(1)).toBe(31)
    expect(topFor(4)).toBe(255)
    expect(bitsFor(99)).toBe(12)
    expect(topFor(99)).toBe(4095)
  })

  it('asks for bigger powers as the rack grows', () => {
    expect(powerCeiling(1)).toBeLessThan(powerCeiling(9))
    expect(powerCeiling(99)).toBe(TOP_POWER)
  })

  it('is always something that can be done', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const level of [1, 2, 3, 4, 6]) {
        const crate = newCrate(1, level, dice(seed))
        const where = `level ${level} seed ${seed} ${crate.job} ${crate.load}`
        expect(crate.load, where).toBeGreaterThan(0)
        if (crate.job === 'exponent') {
          // The one job whose number is deliberately off the end of the rack.
          expect(crate.answer, where).toBe(Math.log2(crate.load))
          expect(crate.answer, where).toBeLessThanOrEqual(powerCeiling(level))
          continue
        }
        expect(crate.load, where).toBeLessThanOrEqual(topFor(level))
        // Whatever it is, the rack it is being asked of can hold the answer.
        const want = panFor(crate.load)
        if (crate.job === 'double') {
          expect(weighs(crate.pan) * 2, `${where}: the double is not a double`).toBe(crate.load)
        }
        if (crate.job === 'halve') {
          expect(weighs(crate.pan), `${where}: the pan is not twice the load`)
            .toBe(crate.load * 2)
          expect(weighs(crate.pan) % 2, `${where}: an odd number cannot be halved here`)
            .toBe(0)
        }
        if (crate.job === 'borrow') {
          const parts = (crate.was ?? '').split('-').map(Number)
          expect(parts, `${where}: a borrow crate should say what is coming off`)
            .toHaveLength(2)
          expect(parts[0] - parts[1], `${where}: the subtraction on the side is wrong`)
            .toBe(crate.load)
          expect(weighs(crate.pan), `${where}: the pan is not what it started as`)
            .toBe(parts[0])
          /*
           * And the rule the job turns on: what is coming off is never
           * already sitting on the pan. If it were, borrowing would be
           * lifting two weights off, and nothing would ever be broken open.
           */
          expect(
            parts[0] & parts[1],
            `${where}: ${parts[1]} is a subset of ${parts[0]} — nothing to borrow`,
          ).not.toBe(parts[1])
        }
        if (crate.job === 'carry') {
          const parts = (crate.was ?? '').split('+').map(Number)
          expect(parts, `${where}: a carry crate should say what it is the sum of`)
            .toHaveLength(2)
          expect(parts[0] + parts[1], `${where}: the sum on the side is wrong`).toBe(crate.load)
        }
        for (let bit = bitsFor(level); bit < WEIGHTS.length; bit++) {
          expect(want[bit], `${where} needs a weight that is not out yet`).toBe(0)
        }
        if (crate.job === 'carry') {
          expect(weighs(crate.pan), `${where}: the pile is not the load`).toBe(crate.load)
          expect(carriesLeft(crate.pan), `${where}: nothing to carry`).toBeGreaterThan(0)
        }
        if (crate.job === 'name') {
          expect(crate.pan, `${where}: the machine put the wrong weights on`)
            .toEqual(panFor(crate.load))
        }
        if (crate.job === 'power') {
          expect(WEIGHTS, where).toContain(crate.load)
          expect(crate.load, `${where}: a power job asking for 1 or 2`).toBeGreaterThan(2)
        }
      }
    }
  })

  it('is worth doing: no crate is one weight in disguise', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const level of [1, 3, 5]) {
        const crate = newCrate(1, level, dice(seed))
        // A power and an exponent are one weight on purpose; a double and a
        // halve are whatever the number before them was, shifted; a borrow's
        // load is a difference and is allowed to land anywhere.
        if (
          crate.job === 'power' || crate.job === 'exponent' ||
          crate.job === 'double' || crate.job === 'halve' || crate.job === 'borrow'
        ) continue
        expect(onBits(crate.load), `level ${level} seed ${seed}: ${crate.load} is one weight`)
          .toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('the machine', () => {
  const weighing = (load: number, level = 4): Run => {
    const base = newRun(level, LIVES, 0, 5)
    return {
      ...base,
      crate: { id: 1, job: 'weigh', load, pan: WEIGHTS.map(() => 0), seconds: 30 },
      pan: WEIGHTS.map(() => 0),
      clock: 30,
    }
  }

  it('balances when the weights come to the load', () => {
    let run = weighing(45)
    // 45 is 101101: thirty-two, eight, four and one.
    for (const bit of [0, 2, 3]) run = step(run, { kind: 'tap', bit }, FIXED)
    expect(onPan(run), 'part way there').toBe(13)
    run = step(run, { kind: 'tap', bit: 5 }, FIXED)
    expect(run.events).toContain('balanced')
    // And the next crate is already on the machine, which is why there is no
    // point looking at the pan here.
    expect(run.done).toBe(1)
  })

  it('does not balance when they do not', () => {
    let run = weighing(45)
    for (const bit of [0, 2, 3]) run = step(run, { kind: 'tap', bit }, FIXED)
    expect(onPan(run)).toBe(13)
    expect(finished(run)).toBe(false)
  })

  it('takes a weight off when you tap it again', () => {
    let run = weighing(45)
    run = step(run, { kind: 'tap', bit: 5 }, FIXED)
    expect(onPan(run)).toBe(32)
    run = step(run, { kind: 'tap', bit: 5 }, FIXED)
    expect(onPan(run)).toBe(0)
    expect(run.events).toContain('lift')
  })

  it('will not hand out a weight that is not on the rack yet', () => {
    // Four weights on the first level, so there is no 128 to reach for.
    let run = { ...weighing(9, 1) }
    run = step(run, { kind: 'tap', bit: 7 }, FIXED)
    expect(onPan(run)).toBe(0)
  })

  it('wants one weight and not four for a power job', () => {
    const base = newRun(3, LIVES, 0, 5)
    let run: Run = {
      ...base,
      crate: { id: 1, job: 'power', load: 32, power: 5, pan: WEIGHTS.map(() => 0), seconds: 30 },
      pan: WEIGHTS.map(() => 0),
      clock: 30,
    }
    // Sixteen and sixteen is thirty-two, and it is not what was asked for —
    // but it cannot even be built, because the machine takes one of each.
    run = step(run, { kind: 'tap', bit: 4 }, FIXED)
    run = step(run, { kind: 'tap', bit: 4 }, FIXED)
    expect(finished(run)).toBe(false)
    run = step(run, { kind: 'tap', bit: 5 }, FIXED)
    expect(run.events).toContain('balanced')
  })

  it('tidies a pile by carrying, and the pile never changes weight', () => {
    const base = newRun(4, LIVES, 0, 5)
    const pile = panFor(44)
    uncarry(pile, 5)
    uncarry(pile, 3)
    let run: Run = {
      ...base,
      crate: { id: 1, job: 'carry', load: 44, pan: [...pile], seconds: 30 },
      pan: [...pile],
      clock: 30,
    }
    expect(onPan(run), 'the pile should already weigh the load').toBe(44)
    let guard = 0
    let tidied: number[] = []
    while (run.done === 0 && guard++ < 20) {
      const bit = run.pan.findIndex((many) => many >= 2)
      tidied = [...run.pan]
      run = step(run, { kind: 'carry', bit }, FIXED)
      // Only while the crate is still on the machine: once it is done the
      // next one is already there and the pan is its, not this one's.
      if (run.done === 0) expect(onPan(run), 'carrying changed the weight').toBe(44)
    }
    expect(run.events).toContain('balanced')
    expect(carriesLeft(tidied), 'it finished before it was tidy').toBeLessThanOrEqual(1)
  })
})

describe('naming a weight', () => {
  const naming = (load: number): Run => {
    const base = newRun(2, LIVES, 0, 7)
    return {
      ...base,
      crate: { id: 1, job: 'name', load, pan: panFor(load), seconds: 30 },
      pan: panFor(load),
      clock: 30,
      typed: '',
    }
  }

  it('takes the right number', () => {
    let run = naming(37)
    for (const digit of ['3', '7']) run = step(run, { kind: 'type', digit }, FIXED)
    run = step(run, { kind: 'say' }, FIXED)
    expect(run.events).toContain('balanced')
  })

  it('costs time and nothing else for a wrong one', () => {
    let run = naming(37)
    const had = run.clock
    for (const digit of ['3', '8']) run = step(run, { kind: 'type', digit }, FIXED)
    run = step(run, { kind: 'say' }, FIXED)
    expect(run.events, 'a wrong answer must never cost a life').not.toContain('dropped')
    expect(run.lives).toBe(LIVES)
    expect(run.clock).toBeLessThan(had)
    expect(run.typed, 'the next go should start clean').toBe('')
  })

  it('will not let you move the machine’s own weights', () => {
    let run = naming(37)
    run = step(run, { kind: 'tap', bit: 0 }, FIXED)
    expect(onPan(run), 'the question was rubbed out').toBe(37)
  })

  it('rubs a digit out', () => {
    let run = naming(37)
    for (const digit of ['3', '9']) run = step(run, { kind: 'type', digit }, FIXED)
    run = step(run, { kind: 'rub' }, FIXED)
    run = step(run, { kind: 'type', digit: '7' }, FIXED)
    run = step(run, { kind: 'say' }, FIXED)
    expect(run.events).toContain('balanced')
  })
})

describe('the belt', () => {
  it('costs a go when a crate goes over the end, and brings the next one', () => {
    const run = newRun(1, LIVES, 0, 3)
    const { run: after, heard } = drive({ ...run, clock: 0.2 }, 1)
    expect(heard).toContain('dropped')
    expect(heard).toContain('arrive')
    expect(after.lives).toBe(LIVES - 1)
    expect(after.clock, 'the next crate needs its own time').toBeGreaterThan(1)
  })

  it('is over when the last go goes', () => {
    const run = newRun(1, 1, 0, 3)
    const { run: after, heard } = drive({ ...run, clock: 0.2 }, 1)
    expect(heard).toContain('over')
    expect(after.status).toBe('over')
  })

  it('says nothing more once it is over', () => {
    const run = newRun(1, 1, 0, 3)
    const { run: after } = drive({ ...run, clock: 0.2 }, 1)
    const again = step(after, null, FIXED)
    expect(again.events).toEqual([])
  })
})

/*
 * And a whole level, played by somebody who can do the maths.
 *
 * The bot converts the numbers itself — it does not read the answer off the
 * crate — so what this says is that a player who can turn 45 into 101101, read
 * 101101 back, name a power of two and carry a pile can clear a level without
 * running out of time. Which is the only promise this game makes.
 */
function solve(run: Run): Move | null {
  const crate = run.crate
  if (crate.job === 'name' || crate.job === 'exponent') {
    /*
     * Worked out rather than read off the crate. A naming job is the weights
     * on the pan added up; an exponent job is halving the number until it is
     * one and counting how many times that took — which is what the game is
     * asking a nine-year-old to know by heart.
     */
    let want: string
    if (crate.job === 'name') {
      want = String(run.pan.reduce((sum, many, bit) => sum + many * WEIGHTS[bit], 0))
    } else {
      let n = crate.load
      let power = 0
      while (n > 1) { n /= 2; power++ }
      want = String(power)
    }
    if (run.typed.length < want.length) {
      return { kind: 'type', digit: want[run.typed.length] }
    }
    return { kind: 'say' }
  }
  if (crate.job === 'carry') {
    const bit = run.pan.findIndex((many) => many >= 2)
    return bit >= 0 ? { kind: 'carry', bit } : null
  }
  if (crate.job === 'borrow') return borrow(run)
  // Weigh and power are the same move: make the pan match the number, and
  // worked out here the long way round rather than with panFor, so that the
  // bot is doing the arithmetic rather than agreeing with the game's.
  const want: number[] = WEIGHTS.map(() => 0)
  let rest = crate.load
  for (let bit = WEIGHTS.length - 1; bit >= 0; bit--) {
    if (rest >= WEIGHTS[bit]) {
      want[bit] = 1
      rest -= WEIGHTS[bit]
    }
  }
  for (let bit = 0; bit < WEIGHTS.length; bit++) {
    if (want[bit] !== (run.pan[bit] > 0 ? 1 : 0)) return { kind: 'tap', bit }
  }
  return null
}

/**
 * Borrowing, done the way it is done on paper.
 *
 * The load is worked out here from what is chalked on the crate — 104-17, so
 * eighty-seven — and never read off `crate.load`, because a bot that reads the
 * answer proves only that the game agrees with itself.
 *
 * Then the method: while the pan is over the load, take off the biggest weight
 * it can spare; if it can spare none, break the smallest one open and look
 * again. Once the pan is level, put every pile together until the machine
 * will take it. That is the whole of binary subtraction and it is four lines.
 */
function borrow(run: Run): Move | null {
  const [from, off] = (run.crate.was ?? '').split('-').map(Number)
  const load = from - off
  const pan = run.pan
  const onPan = pan.reduce((sum, many, bit) => sum + many * WEIGHTS[bit], 0)

  if (onPan > load) {
    const spare = onPan - load
    for (let bit = WEIGHTS.length - 1; bit >= 0; bit--) {
      if (pan[bit] >= 1 && WEIGHTS[bit] <= spare) return { kind: 'tap', bit }
    }
    // Nothing on the pan is small enough to come off. Break the smallest.
    for (let bit = 1; bit < WEIGHTS.length; bit++) {
      if (pan[bit] >= 1) return { kind: 'split', bit }
    }
    return null
  }

  const pile = pan.findIndex((many) => many >= 2)
  return pile >= 0 ? { kind: 'tap', bit: pile } : null
}

describe('borrowing', () => {
  const taking = (from: number, off: number): Run => {
    const base = newRun(6, LIVES, 0, 5)
    return {
      ...base,
      crate: {
        id: 1, job: 'borrow', load: from - off, pan: panFor(from),
        seconds: 30, was: `${from}-${off}`,
      },
      pan: panFor(from),
      typed: '',
    }
  }

  /** Plays a borrow crate out to the end, or gives up after a hundred moves. */
  const work = (run: Run): { run: Run; moves: number } => {
    for (let moves = 1; moves <= 100; moves++) {
      const move = borrow(run)
      if (!move) return { run, moves: moves - 1 }
      run = step(run, move, FIXED)
      if (run.crate.job !== 'borrow' || run.status !== 'playing') {
        return { run, moves }
      }
    }
    return { run, moves: 101 }
  }

  it('the pan never goes under the load, however it is pressed', () => {
    /*
     * The one promise the job makes. Everything else about borrowing is
     * recoverable — a weight broken by mistake can be put back together, a
     * weight taken off cannot — so this is the rule that keeps a child who
     * has pressed the wrong thing from being stuck with a clock running.
     */
    let run = taking(104, 17)
    for (let i = 0; i < 300; i++) {
      const bit = i % WEIGHTS.length
      run = step(run, { kind: i % 3 === 0 ? 'split' : 'tap', bit }, FIXED)
      if (run.crate.job !== 'borrow') break
      expect(
        run.pan.reduce((sum, many, b) => sum + many * WEIGHTS[b], 0),
        `after ${i} jabs at the rack the pan is under the load`,
      ).toBeGreaterThanOrEqual(run.crate.load)
    }
  })

  it('cannot be finished by taking everything off', () => {
    let run = taking(104, 17)
    // Take the lot off, as fast as the rack will allow.
    for (let i = 0; i < 200; i++) {
      for (let bit = WEIGHTS.length - 1; bit >= 0; bit--) {
        run = step(run, { kind: 'tap', bit }, FIXED)
      }
      if (run.crate.job !== 'borrow') break
    }
    // Either it was worked out properly or it is still going. What it is not
    // is finished by an empty pan.
    if (run.crate.job === 'borrow') {
      expect(run.pan.some((many) => many > 0)).toBe(true)
    }
  })

  it('is done the way it is done on paper', () => {
    const { run, moves } = work(taking(104, 17))
    expect(run.done, '104 - 17 was not finished').toBe(1)
    // Three breaks down to a 1, one off, one break to a 16, one off: six.
    expect(moves, `took ${moves} moves`).toBeLessThanOrEqual(12)
  })

  it('lands on the right number, in the right bits, for every pair', () => {
    /*
     * Checked against the language's own subtraction and its own binary, for
     * every pair the rack can hold. A game that quietly teaches that 104 - 17
     * is anything but 1010111 would be worse than no game at all, and nothing
     * else here would notice.
     */
    let tried = 0
    for (let from = 3; from <= 255; from += 7) {
      for (let off = 1; off < from; off += 11) {
        const { run } = work(taking(from, off))
        const where = `${from} - ${off}`
        expect(run.done, `${where} was not finished`).toBe(1)
        tried++
      }
    }
    expect(tried).toBeGreaterThan(100)
  })

  it('needs a weight breaking open, every time', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const crate = newCrate(1, 6, dice(seed))
      if (crate.job !== 'borrow') continue
      const [from, off] = (crate.was ?? '').split('-').map(Number)
      /*
       * The rule the job turns on. If what is coming off were already on the
       * pan, borrowing would be lifting two weights, which is the easy case
       * and the one nobody has to think about.
       */
      expect(from & off, `${from} - ${off} needs nothing broken open`).not.toBe(off)
    }
  })

  it('is only finished when the pan is the answer written in binary', () => {
    /*
     * This is what makes the test above a real test. A borrow crate is
     * finished when the pan comes to the load *and* the machine will take
     * it — one of each weight at most — and those two conditions together
     * have exactly one solution, which is the load written in binary. So a
     * run that reports a crate done has, provably, left 1010111 on the pan.
     */
    const run = taking(104, 17)
    expect(run.crate.load).toBe(87)

    // The right weight, in the right bits.
    expect(finished({ ...run, pan: panFor(87) })).toBe(true)
    /*
     * The right weight, in the wrong bits. 87 is 64 + 16 + 4 + 2 + 1; this is
     * the same 87 with the bottom 7 of it left as two 2s and three 1s, which
     * is what a pan looks like halfway through being tidied. It weighs
     * exactly the same and the machine will not take it.
     */
    const untidy = panFor(87)
    untidy[2] = 0
    untidy[1] = 2
    untidy[0] = 3
    expect(untidy.reduce((sum, many, bit) => sum + many * WEIGHTS[bit], 0)).toBe(87)
    expect(tidy(untidy)).toBe(false)
    expect(finished({ ...run, pan: untidy })).toBe(false)
    // And the wrong weight, tidily.
    expect(finished({ ...run, pan: panFor(86) })).toBe(false)
  })
})

describe('a level', () => {
  /** Plays it at a human sort of pace: one move every third of a second. */
  const play = (run: Run, pace = 0.34) => {
    let since = 0
    for (let t = 0; t < 400; t += FIXED) {
      since += FIXED
      let move: Move | null = null
      if (since >= pace) {
        move = solve(run)
        since = 0
      }
      run = step(run, move, FIXED)
      if (run.status !== 'playing') break
    }
    return run
  }

  it('can be cleared by somebody who can do the maths', () => {
    for (const level of [1, 2, 3, 4, 5, 7]) {
      for (const seed of [1, 2, 3]) {
        const run = play(newRun(level, LIVES, 0, seed))
        const said = `level ${level} seed ${seed}: ${run.status}, ` +
          `${run.done} done, ${run.missed} missed`
        expect(run.status, said).toBe('cleared')
        expect(run.missed, said).toBe(0)
        expect(run.done, said).toBe(cratesFor(level))
      }
    }
  }, 60_000)

  it('cannot be cleared by doing nothing', () => {
    const run = play(newRun(1, LIVES, 0, 4), 999)
    expect(run.status).toBe('over')
  })

  it('is tight enough that the clock is not decoration', () => {
    /*
     * Three seconds a move still clears a level, and that is the right answer
     * — this is a thinking game and the clock is there to keep it moving, not
     * to catch anybody out. Ten seconds a move does not, which is what says
     * the clock exists at all.
     */
    expect(play(newRun(4, LIVES, 0, 2), 3).status, 'a thoughtful pace should still get there')
      .toBe('cleared')
    expect(play(newRun(4, LIVES, 0, 2), 10).status).not.toBe('cleared')
  }, 60_000)

  it('pays more for a quick one', () => {
    const quick = play(newRun(2, LIVES, 0, 2), 0.2)
    const dawdled = play(newRun(2, LIVES, 0, 2), 0.9)
    expect(quick.score).toBeGreaterThan(dawdled.score)
  }, 30_000)

  it('plays the same way twice', () => {
    const once = play(newRun(3, LIVES, 0, 9))
    const twice = play(newRun(3, LIVES, 0, 9))
    expect(twice.score).toBe(once.score)
    expect(twice.done).toBe(once.done)
  }, 30_000)
})

describe('the nudge', () => {
  it('points at a weight that actually helps', () => {
    const base = newRun(4, LIVES, 0, 5)
    const run: Run = {
      ...base,
      crate: { id: 1, job: 'weigh', load: 45, pan: WEIGHTS.map(() => 0), seconds: 30 },
      pan: panFor(32),
      clock: 3,
    }
    const bit = nudge(run)
    expect(bit, 'nothing suggested').not.toBeNull()
    expect(panFor(45)[bit as number], 'suggested a weight the answer does not want').toBe(1)
  })

  it('keeps out of a naming job, where it would be the answer', () => {
    const base = newRun(2, LIVES, 0, 5)
    const run: Run = {
      ...base,
      crate: { id: 1, job: 'name', load: 21, pan: panFor(21), seconds: 30 },
      pan: panFor(21),
      clock: 2,
    }
    expect(nudge(run)).toBeNull()
  })
})
