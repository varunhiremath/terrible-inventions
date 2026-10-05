/**
 * The wall, simulated.
 *
 * Pure and fixed-timestep like everything else here. Two things in this game
 * are worth more care than they look, and both of them are the ball.
 *
 * The first is tunnelling. A ball travelling nine units a second covers a
 * sixth of a unit in a frame, and a brick is a little over half a unit tall —
 * so at the speeds this reaches later a whole brick can fit between where the
 * ball was and where it is next, and the ball sails through a solid wall. The
 * answer is to walk the ball along its path in steps smaller than the
 * smallest thing it can hit, rather than to teleport it and look around
 * afterwards.
 *
 * The second is which way it bounces. Resolving x and y separately, one at a
 * time, is what gets a corner right: hit the side of a brick and only x
 * flips, hit the top and only y does, clip the corner and both do.
 */
import {
  inkFor,
  BALL_FASTEST, BALL_R, BALL_SLOWEST, BALL_SPEED, BLAST, BRICK_H, BRICK_W, COLS, DROP_H,
  DROP_SPEED, DROP_W, LIVES, PADDLE_H, PADDLE_SPEED, PADDLE_W, PADDLE_Y, POWERS, POWER_LASTS,
  POWER_ODDS, ROWS, isNasty, SHOT_EVERY, SHOT_H, SHOT_SPEED, SPEED_PER_LEVEL, STEEPEST, TALL, WALL_TOP,
  WIDE, WORTH, wallFor, type Power,
} from './level'

export const FIXED = 1 / 120

export type BrickEvent =
  | 'tap' | 'crack' | 'break' | 'solid' | 'bat' | 'wall' | 'drop' | 'power'
  | 'shoot' | 'lost' | 'cleared' | 'launch' | 'blast' | 'saved' | 'nasty'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen: a list in a screen is a list no
 * test can reach, and an event missing from one took the whole app down twice
 * in an afternoon.
 */
export const LOUDEST: readonly BrickEvent[] = [
  'cleared', 'lost', 'saved', 'blast', 'nasty', 'power', 'break', 'crack', 'drop', 'launch',
  'bat', 'shoot', 'solid', 'wall', 'tap',
]

export interface Brick {
  col: number
  row: number
  /** Hits left. Zero is gone; a solid one is never counted down. */
  life: number
  solid: boolean
  /** Carries something that falls out when it goes. */
  carries: boolean
  /** Counts down after a hit, so the drawing can flash it. */
  flash: number
}

export interface Ball {
  id: number
  x: number
  y: number
  /** Direction and pace, kept apart so the speed powers do not bend the aim. */
  dx: number
  dy: number
  speed: number
  /** Sitting on the bat, waiting to be let go. */
  stuck: boolean
  /** Where along the bat it is sitting, so it does not jump when the bat moves. */
  along: number
}

export interface Drop {
  id: number
  x: number
  y: number
  kind: Power
}

export interface Shot {
  id: number
  x: number
  y: number
  /** Sideways, because the gun leans the way the bat is sliding. */
  dx: number
}

/**
 * A chip of a broken brick, flying off.
 *
 * Nothing to do with the game — no brick is hit by one and no ball bounces off
 * one. They are here because a brick that simply disappears reads as a brick
 * being switched off, and a brick that comes apart reads as a brick being
 * broken, and that is most of the difference between the two.
 */
export interface Spark {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  life: number
  ink: string
}

export interface Input {
  /** Where the bat is being asked to go, in field units. Null means stay. */
  to: number | null
  /** Nudges, for anybody on a keyboard. */
  left: boolean
  right: boolean
  /** Lets a stuck ball go, and fires the gun. */
  act: boolean
}

export const NO_INPUT: Input = { to: null, left: false, right: false, act: false }

export type Status = 'playing' | 'lost' | 'cleared' | 'over'

export interface Run {
  level: number
  bricks: Brick[]
  balls: Ball[]
  drops: Drop[]
  shots: Shot[]
  sparks: Spark[]
  /** The middle of the bat. */
  bat: number
  /**
   * Which way the bat is leaning, eased, 0 is still.
   *
   * It is what the gun aims along — "aim and shoot" with the one control there
   * is. Eased rather than taken frame by frame, because a raw bat velocity
   * jitters and a gun that jitters cannot be aimed at anything.
   */
  lean: number
  lives: number
  score: number
  status: Status
  /**
   * The last thing caught, and how long it has left to say so.
   *
   * Twelve powers were going into the bat as twelve small coloured glyphs and
   * nothing else — the names and the one-line descriptions existed in the
   * code, were checked by a test, and were shown to nobody. A charm nobody can
   * read is a charm that may as well be a point.
   */
  caught: { kind: Power; life: number } | null
  /** Powers in hand and how long each has left. */
  held: Partial<Record<Power, number>>
  reload: number
  events: BrickEvent[]
  seed: number
  nextId: number
}

