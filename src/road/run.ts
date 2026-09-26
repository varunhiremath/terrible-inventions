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
  ACCELERATION, BRAKING, BURN_PER_SECOND, CAN_WORTH, CAR_LONG, CAR_WIDE, DRAG,
  LANES, LENGTH_OF, MISSION_BONUS, PACE_OF, REACT, SIGHT, STEER_RATE, TANK,
  TOP_SPEED, WIDTH_OF, stageFor, type CarKind, type Stage,
} from './level'

export const FIXED = 1 / 60
export const STARTING_LIVES = 3

export type RoadEvent =
  | 'pass' | 'can' | 'crash' | 'dry' | 'stageDone' | 'skid' | 'warn' | 'siren'

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
  /** A patrol that has been overtaken gets its dander up for a moment. */
  roused: number
}

export interface Can {
  id: number
  y: number
  lane: number
  taken: boolean
}

export type Status = 'driving' | 'crashed' | 'stageDone' | 'gameOver'

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
  events: RoadEvent[]
  seed: number
  nextId: number
  /** How far ahead the last wave was put, so the next one keeps its distance. */
  lastWave: number
  /**
   * The lane nothing is allowed into.
   *
   * The promise that there is always a way through used to rest on the
   * geometry being frozen — every car at one pace, so a gap laid down stayed a
   * gap. Giving lorries, patrols and ambulances their own speeds broke that,
   * and the walls came straight back; so did swervers, which change lanes on
   * purpose.
   *
   * So the guarantee is structural now instead of arithmetical. One lane is
   * kept clear: nothing spawns into it and no swerver may target it. It only
   * moves to a lane that is already empty as far ahead as anything exists, so
   * it cannot be closed by something that was already out there. Whatever else
   * happens on the road, that lane is open.
   *
   * It moves about, so it is not simply "drive in lane two and win" — finding
   * where the gap has gone is the game.
   */
  openLane: number
}

export function newRun(number = 1, lives = STARTING_LIVES, score = 0, seed = 1): Run {
  const stage = stageFor(number)
  return {
    stage,
    number,
    distance: 0,
    lane: 1.5,
    speed: 0,
    fuel: TANK,
    cars: [],
    cans: [],
    score,
    passed: 0,
    cansTaken: 0,
    pranged: 0,
    missionDone: false,
    warned: false,
    lives,
    status: 'driving',
    stunned: 0,
    events: [],
    seed,
    nextId: 1,
    lastWave: 0,
    openLane: 1,
  }
}

