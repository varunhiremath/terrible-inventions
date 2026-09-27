/**
 * A drive, being played.
 *
 * Fixed step, pure: the same state and the same input always give the same
 * next state, which is what lets the whole thing be tested without a screen.
 *
 * The one rule worth stating up front, because every other game in here got
 * caught out by its absence: **the road is never completely blocked**. A wall
 * of traffic across all four lanes is not difficulty, it is a coin toss you
 * lose, and the spawner refuses to build one. There is a test that drives into
 * every stage looking for one anyway.
 */
import { makeRng, type Rng } from '../engine/rng'
import {
  ACCELERATION, BRAKING, BURN_PER_SECOND, CAN_EVERY, CAN_WORTH, CAR_LONG, CAR_WIDE,
  COUNTDOWN, DASHES, DRAG, FIELD, GRID, GRID_ROW, LANES, LENGTH_OF, LIGHT_EVERY,
  MISSION_BONUS, POLE, RACER_LOOK, RACER_STEER,
  REACT, SIGHT, SIGNAL_FOR, STEER_RATE, TANK, TOP_SPEED, WANDERS, WIDTH_OF,
  stageFor, topSpeedOn, type CarKind, type Racer, type Stage,
} from './level'

export const FIXED = 1 / 60
export const STARTING_LIVES = 3

/** How long you cannot be hit for after coming back from a crash. */
export const MERCY = 2

/**
 * And how long after the lights go out.
 *
 * Five cars leave a four-lane grid three quarters of a lane apart, so the
 * first second is all of them finding a lane at once with inches in it. A
 * nudge in that second is not a mistake anybody made, and taking a life for
 * it turned the opening of every stage into a coin toss — the first go at
 * this grid lost one at the lights in every single run.
 */
export const START_MERCY = 1.6

export type RoadEvent =
  | 'pass' | 'can' | 'crash' | 'dry' | 'stageDone' | 'skid' | 'warn' | 'siren'
  /** One of the three lights coming on. */
  | 'light'
  /** And them going out. */
  | 'green'

export interface Input {
  left: boolean
  right: boolean
  go: boolean
  brake: boolean
}

export const NO_INPUT: Input = { left: false, right: false, go: false, brake: false }

export interface Car {
  id: number
  /** Where it is along the road, ahead of you. */
  y: number
  lane: number
  speed: number
  kind: CarKind
  /** A swerver's chosen lane. It only ever moves towards this. */
  wants: number
  /**
   * Which way it is indicating, and for how much longer.
   *
   * A vehicle decides, indicates, and only then pulls out. Nothing moves
   * sideways without having signalled first.
   */
  signal: -1 | 0 | 1
  signalFor: number
  /** A patrol that has been overtaken gets its dander up for a moment. */
  roused: number
}

export interface Can {
  id: number
  y: number
  lane: number
  taken: boolean
}

/**
 * One of the four you are racing.
 *
 * A racer is not traffic. Traffic exists to be in the way and all of it moves
 * at one pace, which is what freezes the geometry and keeps the road passable.
 * A racer moves at its own speed, weaves, backs off and puts its foot down —
 * and the one rule it must never break is the road's promise: it will not sit
 * in the last open lane of the stretch you are arriving in. That rule is in
 * `steerRacer`, and there is a test that plays every stage watching for it.
 */
export interface Racing {
  id: number
  who: Racer
  /** Where it is along the road, in the same units as your distance. */
  y: number
  lane: number
  wants: number
  speed: number
  signal: -1 | 0 | 1
  signalFor: number
  /**
   * The clock reading when it crossed the line, once it has.
   *
   * A time, not a distance. It was a distance, which was fine while the only
   * question was who was in front and useless the moment the finish had to
   * say how long anybody took.
   */
  finished: number | null
}

export type Status = 'driving' | 'crashed' | 'stageDone' | 'gameOver'

/**
 * A recorded run: where the car was, every so often, from the lights.
 *
 * Two flat arrays rather than an array of pairs. It is stored in a save file
 * that gets written on every change, and halving the number of objects in it
 * is worth the small ugliness.
 */
export interface Trail {
  /** Seconds from the lights. */
  at: number[]
  /** How far down the road, and which lane. */
  gone: number[]
  lane: number[]
}

/** How often the trail is sampled, in seconds. */
export const TRAIL_EVERY = 0.25

export const noTrail = (): Trail => ({ at: [], gone: [], lane: [] })

/**
 * Where a recorded run had got to at a given moment.
 *
 * Interpolated between samples, so a ghost drawn from four samples a second
 * still moves smoothly at sixty frames a second. Returns null before the run
 * started and after it finished — a ghost that hangs about on the line after
 * crossing it is a ghost that looks like a bug.
 */
export function ghostAt(trail: Trail, clock: number): { gone: number; lane: number } | null {
  const n = trail.at.length
  if (n === 0 || clock < trail.at[0] || clock > trail.at[n - 1]) return null
  // Walking it is fine: a stage is a few hundred samples and this runs once a
  // frame. A binary search here would be arithmetic nobody has to read.
  let i = 1
  while (i < n && trail.at[i] < clock) i += 1
  const from = i - 1
  const span = trail.at[i] - trail.at[from] || 1
  const part = (clock - trail.at[from]) / span
  return {
    gone: trail.gone[from] + (trail.gone[i] - trail.gone[from]) * part,
    lane: trail.lane[from] + (trail.lane[i] - trail.lane[from]) * part,
  }
}