// --- the dice ---------------------------------------------------------------

interface Rng {
  next(): number
}

function makeRng(seed: number): Rng {
  let state = (seed * 2654435761) >>> 0 || 1
  return {
    next() {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      state >>>= 0
      return state / 4294967296
    },
  }
}

// --- where things are -------------------------------------------------------

/** The box a brick occupies: left, top, right, bottom. */
export function boxOf(b: Brick): [number, number, number, number] {
  const left = (WIDE - COLS * BRICK_W) / 2 + b.col * BRICK_W
  const top = WALL_TOP + b.row * BRICK_H
  return [left, top, left + BRICK_W, top + BRICK_H]
}

export const batWidth = (run: Run): number =>
  PADDLE_W * (run.held.wide !== undefined ? 1.6 : run.held.narrow !== undefined ? 0.62 : 1)

/** The bat's box. */
export function batBox(run: Run): [number, number, number, number] {
  const half = batWidth(run) / 2
  return [run.bat - half, PADDLE_Y, run.bat + half, PADDLE_Y + PADDLE_H]
}

// --- building a run ---------------------------------------------------------

export function readWall(picture: readonly string[]): Brick[] {
  const bricks: Brick[] = []
  picture.forEach((row, r) => {
    [...row].forEach((cell, c) => {
      if (cell === '.' || c >= COLS || r >= ROWS) return
      if (cell === '#') {
        bricks.push({ col: c, row: r, life: 1, solid: true, carries: false, flash: 0 })
        return
      }
      const lower = cell.toLowerCase()
      const life = lower === 'a' ? 1 : lower === 'b' ? 2 : lower === 'c' ? 3 : 0
      if (life === 0) return
      bricks.push({
        col: c,
        row: r,
        life,
        solid: false,
        carries: cell !== lower,
        flash: 0,
      })
    })
  })
  return bricks
}

/**
 * A ball sitting on the bat, waiting.
 *
 * Not dead centre. A ball launched exactly vertically stays exactly vertical
 * for ever: it bores a tunnel straight up through the wall, hits the ceiling,
 * comes straight back down the tunnel, is caught in the middle of the bat and
 * goes up the same tunnel again. Forty of the forty-four bricks on the first
 * wall were still standing after three simulated minutes of a bat that never
 * missed, and the ball was still going up and down the same hole.
 */
const LAUNCH_LEAN = 0.3

function restingBall(id: number, bat: number, speed: number): Ball {
  return { id, x: bat, y: PADDLE_Y - BALL_R, dx: 0, dy: -1, speed, stuck: true, along: LAUNCH_LEAN }
}

export const speedFor = (level: number): number =>
  Math.min(BALL_FASTEST, BALL_SPEED + (level - 1) * SPEED_PER_LEVEL)

export function newRun(level = 1, lives = LIVES, score = 0, seed = 1): Run {
  return {
    level,
    bricks: readWall(wallFor(level)),
    balls: [restingBall(1, WIDE / 2, speedFor(level))],
    drops: [],
    shots: [],
    sparks: [],
    bat: WIDE / 2,
    lean: 0,
    lives,
    score,
    status: 'playing',
    caught: null,
    held: {},
    reload: 0,
    events: [],
    seed,
    nextId: 2,
  }
}

/** The next wall, keeping what you have earned but not what you were holding. */
export function nextLevel(run: Run): Run {
  const on = run.level + 1
  return { ...newRun(on, run.lives, run.score, run.seed + 1) }
}

/** Back on the bat, after one has gone down the bottom. */
export function serve(run: Run): Run {
  return {
    ...run,
    balls: [restingBall(run.nextId, run.bat, speedFor(run.level))],
    nextId: run.nextId + 1,
    drops: [],
    shots: [],
    sparks: [],
    held: {},
    caught: null,
    status: 'playing',
    events: [],
  }
}

// --- the ball ---------------------------------------------------------------

