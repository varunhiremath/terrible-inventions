/**
 * The swarm: what is in the lane, and how big the numbers on it are.
 *
 * "A crowd of monsters walking towards you and you shoot at them. You are
 * single player and your attack goes up by upgrading weapons, and there will be
 * multiple weapons coming down that may require different number of hits. So
 * you have to decide which one you wanna target based on how much time is left
 * for the enemy to reach you."
 *
 * So: one of you, at the bottom, firing straight up. A crowd of Papa's
 * wind-up monsters walking down with how much more they can take written on
 * them. And crates drifting down the lane with a weapon inside, each needing a
 * number of hits to crack open — hits that are not going into the monsters
 * while you spend them.
 *
 * That is where the arithmetic lives, and it is the whole game: a crate needing
 * twelve hits at three shots a second is four seconds of not shooting anything
 * that is walking at you. If the front monster reaches you in six, it is worth
 * it. If it reaches you in three, it is not, however good the gun inside is.
 * Both numbers are on the screen — the crate says what it costs, the top of the
 * lane says how long you have — and the sum between them is the decision.
 *
 * The first version of this game had you firing *people* up the lane at crates
 * of machines, which was the wrong way round in every sense. It is one shooter
 * and a crowd of monsters now.
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

/** You, at the bottom, and how fast you slide. */
export const GUN_Y = TALL - 1.1
export const GUN_W = 1.5
export const GUN_SPEED = 13

/**
 * The line they must not cross, a little above you.
 *
 * Above rather than level with you: a monster that has to touch you to count is
 * a monster you can dodge sideways, which turns the last second of a wave into
 * a game of chicken rather than a reason to have shot it sooner.
 */
export const LINE_Y = TALL - 2.3

export const SHOT_SPEED = 15
export const SHOT_W = 0.22

export const MON_W = 1.3
export const MON_H = 1.5

export const CRATE_W = 1.9
export const CRATE_H = 1.8

// --- what you are shooting with ----------------------------------------------

/**
 * One gun on the ladder.
 *
 * A written-out ladder rather than a set of multipliers applied to whatever you
 * are holding, which is what this was first. Multipliers compound: a bot
 * playing five minutes was at sixty damage a shot and twelve shots a second
 * inside two, both pinned at their ceilings, with the rest of the run spent
 * holding a gun that could not get better. A ladder cannot run away, every rung
 * can be balanced against the wave it turns up on, and — the part that matters
 * for a nine-year-old — the crate can say the name and the number of the gun
 * you would actually be holding, rather than a sum to do on the gun you have.
 */
export interface Gun {
  name: string
  /** How much comes off a monster per shot. */
  hit: number
  /** Seconds between shots. */
  every: number
}

/**
 * The names, in the order they turn up. Past the end of the list the same names
 * come round again with a II after them — twenty-four rungs is deeper than
 * anybody is going to get, and inventing twenty-four names for guns is how a
 * list ends up with six that mean nothing.
 */
const NAMES = [
  'Peashooter', 'Popgun', 'Rattler', 'Thumper', 'Slugger', 'Buzzsaw',
  'Cannon', 'Howitzer', 'Hammer', 'Bruiser', 'Lightning', 'Thunderclap',
]

/**
 * The ladder, built from the same factor the waves grow by.
 *
 * Forty per cent a rung, which is exactly what a wave gains over the one before
 * it. That is the whole balance of this game in one line: one rung a wave keeps
 * you level, two gains you ground, and none loses it — so the crate is not a
 * bonus, it is the price of staying in the game, and which crate you can afford
 * is the question it asks.
 *
 * The first version of this had the ladder growing faster than the waves and
 * fourteen rungs long. A bot was holding the best gun in the game two minutes
 * in, one-shotting everything in the lane, and five minutes passed without it
 * losing a life — and the measurement that found it was a wave's monsters
 * getting a third tougher and *nothing in the outcome changing at all*, which
 * is what a number nobody is bound by looks like.
 */