export interface Run {
  stage: Stage
  number: number
  /** How far you have come, in car lengths. Everything else is relative to it. */
  distance: number
  /** Sideways, 0 to LANES-1, and fractional while you are changing lanes. */
  lane: number
  speed: number
  fuel: number
  cars: Car[]
  cans: Can[]
  racers: Racing[]
  score: number
  passed: number
  /** For the mission: cans taken and scrapes collected on this stage. */
  cansTaken: number
  pranged: number
  missionDone: boolean
  /** Whether the low-fuel warning has already been given. */
  warned: boolean
  lives: number
  status: Status
  /** Counts down after a crash, while he gets going again. */
  stunned: number
  /**
   * Seconds of grace after getting going again, during which nothing can hit
   * you.
   *
   * Needed the moment the field arrived. A crash puts you back on the road
   * exactly where you were, and there are now four racers around you doing
   * ninety — so you came back, were hit in the same tenth of a second, came
   * back again, and a test with ninety-nine lives watched all ninety-nine go
   * in about four seconds. The traffic never did this because it is cleared
   * ahead of you on the way back in; the field cannot be, because moving the
   * other racers would be moving the race.
   */
  mercy: number
  events: RoadEvent[]
  seed: number
  nextId: number
  /** How far ahead the last wave was put, so the next one keeps its distance. */
  lastWave: number
  /** Seconds until another can of fuel may appear. */
  canCooldown: number
  /** How many racers were already over the line when you crossed it. */
  place: number
  /**
   * Seconds since the lights went out, and the seconds before they do.
   *
   * The clock is the race: it is what the finish is reported in, what a best
   * time is measured in, and the only number that can be compared with
   * yesterday's. Nothing moves while `countdown` is running.
   */
  clock: number
  countdown: number
  /** The clock reading when you crossed the line. */
  yourTime: number | null
  /**
   * Where you have been, sampled, so the run can be raced against later.
   *
   * This is the closest thing to playing together that needs no server at all:
   * one of you drives and the other races what they did. Kept coarse — a
   * handful of samples a second — because it has to fit in a save file and
   * because a car's position between two tenths of a second is not
   * interesting.
   */
  trail: Trail
  /**
   * How much this car's tank holds.
   *
   * On the run rather than a constant because the workshop sells a bigger one,
   * and a bigger tank that the next can of fuel quietly caps back to the
   * standard size is not a bigger tank.
   */
  tank: number
}

export function newRun(number = 1, lives = STARTING_LIVES, score = 0, seed = 1): Run {
  const stage = stageFor(number)
  return {
    stage,
    number,
    distance: 0,
    // Your grid slot: front row, a lane of your own.
    lane: POLE.lane,
    speed: 0,
    fuel: TANK,
    tank: TANK,
    cars: [],
    cans: [],
    racers: gridOf(stage),
    score,
    passed: 0,
    cansTaken: 0,
    pranged: 0,
    missionDone: false,
    warned: false,
    lives,
    status: 'driving',
    stunned: 0,
    mercy: 0,
    events: [],
    seed,
    nextId: 1,
    lastWave: 0,
    place: 1,
    clock: 0,
    countdown: COUNTDOWN,
    yourTime: null,
    trail: noTrail(),
    canCooldown: CAN_EVERY * 0.4,
  }
}

/** Back on the road after a crash, with the traffic ahead cleared out of the way. */
export function resume(run: Run): Run {
  return {
    ...run,
    status: 'driving',
    speed: 0,
    stunned: 0,
    mercy: MERCY,
    /*
     * The clock keeps running. A crash costs you the time it costs you, which
     * is the whole reason a time is worth recording — one that stopped for
     * every prang would say nothing about the drive.
     */
    lane: 1.5,
    events: [],
    // Enough in the tank to get going again. Coming back with an empty one
    // would just lose the next life to the same thing.
    fuel: Math.max(run.fuel, run.tank * 0.55),
    // Anything close enough to hit again is gone. Being dropped back in front
    // of the same car you just hit is how a game loses somebody for good.
    cars: run.cars.filter((car) => car.y - run.distance > SIGHT * 0.6),
  }
}

/** The lanes something is sitting across, given where it is and how wide. */
function occupies(lane: number, wide = CAR_WIDE): [number, number] {
  return [lane - wide / 2, lane + wide / 2]
}

const spread = (car: Car) => occupies(car.lane, WIDTH_OF[car.kind])
const longOf = (car: Car) => CAR_LONG * LENGTH_OF[car.kind]

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

/**
 * Which lanes are blocked in the stretch a driver is about to arrive in.
 *
 * Used by the spawner to keep a way through, and by the test that checks it
 * kept one.
 */
export function blockedLanes(cars: readonly Car[], from: number, to: number): Set<number> {
  const blocked = new Set<number>()
  for (const car of cars) {
    if (car.y + longOf(car) < from || car.y > to) continue
    for (let lane = 0; lane < LANES; lane++) {
      if (overlaps(occupies(lane), spread(car))) blocked.add(lane)
    }
  }
  return blocked
}

/**
 * Put a wave of traffic on the road, a long way ahead.
 *
 * At most three of the four lanes, always, and never a set that closes the
 * last gap left by the wave before it. That second part is the one that
 * matters: two legal waves, one behind the other, can still add up to a wall.
 */
