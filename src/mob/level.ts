/**
 * The swarm: what is in a lane, and how big the numbers on it are.
 *
 * "A simple mob control game where you shoot things coming at you and then
 * there are math operators that let you multiply or get new weapons based on
 * number of hits."
 *
 * So: you stand at the bottom of a lane and send squads up it. A squad is a
 * number — a cluster of little figures, and the number is written on it — and
 * the gates drifting down the lane do arithmetic to it. Pass a squad through
 * `×3` and three times as many come out the other side.
 *
 * The maths is the game rather than a tax on it, and it is the one thing in
 * here that had to be designed rather than copied. A row of gates is two gates
 * side by side and you can only use one of them, so the question every few
 * seconds is *which*: with four in the squad `+6` beats `×2`, and with eight it
 * is the other way round. That crossover is the whole lesson, and it is why
 * `gateRow` refuses to build a row where one side simply wins — a choice with
 * an answer that never changes is not a choice, it is a chore with a correct
 * button.
 *
 * There is no `÷` gate, though it is the obvious fourth one. Dividing a squad
 * of seven by two has to answer something, and every honest answer is either a
 * fraction of a person or a lie about what division does. The app is not going
 * to teach that 7 ÷ 2 = 3.
 */

/**
 * The dice, as little of them as this file needs.
 *
 * Declared here rather than imported so the level rules can be tested without
 * the app's generator machinery, and so the real `Rng` still fits where one is
 * handed in.
 */
