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
import { makeRng } from '../engine/rng'

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
 * Top speed on the opening level, in car lengths a second.
 *
 * Every level after that raises it — see `Level.limit`. Going faster is the
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
 * tank ran out about two thirds of the way through the opening level and every
 * level after it was spent almost entirely dry, coasting. Nobody was going to
 * finish level two, ever.
 *
 * Now a full tank gets you most of a level and the cans make up the rest, so
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
 * What each level asks of you beyond getting to the end.
 *
 * A distance on its own is a treadmill. A thing to *do* while covering it —
 * get past twenty of them, take three cans, arrive without a scratch — is what
 * turns a stretch of road into a level, and it gives the end of one something
 * to report other than "yes, that happened".
 */
export type Mission =
  | { kind: 'pass'; count: number }
  | { kind: 'cans'; count: number }
  | { kind: 'clean' }
  /** Finish the level in the first `place` of the field. */
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

export interface Level {
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
   * How much faster than the opening level you are allowed to go.
   *
   * The thing that actually makes later levels hard. Five levels were being
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
 * Six levels written by hand, and then as many more as anybody wants.
 *
 * They get busier rather than faster. Making the traffic quicker just shortens
 * the game; making it denser is what actually asks more of you, because the
 * gaps are the puzzle.
 *
 * The six are the ones with a shape to them — an opening, a couple of ideas,
 * and a motorway at the end with his name on it. Past that, `levelFor` keeps
 * generating them. See the note there for why they stop getting harder.
 */
export const WRITTEN: readonly Level[] = [
/*
 * Traffic counts leave room to pull out.
 *
 * They went as high as eleven, and at that density nothing could change lane
 * at all: every manoeuvre was refused for closing the last gap, so the
 * indicators never came on and the road was a set of bollards again. Busy
 * enough to be a problem, loose enough to be a road.
 *
 * Paces rise as the levels go on, which sounds backwards and is not.
 *
 * Slower traffic is *harder*: you close on it faster, so you see it for less
 * time. The gentlest level therefore has the traffic moving nearly half your
 * speed, and the difficulty later comes from how much of it there is and what
 * sort it is — a lane-changer is a different problem from a lorry.
 *
 * Counts to suit the sight line, not the other way round.
 *
 * These were three to eight when you could see thirty-four units of road. The
 * view is twenty now, so the same numbers were nearly twice as dense and the
 * third level went from one crash to eleven. Traffic is only meaningful
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

/**
 * Names for the ones nobody wrote.
 *
 * A generated level still wants to be somewhere. "Level 23" is a number;
 * "The Viaduct" is a piece of road, and it costs one array to have one.
 */
const LATER_NAMES: readonly string[] = [
  'The Ring Road', 'Cross-Town', 'The Flyover', 'Docklands', 'The Underpass',
  'The Cement Works', 'The Coast Road', 'Gridlock', 'The Viaduct',
  'Scrapyard Lane', 'The Tunnel', 'Freight Route', 'The Overpass',
  'The Old Toll Road', 'Contraflow',
]

/** Roman numerals, for the second time round the names and after. */
function lap(n: number): string {
  const marks: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let left = n
  let out = ''
  for (const [value, mark] of marks) {
    while (left >= value) {
      out += mark
      left -= value
    }
  }
  return out
}

/**
 * The level you are on, for any number at all.
 *
 * The six written ones first, then generated ones that carry on from where
 * the motorway left off. He asked for the road not to run out, and a road
 * that runs out after six is a demo.
 *
 * Everything the generator moves is capped, and the caps are the whole design.
 * A difficulty curve that rises forever does not make a game endless, it makes
 * it end at whichever level first becomes impossible — and then every level
 * after it is impossible too, which is a worse ending than a wall saying
 * "that's all". So each dial runs from where the motorway left it to a ceiling
 * a few levels later, and past that the levels stop getting harder and start
 * merely being different: a different fleet, a different job, a different
 * name. Level 12 is as hard as the road gets. Level 400 is that same road with
 * a different job on it, and that is on purpose.
 *
 * The ceilings come from the constraints written up the top of this file:
 * traffic much past nine shuts the road so nothing can change lane, and a
 * limit much past 1.7 spends the sight line faster than anybody can read it.
 */
export function levelFor(number: number): Level {
  const n = Math.max(1, Math.floor(number))
  if (n <= WRITTEN.length) return WRITTEN[n - 1]

  const past = n - WRITTEN.length
  /** Runs 0 to 1 over the six levels after the written ones, then stays there. */
  const up = Math.min(1, past / 6)

  const name = LATER_NAMES[(past - 1) % LATER_NAMES.length]
  const round = Math.floor((past - 1) / LATER_NAMES.length)

  return {
    name: round === 0 ? name : `${name} ${lap(round + 1)}`,
    traffic: 8 + Math.round(up),
    pace: 0.34 - up * 0.04,
    limit: 1.45 + up * 0.25,
    distance: 1000 + Math.round(up * 400),
    mission: laterMission(past),
    fleet: laterFleet(past),
  }
}

/**
 * What the job is on a generated level.
 *
 * Cycling the four kinds rather than picking at random, because random gives
 * you "arrive without a scratch" three levels running often enough to notice,
 * and the point of the cycle is that the next one is a different sort of
 * problem from the last one. Winning it comes round every fourth level; the
 * three in between are the ones you can do while coming fourth.
 */
function laterMission(past: number): Mission {
  switch (past % 4) {
    case 1:
      return { kind: 'pass', count: 14 + Math.min(10, past) }
    case 2:
      return { kind: 'cans', count: 2 + Math.min(2, Math.floor(past / 8)) }
    case 3:
      return { kind: 'clean' }
    default:
      return { kind: 'place', place: past % 8 === 0 ? 1 : 2 }
  }
}

/** Everything he owns, with the red ones thickening up for a few levels. */
function laterFleet(past: number): CarKind[] {
  const fleet: CarKind[] = [
    'cruiser', 'taxi', 'van', 'truck', 'bus', 'patrol', 'ambulance', 'swerver',
  ]
  for (let i = 0; i < Math.min(3, Math.floor(past / 2)); i++) fleet.push('swerver')
  return fleet
}

/**
 * Kept for the tests and the heat curve, which both want the written ones.
 *
 * Not "every level there is" any more — there is no such list now.
 */
export const LEVELS = WRITTEN

/** Speed on the dial. Nobody wants to be told they are doing 19 car lengths. */
export function kmh(speed: number): number {
  return Math.round((speed / TOP_SPEED) * 280)
}

/** What the pedal is worth on a given level. */
export function topSpeedOn(level: Level): number {
  return TOP_SPEED * level.limit
}

// --- the others in the race -------------------------------------------------

/**
 * Four of his, running the same level as you.
 *
 * The road was reported as too easy twice, and more traffic was not the
 * answer either time: traffic is an obstacle course, and an obstacle course
 * you have already solved is not hard, it is long. Somebody to beat is a
 * different thing. You can drive a clean level and still come fourth.
 *
 * Their pace is given against your top speed on the level, so they scale with
 * you rather than against the fixed number — otherwise the later levels, where
 * you are half as fast again, would leave them standing.
 *
 * The numbers look high for cars you are meant to beat, and they have to be: a
 * racer spends a good part of a level stuck behind the same traffic you are,
 * backing off and weaving, and loses far more to that than the figure
 * suggests. What actually decides a level is who gets held up least.
 *
 * They have been tuned twice. They were low while the field started strung out
 * behind you, because the head start did half the work; once everybody lined
 * up on the same grid that handicap vanished and the same numbers put the test
 * driver last in every level. These are the numbers for a standing start.
 */
/**
 * What sort of vehicle a racer is, and what sort of face it pulls.
 *
 * They have faces because a car with eyes in its windscreen is the oldest
 * trick in the animated-car business — Disney was doing it in 1952 — and
 * because a field of four identical wedges is a field of four identical
 * wedges. Each one is its own machine with its own build, its own colour and
 * its own expression, so they can be told apart at a glance and so there is
 * somebody in there to beat.
 *
 * They are ours, though. Nothing here is modelled on a character from a film:
 * this repository draws every sprite from primitives and invents every
 * character in it, which is the rule the whole project is built on.
 */
export type Build = 'stock' | 'tow' | 'coupe' | 'camper' | 'racer'
export type Face = 'keen' | 'cheerful' | 'eager' | 'sleepy' | 'grumpy' | 'sly'

export interface Racer {
  name: string
  colour: string
  trim: string
  build: Build
  face: Face
  /** Fraction of your top speed they average over a level. */
  pace: number
  /** How much they vary it, so nobody drives like a metronome. */
  swing: number
}

/**
 * Everybody who might turn out, yours included.
 *
 * Twelve rather than four, because four meant the same four every time and
 * the grid stopped being news after the second race. Four of these are drawn
 * for each level and the rest stay in the garage, so the field you line up
 * against is not the field you beat last time.
 *
 * Paces run from 0.74 to 0.92 of your top speed. The quick ones are quick
 * enough to lose to and the slow ones are somebody to catch, and which of
 * them turn up is most of what makes one race different from the next.
 */
export const ROSTER: readonly Racer[] = [
  // The single-seater. Yours to start with, and the only open-wheeler here.
  { name: 'Needle', colour: '#e4e8f0', trim: '#c99a1f', build: 'racer', face: 'eager', pace: 0.84, swing: 0.05 },
  // The quick one: a low, wide stock car that knows it is quick.
  { name: 'Piston', colour: '#e8503a', trim: '#7d1f14', build: 'stock', face: 'keen', pace: 0.88, swing: 0.06 },
  // A tow truck with a hook on the back and no business being in a race.
  { name: 'Gasket', colour: '#f2b134', trim: '#8a5f10', build: 'tow', face: 'cheerful', pace: 0.8, swing: 0.09 },
  // A little coupé, all enthusiasm.
  { name: 'Tack', colour: '#5ad2e0', trim: '#1c6570', build: 'coupe', face: 'eager', pace: 0.83, swing: 0.05 },
  // And a camper van that would rather be somewhere quiet.
  { name: 'Grinder', colour: '#9b7ede', trim: '#4a2f80', build: 'camper', face: 'sleepy', pace: 0.76, swing: 0.11 },
  { name: 'Spanner', colour: '#4f9e58', trim: '#20512a', build: 'stock', face: 'grumpy', pace: 0.86, swing: 0.07 },
  { name: 'Rivet', colour: '#3f6fd8', trim: '#1a2f66', build: 'coupe', face: 'sly', pace: 0.85, swing: 0.06 },
  { name: 'Cinder', colour: '#2f3440', trim: '#8e9099', build: 'racer', face: 'grumpy', pace: 0.89, swing: 0.04 },
  { name: 'Bracket', colour: '#c97f4a', trim: '#5c3418', build: 'tow', face: 'keen', pace: 0.78, swing: 0.1 },
  { name: 'Nugget', colour: '#f0d26a', trim: '#8a7018', build: 'coupe', face: 'cheerful', pace: 0.82, swing: 0.08 },
  { name: 'Pylon', colour: '#7d8794', trim: '#343a44', build: 'camper', face: 'sleepy', pace: 0.74, swing: 0.12 },
  { name: 'Cog', colour: '#d94f8c', trim: '#6b1f42', build: 'stock', face: 'sly', pace: 0.87, swing: 0.07 },
]

/** What you are driving until you choose otherwise. */
export const DEFAULT_CAR = ROSTER[0].name

export function carNamed(name: string | undefined): Racer {
  return ROSTER.find((car) => car.name === name) ?? ROSTER[0]
}

/** You and four of his. */
export const FIELD_SIZE = 5

/**
 * Which four turn out for this one.
 *
 * Drawn from the roster minus whichever one you are driving, because the one
 * thing worse than racing the same four every time is racing yourself.
 * Seeded, so a level replays the same way twice — the road already works like
 * that, and a field that changed on every retry would make a level impossible
 * to learn.
 *
 * Not four at random, though, and that is the part worth explaining. A
 * straight draw from twelve hands you the four quickest often enough to
 * matter: the test driver was beaten by forty seconds on the last level the
 * first time this ran, because the dice gave it a field averaging nearly nine
 * tenths of its own top speed. Nothing was wrong with any car in it. The
 * problem is that "random" and "a fair race" are different requests, and he
 * asked for both.
 *
 * So the roster is sorted by pace, cut into as many bands as there are places
 * to fill, and one car is drawn from each band. Every field has somebody quick
 * in it and somebody you can catch, which is what makes a race worth driving;
 * which quick one and which slow one is still anybody's guess.
 */
export function fieldFor(seed: number, yours: string): Racer[] {
  const pool = [...ROSTER]
    .filter((car) => car.name !== yours)
    .sort((a, b) => b.pace - a.pace)
  const rng = makeRng(seed * 2654435761 + 1)
  const want = FIELD_SIZE - 1

  const picked: Racer[] = []
  for (let band = 0; band < want; band++) {
    const from = Math.floor((band * pool.length) / want)
    const to = Math.max(from + 1, Math.floor(((band + 1) * pool.length) / want))
    picked.push(pool[from + rng.int(0, to - from - 1)])
  }
  return picked
}

/**
 * The grid.
 *
 * Everybody is on it before the lights, nobody arrives from behind, and
 * nothing moves until they go out. That is the thing that needed fixing
 * first: the field used to be strung out down the road and came past in the
 * opening seconds, which from the driving seat is four cars appearing out of
 * nowhere and one of them hitting you.
 *
 * It is laid out the way a real one is, which is two columns rather than a
 * line. Five cars will not fit across four lanes: put them all on the line
 * and two of them have to straddle a white line, which takes up two lanes
 * each — so three quarters of the road is shut at the start, and a car that
 * never quite tidies itself up keeps a lane shut for the whole race. One line
 * was tried and that is exactly what it did.
 *
 * So: odd positions in the left column, even in the right, each one set back
 * half a row from the one in front, and the boxes painted on the tarmac with
 * the position in them. The two outside lanes are left empty, which is where
 * everybody goes the moment the lights go out.
 *
 * Who stands where is the order you finished the last one in — see
 * `gridOf` in `run.ts`. Win and you start on pole with nothing in front of
 * you; come last and you have the lot of them to get past. That is the loop
 * the whole thing hangs on, and it is why the grid is worth painting.
 */
export interface Slot {
  lane: number
  /** Rows up the grid, in units of `GRID_ROW`. Bigger is further forward. */
  row: number
}

/**
 * Where a given finishing position stands.
 *
 * Measured from the back of the grid so that the last slot is row zero and
 * everything else is in front of it. `gridOf` then rebases the lot against
 * wherever *you* are standing, because you are the origin of the road's
 * coordinates and everything is drawn relative to you.
 */
export function slotFor(place: number): Slot {
  const i = Math.max(1, Math.min(FIELD_SIZE, Math.round(place))) - 1
  return {
    // Odd places on the left of the pair, even on the right, leaving the two
    // outside lanes clear for the first move anybody makes.
    lane: i % 2 === 0 ? 1 : 2,
    /*
     * A whole row back per position, not half of one.
     *
     * Half a row is what a real grid looks like and it does not work here,
     * for a reason that is entirely about the cars rather than the picture.
     * Two positions apart is the same column, so a half-row stagger puts the
     * car in front of you in your own lane 3.5 lengths away — inside
     * `RACER_LOOK`, which is the distance at which a racer decides it is
     * following something and backs off. Every car on the grid read the car
     * two places ahead as traffic, the whole field crept away from the lights
     * at walking pace, and the test driver finished twenty-six seconds down
     * having done nothing wrong.
     *
     * A full row puts the same-column gap at exactly twice that, which is
     * what the old fixed grid used and what the field is tuned around. The
     * two columns are still offset from each other, so it still reads as a
     * grid rather than as a queue.
     */
    row: FIELD_SIZE - 1 - i,
  }
}

/** How far back each row sits, in car lengths. */
export const GRID_ROW = CAR_LONG * 1.6

/**
 * The lights.
 *
 * Three of them, a second apart, and then green. A standing start needs a
 * moment of nothing happening before it or it is not a start, it is just the
 * screen appearing — and the moment is what makes the first corner worth
 * arriving at.
 */
export const LIGHTS = 3
export const LIGHT_EVERY = 1
export const COUNTDOWN = LIGHTS * LIGHT_EVERY

/** How quickly a racer changes lane. Quicker than traffic; they mean it. */
export const RACER_STEER = 2.6

/**
 * How close a racer gets to something before backing off, in car lengths.
 *
 * They are not allowed to crash — a field that wipes itself out in the first
 * level is no race at all — so instead they slow down, look for a lane, and
 * lose time. Which is exactly what happens to you.
 */
export const RACER_LOOK = 7