function spawnWave(run: Run, rng: Rng): void {
  const ahead = run.distance + SIGHT * 1.4 + rng.next() * SIGHT * 0.5
  const free = new Set<number>()
  for (let lane = 0; lane < LANES; lane++) free.add(lane)

  /*
   * Checked over the same stretch the promise is made over.
   *
   * This used to look three car lengths either side of the new wave, while
   * the promise — that a driver always has somewhere to go — is about the
   * whole stretch he is arriving into, twenty lengths of it. Two waves could
   * each be perfectly legal, land ten lengths apart, and add up to a wall that
   * neither of them could see coming.
   */
  const guard = SIGHT * 0.7
  for (const lane of blockedLanes(run.cars, ahead - guard, ahead + CAR_LONG * 2 + guard)) {
    free.delete(lane)
  }
  // The open lane is not on offer, whatever else is going on.
  // Always somewhere to go: one lane of the window is left empty.
  if (free.size <= 1) return

  /*
   * How many of the remaining lanes to use.
   *
   * The open lane is already off the list, so filling every lane that is left
   * is still a road with a way through. This used to subtract one *again* on
   * top of that, which on a four-lane road with one lane reserved meant it
   * frequently decided to spawn nothing at all.
   */
  const want = Math.max(1, Math.min(free.size - 1, 1 + rng.int(0, 2)))
  const lanes = [...free].sort(() => rng.next() - 0.5).slice(0, want)

  for (const lane of lanes) {
    const fleet = run.stage.fleet
    const kind = fleet[rng.int(0, fleet.length - 1)]
    run.cars.push({
      id: run.nextId++,
      y: ahead + rng.next() * CAR_LONG * 2,
      lane,
      /*
       * One pace for everything on the road, whatever it is.
       *
       * A bus travelling at a hatchback's speed is a small lie and it buys the
       * whole game: vehicles at different speeds drift relative to each other,
       * and drift turns two perfectly legal waves into a wall a hundred
       * lengths later. That has been the cause of every blocked road in here.
       * With one pace the geometry is frozen the moment it is laid down. The
       * variety comes from what the things are and from them changing lanes,
       * not from how fast they go.
       */
      speed: topSpeedOn(run.stage) * run.stage.pace,
      kind,
      wants: lane,
      signal: 0,
      signalFor: 0,
      roused: 0,
    })
  }
  run.lastWave = ahead
}

function spawnCan(run: Run, rng: Rng): void {
  const ahead = run.distance + SIGHT * 1.3
  const free: number[] = []
  const blocked = blockedLanes(run.cars, ahead - CAR_LONG * 2, ahead + CAR_LONG * 2)
  for (let lane = 0; lane < LANES; lane++) if (!blocked.has(lane)) free.push(lane)
  if (free.length === 0) return
  run.cans.push({
    id: run.nextId++,
    y: ahead,
    lane: free[rng.int(0, free.length - 1)],
    taken: false,
  })
}

/**
 * What the traffic does.
 *
 * All of it happens outside the reaction window, and that is the whole of the
 * rule. A swerver goes looking for the lane you are in; everything else pulls
 * out now and then for reasons of its own, which is what makes traffic traffic
 * rather than a row of bollards. But the moment a vehicle is inside the
 * stretch you are about to arrive in, it is locked to its lane and stays
 * there. A car that moves after you have committed to a gap is not a hazard,
 * it is a trick.
 *
 * And no move may close the last way through. There used to be a whole lane
 * kept permanently empty to guarantee that, which was simple and correct and
 * far too kind — five stages were being finished without a scratch. Checking
 * each move instead keeps the promise without handing over a free lane to sit
 * in.
 */
function moveOver(run: Run, car: Car, dt: number, rng: Rng): void {
  const ahead = car.y - run.distance

  const moving = Math.abs(car.wants - car.lane) >= 0.01

  /*
   * Inside the stretch he is arriving in, nothing *starts* a manoeuvre.
   *
   * One that is already under way finishes it, and that is deliberate: the
   * indicator has been on for most of a second and the thing is visibly
   * halfway across, so completing is the readable outcome. Freezing it instead
   * — which is what this did first — leaves a vehicle straddling two lanes and
   * blocking both, and the road-is-never-blocked test caught exactly that on
   * the opening stage.
   */
  if (ahead <= REACT && !moving) {
    car.signal = 0
    car.signalFor = 0
    return
  }

  /**
   * Would putting this one in `lane` leave its stretch with no way through?
   *
   * Counting the lane it is leaving as well as the one it is joining: for the
   * second or so of the manoeuvre it is across both, and a check that only
   * looked at the destination was quietly allowing the road to close while the
   * move was in progress.
   */
  const shuts = (lane: number): boolean => {
    /*
     * The promise is about every window the driver might arrive in, and his
     * window slides — so checking one window is not enough, and checking one
     * twice the size refuses everything. This samples the run of windows that
     * overlap this vehicle and requires a way through in all of them.
     *
     * Getting this wrong went both ways in one sitting: too wide and the
     * traffic stopped changing lanes at all (caught by the indicator test
     * having nothing to watch), too narrow and the road closed (caught by the
     * blocked-road test).
     */
    const others = run.cars.filter((c) => c.id !== car.id)
    const mine = new Set([lane, Math.round(car.lane)])
    const first = car.y + longOf(car) - REACT
    const last = car.y
    for (let i = 0; i <= 4; i++) {
      const from = first + ((last - first) * i) / 4
      const blocked = blockedLanes(others, from, from + REACT)
      for (const own of mine) blocked.add(own)
      if (blocked.size >= LANES) return true
    }
    return false
  }

  const settled = !moving

  // Indicating: count it down, and pull out when it has run.
  if (settled && car.signalFor > 0) {
    car.signalFor -= dt
    if (car.signalFor <= 0) {
      const want = Math.min(LANES - 1, Math.max(0, Math.round(car.lane) + car.signal))
      // Checked again at the moment of moving, not only when it was decided:
      // the road has had most of a second to change since then.
      if (want !== Math.round(car.lane) && !shuts(want)) car.wants = want
      else car.signal = 0
      car.signalFor = 0
    }
    return
  }

  // Deciding: a swerver goes looking for the lane you are in, the rest pull
  // out for reasons of their own. Either way it indicates first.
  if (settled && car.signal === 0 && rng.next() < WANDERS[car.kind] * dt) {
    const target = car.kind === 'swerver'
      ? Math.round(run.lane)
      : Math.round(car.lane) + (rng.next() < 0.5 ? -1 : 1)
    const want = Math.min(LANES - 1, Math.max(0, target))
    if (want !== Math.round(car.lane) && !shuts(want)) {
      car.signal = want > car.lane ? 1 : -1
      car.signalFor = SIGNAL_FOR
    }
  }

  if (moving) {
    const way = Math.sign(car.wants - car.lane)
    const moved = car.lane + way * STEER_RATE * DASHES[car.kind] * dt
    car.lane = way > 0 ? Math.min(car.wants, moved) : Math.max(car.wants, moved)
    if (Math.abs(car.wants - car.lane) < 0.01) car.signal = 0
  }
}

