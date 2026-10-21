/**
 * The meadow: what is in the air, and what you are being asked to shoot.
 *
 * "A bow and arrow balloon popping game. Balloons will keep popping up from
 * different directions and you need to keep shooting them before they escape.
 * First person, 3D."
 *
 * So the player stands in one place and turns. Balloons come up out of the
 * grass all the way around, rise, drift, and are gone over the trees if nobody
 * gets to them — which means the game is about *looking*, and the hardest thing
 * in it is knowing what is behind you.
 *
 * Every balloon carries a number and every round names a rule: the even ones,
 * the ones over nine, the sevens. A balloon that fits is worth going after and
 * costs you if it gets away; one that does not is a decoy, and popping it by
 * mistake costs nothing but the arrow. That is the whole of the arithmetic, and
 * it is deliberately the kind you do at a glance rather than on paper, because
 * everything else here is already asking for your hands and your eyes.
 */

/** The dice, as little of them as this file needs. */
export interface Dice {
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

/**
 * How many goes you get, before anything the workshop adds.
 *
 * Five rather than the three every other game here gives, because this one
 * takes a life for something you did not do rather than for something you did:
 * a balloon you never got round to is gone whether you were looking the wrong
 * way or simply had two of them up at once. Learning where to aim is worth a
 * few more goes than learning not to walk into a spike.
 */
export const LIVES = 5

/** Where your eyes are, in metres above the grass. */
export const EYE = 1.6

export const GRAVITY = 9.8

/**
 * How long a full draw takes, and what it is worth.
 *
 * A bow that fires the instant you touch the screen is a gun. The pull is what
 * makes it a bow: it costs a moment, and the moment is the difference between a
 * flat quick shot at something close and a lobbed one at something that has got
 * away up the sky.
 */
export const DRAW_TIME = 0.55
/*
 * Slower than the first go at it, on purpose. At fifty metres a second an
 * arrow crosses the whole meadow in half a second and falls about a metre, so
 * the drop was smaller than the balloon and aiming high was something you
 * could skip. At forty-two it falls two and a half metres over the same
 * ground, which is the difference between a game about pointing and a game
 * about judging a lob.
 */
export const SLOWEST = 24
export const FASTEST = 42

export const arrowSpeed = (draw: number): number =>
  SLOWEST + (FASTEST - SLOWEST) * Math.max(0, Math.min(1, draw))

/** An arrow is gone once it is this far out, or under the grass. */
export const ARROW_RANGE = 90

/**
 * How big a balloon is, and how much of a near miss still counts.
 *
 * Generous on purpose: this is a nine-year-old on a phone aiming at something
 * twenty metres away with a thrown stick. The forgiveness is in the target, not
 * in the flight — the arrow still arcs honestly, and learning to aim above a
 * far balloon is the skill the game is made of.
 */
export const BALLOON_R = 0.62
export const ARROW_R = 0.3

/**
 * How near an arrow has to pass, which grows with the range.
 *
 * The error a thumb makes is an *angle*, not a distance: being a degree out
 * costs twenty centimetres at ten metres and most of a metre at thirty. A
 * fixed radius therefore makes a far balloon several times harder than a near
 * one for no reason the player can see, and a probe that aimed at balloons
 * forty times running and hit none of them was the proof.
 *
 * So the forgiveness is about three quarters of a degree of it, added to the
 * balloon — enough to pay for a thumb, and never enough to pay for a flat shot
 * at something far off, which still falls short of it. Near shots stay honest; far ones stay possible; and the arrow
 * itself is unchanged — it still arcs, still falls, and still has to be aimed
 * above anything worth shooting.
 */
export const reachFor = (away: number): number => BALLOON_R + ARROW_R + away * 0.012

/** Where they come up, how fast they climb, and when they are gone for good. */
export const NEAR = 11
export const FAR = 26
export const ESCAPE_Y = 19

export interface Balloon {
  id: number
  /** Where it is, in metres, with the archer at the middle. */
  x: number
  y: number
  z: number
  /** How fast it climbs, and the drift it picked up on the way. */
  rise: number
  driftX: number
  driftZ: number
  /** What is written on it. */
  number: number
  /** Whether that number fits this round's rule — worked out once, at birth. */
  wanted: boolean
  tint: string
  /** Its own offset into the bob, so a sky full of them is not one balloon. */
  sway: number
}

export interface Arrow {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Seconds it has been in the air, for the trail and for tidying up. */
  age: number
  /** Stuck in the ground, left for a moment so a miss is visible. */
  stuck: boolean
}

// --- what a round asks for ---------------------------------------------------

export type Rule =
  | { kind: 'even' }
  | { kind: 'odd' }
  | { kind: 'over'; n: number }
  | { kind: 'under'; n: number }
  | { kind: 'times'; n: number }

export const fits = (rule: Rule, n: number): boolean => {
  switch (rule.kind) {
    case 'even': return n % 2 === 0
    case 'odd': return n % 2 === 1
    case 'over': return n > rule.n
    case 'under': return n < rule.n
    case 'times': return n % rule.n === 0
  }
}

/** What the top of the screen says you are after. */
export const ruleSays = (rule: Rule): string => {
  switch (rule.kind) {
    case 'even': return 'POP THE EVEN ONES'
    case 'odd': return 'POP THE ODD ONES'
    case 'over': return `POP ANYTHING OVER ${rule.n}`
    case 'under': return `POP ANYTHING UNDER ${rule.n}`
    case 'times': return `POP THE ${rule.n}s`
  }
}

/**
 * The rule for a round, getting harder as they go on.
 *
 * Even and odd first, because telling those apart is instant once you can do
 * it at all and the first round should be about learning to shoot. Then the
 * comparisons, then the times tables — which are the ones worth drilling, so
 * they are most of the back half.
 */
export function ruleFor(round: number, rng: Dice): Rule {
  if (round === 1) return { kind: 'even' }
  if (round === 2) return { kind: 'odd' }
  if (round <= 4) {
    return rng.next() < 0.5
      ? { kind: 'over', n: rng.int(5, 12) }
      : { kind: 'under', n: rng.int(6, 14) }
  }
  const table = Math.min(12, 2 + Math.floor((round - 3) / 2) + rng.int(0, 1))
  return rng.next() < 0.3
    ? (rng.next() < 0.5 ? { kind: 'even' } : { kind: 'over', n: rng.int(8, 20) })
    : { kind: 'times', n: Math.max(2, table) }
}

/** The biggest number that can turn up, which grows with the rounds. */
export const biggest = (round: number): number => Math.min(60, 10 + round * 4)

/** How many of the wanted ones you have to get before the round is done. */
export const needFor = (round: number): number => 6 + round * 2

/** How long between balloons, and how fast they climb. */
export const gapFor = (round: number): number => Math.max(0.75, 2.1 - (round - 1) * 0.12)
/*
 * How fast they climb. Gentle to start with: at the first speed this had, a
 * balloon was over the trees fourteen seconds after it appeared, which is not
 * long to notice it, turn round and work out whether its number counts.
 */
export const riseFor = (round: number): number => 0.85 + Math.min(1.7, (round - 1) * 0.12)

/** Roughly how many of the balloons should be ones you actually want. */
export const WANTED_SHARE = 0.55

export const TINTS = {
  wanted: ['#ff5f7a', '#ffd166', '#8fd3ff', '#9af5c0', '#c38fff'],
  // Drab beside the wanted ones, but not dark: against a bright sky a dim
  // balloon reads as a hole rather than as a thing you have decided to ignore.
  other: ['#9aa6c2', '#b2bcd4', '#8d99b4'],
} as const

/**
 * One balloon, coming up out of the grass somewhere around you.
 *
 * The direction is the whole point of the game being in three dimensions: they
 * arrive at any angle, which means the thing you are doing between shots is
 * turning round and looking.
 */
export function newBalloon(
  id: number, round: number, rule: Rule, rng: Dice, turn?: number,
): Balloon {
  const angle = turn ?? rng.next() * Math.PI * 2
  const away = NEAR + rng.next() * (FAR - NEAR)
  const most = biggest(round)

  // Decide first whether this one is wanted, then find a number that says so:
  // picking a number and seeing what it turns out to be gives whatever share
  // the rule happens to have, which for the sevens is one in seven.
  const wanted = rng.next() < WANTED_SHARE
  let number = rng.int(1, most)
  for (let tries = 0; tries < 60 && fits(rule, number) !== wanted; tries++) {
    number = rng.int(1, most)
  }

  return {
    id,
    x: Math.cos(angle) * away,
    y: 0.6 + rng.next() * 1.2,
    z: Math.sin(angle) * away,
    rise: riseFor(round) * (0.85 + rng.next() * 0.4),
    driftX: (rng.next() - 0.5) * 0.7,
    driftZ: (rng.next() - 0.5) * 0.7,
    number,
    wanted: fits(rule, number),
    tint: fits(rule, number)
      ? TINTS.wanted[rng.int(0, TINTS.wanted.length - 1)]
      : TINTS.other[rng.int(0, TINTS.other.length - 1)],
    sway: rng.next() * Math.PI * 2,
  }
}
