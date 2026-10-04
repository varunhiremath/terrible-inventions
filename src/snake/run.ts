/**
 * The garden, simulated.
 *
 * Pure, fixed-timestep, and knows nothing about a canvas: `step(run, input,
 * dt)` and nothing else, the same shape as every other game in here. It is
 * the only way the awkward parts of this one — whether a ring closed, what was
 * inside it, whether a head met a body — can be tested at all, because none of
 * them are things you can see in a screenshot after the fact.
 */
import {
  ARENA, BEAD, DASH_COST, DASH_SPEED, FROST_SCALE, GIRTH, LEAST_LENGTH, LURE_PULL, LURE_REACH,
  NECK, NEW_LENGTH, PELLET_COUNT, PELLET_FEEDS, PELLET_SCORE, PICKUP, POWER_COUNT, POWER_LASTS,
  POWERS, REMAINS, RIVALS, ROSTER, SETTLING, SPEED, TURN, type Power, type Rival,
} from './level'

export const FIXED = 1 / 60

/** How often a rival makes up its mind, in seconds. */
export const THINK_EVERY = 4 / 60

export type SnakeEvent =
  | 'eat' | 'grow' | 'power' | 'ring' | 'trap' | 'died' | 'kill' | 'close'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, for the reason written out in
 * the space run: a list in a screen is a list no test can reach, and an event
 * missing from one took the whole app down twice in an afternoon.
 */
export const LOUDEST: readonly SnakeEvent[] = [
  'died', 'trap', 'kill', 'ring', 'power', 'close', 'grow', 'eat',
]

export interface Point {
  x: number
  y: number
}

export interface Snake {
  id: number
  who: Rival | null
  /** Head first. Every bead is BEAD apart along the path. */
  body: Point[]
  /** Where the head is pointing, in radians. */
  heading: number
  /** How long it should be, in units. The body is trimmed to this. */
  length: number
  alive: boolean
  score: number
  /** Powers in hand, and how long each has left. */
  held: Partial<Record<Power, number>>
  /** Counts down after a ring closes, so the drawing can flash it. */
  flash: number
  /**
   * A rival's last decision, and when it is due to make the next one.
   *
   * Sixty decisions a second is sixty times more than anybody can tell from
   * watching, and the deciding is nearly all of what this game costs to run.
   * A snake turns no faster than TURN either way, so a heading chosen four
   * frames ago is a heading it is still turning towards.
   */
  want: number
  thinkIn: number
}

export interface Pellet {
  id: number
  x: number
  y: number
  worth: number
  /** Bigger ones are what is left of a snake, and are worth looking at. */
  big: boolean
}

export interface Drop {
  id: number
  x: number
  y: number
  kind: Power
  /** Bobs, so it reads as a thing to pick up rather than a thing to avoid. */
  bob: number
}

export interface Input {
  /** Where the stick is pushed, -1 to 1 on each axis. Zero means carry on. */
  x: number
  y: number
  /** Held: faster, and it eats into your length. */
  dash: boolean
}

export const NO_INPUT: Input = { x: 0, y: 0, dash: false }

export type Status = 'playing' | 'lost'

export interface Run {
  snakes: Snake[]
  pellets: Pellet[]
  drops: Drop[]
  /** How long this life has lasted, which is the score in this game. */
  lived: number
  status: Status
  /** The ring just closed, for the drawing to show for a moment. */
  ring: Point[] | null
  ringFor: number
  events: SnakeEvent[]
  seed: number
  nextId: number
  /** How many rivals this round has seen off, for the board. */
  caught: number
  /**
   * How much the garden keeps on the ground.
   *
   * Carried on the run rather than read from the constants, so that a test can
   * ask for an empty one. The first version read the constants, which meant
   * that a run set up with no pellets grew a hundred and fifty of them on its
   * first step — and three tests about a snake's length were quietly measuring
   * a snake that had been eating the whole time.
   */
  food: number
  charms: number
}

