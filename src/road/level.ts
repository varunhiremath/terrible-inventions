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

/**
 * The stretch a driver is about to arrive in.
 *
 * Two promises are made about it and both are tested. There is always a way
 * through it, and nothing inside it changes lane. What you see when you still
 * have time to answer it is what you get — a car that swerves after you have
 * committed is not a hazard, it is a trick.
 */
export const REACT = SIGHT * 0.6

/**
 * What each stage asks of you beyond getting to the end.
 *
 * A distance on its own is a treadmill. A thing to *do* while covering it —
 * get past twenty of them, take three cans, arrive without a scratch — is what
 * turns a stretch of road into a stage, and it gives the end of one something
 * to report other than "yes, that happened".
 */
export type Mission =
  | { kind: 'pass'; count: number }
  | { kind: 'cans'; count: number }
  | { kind: 'clean' }

export function missionSays(mission: Mission): string {
  switch (mission.kind) {
    case 'pass':
      return `Get past ${mission.count} of them`
    case 'cans':
      return `Pick up ${mission.count} cans of fuel`
    case 'clean':
      return 'Arrive without a scratch'
  }
}

/** What finishing the job is worth. */
export const MISSION_BONUS = 1500

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
  /** The job, on top of getting there. */
  mission: Mission
  /** Which of his vehicles turn out for this one. */
  fleet: readonly CarKind[]
}

/**
 * What is out on the road.
 *
 * `swerver` is the one that changes the game: it drifts towards whichever lane
 * you are in. It may only do that while it is still far enough away for you to
 * answer it — see the note on the reaction window in `run.ts`. A hazard that
 * moves after you have committed is not a hazard, it is a trick.
 */
export type CarKind = 'cruiser' | 'lorry' | 'swerver' | 'patrol' | 'ambulance'

/** How much of a lane each one takes up. A lorry is wider than a car. */
export const WIDTH_OF: Record<CarKind, number> = {
  cruiser: 0.62,
  lorry: 0.78,
  swerver: 0.62,
  patrol: 0.64,
  ambulance: 0.7,
}

/** And how long. */
export const LENGTH_OF: Record<CarKind, number> = {
  cruiser: 1,
  lorry: 1.55,
  swerver: 1,
  patrol: 1.05,
  ambulance: 1.3,
}

/** How fast each one goes, against the stage's own pace. */
export const PACE_OF: Record<CarKind, number> = {
  cruiser: 1,
  lorry: 0.78,
  swerver: 1.05,
  patrol: 1.1,
  ambulance: 1.25,
}

/**
 * Six stages, and they get busier rather than faster.
 *
 * Making the traffic quicker just shortens the game; making it denser is what
 * actually asks more of you, because the gaps are the puzzle.
 */
export const STAGES: readonly Stage[] = [
/*
 * Paces rise as the stages go on, which sounds backwards and is not.
 *
 * Slower traffic is *harder*: you close on it faster, so you see it for less
 * time. The gentlest stage therefore has the traffic moving nearly half your
 * speed, and the difficulty later comes from how much of it there is and what
 * sort it is — a lane-changer is a different problem from a lorry.
 *
 * Counts to suit the sight line, not the other way round.
 *
 * These were three to eight when you could see thirty-four units of road. The
 * view is twenty now, so the same numbers were nearly twice as dense and the
 * third stage went from one crash to eleven. Traffic is only meaningful
 * relative to how much road you can see it on.
 */
  {
    name: 'The Bypass', traffic: 2, pace: 0.44, distance: 450,
    mission: { kind: 'pass', count: 6 }, fleet: ['cruiser'],
  },
  {
    name: 'Rush Hour', traffic: 2, pace: 0.46, distance: 550,
    mission: { kind: 'cans', count: 2 }, fleet: ['cruiser', 'lorry'],
  },
  {
    name: 'The Long Straight', traffic: 3, pace: 0.48, distance: 650,
    mission: { kind: 'pass', count: 14 }, fleet: ['cruiser', 'lorry', 'patrol'],
  },
  {
    name: 'Roadworks', traffic: 3, pace: 0.5, distance: 750,
    mission: { kind: 'clean' }, fleet: ['cruiser', 'lorry', 'swerver'],
  },
  {
    name: 'Night Shift', traffic: 4, pace: 0.52, distance: 850,
    mission: { kind: 'cans', count: 3 }, fleet: ['cruiser', 'patrol', 'swerver', 'ambulance'],
  },
  {
    name: "Papa's Own Motorway", traffic: 5, pace: 0.54, distance: 1000,
    mission: { kind: 'pass', count: 28 },
    fleet: ['cruiser', 'lorry', 'patrol', 'swerver', 'ambulance'],
  },
]

export function stageFor(number: number): Stage {
  return STAGES[Math.min(Math.max(1, number), STAGES.length) - 1]
}

/** Speed on the dial. Nobody wants to be told they are doing 19 car lengths. */
export function kmh(speed: number): number {
  return Math.round((speed / TOP_SPEED) * 400)
}
