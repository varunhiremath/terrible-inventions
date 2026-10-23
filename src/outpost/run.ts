/**
 * The mission, simulated.
 *
 * Pure and fixed-step like every other game here, and with no three.js in it:
 * this file knows where everybody is and the scene knows how to draw them,
 * which is what lets a whole mission be played out in a terminal by a bot that
 * has never seen a picture of it.
 *
 * Three things in here are worth more care than they look.
 *
 * Walking into walls. Movement is tried one axis at a time, so a shoulder
 * against a wall slides along it instead of stopping dead. Stopping dead is
 * what makes a first-person game feel like a cardboard box, and it is also
 * what gets a nine-year-old stuck in a corner wondering what is wrong.
 *
 * Being seen. A machine has to have you inside its range, inside the cone it
 * is looking down, and in clear line — all three, every time, with no shortcut
 * for machines that happen to be nearby. A thing that shoots you through a
 * wall is the single most unfair event a game like this has to offer.
 *
 * And getting out. The person you are rescuing follows you by walking down the
 * same breadth-first field the hunting machines use, which means she goes
 * round corners rather than pressing herself into them. Follow-the-leader by
 * walking straight at somebody works perfectly in an empty room and nowhere
 * else.
 */
import {
  BELT, BODY, CLOSE, EYE, FLASH_FOR, FORGIVE, HOME, LIVES, SHOT_EVERY, SHOT_RANGE,
  STRAFE, TRACER_FOR, WALK, WINDED,
  BUILD, at, buildMap, cellAt, clearLine, lockFor, machinesFor, middleOf, openCells, reach,
  sentriesFor, solid,
  type Breed, type Dice, type Machine, type Map, type Spot,
} from './level'

export const FIXED = 1 / 120

export type OutpostEvent =
  | 'fire' | 'hit' | 'down' | 'bolt' | 'hurt' | 'spotted'
  | 'pick' | 'refused' | 'open' | 'done' | 'over'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, like every other game in here:
 * `events.test.ts` reads this list and the event union together, because an
 * event missing from the list is never the loudest thing in any frame and so
 * is silent for ever with nothing to notice.
 */
export const LOUDEST: readonly OutpostEvent[] = [
  'over', 'done', 'open', 'hurt', 'down', 'refused', 'spotted', 'pick', 'hit', 'bolt', 'fire',
]

export type Status = 'playing' | 'done' | 'over'

/** A fuse lying on the ground where a machine went down. */
export interface Fuse {
  id: number
  x: number
  z: number
  number: number
  /** Seconds it has been there, for the bob and the glow. */
  age: number
  /**
   * Seconds before it can be picked up.
   *
   * Nought for one a machine dropped, and a couple of seconds for one shaken
   * off your own belt — otherwise you put it down at your feet and pick it
   * straight back up, for ever. The first version of this did exactly that,
   * inside the loop that was walking the list it was adding to, and the test
   * run died of a set with sixteen million things in it.
   */
  cool: number
}

/** One of theirs, in the air. */
export interface Bolt {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  age: number
}

/** One of yours, which is a line on the screen rather than a thing in the air. */
export interface Tracer {
  id: number
  fromX: number
  fromY: number
  fromZ: number
  toX: number
  toY: number
  toZ: number
  life: number
  /** Whether it ended in a machine. */
  struck: boolean
}

export interface Input {
  /** Where you are looking. */
  yaw: number
  pitch: number
  /** The stick: forward and sideways, each minus one to one. */
  walk: number
  side: number
  /** Whether the trigger is held. */
  firing: boolean
}

export const NO_INPUT: Input = { yaw: 0, pitch: 0, walk: 0, side: 0, firing: false }

export interface Run {
  mission: number
  map: Map
  status: Status
  score: number
  lives: number
  /** Seconds of being unhittable, after a bolt lands. */
  winded: number

  /** You. */
  x: number
  z: number
  yaw: number
  pitch: number

  machines: Machine[]
  fuses: Fuse[]
  bolts: Bolt[]
  tracers: Tracer[]
  /** The fuses on your belt, oldest first. */
  belt: number[]

