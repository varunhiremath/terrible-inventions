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
 * Four jobs come along the belt, and between them they cover the three things
 * he likes doing:
 *
 *  - WEIGH: the crate says 45, make it. Decimal into binary.
 *  - NAME: the weights are already on and the crate is a mystery. Binary back
 *    into decimal.
 *  - POWER: the crate says 2⁶ and wants exactly that weight. Powers of two.
 *  - CARRY: the pan has two 8s on it, and the machine takes only one of each.
 *    Tap them together and they become a 16. That is carrying, and it is the
 *    one rule of binary addition that anybody ever gets wrong — here it is a
 *    physical move that visibly does not change what the pan weighs.
 */

/** The dice, as little of them as this file needs. */
export interface Dice {
  next(): number
  int(min: number, max: number): number
}

/**
 * The rack: one weight for each power of two, smallest first.
 *
 * Eight of them, so the machine goes up to 255. Indexed by the power, so
 * `WEIGHTS[5]` is 32 and index five is also bit five — the two are the same
 * thing, which is the whole point of the game and worth keeping true in the
 * code as well.
 */
export const WEIGHTS: readonly number[] = [1, 2, 4, 8, 16, 32, 64, 128]

/** How many goes you get, before anything the workshop adds. */
export const LIVES = 3

export type Job = 'weigh' | 'name' | 'power' | 'carry'

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
  /** Seconds it is on the belt before it goes over the end. */
  seconds: number
}

const empty = (): number[] => WEIGHTS.map(() => 0)

// --- how big the numbers get --------------------------------------------------

/**
 * How many weights are in play on a given level.
 *
 * Four to start with, which is nought to fifteen and the whole of what a
 * beginner should be looking at; eight by the fifth, which is 255. Going
 * straight to eight is how you make a rack of brass look like a wall.
 */
export const bitsFor = (level: number): number => Math.min(WEIGHTS.length, 3 + level)

export const topFor = (level: number): number => Math.pow(2, bitsFor(level)) - 1

/** Which jobs the belt is sending on this level. */
export function jobsFor(level: number): Job[] {
  const jobs: Job[] = ['weigh']
  if (level >= 2) jobs.push('name')
  if (level >= 3) jobs.push('power')
  if (level >= 4) jobs.push('carry')
  return jobs
}

/** How many crates there are, and how long each is on the belt. */
export const cratesFor = (level: number): number => 5 + level
export const secondsFor = (level: number): number => Math.max(14, 30 - level * 2)

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
    // Never the ones. A crate asking for 2⁰ is asking you to pick up the
    // weight nearest your hand.
    const power = rng.int(Math.min(2, bits - 1), bits - 1)
    return { id, job, load: WEIGHTS[power], pan: empty(), power, seconds }
  }

  if (job === 'name') {
    const load = pickLoad(level, rng, 2)
    return { id, job, load, pan: panFor(load), seconds }
  }

  if (job === 'carry') {
    const load = pickLoad(level, rng, 2)
    const pan = panFor(load)
    /*
     * Un-carried a few times, and never below a weight that is not in play on
     * this level: splitting a 2 into two 1s on a four-weight rack is fine, but
     * splitting the rack's smallest weight has nowhere to go.
     */
    const splits = Math.min(3, 1 + Math.floor(level / 3))
    for (let i = 0; i < splits * 3; i++) {
      const bit = rng.int(1, bits - 1)
      if (carriesLeft(pan) >= splits) break
      uncarry(pan, bit)
    }
    if (carriesLeft(pan) === 0) uncarry(pan, Math.max(1, bits - 1))
    return { id, job, load: weighs(pan), pan, seconds }
  }

  const load = pickLoad(level, rng, 2)
  return { id, job: 'weigh', load, pan: empty(), seconds }
}

/** A number on this level worth being asked, with at least `least` bits set. */
function pickLoad(level: number, rng: Dice, least: number): number {
  const top = topFor(level)
  const low = Math.max(3, Math.floor(top / 4))
  for (let tries = 0; tries < 24; tries++) {
    const n = rng.int(low, top)
    if (onBits(n) >= least) return n
  }
  return Math.max(3, Math.min(top, 0b101101 % (top + 1)))
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
    case 'carry': return String(crate.load)
  }
}

/** And what the machine is asking you to do with it. */
export function asks(crate: Crate): string {
  switch (crate.job) {
    case 'weigh': return 'BALANCE IT'
    case 'name': return 'WHAT DOES IT WEIGH?'
    case 'power': return 'ONE WEIGHT ONLY'
    case 'carry': return 'ONE OF EACH — TAP A PAIR'
  }
}
