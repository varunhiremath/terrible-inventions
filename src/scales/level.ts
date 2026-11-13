/**
 * The Scales: what is on the machine, and what it wants.
 *
 * "He is getting good with binary numbers — converting decimal to binary, and
 * powers of two."
 *
 * So: a weighing machine, and a rack of brass weights marked 1, 2, 4, 8, 16,
 * 32, 64, 128. One of each, and no more than one. Crates come along the belt
 * and you balance them.
 *
 * That rack *is* a binary number. Which weights are on the pan is which bits
 * are set, biggest on the left, exactly as it is written down — so converting
 * forty-five into 101101 stops being a procedure to remember and becomes
 * something you do with your hands, with a beam that tips to tell you which
 * way you are wrong. Nothing here asks "what is 45 in binary"; the machine
 * asks it by existing.
 *
 * Eight jobs come along the belt, in four pairs, and each pair is one idea
 * read in both directions — which is the whole shape of the game:
 *
 *  - WEIGH / NAME: the crate says 45, make it; or the weights are already on
 *    and the crate is a mystery. Decimal into binary, and back out again.
 *  - POWER / EXPONENT: the crate says 2⁶ and wants that one weight; or it
 *    says 16384 and wants the power typed. The second is the only job here
 *    not limited by what the rack can lift, so it goes to 2²⁰.
 *  - DOUBLE / HALVE: the pan arrives with 87 on it and the crate says ×2, or
 *    with 174 on it and the crate says ÷2. Every weight takes one step left,
 *    or one step right. Place value, with handles on it.
 *  - CARRY / BORROW: the pan has two 8s on it and the machine takes one of
 *    each, so tap them together and they become a 16. Or the crate says
 *    104−17 and arrives with 104 on it, and seventeen is not on the pan to
 *    lift — so a weight has to be broken into two of the next one down until
 *    it is. Binary addition and binary subtraction, both as moves you make
 *    with a thumb rather than rules you are told, and in both of them the pan
 *    visibly goes on weighing the same while you work.
 */

/** The dice, as little of them as this file needs. */
export interface Dice {
  next(): number
  int(min: number, max: number): number
}

/**
 * The rack: one weight for each power of two, smallest first.
 *
 * Twelve of them, so the machine goes up to 4095. It was eight, and eight was
 * too few: "he is easily able to compute powers of two up to 2^20, so these
 * are too easy." Twelve is as many buttons as a phone will take without the
 * numbers on them going unreadable — the powers past the end of the rack are
 * still asked about, by the job that wants the exponent typed rather than
 * lifted, and that one goes to 2^20.
 *
 * Indexed by the power, so `WEIGHTS[5]` is 32 and index five is also bit
 * five — the two are the same thing, which is the whole point of the game and
 * worth keeping true in the code as well.
 */
export const WEIGHTS: readonly number[] = [
  1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048,
]

/**
 * The biggest power the machine ever asks about, which is well past its own
 * rack. Lifting 2^20 would need a weight the size of the bench; naming it
 * needs nothing but knowing it.
 */
export const TOP_POWER = 20

/** How many goes you get, before anything the workshop adds. */
export const LIVES = 3

export type Job =
  | 'weigh' | 'name' | 'power' | 'exponent'
  | 'double' | 'halve' | 'carry' | 'borrow'

export interface Crate {
  id: number
  job: Job
  /** What it weighs. Always what the pan has to come to. */
  load: number
  /**
   * What is already on the pan when it arrives, as a count for each weight.
   *
   * Empty for a weigh or a power. For a name, one of each of the right ones —
   * the machine has done the weighing and wants the number. For a carry, a
   * pile with duplicates in it that adds up to the load.
   */
  pan: number[]
  /** For a power job: which power of two is wanted. */
  power?: number
  /**
   * What a typed answer has to be, where that is not the load.
   *
   * A naming job wants the load back, so it leaves this alone. An exponent
   * job shows 4096 and wants 12, which is a different number entirely.
   */
  answer?: number
  /** What the crate says it started as, for the jobs that change it. */
  was?: string
  /** Seconds it is on the belt before it goes over the end. */
  seconds: number
}

const empty = (): number[] => WEIGHTS.map(() => 0)

// --- how big the numbers get --------------------------------------------------

/**
 * How many weights are in play on a given level.
 *
 * Five to start with, which is nought to thirty-one, and the whole rack by
 * the eighth. It used to start at four — nought to fifteen — and four is the
 * right opening for somebody meeting a rack of brass for the first time, not
 * for somebody who has already had the game for a term. Grade five does not
 * need a level spent on numbers under sixteen.
 */
export const bitsFor = (level: number): number => Math.min(WEIGHTS.length, 4 + level)

/** The biggest exponent worth asking for on this level. */
export const powerCeiling = (level: number): number =>
  Math.min(TOP_POWER, 8 + level)

export const topFor = (level: number): number => Math.pow(2, bitsFor(level)) - 1

/**
 * Which jobs the belt is sending on this level.
 *
 * Every one of them arrives a level earlier than it used to, and the two new
 * ones are at the end. A ladder pitched so that the interesting jobs start on
 * level five is a ladder most of whose rungs are spent waiting.
 */
