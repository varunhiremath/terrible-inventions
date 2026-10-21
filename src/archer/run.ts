/**
 * The meadow, simulated.
 *
 * Pure and fixed-step like every other game here, and with no three.js
 * anywhere in it: this file knows where everything is and the scene knows how
 * to draw it, which is what lets the whole of the shooting be tested without a
 * graphics card.
 *
 * Two things in here are worth more care than they look.
 *
 * The first is the arrow. It is a real projectile — it leaves at the speed the
 * draw gave it, along the line you were looking down, and falls the whole way.
 * That is the game: a balloon twenty-five metres away needs the shot putting
 * *above* it, and how far above is something you learn in your hands rather
 * than work out. Nothing homes, nothing is nudged towards the target; the
 * forgiveness is all in how big a balloon is.
 *
 * The second is how a hit is found. An arrow covers nearly half a metre in a
 * frame at full draw and a balloon is a metre and a quarter across, so asking
 * "is the arrow inside a balloon now" misses perfectly good shots whenever the
 * frame lands either side of one. What is asked instead is whether the *line*
 * the arrow travelled this step passed through one, which is the same question
 * a real arrow answers.
 */
import {
  ARROW_R, ARROW_RANGE, BALLOON_R, DRAW_TIME, ESCAPE_Y, EYE, GRAVITY, LIVES,
  arrowSpeed, gapFor, needFor, newBalloon, ruleFor,
  type Arrow, type Balloon, type Dice, type Rule,
} from './level'

export const FIXED = 1 / 120

export type ArcherEvent =
  | 'draw' | 'loose' | 'pop' | 'wrong' | 'thud' | 'escape' | 'lost' | 'cleared' | 'over'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, like every other game in here:
 * `events.test.ts` reads this list and the event union together, because an
 * event missing from the list is never the loudest thing in any frame and so is
 * silent for ever with nothing to notice.
 */
export const LOUDEST: readonly ArcherEvent[] = [
  'over', 'cleared', 'lost', 'escape', 'pop', 'wrong', 'thud', 'loose', 'draw',
]

export type Status = 'playing' | 'cleared' | 'over'

/** A balloon coming apart, left for a moment so the pop can be seen. */
export interface Burst {
  id: number
  x: number
  y: number
  z: number
  tint: string
  wanted: boolean
  number: number
  life: number
}

export interface Input {
  /** Where you are looking: around, and up and down, in radians. */
  yaw: number
  pitch: number
  /** Whether the string is being pulled. Letting go looses the arrow. */
  pulling: boolean
}

export const NO_INPUT: Input = { yaw: 0, pitch: 0, pulling: false }

export interface Run {
  round: number
  rule: Rule
  status: Status
  score: number
  /** Wanted balloons popped this round, and how many it takes. */
  got: number
  need: number
  /** Wanted balloons that got away, over the whole run. */
  gone: number
  lives: number
  yaw: number
  pitch: number
  /** How far the string is pulled, nought to one. */
  draw: number
  balloons: Balloon[]
  arrows: Arrow[]
  bursts: Burst[]
  /** Seconds until the next balloon comes up. */
  nextIn: number
  clock: number
  events: ArcherEvent[]
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
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return { next, int, pick: (items) => items[int(0, items.length - 1)] }
}

const stir = (seed: number): number => (seed * 1103515245 + 12345) >>> 0

// --- starting ---------------------------------------------------------------

export function newRun(round = 1, lives = LIVES, score = 0, seed = 1, gone = 0): Run {
  const dice = makeDice(seed)
  const rule = ruleFor(round, dice)
  let id = 1

  const run: Run = {
    round,
    rule,
    status: 'playing',
    score,
    got: 0,
    need: needFor(round),
    gone,
    lives,
    yaw: 0,
    pitch: 0.12,
    draw: 0,
    balloons: [],
    arrows: [],
    bursts: [],
    nextIn: 0.4,
    clock: 0,
    events: [],
    seed: stir(seed),
    nextId: 1,
  }

  // A few already in the air, spread right round, so a round opens on
  // something to shoot rather than on an empty sky.
  for (let i = 0; i < 3; i++) {
    run.balloons.push(newBalloon(id++, round, rule, dice, (i / 3) * Math.PI * 2 + dice.next()))
  }
  run.nextId = id
  return run
}

