/**
 * The run out through the solar system.
 *
 * Eight worlds in the order you would meet them leaving the Sun, and the facts
 * are real ones. That is the whole reason this game is in here rather than
 * being another shooter: by the time you have flown to Neptune you should know
 * why Neptune is worth flying to.
 *
 * The screen is a fraction of its own width, from 0 at the left edge to 1 at
 * the right, so nothing in the model needs to know how big the phone is.
 */

/** How wide your ship is, as a fraction of the screen. */
export const SHIP_WIDE = 0.1
/** And how much of the height it takes up, for working out collisions. */
export const SHIP_TALL = 0.07

/** Screens a second, sideways, at full lock. */
export const SHIP_SPEED = 0.85
/** How fast a bolt climbs, in screens a second. */
export const BOLT_SPEED = 1.5
/** And how often you can let one go. */
export const RELOAD = 0.26

/** How long the shield holds after a knock, so one mistake is not three. */
export const MERCY = 1.6

export const STARTING_SHIELDS = 3

/**
 * The narrowest gap a ship can be expected to fly through.
 *
 * Its own width and then some. Every wave is checked against this: a screen
 * with no gap this wide anywhere across it is not difficulty, it is a coin
 * toss, and the spawner will not build one.
 *
 * The promise holds all the way down because nothing drifts sideways: a gap
 * measured when a thing is sent is the same gap when it arrives.
 *
 * Drifting rubble was tried and thrown away. It narrows a gap that was checked
 * earlier, which is precisely the fault that took three attempts to get right
 * on the road — a guarantee made at the moment of spawning does not survive
 * anything moving relative to anything else afterwards. Rubble that falls
 * straight is a promise that keeps itself.
 */
export const FLYABLE = SHIP_WIDE * 2.1

export type Hazard = 'rock' | 'shard' | 'drone' | 'mine' | 'alien' | 'comet'

/** How big each sort is, across, as a fraction of the screen. */
export const SIZE_OF: Record<Hazard, number> = {
  rock: 0.15,
  shard: 0.09,
  drone: 0.11,
  mine: 0.1,
  alien: 0.13,
  comet: 0.07,
}

/** How many hits it takes. A mine takes none: it cannot be shot at all. */
export const TOUGHNESS: Record<Hazard, number> = {
  rock: 3,
  shard: 1,
  drone: 2,
  mine: 0,
  alien: 3,
  // One hit, and you will not often get it: see RUSH_OF.
  comet: 1,
}

/** What each is worth. */
export const WORTH: Record<Hazard, number> = {
  rock: 60,
  shard: 25,
  drone: 120,
  mine: 0,
  alien: 200,
  comet: 180,
}

// --- the ones that are flying it ---------------------------------------------
//
// Asked for in one line: "how about fighting aliens when you are in deep
// space". Everything out here until now was weather — rock that falls, which
// you dodge or break. An alien is the first thing in this game that is trying.
//
// It patrols a stretch of sky rather than coming straight down, and it shoots
// back. Both of those are things this game has said no to before, for the best
// of reasons, and both are allowed here for one specific reason each.

/**
 * How far either side of where it was sent an alien will wander.
 *
 * Sideways movement is the thing that broke the fairness promise on the road
 * three times and in this game once, and the rule it broke is simple: a gap
 * measured when something was sent is only still there if nothing has moved
 * relative to anything else since.
 *
 * So an alien does not get to invalidate the measurement — the measurement
 * counts the whole stretch it will *ever* occupy, from the moment it is sent.
 * It is treated as being everywhere it could be, for as long as it is there.
 * That is the same answer the road arrived at: count where it is going, not
 * where it is.
 */
export const ALIEN_SWEEP = 0.16
/** How fast it sweeps, in full passes a second. */
export const ALIEN_PACE = 0.45
/** Seconds between its shots, and how fast they come down. */
export const ALIEN_RELOAD = 1.9
export const SHOT_SPEED = 0.85
/** How big one of its shots is, which is small on purpose. */
export const SHOT_WIDE = 0.035