// --- the dice ---------------------------------------------------------------

interface Rng {
  next(): number
  int(from: number, to: number): number
}

function makeRng(seed: number): Rng {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  return { next, int: (from, to) => from + Math.floor(next() * (to - from + 1)) }
}

// --- geometry ---------------------------------------------------------------

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Inside the garden, which is a circle. */
export const inGarden = (p: Point) => Math.hypot(p.x, p.y) <= ARENA

/**
 * Whether a point is inside a closed ring.
 *
 * The crossing-number rule: count how many times a ray cast to the right
 * crosses the ring. Odd is inside. It is the one piece of real geometry in
 * here and the only part of an encircle that cannot be eyeballed, so it is
 * tested on its own against shapes whose answers are known by hand.
 */
export function inside(ring: readonly Point[], p: Point): boolean {
  let yes = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if ((a.y > p.y) === (b.y > p.y)) continue
    const at = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (p.x < at) yes = !yes
  }
  return yes
}

/** How much ground a ring covers, for deciding whether it is worth anything. */
export function ringArea(ring: readonly Point[]): number {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y)
  }
  return Math.abs(sum / 2)
}

// --- snakes -----------------------------------------------------------------

export function newSnake(id: number, who: Rival | null, at: Point, heading: number): Snake {
  // One more bead than there are gaps between them, which is the whole of the
  // difference between a snake 2.4 long and one 2.24 long.
  const beads = Math.max(2, Math.round(NEW_LENGTH / BEAD) + 1)
  const body: Point[] = []
  for (let i = 0; i < beads; i++) {
    body.push({ x: at.x - Math.cos(heading) * BEAD * i, y: at.y - Math.sin(heading) * BEAD * i })
  }
  return {
    id, who, body, heading, length: NEW_LENGTH, alive: true, score: 0, held: {},
    flash: 0, want: heading, thinkIn: 0,
  }
}

/** The head, which is the only part that can do anything. */
export const headOf = (s: Snake): Point => s.body[0]

/** How fat a snake is: it thickens as it grows, the way the original does. */
export const girthOf = (s: Snake): number =>
  GIRTH * (0.8 + Math.min(0.9, (s.length - NEW_LENGTH) / 26))

/**
 * Walk the head forward and drag the rest after it.
 *
 * The body is a string of beads a fixed distance apart rather than a list of
 * past positions, which is what keeps it the same shape whatever the frame
 * rate: a path sampled per frame bunches up when the frame rate drops and a
 * snake that bunches up eats itself.
 */
function advance(s: Snake, by: number): void {
  const head = s.body[0]
  const to = { x: head.x + Math.cos(s.heading) * by, y: head.y + Math.sin(s.heading) * by }
  s.body.unshift(to)

  let want = Math.max(LEAST_LENGTH, s.length)
  const kept: Point[] = [to]
  let at = to
  for (let i = 1; i < s.body.length && want > 0; i++) {
    const next = s.body[i]
    const gap = dist(at, next)
    if (gap < 1e-9) continue
    if (gap >= want) {
      kept.push({ x: at.x + ((next.x - at.x) * want) / gap, y: at.y + ((next.y - at.y) * want) / gap })
      want = 0
      break
    }
    kept.push(next)
    want -= gap
    at = next
  }
  s.body = kept
}

/** Turn towards a heading, by no more than the snake can manage. */
function steer(s: Snake, want: number, dt: number): void {
  let off = want - s.heading
  while (off > Math.PI) off -= Math.PI * 2
  while (off < -Math.PI) off += Math.PI * 2
  const most = TURN * dt
  s.heading += Math.max(-most, Math.min(most, off))
}

/**
 * Where a snake's body lies, as beads, skipping the neck.
 *
 * The neck is skipped because the beads right behind the head are always
 * within a girth of it — that is what being attached means — so counting them
 * would kill every snake on its first step.
 */