/** Back on the road after a crash, with the traffic ahead cleared out of the way. */
export function resume(run: Run): Run {
  return {
    ...run,
    status: 'driving',
    speed: 0,
    stunned: 0,
    lane: 1.5,
    events: [],
    // Enough in the tank to get going again. Coming back with an empty one
    // would just lose the next life to the same thing.
    fuel: Math.max(run.fuel, TANK * 0.55),
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
  free.delete(run.openLane)
  if (free.size < 1) return

  /*
   * How many of the remaining lanes to use.
   *
   * The open lane is already off the list, so filling every lane that is left
   * is still a road with a way through. This used to subtract one *again* on
   * top of that, which on a four-lane road with one lane reserved meant it
   * frequently decided to spawn nothing at all.
   */
  const want = Math.max(1, Math.min(free.size, 1 + rng.int(0, 1)))
  const lanes = [...free].sort(() => rng.next() - 0.5).slice(0, want)

  for (const lane of lanes) {
    const fleet = run.stage.fleet
    const kind = fleet[rng.int(0, fleet.length - 1)]
    run.cars.push({
      id: run.nextId++,
      y: ahead + rng.next() * CAR_LONG * 2,
      lane,
      // The stage's pace, adjusted for what sort of vehicle it is. A lorry
      // lumbers and an ambulance does not.
      speed: TOP_SPEED * run.stage.pace * PACE_OF[kind],
      kind,
      wants: lane,
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
 * What the different sorts of vehicle do.
 *
 * All of it happens outside the reaction window, and that is the whole of the
 * rule. A swerver picks the lane you are in and slides towards it — but only
 * while it is still far enough away that you can answer it. The moment it
 * comes inside the stretch you are about to arrive in, it is locked to
 * whatever lane it is in and stays there.
 *
 * Without that the game becomes unreadable: you commit to a gap, the gap moves
 * after you have committed, and there was never anything you could have done.
 * That is not difficulty.
 */
function moveOver(run: Run, car: Car, dt: number): void {
  const ahead = car.y - run.distance
  if (ahead <= REACT) return

  if (car.kind === 'swerver') {
    // It wants whichever lane he is in, but it will not step into the last
    // gap: leaving the road blocked is the other side of the same promise.
    const target = Math.round(run.lane)
    // Never into the lane that is being kept open.
    if (target !== run.openLane) car.wants = target
  } else if (car.kind === 'ambulance') {
    // It weaves, because it is in a hurry and nobody is getting out of its way.
    const weave = Math.round(car.lane + Math.sin(car.y * 0.07) * 1.4)
    if (weave !== run.openLane) car.wants = weave
  }

  car.wants = Math.min(LANES - 1, Math.max(0, car.wants))
  if (Math.abs(car.wants - car.lane) > 0.01) {
    const way = Math.sign(car.wants - car.lane)
    const moved = car.lane + way * STEER_RATE * 0.45 * dt
    car.lane = way > 0 ? Math.min(car.wants, moved) : Math.max(car.wants, moved)
  }
}

/**
 * Move the open lane about, but only somewhere that is already empty.
 *
 * Checked as far ahead as anything can exist, so a lane that looks clear now
 * cannot turn out to have had something in it all along, just out of sight.
 */
function shiftTheGap(run: Run, rng: Rng): void {
  if (rng.next() > 0.01) return
  const reach = run.distance + SIGHT * 3
  for (let tries = 0; tries < LANES; tries++) {
    const lane = rng.int(0, LANES - 1)
    if (lane === run.openLane) continue
    if (blockedLanes(run.cars, run.distance - CAR_LONG, reach).has(lane)) continue
    if (run.cars.some((car) => car.wants === lane)) continue
    run.openLane = lane
    return
  }
}

/** Did he do the job as well as get there? */
export function missionMet(run: Run): boolean {
  const mission = run.stage.mission
  if (mission.kind === 'pass') return run.passed >= mission.count
  if (mission.kind === 'cans') return run.cansTaken >= mission.count
  return run.pranged === 0
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
    // Advancing the seed every step keeps the traffic unpredictable without
    // making the simulation depend on anything outside itself.
    seed: (run.seed * 1664525 + 1013904223) >>> 0,
  }

  // --- the pedals ----------------------------------------------------------
  if (next.stunned > 0) {
    next.stunned = Math.max(0, next.stunned - dt)
    next.speed = Math.max(0, next.speed - BRAKING * dt)
  } else if (input.brake) {
    next.speed = Math.max(0, next.speed - BRAKING * dt)
  } else if (input.go && next.fuel > 0) {
    next.speed = Math.min(TOP_SPEED, next.speed + ACCELERATION * dt)
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
    moveOver(next, car, dt)
    if (car.roused > 0) car.roused = Math.max(0, car.roused - dt)
  }

  if (next.speed > 0) {
    next.fuel = Math.max(0, next.fuel - BURN_PER_SECOND * dt * (0.4 + next.speed / TOP_SPEED))
    /*
     * Running dry costs a life, rather than leaving you coasting.
     *
     * It used to just stop the pedal working, which on the road looks like
     * nothing at all: no sound, no message, the car simply will not go and you
     * are left rolling to a halt wondering what you did wrong. A life lost is
     * at least an answer.
     */
    // A word before it matters, once, so running dry is never a surprise.
    if (!next.warned && next.fuel > 0 && next.fuel < TANK * 0.25) {
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
  for (const car of next.cars) {
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

  for (const can of next.cans) {
    if (can.taken) continue
    const gap = can.y - next.distance
    if (gap > CAR_LONG || gap < -CAR_LONG) continue
    if (!overlaps(mine, occupies(can.lane))) continue
    can.taken = true
    next.fuel = Math.min(TANK, next.fuel + CAN_WORTH)
    next.cansTaken += 1
    next.score += 50
    // Topped up: the warning may be given again if it gets low a second time.
    if (next.fuel > TANK * 0.3) next.warned = false
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
      const chasing = TOP_SPEED * Math.min(0.85, next.stage.pace * PACE_OF.patrol + 0.2)
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
  // A can every so often, and sooner if the tank is low: running dry through
  // bad luck rather than bad driving is the other kind of coin toss.
  const thirsty = next.fuel < TANK * 0.35
  if (next.cans.length === 0 && rng.next() < (thirsty ? 0.04 : 0.012)) spawnCan(next, rng)

  shiftTheGap(next, rng)

  // --- the end of the stage --------------------------------------------------
  if (next.distance >= next.stage.distance) {
    next.status = 'stageDone'
    next.score += 500 + Math.round(next.fuel) * 5
    next.missionDone = missionMet(next)
    if (next.missionDone) next.score += MISSION_BONUS
    next.events.push('stageDone')
  }

  return next
}
