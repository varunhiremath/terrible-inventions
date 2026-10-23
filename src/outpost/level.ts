/**
 * The outpost: the place, and what is in it.
 *
 * "You are a soldier on a mission. You have landed in a map, you need to find
 * and shoot enemies and then rescue someone or finish a mission."
 *
 * So: a walled compound at dusk, dropped into from one corner, with somebody
 * locked in a cage at the other end of it and a chopper waiting back where you
 * landed. Everything between is Papa's.
 *
 * Two decisions worth stating, because both were made on purpose and both
 * shape everything else.
 *
 * The first is what you are shooting. Not people. This app has had that
 * conversation once already — the swarm's first build put a crowd of little
 * figures in front of a gun and the verdict was immediate, "it seems like I'm
 * shooting people, that's not the idea" — and the answer there was monsters.
 * Here it is the thing the whole app is about: {papa} builds machines, and the
 * outpost is full of them. They clatter, they spark, and they power down. The
 * only person in the compound is the one you have come to get out.
 *
 * The second is that the arithmetic is the lock on her cage. Every machine
 * carries a numbered fuse; the cage door wants a total; you have to work out
 * which of the fuses on your belt make it and which number you are still
 * missing — and then go and find the machine carrying it. That is a sum with
 * legs: it sends you back out into the compound to look for a six.
 */

/** The dice, as little of them as this file needs. */
export interface Dice {
  next(): number
  int(min: number, max: number): number
}

// --- the shape of the place --------------------------------------------------

/** How big a cell is, in metres. Everything else is in metres too. */
export const CELL = 3.2

/** Where your eyes are, standing up. */
export const EYE = 1.62

/** How many hits you can take. Shown as dots, like every other game here. */
export const LIVES = 5

/** How fast you walk, and how fast that is sideways. */
export const WALK = 4.4
export const STRAFE = 3.6
/** How far from a wall your shoulders keep you. */
export const BODY = 0.42

export type Cell = 'floor' | 'wall' | 'crate'

export interface Spot {
  x: number
  y: number
}

export interface Map {
  wide: number
  tall: number
  /** Row-major, `wide * tall` of them. */
  cells: Cell[]
  /** Where the chopper left you, and where it will come back for you. */
  pad: Spot
  /** The cage, and the way in to it. */
  cage: Spot
}

export const at = (map: Map, x: number, y: number): Cell =>
  (x < 0 || y < 0 || x >= map.wide || y >= map.tall) ? 'wall' : map.cells[y * map.wide + x]

export const solid = (map: Map, x: number, y: number): boolean => at(map, x, y) !== 'floor'

/** A cell's middle, in metres. */
export const middleOf = (spot: Spot): { x: number; z: number } => ({
  x: (spot.x + 0.5) * CELL,
  z: (spot.y + 0.5) * CELL,
})

/** Which cell a point in metres is in. */
export const cellAt = (x: number, z: number): Spot => ({
  x: Math.floor(x / CELL),
  y: Math.floor(z / CELL),
})

// --- building one ------------------------------------------------------------

/** How big the compound is on a given mission. */
export const sizeFor = (mission: number): number => Math.min(30, 20 + mission * 2)

/** How many machines are in it, and how tough they are. */
export const machinesFor = (mission: number): number => Math.min(14, 4 + mission * 2)
export const sentriesFor = (mission: number): number => Math.max(0, Math.floor((mission - 1) / 2))

/**
 * Every floor cell you can walk to from `from`, as a map of distances.
 *
 * The one piece of pathfinding in the game, and everything uses it: whether the
 * cage can be reached at all, how far apart to put things, where a machine goes
 * when it is hunting you, and which way the person you are rescuing follows you
 * round a corner. One breadth-first sweep of a thousand cells costs nothing and
 * is right every time, which is more than can be said for walking towards
 * somebody and hoping there is no wall in between.
 */
export function reach(map: Map, from: Spot): Int32Array {
  const far = new Int32Array(map.wide * map.tall).fill(-1)
  if (solid(map, from.x, from.y)) return far
  const queue: number[] = [from.y * map.wide + from.x]
  far[queue[0]] = 0
  for (let head = 0; head < queue.length; head++) {
    const here = queue[head]
    const x = here % map.wide
    const y = (here - x) / map.wide
    const step = far[here] + 1
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (solid(map, nx, ny)) continue
      const next = ny * map.wide + nx
      if (far[next] !== -1) continue
      far[next] = step
      queue.push(next)
    }
  }
  return far
}