function beadsOf(s: Snake, skip: number): Point[] {
  const out: Point[] = []
  let at = s.body[0]
  let along = 0
  for (let i = 1; i < s.body.length; i++) {
    const next = s.body[i]
    let gap = dist(at, next)
    while (gap > 1e-9) {
      const step = Math.min(gap, BEAD)
      along += step
      const t = step / gap
      at = { x: at.x + (next.x - at.x) * t, y: at.y + (next.y - at.y) * t }
      gap -= step
      if (along >= skip * BEAD) out.push(at)
    }
    at = next
  }
  return out
}

/** Everything a snake's body occupies, head included, for somebody else to hit. */
export const bodyOf = (s: Snake): Point[] => beadsOf(s, 0)

// --- where everything is ----------------------------------------------------

/**
 * Every bead in the garden, filed by the square of ground it sits on.
 *
 * Built once a step and asked many times. Without it this game does not run on
 * a phone: the rivals weigh up sixteen headings each, each heading against
 * every bead of every snake, and the snakes get longer as the round goes on —
 * so the cost climbs with the square of how well everybody is doing. Measured
 * at five milliseconds a step with five short snakes, against a frame of
 * sixteen, and that was the *opening* of a round.
 *
 * A square of a unit is bigger than anything that looks further than a couple
 * of them, so a query is a handful of buckets rather than a walk of the lot.
 */
export const CELL = 1

export interface Bead {
  x: number
  y: number
  /** Whose, and how far back along them, so a neck can be skipped. */
  who: number
  at: number
}

export interface Grid {
  cells: Map<number, Bead[]>
  beads: Map<number, Point[]>
}

const keyOf = (x: number, y: number) =>
  (Math.floor(x / CELL) + 512) * 4096 + (Math.floor(y / CELL) + 512)

export function gridOf(snakes: readonly Snake[]): Grid {
  const cells = new Map<number, Bead[]>()
  const beads = new Map<number, Point[]>()
  for (const s of snakes) {
    if (!s.alive) continue
    const mine = beadsOf(s, 0)
    beads.set(s.id, mine)
    for (let i = 0; i < mine.length; i++) {
      const bead: Bead = { x: mine[i].x, y: mine[i].y, who: s.id, at: i }
      const key = keyOf(bead.x, bead.y)
      const bucket = cells.get(key)
      if (bucket) bucket.push(bead)
      else cells.set(key, [bead])
    }
  }
  return { cells, beads }
}

/** Everything within `reach` of a point, give or take a square. */
export function near(grid: Grid, x: number, y: number, reach: number): Bead[] {
  const out: Bead[] = []
  const span = Math.ceil(reach / CELL)
  const cx = Math.floor(x / CELL)
  const cy = Math.floor(y / CELL)
  for (let i = -span; i <= span; i++) {
    for (let j = -span; j <= span; j++) {
      const bucket = grid.cells.get(keyOf((cx + i) * CELL, (cy + j) * CELL))
      if (bucket) out.push(...bucket)
    }
  }
  return out
}

// --- the ring ---------------------------------------------------------------

/**
 * Has the head come back round onto its own body, and what did it enclose?
 *
 * This is the move the whole game is named for. The head is checked against
 * its own beads past the neck; the first one it touches closes a ring, and the
 * ring is the stretch of body from the head round to that bead.
 *
 * Returns the ring and where along the body it closed, or null.
 */
export function ringOf(s: Snake): { ring: Point[]; at: number } | null {
  const beads = beadsOf(s, NECK)
  const head = s.body[0]
  const reach = girthOf(s) * 0.9
  for (let i = 0; i < beads.length; i++) {
    if (dist(head, beads[i]) > reach) continue
    const ring = [head, ...beads.slice(0, i + 1)]
    // Three points is not a ring, it is a kink in the neck.
    if (ring.length < 6) return null
    return { ring, at: i }
  }
  return null
}

