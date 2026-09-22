/**
 * How he moves.
 *
 * Unlike the dungeon, this is real physics: a velocity that carries, friction
 * that takes it away, and a jump you can cut short. Almost everything that
 * makes this kind of game feel the way it does is in three behaviours, and
 * none of them is obvious from watching it.
 *
 *   Momentum. You do not stop when you let go, you slide. Turning round while
 *   moving is a skid with its own harder deceleration, so changing direction
 *   at speed costs you distance and has to be planned for.
 *
 *   A jump you hold. Tapping gets you a hop; holding gets you the full height,
 *   because gravity is far weaker while you are still rising and still
 *   holding the button. One button, a continuous range of heights, and it is
 *   the single thing that makes the jumping feel like a skill.
 *
 *   A jump that carries your speed. Run faster and you launch harder, so the
 *   long gaps are only clearable with a run-up. That is what makes a level a
 *   sequence of decisions rather than a series of identical jumps.
 *
 * Everything is in tiles and seconds. A tile is sixteen pixels on the screen,
 * so 9 tiles a second is a little under half the screen's width per second.
 */
import { ROWS, TILE, isSolid, solidAt, tileAt, type Level } from './level'

/** Top speed at a walk, in tiles per second. */
export const WALK_TOP = 5.6
/** Top speed with the run button held. */
export const RUN_TOP = 9.2
/** How fast he picks up speed, walking and running. */
export const WALK_ACCEL = 9
export const RUN_ACCEL = 14
/** How fast he loses it with nothing held. */
export const FRICTION = 10
/** And how fast he loses it turning round, which is harder than stopping. */
export const SKID = 22
/** Steering in the air is weaker than on the ground, but it is not nothing. */
export const AIR_ACCEL = 7

/** Upward speed at the moment of a jump, before the speed bonus. */
export const JUMP_SPEED = 18.5
/** How much of his running speed is added to that. */
export const JUMP_SPEED_BONUS = 0.28
/** Gravity while he is rising and still holding the button. */
export const GRAVITY_HELD = 44
/** And once he lets go, or starts coming down. */
export const GRAVITY = 96
/** Nothing falls faster than this, so nothing tunnels through a floor. */
export const TERMINAL = 26
/** The bounce off a stomped enemy, and the bigger one if the button is held. */
export const STOMP_BOUNCE = 12
export const STOMP_BOUNCE_HELD = 17

/** How wide he is, and how tall, small and grown. */
export const BODY_W = 0.72
export const BODY_H_SMALL = 0.9
export const BODY_H_BIG = 1.7

export interface Input {
  left: boolean
  right: boolean
  /** Held, not pressed: how long it is held decides the height. */
  jump: boolean
  run: boolean
  down: boolean
}

export const NO_INPUT: Input = { left: false, right: false, jump: false, run: false, down: false }

export interface Body {
  /** Tiles from the left of the level, at his middle. */
  x: number
  /** Tiles from the top, at his feet. */
  y: number
  vx: number
  vy: number
  onGround: boolean
  facing: 1 | -1
  big: boolean
  /**
   * Whether this jump is still being held.
   *
   * Cleared the moment the button comes up, and not set again until he lands,
   * so letting go halfway commits him to the lower arc. Without that you could
   * pump the button in mid-air and float.
   */
  holding: boolean
  /** True on the frame he leaves the ground, for the sound. */
  jumped: boolean
}

export function newBody(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, onGround: false, facing: 1, big: false, holding: false, jumped: false }
}

export function bodyHeight(body: Body): number {
  return body.big ? BODY_H_BIG : BODY_H_SMALL
}

/** Whether a box overlaps any solid tile. */
function blocked(level: Level, left: number, right: number, top: number, bottom: number): boolean {
  const c0 = Math.floor(left)
  const c1 = Math.floor(right - 1e-9)
  const r0 = Math.floor(top)
  const r1 = Math.floor(bottom - 1e-9)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solidAt(level, c, r)) return true
    }
  }
  return false
}

