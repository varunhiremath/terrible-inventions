/**
 * The road.
 *
 * Four lanes, one of you, and a great deal of {papa}'s traffic coming the
 * other way. You are faster than all of it, which is the whole game: the road
 * is a queue and you are trying to get through it.
 *
 * Distances are in car lengths rather than metres, because every rule in here
 * is really about how many cars fit in a gap, and a unit you can count on the
 * screen is a unit you can reason about.
 */
export const LANES = 4

/**
 * How long a car is, in the units everything else is measured in.
 *
 * Longer than one unit so that a car drawn on the road is longer than it is
 * wide. It was exactly one, and with the sight line set in the same units the
 * cars came out square — which from above is not a car, it is a box.
 */
export const CAR_LONG = 2.2
/** How wide a car is, as a fraction of its lane. */
export const CAR_WIDE = 0.62

/**
 * Top speed, in car lengths a second.
 *
 * It was twenty-six, which is the whole of the visible road every second: a
 * slow car ahead closed in about a second and a half, and even a sensible
 * driver was crashing six times on the gentlest stage. Speed is not what makes
 * this good — the gaps are — so it gives some back.
 */
export const TOP_SPEED = 15
/** How hard the pedal pushes, and how hard the brake pulls back. */
export const ACCELERATION = 6.5
export const BRAKING = 16
/** Rolling off the pedal does not stop you dead. */
export const DRAG = 2.5
/** Lanes a second, sideways, at full lock. */
export const STEER_RATE = 3.4

/*
 * Fuel.
 *
 * Meant to be a pressure, not a gate. The first numbers made it a gate: the
 * tank ran out about two thirds of the way through the opening stage and every
 * stage after it was spent almost entirely dry, coasting. Nobody was going to
 * finish stage two, ever.
 *
 * Now a full tank gets you most of a stage and the cans make up the rest, so
 * the question the road asks is "can you reach that can safely" rather than
 * "did the road happen to put one in front of you".
 */
export const TANK = 140
export const BURN_PER_SECOND = 1.8
/** A can puts this much back in. */
export const CAN_WORTH = 45

/**
 * How far ahead you can see, in car lengths.
 *
 * Everything about fairness is measured against this: a hazard you cannot see
 * in time is not a hazard, it is a coin toss.
 */
export const SIGHT = 24

export interface Stage {
  name: string
  /** Cars on the road at once, roughly. */
  traffic: number
  /**
   * How fast all of them go, as a fraction of your top speed.
   *
   * All of them, at the same speed, on purpose. Cars travelling at different
   * speeds drift relative to each other, so two waves laid down with a gap
   * between them close up into a wall a hundred lengths later — and no
   * promise made at the moment of spawning survives that. Every attempt to
   * patch it afterwards, by hurrying the leader along, just moved the failure
   * further down the road.
   *
   * With one pace the geometry is frozen the moment it is laid down: a gap
   * that exists when the cars appear is still there when you arrive. You are
   * faster than all of it, which is what makes it a road to get through
   * rather than a race, and the variety comes from where the gaps are rather
   * than from how fast the cars are.
   */
  pace: number
  /** How far you have to get to finish, in car lengths. */
  distance: number
}

/**
 * Six stages, and they get busier rather than faster.
 *
 * Making the traffic quicker just shortens the game; making it denser is what
 * actually asks more of you, because the gaps are the puzzle.
 */
export const STAGES: readonly Stage[] = [
/*
 * Counts to suit the sight line, not the other way round.
 *
 * These were three to eight when you could see thirty-four units of road. The
 * view is twenty now, so the same numbers were nearly twice as dense and the
 * third stage went from one crash to eleven. Traffic is only meaningful
 * relative to how much road you can see it on.
 */
  { name: 'The Bypass', traffic: 2, pace: 0.34, distance: 450 },
  { name: 'Rush Hour', traffic: 2, pace: 0.38, distance: 550 },
  { name: 'The Long Straight', traffic: 3, pace: 0.42, distance: 650 },
  { name: 'Roadworks', traffic: 3, pace: 0.46, distance: 750 },
  { name: 'Night Shift', traffic: 3, pace: 0.5, distance: 850 },
  { name: "Papa's Own Motorway", traffic: 4, pace: 0.54, distance: 1000 },
]

export function stageFor(number: number): Stage {
  return STAGES[Math.min(Math.max(1, number), STAGES.length) - 1]
}

/** Speed on the dial. Nobody wants to be told they are doing 19 car lengths. */
export function kmh(speed: number): number {
  return Math.round((speed / TOP_SPEED) * 400)
}