export const GUNS: readonly Gun[] = Array.from({ length: 24 }, (_, rung) => ({
  name: rung < NAMES.length ? NAMES[rung] : `${NAMES[rung - NAMES.length]} II`,
  // `rung + 1` under the curve keeps the first few rungs apart: forty per cent
  // of one is nothing, so a plain power curve gives two Peashooters in a row
  // and a crate that changes nothing anybody can see.
  hit: Math.max(rung + 1, Math.round(Math.pow(1.4, rung))),
  every: Math.max(0.12, Math.round((0.34 - rung * 0.009) * 100) / 100),
}))

export const TOP_RUNG = GUNS.length - 1

export const gunAt = (rung: number): Gun => GUNS[Math.max(0, Math.min(TOP_RUNG, Math.round(rung)))]

/** Shots a second, which is the number the player needs for the sum. */
export const rateOf = (gun: Gun): number => Math.round((1 / gun.every) * 10) / 10

// --- the monsters -------------------------------------------------------------

/** The four shapes, so a crowd is a crowd rather than one thing repeated. */
export type Breed = 'blob' | 'spike' | 'stomper' | 'runner'

export const BREEDS: readonly Breed[] = ['blob', 'spike', 'stomper', 'runner']

export interface Breeding {
  /** How much more health than the wave's usual. */
  tough: number
  /** How much faster or slower than the wave's usual. */
  pace: number
  tint: string
  eye: string
}

export const BREED: Record<Breed, Breeding> = {
  blob: { tough: 1, pace: 1, tint: '#7ad67a', eye: '#13331b' },
  spike: { tough: 1.4, pace: 0.85, tint: '#c86be0', eye: '#2d1133' },
  stomper: { tough: 2.2, pace: 0.6, tint: '#e0924a', eye: '#3a2008' },
  runner: { tough: 0.6, pace: 1.6, tint: '#67c8e8', eye: '#0c2733' },
}

export interface Monster {
  id: number
  x: number
  y: number
  breed: Breed
  /** What is left, and what it started with, so the bar can be drawn. */
  health: number
  max: number
  pace: number
  flash: number
}

export interface Crate {
  id: number
  x: number
  y: number
  /** Hits it takes to crack open, and how many have landed. */
  need: number
  got: number
  /** How far up the ladder it carries you: one rung, or two. */
  step: number
  flash: number
}

/** What is in a crate, for somebody holding this gun. */
export const insideFor = (crate: Crate, rung: number): Gun => gunAt(rung + crate.step)

// --- how hard, and in what order ---------------------------------------------

/**
 * How fast the crowd walks down the lane on this wave.
 *
 * Geometric, like everything else here. A wave that is forty per cent tougher
 * and arrives five per cent quicker is half a rung more than one rung of gun
 * can answer — which is what keeps a crate wanted rather than merely nice, and
 * what stops a player who takes the dear crate every time from running away
 * with it.
 */
export const walkSpeed = (level: number): number => Math.min(1.5, 0.5 * Math.pow(1.05, level - 1))

/**
 * How much a monster can take on this wave.
 *
 * Pitched against the gun ladder rather than picked, and growing by exactly the
 * factor it does: forty per cent a wave against forty per cent a rung. So a
 * monster always takes about four shots however deep you are, a row always
 * takes about as long to clear as the next row takes to arrive, and the seconds
 * spent on a crate are always seconds you did not quite have.
 *
 * Wave one is four, and a Peashooter does about two and a half a second
 * against a row arriving every six — so the gun you start with is exactly
 * enough for the wave you start on, and nothing after it.
 */
export const monHealth = (level: number): number => Math.round(4 * Math.pow(1.4, level - 1))

/** How many of them are in it. */
export const waveSize = (level: number): number => Math.min(30, 8 + level * 2)