/**
 * How much faster than everything else each sort comes at you.
 *
 * One, for everything that has ever been out here: the whole fairness promise
 * leans on nothing changing position relative to anything else, so a thing
 * that fell quicker than its neighbours could arrive in a band it was never
 * measured against.
 *
 * A comet is the exception, and it is allowed because it is checked against a
 * harder rule rather than the same one — see `send`. It is small, it is fast,
 * and it is the second answer to "once you have all the upgrades it gets
 * easy": there is not time to line one up, so it is dodged rather than shot.
 */
/** How often something new is sent, each frame, unless a world says otherwise. */
export const SEND_RATE = 0.06

export const RUSH_OF: Record<Hazard, number> = {
  rock: 1, shard: 1, drone: 1, mine: 1, alien: 1, comet: 2.6,
}

export interface Moon {
  name: string
  /** How big to draw it against its planet. */
  size: number
}

/**
 * What sort of thing you are flying at.
 *
 * Eight planets was the whole game, and then it was finished — all eight, to
 * Neptune, which was the point and is also the end of the solar system. What
 * is past Neptune is not more planets; it is the places he already knows the
 * names of, and they do not look anything like a planet, so the drawing has
 * to be told which is which.
 */
export type Look = 'planet' | 'ice' | 'star' | 'nebula' | 'hole' | 'galaxy'

export interface World {
  name: string
  /** The one thing worth knowing, and it is true. */
  fact: string
  /** The body's colours, and a band or a glow across it. */
  body: string
  band: string
  /** Rings, for the one that has them worth drawing. */
  rings?: boolean
  moons: readonly Moon[]
  /** How long the run to it lasts, in seconds. */
  seconds: number
  /** Hazards on screen at once, and how fast they fall, in screens a second. */
  traffic: number
  fall: number
  sends: readonly Hazard[]
  /** Default 'planet', because the first eight are. */
  look?: Look
  /**
   * The chance each frame that something new is sent, default `SEND_RATE`.
   *
   * It had no business being a dial until the far worlds needed it. `traffic`
   * caps how many things are on the screen; the rate caps how fast the gaps
   * are refilled, and past Neptune the rate is the one that binds — a hazard
   * crosses a screen falling at 0.44 in a little over two seconds, so holding
   * eleven of them up there needs about five sends a second and the old fixed
   * rate could only manage three and a half. The sky out there was asking for
   * more than it could be given.
   */
  rate?: number
  /**
   * How hard the place drags your ship sideways, in screens a second squared.
   *
   * The answer to "once you have all the upgrades the game becomes easy", and
   * it is deliberately the one thing no upgrade touches. Every upgrade in this
   * game makes your gun better — quicker, doubled, piercing — so by the far
   * end the gun has stopped being the question. A gravity well is a steering
   * problem, and you cannot shoot your way out of one.
   *
   * It pulls towards whichever side you are nearer, so the middle is the only
   * place that holds still: sitting still is no longer free.
   */
  pull?: number
}