/**
 * Keep a ball off the horizontal.
 *
 * A ball travelling nearly flat takes an age to cross the screen and cannot be
 * reached by a bat that only moves sideways. The oldest fix in the genre: if
 * it is shallower than this, push it back to the shallowest it is allowed.
 *
 * Measured off the *vertical axis*, not off straight up. The first version
 * asked how far the ball was from travelling upwards, which makes a ball
 * travelling straight down the furthest thing from vertical there is — so a
 * ball dropped straight down the screen was shoved sideways to the steepest
 * angle allowed, and then sent back down again. Every ball in the game left
 * the bat at exactly the same angle whatever it was hit with, and it took a
 * trace to see it, because the number looked plausible the whole way.
 *
 * Which way it is going is kept and only how steep it is changes.
 */
function steer(ball: Ball): void {
  const far = Math.hypot(ball.dx, ball.dy) || 1
  ball.dx /= far
  ball.dy /= far
  const off = Math.atan2(Math.abs(ball.dx), Math.abs(ball.dy))
  if (off <= STEEPEST) return
  const sideways = ball.dx < 0 ? -1 : 1
  const down = ball.dy < 0 ? -1 : 1
  ball.dx = sideways * Math.sin(STEEPEST)
  ball.dy = down * Math.cos(STEEPEST)
}

/** Where a brick sits in the list, for finding one at a point quickly. */
const cellKey = (col: number, row: number) => row * COLS + col

function brickAt(byCell: Map<number, Brick>, x: number, y: number): Brick | null {
  const left = (WIDE - COLS * BRICK_W) / 2
  const col = Math.floor((x - left) / BRICK_W)
  const row = Math.floor((y - WALL_TOP) / BRICK_H)
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null
  return byCell.get(cellKey(col, row)) ?? null
}

/**
 * Hit a brick: take a hit off it, pay for it, and drop what it was carrying.
 *
 * Returns whether the thing should bounce. A solid brick bounces and nothing
 * else happens to it; that is the whole of what makes it a wall.
 */
function strike(run: Run, brick: Brick, rng: Rng, blast = true): boolean {
  brick.flash = 0.09
  if (brick.solid) {
    run.events.push('solid')
    return true
  }
  const was = brick.life
  brick.life -= 1
  if (brick.life > 0) {
    run.events.push('crack')
    scatter(run, brick, rng, 4)
    return true
  }
  run.score += WORTH[Math.min(WORTH.length - 1, was)]
  run.events.push('break')
  scatter(run, brick, rng, 10)
  if (brick.carries) {
    const [left, top, right] = boxOf(brick)
    run.drops.push({
      id: run.nextId++,
      x: (left + right) / 2,
      y: top,
      kind: rollPower(rng),
    })
    run.events.push('drop')
  }
  /*
   * And its neighbours, if a bomb is aboard.
   *
   * One ring out, once: a blast that sets off the bricks it breaks would run
   * through a whole wall from one hit, which is a firework rather than a game.
   * `blast: false` on the ones it takes is what stops it.
   */
  if (blast && run.held.bomb !== undefined) {
    let went = false
    for (const other of run.bricks) {
      if (other === brick || other.solid || other.life <= 0) continue
      if (Math.abs(other.col - brick.col) > BLAST || Math.abs(other.row - brick.row) > BLAST) continue
      strike(run, other, rng, false)
      went = true
    }
    if (went) run.events.push('blast')
  }
  return true
}

/** Chips of a broken brick, thrown out. */
function scatter(run: Run, brick: Brick, rng: Rng, many: number): void {
  const [left, top, right, bottom] = boxOf(brick)
  const ink = inkFor(brick.life + 1, brick.row, brick.solid)
  for (let i = 0; i < many; i++) {
    run.sparks.push({
      id: run.nextId++,
      x: left + rng.next() * (right - left),
      y: top + rng.next() * (bottom - top),
      dx: (rng.next() - 0.5) * 7,
      dy: (rng.next() - 0.5) * 7,
      life: 0.3 + rng.next() * 0.3,
      ink: rng.next() < 0.3 ? ink.shine : ink.face,
    })
  }
}

/** Which power a brick was carrying, weighted by how often each should turn up. */
export function rollPower(rng: Rng): Power {
  const total = POWERS.reduce((sum, p) => sum + POWER_ODDS[p], 0)
  let roll = rng.next() * total
  for (const p of POWERS) {
    roll -= POWER_ODDS[p]
    if (roll <= 0) return p
  }
  return POWERS[0]
}