export const nextRound = (run: Run): Run =>
  newRun(run.round + 1, run.lives, run.score, run.seed + 1, run.gone)

/** Carrying on after one got away. */
export const serve = (run: Run): Run => ({
  ...run,
  status: 'playing',
  arrows: [],
  events: [],
})

// --- where you are looking ---------------------------------------------------

/** The way you are facing, as a unit vector. */
export function facing(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const flat = Math.cos(pitch)
  return { x: Math.sin(yaw) * flat, y: Math.sin(pitch), z: -Math.cos(yaw) * flat }
}

/**
 * Where to aim to hit something standing still at this distance.
 *
 * Here rather than in a test because the bot in `aim.test.ts` uses it, and a
 * bot that works out the arc its own way is a bot proving its own arithmetic
 * rather than the game's. It is the schoolbook answer for a flat shot: the
 * angle whose sine doubles into `g·d / v²`.
 */
export function aimFor(distance: number, up: number, speed: number): number | null {
  const inside = (GRAVITY * distance) / (speed * speed)
  if (inside > 1) return null
  const flat = 0.5 * Math.asin(inside)
  // And the lift for a target above you, which is near enough at these ranges.
  return flat + Math.atan2(up, Math.max(0.001, distance))
}

// --- a step -----------------------------------------------------------------

const ALIVE = 2.5