/** Shorten a snake to the part outside the ring it just closed. */
function cutTo(s: Snake, at: number): number {
  const lost = (at + NECK) * BEAD
  const was = s.length
  s.length = Math.max(LEAST_LENGTH, s.length - lost)
  return was - s.length
}

// --- the garden ------------------------------------------------------------

function scatter(rng: Rng): Point {
  // Rejection into a circle. Picking an angle and a radius evenly bunches
  // everything in the middle, which looks like a flower rather than a field.
  for (;;) {
    const x = (rng.next() * 2 - 1) * ARENA
    const y = (rng.next() * 2 - 1) * ARENA
    if (Math.hypot(x, y) < ARENA * 0.94) return { x, y }
  }
}

export function newRun(seed = 1, rivals = RIVALS, food = PELLET_COUNT, charms = POWER_COUNT): Run {
  const rng = makeRng(seed)
  const run: Run = {
    snakes: [],
    pellets: [],
    drops: [],
    lived: 0,
    status: 'playing',
    ring: null,
    ringFor: 0,
    events: [],
    seed,
    nextId: 1,
    caught: 0,
    food,
    charms,
  }
  run.snakes.push(newSnake(run.nextId++, null, { x: 0, y: 0 }, rng.next() * Math.PI * 2))
  for (let i = 0; i < rivals; i++) {
    // Away from the middle, so nobody opens the round inside somebody else.
    const angle = (i / Math.max(1, rivals)) * Math.PI * 2 + rng.next() * 0.4
    const far = ARENA * (0.45 + rng.next() * 0.4)
    run.snakes.push(newSnake(
      run.nextId++,
      ROSTER[i % ROSTER.length],
      { x: Math.cos(angle) * far, y: Math.sin(angle) * far },
      angle + Math.PI,
    ))
  }
  for (let i = 0; i < food; i++) {
    const at = scatter(rng)
    run.pellets.push({ id: run.nextId++, x: at.x, y: at.y, worth: 1, big: false })
  }
  for (let i = 0; i < charms; i++) {
    const at = scatter(rng)
    run.drops.push({ id: run.nextId++, x: at.x, y: at.y, kind: POWERS[i % POWERS.length], bob: rng.next() })
  }
  return run
}

/** What a snake leaves when it goes: its length back on the ground. */
function spill(run: Run, s: Snake, rng: Rng): void {
  const beads = bodyOf(s)
  const want = Math.max(4, Math.round(s.length * REMAINS))
  for (let i = 0; i < want; i++) {
    const at = beads[Math.floor((i / want) * beads.length)] ?? headOf(s)
    run.pellets.push({
      id: run.nextId++,
      x: at.x + (rng.next() - 0.5) * 0.3,
      y: at.y + (rng.next() - 0.5) * 0.3,
      worth: 2,
      big: true,
    })
  }
}

/** Put a snake back in, somewhere nobody is, so the garden stays busy. */
function restock(run: Run, rng: Rng): void {
  const living = run.snakes.filter((s) => s.alive && s.who).length
  if (living >= RIVALS) return
  for (let tries = 0; tries < 20; tries++) {
    const at = scatter(rng)
    const clear = run.snakes.every((s) => !s.alive || dist(headOf(s), at) > 3)
    if (!clear) continue
    const who = ROSTER[rng.int(0, ROSTER.length - 1)]
    run.snakes.push(newSnake(run.nextId++, who, at, rng.next() * Math.PI * 2))
    return
  }
}

// --- the rivals' brains -----------------------------------------------------

/**
 * What a rival wants to do this frame.
 *
 * Three things in order, and the order is the whole personality: do not die,
 * then chase if it is that sort of snake, then eat. The "do not die" part is
 * what stops them being free food, and the fact that it comes first is what
 * stops them being unbeatable — a snake that always swerves is a snake you can
 * herd into a wall.
 */