/**
 * Walk one ball along its path for this step.
 *
 * In pieces small enough that it cannot step over anything: a quarter of a
 * brick's height is a good deal less than the smallest thing in the game, and
 * at the fastest the ball ever travels that is a handful of pieces a frame.
 *
 * Within each piece, x then y, separately. That is what gets a corner right —
 * come in flat against the side of a brick and only the sideways direction
 * turns over; come in from below and only the up-and-down one does.
 */
/**
 * How much the bat's own movement bends the bounce.
 *
 * A real thing in this genre and not only a fix: catching a ball on a bat that
 * is already travelling sends it on, which is most of what "placing" a ball
 * feels like. It also means a bat is never quite still, so the vertical lock
 * above cannot re-form by itself after a dead-centre catch.
 */
const SPIN = 0.5

/**
 * The flattest a bounce off the bat is ever allowed to be, as a fraction of
 * the bat's half-width.
 *
 * Belt and braces against the vertical lock. The spin above breaks it as soon
 * as the bat moves, which a person's bat always is — but a bat held perfectly
 * still under a ball coming perfectly down sends it perfectly back up, and
 * that is a ball bouncing in one column until somebody gets bored. Eight
 * degrees is small enough that nobody will notice it and large enough that the
 * ball leaves the hole it dug.
 */
const LEAST_LEAN = 0.12

function walk(run: Run, ball: Ball, byCell: Map<number, Brick>, dt: number, moved: number, rng: Rng): void {
  const far = ball.speed * dt
  const most = BRICK_H * 0.25
  const pieces = Math.max(1, Math.ceil(far / most))
  const each = far / pieces

  for (let i = 0; i < pieces; i++) {
    // Sideways.
    const wasX = ball.x
    ball.x += ball.dx * each
    if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.dx = Math.abs(ball.dx); run.events.push('wall') }
    else if (ball.x + BALL_R > WIDE) { ball.x = WIDE - BALL_R; ball.dx = -Math.abs(ball.dx); run.events.push('wall') }
    else {
      const edge = ball.x + Math.sign(ball.dx) * BALL_R
      const hit = brickAt(byCell, edge, ball.y)
      if (hit) {
        const bounced = strike(run, hit, rng)
        // A ball ploughing through carries on, unless what it met was solid —
        // nothing goes through those, which is the whole of what they are.
        if (bounced && (run.held.through === undefined || hit.solid)) {
          ball.x = wasX
          ball.dx = -ball.dx
        }
        if (hit.life <= 0 && !hit.solid) byCell.delete(cellKey(hit.col, hit.row))
      }
    }

    // And up or down.
    const wasY = ball.y
    ball.y += ball.dy * each
    if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.dy = Math.abs(ball.dy); run.events.push('wall') }
    else {
      const edge = ball.y + Math.sign(ball.dy) * BALL_R
      const hit = brickAt(byCell, ball.x, edge)
      if (hit) {
        const bounced = strike(run, hit, rng)
        if (bounced && (run.held.through === undefined || hit.solid)) {
          ball.y = wasY
          ball.dy = -ball.dy
        }
        if (hit.life <= 0 && !hit.solid) byCell.delete(cellKey(hit.col, hit.row))
      }
    }

    // The bat. Only on the way down, or a ball that clips the side gets stuck
    // inside it and rattles.
    if (ball.dy > 0) {
      const [bl, bt, br, bb] = batBox(run)
      if (ball.y + BALL_R >= bt && ball.y - BALL_R <= bb && ball.x >= bl - BALL_R && ball.x <= br + BALL_R) {
        /*
         * Where it lands on the bat is the whole of the steering in this game.
         * Middle sends it straight back, the ends send it off at an angle, and
         * everything in between — which is why the bat is the only control
         * there is and still enough.
         */
        const along = (ball.x - run.bat) / (batWidth(run) / 2)
        const spin = Math.max(-0.5, Math.min(0.5, moved * SPIN))
        const aim = along + spin
        const leaned = Math.abs(aim) < LEAST_LEAN ? (aim < 0 ? -LEAST_LEAN : LEAST_LEAN) : aim
        const angle = Math.max(-1, Math.min(1, leaned)) * STEEPEST
        ball.dx = Math.sin(angle)
        ball.dy = -Math.cos(angle)
        ball.y = bt - BALL_R
        run.events.push('bat')
        if (run.held.sticky !== undefined) {
          ball.stuck = true
          ball.along = ball.x - run.bat
        }
      }
    }

    steer(ball)
  }
}