export function step(run: Run, input: Input, dt: number): Run {
  if (run.status !== 'playing') return { ...run, events: [] }

  const next: Run = {
    ...run,
    balloons: run.balloons.map((b) => ({ ...b })),
    arrows: run.arrows.map((a) => ({ ...a })),
    bursts: run.bursts.map((b) => ({ ...b })),
    events: [],
  }
  const dice = makeDice(next.seed)
  next.seed = stir(next.seed)
  next.clock += dt
  next.yaw = input.yaw
  next.pitch = input.pitch

  // --- the bow ---
  const was = next.draw
  if (input.pulling) {
    next.draw = Math.min(1, next.draw + dt / DRAW_TIME)
    if (was === 0 && next.draw > 0) next.events.push('draw')
  } else if (was > 0) {
    // Letting go looses it, however far it got. A twitch of a pull is a weak
    // arrow rather than no arrow: nothing a player does should do nothing.
    const look = facing(next.yaw, next.pitch)
    const speed = arrowSpeed(was)
    next.arrows.push({
      id: next.nextId++,
      x: look.x * 0.4,
      y: EYE + look.y * 0.4,
      z: look.z * 0.4,
      vx: look.x * speed,
      vy: look.y * speed,
      vz: look.z * speed,
      age: 0,
      stuck: false,
    })
    next.draw = 0
    next.events.push('loose')
  }

  // --- the arrows ---
  const spent = new Set<number>()
  const popped = new Set<number>()

  for (const arrow of next.arrows) {
    arrow.age += dt
    if (arrow.stuck) {
      if (arrow.age > ALIVE) spent.add(arrow.id)
      continue
    }

    /*
     * Walked along its path in slices, not teleported to the end of it. At
     * full draw an arrow covers nearly half a metre in a frame; a balloon is a
     * metre and a quarter across, so a step that jumps the whole way can pass
     * clean through one and the shot that deserved to land does not.
     */
    const slice = Math.min(dt, 0.004)
    let togo = dt
    while (togo > 0 && !spent.has(arrow.id)) {
      const move = Math.min(togo, slice)
      togo -= move

      const fromX = arrow.x
      const fromY = arrow.y
      const fromZ = arrow.z
      arrow.vy -= GRAVITY * move
      arrow.x += arrow.vx * move
      arrow.y += arrow.vy * move
      arrow.z += arrow.vz * move

      for (const balloon of next.balloons) {
        if (popped.has(balloon.id)) continue
        if (!crosses(fromX, fromY, fromZ, arrow.x, arrow.y, arrow.z, balloon)) continue

        popped.add(balloon.id)
        spent.add(arrow.id)
        next.bursts.push({
          id: next.nextId++,
          x: balloon.x,
          y: balloon.y,
          z: balloon.z,
          tint: balloon.tint,
          wanted: balloon.wanted,
          number: balloon.number,
          life: 0.9,
        })
        if (balloon.wanted) {
          next.got += 1
          // Further is worth more, which is the only place in this game where
          // the hard shot pays better than the easy one.
          const away = Math.hypot(balloon.x, balloon.z)
          next.score += 50 + Math.round(away) * 5
          next.events.push('pop')
        } else {
          next.score += 5
          next.events.push('wrong')
        }
        break
      }

      if (!spent.has(arrow.id) && arrow.y <= 0.05) {
        arrow.y = 0.05
        arrow.stuck = true
        arrow.age = 0
        next.events.push('thud')
        break
      }
      if (Math.hypot(arrow.x, arrow.z) > ARROW_RANGE) spent.add(arrow.id)
    }
  }

  next.arrows = next.arrows.filter((arrow) => !spent.has(arrow.id))

  // --- the balloons ---
  let lost = false
  for (const balloon of next.balloons) {
    if (popped.has(balloon.id)) continue
    balloon.y += balloon.rise * dt
    balloon.x += balloon.driftX * dt
    balloon.z += balloon.driftZ * dt
    if (balloon.y > ESCAPE_Y) {
      popped.add(balloon.id)
      if (balloon.wanted) {
        next.gone += 1
        next.lives -= 1
        lost = true
        next.events.push('escape')
      }
    }
  }
  next.balloons = next.balloons.filter((balloon) => !popped.has(balloon.id))

  // --- more of them ---
  next.nextIn -= dt
  if (next.nextIn <= 0 && next.balloons.length < 12) {
    next.nextIn += gapFor(next.round)
    next.balloons.push(newBalloon(next.nextId++, next.round, next.rule, dice))
  }

  // --- the bursts fade ---
  for (const burst of next.bursts) burst.life -= dt
  next.bursts = next.bursts.filter((burst) => burst.life > 0)

  // --- how it ends ---
  if (next.got >= next.need) {
    next.status = 'cleared'
    next.score += 200
    next.events.push('cleared')
  } else if (lost && next.lives <= 0) {
    next.status = 'over'
    next.events.push('over')
  } else if (lost) {
    next.events.push('lost')
  }

  return next
}

/**
 * Whether the line from one point to the next passes through a balloon.
 *
 * The nearest approach of the segment to the balloon's middle, which is the
 * whole of it: if that is inside the two radii added together, the arrow went
 * through it, however fast it was going and however long the step was.
 */
export function crosses(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  at: { x: number; y: number; z: number },
): boolean {
  const dx = x2 - x1
  const dy = y2 - y1
  const dz = z2 - z1
  const len = dx * dx + dy * dy + dz * dz
  const reach = BALLOON_R + ARROW_R

  if (len < 1e-9) {
    return Math.hypot(x1 - at.x, y1 - at.y, z1 - at.z) <= reach
  }

  let along = ((at.x - x1) * dx + (at.y - y1) * dy + (at.z - z1) * dz) / len
  along = Math.max(0, Math.min(1, along))
  const nearX = x1 + dx * along
  const nearY = y1 + dy * along
  const nearZ = z1 + dz * along
  return Math.hypot(nearX - at.x, nearY - at.y, nearZ - at.z) <= reach
}

/** How many of the wanted ones are in the air, for the top of the screen. */
export const inTheAir = (run: Run): number =>
  run.balloons.filter((balloon) => balloon.wanted).length
