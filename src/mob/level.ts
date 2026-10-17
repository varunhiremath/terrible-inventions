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

export const MON_W = 0.95
export const MON_H = 1.45

export const CRATE_W = 1.4
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
export type Breed = 'shambler' | 'runner' | 'lurcher' | 'brute'

export const BREEDS: readonly Breed[] = ['shambler', 'runner', 'lurcher', 'brute']

export interface Breeding {
  /** How much more health than the wave's usual. */
  tough: number
  /** How much faster or slower than the wave's usual. */
  pace: number
  /** How much bigger than the usual one. */
  size: number
  skin: string
  rag: string
  eye: string
}

/**
 * What is walking at you.
 *
 * Four of them, and they are told apart by build before colour: a runner is
 * lean and leaning forward, a lurcher is wide and slow, and a brute is twice
 * the height of anything else on the bridge. Colour alone is no use to somebody
 * deciding in half a second which end of the row to shoot first.
 */
export const BREED: Record<Breed, Breeding> = {
  shambler: { tough: 1, pace: 1, size: 1, skin: '#8fd08a', rag: '#4a6b53', eye: '#1d3a24' },
  runner: { tough: 0.55, pace: 1.7, size: 0.88, skin: '#9fdcc6', rag: '#2f6b63', eye: '#0f2e2b' },
  lurcher: { tough: 1.6, pace: 0.75, size: 1.15, skin: '#c0a173', rag: '#6a5134', eye: '#36281a' },
  brute: { tough: 6, pace: 0.55, size: 1.85, skin: '#b4705f', rag: '#5c2b22', eye: '#2a0f0b' },
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
  size: number
  flash: number
  /** Its own offset into the walk cycle, so a crowd is not one thing stamped out. */
  step: number
}

// --- the things that fall ----------------------------------------------------

/**
 * A thing worth running under.
 *
 * Crates are the decision this game is built on and they are deliberately slow,
 * deliberate and priced. These are the opposite: they fall, they are free, and
 * they are gone in a few seconds — something to notice out of the corner of an
 * eye and go and get, which is most of what "more going on" means in a game
 * like this.
 */
export type Catch = 'turret' | 'rapid' | 'blast'

export interface Falling {
  id: number
  x: number
  y: number
  kind: Catch
  flash: number
}

export interface Caught {
  name: string
  says: string
  tint: string
}

export const CATCH: Record<Catch, Caught> = {
  turret: { name: 'TURRET', says: 'It fires with you', tint: '#8fd3ff' },
  rapid: { name: 'RAPID', says: 'Twice as fast', tint: '#ffd166' },
  blast: { name: 'BLAST', says: 'Clears the front', tint: '#ff8c8c' },
}

/** How long a caught thing lasts, in seconds. A blast is instant. */
export const TURRET_FOR = 14
export const RAPID_FOR = 8
/** How much of your gun a blast is worth, to everything near the front. */
export const BLAST_WORTH = 6
/** How fast a dropped thing falls, and how near you have to be to catch it. */
export const FALL_SPEED = 2.6
export const CATCH_NEAR = 1.1

/** How long between things falling. */
export const dropEvery = (level: number): number => Math.max(7, 12 - (level - 1) * 0.3)

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
export const walkSpeed = (level: number): number => Math.min(1.6, 0.62 * Math.pow(1.05, level - 1))

/**
 * How much a monster can take on this wave.
 *
 * Pitched against the gun ladder rather than picked, and growing by exactly the
 * factor it does: forty per cent a wave against forty per cent a rung. So a
 * monster always takes about four shots however deep you are, a row always
 * takes about as long to clear as the next row takes to arrive, and the seconds
 * spent on a crate are always seconds you did not quite have.
 *
 * Wave one is two, and a Peashooter does about three a second against a row
 * of six arriving every four — so the gun you start with is exactly enough for
 * the wave you start on, and nothing after it. It used to be four each in rows
 * of three and a half; the crowd is twice the size now and each of them is
 * correspondingly less work, because "a lot more of them walking down" was the
 * ask and a crowd that is half as dense and twice as tough is not a crowd.
 */
