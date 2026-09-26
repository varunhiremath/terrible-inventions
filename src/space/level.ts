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

export type Hazard = 'rock' | 'shard' | 'drone' | 'mine'

/** How big each sort is, across, as a fraction of the screen. */
export const SIZE_OF: Record<Hazard, number> = {
  rock: 0.15,
  shard: 0.09,
  drone: 0.11,
  mine: 0.1,
}

/** How many hits it takes. A mine takes none: it cannot be shot at all. */
export const TOUGHNESS: Record<Hazard, number> = {
  rock: 3,
  shard: 1,
  drone: 2,
  mine: 0,
}

/** What each is worth. */
export const WORTH: Record<Hazard, number> = {
  rock: 60,
  shard: 25,
  drone: 120,
  mine: 0,
}

export interface Moon {
  name: string
  /** How big to draw it against its planet. */
  size: number
}

export interface World {
  name: string
  /** The one thing worth knowing, and it is true. */
  fact: string
  /** Planet colours: the body, and a band across it. */
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
]

export function worldFor(number: number): World {
  return WORLDS[Math.min(Math.max(1, number), WORLDS.length) - 1]
}