  /** What the cage wants, and whether it has had it. */
  wants: number
  sockets: number
  open: boolean
  /** Where she is once the door is open, and whether she is out. */
  friend: { x: number; z: number } | null

  /** Seconds until the gun will fire again, and until the door will listen. */
  cooldown: number
  grumble: number
  /** The hunting field, and how long until it is worked out again. */
  field: Int32Array
  refield: number
  flash: number

  clock: number
  events: OutpostEvent[]
  seed: number
  nextId: number
}

// --- the dice ---------------------------------------------------------------

function makeDice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)) }
}

const stir = (seed: number): number => (seed * 1103515245 + 12345) >>> 0

// --- starting ----------------------------------------------------------------

export function newRun(mission = 1, lives = LIVES, score = 0, seed = 1): Run {
  const dice = makeDice(seed)
  const map = buildMap(mission, dice)
  const lock = lockFor(mission)

  /*
   * Machines go on the cells furthest from where you land, nearest-last, so
   * the compound fills up from the far end. Dropping in next to four of them
   * is not a hard mission, it is a short one.
   */
  const spots = openCells(map, map.pad).filter((spot) => {
    const far = Math.hypot(spot.x - map.pad.x, spot.y - map.pad.y)
    return far > 5
  })

  const machines: Machine[] = []
  const many = machinesFor(mission)
  const heavies = sentriesFor(mission)
  let id = 1
  const numbers = pickNumbers(mission, many, dice)
  for (let i = 0; i < many && spots.length > 0; i++) {
    const spot = spots.splice(dice.int(0, Math.min(spots.length - 1, 12)), 1)[0]
    const breed: Breed = i < heavies ? 'sentry' : 'patrol'
    const where = middleOf(spot)
    machines.push({
      id: id++,
      breed,
      x: where.x,
      z: where.z,
      facing: dice.next() * Math.PI * 2,
      beat: spot,
      life: BUILD[breed].tough,
      reload: dice.next(),
      alert: 0,
      fuse: numbers[i],
      down: false,
      since: 0,
    })
  }

  // What the door wants is made out of fuses that are really out there, so a
  // mission is never one that cannot be finished.
  const chosen: number[] = []
  const pool = machines.map((m) => m.fuse)
  for (let i = 0; i < lock.sockets && pool.length > 0; i++) {
    chosen.push(pool.splice(dice.int(0, pool.length - 1), 1)[0])
  }
  const wants = chosen.reduce((sum, n) => sum + n, 0)

  const start = middleOf(map.pad)
  return {
    mission,
    map,
    status: 'playing',
    score,
    lives,
    winded: 0,
    x: start.x,
    z: start.z,
    // Looking into the compound rather than at the wall you landed against.
    yaw: Math.atan2(middleOf(map.cage).x - start.x, -(middleOf(map.cage).z - start.z)),
    pitch: 0,
    machines,
    fuses: [],
    bolts: [],
    tracers: [],
    belt: [],
    wants,
    sockets: lock.sockets,
    open: false,
    friend: null,
    cooldown: 0,
    grumble: 0,
    field: reach(map, map.pad),
    refield: 0,
    flash: 0,
    clock: 0,
    events: [],
    seed: stir(seed),
    nextId: id + 1000,
  }
}

/**
 * The numbers on the fuses.
 *
 * Small and mostly different, so that "which two of these make fifteen" is a
 * question with one answer and a few near misses rather than a shrug. They get
 * bigger as the missions go on, which is the only way this game's arithmetic
 * gets harder — and the right way round, because by then you can move.
 */
function pickNumbers(mission: number, many: number, rng: Dice): number[] {
  const most = Math.min(20, 6 + mission * 2)
  const out: number[] = []
  for (let i = 0; i < many; i++) {
    let n = rng.int(1, most)
    for (let tries = 0; tries < 12 && out.includes(n); tries++) n = rng.int(1, most)
    out.push(n)
  }
  return out
}

export const nextMission = (run: Run): Run =>
  newRun(run.mission + 1, run.lives, run.score, run.seed + 1)