export interface Bump {
  col: number
  row: number
}

export interface Stepped {
  body: Body
  /** A block he hit from underneath this frame, if any. */
  bump: Bump | null
  /** True if he went off the bottom of the world. */
  fell: boolean
}

/**
 * One frame.
 *
 * Horizontal and vertical are resolved separately, in that order. Doing both
 * at once and then pushing out of whatever you hit is how a body ends up
 * teleported through a corner; one axis at a time means each collision has an
 * obvious right answer.
 */
export function step(body: Body, input: Input, level: Level, dt: number): Stepped {
  const next: Body = { ...body, jumped: false }
  const h = bodyHeight(next)
  const half = BODY_W / 2

  // --- along the ground ----------------------------------------------------
  const want = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const top = input.run ? RUN_TOP : WALK_TOP
  if (want !== 0) {
    const turning = next.vx !== 0 && Math.sign(next.vx) !== want
    const rate = !next.onGround ? AIR_ACCEL : turning ? SKID : input.run ? RUN_ACCEL : WALK_ACCEL
    next.vx += want * rate * dt
    // The cap only applies with the wind behind him: a shell or a spring can
    // throw him faster than he can run, and should not be clamped away.
    if (Math.abs(next.vx) > top && Math.sign(next.vx) === want) next.vx = want * top
    next.facing = want as 1 | -1
  } else if (next.onGround) {
    const drop = FRICTION * dt
    next.vx = Math.abs(next.vx) <= drop ? 0 : next.vx - Math.sign(next.vx) * drop
  }

  next.x += next.vx * dt
  if (blocked(level, next.x - half, next.x + half, next.y - h, next.y)) {
    // Back out to the face of whatever he hit and stop dead against it. The
    // face is the *floor* of the leading edge going right — `ceil` there is a
    // whole tile too far and shoves him through the wall rather than stopping
    // him at it, which is exactly what it did.
    next.x =
      next.vx > 0
        ? Math.floor(next.x + half) - half - 1e-6
        : Math.floor(next.x - half) + 1 + half + 1e-6
    next.vx = 0
  }

  // --- and up and down -----------------------------------------------------
  if (input.jump && next.onGround) {
    next.vy = -(JUMP_SPEED + Math.abs(next.vx) * JUMP_SPEED_BONUS)
    next.onGround = false
    next.holding = true
    next.jumped = true
  }
  // Letting go ends the assisted part of the rise for good, until he lands.
  if (!input.jump) next.holding = false

  const rising = next.vy < 0
  const gravity = rising && next.holding ? GRAVITY_HELD : GRAVITY
  next.vy = Math.min(TERMINAL, next.vy + gravity * dt)

  let bump: Bump | null = null
  next.y += next.vy * dt
  next.onGround = false
  if (blocked(level, next.x - half, next.x + half, next.y - h, next.y)) {
    if (next.vy > 0) {
      next.y = Math.floor(next.y)
      next.onGround = true
      next.holding = false
    } else {
      // Head first into the underside of something. Which block he hit is the
      // one his middle is under, because that is the one a player would say
      // they hit.
      const row = Math.floor(next.y - h)
      const col = Math.floor(next.x)
      if (isSolid(tileAt(level, col, row))) bump = { col, row }
      next.y = Math.floor(next.y - h) + 1 + h + 1e-6
    }
    next.vy = 0
  }

  return { body: next, bump, fell: next.y > ROWS + 2 }
}

/** Whether he is stood on something, tested a hair below his feet. */
export function standing(level: Level, body: Body): boolean {
  const half = BODY_W / 2
  return blocked(level, body.x - half, body.x + half, body.y + 1e-4, body.y + 0.06)
}

/** The tiles his body covers, for picking up coins and meeting enemies. */
export function overlaps(body: Body, col: number, row: number): boolean {
  const half = BODY_W / 2
  const h = bodyHeight(body)
  return col + 1 > body.x - half && col < body.x + half && row + 1 > body.y - h && row < body.y
}

export const SKY = TILE.SKY