export function jobsFor(level: number): Job[] {
  const jobs: Job[] = ['weigh']
  if (level >= 1) jobs.push('name')
  if (level >= 2) jobs.push('power', 'exponent')
  if (level >= 3) jobs.push('double', 'halve')
  if (level >= 4) jobs.push('carry')
  if (level >= 5) jobs.push('borrow')
  return jobs
}

/** How many crates there are, and how long each is on the belt. */
export const cratesFor = (level: number): number => 6 + level
export const secondsFor = (level: number): number => Math.max(11, 26 - level * 2)

// --- reading and writing numbers ----------------------------------------------

/** What a pan weighs. */
export const weighs = (pan: readonly number[]): number =>
  pan.reduce((sum, many, bit) => sum + many * WEIGHTS[bit], 0)

/** A number as a pan: one of each weight it needs. */
export function panFor(n: number): number[] {
  const pan = empty()
  for (let bit = WEIGHTS.length - 1; bit >= 0; bit--) {
    if (n >= WEIGHTS[bit]) {
      pan[bit] = 1
      n -= WEIGHTS[bit]
    }
  }
  return pan
}

/** The bits, as a string, biggest first — what the board writes underneath. */
export function bitsOf(pan: readonly number[], bits: number): string {
  let out = ''
  for (let bit = bits - 1; bit >= 0; bit--) out += pan[bit] > 0 ? '1' : '0'
  return out
}

/** Whether the machine will accept this pan: one of each weight at most. */
export const tidy = (pan: readonly number[]): boolean => pan.every((many) => many <= 1)

/**
 * Taking one weight off a pile and putting two of the next size down on it.
 *
 * The opposite of carrying, and how a carry job is built: start from the
 * answer and un-carry it a few times, so the pile on the pan is always worth
 * exactly what the crate says and always tidies up to the same bits.
 */
export function uncarry(pan: number[], bit: number): boolean {
  if (bit <= 0 || pan[bit] < 1) return false
  pan[bit] -= 1
  pan[bit - 1] += 2
  return true
}

/**
 * Splitting, which is the same move with the player's hands on it.
 *
 * Carrying is how a pile is tidied up; splitting is how a weight that will
 * not come off the pan whole is broken into two that will. They are the same
 * arithmetic read in opposite directions, and borrowing in binary is nothing
 * but this move done until the weight you want to take off is on the pan.
 */
export const split = uncarry

/** And carrying: two of one size become one of the next. */
export function carry(pan: number[], bit: number): boolean {
  if (pan[bit] < 2 || bit >= WEIGHTS.length - 1) return false
  pan[bit] -= 2
  pan[bit + 1] += 1
  return true
}

/** How many carries a pile still needs. Nought means the machine is happy. */
export const carriesLeft = (pan: readonly number[]): number =>
  pan.reduce((sum, many) => sum + Math.max(0, many - 1), 0)

// --- what comes along the belt -------------------------------------------------

/**
 * One crate.
 *
 * The numbers are chosen to be worth doing. A weigh of 32 is one weight and
 * teaches nothing, so a weigh wants at least two bits set; a name of 7 is
 * read off without thinking, so it wants a gap in it. Neither rule is
 * difficulty for its own sake — they are what stops a round being a row of
 * freebies, which a nine-year-old spots immediately.
 */