/** Did he do the job as well as get there? */
export function missionMet(run: Run): boolean {
  const mission = run.stage.mission
  if (mission.kind === 'pass') return run.passed >= mission.count
  if (mission.kind === 'cans') return run.cansTaken >= mission.count
  if (mission.kind === 'place') return placeOf(run) <= mission.place
  return run.pranged === 0
}


// --- the field ---------------------------------------------------------------

/** The four of them, lined up behind you at the start of a stage. */
export function gridOf(_stage: Stage): Racing[] {
  return FIELD.map((who, i) => ({
    id: 1000 + i,
    who,
    y: GRID[i].row * GRID_ROW,
    lane: GRID[i].lane,
    wants: GRID[i].lane,
    speed: 0,
    signal: 0 as -1 | 0 | 1,
    signalFor: 0,
    finished: null,
  }))
}

/** Where you are in the race: first is 1. */
export function placeOf(run: Run): number {
  return 1 + run.racers.filter((r) => r.finished !== null || r.y > run.distance).length
}

/**
 * When somebody will cross the line, in seconds from the lights.
 *
 * Their real time if they are already over it. Otherwise the clock now plus
 * however long the road they have left would take at the speed they are doing
 * — an estimate, and the only honest one available: the stage ends when *you*
 * cross the line, so the rest of the field genuinely has not finished yet. It
 * is what a television graphic does at the flag, for the same reason.
 */
export function timeOf(run: Run, racer: Racing): number {
  if (racer.finished !== null) return racer.finished
  const left = run.stage.distance - racer.y
  if (left <= 0) return run.clock
  /*
   * Worked out from the pace it has kept, not the speed it happens to be
   * doing at the flag.
   *
   * The first version used the instantaneous speed, and a car that was sat
   * behind a lorry at the moment you crossed the line got a projected finish
   * of nearly forty seconds later — it printed "+37.95s" next to a car that
   * was a few lengths behind. Average pace cannot do that: it is what the car
   * has actually managed over the whole race, which is the right guess for
   * what it will manage over the rest of it.
   */
  const pace = run.clock > 0 ? racer.y / run.clock : 0
  return run.clock + left / Math.max(1, pace)
}

/**
 * Which lanes the field is taking up in a stretch of road.
 *
 * The same shape as `blockedLanes` for traffic, and deliberately the same
 * definition used by the rule below and by the test that checks the rule. The
 * first version had the game measuring a racer as 0.62 of a lane wide and the
 * test measuring it as 0.81, so the two disagreed about whether the road was
 * shut and the failure was in neither of them.
 */
export function racerLanes(
  racers: readonly Racing[],
  from: number,
  to: number,
  except?: number,
): Set<number> {
  const blocked = new Set<number>()
  for (const racer of racers) {
    if (racer.id === except || racer.finished !== null) continue
    if (racer.y + CAR_LONG < from || racer.y > to) continue
    for (let lane = 0; lane < LANES; lane++) {
      if (overlaps(occupies(lane), occupies(racer.lane))) blocked.add(lane)
    }
  }
  return blocked
}

/** The order at the end of a stage, you included, best first. */
export interface Standing {
  name: string
  you: boolean
  /** Seconds from the lights to the line. */
  at: number
  /** Whether that time is a real one or a projection from the flag. */
  estimated: boolean
}

export function standings(run: Run): Standing[] {
  const rows: Standing[] = run.racers.map((r) => ({
    name: r.who.name,
    you: false,
    at: timeOf(run, r),
    estimated: r.finished === null,
  }))
  rows.push({
    name: 'You',
    you: true,
    at: run.yourTime ?? run.clock,
    estimated: run.yourTime === null,
  })
  // Quickest first, which for a time is the other way round from a distance.
  return rows.sort((a, b) => a.at - b.at)
}