export const WORLDS: readonly World[] = [
  {
    name: 'Mercury',
    fact: 'A day on Mercury lasts longer than its year: it goes round the Sun in 88 days, but one sunrise to the next takes 176.',
    body: '#9a9186', band: '#6f675d',
    moons: [],
    seconds: 45, traffic: 3, fall: 0.2, sends: ['rock', 'shard'],
  },
  {
    name: 'Venus',
    fact: 'Venus is the hottest planet — about 465°C, hot enough to melt lead — and it spins backwards.',
    body: '#e0b574', band: '#b8894a',
    moons: [],
    seconds: 50, traffic: 4, fall: 0.22, sends: ['rock', 'shard', 'drone'],
  },
  {
    name: 'Earth',
    fact: 'The Moon is drifting away from us by about 3.8 centimetres a year, roughly the rate your fingernails grow.',
    body: '#3d7bff', band: '#2f9e44',
    moons: [{ name: 'the Moon', size: 0.3 }],
    seconds: 55, traffic: 4, fall: 0.24, sends: ['rock', 'shard', 'drone'],
  },
  {
    name: 'Mars',
    fact: 'Olympus Mons on Mars is the tallest volcano in the solar system, about two and a half times the height of Everest.',
    body: '#c1440e', band: '#8a2f0a',
    moons: [{ name: 'Phobos', size: 0.16 }, { name: 'Deimos', size: 0.12 }],
    seconds: 60, traffic: 5, fall: 0.26, sends: ['rock', 'shard', 'drone', 'mine'],
  },
  {
    name: 'Jupiter',
    fact: 'Ganymede, one of Jupiter’s moons, is bigger than the planet Mercury — the largest moon in the solar system.',
    body: '#d8a26a', band: '#a8653a',
    moons: [
      { name: 'Io', size: 0.16 }, { name: 'Europa', size: 0.15 },
      { name: 'Ganymede', size: 0.2 }, { name: 'Callisto', size: 0.18 },
    ],
    seconds: 65, traffic: 6, fall: 0.28, sends: ['rock', 'shard', 'drone', 'mine'],
  },
  {
    name: 'Saturn',
    fact: 'Saturn’s rings are mostly water ice. Its moon Titan has thick air and lakes of liquid methane.',
    body: '#e6d3a3', band: '#bfa670', rings: true,
    moons: [{ name: 'Titan', size: 0.22 }],
    seconds: 70, traffic: 6, fall: 0.3, sends: ['rock', 'shard', 'drone', 'mine'],
  },
  {
    name: 'Uranus',
    fact: 'Uranus is tipped right over on its side, so it rolls round the Sun rather than spinning upright like the rest.',
    body: '#8fd7e0', band: '#5aa8b5',
    moons: [{ name: 'Titania', size: 0.16 }, { name: 'Oberon', size: 0.15 }],
    seconds: 75, traffic: 7, fall: 0.32, sends: ['rock', 'shard', 'drone', 'mine'],
  },
  {
    name: 'Neptune',
    fact: 'Neptune has the fastest winds in the solar system, around 2,000 km/h, and its moon Triton orbits backwards.',
    body: '#3b5fd1', band: '#28409a',
    moons: [{ name: 'Triton', size: 0.18 }],
    seconds: 80, traffic: 8, fall: 0.34, sends: ['rock', 'shard', 'drone', 'mine'],
  },

  // --- and out of the solar system entirely ---------------------------------
  //
  // "He already finished the space invader game reaching Neptune." Which is
  // the correct thing to have happened — eight planets is a finished story —
  // and it leaves the obvious question of what is past the eighth one.
  //
  // These are the places he already knows the names of, in the order you would
  // actually meet them, and every fact is a real one checked the same way the
  // planets' were. They are also where the fight is: the aliens have moved out
  // here, which is where they belong. The solar system is rock and weather.
  {
    name: 'The Kuiper Belt',
    fact: 'Out past Neptune is a ring of thousands of icy worlds. Pluto is one of them, and it takes 248 years to go round the Sun once.',
    look: 'ice',
    body: '#9fd8e8', band: '#4a7f96',
    moons: [{ name: 'Pluto', size: 0.22 }, { name: 'Charon', size: 0.14 }],
    // Nine where Neptune sends eight. They used to be level, which made the
    // first world out past the planets no harder than the last one inside
    // them — and once rocks came apart, measurably easier.
    seconds: 80, traffic: 9, fall: 0.35, sends: ['rock', 'shard', 'mine', 'comet'],
    rate: 0.075,
  },
  {
    name: 'The Oort Cloud',
    fact: 'A shell of comets so far out that light from the Sun takes a year to reach it. Every comet we see came from here.',
    look: 'ice',
    body: '#cfe6f2', band: '#5d7f93',
    moons: [],
    seconds: 85, traffic: 9, fall: 0.36, sends: ['rock', 'shard', 'mine', 'comet', 'alien'],
    rate: 0.08,
  },
  {
    name: 'Proxima Centauri',
    fact: 'The nearest star to the Sun, and a small red one. In our fastest spacecraft it would take about seventy thousand years to get there.',
    look: 'star',
    body: '#ff7a4a', band: '#ffd0a8',
    moons: [{ name: 'Proxima b', size: 0.14 }],
    seconds: 85, traffic: 9, fall: 0.37,
    rate: 0.085,
    sends: ['rock', 'shard', 'drone', 'mine', 'alien'],
    // A star's own gravity, and the first world where the stick matters more
    // than the trigger.
    pull: 0.3,
  },
  {
    name: 'Sirius',
    fact: 'The brightest star in our sky, and it is really two: a big blue-white one, and a dead star the size of Earth that weighs as much as the Sun.',
    look: 'star',
    body: '#bcd8ff', band: '#ffffff',
    moons: [{ name: 'Sirius B', size: 0.1 }],
    seconds: 90, traffic: 9, fall: 0.38,
    rate: 0.09,
    sends: ['rock', 'shard', 'drone', 'mine', 'alien', 'comet'],
    // Two stars going round each other, so the current changes its mind twice
    // as hard as Proxima's.
    pull: 0.42,
  },
  {
    name: 'Betelgeuse',
    fact: 'A red supergiant so big that if it swapped places with the Sun it would swallow Mercury, Venus, Earth and Mars. One day it will explode.',
    look: 'star',
    body: '#ff5a3c', band: '#ffb07a',
    moons: [],
    seconds: 90, traffic: 10, fall: 0.4,
    rate: 0.1,
    sends: ['rock', 'shard', 'drone', 'mine', 'alien', 'comet'],
    pull: 0.56,
  },
  {
    name: 'The Crab Nebula',
    fact: 'The wreck of a star that blew up in 1054. Astronomers in China wrote it down at the time: a new star, bright enough to see in daylight for three weeks.',
    look: 'nebula',
    body: '#b45ad8', band: '#58e0ff',
    moons: [],
    seconds: 95, traffic: 10, fall: 0.41,
    rate: 0.11,
    sends: ['shard', 'drone', 'mine', 'alien', 'comet'],
    // The wreck of a star, still blowing outwards nine hundred years later.
    pull: 0.62,
  },
  {
    name: 'Sagittarius A*',
    fact: 'The black hole at the middle of our galaxy, four million times the weight of the Sun. Nothing that falls in comes out again — not even light.',
    look: 'hole',
    body: '#1a0f2e', band: '#ffb02e',
    moons: [],
    seconds: 95, traffic: 10, fall: 0.42,
    rate: 0.12,
    sends: ['rock', 'shard', 'drone', 'mine', 'alien', 'comet'],
    // The real one. Everything in here is being pulled sideways, including you.
    pull: 0.95,
  },
  {
    name: 'Andromeda',
    fact: 'The nearest big galaxy, a trillion stars, and it is coming towards us at 110 kilometres a second. It will meet the Milky Way in about four billion years.',
    look: 'galaxy',
    body: '#8fb6ff', band: '#ffd9a8',
    moons: [],
    seconds: 100, traffic: 11, fall: 0.44,
    rate: 0.13,
    sends: ['rock', 'shard', 'drone', 'mine', 'alien', 'comet'],
    pull: 0.8,
  },
]

