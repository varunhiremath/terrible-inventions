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
 * Top speed on the opening stage, in car lengths a second.
 *
 * Every stage after that raises it — see `Stage.limit`. Going faster is the
 * cleanest way to make a road harder, because it takes reaction time away
 * without taking anything away from the player: the same gaps, less of a
 * moment to find them.
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
export const TANK = 100
export const BURN_PER_SECOND = 2.4
/** A can puts this much back in — not a full tank, on purpose. */
export const CAN_WORTH = 32
/**
 * The least time between one can and the next.
 *
 * There was no such gap, and a can appeared as soon as the last was gone —
 * with the odds *raised* when the tank was low, which was meant to be kind and
 * meant the tank never actually ran out. Reported as exactly that: "I never
 * seem to run out of fuel, they keep coming." Fuel that cannot run out is not
 * a resource, it is scenery.
 */
export const CAN_EVERY = 14

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
 * How long a vehicle indicates before it actually pulls out.
 *
 * Long enough to be seen and acted on. Traffic that changes lane without
 * warning is readable only by memorising the seed; traffic that tells you
 * first is a puzzle you can actually solve, and it is what the road does in
 * real life.
 */
export const SIGNAL_FOR = 0.9

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
  /** Finish the stage in the first `place` of the field. */
  | { kind: 'place'; place: number }

