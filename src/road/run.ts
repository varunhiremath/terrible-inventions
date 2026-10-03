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
 * every level looking for one anyway.
 */
import { makeRng, type Rng } from '../engine/rng'
import {
  ACCELERATION, BRAKING, BURN_PER_SECOND, CAN_EVERY, CAN_WORTH, CAR_LONG, CAR_WIDE,
  COUNTDOWN, DASHES, DRAG, FIELD_SIZE, GRID_ROW, LANES, LENGTH_OF, LIGHT_EVERY,
  MISSION_BONUS, RACER_LOOK, RACER_STEER,
  REACT, SIGHT, SIGNAL_FOR, STEER_RATE, TANK, TOP_SPEED, WANDERS, WIDTH_OF,
  carNamed, fieldFor, levelFor, slotFor, topSpeedOn,
  type CarKind, type Racer, type Level, type Slot,
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
 * it turned the opening of every level into a coin toss — the first go at
 * this grid lost one at the lights in every single run.
 */
export const START_MERCY = 1.6

export type RoadEvent =
  | 'pass' | 'can' | 'crash' | 'dry' | 'levelDone' | 'skid' | 'warn' | 'siren'
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
 * `steerRacer`, and there is a test that plays every level watching for it.
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
  /**
   * Seconds of being stopped after hitting something, for a human racer.
   *
   * Always nought for one of {papa}'s: they are not allowed to crash, because
   * a field that wipes itself out in the first level is no race at all — they
   * back off and lose time instead. A person driving one of them is allowed
   * to do what people do, and pays for it the way a race makes you pay for
   * it, which is in seconds rather than in lives.
   */
  stunned: number
}

export type Status = 'driving' | 'crashed' | 'levelDone' | 'gameOver'

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
  // Walking it is fine: a level is a few hundred samples and this runs once a
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
  level: Level
  number: number
  /**
   * What you are driving, and where everybody stood at the lights.
   *
   * `you` is on the run rather than read from the save inside the drawing
   * code, because the simulation has to be a pure function of what it is
   * handed — a car that changes because somebody opened the garage mid-race
   * would make a replay disagree with the race it replayed.
   *
   * `grid` is the painted boxes, in position order, already rebased so that
   * your own slot is row zero. The drawing reads it and so does nothing else;
   * it is kept because the grid is a place on the road, and the road is drawn
   * relative to you.
   */
  you: Racer
  /**
   * The car a second person is driving, if anybody is.
   *
   * Player two takes over one of {papa}'s four rather than becoming a second
   * player-shaped thing in the model, and that is the whole trick. A racer
   * already has a position, a lane, a speed and a place in the standings; it
   * is already drawn, already collided with, already counted at the flag. All
   * that changes is where its steering comes from. A second `distance` and
   * `lane` on the run would have meant touching every rule in this file that
   * says "the player", and every one of those rules is load-bearing.
   */
  human: number | null
  grid: readonly Slot[]
  /** Where you started, 1 to `FIELD_SIZE`. */
  started: number
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
  /** For the mission: cans taken and scrapes collected on this level. */
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

/**
 * What a new race needs to know beyond the level number.
 *
 * All optional, all with a sensible answer, because most callers — the tests
 * especially — only care about the road.
 */
export interface Entry {
  /** The name of the car in the garage you picked. */
  car?: string
  /** Where you finished the last one, which is where you start this one. */
  started?: number
  /** Whether somebody else is driving one of the field. */
  twoPlayer?: boolean
}