// --- the step ---------------------------------------------------------------

export function step(run: Run, input: Input, dt: number): Run {
  if (run.status !== 'playing') {
    return run.events.length === 0 ? run : { ...run, events: [] }
  }

  const rng = makeRng(run.seed)
  const next: Run = {
    ...run,
    bricks: run.bricks.map((b) => ({ ...b })),
    balls: run.balls.map((b) => ({ ...b })),
    drops: run.drops.map((d) => ({ ...d })),
    shots: run.shots.map((s) => ({ ...s })),
    held: { ...run.held },
    events: [],
    seed: (run.seed * 1103515245 + 12345) >>> 0,
  }

  // --- powers run down -------------------------------------------------------
  for (const kind of POWERS) {
    const left = next.held[kind]
    if (left === undefined) continue
    const now = left - dt
    if (now <= 0) delete next.held[kind]
    else next.held[kind] = now
  }
  for (const brick of next.bricks) if (brick.flash > 0) brick.flash = Math.max(0, brick.flash - dt)

  // --- the bat ---------------------------------------------------------------
  const wasBat = next.bat
  const half = batWidth(next) / 2
  if (input.to !== null) {
    // Towards the finger rather than onto it, so a bat cannot teleport across
    // the screen and scoop a ball it had no business reaching.
    const want = Math.max(half, Math.min(WIDE - half, input.to))
    const by = PADDLE_SPEED * dt
    next.bat += Math.max(-by, Math.min(by, want - next.bat))
  } else if (input.left !== input.right) {
    next.bat += (input.right ? 1 : -1) * PADDLE_SPEED * dt
  }
  next.bat = Math.max(half, Math.min(WIDE - half, next.bat))
  // In bat-widths a second, so the spin does not depend on the frame rate.
  const moved = dt > 0 ? (next.bat - wasBat) / dt / PADDLE_SPEED : 0
  // And the eased version of it, which is what the gun aims along.
  next.lean += (moved - next.lean) * Math.min(1, dt * 9)

  // --- the gun ---------------------------------------------------------------
  next.reload = Math.max(0, next.reload - dt)
  if (input.act && next.held.gun !== undefined && next.reload === 0) {
    /*
     * Aimed, after a fashion.
     *
     * "Gun. Aim and shoot" — with one finger on the bat there is no second
     * control to aim with, so the gun leans the way you are sliding. Slide
     * left and the shots go up and left; hold still and they go straight up.
     * It is the only aiming this game can honestly offer and it turns the gun
     * from a thing you hold down into a thing you point.
     */
    const aim = Math.max(-0.75, Math.min(0.75, next.lean))
    for (const side of [-0.7, 0.7]) {
      next.shots.push({ id: next.nextId++, x: next.bat + side * half, y: PADDLE_Y, dx: aim })
    }
    next.reload = SHOT_EVERY
    next.events.push('shoot')
  }

  const byCell = new Map<number, Brick>()
  for (const b of next.bricks) if (b.life > 0) byCell.set(cellKey(b.col, b.row), b)

  // --- the balls -------------------------------------------------------------
  for (const ball of next.balls) {
    if (ball.stuck) {
      ball.x = Math.max(BALL_R, Math.min(WIDE - BALL_R, next.bat + ball.along))
      ball.y = PADDLE_Y - BALL_R
      if (input.act) {
        ball.stuck = false
        // Off at the angle the bat would have given it from there, so letting
        // go is the same move as hitting it.
        const along = Math.max(-1, Math.min(1, ball.along / half))
        const angle = along * STEEPEST
        ball.dx = Math.sin(angle)
        ball.dy = -Math.cos(angle)
        next.events.push('launch')
      }
      continue
    }
    const pace = speedFor(next.level)
    ball.speed =
      next.held.slow !== undefined ? Math.max(BALL_SLOWEST, pace * 0.62)
      : next.held.fast !== undefined ? Math.min(BALL_FASTEST, pace * 1.35)
      : pace
    walk(next, ball, byCell, dt, moved, rng)
  }
  /*
   * Anything past the bottom is gone — unless there is a net under the bat, in
   * which case the first one to reach it bounces and the net goes.
   */
  next.balls = next.balls.filter((ball) => {
    if (ball.y - BALL_R <= TALL) return true
    if (next.held.floor === undefined) return false
    delete next.held.floor
    ball.y = TALL - BALL_R
    ball.dy = -Math.abs(ball.dy)
    next.events.push('saved')
    return true
  })

  // --- the shots -------------------------------------------------------------
  for (const shot of next.shots) {
    shot.y -= SHOT_SPEED * dt
    shot.x += shot.dx * SHOT_SPEED * dt
  }
  next.shots = next.shots.filter((shot) => {
    if (shot.y + SHOT_H < 0 || shot.x < 0 || shot.x > WIDE) return false
    const hit = brickAt(byCell, shot.x, shot.y)
    if (!hit) return true
    strike(next, hit, rng)
    if (hit.life <= 0 && !hit.solid) byCell.delete(cellKey(hit.col, hit.row))
    return false
  })

  // --- the chips -------------------------------------------------------------
  for (const spark of next.sparks) {
    spark.x += spark.dx * dt
    spark.y += spark.dy * dt
    // They fall, which is most of what makes them read as bits of something.
    spark.dy += 11 * dt
    spark.life -= dt
  }
  next.sparks = next.sparks.filter((s) => s.life > 0 && s.y < TALL)

  // The name of the last charm caught, fading.
  if (next.caught) {
    const left = next.caught.life - dt
    next.caught = left > 0 ? { ...next.caught, life: left } : null
  }

  // --- the drops -------------------------------------------------------------
  for (const drop of next.drops) drop.y += DROP_SPEED * dt
  const [bl, bt, br, bb] = batBox(next)
  next.drops = next.drops.filter((drop) => {
    if (drop.y > TALL) return false
    const caught =
      drop.y + DROP_H >= bt && drop.y <= bb &&
      drop.x + DROP_W / 2 >= bl && drop.x - DROP_W / 2 <= br
    if (!caught) return true
    next.events.push('power')
    // Long enough to read without being long enough to sit over the next one:
    // a bat in a good run can take three charms in four seconds.
    next.caught = { kind: drop.kind, life: 2.4 }
    if (isNasty(drop.kind)) next.events.push('nasty')
    if (drop.kind === 'life') {
      next.lives += 1
    } else if (drop.kind === 'split' || drop.kind === 'swarm') {
      /*
       * Three where there was one, fanned out.
       *
       * Off the first ball that is actually in play rather than off the list,
       * because splitting a ball that is sitting on the bat makes three balls
       * sitting on the bat in the same place, which looks like a drawing fault.
       */
      const from = next.balls.find((b) => !b.stuck) ?? next.balls[0]
      if (from) {
        const turns = drop.kind === 'swarm' ? [-0.9, -0.45, 0.45, 0.9] : [-0.5, 0.5]
        for (const turn of turns) {
          const angle = Math.atan2(from.dx, -from.dy) + turn
          next.balls.push({
            id: next.nextId++,
            x: from.x,
            y: from.y,
            dx: Math.sin(angle),
            dy: -Math.cos(angle),
            speed: from.speed,
            stuck: false,
            along: 0,
          })
        }
      }
    } else if (drop.kind === 'floor') {
      // A net, which is a count rather than a clock: it saves one ball and is
      // gone. Carried as a time so it shows up in the row of charms like the
      // rest; what spends it is the ball reaching the bottom.
      next.held.floor = 1
    } else {
      next.held[drop.kind] = POWER_LASTS[drop.kind]
      // Wide and narrow are the same bat seen from two sides, so one cancels
      // the other rather than both being held at once and arguing.
      if (drop.kind === 'wide') delete next.held.narrow
      if (drop.kind === 'narrow') delete next.held.wide
      if (drop.kind === 'slow') delete next.held.fast
      if (drop.kind === 'fast') delete next.held.slow
    }
    return false
  })

  // --- how it stands ---------------------------------------------------------
  next.bricks = next.bricks.filter((b) => b.solid || b.life > 0)
  const left = next.bricks.some((b) => !b.solid)
  if (!left) {
    next.status = 'cleared'
    next.events.push('cleared')
  } else if (next.balls.length === 0) {
    next.lives -= 1
    next.status = next.lives > 0 ? 'lost' : 'over'
    next.events.push('lost')
  }

  return next
}

/** How much of the wall is still standing, for the bar along the top. */
export function standing(run: Run): number {
  return run.bricks.filter((b) => !b.solid).length
}