/**
 * The nearest solid thing in front of a racer in a given lane, and how fast it
 * is going.
 *
 * The speed is the half that was missing first time round. Knowing only how
 * far away something is, a racer slows to a fraction of the traffic's pace and
 * carries on creeping into it; knowing how fast it is going, it can sit behind
 * it at the same speed, which is what following actually is.
 */
function aheadOf(run: Run, racer: Racing, lane: number): { gap: number; speed: number } {
  let nearest = Infinity
  let pace = Infinity
  const mine = occupies(lane)
  const note = (gap: number, speed: number) => {
    if (gap >= nearest) return
    nearest = gap
    pace = speed
  }
  /*
   * Level does not count as ahead.
   *
   * Two cars at the same point in the same lane each read the other as
   * something to follow, each matched the other's speed, and the pair of them
   * crawled the whole race at less than a mile an hour. You cannot follow
   * something that is beside you.
   */
  const LEVEL = CAR_LONG * 0.8
  for (const car of run.cars) {
    const gap = car.y - racer.y
    if (gap < LEVEL || gap > RACER_LOOK * 2) continue
    if (overlaps(mine, spread(car))) note(gap, car.speed)
  }
  // And each other, so they do not drive through their own field.
  for (const other of run.racers) {
    if (other.id === racer.id) continue
    const gap = other.y - racer.y
    if (gap < LEVEL || gap > RACER_LOOK * 2) continue
    if (overlaps(mine, occupies(other.lane))) note(gap, other.speed)
  }
  /*
   * And you.
   *
   * Left out of the first version, with the obvious consequence: the field
   * starts behind you, catches you in the first few seconds and drives
   * straight into the back of you. Five tests failed at once and every one of
   * them was this. A racer has to see the player as an obstacle like any
   * other — it will back off, look for a lane, and lose time doing it.
   */
  const yours = run.distance - racer.y
  if (yours >= LEVEL && yours <= RACER_LOOK * 2 && overlaps(mine, occupies(run.lane))) {
    note(yours, run.speed)
  }
  return { gap: nearest, speed: pace }
}

/** How far ahead a racer is looking, which depends on how fast it is going. */
function lookFor(racer: Racing): number {
  return Math.max(RACER_LOOK, (racer.speed * racer.speed) / (2 * BRAKING) + CAR_LONG * 2)
}

/**
 * A racer picks its lane, and gives way to the road's promise.
 *
 * Two jobs. The first is ordinary racing: look down your own lane, and if
 * something is close, take the lane with the most room. The second is the one
 * that matters and is the reason this function is worth reading — **a racer
 * will not sit in the last lane left open by the traffic in the stretch the
 * player is arriving in.**
 *
 * Without that rule the whole promise this game is built on falls over. The
 * traffic spawner guarantees a way through by leaving a lane empty in every
 * window; a racer is not traffic, moves at its own speed, and can therefore
 * drift into exactly that lane and close it — and because it is moving
 * relative to everything else, no check made when it was put on the road would
 * have caught it. It is the same lesson as the drifting rubble and the
 * different-speed traffic, arriving for the third time: nothing may move
 * relative to a guarantee that was measured once.
 *
 * So instead of freezing the racer, which would ruin the race, the guarantee
 * is enforced continuously, on the one body that can break it.
 */