/** Where the planets stop and the rest of it starts. */
export const SOLAR_SYSTEM = 8

/**
 * Which world the nth run is for, and there is no last one.
 *
 * Sixteen are written out. Past those it keeps going: the deep-space eight
 * come round again, each time a little quicker, a little busier and pulling a
 * little harder, with the name saying how many times round you are. He
 * finished this game once; the point of this function is that he cannot
 * finish it again.
 *
 * The facts stay real, which is the one thing that must not be generated. A
 * made-up fact about a made-up galaxy would undo the only reason this game is
 * in here rather than being another shooter.
 */
export function worldFor(number: number): World {
  const n = Math.max(1, Math.floor(number))
  if (n <= WORLDS.length) return WORLDS[n - 1]

  const deep = WORLDS.slice(SOLAR_SYSTEM)
  const past = n - WORLDS.length - 1
  const round = Math.floor(past / deep.length) + 2
  const world = deep[past % deep.length]

  /*
   * The place comes round again; the difficulty never does.
   *
   * Taking the dials from whichever world has come round would mean the lap
   * after Andromeda opening at the Kuiper Belt's settings, which are three
   * rocks and a pull of nothing easier than the one he just flew. So the look,
   * the name and the fact cycle — that is the variety — and the numbers are
   * measured from the hardest one ever written and only ever go up.
   *
   * Capped, and not generously: past a certain point more rocks is not a
   * harder game, it is a slideshow. What keeps climbing without a ceiling is
   * the pull, which is the part no upgrade answers.
   */
  const hardest = deep.reduce((a, b) => (b.traffic > a.traffic ? b : a))
  const up = Math.min(1, (round - 1) / 5)
  return {
    ...world,
    name: `${world.name} · ${round}`,
    traffic: hardest.traffic + Math.round(up * 3),
    fall: hardest.fall + up * 0.1,
    rate: Math.max(world.rate ?? SEND_RATE, hardest.rate ?? SEND_RATE) + up * 0.05,
    pull: Math.max(world.pull ?? 0, hardest.pull ?? 0) + (round - 1) * 0.12,
  }
}