function brainOf(run: Run, grid: Grid, self: Snake, rng: Rng): number {
  const head = headOf(self)
  const care = self.who?.care ?? 1.5
  const mean = self.who?.mean ?? 0.3

  /** How bad a heading looks: the nearest thing in the way, and the wall. */
  const risk = (angle: number): number => {
    const look = { x: head.x + Math.cos(angle) * care, y: head.y + Math.sin(angle) * care }
    let worst = 0
    // The wall. Measured against where it is looking, not where it is, or it
    // only ever notices the edge once it is in it.
    const out = Math.hypot(look.x, look.y) - ARENA * 0.96
    if (out > -0.5) worst = Math.max(worst, 2 + out)
    for (const bead of near(grid, look.x, look.y, care)) {
      if (bead.who === self.id && bead.at < NECK) continue
      const gap = Math.hypot(bead.x - look.x, bead.y - look.y)
      if (gap < care) worst = Math.max(worst, (care - gap) / care)
    }
    return worst
  }

  /** What is worth going towards. */
  const want = (angle: number): number => {
    const look = { x: head.x + Math.cos(angle) * care, y: head.y + Math.sin(angle) * care }
    let good = 0
    for (const p of run.pellets) {
      const gap = Math.hypot(p.x - look.x, p.y - look.y)
      if (gap < 3) good += (p.worth * (3 - gap)) / 3
    }
    /*
     * And the player, if it is that sort of snake: cutting across a nose is
     * how a snake kills, so it aims a little in front of one.
     *
     * But only once there is something there worth having. Five rivals set on
     * a snake the length it starts at will swarm it inside three seconds, and
     * three seconds is not a game — it is also not how this works anywhere
     * else, where the big snakes hunt and the little ones are beneath notice.
     * So you become a target as you become worth eating.
     */
    const you = run.snakes[0]
    const worth = Math.min(1, Math.max(0, (you.length - 4.5) / 8))
    if (mean * worth > 0.05 && you.alive && you.id !== self.id) {
      const nose = headOf(you)
      const ahead = { x: nose.x + Math.cos(you.heading) * 0.8, y: nose.y + Math.sin(you.heading) * 0.8 }
      const gap = Math.hypot(ahead.x - look.x, ahead.y - look.y)
      if (gap < 6) good += mean * worth * 6 * ((6 - gap) / 6)
    }
    return good
  }

  let best = self.heading
  let score = -Infinity
  /*
   * Eleven headings, and only the ones it could actually be going towards.
   *
   * It weighed up sixteen all the way round, which spends most of its thinking
   * on headings behind it that it cannot turn to in any useful time. A little
   * noise, so five of them in a field do not all pick the same pellet and
   * arrive in a knot.
   */
  const SPREAD = 2.1
  for (let i = 0; i < 11; i++) {
    const angle = self.heading + ((i / 10) * 2 - 1) * SPREAD
    const value = want(angle) - risk(angle) * 14 + rng.next() * 0.4
    if (value > score) { score = value; best = angle }
  }
  return best
}

// --- the step ---------------------------------------------------------------