function steerRacer(run: Run, racer: Racing, dt: number): void {
  /*
   * The stretch the player is arriving in: from just in front of their bumper
   * out to the far edge of their reaction window. Starting it at their own
   * position counted cars level with them and behind them, which are not in
   * the way of anywhere they are going.
   */
  const window: [number, number] = [run.distance + CAR_LONG, run.distance + REACT]
  const insideWindow = racer.y + CAR_LONG >= window[0] && racer.y <= window[1]

  /*
   * What is shut, counting the traffic and the rest of the field.
   *
   * Counting only the traffic was not enough: two racers, each seeing two
   * lanes open, could sit in both and close the road between them without
   * either one breaking the rule on its own. The test found it on the fourth
   * stage inside four seconds.
   */
  const shut = blockedLanes(run.cars, window[0], window[1])
  for (const lane of racerLanes(run.racers, window[0], window[1], racer.id)) shut.add(lane)
  const open: number[] = []
  for (let lane = 0; lane < LANES; lane++) if (!shut.has(lane)) open.push(lane)
  const lastOpen = open.length === 1 ? open[0] : null

  const here = Math.round(racer.lane)
  const moving = Math.abs(racer.wants - racer.lane) >= 0.01
  const wouldShut = (lane: number) =>
    insideWindow && lastOpen !== null && overlaps(occupies(lane), occupies(lastOpen))

  /*
   * Alongside you, and therefore not allowed to come across.
   *
   * A racer only ever looked *ahead* down a lane, which was enough while the
   * field started strung out behind. On a grid it is not: five cars set off
   * three quarters of a lane apart, and the first thing each of them wants is
   * a proper lane — so they converge, and the one beside you converges into
   * you. From the driving seat that is a car appearing out of nowhere and
   * taking a life, which is the fault this grid was meant to fix.
   */
  const alongside = Math.abs(racer.y - run.distance) < CAR_LONG * 1.8
  const intoYou = (lane: number) =>
    alongside && overlaps(occupies(lane), occupies(run.lane))

  /*
   * And not into one of its own either.
   *
   * Without this, two of them leaving the grid picked the same lane in the
   * same instant — the only one left that was not beside the player — and
   * ended the race stacked on top of each other doing walking pace.
   */
  const intoOther = (lane: number) =>
    run.racers.some(
      (other) =>
        other.id !== racer.id &&
        other.finished === null &&
        Math.abs(other.y - racer.y) < CAR_LONG * 1.8 &&
        overlaps(occupies(lane), occupies(other.lane)),
    )

  // Already in it, or heading into it: get out, whether or not a move is under
  // way. Waiting for the current move to finish was the other half of the gap.
  const mustLeave =
    wouldShut(racer.lane) || (moving && (wouldShut(racer.wants) || intoYou(racer.wants)))

  if (!moving || mustLeave) {
    // Judged from where it actually is, not from the lane it rounds to. On
    // the grid a car sits three quarters of a lane over, and rounding put it
    // in a lane it was not in — one that happened to contain the player, so
    // two of the field sat on the line waiting for a car that was not in
    // front of them to move. They finished the race at nought miles an hour.
    const room = aheadOf(run, racer, racer.lane).gap
    if (mustLeave || room < lookFor(racer)) {
      let best = here
      let most = mustLeave ? -Infinity : room
      for (const lane of [here - 1, here + 1, here - 2, here + 2]) {
        if (lane < 0 || lane > LANES - 1) continue
        // Never into the last lane left open, if the player is about to need
        // it, and never across the player while level with them.
        if (wouldShut(lane) || intoYou(lane) || intoOther(lane)) continue
        const there = aheadOf(run, racer, lane).gap
        if (there > most) { most = there; best = lane }
      }
      /*
       * Only if there is somewhere better to be. Forcing the move when the
       * search found nothing meant re-targeting the lane it was already in,
       * over and over, which cancelled its own indicator every slice.
       */
      if (best !== here) {
        racer.wants = best
        racer.signal = best === here ? 0 : best > here ? 1 : -1
        /*
         * An ordinary move is indicated first and made afterwards, like
         * everything else on this road. Getting out of the last open lane is
         * not an ordinary move: half a second of indicating politely is half a
         * second with the road shut, which is exactly what the rule exists to
         * prevent. It still shows the indicator — it just does not wait.
         */
        racer.signalFor = best === here || mustLeave ? 0 : SIGNAL_FOR
      }
    }
  }

  /*
   * Straightening up.
   *
   * A grid slot is three quarters of a lane over, so a car that leaves the
   * line and never thinks about it again spends the whole race straddling a
   * white line — which looks wrong and, worse, takes up two lanes of a
   * four-lane road for as long as it lasts. Once there is room, it tidies
   * itself into the nearest proper lane.
   */
  if (Math.abs(racer.wants - racer.lane) < 0.01) {
    const tidy = Math.min(LANES - 1, Math.max(0, Math.round(racer.lane)))
    const askew = Math.abs(racer.lane - tidy) > 0.01
    if (askew && !wouldShut(tidy) && !intoYou(tidy) && !intoOther(tidy)) {
      racer.wants = tidy
      racer.signal = tidy > racer.lane ? 1 : -1
      racer.signalFor = SIGNAL_FOR * 0.5
    }
  }

  if (racer.signalFor > 0) {
    racer.signalFor = Math.max(0, racer.signalFor - dt)
    // It indicates first and pulls out afterwards, like everything else here.
    if (racer.signalFor > SIGNAL_FOR * 0.45) return
  }

  if (Math.abs(racer.wants - racer.lane) < 0.01) {
    racer.lane = racer.wants
    racer.signal = 0
    return
  }
  const way = Math.sign(racer.wants - racer.lane)
  racer.lane = Math.abs(racer.wants - racer.lane) <= RACER_STEER * dt
    ? racer.wants
    : racer.lane + way * RACER_STEER * dt
}

/** One racer, one slice. */
function driveRacer(run: Run, racer: Racing, dt: number, clock: number): void {
  if (racer.finished !== null) return

  steerRacer(run, racer, dt)

  /*
   * Its pace, with a wobble on it.
   *
   * The wobble is what the road was missing: traffic at one speed is a moving
   * wall to be threaded, and a field of four metronomes would be the same
   * thing with names on. A racer that is a little quicker on one straight and
   * a little slower on the next is a racer you can catch, and lose again.
   */
  const target =
    topSpeedOn(run.stage) * racer.who.pace * (1 + Math.sin(clock * 0.7 + racer.id) * racer.who.swing)

  /*
   * Something close in its own lane and nowhere to go: follow it rather than
   * drive through it. Losing time is how a racer pays for being blocked, and
   * it is exactly what happens to you.
   *
   * The first version slowed to a fraction of the traffic's pace, which is
   * still forwards — so a racer stuck behind the player crept into the back of
   * them and took one of their lives. It matches the speed of whatever it is
   * following now, and closes the last of the gap at nothing at all.
   */
  const { gap, speed: theirs } = aheadOf(run, racer, racer.lane)
  /*
   * How fast it can be going and still stop in the room it has.
   *
   * A flat look-ahead of seven lengths was the first try, and at eighteen
   * lengths a second a car needs ten to stop: it simply could not, so it went
   * into the back of whatever it was following, which on the fifth stage was
   * usually the player. This is the ordinary safe-following sum — the speed
   * from which the room left brings you to the speed of the thing in front.
   */
  const room = Math.max(0, gap - CAR_LONG * 1.6)
  const safe = Math.sqrt(2 * BRAKING * 0.8 * room) + Math.max(0, theirs)
  const capped = Math.min(target, safe)

  racer.speed = capped > racer.speed
    ? Math.min(capped, racer.speed + ACCELERATION * dt)
    : Math.max(capped, racer.speed - BRAKING * dt)
  racer.speed = Math.max(0, Math.min(topSpeedOn(run.stage) * 1.05, racer.speed))
  const was = racer.y
  racer.y += racer.speed * dt

  /*
   * And a bumper, because arithmetic is not a promise.
   *
   * However good the sum above is, one bad slice — a car changing lane into
   * the gap, the player braking hard — can still put a racer inside the thing
   * it is following. It cannot be allowed to end a slice overlapping the
   * player: that is a life lost to something the player could not have
   * avoided. So it is stopped short instead.
   */
  const onto = run.distance - racer.y
  if (onto > 0 && onto < CAR_LONG * 1.2 && overlaps(occupies(racer.lane), occupies(run.lane))) {
    // Held back, never shoved backwards. Setting the position outright put a
    // car behind where it had already got to, which on the grid — where the
    // player is at nought — meant a negative distance and a car that could
    // never catch up with its own starting line.
    racer.y = Math.min(racer.y, Math.max(was, run.distance - CAR_LONG * 1.2))
    racer.speed = Math.min(racer.speed, Math.max(0, run.speed))
  }

  if (racer.y >= run.stage.distance) racer.finished = run.clock
}