export function missionSays(mission: Mission): string {
  switch (mission.kind) {
    case 'pass':
      return `Get past ${mission.count} of them`
    case 'place':
      return mission.place === 1
        ? 'Win it'
        : `Finish in the first ${mission.place}`
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
  /**
   * How much faster than the opening stage you are allowed to go.
   *
   * The thing that actually makes later stages hard. Five stages were being
   * finished without a scratch, and no amount of extra traffic fixes that on
   * its own — at a fixed speed you simply have all day to pick your gap.
   */
  limit: number
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
export type CarKind =
  | 'cruiser' | 'taxi' | 'van' | 'truck' | 'bus' | 'patrol' | 'ambulance' | 'swerver'

/** How much of a lane each one takes up. */
export const WIDTH_OF: Record<CarKind, number> = {
  cruiser: 0.62,
  taxi: 0.62,
  van: 0.72,
  truck: 0.82,
  bus: 0.8,
  patrol: 0.64,
  ambulance: 0.72,
  swerver: 0.62,
}

/** And how long. A bus is most of a lane on its own. */
export const LENGTH_OF: Record<CarKind, number> = {
  cruiser: 1,
  taxi: 1,
  van: 1.3,
  truck: 1.9,
  bus: 2.1,
  patrol: 1.05,
  ambulance: 1.35,
  swerver: 1,
}

/**
 * Which of them pull out on you.
 *
 * A swerver goes looking for your lane. The rest change lanes now and then for
 * no reason you are told about, which is what the road is actually like and is
 * the difference between traffic and bollards. All of it happens outside the
 * reaction window — see `run.ts`.
 */
export const WANDERS: Record<CarKind, number> = {
  cruiser: 0.16,
  taxi: 0.5,
  van: 0.22,
  truck: 0.08,
  bus: 0.08,
  patrol: 0.45,
  ambulance: 0.7,
  swerver: 1.6,
}

/**
 * How fast each sort crosses a lane, against the player's steering.
 *
 * A swerver dashes; everything else drifts. That is the difference between
 * "there is a red car coming across" and "there was a red car coming across",
 * and it is what makes the red ones worth watching for rather than worth
 * noting. Still only ever outside the reaction window — a car that moves after
 * you have committed to a gap is not a hazard, it is a trick.
 */
export const DASHES: Record<CarKind, number> = {
  cruiser: 0.5,
  taxi: 0.6,
  van: 0.5,
  truck: 0.4,
  bus: 0.4,
  patrol: 0.7,
  ambulance: 0.8,
  swerver: 1.15,
}

/**
 * Six stages, and they get busier rather than faster.
 *
 * Making the traffic quicker just shortens the game; making it denser is what
 * actually asks more of you, because the gaps are the puzzle.
 */
export const STAGES: readonly Stage[] = [
/*
 * Traffic counts leave room to pull out.
 *
 * They went as high as eleven, and at that density nothing could change lane
 * at all: every manoeuvre was refused for closing the last gap, so the
 * indicators never came on and the road was a set of bollards again. Busy
 * enough to be a problem, loose enough to be a road.
 *
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
    name: 'The Bypass', traffic: 3, pace: 0.46, limit: 1, distance: 450,
    mission: { kind: 'pass', count: 10 }, fleet: ['cruiser', 'taxi', 'van'],
  },
  {
    name: 'Rush Hour', traffic: 5, pace: 0.42, limit: 1.1, distance: 550,
    mission: { kind: 'place', place: 3 },
    fleet: ['cruiser', 'taxi', 'van', 'bus', 'swerver'],
  },
  {
    name: 'The Long Straight', traffic: 6, pace: 0.4, limit: 1.2, distance: 650,
    mission: { kind: 'cans', count: 2 },
    fleet: ['cruiser', 'taxi', 'truck', 'bus', 'patrol', 'swerver'],
  },
  {
    name: 'Roadworks', traffic: 6, pace: 0.38, limit: 1.28, distance: 750,
    mission: { kind: 'place', place: 2 },
    fleet: ['cruiser', 'van', 'truck', 'bus', 'swerver', 'swerver'],
  },
  {
    name: 'Night Shift', traffic: 7, pace: 0.36, limit: 1.36, distance: 850,
    mission: { kind: 'clean' },
    fleet: ['cruiser', 'taxi', 'van', 'patrol', 'ambulance', 'swerver', 'swerver'],
  },
  {
    name: "Papa's Own Motorway", traffic: 8, pace: 0.34, limit: 1.45, distance: 1000,
    mission: { kind: 'place', place: 1 },
    fleet: ['cruiser', 'taxi', 'van', 'truck', 'bus', 'patrol', 'ambulance', 'swerver'],
  },
]

export function stageFor(number: number): Stage {
  return STAGES[Math.min(Math.max(1, number), STAGES.length) - 1]
}

/** Speed on the dial. Nobody wants to be told they are doing 19 car lengths. */
export function kmh(speed: number): number {
  return Math.round((speed / TOP_SPEED) * 280)
}

/** What the pedal is worth on a given stage. */
export function topSpeedOn(stage: Stage): number {
  return TOP_SPEED * stage.limit
}

// --- the others in the race -------------------------------------------------

/**
 * Four of his, running the same stage as you.
 *
 * The road was reported as too easy twice, and more traffic was not the
 * answer either time: traffic is an obstacle course, and an obstacle course
 * you have already solved is not hard, it is long. Somebody to beat is a
 * different thing. You can drive a clean stage and still come fourth.
 *
 * Their pace is given against your top speed on the stage, so they scale with
 * you rather than against the fixed number — otherwise the later stages, where
 * you are half as fast again, would leave them standing.
 *
 * The numbers look high — the leader is nominally as quick as you are — and
 * they have to be. A racer spends a good part of a stage stuck behind the same
 * traffic you are, backing off and weaving, and loses far more to that than
 * the figure suggests. At four fifths of your speed on paper they were beaten
 * comfortably by a test driver that crashed ten times a stage, which is not a
 * race. What actually decides it is who gets held up least.
 */
export interface Racer {
  name: string
  colour: string
  trim: string
  /** Fraction of your top speed they average over a stage. */
  pace: number
  /** How much they vary it, so nobody drives like a metronome. */
  swing: number
}

export const FIELD: readonly Racer[] = [
  { name: 'Piston', colour: '#e8503a', trim: '#7d1f14', pace: 1, swing: 0.06 },
  { name: 'Gasket', colour: '#f2b134', trim: '#8a5f10', pace: 0.96, swing: 0.09 },
  { name: 'Tack', colour: '#5ad2e0', trim: '#1c6570', pace: 0.93, swing: 0.05 },
  { name: 'Grinder', colour: '#9b7ede', trim: '#4a2f80', pace: 0.89, swing: 0.11 },
]

/**
 * How far ahead or behind the field starts, in car lengths.
 *
 * Staggered, and all of it behind you: starting a race from the back of the
 * grid is a fine thing in a game you can restart and a miserable one in a game
 * where the first thirty seconds decide it.
 */
export const GRID_GAP = 9

/** How quickly a racer changes lane. Quicker than traffic; they mean it. */
export const RACER_STEER = 2.6

/**
 * How close a racer gets to something before backing off, in car lengths.
 *
 * They are not allowed to crash — a field that wipes itself out in the first
 * stage is no race at all — so instead they slow down, look for a lane, and
 * lose time. Which is exactly what happens to you.
 */
export const RACER_LOOK = 7
