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
  ARENA, BEAD, DASH_SPEED, FROST_SCALE, GIRTH, HEDGE_BEADS, HEDGE_GIRTH, HEDGE_STEP,
  LEAST_LENGTH, LURE_PULL, LURE_REACH, gardenFor, type Garden,
  NECK, NEW_LENGTH, PREY_COUNT, PICKUP, POWER_LASTS,
  BLOWN, CREATURES, DASH_BACK, DASH_FOR, KINDS, LEAVING, PREY, POWERS, PREY_TURN, RECOVER,
  REMAINS, ROSTER,
  SETTLING, SPEED, SPRINT, STANDOFF, TURN, openingLength,
  BURROW_R, HIDE_AGAIN, HIDE_FOR,
  type Power, type PreyKind, type Rival, type Species,
} from './level'

export const FIXED = 1 / 60

/** How often a rival makes up its mind, in seconds. */
export const THINK_EVERY = 4 / 60

export type SnakeEvent =
  | 'eat' | 'catch' | 'grow' | 'power' | 'ring' | 'trap' | 'died' | 'kill' | 'close'
  | 'cleared' | 'bite' | 'hide' | 'out' | 'bump'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, for the reason written out in
 * the space run: a list in a screen is a list no test can reach, and an event
 * missing from one took the whole app down twice in an afternoon.
 */
export const LOUDEST: readonly SnakeEvent[] = [
  'cleared',
  'died', 'bite', 'trap', 'kill', 'ring', 'power', 'hide', 'out', 'bump', 'close', 'grow', 'catch',
  'eat',
]

export interface Point {
  x: number
  y: number
}

export interface Snake {
  id: number
  who: Rival | null
  /** Which real snake this is: how fast it goes and how hard it bites. */
  kind: Species
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
  /** Seconds of sprint left. Spent by dashing, and it comes back by itself. */
  puff: number
  /**
   * Down a hole: where, and how long is left of it.
   *
   * A snake that is down one does not move and cannot be bitten. It is the
   * only state in the game where the snake is still, which is the whole point
   * of it — hiding you cannot stop for is not hiding.
   */
  down: { x: number; y: number; left: number } | null
}

/**
 * Something alive, and worth eating.
 *
 * `scare` is how long it has left to keep running after it last saw a snake —
 * a rabbit that bolts the moment you look at it and stops the moment you blink
 * is a twitching dot, not an animal.
 */