export function step(run: Run, input: Input, dt: number): Run {
  /*
   * A finished run still has to clear its events.
   *
   * Returning it untouched keeps the last step's events attached, and the
   * screen reads events every frame — so the crash that ended the run would
   * re-announce itself sixty times a second for as long as the wreck sat
   * there. Found by a test that expected to hear it once and heard it a
   * hundred and eighty times.
   */
  if (run.status !== 'driving') {
    return run.events.length === 0 ? run : { ...run, events: [] }
  }

  const rng = makeRng(run.seed)
  const next: Run = {
    ...run,
    events: [],
    cars: run.cars.map((c) => ({ ...c })),
    cans: run.cans.map((c) => ({ ...c })),
    racers: run.racers.map((r) => ({ ...r })),
    // Advancing the seed every step keeps the traffic unpredictable without
    // making the simulation depend on anything outside itself.
    seed: (run.seed * 1664525 + 1013904223) >>> 0,
  }

  /*
   * The lights.
   *
   * Nothing moves at all while they are on — not you, not the field, not the
   * traffic. It is three seconds of a five-car grid sitting still, and it is
   * the only moment in this game where nothing is being asked of anybody.
   *
   * One event per light, raised when the whole second it belongs to ticks
   * over. Comparing the ceilings either side of the slice is how a fixed step
   * finds an edge; counting on the clock landing exactly on a second is how
   * you find it about half the time.
   */
  if (next.countdown > 0) {
    const before = Math.ceil(next.countdown / LIGHT_EVERY)
    next.countdown = Math.max(0, next.countdown - dt)
    const after = Math.ceil(next.countdown / LIGHT_EVERY)
    if (after !== before) next.events.push(next.countdown > 0 ? 'light' : 'green')
    if (next.countdown === 0) next.mercy = START_MERCY
    next.speed = 0
    return next
  }

  next.clock += dt
  next.mercy = Math.max(0, next.mercy - dt)

  /*
   * A sample for the trail, four times a second.
   *
   * Written into the same arrays rather than copied, because copying three
   * growing arrays sixty times a second is the sort of thing that turns a
   * pure simulation into a slow one. The run object itself is fresh each
   * step; the arrays inside it are shared with the step before, which is safe
   * here because nothing ever reads an earlier run's trail.
   */
  const due = Math.floor(next.clock / TRAIL_EVERY)
  if (due > next.trail.at.length - 1) {
    next.trail.at.push(next.clock)
    next.trail.gone.push(next.distance)
    next.trail.lane.push(next.lane)
  }

  // --- the pedals ----------------------------------------------------------
  if (next.stunned > 0) {
    next.stunned = Math.max(0, next.stunned - dt)
    next.speed = Math.max(0, next.speed - BRAKING * dt)
  } else if (input.brake) {
    next.speed = Math.max(0, next.speed - BRAKING * dt)
  } else if (input.go && next.fuel > 0) {
    next.speed = Math.min(topSpeedOn(next.stage), next.speed + ACCELERATION * dt)
  } else {
    next.speed = Math.max(0, next.speed - DRAG * dt)
  }

  // --- steering ------------------------------------------------------------
  if (next.stunned <= 0) {
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    if (steer !== 0) {
      // Clamped to the road rather than crashing on the verge. Losing a life
      // to a kerb you drifted into teaches nothing; the traffic is the game.
      next.lane = Math.min(LANES - 1, Math.max(0, next.lane + steer * STEER_RATE * dt))
    }
  }

  // --- down the road -------------------------------------------------------
  next.distance += next.speed * dt
  for (const car of next.cars) {
    car.y += car.speed * dt
    moveOver(next, car, dt, rng)
    if (car.roused > 0) car.roused = Math.max(0, car.roused - dt)
  }
  /*
   * The field. Driven after the traffic, so a racer sees where the traffic has
   * got to this slice rather than where it was last one — which matters at the
   * moment a lane closes in front of it.
   *
   * The clock is taken from your distance rather than a wall clock: the
   * simulation must give the same answer for the same inputs, and a racer's
   * pace wobble is part of the simulation.
   */
  for (const racer of next.racers) driveRacer(next, racer, dt, next.distance / TOP_SPEED)

  if (next.speed > 0) {
    next.fuel = Math.max(0, next.fuel - BURN_PER_SECOND * dt * (0.4 + next.speed / TOP_SPEED))
    next.canCooldown = Math.max(0, next.canCooldown - dt)
    /*
     * Running dry costs a life, rather than leaving you coasting.
     *
     * It used to just stop the pedal working, which on the road looks like
     * nothing at all: no sound, no message, the car simply will not go and you
     * are left rolling to a halt wondering what you did wrong. A life lost is
     * at least an answer.
     */
    // A word before it matters, once, so running dry is never a surprise.
    if (!next.warned && next.fuel > 0 && next.fuel < next.tank * 0.25) {
      next.warned = true
      next.events.push('warn')
    }
    if (next.fuel === 0 && run.fuel > 0) {
      next.lives -= 1
      next.status = next.lives > 0 ? 'crashed' : 'gameOver'
      next.stunned = 1.2
      next.events.push('dry')
      return next
    }
  }

  // --- what you hit --------------------------------------------------------
  const mine: [number, number] = occupies(next.lane)
  if (next.mercy === 0) for (const car of next.cars) {
    const gap = car.y - next.distance
    if (gap > longOf(car) || gap < -CAR_LONG) continue
    if (!overlaps(mine, spread(car))) continue
    next.lives -= 1
    next.pranged += 1
    next.status = next.lives > 0 ? 'crashed' : 'gameOver'
    next.stunned = 1.2
    next.events.push('crash')
    return next
  }

  /*
   * Running into one of them.
   *
   * Same as hitting anything else: they are cars on the same road. They will
   * not hit you — a racer backs off rather than crashing, because a field that
   * takes your last life by driving into the back of you is not a race, it is
   * an ambush — but you can certainly hit them.
   */
  if (next.mercy === 0) for (const racer of next.racers) {
    if (racer.finished !== null) continue
    const gap = racer.y - next.distance
    if (gap > CAR_LONG || gap < -CAR_LONG) continue
    if (!overlaps(mine, occupies(racer.lane))) continue
    next.lives -= 1
    next.pranged += 1
    next.status = next.lives > 0 ? 'crashed' : 'gameOver'
    next.stunned = 1.2
    next.events.push('crash')
    return next
  }

  for (const can of next.cans) {
    if (can.taken) continue
    const gap = can.y - next.distance
    if (gap > CAR_LONG || gap < -CAR_LONG) continue
    if (!overlaps(mine, occupies(can.lane))) continue
    can.taken = true
    next.fuel = Math.min(next.tank, next.fuel + CAN_WORTH)
    next.cansTaken += 1
    next.score += 50
    // Topped up: the warning may be given again if it gets low a second time.
    if (next.fuel > next.tank * 0.3) next.warned = false
    next.events.push('can')
  }

  // --- overtaking, which is the point ---------------------------------------
  const behind = next.cars.filter((car) => car.y < next.distance - CAR_LONG * 1.5)
  if (behind.length > 0) {
    next.passed += behind.length
    next.score += behind.length * 100
    next.events.push('pass')
    if (behind.some((car) => car.kind === 'patrol')) next.events.push('siren')
  }
  // A patrol that has just been passed puts its foot down for a few seconds —
  // not enough to catch you, enough to make the next gap tighter.
  for (const car of next.cars) {
    if (car.kind !== 'patrol') continue
    const gap = car.y - next.distance
    if (gap > -CAR_LONG * 2 && gap < CAR_LONG * 2 && car.roused === 0) car.roused = 4
    if (car.roused > 0) {
      const chasing = topSpeedOn(next.stage) * Math.min(0.9, next.stage.pace + 0.22)
      car.speed = Math.min(chasing, car.speed + TOP_SPEED * 0.3 * dt)
    }
  }
  next.cars = next.cars.filter((car) => car.y >= next.distance - CAR_LONG * 1.5)
  next.cans = next.cans.filter((can) => can.y >= next.distance - CAR_LONG * 1.5 && !can.taken)

  // --- keeping the road busy -------------------------------------------------
  const wanted = next.stage.traffic
  if (next.cars.length < wanted && next.distance > next.lastWave - SIGHT * 0.9) {
    spawnWave(next, rng)
  }
  /*
   * A can now and then, and no sympathy when the tank is low.
   *
   * There used to be a boost to the odds when he was running out, meant kindly
   * and with the effect that the tank never once emptied — reported as "I
   * never seem to run out of fuel, they keep coming". Fuel that cannot run out
   * is scenery. A plain cooldown now: miss one and you wait for the next.
   */
  if (next.cans.length === 0 && next.canCooldown === 0) {
    spawnCan(next, rng)
    next.canCooldown = CAN_EVERY
  }

  // --- the end of the stage --------------------------------------------------
  if (next.distance >= next.stage.distance) {
    next.status = 'stageDone'
    next.yourTime = next.clock
    next.place = placeOf(next)
    // Finishing money, and more of it the higher up you come.
    next.score += 500 + Math.round(next.fuel) * 5 + Math.max(0, 5 - next.place) * 250
    next.missionDone = missionMet(next)
    if (next.missionDone) next.score += MISSION_BONUS
    next.events.push('stageDone')
  }

  return next
}