// --- the kit ---------------------------------------------------------------

/**
 * What the scrap is for.
 *
 * Breaking something up leaves a cell behind, the cell falls, and flying into
 * it puts it in your pocket. At a world you can spend the lot. That is the
 * whole loop, and the interesting part of it is that the cell falls: going
 * after one means going back into the traffic for it, which is a decision
 * rather than a reward.
 */
export type Upgrade = 'shield' | 'rapid' | 'twin' | 'pierce' | 'magnet'

export interface Kit {
  /** Shots come quicker. Two steps. */
  rapid: number
  /** Two bolts instead of one, side by side. */
  twin: boolean
  /** A bolt carries on through whatever it breaks. */
  pierce: boolean
  /** How far off a cell has to be before it leans your way. Three steps. */
  magnet: number
}

export const NEW_KIT: Kit = { rapid: 0, twin: false, pierce: false, magnet: 0 }

/** How many of each can be bought. A shield is bought again and again. */
export const MOST_OF: Record<Upgrade, number> = {
  shield: 99, rapid: 2, twin: 1, pierce: 1, magnet: 3,
}

/**
 * What each costs.
 *
 * These used to say they were priced so that "everything can be owned by
 * Uranus if you have been greedy about it", and they were out by a factor of
 * three. Measured rather than asserted this time, by totalling what every
 * world sends: Mercury is worth 40 cells, Venus 102, Earth 115 — so by Earth
 * there are 258 going spare against a kit that cost 320, and the whole thing
 * was aboard before Mars. By Uranus the sky has handed over a thousand.
 *
 * So: priced against that total, assuming somebody collects about half of what
 * passes. Nothing on the way to Venus, the first thing around Earth, and the
 * last of it somewhere around Uranus — which is where it was always meant to
 * land, and is now where it does.
 */
export const COSTS: Record<Upgrade, number> = {
  shield: 35, rapid: 70, twin: 120, pierce: 130, magnet: 75,
}

/**
 * What the next one of a levelled thing costs.
 *
 * A second magnet is not a second copy of the same part, it is a bigger one,
 * and it is also most of what there is to spend on once everything else is
 * fitted. Half as much again each time.
 */
export function costOf(what: Upgrade, have: number): number {
  return Math.round(COSTS[what] * Math.pow(1.5, Math.max(0, have)))
}

export const SHOP: Record<Upgrade, { name: string; says: string }> = {
  shield: { name: 'Shield', says: 'One more hit before it matters.' },
  rapid: { name: 'Quicker trigger', says: 'Less waiting between shots.' },
  twin: { name: 'Twin cannon', says: 'Two bolts, side by side.' },
  pierce: { name: 'Piercing bolts', says: 'A bolt carries on through.' },
  magnet: { name: 'Scrap magnet', says: 'Cells near you lean your way as they fall.' },
}

/** The most shields the hull will hold, bought or not. */
export const MOST_SHIELDS = 6

/**
 * The gun gets hot.
 *
 * This is the other half of the answer to "you can sit in one place and keep
 * firing". A rock coming apart makes the screen busier, but it was measured
 * doing nothing at all to somebody standing still: they simply shoot the
 * pieces too. A gun that cannot be held down for ever is the thing that stops
 * the trigger being a strategy.
 *
 * Heat is counted per *bolt*, not per pull, which means the twin cannon is a
 * real decision rather than a free doubling — it covers twice the lane and
 * empties the gun twice as fast.
 *
 * The numbers are chosen so that the gun you start with never troubles it: at
 * one bolt every 0.26s it would take nine seconds of unbroken fire, and
 * nobody fires unbroken for nine seconds with a single slow gun. Fit both
 * quicker triggers and the twin and you are throwing nearly fourteen bolts a
 * second, and it cuts out after two and a half. Which is the complaint, and
 * the fix, in the same sentence.
 */
