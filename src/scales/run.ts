/**
 * The Scales, simulated.
 *
 * Pure and fixed-step like every other game here. The machine holds one crate
 * at a time; the belt behind it holds the rest. Everything the player does is
 * one of three moves — put a weight on, take it off, or tap a pile to carry —
 * and the fourth, typing a number, only exists for the job that asks for one.
 *
 * The one rule the whole thing hangs on: *the machine takes one of each weight
 * at most*. That is not an arbitrary restriction, it is what makes the rack a
 * binary number rather than a bag of brass, and it is why carrying is a move
 * you make rather than a rule you are told.
 */
import {
  LIVES, WEIGHTS,
  bitsFor, carriesLeft, carry, cratesFor, newCrate, panFor, split, tidy, weighs,
  type Crate, type Dice,
} from './level'

export const FIXED = 1 / 60

export type ScalesEvent =
  | 'place' | 'lift' | 'carried' | 'split' | 'balanced' | 'wrong' | 'arrive'
  | 'dropped' | 'cleared' | 'over'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, like every other game in here:
 * `events.test.ts` reads this list and the event union together, because an
 * event missing from the list is never the loudest thing in any frame and so
 * is silent for ever with nothing to notice.
 */
export const LOUDEST: readonly ScalesEvent[] = [
  'over', 'cleared', 'dropped', 'balanced', 'wrong', 'carried', 'split', 'arrive',
  'place', 'lift',
]

export type Status = 'playing' | 'cleared' | 'over'

export interface Run {
  level: number
  status: Status
  score: number
  lives: number
  /** The crate on the machine, and how many are still to come after it. */
  crate: Crate
  left: number
  /** Seconds left before this one goes over the end of the belt. */
  clock: number
  /** What is on the pan: a count for each weight. */
  pan: number[]
  /** What has been typed, for the jobs that want a number. */
  typed: string
  /** How many crates have been done, and how many went over the end. */
  done: number
  missed: number
  /** The beam's angle, which lags behind the weight so it swings. */
  beam: number
  beamFor: number
  /** Seconds of green glow after a crate is finished, for the screen. */
  cheer: number
  /** And of wobble after a wrong number. */
  wobble: number
  events: ScalesEvent[]
  seed: number
  nextId: number
}

// --- the dice ----------------------------------------------------------------