/** How many floor cells there are in one piece, from here. */
const openFrom = (map: Map, from: Spot): number =>
  reach(map, from).reduce((sum, d) => (d >= 0 ? sum + 1 : sum), 0)

const floorCount = (map: Map): number =>
  map.cells.reduce((sum, cell) => (cell === 'floor' ? sum + 1 : sum), 0)

/**
 * A compound, built by stamping buildings into a yard.
 *
 * Not carved like a maze: a maze is corridors, and a corridor is a place where
 * a machine you did not see is always exactly in front of you. A yard with
 * buildings in it has sight lines and corners and places to get behind, which
 * is what this game is actually made of.
 *
 * Every block is stamped provisionally and taken straight back out again if it
 * has cut the yard in two. That is the rule this project has had to learn
 * twice in other games: a promise made when something is placed does not
 * survive the next thing being placed, so the check belongs after every stamp
 * rather than once at the end.
 */
export function buildMap(mission: number, rng: Dice): Map {
  const wide = sizeFor(mission)
  const tall = wide
  const cells: Cell[] = Array.from({ length: wide * tall }, (_, i) => {
    const x = i % wide
    const y = (i - x) / wide
    return (x === 0 || y === 0 || x === wide - 1 || y === tall - 1) ? 'wall' : 'floor'
  })
  const map: Map = {
    wide,
    tall,
    cells,
    pad: { x: 3, y: tall - 4 },
    cage: { x: wide - 4, y: 3 },
  }

  const keep = (spot: Spot, room: number) => (x: number, y: number) =>
    Math.abs(x - spot.x) <= room && Math.abs(y - spot.y) <= room

  const nearPad = keep(map.pad, 3)
  const nearCage = keep(map.cage, 2)

  const blocks = 5 + Math.floor(mission * 1.2)
  for (let i = 0; i < blocks * 3 && countBlocks(map) < blocks; i++) {
    const bw = rng.int(2, 5)
    const bh = rng.int(2, 5)
    const bx = rng.int(2, wide - 3 - bw)
    const by = rng.int(2, tall - 3 - bh)

    const touched: number[] = []
    let clash = false
    for (let y = by; y < by + bh && !clash; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (nearPad(x, y) || nearCage(x, y)) { clash = true; break }
        touched.push(y * wide + x)
      }
    }
    if (clash) continue

    const was = touched.map((n) => map.cells[n])
    for (const n of touched) map.cells[n] = 'wall'
    // And out again if that walled something off. A yard in two pieces is a
    // mission that cannot be finished, and nothing later would say why.
    if (openFrom(map, map.pad) !== floorCount(map)) {
      touched.forEach((n, j) => { map.cells[n] = was[j] })
    }
  }

  // A scatter of crates for cover. They block a shot and a step like a wall,
  // but they are waist high and you can see over them, which is the whole
  // point of them being there.
  const crates = 6 + mission * 2
  for (let i = 0; i < crates; i++) {
    const x = rng.int(2, wide - 3)
    const y = rng.int(2, tall - 3)
    if (map.cells[y * wide + x] !== 'floor') continue
    if (nearPad(x, y) || nearCage(x, y)) continue
    map.cells[y * wide + x] = 'crate'
    if (openFrom(map, map.pad) !== floorCount(map)) map.cells[y * wide + x] = 'floor'
  }

  return map
}

const countBlocks = (map: Map): number => {
  // Near enough: the wall cells that are not the ring round the outside,
  // counted in fours, which is all the generator above needs to know.
  let inner = 0
  for (let y = 1; y < map.tall - 1; y++) {
    for (let x = 1; x < map.wide - 1; x++) if (at(map, x, y) === 'wall') inner++
  }
  return Math.floor(inner / 6)
}

/** Every floor cell, furthest from `from` first. */
export function openCells(map: Map, from: Spot): Spot[] {
  const far = reach(map, from)
  const out: Spot[] = []
  for (let y = 1; y < map.tall - 1; y++) {
    for (let x = 1; x < map.wide - 1; x++) {
      if (at(map, x, y) !== 'floor') continue
      if (far[y * map.wide + x] < 0) continue
      out.push({ x, y })
    }
  }
  return out.sort((a, b) =>
    far[b.y * map.wide + b.x] - far[a.y * map.wide + a.x])
}