/** Carrying on after a knock, with everything where it was. */
export const serve = (run: Run): Run => ({
  ...run, status: 'playing', winded: WINDED * 2, events: [],
})

// --- where you are looking ---------------------------------------------------

/** The way you are facing, as a unit vector. */
export function facing(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const flat = Math.cos(pitch)
  return { x: Math.sin(yaw) * flat, y: Math.sin(pitch), z: -Math.cos(yaw) * flat }
}

/** How far a point is off the line you are looking down, in metres. */
export function offLine(
  fromX: number, fromY: number, fromZ: number,
  look: { x: number; y: number; z: number },
  atX: number, atY: number, atZ: number,
): { off: number; along: number } {
  const dx = atX - fromX
  const dy = atY - fromY
  const dz = atZ - fromZ
  const along = dx * look.x + dy * look.y + dz * look.z
  if (along <= 0) return { off: Infinity, along }
  const nx = fromX + look.x * along
  const ny = fromY + look.y * along
  const nz = fromZ + look.z * along
  return { off: Math.hypot(nx - atX, ny - atY, nz - atZ), along }
}

// --- moving ------------------------------------------------------------------

/**
 * One axis at a time, so a shoulder on a wall slides along it.
 *
 * Both axes at once and a wall stops you dead the moment you touch it at any
 * angle, which in a corridor means walking on the spot while the thing hunting
 * you catches up. That is not difficulty.
 */
function shove(map: Map, x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  let nx = x
  let nz = z
  if (dx !== 0) {
    const tryX = nx + dx
    const edge = tryX + Math.sign(dx) * BODY
    if (!solid(map, cellAt(edge, nz).x, cellAt(edge, nz).y)) nx = tryX
  }
  if (dz !== 0) {
    const tryZ = nz + dz
    const edge = tryZ + Math.sign(dz) * BODY
    if (!solid(map, cellAt(nx, edge).x, cellAt(nx, edge).y)) nz = tryZ
  }
  return { x: nx, z: nz }
}

/** The best step to take from here, down the field, towards wherever it came from. */
export function downhill(map: Map, field: Int32Array, x: number, z: number): { x: number; z: number } {
  const here = cellAt(x, z)
  const mine = field[here.y * map.wide + here.x]
  let best: Spot | null = null
  let low = mine < 0 ? Infinity : mine
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = here.x + dx
    const ny = here.y + dy
    if (solid(map, nx, ny)) continue
    const d = field[ny * map.wide + nx]
    if (d < 0 || d >= low) continue
    low = d
    best = { x: nx, y: ny }
  }
  if (!best) return { x: 0, z: 0 }
  const to = middleOf(best)
  const dx = to.x - x
  const dz = to.z - z
  const far = Math.hypot(dx, dz) || 1
  return { x: dx / far, z: dz / far }
}

// --- a step ------------------------------------------------------------------