/** How fast a crate drifts down. Slower than the crowd: it is a chance, not a threat. */
export const crateSpeed = (level: number): number => walkSpeed(level) * 0.8

/**
 * A pair of crates, side by side, that are not the same deal.
 *
 * One rung up for a small price, two rungs up for a much larger one. That is
 * the choice, and it is only a choice because of the clock: the cheap one
 * almost always fits in the time left, the dear one often does not, and working
 * out which is the sum this whole game is built on.
 *
 * The prices are multiples of three so the division stays the kind a nine-year
 * old can do in his head — fifteen hits at three a second is five seconds, and
 * five seconds is either less than what the clock says or it is not.
 */
export function cratePair(level: number, rung: number, rng: Dice, nextId: () => number): Crate[] {
  const every = gunAt(rung).every
  /*
   * Priced in seconds of shooting rather than in hits, then written on the
   * crate as the hits those seconds come to.
   *
   * Hits alone do not survive the ladder: the same twelve hits is four seconds
   * of a Peashooter and one and a half of a Thunderclap, so a price that was a
   * real decision at the start becomes small change by wave ten. Seconds are
   * what the decision is actually made in — the clock at the top is in seconds
   * — so the prices are set there and converted at the gun you are holding when
   * the crate comes down.
   */
  const toHits = (seconds: number) => Math.max(3, Math.round(seconds / every / 3) * 3)
  const cheap = { need: toHits(2.5 + rng.next() * 1.5), step: 1 }
  const dear = { need: toHits(11 + rng.next() * 7), step: 2 }

  /*
   * Out in the two side lanes, which the crowd never walks down.
   *
   * A crate is meant to be something you go to. When they came down the same
   * columns as the monsters, the bot that never once aimed at a crate opened
   * every single one anyway, with shots meant for the crowd — no decision left
   * in the game at all. Now going for one means leaving the crowd, which is
   * exactly the cost the clock is there to price.
   */
  const [left, right] = rng.next() < 0.5 ? [cheap, dear] : [dear, cheap]
  void level

  return [
    { id: nextId(), x: LANE * 0.13, y: -1.2, need: left.need, got: 0, step: left.step, flash: 0 },
    { id: nextId(), x: LANE * 0.87, y: -1.2, need: right.need, got: 0, step: right.step, flash: 0 },
  ]
}

/** How far apart the rows are. They close up as the waves go on. */
export const rowGap = (level: number): number => Math.max(2.4, 3 - (level - 1) * 0.05)

/** The crowd a wave starts with, in staggered rows above the lane. */
export function waveFor(level: number, rng: Dice, nextId: () => number): Monster[] {
  const many = waveSize(level)
  const health = monHealth(level)
  // The crowd keeps to the middle: the outside lane each side belongs to the
  // crates, so that going for one is a move away from the shooting.
  const edge = LANE * 0.28
  const wide = LANE * 0.44
  /** Four across the lane, and three in the gaps between them. */
  const fours = [edge, edge + wide / 3, edge + (wide * 2) / 3, edge + wide]
  const threes = [edge + wide / 6, edge + wide / 2, edge + (wide * 5) / 6]

  const crowd: Monster[] = []
  let row = 0
  while (crowd.length < many) {
    const places = row % 2 === 0 ? fours : threes
    for (const x of places) {
      if (crowd.length >= many) break
      // Runners and stompers only once the wave is big enough to need variety.
      const breed = rng.pick(
        level < 2 ? (['blob'] as const)
        : level < 4 ? (['blob', 'blob', 'runner'] as const)
        : (['blob', 'blob', 'runner', 'spike', 'stomper'] as const),
      )
      const was = BREED[breed]
      const full = Math.max(1, Math.round(health * was.tough))
      crowd.push({
        id: nextId(),
        x,
        y: -1.6 - row * rowGap(level),
        breed,
        health: full,
        max: full,
        pace: was.pace,
        flash: 0,
      })
    }
    row++
  }
  return crowd
}