export function step(run: Run, input: Input, dt: number): Run {
  if (run.status !== 'playing') {
    return run.events.length === 0 ? run : { ...run, events: [] }
  }

  const rng = makeRng(run.seed)
  const next: Run = {
    ...run,
    snakes: run.snakes.map((s) => ({ ...s, body: s.body.map((p) => ({ ...p })), held: { ...s.held } })),
    pellets: run.pellets.map((p) => ({ ...p })),
    drops: run.drops.map((d) => ({ ...d })),
    events: [],
    seed: (run.seed * 1103515245 + 12345) >>> 0,
  }

  next.lived += dt
  if (next.ringFor > 0) {
    next.ringFor = Math.max(0, next.ringFor - dt)
    if (next.ringFor === 0) next.ring = null
  }

  const you = next.snakes[0]

  // --- powers run down -------------------------------------------------------
  for (const s of next.snakes) {
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt)
    for (const key of POWERS) {
      const left = s.held[key]
      if (left === undefined) continue
      const now = left - dt
      if (now <= 0) delete s.held[key]
      else s.held[key] = now
    }
  }

  const frosted = you.held.frost !== undefined

  /*
   * Where everything is, worked out once.
   *
   * Built before anybody moves, which means a rival is steering by the garden
   * as it was at the top of the frame rather than as it is halfway through
   * being rebuilt — and, more to the point, that it is built once instead of
   * once per snake per heading.
   */
  const grid = gridOf(next.snakes)

  // --- steering and walking --------------------------------------------------
  for (const s of next.snakes) {
    if (!s.alive) continue
    const mine = s.id === you.id

    if (mine) {
      const push = Math.hypot(input.x, input.y)
      if (push > 0.2) steer(s, Math.atan2(input.y, input.x), dt)
    } else {
      s.thinkIn -= dt
      if (s.thinkIn <= 0) {
        s.want = brainOf(next, grid, s, rng)
        s.thinkIn = THINK_EVERY
      }
      steer(s, s.want, dt)
    }

    let pace = SPEED
    if (!mine && frosted) pace *= FROST_SCALE
    if (mine) {
      const free = s.held.dash !== undefined
      if (free) pace = DASH_SPEED
      else if (input.dash && s.length > LEAST_LENGTH + 0.3) {
        pace = DASH_SPEED
        s.length = Math.max(LEAST_LENGTH, s.length - DASH_COST * dt)
      }
    }
    advance(s, pace * dt)
  }

  // --- eating ----------------------------------------------------------------
  for (const s of next.snakes) {
    if (!s.alive) continue
    const head = headOf(s)
    const reach = girthOf(s) + 0.12
    const was = s.length
    next.pellets = next.pellets.filter((p) => {
      if (Math.hypot(p.x - head.x, p.y - head.y) > reach) return true
      s.length += PELLET_FEEDS * p.worth
      s.score += PELLET_SCORE * p.worth
      if (s.id === you.id) next.events.push('eat')
      return false
    })
    /*
     * And a bigger noise every whole unit.
     *
     * A pellet is a tick and a hundred ticks is wallpaper; something has to
     * mark the difference between eating and getting somewhere, and a round
     * number is the only landmark this game has.
     */
    if (s.id === you.id && Math.floor(s.length) > Math.floor(was)) next.events.push('grow')
  }

  // The lure drags what is near you towards you, which is the one power that
  // changes how the garden behaves rather than how you do.
  if (you.alive && you.held.lure !== undefined) {
    const head = headOf(you)
    for (const p of next.pellets) {
      const gap = Math.hypot(p.x - head.x, p.y - head.y)
      if (gap > LURE_REACH || gap < 1e-6) continue
      const by = (LURE_PULL * dt) / gap
      p.x += (head.x - p.x) * Math.min(1, by)
      p.y += (head.y - p.y) * Math.min(1, by)
    }
  }

  // --- picking a power up ----------------------------------------------------
  for (const s of next.snakes) {
    if (!s.alive) continue
    const head = headOf(s)
    next.drops = next.drops.filter((d) => {
      if (Math.hypot(d.x - head.x, d.y - head.y) > PICKUP) return true
      s.held[d.kind] = POWER_LASTS[d.kind]
      if (s.id === you.id) next.events.push('power')
      return false
    })
  }
  while (next.drops.length < next.charms) {
    const at = scatter(rng)
    next.drops.push({ id: next.nextId++, x: at.x, y: at.y, kind: POWERS[rng.int(0, POWERS.length - 1)], bob: rng.next() })
  }
  while (next.pellets.filter((p) => !p.big).length < next.food) {
    const at = scatter(rng)
    next.pellets.push({ id: next.nextId++, x: at.x, y: at.y, worth: 1, big: false })
  }

  // --- rings -----------------------------------------------------------------
  /*
   * Checked before anybody is killed for touching a body, and that order is
   * the rule: a head on your own body closes a ring, a head on somebody else's
   * kills you. Resolved the other way round, every encircle would be a suicide.
   */
  for (const s of next.snakes) {
    if (!s.alive) continue
    const found = ringOf(s)
    if (!found) continue
    const lost = cutTo(s, found.at)
    s.flash = 0.35
    if (s.id === you.id) {
      next.ring = found.ring
      next.ringFor = 0.8
      next.events.push('ring')
    }
    // Anything whose head is inside the ring is caught. A ring round nothing
    // is just a length of snake thrown away, which is the cost of trying.
    let got = 0
    for (const other of next.snakes) {
      if (!other.alive || other.id === s.id) continue
      if (!inside(found.ring, headOf(other))) continue
      other.alive = false
      spill(next, other, rng)
      got += 1
      s.score += Math.round(other.length * 40)
    }
    if (got > 0) {
      if (s.id === you.id) {
        next.caught += got
        next.events.push('trap')
      }
    } else if (s.id === you.id && lost > 0.3) {
      next.events.push('close')
    }
  }

  // --- running into somebody, or out of the garden ---------------------------
  const ghosting = (s: Snake) => s.held.ghost !== undefined
  const dead: Snake[] = []
  for (const s of next.snakes) {
    if (!s.alive) continue
    const head = headOf(s)
    if (!inGarden(head)) { dead.push(s); continue }
    if (ghosting(s)) continue
    /*
     * Against where everything is *now*, not where the grid said it was at the
     * top of the frame — a grid a frame out of date is a snake dying of a body
     * that has already moved on, and the other way round.
     */
    const reach = girthOf(s) * 0.5
    const hit = next.snakes.some((other) => {
      if (!other.alive || other.id === s.id) return false
      const span = reach + girthOf(other) * 0.5
      return bodyOf(other).some(
        (bead) => Math.abs(bead.x - head.x) < span && Math.abs(bead.y - head.y) < span
          && Math.hypot(bead.x - head.x, bead.y - head.y) < span,
      )
    })
    if (hit) dead.push(s)
  }
  for (const s of dead) {
    s.alive = false
    spill(next, s, rng)
    if (s.id === you.id) next.events.push('died')
    else next.events.push('kill')
  }

  restock(next, rng)

  if (!you.alive) next.status = 'lost'

  return next
}