export const HEAT_PER_BOLT = 0.029
/** How fast it cools once the trigger is let go. Full to cold in 1.25s. */
export const COOL_RATE = 0.8
/** It stays shut until it has come back down to here. */
export const COOL_TO = 0.4

/** How long between shots, given what has been fitted. */
export function reloadFor(kit: Kit): number {
  return RELOAD * (1 - 0.22 * Math.min(MOST_OF.rapid, kit.rapid))
}

/** What a broken-up thing leaves behind. A mine leaves nothing: it is his. */
export const SCRAP_OF: Record<Hazard, number> = {
  // A rock is worth less than it was on its own, because it is not on its own
  // any more: it comes apart into two shards worth a cell each, so breaking
  // the whole thing up still pays three — it just takes three shots across
  // three places instead of one shot in one.
  rock: 1, shard: 1, drone: 5, mine: 0, alien: 8, comet: 6,
}

/**
 * What comes apart, and into what.
 *
 * The answer to being able to park in the middle and hold the trigger down.
 *
 * Everything falls straight and every bolt goes straight up, so one column of
 * fire keeps one column clear for ever, and the best thing to do was nothing.
 * A rock that breaks into two pieces going sideways changes what shooting
 * means: the thing directly above you is the worst thing to shoot, because
 * what is left of it lands where you are standing. Shoot early, shoot wide,
 * and move — which is the game this was always supposed to be.
 */
export const SPLITS_INTO: Partial<Record<Hazard, { kind: Hazard; count: number }>> = {
  rock: { kind: 'shard', count: 2 },
}

/**
 * How hard the pieces are thrown, and how quickly they settle.
 *
 * They do not drift for ever. The sideways speed dies away with a time
 * constant of `SPLIT_EASE`, so the whole journey outwards is `SPLIT_PUSH *
 * SPLIT_EASE` and no more — about a ship and a half, which is far enough to
 * be outside the twin cannon's two barrels and near enough that the spawner
 * can still find somewhere to put a rock.
 *
 * It being *bounded* is the point. Anything that moves after it is placed
 * breaks the promise that there is a way through, unless the promise is made
 * against everywhere it can ever get to. That lesson has now cost three goes
 * at the road, the rubble, the aliens and the comets; this one is measured
 * before it is written.
 */
/**
 * What breaking a kind up is worth in the end, pieces and all, and what it
 * costs in shots to get there.
 *
 * A rock on its own pays a cell for three hits, which looks mean beside a
 * shard paying a cell for one. It is not: the rock leaves two shards behind,
 * so the whole thing is three cells for five shots. Anything comparing a
 * payout to an effort has to compare these rather than the raw numbers, or it
 * is comparing a part to a whole.
 */
export function payoutOf(kind: Hazard): number {
  const split = SPLITS_INTO[kind]
  return SCRAP_OF[kind] + (split ? split.count * payoutOf(split.kind) : 0)
}

export function effortOf(kind: Hazard): number {
  const split = SPLITS_INTO[kind]
  return TOUGHNESS[kind] + (split ? split.count * effortOf(split.kind) : 0)
}

export const SPLIT_PUSH = 0.26
export const SPLIT_EASE = 0.22
export const SPLIT_REACH = SPLIT_PUSH * SPLIT_EASE

/** How wide a cell of scrap is, and how fast it leans when a magnet is fitted. */
export const SCRAP_WIDE = 0.05
export const MAGNET_PULL = 0.5

/**
 * How near a cell has to be before a magnet leans it your way.
 *
 * It used to be the whole screen, which quietly deleted the one decision the
 * scrap exists to pose. Going after a cell means going back into the traffic
 * for it; a magnet that reaches everywhere means never going anywhere, and
 * with one fitted the game became: park, fire, collect. A reach gives the
 * upgrade back its job — it helps you keep what you earned near you — without
 * doing the earning.
 *
 * Three of them, which is also what there is left to buy once the rest of the
 * kit is aboard and deep space is still taking shields off you.
 */
export const MAGNET_REACH = [0, 0.17, 0.3, 0.52] as const