export interface Prey {
  id: number
  x: number
  y: number
  kind: PreyKind
  /** Where it is going while it is frightened. */
  heading: number
  scare: number
  /** For a frog, which is mid-hop and which is sitting still. */
  hop: number
  /** How long it has been running. A sprint runs out; see `SPRINT`. */
  spent: number
  /** What is left of a dead snake is worth more and does not run. */
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

export type Status = 'playing' | 'lost' | 'won'

/** A line of thorn. It does not move, and touching it is the end of you. */
export type Hedge = Point[]

/** A hole. A head over one cannot be bitten, for a while. */
export interface Burrow {
  x: number
  y: number
  /** Counts down while somebody is down it, then again before it can be used. */
  used: number
}

/** A word across the screen about what just happened, and how long it has left. */
export interface Said {
  words: string
  tint: string
  life: number
}

export interface Run {
  level: number
  garden: Garden
  /**
   * Which snake you are.
   *
   * On the run rather than only on your snake, because you get a new snake
   * every time you die and every time you move gardens, and a black mamba that
   * comes back as a grass snake is not the snake you chose.
   */
  mine: Species
  /** How far along this garden's goal you are, in the goal's own units. */
  got: number
  /** How big this garden is. */
  arena: number
  hedges: Hedge[]
  burrows: Burrow[]
  said: Said | null
  snakes: Snake[]
  prey: Prey[]
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
  /** How many pellets you have had this garden, for the grazing goal. */
  ate: number
  /** The longest you have been this garden, for the growing goal. */
  grew: number
  /** The last creature you caught, for the word that flashes up. */
  caughtKind: PreyKind | null
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
/**
 * Inside the garden, which is not the same size in every garden.
 *
 * It was a constant, and the arena shrinking from twelve to nine across the
 * twelve gardens is most of what makes the later ones hard — the whole
 * difficulty of a snake is how much room there is to turn around in.
 */
export const inGarden = (p: Point, arena = ARENA) => Math.hypot(p.x, p.y) <= arena

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

export function newSnake(
  id: number, who: Rival | null, at: Point, heading: number, kind: Species = 'grass',
  grown = NEW_LENGTH,
): Snake {
  /*
   * A rival of a bigger species starts bigger, which is how a first garden
   * tells you to leave the adder alone before it has to show you. `grown` is
   * the same thing for the player, who starts a late forest as a grown snake
   * because everything else in it has been eating too.
   */
  const len = who ? NEW_LENGTH * who.size : grown
  // One more bead than there are gaps between them, which is the whole of the
  // difference between a snake 2.4 long and one 2.24 long. Laid out at the
  // length it is, not at the starting length — a snake whose body is shorter
  // than it says it is spends its first seconds growing a tail out of nothing.
  const beads = Math.max(2, Math.round(len / BEAD) + 1)
  const body: Point[] = []
  for (let i = 0; i < beads; i++) {
    body.push({ x: at.x - Math.cos(heading) * BEAD * i, y: at.y - Math.sin(heading) * BEAD * i })
  }
  return {
    id, who, kind: who?.kind ?? kind, body, heading,
    length: len,
    alive: true, score: 0, held: {},
    flash: 0, want: heading, thinkIn: 0, down: null, puff: DASH_FOR,
  }
}

/** The head, which is the only part that can do anything. */
export const headOf = (s: Snake): Point => s.body[0]

/**
 * How strong a snake is: how long it is, times how hard its kind bites.
 *
 * The whole of the new game turns on this one number. "You find a weaker
 * snake, attack. You find a stronger snake, run." A long rattlesnake beats a
 * short mamba; a long mamba beats both. Length is most of it, so growing is
 * still the thing you are doing — species only ever tilts it.
 */
export const powerOf = (s: Snake): number => s.length * KINDS[s.kind].bite

/** Who wins if these two meet: 1 the first, -1 the second, 0 a standoff. */
export function fight(a: Snake, b: Snake): number {
  const mine = powerOf(a)
  const theirs = powerOf(b)
  const edge = (mine - theirs) / Math.max(mine, theirs)
  if (Math.abs(edge) < STANDOFF) return 0
  return edge > 0 ? 1 : -1
}

/**
 * Whether a snake's head is down a hole, and so cannot be bitten.
 *
 * A burrow's clock runs from `HIDE_FOR + HIDE_AGAIN` down to nought the moment
 * somebody goes down it: the first stretch is the hiding, the rest is the hole
 * being no use to anybody until it settles. So protection is the *top* of that
 * count, not the bottom — which is what it was, meaning a burrow sheltered you
 * only once it had stopped sheltering you.
 */
export const hiding = (s: Snake): boolean => s.down !== null

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

/** A heading turned towards another, by no more than `most`. */
function turnTo(from: number, want: number, most: number): number {
  let off = want - from
  while (off > Math.PI) off -= Math.PI * 2
  while (off < -Math.PI) off += Math.PI * 2
  return from + Math.max(-most, Math.min(most, off))
}

/** Turn towards a heading, by no more than the snake can manage. */
function steer(s: Snake, want: number, dt: number): void {
  s.heading = turnTo(s.heading, want, TURN * dt)
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

/** Whose the hedge beads are. Nobody's, and no snake can ever be it. */
export const HEDGE_ID = -1

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

/**
 * Everything deadly, in buckets.
 *
 * The hedges go in alongside the bodies and under an id nobody owns, so every
 * piece of code that already knows to steer around a body steers around a
 * hedge for nothing — including the rival brains, which would otherwise drive
 * into the new scenery at full speed and die in the first second.
 */
export function gridOf(snakes: readonly Snake[], hedges: readonly Hedge[] = []): Grid {
  const cells = new Map<number, Bead[]>()
  const beads = new Map<number, Point[]>()
  for (const hedge of hedges) {
    for (const p of hedge) {
      const key = keyOf(p.x, p.y)
      const bead: Bead = { x: p.x, y: p.y, who: HEDGE_ID, at: 0 }
      const bucket = cells.get(key)
      if (bucket) bucket.push(bead)
      else cells.set(key, [bead])
    }
  }
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

/**
 * Somewhere in the forest, with the middle of it the busiest part.
 *
 * This used to spread things evenly over the whole disc, on purpose: picking
 * an angle and a radius without correcting for the area bunches everything in
 * the middle, which looks like a flower rather than a field, so the correction
 * was applied.
 *
 * It is deliberately un-applied now, and then some. An even field over a
 * forest this size means the middle is no busier than the rim, so wherever you
 * stand there is as little going on as anywhere else — and the rim is the
 * worst of both, because half of what is around you lies outside the fence.
 * Weighting it inwards gives the forest a heart: that is where the hunting is,
 * the dark outskirts are where you go to shake somebody off, and choosing
 * between them is a real choice.
 *
 * `HEART` is the exponent on a uniform roll. A half is an even field; one is a
 * density falling off as 1/r; above one is more huddled still.
 */
export const HEART = 1.25

function scatter(rng: Rng, arena = ARENA, heart = HEART): Point {
  const a = rng.next() * Math.PI * 2
  const r = arena * 0.94 * Math.pow(rng.next(), heart)
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
}

/**
 * A line of thorn, laid somewhere that is not the middle.
 *
 * Not the middle because that is where you come back to life, and a hedge
 * across the spawn is a garden you cannot be put into. Straight-ish rather
 * than straight: a hedge with a bend in it is something to hide behind, and a
 * ruler across the garden is only ever something to go round.
 */
function layHedge(rng: Rng, arena: number): Hedge {
  const from = scatter(rng, arena * 0.7)
  let angle = rng.next() * Math.PI * 2
  const out: Hedge = [from]
  for (let i = 1; i < HEDGE_BEADS; i++) {
    angle += (rng.next() - 0.5) * 0.5
    const last = out[out.length - 1]
    out.push({
      x: last.x + Math.cos(angle) * HEDGE_STEP,
      y: last.y + Math.sin(angle) * HEDGE_STEP,
    })
  }
  return out
}

/**
 * A garden to play in.
 *
 * `set` overrides anything the level would have decided — which is what the
 * tests use to ask for an empty garden with nobody in it, and is why `food`
 * lives in there with the rest rather than beside it as a third number nobody
 * can remember the position of.
 */
export function newRun(
  level = 1, seed = 1, set?: Partial<Garden> & { food?: number; mine?: Species },
): Run {
  const garden = { ...gardenFor(level), ...set }
  const mine = set?.mine ?? 'grass'
  const food = set?.food ?? PREY_COUNT
  const rivals = garden.rivals
  const charms = garden.charms
  const arena = garden.arena
  const rng = makeRng(seed)
  const run: Run = {
    level,
    garden,
    mine,
    got: 0,
    arena,
    hedges: [],
    burrows: [],
    said: null,
    snakes: [],
    prey: [],
    drops: [],
    lived: 0,
    status: 'playing',
    ring: null,
    ringFor: 0,
    events: [],
    seed,
    nextId: 1,
    caught: 0,
    ate: 0,
    grew: 0,
    caughtKind: null,
    food,
    charms,
  }
  for (let i = 0; i < garden.hedges; i++) {
    // Never near the middle: that is where somebody comes back to life.
    for (let go = 0; go < 20; go++) {
      const hedge = layHedge(rng, arena)
      /*
       * Clear of the middle, where somebody comes back to life, and inside the
       * wall. A hedge walks nearly three units from where it starts, so one
       * that started comfortably inside a small garden could still finish
       * outside it — which is thorns nobody can see drawn on the far side of
       * the fence.
       */
      const good = hedge.every(
        (p) => Math.hypot(p.x, p.y) > 2.2 && Math.hypot(p.x, p.y) < arena * 0.92,
      )
      if (good) { run.hedges.push(hedge); break }
    }
  }
  run.snakes.push(newSnake(run.nextId++, null, { x: 0, y: 0 }, rng.next() * Math.PI * 2, mine, openingLength(level)))
  for (let i = 0; i < rivals; i++) {
    // Away from the middle, so nobody opens the round inside somebody else.
    const angle = (i / Math.max(1, rivals)) * Math.PI * 2 + rng.next() * 0.4
    const far = arena * (0.45 + rng.next() * 0.4)
    run.snakes.push(newSnake(
      run.nextId++,
      pickRival(garden, i, rng),
      { x: Math.cos(angle) * far, y: Math.sin(angle) * far },
      angle + Math.PI,
    ))
  }
  for (let i = 0; i < garden.burrows; i++) {
    for (let go = 0; go < 20; go++) {
      const at = scatter(rng, arena * 0.85)
      const clear = Math.hypot(at.x, at.y) > 1.5
        && run.hedges.every((h) => h.every((p) => dist(p, at) > 1))
        && run.burrows.every((b) => dist(b, at) > 3)
      if (clear) { run.burrows.push({ x: at.x, y: at.y, used: 0 }); break }
    }
  }
  for (let i = 0; i < food; i++) {
    run.prey.push(newPrey(run, scatter(rng, arena), rng))
  }
  for (let i = 0; i < charms; i++) {
    const at = scatter(rng, arena)
    run.drops.push({ id: run.nextId++, x: at.x, y: at.y, kind: POWERS[i % POWERS.length], bob: rng.next() })
  }
  return run
}

/** Which snake this garden puts in next, from the ones that live in it. */
function pickRival(garden: Garden, i: number, _rng: Rng): Rival {
  const from = garden.roster.length > 0 ? garden.roster : [0]
  const who = ROSTER[from[i % from.length] % ROSTER.length]
  return { ...who, mean: Math.min(1, who.mean * garden.mean) }
}

/** Which creature to put out next, weighted by how common each one is. */
function pickPrey(rng: Rng): PreyKind {
  const roll = rng.next()
  let seen = 0
  for (const kind of PREY) {
    seen += CREATURES[kind].share
    if (roll <= seen) return kind
  }
  return 'ant'
}

function newPrey(run: Run, at: Point, rng: Rng, kind?: PreyKind): Prey {
  return {
    id: run.nextId++,
    x: at.x,
    y: at.y,
    kind: kind ?? pickPrey(rng),
    heading: rng.next() * Math.PI * 2,
    scare: 0,
    hop: rng.next(),
    spent: 0,
    big: false,
  }
}

/** What a snake leaves when it goes: its length back on the ground. */
function spill(run: Run, s: Snake, rng: Rng): void {
  const beads = bodyOf(s)
  const want = Math.max(4, Math.round(s.length * REMAINS))
  for (let i = 0; i < want; i++) {
    const at = beads[Math.floor((i / want) * beads.length)] ?? headOf(s)
    /*
     * What a snake leaves behind does not run away, which is the whole reason
     * to go after one: a dead snake is the only still meal in the forest.
     */
    run.prey.push({
      id: run.nextId++,
      x: at.x + (rng.next() - 0.5) * 0.3,
      y: at.y + (rng.next() - 0.5) * 0.3,
      kind: 'rat',
      heading: 0,
      scare: 0,
      hop: 0,
      spent: 0, big: true,
    })
  }
}

/** Put a snake back in, somewhere nobody is, so the garden stays busy. */
/**
 * Keeping the garden as full as that garden asks for.
 *
 * It topped up to a constant five, which was right when there was one garden
 * and wrong the moment there were twelve: the gentle opening garden asks for
 * two, and after the first death it quietly refilled itself to five and stayed
 * that way. The lawn was the hardest garden in the game by the second life.
 */
function restock(run: Run, rng: Rng): void {
  const living = run.snakes.filter((s) => s.alive && s.who).length
  if (living >= run.garden.rivals) return
  for (let tries = 0; tries < 20; tries++) {
    const at = scatter(rng, run.arena)
    const clear = run.snakes.every((s) => !s.alive || dist(headOf(s), at) > 3)
      && run.hedges.every((hedge) => hedge.every((p) => dist(p, at) > 1))
    if (!clear) continue
    /*
     * From this garden's own roster, not from all of them.
     *
     * It drew from the whole lot, so the opening garden — two grass snakes, on
     * purpose — refilled itself with puff adders and black mambas the moment
     * one died. A careful snake was lasting four seconds.
     */
    const who = pickRival(run.garden, rng.int(0, 99), rng)
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
    const out = Math.hypot(look.x, look.y) - run.arena * 0.96
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
    for (const p of run.prey) {
      const gap = Math.hypot(p.x - look.x, p.y - look.y)
      // Worth what it feeds, so a rival will cross the forest for a rabbit and
      // not bother turning its head for an ant.
      if (gap < 3) good += (CREATURES[p.kind].feeds * (p.big ? 2 : 1) * (3 - gap)) / 3
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
    prey: run.prey.map((p) => ({ ...p })),
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
  const grid = gridOf(next.snakes, next.hedges)

  // --- down a hole ------------------------------------------------------------
  /*
   * Being down one is the only time a snake is still.
   *
   * You go in by crossing a hole that is ready, you stay until it runs out,
   * and after a moment to settle a push on the stick brings you back out —
   * so letting go keeps you down and steering gets you going again, and
   * neither needs explaining to anybody who has tried it once.
   */
  for (const s of next.snakes) {
    if (!s.alive || !s.down) continue
    s.down.left -= dt
    if (s.down.left > 0) continue
    s.down = null
    /*
     * A moment of being seen through on the way out.
     *
     * Four seconds is not long enough for a big snake to have gone far, and
     * popping out underneath the thing you hid from, with no say in it, would
     * make the hole a trap rather than a hiding place.
     */
    s.held = { ...s.held, ghost: Math.max(s.held.ghost ?? 0, LEAVING) }
    if (s.id === you.id) next.events.push('out')
  }

  // --- steering and walking --------------------------------------------------
  for (const s of next.snakes) {
    if (!s.alive) continue
    if (s.down) continue
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

    let pace = SPEED * KINDS[s.kind].speed
    if (!mine && frosted) pace *= FROST_SCALE
    if (mine) {
      // The charm gives a sprint that never runs out; otherwise it is on the
      // puff, which empties while you hold it and fills while you do not.
      const free = s.held.dash !== undefined
      if (free) {
        pace = DASH_SPEED * KINDS[s.kind].speed
        s.puff = DASH_FOR
      } else if (input.dash && s.puff > 0) {
        pace = DASH_SPEED * KINDS[s.kind].speed
        s.puff = Math.max(0, s.puff - dt)
      } else {
        s.puff = Math.min(DASH_FOR, s.puff + DASH_BACK * dt)
      }
    }
    advance(s, pace * dt)
  }

  // --- the creatures, getting on with it --------------------------------------
  /*
   * Everything alive notices a snake and goes the other way, and the more a
   * thing is worth the better it is at it. An ant does not look up. A rabbit is
   * gone before you have finished deciding.
   *
   * The fright has a tail on it — `scare` keeps it running for a moment after
   * it last saw anything — because a creature that bolts the instant you look
   * at it and stops the instant you blink is a twitching dot, not an animal.
   */
  for (const p of next.prey) {
    if (p.big) continue
    const sort = CREATURES[p.kind]
    if (sort.notice > 0) {
      let near: Point | null = null
      let close = sort.notice
      for (const s of next.snakes) {
        if (!s.alive) continue
        const head = headOf(s)
        const gap = Math.hypot(head.x - p.x, head.y - p.y)
        if (gap < close) { close = gap; near = head }
      }
      if (near) {
        // Turned towards, not snapped to. An animal that can face directly
        // away from you every frame can never be cut off.
        const away = Math.atan2(p.y - near.y, p.x - near.x)
        p.heading = turnTo(p.heading, away, PREY_TURN * dt)
        p.scare = 1.1
      }
    }
    if (p.scare <= 0) {
      // Standing still is how it gets its wind back.
      p.spent = Math.max(0, p.spent - RECOVER * dt)
      continue
    }
    p.scare -= dt
    p.spent += dt

    /*
     * A frog hops: it goes in bursts with a pause between them, which is both
     * what a frog does and the reason a frog is catchable at all when it is
     * nearly as quick as a rat.
     */
    p.hop += dt
    const going = sort.hops ? (p.hop % 0.75) < 0.3 : true

    /*
     * At the fence, run along it rather than into it.
     *
     * This used to clamp the animal to the rim and turn it round by half a
     * turn. The next frame the fright pointed it straight away from the snake
     * again — which, at the fence, is straight at the fence — so it clamped
     * and spun again, and again, several times a second: the "acts weird and
     * starts sliding along the wall" in the report. Taking the outward part
     * off its heading leaves the way along the fence, which is what a cornered
     * animal actually does, and which a player can cut off.
     */
    const out = Math.hypot(p.x, p.y)
    if (out > next.arena * 0.88) {
      const nx = p.x / out
      const ny = p.y / out
      const outward = Math.cos(p.heading) * nx + Math.sin(p.heading) * ny
      if (outward > 0) {
        let tx = Math.cos(p.heading) - outward * nx
        let ty = Math.sin(p.heading) - outward * ny
        const along = Math.hypot(tx, ty)
        // Pinned dead against the fence with no way along it: pick a side.
        if (along < 1e-6) { tx = -ny; ty = nx } else { tx /= along; ty /= along }
        p.heading = Math.atan2(ty, tx)
      }
    }

    if (going) {
      // Flat out, until it is blown — and then slower than the snake after it.
      const puffed = Math.min(1, Math.max(0, (p.spent - SPRINT) / SPRINT))
      const pace = sort.flees * (sort.hops ? 2.1 : 1) * (1 - puffed * (1 - BLOWN))
      p.x += Math.cos(p.heading) * pace * dt
      p.y += Math.sin(p.heading) * pace * dt
    }

    /*
     * A hole is somewhere to feel safe, not somewhere to be parked.
     *
     * It used to move the animal onto the burrow and leave it sitting there,
     * so over a round the prey piled up on the holes and stayed on them.
     */
    if (next.burrows.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < BURROW_R)) p.scare = 0

    // And whatever happens, it stays in the forest.
    const now = Math.hypot(p.x, p.y)
    if (now > next.arena * 0.97) {
      p.x = (p.x / now) * next.arena * 0.97
      p.y = (p.y / now) * next.arena * 0.97
    }
  }

  // --- burrows ----------------------------------------------------------------
  for (const b of next.burrows) {
    if (b.used > 0) { b.used = Math.max(0, b.used - dt); continue }
    /*
     * A ready hole takes the first snake whose head crosses it.
     *
     * The head is put on the mouth of the hole so the snake is visibly in it
     * rather than somewhere near it, and the rest of the body is left lying
     * where it was — a tail still out of the hole, which is both what it would
     * look like and a fair warning to anybody that you are down there.
     */
    /*
     * Yours, not theirs.
     *
     * The rivals were allowed down holes too, for consistency — and a rival
     * that went down one stopped dead in the middle of the forest for four
     * seconds, which looks broken rather than clever, and used up a hole the
     * player might have wanted. Nothing in the rivals' heads knows what a hole
     * is for, so letting them fall into one bought nothing and cost both.
     */
    const took = next.snakes.find(
      (s) => s.alive && !s.down && s.id === you.id && dist(headOf(s), b) < BURROW_R,
    )
    if (!took) continue
    b.used = HIDE_FOR + HIDE_AGAIN
    took.down = { x: b.x, y: b.y, left: HIDE_FOR }
    took.body[0] = { x: b.x, y: b.y }
    if (took.id === you.id) {
      next.events.push('hide')
      // Said at the moment it happens, which is the only time anybody reads
      // anything — the same reason the charms in the brick game name
      // themselves as they are caught rather than on a card nobody opens.
      next.said = { words: 'DOWN THE HOLE — SAFE', tint: '#8fd6a0', life: 2.2 }
    }
  }

  // --- eating ----------------------------------------------------------------
  for (const s of next.snakes) {
    if (!s.alive) continue
    const head = headOf(s)
    const reach = girthOf(s) + 0.12
    const was = s.length
    next.prey = next.prey.filter((p) => {
      if (Math.hypot(p.x - head.x, p.y - head.y) > reach + CREATURES[p.kind].size) return true
      const meal = CREATURES[p.kind]
      // What is left of a snake is worth double and does not run, which is why
      // it is worth going after one.
      s.length += meal.feeds * (p.big ? 2 : 1)
      s.score += meal.score * (p.big ? 2 : 1)
      if (s.id === you.id) {
        next.events.push(p.kind === 'rabbit' || p.kind === 'rat' ? 'catch' : 'eat')
        next.ate += 1
        if (!p.big) next.caughtKind = p.kind
      }
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
    for (const p of next.prey) {
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
  while (next.prey.filter((p) => !p.big).length < next.food) {
    next.prey.push(newPrey(next, scatter(rng, next.arena), rng))
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
        next.said = {
          words: got === 1 ? 'RINGED ONE!' : `RINGED ${got}!`,
          tint: '#8ad48a',
          life: 2.2,
        }
        next.events.push('trap')
      }
    } else if (s.id === you.id) {
      /*
       * A ring round nothing.
       *
       * This is the moment the whole game was being misread at: touching your
       * own body does not kill you here, it closes a loop and cuts away the
       * part you looped over — so a careless nick while turning takes a chunk
       * off and gives nothing back, and from the outside that is a snake
       * shrinking for no reason at all. Now it says so.
       */
      next.said = {
        words: `RING ROUND NOTHING  -${lost.toFixed(1)}`,
        tint: '#e0a52f',
        life: 2.2,
      }
      if (lost > 0.3) next.events.push('close')
    }
  }

  // --- running into somebody, or out of the garden ---------------------------
  const ghosting = (s: Snake) => s.held.ghost !== undefined
  const dead: Snake[] = []
  for (const s of next.snakes) {
    if (!s.alive) continue
    const head = headOf(s)
    /*
     * The fence is a dead end, not a death.
     *
     * Running into the edge of the forest used to kill you outright, which is
     * a hard thing to learn from — it is the one wall in the game you cannot
     * see coming, because the camera follows your head — and it made the whole
     * rim a strip nobody dared use. Now you bounce: the head is put back
     * inside and the heading is reflected off the fence.
     */
    if (!inGarden(head, next.arena)) {
      const far = Math.hypot(head.x, head.y) || 1
      const nx = head.x / far
      const ny = head.y / far
      s.body[0] = { x: nx * next.arena * 0.995, y: ny * next.arena * 0.995 }
      const into = Math.cos(s.heading) * nx + Math.sin(s.heading) * ny
      if (into > 0) {
        const bx = Math.cos(s.heading) - 2 * into * nx
        const by = Math.sin(s.heading) - 2 * into * ny
        s.heading = Math.atan2(by, bx)
        s.want = s.heading
        if (s.id === you.id) next.events.push('bump')
      }
      continue
    }
    if (ghosting(s)) continue
    // A hedge is as deadly as a body and never moves, so it is checked the
    // same way and first — it is the cheaper test.
    const thorn = next.hedges.some((hedge) => hedge.some((p) => {
      const span = girthOf(s) * 0.5 + HEDGE_GIRTH * 0.5
      return Math.abs(p.x - head.x) < span && Math.abs(p.y - head.y) < span
        && Math.hypot(p.x - head.x, p.y - head.y) < span
    }))
    if (thorn) { dead.push(s); continue }
    /*
     * Against where everything is *now*, not where the grid said it was at the
     * top of the frame — a grid a frame out of date is a snake dying of a body
     * that has already moved on, and the other way round.
     */
    // Down a hole is safe. It is the only thing that saves a small snake from
    // a big one, since a big one is usually a faster one as well.
    if (hiding(s)) continue

    /*
     * Meeting somebody, which is no longer simply fatal.
     *
     * "Snakes can fight. You find a weaker snake, attack. You find a stronger
     * snake, run." So a head on a body is a bite, and who dies depends on who
     * is stronger: length times how hard the kind bites. Within a margin
     * neither can hurt the other and they slide past, which is what two snakes
     * of a size actually do.
     *
     * The ring is the other way through, and deliberately: it is the only move
     * that beats something stronger than you. Muscle or cunning, pick one.
     */
    const reach = girthOf(s) * 0.5
    for (const other of next.snakes) {
      if (!other.alive || other.id === s.id) continue
      /*
       * Down a hole, or still settling in.
       *
       * The ghost check used to be on the attacker only — a snake that had
       * just come back could not hurt anybody, and anybody could eat it. So
       * the two and a half seconds meant to be a grace were two and a half
       * seconds of being a free meal, which is why a life in the last garden
       * lasted two seconds.
       */
      if (hiding(other) || other.held.ghost !== undefined) continue
      const span = reach + girthOf(other) * 0.5
      const met = bodyOf(other).some(
        (bead) => Math.abs(bead.x - head.x) < span && Math.abs(bead.y - head.y) < span
          && Math.hypot(bead.x - head.x, bead.y - head.y) < span,
      )
      if (!met) continue
      const won = fight(s, other)
      if (won > 0) {
        if (!dead.includes(other)) dead.push(other)
        if (s.id === you.id) {
          /*
           * A bite counts the same as a ring.
           *
           * The garden that asks you to see somebody off used to count only
           * rings, which made it the one goal the forest's own rule — find a
           * smaller snake, bite it — could not satisfy. You could spend a
           * minute winning fights and the counter would sit at nought.
           */
          next.caught += 1
          s.score += Math.round(other.length * 30)
          next.events.push('bite')
          next.said = {
            words: `BIT ${other.who?.name.toUpperCase() ?? 'IT'}`,
            tint: '#8ad48a',
            life: 2,
          }
        }
      } else if (won < 0) {
        if (!dead.includes(s)) dead.push(s)
        if (s.id === you.id) {
          next.said = {
            words: `${other.who?.name.toUpperCase() ?? 'IT'} WAS STRONGER`,
            tint: '#e05a4a',
            life: 2.2,
          }
        }
      }
      // A standoff is nothing happening, which is the point of it.
    }
  }
  for (const s of dead) {
    s.alive = false
    spill(next, s, rng)
    if (s.id === you.id) next.events.push('died')
    else next.events.push('kill')
  }

  restock(next, rng)

  // The word about the last ring, fading.
  if (next.said) {
    const left = next.said.life - dt
    next.said = left > 0 ? { ...next.said, life: left } : null
  }

  /*
   * How far along the garden's goal you are.
   *
   * Growing is measured by the longest you have *been*, not the length you are
   * now — otherwise closing a ring, which is the move the game is named for,
   * would undo the progress you made before it, and the right way to play a
   * growing garden would be to never ring anybody.
   */
  next.grew = Math.max(next.grew, you.length)
  next.got =
    next.garden.goal === 'grow' ? next.grew
    : next.garden.goal === 'catch' ? next.caught
    : next.garden.goal === 'graze' ? next.ate
    : next.lived

  if (!you.alive) next.status = 'lost'
  else if (next.got >= next.garden.want) {
    next.status = 'won'
    next.events.push('cleared')
  }

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
    const at = scatter(rng, run.arena)
    // Clear of every body, and clear of the thorns — being put down on a hedge
    // is the same "appeared and died in the same second" this search exists to
    // prevent, wearing different clothes.
    const clear = bodies.every((beads) => beads.every((b) => dist(b, at) > 3))
      && run.hedges.every((hedge) => hedge.every((p) => dist(p, at) > 1.2))
    if (!clear) continue
    const you = newSnake(run.nextId, null, at, rng.next() * Math.PI * 2, run.mine, openingLength(run.level))
    you.score = run.snakes[0]?.score ?? 0
    // A moment to get your bearings, drawn as a snake you can see through.
    you.held = { ghost: SETTLING }
    /*
     * `lived`, `ate`, `grew` and `caught` all carry over.
     *
     * They are the garden's goal, and a life lost is not a reason to start the
     * goal again: dying on the last pellet of "eat forty" and being sent back
     * to nought is the sort of thing that makes somebody put a game down.
     * Except in a garden asking you to last a minute, where the whole task is
     * staying alive — so that one does go back.
     */
    return {
      ...run,
      snakes: [you, ...kept],
      lived: run.garden.goal === 'last' ? 0 : run.lived,
      status: 'playing',
      nextId: run.nextId + 1,
      ring: null,
      ringFor: 0,
      said: null,
      events: [],
    }
  }
  const you = newSnake(run.nextId, null, { x: 0, y: 0 }, 0, run.mine, openingLength(run.level))
  you.score = run.snakes[0]?.score ?? 0
  you.held = { ghost: SETTLING }
  return {
    ...run, snakes: [you, ...kept],
    lived: run.garden.goal === 'last' ? 0 : run.lived,
    status: 'playing', said: null,
    nextId: run.nextId + 1, events: [],
  }
}

/** On to the next garden, keeping the score and nothing else. */
export function nextGarden(run: Run): Run {
  // Same snake, new forest: the species you picked is yours for the run.
  const on = newRun(run.level + 1, run.seed + 1, { mine: run.mine })
  on.snakes[0].score = run.snakes[0]?.score ?? 0
  return on
}