export interface Dice {
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

/** How many goes you get, before anything the workshop adds. */
export const LIVES = 3

/** The lane, in the units everything is measured in. */
export const LANE = 10
export const TALL = 18

/** The cart you push along the bottom, and how wide it is. */
export const CART_Y = TALL - 1.1
export const CART_W = 1.7
export const CART_SPEED = 13

/**
 * The line the mob must not cross, a little above the cart.
 *
 * Above rather than level with it: a block that has to touch you to count is a
 * block you can dodge sideways, which turns the last second of a wave into a
 * game of chicken rather than a reason to have shot it sooner.
 */
export const LINE_Y = TALL - 2.3

export const SQUAD_SPEED = 8.2
/** How wide a squad is, for deciding what it flies into. */
export const SQUAD_W = 0.78

export const MOB_W = 2.1
export const MOB_H = 1.25

/**
 * The biggest and smallest a squad can be.
 *
 * The cap is not about difficulty, it is about reading: past a hundred the
 * number stops fitting on the cluster and the cluster stops looking like
 * people. The floor is one, because a gate that can leave you with nothing
 * would mean a shot that was never worth firing.
 */
export const MOST = 99
export const LEAST = 1

export type Op = 'times' | 'plus' | 'minus'

export const SIGN: Record<Op, string> = { times: '×', plus: '+', minus: '−' }

/** What a gate does to a squad that goes through it. */
export const apply = (squad: number, op: Op, by: number): number => {
  const out =
    op === 'times' ? squad * by
    : op === 'plus' ? squad + by
    : squad - by
  return Math.max(LEAST, Math.min(MOST, Math.round(out)))
}

/** Whether a gate is one to aim for or one to swerve round, for the colours. */
export const kind = (op: Op): 'good' | 'bad' => (op === 'minus' ? 'bad' : 'good')

export interface Gate {
  id: number
  op: Op
  by: number
  /** The slice of the lane it covers. */
  from: number
  to: number
  y: number
  /** Counts down after a squad goes through, so the drawing can flash it. */
  flash: number
  /** When it slid in, so the drawing can slide it in. */
  born: number
}

/**
 * Where the gates hang: one row, across the lane, between you and the mob.
 *
 * One row and not a stream of them, which is what this was first built as.
 * Rows arriving every few seconds and drifting down meant six of them in the
 * lane at once and a squad passing through all six — `×2` six times over is a
 * squad of sixty-four and no decision anywhere in it. One row means every
 * single shot goes through exactly one gate, so the question is asked on every
 * shot and the answer is always about the number you have right now.
 */
export const GATE_Y = TALL - 5.2

/** A block of Papa's machines, with how many of them are in it written on. */
export interface Block {
  id: number
  x: number
  y: number
  count: number
  flash: number
}

// --- what you are shooting with ----------------------------------------------

export interface Weapon {
  id: 'popper' | 'twins' | 'fan' | 'cascade'
  /** What it is called when it arrives. */
  name: string
  /** One line about what changed, because a new gun that says nothing is paint. */
  says: string
  /** Hits it takes to get this far. */
  at: number
  /** How many come out per shot. */
  squad: number
  /** Seconds between shots. */
  every: number
  tint: string
}

/**
 * The ladder of guns, unlocked by hits rather than bought.
 *
 * Hits, not waves cleared: the ask was "new weapons based on number of hits",
 * and it is the better rule anyway. It rewards shooting *well* — a squad
 * steered through the right gate takes a whole block with one shot — rather
 * than surviving long enough, which is just the clock.
 */
export const WEAPONS: readonly Weapon[] = [
  {
    id: 'popper',
    name: 'Popper',
    says: 'One at a time. Make it count.',
    at: 0,
    squad: 1,
    every: 0.5,
    tint: '#8fd3ff',
  },
  {
    id: 'twins',
    name: 'Twins',
    says: 'Two out of every shot now.',
    at: 80,
    squad: 2,
    every: 0.46,
    tint: '#9af5c0',
  },
  {
    id: 'fan',
    name: 'Fan',
    says: 'Three, and quicker.',
    at: 350,
    squad: 3,
    every: 0.4,
    tint: '#ffd76a',
  },
  {
    id: 'cascade',
    name: 'Cascade',
    says: 'Five at a time. Go and get them.',
    at: 1000,
    squad: 5,
    every: 0.34,
    tint: '#ff9ae0',
  },
]

export const weaponFor = (hits: number): Weapon => {
  let best = WEAPONS[0]
  for (const weapon of WEAPONS) if (hits >= weapon.at) best = weapon
  return best
}

// --- how hard, and in what order ---------------------------------------------

/** How fast the mob walks down the lane on this level. */
export const mobSpeed = (level: number): number => 0.7 + Math.min(0.3, (level - 1) * 0.025)

/** How long a row of gates hangs there before it is swapped for another. */
export const gateEvery = (level: number): number => Math.max(2.2, 3.8 - (level - 1) * 0.14)

/** How long a row takes to slide in, which the drawing uses and the rules do not. */
export const GATE_SLIDE = 0.3

/**
 * How many blocks a wave is, and how big the counts on them are.
 *
 * Both of these were a third of this at first, and the bot in
 * `balance.test.ts` is why they are not. With four blocks of six in it, a wave
 * was twenty-four machines against the five hundred people a minute of
 * shooting sends up the lane — so every wave was over in a few seconds, the
 * rest of it was spent waiting for the next row to walk in, and taking the
 * worse gate every single time cost three per cent. The gates were decoration.
 * A block has to be big enough to need several squads, or the arithmetic on it
 * cannot matter.
 */
export const waveSize = (level: number): number => Math.min(24, 9 + Math.floor(level * 1.2))
export const blockWorth = (level: number): number => 10 + (level - 1) * 2

/**
 * A row of two gates, and what makes it worth looking at.
 *
 * Three kinds, and the mix is the lesson rather than the decoration.
 *
 * A **close call**, which is most of them: a `times` of t against a `plus` of
 * p, chosen so they cross over at p / (t - 1) between two and four — inside the
 * squad sizes the guns actually fire, which are one, two, three and five. Below
 * the crossover
 * the plus gate sends more up the lane, above it the times gate does. So the
 * right answer with the Popper is the wrong one with the Cascade, and getting a
 * new gun makes you think again rather than stop thinking.
 *
 * A **mile apart**, about a quarter of them: `×4` against `+3`, or `×2`
 * against `+16`. One side is plainly better at any squad size you will ever
 * have. These exist because a row of close calls is a row where it barely
 * matters what you pick — measured: with only close calls, taking the worse
 * gate every single time cost about fifteen per cent, because two numbers that
 * cross over near your squad size are two numbers that are nearly equal near
 * your squad size. The arithmetic has to be worth something when you get it
 * right, and that means some rows where the gap is large.
 *
 * And a **trap**, about one in five from wave two: a good gate and a `minus`.
 * Not a choice and not meant to be — they are there so the gates have to be
 * read rather than driven through, and they are drawn in red.
 */
export function gateRow(level: number, rng: Dice, y: number, nextId: () => number, born = 0): Gate[] {
  const half = LANE / 2
  const times = rng.pick(level < 3 ? [2, 2, 3] : level < 6 ? [2, 3, 3, 4] : [2, 3, 4, 4])
  const roll = rng.next()

  /*
   * Wide rows are commoner on the early waves, which is the opposite of what
   * it looks like it should be. With one in the squad a `×2` gate is almost an
   * insult — two people — and a `+10` beside it is ten; the gap between the two
   * choices is at its widest exactly when the guns are at their smallest. So
   * the early waves are where a wrong choice is most visible, and that is the
   * wave to teach it on. Measured: with close calls at the same rate as later,
   * choosing badly through wave six cost four per cent, which is nothing.
   */
  const wideOdds = level < 5 ? 0.45 : 0.25

  let other: { op: Op; by: number }
  if (level >= 2 && roll < 0.2) {
    other = { op: 'minus', by: rng.int(2, Math.min(9, 2 + Math.floor(level / 2))) }
  } else if (roll < 0.2 + wideOdds) {
    /*
     * A mile apart: either the times gate wins at every size, or the plus does.
     *
     * Both halves have to be built from the crossover rather than from
     * plausible-looking numbers. `×3` against `+3` looks like a walkover and is
     * not: they cross over at one and a half, so the plus gate wins with one in
     * the squad and loses with two. For the times gate to win everywhere the
     * plus has to be smaller than t - 1, which needs a `×3` or better; for the
     * plus gate to win everywhere the crossover has to be past five, which is
     * the biggest squad any gun fires.
     */
    other =
      times >= 3 && rng.next() < 0.5
        ? { op: 'plus', by: times - 2 }
        : { op: 'plus', by: (times - 1) * rng.int(7, 14) }
  } else {
    // The close call, crossing over where the guns are. Two to four, not two
    // to six: a gun fires one, two, three or five, so a crossover at six is a
    // row the plus gate simply wins — the squad never gets that big before a
    // gate. The band has to be the sizes that actually turn up.
    other = { op: 'plus', by: (times - 1) * rng.int(2, 4) }
  }

  const lhs: { op: Op; by: number } = { op: 'times', by: times }
  const [left, right] = rng.next() < 0.5 ? [lhs, other] : [other, lhs]

  return [
    { id: nextId(), op: left.op, by: left.by, from: 0, to: half, y, flash: 0, born },
    { id: nextId(), op: right.op, by: right.by, from: half, to: LANE, y, flash: 0, born },
  ]
}

/**
 * Which gate in a row is the one to take, with this many in the squad.
 *
 * Here rather than in a test because the bot in `balance.test.ts` plays with
 * it, and a bot that works out the answer its own way is a bot proving its own
 * arithmetic rather than the game's.
 */
export function betterGate(row: readonly Gate[], squad: number): Gate {
  let best = row[0]
  for (const gate of row) {
    if (apply(squad, gate.op, gate.by) > apply(squad, best.op, best.by)) best = gate
  }
  return best
}

/**
 * The blocks a wave starts with, laid out in rows above the lane.
 *
 * Rows alternate between three blocks and two, and the two sit in the gaps
 * between the three. That is not only for the look of it: with three in every
 * row and the odd rows merely nudged sideways, every column was within reach of
 * a cart parked in the middle of the lane, and the bot that stands still and
 * never moves cleared a whole wave. Staggering them properly means the lane has
 * to be walked.
 */
export function waveFor(level: number, rng: Dice, nextId: () => number): Block[] {
  const many = waveSize(level)
  const worth = blockWorth(level)
  const edge = MOB_W / 2 + 0.5
  const wide = LANE - edge * 2
  /** Three across the lane, and two in the gaps between them. */
  const threes = [edge, edge + wide / 2, edge + wide]
  const twos = [edge + wide / 4, edge + (wide * 3) / 4]

  const blocks: Block[] = []
  let row = 0
  while (blocks.length < many) {
    const places = row % 2 === 0 ? threes : twos
    for (const x of places) {
      if (blocks.length >= many) break
      blocks.push({
        id: nextId(),
        x,
        // Rows start above the lane and walk in. Spaced well apart so the mob
        // arrives steadily rather than all at once: a wave should be a stretch
        // of pressure, not ten seconds of shooting and fifty of waiting.
        y: -1.4 - row * (MOB_H + 2.4),
        count: Math.max(3, worth + rng.int(-3, 4)),
        flash: 0,
      })
    }
    row++
  }
  return blocks
}

/** What the top of the screen says this wave is for. */
export const waveSays = (level: number): string =>
  level === 1 ? 'Send them up the lane' : `Wave ${level}`