export const monHealth = (level: number): number => Math.max(2, Math.round(2.2 * Math.pow(1.4, level - 1)))

/** How many of them are in it. */
export const waveSize = (level: number): number => Math.min(60, 16 + level * 4)

/** How many walk abreast. Six is as many as fit across the bridge legibly. */
export const acrossFor = (level: number): number => (level < 3 ? 5 : 6)

/** How many brutes are in among them. None until the third wave. */
export const brutesFor = (level: number): number =>
  level < 3 ? 0 : Math.min(5, Math.floor(level / 3))

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
    // On the parapets, clear of the widest thing in the crowd: a brute is two
    // units across, and with the crates any further in a shot aimed at the
    // brute on the end of a row clipped the crate behind it. Which is how a bot
    // that never aimed at a crate still opened five a run.
    { id: nextId(), x: LANE * 0.08, y: -1.2, need: left.need, got: 0, step: left.step, flash: 0 },
    { id: nextId(), x: LANE * 0.92, y: -1.2, need: right.need, got: 0, step: right.step, flash: 0 },
  ]
}

/**
 * Where the front row stands when a wave opens.
 *
 * On the bridge, not above it. Every row used to start off the top of the
 * screen and walk in at half a unit a second, which meant the first twenty
 * seconds of every wave was an empty bridge and a soldier firing at nothing —
 * reported, correctly, as dull and slow. The crowd is in view from the first
 * frame now, and the clock still reads twenty-odd seconds because the bridge is
 * long.
 */
export const OPENS_AT = 4.5

/** How far apart the rows are. They close up as the waves go on. */
export const rowGap = (level: number): number => Math.max(1.8, 2.2 - (level - 1) * 0.03)

/**
 * The crowd a wave starts with, in staggered rows above the bridge.
 *
 * Five or six abreast with the rows offset by half a step, which reads as a
 * crowd pouring down rather than a grid walking down. The brutes are dropped in
 * among them rather than given rows of their own: the thing that makes a brute
 * frightening is the ordinary ones around it carrying on while you deal with
 * it.
 */
export function waveFor(level: number, rng: Dice, nextId: () => number): Monster[] {
  const many = waveSize(level)
  const health = monHealth(level)
  // The crowd keeps to the middle: the outside lane each side belongs to the
  // crates, so that going for one is a move away from the shooting.
  const edge = LANE * 0.18
  const wide = LANE * 0.64
  const across = acrossFor(level)

  const crowd: Monster[] = []
  let row = 0
  while (crowd.length < many) {
    const shift = row % 2 === 0 ? 0 : wide / (across - 1) / 2
    for (let i = 0; i < across; i++) {
      if (crowd.length >= many) break
      const x = edge + (wide * i) / (across - 1) + shift
      if (x > LANE - edge) continue
      const breed = rng.pick(
        level < 2 ? (['shambler'] as const)
        : level < 4 ? (['shambler', 'shambler', 'runner'] as const)
        : (['shambler', 'shambler', 'runner', 'lurcher'] as const),
      )
      crowd.push(newMonster(nextId(), x, OPENS_AT - row * rowGap(level), breed, health, rng))
    }
    row++
  }

  // And the brutes, scattered through the middle of the crowd rather than at
  // the front or the back of it.
  for (let i = 0; i < brutesFor(level); i++) {
    const at = crowd[rng.int(Math.floor(crowd.length * 0.2), crowd.length - 1)]
    crowd.push(newMonster(nextId(), at.x, at.y - 0.6, 'brute', health, rng))
  }

  return crowd
}

function newMonster(
  id: number, x: number, y: number, breed: Breed, health: number, rng: Dice,
): Monster {
  const was = BREED[breed]
  const full = Math.max(1, Math.round(health * was.tough))
  return {
    id,
    x,
    y,
    breed,
    health: full,
    max: full,
    pace: was.pace,
    size: was.size,
    flash: 0,
    step: rng.next() * Math.PI * 2,
  }
}