export function step(run: Run, input: Input, dt: number): Run {
  if (run.status !== 'playing') return { ...run, events: [] }

  const next: Run = {
    ...run,
    machines: run.machines.map((m) => ({ ...m })),
    fuses: run.fuses.map((f) => ({ ...f })),
    bolts: run.bolts.map((b) => ({ ...b })),
    tracers: run.tracers.map((t) => ({ ...t })),
    belt: [...run.belt],
    events: [],
  }
  const dice = makeDice(next.seed)
  next.seed = stir(next.seed)
  next.clock += dt
  next.yaw = input.yaw
  next.pitch = input.pitch
  next.winded = Math.max(0, next.winded - dt)
  next.cooldown = Math.max(0, next.cooldown - dt)
  next.grumble = Math.max(0, next.grumble - dt)
  next.flash = Math.max(0, next.flash - dt)

  // --- you walk ---
  const ahead = { x: Math.sin(next.yaw), z: -Math.cos(next.yaw) }
  const right = { x: -ahead.z, z: ahead.x }
  const push = {
    x: (ahead.x * input.walk * WALK + right.x * input.side * STRAFE) * dt,
    z: (ahead.z * input.walk * WALK + right.z * input.side * STRAFE) * dt,
  }
  const moved = shove(next.map, next.x, next.z, push.x, push.z)
  next.x = moved.x
  next.z = moved.z

  // --- the hunting field ---
  next.refield -= dt
  if (next.refield <= 0) {
    next.refield = 0.3
    next.field = reach(next.map, cellAt(next.x, next.z))
  }

  // --- you shoot ---
  if (input.firing && next.cooldown <= 0) {
    next.cooldown = SHOT_EVERY
    next.flash = FLASH_FOR
    next.events.push('fire')
    const look = facing(next.yaw, next.pitch)
    const eyeY = EYE

    let struck: Machine | null = null
    let near = SHOT_RANGE
    for (const machine of next.machines) {
      if (machine.down) continue
      const size = BUILD[machine.breed].size
      const { off, along } = offLine(next.x, eyeY, next.z, look, machine.x, 0.95, machine.z)
      if (off > size + FORGIVE || along > near) continue
      if (!clearLine(next.map, next.x, next.z, machine.x, machine.z)) continue
      near = along
      struck = machine
    }

    if (struck) {
      struck.life -= 1
      // Being shot at wakes it up even if it never saw you, which is the only
      // fair way round: a machine that can be emptied into from behind without
      // noticing is not a guard.
      struck.alert = Math.max(struck.alert, 0.9)
      next.events.push('hit')
      if (struck.life <= 0) {
        struck.down = true
        struck.since = 0
        next.score += 60
        next.events.push('down')
        next.fuses.push({
          id: next.nextId++, x: struck.x, z: struck.z, number: struck.fuse, age: 0, cool: 0,
        })
      }
    }
    next.tracers.push({
      id: next.nextId++,
      fromX: next.x, fromY: eyeY - 0.12, fromZ: next.z,
      toX: next.x + look.x * near,
      toY: eyeY + look.y * near,
      toZ: next.z + look.z * near,
      life: TRACER_FOR,
      struck: struck !== null,
    })
  }

  for (const tracer of next.tracers) tracer.life -= dt
  next.tracers = next.tracers.filter((tracer) => tracer.life > 0)

  // --- the machines ---
  for (const machine of next.machines) {
    if (machine.down) { machine.since += dt; continue }
    const build = BUILD[machine.breed]

    // Can it see you? Range, then the cone it is looking down, then the wall
    // that might be in the way — all three, every time.
    const dx = next.x - machine.x
    const dz = next.z - machine.z
    const far = Math.hypot(dx, dz)
    let sees = false
    if (far < build.sees) {
      const toYou = Math.atan2(dx, -dz)
      let turn = toYou - machine.facing
      while (turn > Math.PI) turn -= Math.PI * 2
      while (turn < -Math.PI) turn += Math.PI * 2
      if (Math.abs(turn) < build.cone) {
        sees = clearLine(next.map, machine.x, machine.z, next.x, next.z)
      }
    }

    const was = machine.alert
    if (sees) {
      machine.alert = 1
      if (was < 0.35) {
        next.events.push('spotted')
        // And it shouts. Everything near it wakes up too, which is what turns
        // one careless corner into a fight worth remembering.
        for (const other of next.machines) {
          if (other.down || other.id === machine.id) continue
          if (Math.hypot(other.x - machine.x, other.z - machine.z) < 14) {
            other.alert = Math.max(other.alert, 0.6)
          }
        }
      }
    } else {
      machine.alert = Math.max(0, machine.alert - dt * 0.22)
    }

    if (machine.alert > 0.3) {
      // Hunting: turn towards you and come down the field.
      const want = Math.atan2(dx, -dz)
      machine.facing = turnTowards(machine.facing, want, dt * 3.2)
      if (build.hunt > 0 && far > 3.5) {
        const way = downhill(next.map, next.field, machine.x, machine.z)
        const got = shove(
          next.map, machine.x, machine.z, way.x * build.hunt * dt, way.z * build.hunt * dt,
        )
        machine.x = got.x
        machine.z = got.z
      }
      machine.reload -= dt
      if (sees && machine.reload <= 0) {
        machine.reload = build.every
        const toX = next.x - machine.x
        const toY = EYE - 1.0
        const toZ = next.z - machine.z
        const len = Math.hypot(toX, toY, toZ) || 1
        next.bolts.push({
          id: next.nextId++,
          x: machine.x, y: 1.0, z: machine.z,
          vx: (toX / len) * build.bolt,
          vy: (toY / len) * build.bolt,
          vz: (toZ / len) * build.bolt,
          age: 0,
        })
        next.events.push('bolt')
      }
    } else if (build.pace > 0) {
      // Walking its beat. A new one when it gets there, or when it has been
      // trying for too long: a machine wedged on a corner for ever is the
      // sort of thing nobody notices until a mission has none left in it.
      const spot = cellAt(machine.x, machine.z)
      if ((spot.x === machine.beat.x && spot.y === machine.beat.y) || dice.next() < dt * 0.08) {
        machine.beat = wander(next.map, spot, dice)
      }
      const field = beatField(next.map, machine.beat)
      const way = downhill(next.map, field, machine.x, machine.z)
      if (way.x !== 0 || way.z !== 0) {
        machine.facing = turnTowards(machine.facing, Math.atan2(way.x, -way.z), dt * 2)
        const got = shove(
          next.map, machine.x, machine.z, way.x * build.pace * dt, way.z * build.pace * dt,
        )
        machine.x = got.x
        machine.z = got.z
      }
    } else {
      // A sentry turns on the spot, which is what makes it something you can
      // time rather than something you have to be lucky about.
      machine.facing += dt * 0.5
    }
  }

  // --- their bolts ---
  const spent = new Set<number>()
  for (const bolt of next.bolts) {
    bolt.age += dt
    const steps = 3
    for (let i = 0; i < steps && !spent.has(bolt.id); i++) {
      bolt.x += (bolt.vx * dt) / steps
      bolt.y += (bolt.vy * dt) / steps
      bolt.z += (bolt.vz * dt) / steps
      if (solid(next.map, cellAt(bolt.x, bolt.z).x, cellAt(bolt.x, bolt.z).y)) spent.add(bolt.id)
      else if (bolt.y < 0.05 || bolt.age > 3) spent.add(bolt.id)
      else if (Math.hypot(bolt.x - next.x, bolt.z - next.z) < 0.55 && Math.abs(bolt.y - 1.1) < 1.1) {
        spent.add(bolt.id)
        if (next.winded <= 0) {
          next.winded = WINDED
          next.lives -= 1
          next.events.push('hurt')
        }
      }
    }
  }
  next.bolts = next.bolts.filter((bolt) => !spent.has(bolt.id))

  // --- fuses on the ground ---
  const taken = new Set<number>()
  const dropped: Fuse[] = []
  for (const fuse of next.fuses) {
    fuse.age += dt
    fuse.cool = Math.max(0, fuse.cool - dt)
    if (fuse.cool > 0) continue
    if (Math.hypot(fuse.x - next.x, fuse.z - next.z) > CLOSE) continue
    taken.add(fuse.id)
    next.belt.push(fuse.number)
    next.score += 25
    next.events.push('pick')
    /*
     * A full belt swaps rather than refuses. Refusing is how a mission quietly
     * becomes unfinishable: four wrong numbers in your pockets and the one you
     * need lying on the floor in front of you.
     */
    if (next.belt.length > BELT) {
      const spare = next.belt.shift() as number
      dropped.push({ id: next.nextId++, x: next.x, z: next.z, number: spare, age: 0, cool: 2.5 })
    }
  }
  next.fuses = next.fuses.filter((fuse) => !taken.has(fuse.id)).concat(dropped)

  // --- the cage ---
  const door = middleOf(next.map.cage)
  const atDoor = Math.hypot(door.x - next.x, door.z - next.z) < CLOSE + 1
  if (!next.open && atDoor) {
    const set = pickThatMakes(next.belt, next.sockets, next.wants)
    if (set) {
      next.open = true
      next.friend = { x: door.x, z: door.z }
      for (const n of set) next.belt.splice(next.belt.indexOf(n), 1)
      next.score += 500
      next.events.push('open')
    } else if (next.grumble <= 0) {
      next.grumble = 1.6
      next.events.push('refused')
    }
  }

  // --- her, following you home ---
  if (next.friend) {
    const dx = next.x - next.friend.x
    const dz = next.z - next.friend.z
    const far = Math.hypot(dx, dz)
    if (far > 2) {
      const way = downhill(next.map, next.field, next.friend.x, next.friend.z)
      const pace = Math.min(WALK * 0.95, 2.6 + far * 0.35)
      const got = shove(next.map, next.friend.x, next.friend.z, way.x * pace * dt, way.z * pace * dt)
      next.friend.x = got.x
      next.friend.z = got.z
    }
    const pad = middleOf(next.map.pad)
    const home = Math.hypot(pad.x - next.x, pad.z - next.z) < HOME
    const herHome = Math.hypot(pad.x - next.friend.x, pad.z - next.friend.z) < HOME + 1
    if (home && herHome) {
      next.status = 'done'
      // Quickly, and with everything still standing, is worth more.
      const quick = Math.max(0, 600 - Math.round(next.clock) * 2)
      const cleared = next.machines.filter((m) => m.down).length * 40
      next.score += 1000 + quick + cleared
      next.events.push('done')
    }
  }

  if (next.lives <= 0 && next.status === 'playing') {
    next.status = 'over'
    next.events.push('over')
  }

  return next
}