export function newCrate(id: number, level: number, rng: Dice): Crate {
  const jobs = jobsFor(level)
  const job = jobs[rng.int(0, jobs.length - 1)]
  const bits = bitsFor(level)
  const seconds = secondsFor(level)

  if (job === 'power') {
    /*
     * Never the small ones. A crate asking for 2³ on a rack that goes to 2048
     * is asking you to pick up the weight nearest your hand, so the floor
     * climbs with the rack and only the top half of it is ever asked for.
     */
    const low = Math.max(3, bits - 5)
    const power = rng.int(Math.min(low, bits - 1), bits - 1)
    return { id, job, load: WEIGHTS[power], pan: empty(), power, seconds }
  }

  if (job === 'exponent') {
    /*
     * The other way round, and the one job on the machine that is not limited
     * by what the rack can lift: it shows a number and wants the power. Which
     * is how 2^20 gets asked about on a bench that only goes to 2048.
     */
    const power = rng.int(4, powerCeiling(level))
    return {
      id, job, load: Math.pow(2, power), pan: empty(), power, answer: power, seconds,
    }
  }

  if (job === 'name') {
    const load = pickLoad(level, rng, 2)
    return { id, job, load, pan: panFor(load), seconds }
  }

  if (job === 'double') {
    /*
     * Doubling, which in binary is every weight taking one step to the left.
     * The numbers are big enough by the time this job turns up that clearing
     * the pan and starting again is slower than seeing the shift, which is
     * the whole reason the job exists.
     */
    const was = pickLoad(level, rng, 2, Math.floor(topFor(level) / 2))
    return {
      id, job, load: was * 2, pan: panFor(was), seconds, was: String(was),
    }
  }

  if (job === 'halve') {
    /*
     * And back the other way: every weight takes one step to the right. The
     * load has to be even for that to land on the rack at all, which is
     * itself the thing worth noticing — an odd number cannot be halved on a
     * bench of whole weights, and the belt never sends one that cannot.
     */
    const half = pickLoad(level, rng, 2, Math.floor(topFor(level) / 2))
    const was = half * 2
    return {
      id, job, load: half, pan: panFor(was), seconds, was: String(was),
    }
  }

  if (job === 'borrow') {
    /*
     * Taking a number off the pan, which is the half of binary arithmetic the
     * machine had no move for.
     *
     * The crate says 104-17 and arrives with 104 on the pan. Seventeen is
     * 16+1 and the pan holds 64, 32 and 8, so there is nothing to lift: you
     * have to break a weight into two of the next one down until the ones you
     * want are there. That is borrowing, and here it is a thing you do with a
     * thumb rather than a row of crossings-out.
     *
     * The amount taken off is deliberately never a subset of what is on the
     * pan. If it were, the whole job would be lifting two weights off and
     * nobody would ever have to split anything.
     */
    const from = pickLoad(level, rng, 2)
    const off = pickBorrow(from, level, rng)
    return {
      id, job, load: from - off, pan: panFor(from), seconds,
      was: `${from}-${off}`,
    }
  }

  if (job === 'carry') {
    /*
     * A carry crate is an addition that has been poured onto the pan without
     * being tidied up — so it says what it was the sum of. Tidying it *is*
     * adding the two numbers in binary, and saying so on the side of the
     * crate is the difference between a puzzle and a lesson.
     */
    const load = pickLoad(level, rng, 2)
    const pan = panFor(load)
    const splits = Math.min(4, 1 + Math.floor(level / 3))
    for (let i = 0; i < splits * 3; i++) {
      const bit = rng.int(1, bits - 1)
      if (carriesLeft(pan) >= splits) break
      uncarry(pan, bit)
    }
    if (carriesLeft(pan) === 0) uncarry(pan, Math.max(1, bits - 1))
    const total = weighs(pan)
    const half = rng.int(1, Math.max(1, total - 1))
    return {
      id, job, load: total, pan, seconds, was: `${half}+${total - half}`,
    }
  }

  const load = pickLoad(level, rng, 2)
  return { id, job: 'weigh', load, pan: empty(), seconds }
}

/** A number on this level worth being asked, with at least `least` bits set. */
function pickLoad(level: number, rng: Dice, least: number, ceiling?: number): number {
  const top = Math.min(topFor(level), ceiling ?? topFor(level))
  const low = Math.max(3, Math.floor(top / 4))
  for (let tries = 0; tries < 24; tries++) {
    const n = rng.int(low, top)
    if (onBits(n) >= least) return n
  }
  return Math.max(3, Math.min(top, 0b101101 % (top + 1)))
}

/**
 * How much to take off a borrow crate.
 *
 * Two conditions, and the second is the job. It has to leave something
 * behind, and it must not be a subset of the bits already on the pan —
 * because `104 - 8` is answered by lifting the 8 off and learning nothing,
 * while `104 - 17` cannot be answered without breaking something open.
 */
function pickBorrow(from: number, level: number, rng: Dice): number {
  const bits = bitsFor(level)
  for (let tries = 0; tries < 48; tries++) {
    const off = rng.int(1, from - 1)
    if ((from & off) !== off && onBits(off) >= 1 && off < from) return off
  }
  // Whatever happens, something that is not already on the pan: the lowest
  // bit the pan has not got, which is never a subset of it by construction.
  for (let bit = 0; bit < bits; bit++) {
    const w = WEIGHTS[bit]
    if ((from & w) === 0 && w < from) return w
  }
  return 1
}

/** How many bits are set. */
export const onBits = (n: number): number => {
  let many = 0
  while (n > 0) {
    many += n & 1
    n >>= 1
  }
  return many
}

/** What the crate says on the side of it. */
export function saysOn(crate: Crate): string {
  switch (crate.job) {
    case 'weigh': return String(crate.load)
    case 'name': return '?'
    case 'power': return `2^${crate.power}`
    case 'exponent': return String(crate.load)
    case 'double': return `${crate.was} x2`
    case 'halve': return `${crate.was} /2`
    case 'carry': return crate.was ?? String(crate.load)
    case 'borrow': return crate.was ?? String(crate.load)
  }
}

/** And what the machine is asking you to do with it. */
export function asks(crate: Crate): string {
  switch (crate.job) {
    case 'weigh': return 'BALANCE IT'
    case 'name': return 'WHAT DOES IT WEIGH?'
    case 'power': return 'ONE WEIGHT ONLY'
    case 'exponent': return 'WHICH POWER OF TWO IS IT?'
    case 'double': return 'DOUBLE IT'
    case 'halve': return 'HALVE IT'
    case 'carry': return 'ADD IT UP — TAP A PAIR'
    case 'borrow': return 'TAKE IT OFF'
  }
}