export function newRun(
  number = 1,
  lives = STARTING_LIVES,
  score = 0,
  seed = 1,
  entry: Entry = {},
): Run {
  const level = levelFor(number)
  const you = carNamed(entry.car)
  const started = Math.max(1, Math.min(FIELD_SIZE, Math.round(entry.started ?? FIELD_SIZE)))
  const mine = slotFor(started)
  return {
    level,
    number,
    you,
    started,
    /*
     * Which of them the second person gets.
     *
     * The quickest, because the field is banded by pace and the quickest band
     * is the one that can actually win — handing player two a camper van and
     * calling it a race would be a joke with one person in on it. Chosen here
     * once rather than per-frame so it survives the whole level.
     */
    human: entry.twoPlayer ? bestOf(gridOf(seed, started, you)) : null,
    // Rebased against your own slot, because you are the origin of the road.
    grid: Array.from({ length: FIELD_SIZE }, (_, i) => {
      const slot = slotFor(i + 1)
      return { lane: slot.lane, row: slot.row - mine.row }
    }),
    distance: 0,
    // Your grid slot, which is wherever you finished the last one.
    lane: mine.lane,
    speed: 0,
    fuel: TANK,
    tank: TANK,
    cars: [],
    cans: [],
    racers: gridOf(seed, started, you),
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
 * The room something on this road actually takes up.
 *
 * Every body on the road is *drawn* centred on its `y` — that is what `body()`
 * in the drawing does, for the traffic, the field and your own car alike. The
 * rules about what has hit what were written one at a time and none of them
 * quite agreed with that or with each other: a truck counted as hitting you
 * from up to one and nine tenths of a length in front of your bumper, and not
 * at all from behind, where its nose could be a quarter of a length inside
 * your boot with nothing happening. Reported as cars overlapping and carrying
 * on regardless, and that is precisely what it was.
 *
 * So there is one answer to "where is it and how big is it", and everything
 * asks it. Half a length either side of the middle, and the lanes it sits
 * across — which is what you can see on the screen.
 */
export interface Box {
  lanes: [number, number]
  /** The back bumper and the front one, along the road. */
  from: number
  to: number
}

const boxAt = (lane: number, y: number, wide: number, long: number): Box => ({
  lanes: occupies(lane, wide),
  from: y - long / 2,
  to: y + long / 2,
})

const boxOfCar = (car: Car): Box => boxAt(car.lane, car.y, WIDTH_OF[car.kind], longOf(car))
const boxOfRacer = (racer: Racing): Box => boxAt(racer.lane, racer.y, CAR_WIDE, CAR_LONG)
const boxOfYou = (run: Run): Box => boxAt(run.lane, run.distance, CAR_WIDE, CAR_LONG)

/** Are these two in the same place? */
function touching(a: Box, b: Box): boolean {
  return overlaps(a.lanes, b.lanes) && a.from < b.to && b.from < a.to
}

/** Bumper to bumper, along the road. Negative means already inside. */
const gapBetween = (behind: Box, front: Box): number => front.from - behind.to

/**
 * Is there room to be in that lane, right here?
 *
 * Holding cars apart along the road is only half of it. Two vehicles can be
 * clear of each other in a queue and still end up in the same place, because
 * one of them drove *sideways* into the other: a swerver going looking for
 * your lane, a racer tidying itself up off the grid. Both check before they
 * commit, and a check made before a manoeuvre is a statement about where
 * everything was at the start of it — by the time a lorry is halfway across a
 * lane, two and a half seconds have passed.
 *
 * So the sideways move is checked on every slice, against where everything
 * actually is now, and simply does not happen when it would put two bodies in
 * the same place. Being level with something is the one case holding back
 * cannot fix: there is no gap to leave.
 */
function roomBeside(run: Run, self: Box, mover: number, lane: number, wide: number): boolean {
  const want = boxAt(lane, (self.from + self.to) / 2, wide, self.to - self.from)
  for (const car of run.cars) {
    if (car.id === mover) continue
    if (touching(want, boxOfCar(car))) return false
  }
  for (const racer of run.racers) {
    if (racer.id === mover || racer.finished !== null) continue
    if (touching(want, boxOfRacer(racer))) return false
  }
  return true
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
  const from = ahead - guard
  const to = ahead + CAR_LONG * 2 + guard
  for (const lane of blockedLanes(run.cars, from, to)) free.delete(lane)
  /*
   * Counting where anything already moving is *going*, not only where it is.
   *
   * This is the same blind spot as the one in `shuts` above, seen from the
   * other side, and it produced a wall that stood for a second and a half on
   * the second level. A taxi was halfway between lane nought and lane one and
   * changing its mind — on its way back to nought — and by this measure it was
   * simply a car in lane one. So lane nought read as the way through, the
   * spawner put a car in the only other free lane, the taxi finished its move,
   * and every lane was taken. Nobody spawned a wall and nobody drove into one
   * on purpose: two decisions, each correct when it was made, and a road with
   * no way through between them.
   *
   * A vehicle on the move therefore holds both lanes until it arrives.
   */
  for (const car of run.cars) {
    if (car.y + longOf(car) < from || car.y > to) continue
    if (Math.abs(car.wants - car.lane) >= 0.01) free.delete(car.wants)
  }
  // And the field, for the same reason: a racer sitting in a lane shuts it
  // just as thoroughly as one of his lorries.
  for (const lane of racerLanes(run.racers, from, to)) free.delete(lane)
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
    const fleet = run.level.fleet
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
      speed: topSpeedOn(run.level) * run.level.pace,
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
 * far too kind — five levels were being finished without a scratch. Checking
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
   * the opening level.
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
      const to = from + REACT
      const blocked = blockedLanes(others, from, to)
      /*
       * Counting where the other movers are *going*, not only where they are.
       *
       * Two vehicles can each pass this check and still shut the road between
       * them. A lorry takes two and a half seconds to cross a lane; it commits
       * while the road is fine, and half a second later a second car checks,
       * sees the lorry occupying the one and a half lanes it currently spans,
       * finds a way through, and commits too — and then both of them finish
       * crossing and for the best part of a second every lane is taken. It is
       * the same failure as the waves of traffic further down this file: two
       * legal moves adding up to an illegal road, and it was found the same
       * way, by a driver arriving at a wall nobody had put there.
       *
       * So anything already on its way counts as being in both its lanes for
       * as long as it takes to get there.
       */
      for (const other of others) {
        if (other.y + longOf(other) < from || other.y > to) continue
        if (Math.abs(other.wants - other.lane) < 0.01) continue
        blocked.add(other.wants)
      }
      // And the field, which is on the same road and was not being counted at
      // all: a car pulling into a lane a racer is sitting in shuts it just as
      // thoroughly as one pulling in behind a lorry.
      for (const taken of racerLanes(run.racers, from, to)) blocked.add(taken)
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
    const next = way > 0 ? Math.min(car.wants, moved) : Math.max(car.wants, moved)
    // Not into the side of something. Three quarters of every overlap measured
    // on this road was one of these: a swerver merging into a van that was
    // level with it, both of them quite happy with the road they had checked.
    if (roomBeside(run, boxOfCar(car), car.id, next, WIDTH_OF[car.kind])) {
      car.lane = next
      if (Math.abs(car.wants - car.lane) < 0.01) car.signal = 0
    } else {
      /*
       * Give up on it rather than sit halfway across blocking two lanes. Back
       * the way it came, not to the nearest lane: what is in the way is on the
       * side it was heading for. And still indicating, because "it moved lane
       * with no indicator on" is as true of a retreat as of a manoeuvre, and
       * there is a test that says so.
       */
      const back = way > 0 ? Math.floor(car.lane) : Math.ceil(car.lane)
      car.wants = Math.min(LANES - 1, Math.max(0, back))
      car.signal = car.wants > car.lane ? 1 : car.wants < car.lane ? -1 : 0
    }
  }
}

/** Did he do the job as well as get there? */
export function missionMet(run: Run): boolean {
  const mission = run.level.mission
  if (mission.kind === 'pass') return run.passed >= mission.count
  if (mission.kind === 'cans') return run.cansTaken >= mission.count
  if (mission.kind === 'place') return placeOf(run) <= mission.place
  return run.pranged === 0
}


// --- the field ---------------------------------------------------------------

/**
 * The four of them, in their boxes, in last race's finishing order.
 *
 * Two things are going on here and they pull in opposite directions. The
 * field is re-drawn for every level, so the cars beside you are not the cars
 * you beat last time; but the grid is supposed to be the last race's result,
 * and a result needs the same people in it. What survives the re-draw is the
 * *order*, and specifically your place in it: finish second and you start
 * second, whoever turns out. The new cars fill the boxes around you quickest
 * first, which is the only ranking a car nobody has raced yet can have.
 *
 * Everything is rebased against your own slot, because the road's coordinates
 * have you at zero. Start on pole and the rest of them are at negative y —
 * genuinely behind you, off the bottom of the screen, which is what pole
 * looks like. That was the one thing the old fixed grid could not do, and it
 * is the reward for winning.
 */
/** The id of the quickest car in a field. */
function bestOf(racers: readonly Racing[]): number | null {
  let best: Racing | null = null
  for (const racer of racers) if (!best || racer.who.pace > best.who.pace) best = racer
  return best?.id ?? null
}

export function gridOf(seed: number, started: number, you: Racer): Racing[] {
  const mine = slotFor(started)
  // Quickest first: a car with no history is ranked by the only thing known
  // about it.
  const field = fieldFor(seed, you.name).sort((a, b) => b.pace - a.pace)

  const racers: Racing[] = []
  let next = 0
  for (let place = 1; place <= FIELD_SIZE; place++) {
    if (place === started) continue
    const slot = slotFor(place)
    const who = field[next]
    racers.push({
      id: 1000 + next,
      who,
      y: (slot.row - mine.row) * GRID_ROW,
      lane: slot.lane,
      wants: slot.lane,
      speed: 0,
      signal: 0 as -1 | 0 | 1,
      signalFor: 0,
      finished: null,
      stunned: 0,
    })
    next++
  }
  return racers
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
 * — an estimate, and the only honest one available: the level ends when *you*
 * cross the line, so the rest of the field genuinely has not finished yet. It
 * is what a television graphic does at the flag, for the same reason.
 */
export function timeOf(run: Run, racer: Racing): number {
  if (racer.finished !== null) return racer.finished
  const left = run.level.distance - racer.y
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

/** The order at the end of a level, you included, best first. */
export interface Standing {
  name: string
  you: boolean
  /** Whether this one was driven by the second person. */
  friend?: boolean
  /** Seconds from the lights to the line. */
  at: number
  /** Whether that time is a real one or a projection from the flag. */
  estimated: boolean
}

export function standings(run: Run): Standing[] {
  const rows: Standing[] = run.racers.map((r) => ({
    // The second person's car is named after them rather than after itself:
    // at the flag what matters is who beat whom, and "Cinder" does not say it.
    name: r.id === run.human ? `Player 2 (${r.who.name})` : r.who.name,
    you: false,
    friend: r.id === run.human,
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
  /*
   * Measured bumper to bumper, not middle to middle.
   *
   * It used to be middle to middle against a flat threshold, which meant a
   * long vehicle was misjudged by exactly the amount it was long: a truck
   * whose middle was less than four fifths of a length ahead counted as
   * *level* rather than in front, so a racer overtaking one simply stopped
   * seeing it — and drove through it. The measurement found four hundred of
   * those in eight races, the worst a length and a half inside a truck.
   *
   * Level still does not count as ahead, for the reason it never did: two
   * cars at the same point each read the other as something to follow, each
   * matched the other's speed, and the pair crawled the whole race. But
   * "ahead" is now whether its middle is in front of mine, which is a question
   * with an answer whatever shape the two of them are.
   */
  const mine = boxAt(lane, racer.y, CAR_WIDE, CAR_LONG)
  const note = (box: Box, middle: number, speed: number) => {
    if (middle <= racer.y) return
    if (!overlaps(mine.lanes, box.lanes)) return
    const gap = gapBetween(mine, box)
    if (gap > RACER_LOOK * 2 || gap >= nearest) return
    nearest = gap
    pace = speed
  }

  for (const car of run.cars) note(boxOfCar(car), car.y, car.speed)
  // And each other, so they do not drive through their own field.
  for (const other of run.racers) {
    if (other.id === racer.id) continue
    note(boxOfRacer(other), other.y, other.speed)
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
  note(boxOfYou(run), run.distance, run.speed)
  return { gap: nearest, speed: pace }
}

/**
 * Is this one sitting in the only lane left open where the player is arriving?
 *
 * The same question `steerRacer` asks before it moves, asked of a car that
 * cannot move, so that it starts moving again.
 */
function lastWayThrough(run: Run, racer: Racing): boolean {
  const from = run.distance + CAR_LONG
  const to = run.distance + REACT
  if (racer.y + CAR_LONG < from || racer.y > to) return false

  const shut = blockedLanes(run.cars, from, to)
  for (const lane of racerLanes(run.racers, from, to, racer.id)) shut.add(lane)
  const open: number[] = []
  for (let lane = 0; lane < LANES; lane++) if (!shut.has(lane)) open.push(lane)
  return open.length === 1 && overlaps(occupies(racer.lane), occupies(open[0]))
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
   * level inside four seconds.
   */
  const shut = blockedLanes(run.cars, window[0], window[1])
  for (const lane of racerLanes(run.racers, window[0], window[1], racer.id)) shut.add(lane)
  const open: number[] = []
  for (let lane = 0; lane < LANES; lane++) if (!shut.has(lane)) open.push(lane)
  const lastOpen = open.length === 1 ? open[0] : null

  const here = Math.round(racer.lane)
  const moving = Math.abs(racer.wants - racer.lane) >= 0.01
  /*
   * Never into the last lane left open where the player is arriving.
   *
   * It was briefly strengthened to count the lane being left as well as the
   * one being joined, on the reasoning that a car crossing is in both. That
   * reasoning is right and the rule built on it was a disaster: when three
   * lanes hold traffic and the racer is in the fourth, *every* destination
   * fails it — including the one that would free the road — so the car has to
   * leave, has nowhere to go, and sits there. The road stayed shut for three
   * seconds instead of six tenths, which is five times worse than the fault it
   * was meant to fix.
   */
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

  /*
   * One at a time across the stretch he is arriving in.
   *
   * A car changing lane is in two of them for the half second it takes, and
   * two cars changing lane at once are in four — which on a four-lane road is
   * the whole of it. Both moves were legal when each was decided, and the road
   * still shut: measured at nearly a full second on the fourth level, with
   * two of the field sweeping from the outside lane to the inside together
   * while the traffic held the other two.
   *
   * It is the oldest lesson in this file arriving again, and the narrow rule
   * is the right one. Forbidding the *destination* by this reckoning was tried
   * and was far worse: when three lanes hold traffic every destination fails
   * it, including the one that frees the road, so the car sits there and the
   * road stays shut for three seconds. Getting out is never forbidden. Only
   * setting off behind somebody else who is already crossing is.
   */
  const alreadyCrossing = run.racers.some(
    (other) =>
      other.id !== racer.id &&
      other.finished === null &&
      Math.abs(other.wants - other.lane) >= 0.01 &&
      other.y + CAR_LONG >= window[0] &&
      other.y <= window[1],
  )
  const waitYourTurn = alreadyCrossing && insideWindow && !mustLeave

  if ((!moving && !waitYourTurn) || mustLeave) {
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
    if (askew && !waitYourTurn && !wouldShut(tidy) && !intoYou(tidy) && !intoOther(tidy)) {
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
  const next = Math.abs(racer.wants - racer.lane) <= RACER_STEER * dt
    ? racer.wants
    : racer.lane + way * RACER_STEER * dt
  // And not into the side of anything, checked now rather than when the move
  // was decided on. `intoOther` above asks the same question of where things
  // were; this asks it of where they are.
  if (roomBeside(run, boxOfRacer(racer), racer.id, next, CAR_WIDE)) {
    racer.lane = next
    return
  }
  /*
   * Blocked halfway across, so go back rather than stop there.
   *
   * Stopping is the obvious thing and it is wrong: a car halted between two
   * lanes is taking up both of them, and on a four-lane road two of those is
   * the whole road. That is not a hypothetical — the first version of this
   * left one straddling lanes one and two for three quarters of a second and
   * broke the only promise this game makes, which is that the stretch you are
   * arriving in always has a way through.
   *
   * Back means away from wherever it was heading. The nearest whole lane is
   * not the same thing and is usually the wrong one: what is in the way is on
   * the side it was going to.
   */
  const back = way > 0 ? Math.floor(racer.lane) : Math.ceil(racer.lane)
  racer.wants = Math.min(LANES - 1, Math.max(0, back))
  racer.signal = racer.wants > racer.lane ? 1 : racer.wants < racer.lane ? -1 : 0
}

/** One racer, one slice. */
/**
 * One of the field, driven by a person.
 *
 * Deliberately not `driveRacer` with the pace swapped out. A racer is built
 * never to crash — it looks ahead, backs off, and pays for being blocked in
 * lost seconds — and handing a person the wheel of something that cannot hit
 * anything is not racing, it is steering a train. So the safe-following sum
 * and the bumper are both gone here, and hitting something costs what it
 * costs a person in a race: not a life, which they have none of, but the
 * seconds it takes to get going again. Losing a race because you put it into
 * the back of a bus is a fair way to lose a race.
 *
 * Everything else is the same physics the player's own car uses, so the two
 * of them are driving the same road on the same terms.
 */
function driveHuman(run: Run, racer: Racing, input: Input, dt: number): void {
  if (racer.finished !== null) return

  if (racer.stunned > 0) {
    racer.stunned = Math.max(0, racer.stunned - dt)
    racer.speed = 0
    racer.signal = 0
    return
  }

  // Steering: straight to where the wheel is pointed, at a racer's rate.
  const way = (input.left ? -1 : 0) + (input.right ? 1 : 0)
  racer.lane = Math.max(0, Math.min(LANES - 1, racer.lane + way * RACER_STEER * dt))
  racer.wants = racer.lane
  // The indicator follows the wheel, so the other driver gets the same warning
  // out of them that they get out of everything else on this road.
  racer.signal = way as -1 | 0 | 1

  const top = topSpeedOn(run.level)
  if (input.go && !input.brake) racer.speed = Math.min(top, racer.speed + ACCELERATION * dt)
  else if (input.brake) racer.speed = Math.max(0, racer.speed - BRAKING * dt)
  else racer.speed = Math.max(0, racer.speed - DRAG * dt)

  racer.y += racer.speed * dt

  /*
   * What they hit.
   *
   * Only things in front, and only while moving: a car that has already
   * stopped inside something should be let out rather than pinned there.
   */
  if (racer.speed <= 0) return
  const mine = occupies(racer.lane)
  for (const car of run.cars) {
    const gap = car.y - racer.y
    if (gap > longOf(car) || gap < -CAR_LONG) continue
    if (!overlaps(mine, spread(car))) continue
    racer.y = car.y - longOf(car) - CAR_LONG * 0.1
    racer.stunned = 1
    return
  }
  const onto = run.distance - racer.y
  if (onto <= CAR_LONG && onto >= -CAR_LONG && overlaps(mine, occupies(run.lane))) {
    racer.y = Math.min(racer.y, run.distance - CAR_LONG * 1.1)
    racer.stunned = 1
    return
  }
  for (const other of run.racers) {
    if (other.id === racer.id || other.finished !== null) continue
    const gap = other.y - racer.y
    if (gap > CAR_LONG || gap < 0) continue
    if (!overlaps(mine, occupies(other.lane))) continue
    racer.y = other.y - CAR_LONG * 1.1
    racer.stunned = 1
    return
  }
}

function driveRacer(run: Run, racer: Racing, dt: number, clock: number): void {
  if (racer.finished !== null) return

  /*
   * Stopped, after running into something. It sits where it is with its wheel
   * straight, and then carries on — see `keepApart`.
   *
   * Unless it is the last way through. A car standing still takes a lane, and
   * the one promise this road makes is that the stretch you are arriving in is
   * never fully shut — a promise a stopped car broke the first time one of
   * them stopped, by two hundredths of a second, on the opening level. So the
   * driver gets going again rather than sitting there while you arrive at a
   * wall. He is shaken, not asleep.
   */
  if (racer.stunned > 0) {
    if (lastWayThrough(run, racer)) racer.stunned = 0
    else {
      racer.stunned = Math.max(0, racer.stunned - dt)
      racer.speed = 0
      racer.signal = 0
      racer.wants = racer.lane
      return
    }
  }

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
    topSpeedOn(run.level) * racer.who.pace * (1 + Math.sin(clock * 0.7 + racer.id) * racer.who.swing)

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
   * into the back of whatever it was following, which on the fifth level was
   * usually the player. This is the ordinary safe-following sum — the speed
   * from which the room left brings you to the speed of the thing in front.
   */
  // `gap` is bumper to bumper now, so what has to come off it is the space to
  // leave between them rather than the length of a car.
  const room = Math.max(0, gap - CAR_LONG * 0.4)
  const safe = Math.sqrt(2 * BRAKING * 0.8 * room) + Math.max(0, theirs)
  const capped = Math.min(target, safe)

  racer.speed = capped > racer.speed
    ? Math.min(capped, racer.speed + ACCELERATION * dt)
    : Math.max(capped, racer.speed - BRAKING * dt)
  racer.speed = Math.max(0, Math.min(topSpeedOn(run.level) * 1.05, racer.speed))
  racer.y += racer.speed * dt

  /*
   * The bumper that used to be here guarded the player and nothing else, and
   * arithmetic is not a promise for anything else on this road either.
   * `keepApart` does the same job now, for every pair of bodies on it.
   */
  if (racer.y >= run.level.distance) racer.finished = run.clock
}

/** How hard two of them have to meet before it counts as an incident. */
const A_BANG = CAR_LONG * 0.12
/** How long one of them sits there afterwards. */
const SHAKEN = 0.9

/**
 * Nothing ends a slice inside anything else.
 *
 * Every body on this road avoids every other body by *steering*, and steering
 * is a plan made from where things are now. The road is full of things moving
 * relative to one another, so a plan is not a guarantee — which is the fifth
 * time that sentence has had to be written in this game. The racers'
 * safe-following sum is good, and it is still only a sum: one awkward slice,
 * a lane change into the gap, the player standing on the brakes, and a car is
 * inside another one. Reported as exactly that, and as them carrying on
 * afterwards as though nothing had happened.
 *
 * So after everything has moved, whoever is behind is held back to clear of
 * whoever is in front. Held back, never shoved backwards: putting a car behind
 * where it had already got to meant, on the grid, a negative distance and a
 * car that could never reach its own starting line.
 *
 * And when it is a real bang rather than a touch, the car that made it stops
 * and sits there for a moment, because a race where the cars pass through each
 * other is not a race. They are not wiped out — a field that destroys itself
 * on the first level is no race either — they lose what a driver loses for
 * running into the back of somebody, which is seconds.
 */
function keepApart(run: Run, dt: number): void {
  type Body =
    | { readonly kind: 'car'; readonly car: Car }
    | { readonly kind: 'racer'; readonly racer: Racing }

  const middleOf = (b: Body) => (b.kind === 'car' ? b.car.y : b.racer.y)
  const boxOfBody = (b: Body) => (b.kind === 'car' ? boxOfCar(b.car) : boxOfRacer(b.racer))
  const speedOf = (b: Body) => (b.kind === 'car' ? b.car.speed : b.racer.speed)
  const halfOf = (b: Body) => (b.kind === 'car' ? longOf(b.car) : CAR_LONG) / 2

  /*
   * The traffic is in here as well as the field, and it is where most of this
   * was. Of the four hundred and thirty overlaps measured across eight races,
   * three quarters were one lorry inside another. The spawner keeps a wave
   * apart when it puts it on the road, and `moveOver` keeps a lane change from
   * shutting the road, and neither of those is the same as two vehicles at
   * different speeds ending up in the same lane. A van and a swerver spent
   * four seconds occupying the same stretch of tarmac.
   */
  const bodies: Body[] = [
    ...run.cars.map((car) => ({ kind: 'car', car }) as const),
    ...run.racers
      .filter((racer) => racer.finished === null)
      .map((racer) => ({ kind: 'racer', racer }) as const),
  ]
  // Front first, so a queue settles in one pass rather than shuffling
  // backwards one place at a time over several slices.
  bodies.sort((a, b) => middleOf(b) - middleOf(a))

  const you = boxOfYou(run)

  for (const body of bodies) {
    const was = middleOf(body)
    const mine = boxOfBody(body)
    let limit = Infinity
    let matched = Infinity

    const behind = (box: Box, middle: number, speed: number) => {
      if (middle <= was) return
      if (!touching(mine, box)) return
      // Its back bumper, less half of mine, is as far forward as my middle
      // may be.
      limit = Math.min(limit, box.from - halfOf(body))
      matched = Math.min(matched, Math.max(0, speed))
    }

    for (const other of bodies) {
      if (other === body) continue
      behind(boxOfBody(other), middleOf(other), speedOf(other))
    }
    /*
     * And you — but only ever as something in front. Nothing here holds the
     * player back, so driving into the back of a bus still costs a life. What
     * it stops is the reverse: a lorry catching you up and passing through you
     * from behind, which is not something anybody could have avoided.
     */
    behind(you, run.distance, run.speed)

    if (limit === Infinity) continue
    // Held back, never shoved backwards: putting a car behind where it had
    // already got to meant, on the grid, a negative distance and a car that
    // could never reach its own starting line.
    const to = Math.min(was, Math.max(was - speedOf(body) * dt, limit))
    const shunted = was - to

    if (body.kind === 'car') {
      body.car.y = to
      body.car.speed = Math.min(body.car.speed, matched)
      continue
    }

    const racer = body.racer
    racer.y = to
    racer.speed = Math.min(racer.speed, matched)
    /*
     * A bang, rather than the paint touching.
     *
     * Only for one of {papa}'s: a person driving one already has the crash
     * handling in `driveHuman`, and stunning them twice for one contact would
     * take two seconds off them for one mistake.
     */
    if (shunted > A_BANG && racer.id !== run.human) {
      racer.stunned = SHAKEN
      racer.signal = 0
    }
  }
}

export function step(run: Run, input: Input, dt: number, second: Input = NO_INPUT): Run {
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
    next.speed = Math.min(topSpeedOn(next.level), next.speed + ACCELERATION * dt)
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
  for (const racer of next.racers) {
    if (racer.id === next.human) driveHuman(next, racer, second, dt)
    else driveRacer(next, racer, dt, next.distance / TOP_SPEED)
  }
  keepApart(next, dt)

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
      const chasing = topSpeedOn(next.level) * Math.min(0.9, next.level.pace + 0.22)
      car.speed = Math.min(chasing, car.speed + TOP_SPEED * 0.3 * dt)
    }
  }
  next.cars = next.cars.filter((car) => car.y >= next.distance - CAR_LONG * 1.5)
  next.cans = next.cans.filter((can) => can.y >= next.distance - CAR_LONG * 1.5 && !can.taken)

  // --- keeping the road busy -------------------------------------------------
  const wanted = next.level.traffic
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

  // --- the end of the level --------------------------------------------------
  if (next.distance >= next.level.distance) {
    next.status = 'levelDone'
    next.yourTime = next.clock
    next.place = placeOf(next)
    // Finishing money, and more of it the higher up you come.
    next.score += 500 + Math.round(next.fuel) * 5 + Math.max(0, 5 - next.place) * 250
    next.missionDone = missionMet(next)
    if (next.missionDone) next.score += MISSION_BONUS
    next.events.push('levelDone')
  }

  return next
}