/** Turning, but no faster than it can turn. */
function turnTowards(from: number, to: number, most: number): number {
  let turn = to - from
  while (turn > Math.PI) turn -= Math.PI * 2
  while (turn < -Math.PI) turn += Math.PI * 2
  return from + Math.max(-most, Math.min(most, turn))
}

/** Somewhere else on the floor to walk to, a few cells off. */
function wander(map: Map, from: Spot, rng: Dice): Spot {
  for (let tries = 0; tries < 24; tries++) {
    const x = from.x + rng.int(-6, 6)
    const y = from.y + rng.int(-6, 6)
    if (at(map, x, y) === 'floor') return { x, y }
  }
  return from
}

/*
 * The field for a beat, worked out once and kept.
 *
 * A machine walking to the same corner every frame does not need its route
 * recalculated every frame, and there are only ever a handful of corners in
 * play. Without this the patrols cost more than everything else put together.
 */
const beats = new globalThis.Map<string, Int32Array>()
function beatField(map: Map, beat: Spot): Int32Array {
  const key = `${map.wide}:${map.cells.length}:${beat.x},${beat.y}`
  const had = beats.get(key)
  if (had) return had
  const made = reach(map, beat)
  if (beats.size > 400) beats.clear()
  beats.set(key, made)
  return made
}