// --- what can see what -------------------------------------------------------

/**
 * Whether there is a clear line between two points on the floor.
 *
 * Walked along in short steps rather than solved: the cells are three metres
 * across and a sight line is only ever a few dozen metres, so forty samples is
 * exact enough for anybody and is obviously right, which matters more here
 * than being clever. A machine that shoots you through a wall is the single
 * most unfair thing a game like this can do.
 */
export function clearLine(map: Map, ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax
  const dz = bz - az
  const far = Math.hypot(dx, dz)
  const steps = Math.max(2, Math.ceil(far / (CELL * 0.35)))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const spot = cellAt(ax + dx * t, az + dz * t)
    if (solid(map, spot.x, spot.y)) return false
  }
  return true
}

// --- the machines ------------------------------------------------------------

export type Breed = 'patrol' | 'sentry'

export interface Build {
  /** How many hits it takes. */
  tough: number
  /** How fast it walks, patrolling and hunting. */
  pace: number
  hunt: number
  /** How far it can see you, and how wide its look is, in radians. */
  sees: number
  cone: number
  /** Seconds between its shots, and how fast they travel. */
  every: number
  bolt: number
  /** How big it is, for being shot at and for bumping into. */
  size: number
}

export const BUILD: Record<Breed, Build> = {
  /*
   * The ordinary one: walks a beat, looks where it is going, and is not very
   * quick about any of it. Three of these can still corner you, which is the
   * only difficulty this game needs in its first mission.
   */
  patrol: { tough: 2, pace: 1.5, hunt: 2.6, sees: 17, cone: 1.1, every: 1.5, bolt: 17, size: 0.8 },
  /*
   * The big one, from the third mission on. It does not walk a beat — it
   * stands at a corner and watches, sees further, and takes four hits. A thing
   * that does not move is a thing you can plan around, which is what makes it
   * fair at twice the toughness.
   */
  sentry: { tough: 4, pace: 0, hunt: 0, sees: 24, cone: 1.5, every: 1.1, bolt: 21, size: 1.1 },
}

export interface Machine {
  id: number
  breed: Breed
  x: number
  z: number
  /** The way it is facing, in radians, and the way it is walking. */
  facing: number
  /** Where it is heading on its beat, as a cell. */
  beat: Spot
  /** Hits left in it. */
  life: number
  /** Seconds until it can fire again. */
  reload: number
  /** How awake it is: nought asleep, one hunting. Falls off slowly. */
  alert: number
  /** The number on the fuse it is carrying. */
  fuse: number
  /** Powered down, left lying where it fell. */
  down: boolean
  /** Seconds since it went down, for the sparks. */
  since: number
}

// --- the lock ----------------------------------------------------------------

/**
 * What the cage door wants.
 *
 * Two numbers that make a total, out of the fuses the machines are carrying.
 * The total is always makeable — it is built by picking two of the fuses that
 * are actually out there — and there are always a couple of other pairs that
 * nearly work, because "nearly" is where the arithmetic happens.
 */
export interface Lock {
  /** The total the door is asking for. */
  wants: number
  /** How many fuses it takes to make it. Two, until the missions get long. */
  sockets: number
}

export const lockFor = (mission: number): Lock => ({
  wants: 0,
  sockets: mission >= 5 ? 3 : 2,
})

/** How many fuses you can carry. */
export const BELT = 4

/** How near you have to be to pick a fuse up, or to work the door. */
export const CLOSE = 1.5

// --- the gun -----------------------------------------------------------------

/** Seconds between shots, how far one carries, and what it does. */
export const SHOT_EVERY = 0.24
export const SHOT_RANGE = 60
/**
 * How much bigger a machine is to a bullet than it is to the eye.
 *
 * A quarter of a metre, added to its own size, and that is the whole of the
 * aim assist. It is a distance rather than an angle on purpose: an angle is
 * generous at range and miserly up close, which is backwards — close up is
 * where a nine-year-old is panicking.
 */
export const FORGIVE = 0.25

/** How long a tracer is left on the screen, and a muzzle flash. */
export const TRACER_FOR = 0.07
export const FLASH_FOR = 0.06

/** Seconds of being unhittable after you are hit, so two bolts are not five. */
export const WINDED = 1.1

/** How near the chopper you have to be, with her, to get out. */
export const HOME = 2.4