/**
 * Back in, after a life is spent. The garden carries on as it was.
 *
 * Somewhere clear of every *body*, not every head. Measuring to heads only was
 * the first go and it is a much weaker promise than it sounds: a rival's head
 * can be twenty units from its tail, so "nobody's head is near here" is quite
 * happy to put you down in the middle of somebody's middle. A careful pilot
 * was lasting seventeen seconds a life and a good share of those lives ended
 * in the first second of them.
 */
export function respawn(run: Run): Run {
  const rng = makeRng(run.seed)
  const kept = run.snakes.filter((s) => s.who)
  const bodies = kept.filter((s) => s.alive).map(bodyOf)
  for (let tries = 0; tries < 40; tries++) {
    const at = scatter(rng)
    const clear = bodies.every((beads) => beads.every((b) => dist(b, at) > 3))
    if (!clear) continue
    const you = newSnake(run.nextId, null, at, rng.next() * Math.PI * 2)
    you.score = run.snakes[0]?.score ?? 0
    // A moment to get your bearings, drawn as a snake you can see through.
    you.held = { ghost: SETTLING }
    return {
      ...run,
      snakes: [you, ...kept],
      lived: 0,
      status: 'playing',
      nextId: run.nextId + 1,
      ring: null,
      ringFor: 0,
      events: [],
    }
  }
  const you = newSnake(run.nextId, null, { x: 0, y: 0 }, 0)
  you.score = run.snakes[0]?.score ?? 0
  you.held = { ghost: SETTLING }
  return {
    ...run, snakes: [you, ...kept], lived: 0, status: 'playing',
    nextId: run.nextId + 1, events: [],
  }
}