/**
 * The fuses on your belt that make what the door is asking for.
 *
 * Every pair, or every three once the missions get long. There are never more
 * than four on the belt, so this is a handful of sums — and it is the one
 * place in the game where the arithmetic is actually done for you, because
 * what the game is asking you to work out is which numbers to go and *fetch*.
 */
export function pickThatMakes(belt: number[], sockets: number, wants: number): number[] | null {
  const found: number[] = []
  const walk = (from: number, left: number, sum: number): boolean => {
    if (left === 0) return sum === wants
    for (let i = from; i < belt.length; i++) {
      found.push(belt[i])
      if (walk(i + 1, left - 1, sum + belt[i])) return true
      found.pop()
    }
    return false
  }
  return walk(0, sockets, 0) ? [...found] : null
}

/** What is left to do, for the top of the screen. */
export const standing = (run: Run): number =>
  run.machines.filter((m) => !m.down).length

/** How much of the door's total you still have to find. */
export const stillNeeds = (run: Run): number => {
  if (run.open) return 0
  const best = bestSoFar(run.belt, run.sockets, run.wants)
  return run.wants - best
}

/** The nearest a belt gets to the total without going over it. */
function bestSoFar(belt: number[], sockets: number, wants: number): number {
  let best = 0
  const walk = (from: number, left: number, sum: number) => {
    if (sum <= wants && sum > best) best = sum
    if (left === 0) return
    for (let i = from; i < belt.length; i++) walk(i + 1, left - 1, sum + belt[i])
  }
  walk(0, sockets, 0)
  return best
}