function makeDice(seed: number): Dice {
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

const stir = (seed: number): number => (seed * 1103515245 + 12345) >>> 0

// --- starting -----------------------------------------------------------------

export function newRun(level = 1, lives = LIVES, score = 0, seed = 1): Run {
  const dice = makeDice(seed)
  const crate = newCrate(1, level, dice)
  return {
    level,
    status: 'playing',
    score,
    lives,
    crate,
    left: cratesFor(level) - 1,
    clock: crate.seconds,
    pan: [...crate.pan],
    typed: '',
    done: 0,
    missed: 0,
    beam: 0,
    beamFor: 0,
    cheer: 0,
    wobble: 0,
    events: [],
    seed: stir(seed),
    nextId: 2,
  }
}

export const nextLevel = (run: Run): Run =>
  newRun(run.level + 1, run.lives, run.score, run.seed + 1)

/** Carrying on after a dropped crate. */
export const serve = (run: Run): Run => ({ ...run, status: 'playing', events: [] })

// --- what the player can do ----------------------------------------------------

export type Move =
  /** Put a weight on the pan, or take it off again. */
  | { kind: 'tap'; bit: number }
  /** Tap a pile of two or more, which carries one up. */
  | { kind: 'carry'; bit: number }
  /** Break one weight into two of the next one down. Borrowing. */
  | { kind: 'split'; bit: number }
  /** Type a digit, rub one out, or say that is the answer. */
  | { kind: 'type'; digit: string }
  | { kind: 'rub' }
  | { kind: 'say' }

/**
 * Whether this crate is finished.
 *
 * Three different questions, and they are different on purpose:
 *
 *  - a weigh is done when the pan comes to the load, which is the balance
 *    being level;
 *  - a power is done when the pan holds that weight and nothing else, because
 *    "which weight is 2⁶" has one answer and it is not "64 made of smaller
 *    ones";
 *  - a carry is done when the machine will accept the pile, which is when
 *    there is one of each at most — and note that it is *already* the right
 *    weight the whole time. Carrying does not change what the pan weighs, and
 *    seeing that is most of the lesson;
 *  - a borrow is done when the pan has come *down* to the load and the
 *    machine will accept it, which is the only job here where both halves of
 *    that sentence are work.
 */
export function finished(run: Run): boolean {
  const { crate, pan } = run
  // The two that are finished by typing rather than by lifting.
  if (crate.job === 'name' || crate.job === 'exponent') return false
  if (!tidy(pan)) return false
  if (crate.job === 'power') {
    return pan[crate.power ?? 0] === 1 && weighs(pan) === crate.load
  }
  // Everything else is the same question in the end: does the pan come to
  // what the crate says it should, with one of each weight at most.
  return weighs(pan) === crate.load
}

/** Whether this crate is answered with the number pad rather than the rack. */
export const typedAt = (run: Run): boolean =>
  run.crate.job === 'name' || run.crate.job === 'exponent'

/**
 * Whether the weights on the pan belong to the machine rather than to you.
 *
 * On these jobs the pan is the question. A naming crate's weights *are* the
 * thing being asked, so moving them would be rubbing the question out; a
 * carry crate's pile is the machine's arithmetic and the only thing you may
 * do to it is tidy it; and a borrow crate's load is what you are taking a
 * number off, so you may break it up and lift pieces off but you may never
 * add brass that the crate did not bring.
 */
export const locked = (job: Crate['job']): boolean =>
  job === 'name' || job === 'exponent' || job === 'carry' || job === 'borrow'

/** What the machine would say the pan weighs, out loud, for the screen. */
export const onPan = (run: Run): number => weighs(run.pan)

/** How far out the pan is: positive is too heavy. */
export const outBy = (run: Run): number => weighs(run.pan) - run.crate.load

// --- a step ---------------------------------------------------------------------

export function step(run: Run, move: Move | null, dt: number): Run {
  if (run.status !== 'playing') return { ...run, events: [] }

  const next: Run = { ...run, pan: [...run.pan], events: [] }
  next.clock = Math.max(0, next.clock - dt)
  next.cheer = Math.max(0, next.cheer - dt)
  next.wobble = Math.max(0, next.wobble - dt)

  if (move) apply(next, move)

  /*
   * The beam swings towards where the weight says it should be rather than
   * snapping to it. A balance that jumps is a bar chart; the swing is the
   * whole reason the thing reads as a pair of scales, and the overshoot at the
   * end of a correct answer is most of the pleasure in getting one right.
   */
  const out = weighs(next.pan) - next.crate.load
  next.beamFor = Math.max(-1, Math.min(1, out / Math.max(8, next.crate.load * 0.6)))
  const pull = (next.beamFor - next.beam) * Math.min(1, dt * 7)
  next.beam += pull + (next.wobble > 0 ? Math.sin(next.wobble * 40) * 0.05 : 0)

  // Finished?
  if (finished(next)) {
    done(next)
  } else if (next.clock <= 0) {
    // Over the end of the belt. It costs a go, and nothing is said about
    // whose fault that was.
    next.lives -= 1
    next.missed += 1
    next.events.push('dropped')
    if (next.lives <= 0) {
      next.status = 'over'
      next.events.push('over')
    } else {
      bringOn(next)
    }
  }

  return next
}

/** One move by the player. */
function apply(run: Run, move: Move): void {
  const crate = run.crate

  if (move.kind === 'tap') {
    if (move.bit < 0 || move.bit >= bitsFor(run.level)) return
    if (crate.job === 'borrow') {
      borrowTap(run, move.bit)
      return
    }
    if (locked(crate.job)) return
    if (run.pan[move.bit] > 0) {
      run.pan[move.bit] = 0
      run.events.push('lift')
    } else {
      run.pan[move.bit] = 1
      run.events.push('place')
    }
    return
  }

  if (move.kind === 'carry') {
    if (carry(run.pan, move.bit)) run.events.push('carried')
    return
  }

  if (move.kind === 'split') {
    /*
     * Only ever on the job it exists for. Anywhere else the pan is yours to
     * build and breaking a weight open would be a way of getting two of
     * something, which is the one thing the machine does not allow.
     */
    if (crate.job !== 'borrow') return
    if (move.bit < 0 || move.bit >= bitsFor(run.level)) return
    if (split(run.pan, move.bit)) run.events.push('split')
    return
  }

  if (move.kind === 'type') {
    if (crate.job !== 'name' && crate.job !== 'exponent') return
    // Long enough for the biggest thing the machine can be holding, which is
    // four thousand and ninety-five.
    if (run.typed.length >= 4) return
    if (!/^[0-9]$/.test(move.digit)) return
    run.typed = (run.typed === '0' ? '' : run.typed) + move.digit
    return
  }

  if (move.kind === 'rub') {
    run.typed = run.typed.slice(0, -1)
    return
  }

  if (move.kind === 'say') {
    if ((crate.job !== 'name' && crate.job !== 'exponent') || run.typed === '') return
    if (Number(run.typed) === (crate.answer ?? crate.load)) {
      done(run)
    } else {
      /*
       * A wrong number costs time and nothing else. No life, no buzzer, no
       * telling off — the beam wobbles and the number you typed is rubbed out
       * so the next go starts clean. This is a game about trying one, seeing
       * the beam, and trying the next.
       */
      run.typed = ''
      run.wobble = 0.5
      run.clock = Math.max(0, run.clock - 2)
      run.events.push('wrong')
    }
  }
}

/**
 * Taking one weight off a borrow crate.
 *
 * The first version of this did the clever thing: one button, and a weight
 * that would not come off broke in two instead. It read well and it was
 * wrong, because it made the machine choose. Working 104 - 17 the way it is
 * worked on paper means breaking the 8 open to find a 1 — and the 8 was
 * affordable, so the clever button lifted it instead and the pencil-and-paper
 * method was the one thing the machine would not let you do. A rule that
 * forbids the correct method is not a harder game.
 *
 * So the two moves are two moves, named on the screen, and this is the one
 * that takes brass off the pan:
 *
 *  - one weight comes off, whether it is sitting on its own or in a pile. It
 *    has to come off a pile too: breaking an 8 open leaves two 4s, and taking
 *    one of them away is the next line of the sum. A machine that could only
 *    lift single weights would break the 8 and then refuse to use it;
 *  - but only if the pan can spare it;
 *  - and a pile the pan cannot spare goes together instead, which is the only
 *    moment carrying helps on this job and is the gesture a carry crate has
 *    already taught.
 *
 * "If the pan can spare it" is what makes the job safe, and between them
 * those three lines mean there is always a way through from wherever a player
 * has got to. While the pan is over the load, breaking the smallest weight
 * again and again always reaches something small enough to take off, and
 * every one that comes off brings the pan nearer. Once the pan is level,
 * nothing can come off at all, so every pile goes together and the pan tidies
 * itself into the answer written in binary. A machine that let you lift too
 * much would strand a child with a pan that cannot be rebuilt and a clock
 * running, and nothing on the screen would say why.
 */
function borrowTap(run: Run, bit: number): void {
  const many = run.pan[bit]
  if (many < 1) return

  if (weighs(run.pan) - WEIGHTS[bit] >= run.crate.load) {
    run.pan[bit] = many - 1
    run.events.push('lift')
    return
  }
  if (many >= 2) {
    if (carry(run.pan, bit)) run.events.push('carried')
    return
  }
  // More than the pan can spare. Nothing happens, and the beam says so rather
  // than the screen going quiet on a child who has just pressed something.
  run.wobble = 0.35
  run.events.push('wrong')
}

/**
 * Whether taking this weight off would leave the pan short.
 *
 * Asked by the screen as well as the model, so the button can say it before
 * it is pressed: a weight that will not come off is exactly the one that has
 * to be broken open, and leaving a child to find that out by pressing things
 * is a worse game rather than a harder one.
 */
export const wontComeOff = (run: Run, bit: number): boolean =>
  run.crate.job === 'borrow' && run.pan[bit] >= 1 &&
  weighs(run.pan) - WEIGHTS[bit] < run.crate.load

/** A crate finished: paid for, cheered, and the next one brought on. */
function done(run: Run): void {
  run.done += 1
  run.cheer = 0.9
  // Quickly is worth more, but never so much that taking your time loses.
  run.score += 60 + Math.round(run.clock) * 4
  run.events.push('balanced')
  if (run.left <= 0) {
    run.status = 'cleared'
    run.score += 250 + (run.missed === 0 ? 250 : 0)
    run.events.push('cleared')
    return
  }
  bringOn(run)
}

/** The next crate along. */
function bringOn(run: Run): void {
  const dice = makeDice(run.seed)
  run.seed = stir(run.seed)
  const crate = newCrate(run.nextId++, run.level, dice)
  run.crate = crate
  run.left -= 1
  run.clock = crate.seconds
  run.pan = [...crate.pan]
  run.typed = ''
  run.events.push('arrive')
}

// --- what the screen asks ---------------------------------------------------------

/** How many carries this pile still needs, for the hint line. */
export const stillToCarry = (run: Run): number => carriesLeft(run.pan)

/**
 * The weights that would finish a weigh job from here.
 *
 * Only ever shown when the clock is nearly out, and only one of them: a nudge
 * towards the next weight to reach for, not the answer handed over. Being
 * stuck and being told nothing is how a nine-year-old decides a game is not
 * for him.
 */
export function nudge(run: Run): number | null {
  // A borrow crate is nudged by nothing: the hint would be "put this weight
  // on", and putting weights on is the one move the job does not have.
  if (typedAt(run) || run.crate.job === 'carry' || run.crate.job === 'borrow') return null
  const want = panFor(run.crate.load)
  for (let bit = WEIGHTS.length - 1; bit >= 0; bit--) {
    if (want[bit] !== (run.pan[bit] > 0 ? 1 : 0)) return bit
  }
  return null
}
