/**
 * A run through a level.
 *
 * Everything that is not the body: what the blocks do when you hit them, what
 * the enemies do, what happens when you meet one, and what counts as winning.
 * Kept apart from `physics.ts` so the feel of the movement can be tuned and
 * tested without a goomba anywhere near it.
 *
 * Pure, and stepped at a fixed rate. Nothing here touches a canvas, a clock or
 * a speaker, which is what lets `solve.ts` play a whole level a few thousand
 * times in a second to prove it can be finished.
 */
import {
  ROWS, TILE, isBumpable, isSolid, tileAt, warpUnder, type Level, type Spawn, type Warp,
} from './level'
import {
  BODY_W, STOMP_BOUNCE, STOMP_BOUNCE_HELD, bodyHeight, newBody, overlaps, step,
  type Body, type Input,
} from './physics'

export const FIXED = 1 / 120
/** Seconds on the clock for a level. */
export const LEVEL_SECONDS = 300
/** How long he flashes after being hit, and cannot be hit again. */
const MERCY = 1.6
/** How long a stomped goomba stays flat before it is cleared away. */
const SQUASH = 0.45
/** How long a bumped block bounces for. */
const BUMP_TIME = 0.18

export type EnemyKind = 'goomba' | 'koopa' | 'shell'

export interface Enemy {
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  onGround: boolean
  /** Counts down while squashed; at zero it is gone. */
  squashed: number
  dead: boolean
}

export interface Item {
  kind: 'mushroom' | 'coin'
  x: number
  y: number
  vx: number
  vy: number
  onGround: boolean
  /** A coin popped out of a block rises, spins and vanishes. */
  life: number
}

export interface Bumped {
  col: number
  row: number
  time: number
}

export type Status = 'playing' | 'dead' | 'won' | 'outOfTime'

export interface Run {
  level: Level
  number: number
  body: Body
  enemies: Enemy[]
  items: Item[]
  /** Blocks currently bouncing, for the drawing. */
  bumped: Bumped[]
  /** Tiles taken out of the level: broken bricks and spent question blocks. */
  changed: Record<string, string>
  coins: number
  score: number
  lives: number
  seconds: number
  /** Counts down after a hit; while it runs he cannot be hurt again. */
  mercy: number
  status: Status
  /** Something worth a noise happened this step. Read and cleared by the screen. */
  events: PipeEvent[]
  /**
   * Going down a pipe, if he is.
   *
   * Nothing else happens while this is set: no gravity, no enemies, no clock.
   * Sinking into a pipe is the one moment in this game where the player is not
   * driving, and a goomba that walked into him while he was halfway down one
   * would be the most unfair death in the app.
   */
  warp: Warping | null
}

/** How far through going down a pipe, and which half of it. */
export interface Warping {
  at: Warp
  /** Seconds into this half. */
  t: number
  part: 'down' | 'up'
}

/** How long each half takes. Slow enough to watch; it is a reward, not a load. */
export const WARP_SECONDS = 0.55

/**
 * Everything that can happen loudly.
 *
 * Named rather than left as loose strings so that adding one and forgetting to
 * give it a sound is a build error rather than a thing nobody notices. The
 * screen holds a noise for each of these, and that map has to be complete.
 */
export const EVENTS = [
  'coin', 'sprout', 'break', 'knock', 'jump', 'die', 'grow', 'stomp', 'kick', 'shrink', 'win',
  'pipe',
] as const
export type PipeEvent = (typeof EVENTS)[number]

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * A step can easily produce three of these at once — land on a goomba, break
 * the block above, take the coin out of it — and firing all three turns a good
 * moment into a mess.
 *
 * It lives here rather than in the screen because which of these matters most
 * is a fact about the game, and because a list inside a screen is a list no
 * test can reach. Forgetting to add an event to one of these threw on load and
 * took the whole app down with it, twice in one afternoon in two different
 * games, with the unit suite green both times. `events.test.ts` reads this now.
 */
export const LOUDEST: readonly PipeEvent[] = [
  'win', 'die', 'shrink', 'grow', 'pipe', 'sprout', 'stomp', 'kick', 'break', 'knock',
  'coin', 'jump',
]

const ENEMY_SPEED = 2.2
const SHELL_SPEED = 11
const ENEMY_W = 0.8
const ENEMY_H = 0.9
const ITEM_SPEED = 3.4
const GRAVITY = 60

const key = (col: number, row: number) => `${col},${row}`

export function newRun(level: Level, number: number, lives = 3, extraSeconds = 0): Run {
  return {
    level,
    number,
    body: newBody(2.5, 0),
    enemies: level.spawns.map((s: Spawn) => ({
      kind: s.kind,
      x: s.col + 0.5,
      y: s.row + 1,
      vx: -ENEMY_SPEED,
      vy: 0,
      onGround: false,
      squashed: 0,
      dead: false,
    })),
    items: [],
    bumped: [],
    changed: {},
    coins: 0,
    score: 0,
    lives,
    seconds: LEVEL_SECONDS + extraSeconds,
    mercy: 0,
    status: 'playing',
    events: [],
    warp: null,
  }
}

/** The level as it stands, with the blocks he has already broken taken out. */
export function tileNow(run: Run, col: number, row: number): string {
  const changed = run.changed[key(col, row)]
  return changed ?? tileAt(run.level, col, row)
}

/** Solid as it stands now, so a broken brick stops holding anything up. */
function solidNow(run: Run, col: number, row: number): boolean {
  return isSolid(tileNow(run, col, row))
}

/** A level with his changes folded in, which is what the physics collides with. */
function worldOf(run: Run): Level {
  if (Object.keys(run.changed).length === 0) return run.level
  const rows = run.level.rows.map((line, r) =>
    [...line].map((t, c) => run.changed[key(c, r)] ?? t).join(''),
  )
  return { ...run.level, rows }
}

/** What a block turns into when it is hit from below. */
function bumpBlock(run: Run, col: number, row: number): void {
  const tile = tileNow(run, col, row)
  if (!isBumpable(tile)) return
  run.bumped.push({ col, row, time: BUMP_TIME })

  if (tile === TILE.QUERY) {
    run.changed[key(col, row)] = TILE.SOLID
    run.items.push({ kind: 'coin', x: col + 0.5, y: row, vx: 0, vy: -14, onGround: false, life: 0.6 })
    run.coins += 1
    run.score += 200
    run.events.push('coin')
    return
  }
  if (tile === TILE.QUERY_UP) {
    run.changed[key(col, row)] = TILE.SOLID
    // A mushroom climbs out of the block and then walks off on its own.
    run.items.push({ kind: 'mushroom', x: col + 0.5, y: row, vx: ITEM_SPEED, vy: -6, onGround: false, life: 0 })
    run.events.push('sprout')
    return
  }
  if (tile === TILE.BRICK) {
    // Only a grown man can break brick. Small, he just knocks it and it holds.
    if (run.body.big) {
      run.changed[key(col, row)] = TILE.SKY
      run.score += 50
      run.events.push('break')
    } else {
      run.events.push('knock')
    }
  }
}

/** Whether a walker has ground under the foot it is about to step onto. */
function edgeAhead(run: Run, e: Enemy): boolean {
  const ahead = Math.floor(e.x + Math.sign(e.vx) * (ENEMY_W / 2 + 0.1))
  return !solidNow(run, ahead, Math.floor(e.y + 0.2))
}

function stepEnemy(run: Run, e: Enemy, dt: number): Enemy {
  const next = { ...e }
  if (next.squashed > 0) {
    next.squashed -= dt
    if (next.squashed <= 0) next.dead = true
    return next
  }

  const half = ENEMY_W / 2
  next.x += next.vx * dt
  const lead = Math.floor(next.x + Math.sign(next.vx) * half)
  const head = Math.floor(next.y - ENEMY_H / 2)
  if (solidNow(run, lead, head) || solidNow(run, lead, Math.floor(next.y - 0.1))) {
    // Into a wall: turn round. A shell keeps its speed; a walker keeps its own.
    next.x = e.x
    next.vx = -next.vx
  } else if (next.kind !== 'shell' && next.onGround && edgeAhead(run, next)) {
    // Walkers turn at a drop rather than marching off it, so a level does not
    // quietly empty itself of enemies while the player is elsewhere.
    next.x = e.x
    next.vx = -next.vx
  }

  next.vy = Math.min(24, next.vy + GRAVITY * dt)
  next.y += next.vy * dt
  next.onGround = false
  const foot = Math.floor(next.y)
  if (next.vy > 0 && (solidNow(run, Math.floor(next.x - half), foot) || solidNow(run, Math.floor(next.x + half - 1e-6), foot))) {
    next.y = foot
    next.vy = 0
    next.onGround = true
  }
  if (next.y > ROWS + 3) next.dead = true
  return next
}

function stepItem(run: Run, it: Item, dt: number): Item {
  const next = { ...it }
  if (next.kind === 'coin') {
    next.vy += GRAVITY * 1.6 * dt
    next.y += next.vy * dt
    next.life -= dt
    return next
  }

  const half = 0.4
  next.x += next.vx * dt
  const lead = Math.floor(next.x + Math.sign(next.vx) * half)
  if (solidNow(run, lead, Math.floor(next.y - 0.1))) {
    next.x = it.x
    next.vx = -next.vx
  }
  next.vy = Math.min(24, next.vy + GRAVITY * dt)
  next.y += next.vy * dt
  next.onGround = false
  const foot = Math.floor(next.y)
  if (next.vy > 0 && solidNow(run, Math.floor(next.x), foot)) {
    next.y = foot
    next.vy = 0
    next.onGround = true
  }
  return next
}

function hits(body: Body, x: number, y: number, w: number, h: number): boolean {
  const half = BODY_W / 2
  const bh = bodyHeight(body)
  return (
    x + w / 2 > body.x - half &&
    x - w / 2 < body.x + half &&
    y > body.y - bh &&
    y - h < body.y
  )
}

/**
 * Where he stands when he comes up the far pipe: on the lip, facing on.
 *
 * `newBody`'s y is his feet, and a lip's row is the top of that tile, so his
 * feet are the row itself.
 */
function onTheLip(warp: Warp): { x: number; y: number } {
  return { x: warp.to + 1, y: warp.toRow }
}

/** Sinking into one pipe and rising out of the other. */
function stepWarp(next: Run, dt: number): Run {
  const warp = next.warp
  if (!warp) return next
  const t = warp.t + dt
  const into = onTheLip(warp.at)

  if (warp.part === 'down') {
    if (t >= WARP_SECONDS) {
      // Out of the far one, starting from below its lip and rising.
      next.warp = { at: warp.at, t: 0, part: 'up' }
      next.body = { ...newBody(into.x, into.y + 2), facing: 1 }
      return next
    }
    next.warp = { ...warp, t }
    next.body = { ...next.body, vx: 0, vy: 0, y: next.body.y + (dt / WARP_SECONDS) * 2 }
    return next
  }

  if (t >= WARP_SECONDS) {
    next.warp = null
    next.body = { ...newBody(into.x, into.y), facing: 1, onGround: true, big: next.body.big }
    return next
  }
  next.warp = { ...warp, t }
  next.body = { ...next.body, vx: 0, vy: 0, y: next.body.y - (dt / WARP_SECONDS) * 2 }
  return next
}

/** One fixed step of everything. */
export function stepRun(run: Run, input: Input, dt = FIXED): Run {
  if (run.status !== 'playing') return run
  const next: Run = { ...run, events: [], enemies: [...run.enemies], items: [...run.items] }

  /*
   * Down a pipe, and nothing else at all.
   *
   * Not even the clock: the two seconds it takes are the game's, not his, and
   * running out of time while stuck inside a pipe would be a joke at the
   * player's expense.
   */
  if (next.warp) return stepWarp(next, dt)

  next.seconds -= dt
  if (next.seconds <= 0) return { ...next, seconds: 0, status: 'outOfTime' }
  if (next.mercy > 0) next.mercy = Math.max(0, next.mercy - dt)

  const world = worldOf(next)
  const moved = step(next.body, input, world, dt)
  next.body = moved.body
  if (moved.body.jumped) next.events.push('jump')
  if (moved.bump) bumpBlock(next, moved.bump.col, moved.bump.row)
  if (moved.fell) {
    return { ...next, lives: next.lives - 1, status: 'dead', events: [...next.events, 'die'] }
  }

  /*
   * Stood on a pipe that goes somewhere, and pressing down.
   *
   * The tile under his feet, not the one he is in: his feet are exactly on the
   * boundary when he is standing, so the row below is the lip.
   */
  if (input.down && next.body.onGround) {
    const under = warpUnder(next.level, Math.floor(next.body.x), Math.floor(next.body.y))
    if (under) {
      next.warp = { at: under, t: 0, part: 'down' }
      next.body = { ...next.body, vx: 0, vy: 0, x: under.from + 1, facing: 1 }
      next.events.push('pipe')
      return next
    }
  }

  // Coins lying in the world.
  const half = BODY_W / 2
  const h = bodyHeight(next.body)
  for (let r = Math.floor(next.body.y - h); r <= Math.floor(next.body.y); r++) {
    for (let c = Math.floor(next.body.x - half); c <= Math.floor(next.body.x + half); c++) {
      if (tileNow(next, c, r) === TILE.COIN && overlaps(next.body, c, r)) {
        next.changed[key(c, r)] = TILE.SKY
        next.coins += 1
        next.score += 200
        next.events.push('coin')
      }
    }
  }

  next.bumped = next.bumped.map((b) => ({ ...b, time: b.time - dt })).filter((b) => b.time > 0)
  next.items = next.items.map((it) => stepItem(next, it, dt)).filter((it) => it.kind !== 'coin' || it.life > 0)
  next.enemies = next.enemies.map((e) => stepEnemy(next, e, dt)).filter((e) => !e.dead)

  // --- meeting things ------------------------------------------------------
  for (const it of next.items) {
    if (it.kind !== 'mushroom') continue
    if (!hits(next.body, it.x, it.y, 0.8, 0.8)) continue
    it.vx = 0
    it.y = -99
    if (!next.body.big) {
      next.body = { ...next.body, big: true }
      next.events.push('grow')
    }
    next.score += 1000
  }
  next.items = next.items.filter((it) => it.y > -50)

  for (const e of next.enemies) {
    if (e.squashed > 0) continue
    if (!hits(next.body, e.x, e.y, ENEMY_W, ENEMY_H)) continue

    const falling = next.body.vy > 0 && next.body.y - h < e.y - ENEMY_H * 0.5
    if (falling) {
      // Landed on it. A goomba is flattened; a koopa becomes a shell you can
      // then kick, and a shell already moving is stopped by a second stomp.
      next.body = {
        ...next.body,
        vy: -(input.jump ? STOMP_BOUNCE_HELD : STOMP_BOUNCE),
        onGround: false,
        holding: input.jump,
      }
      next.score += 100
      next.events.push('stomp')
      if (e.kind === 'koopa') {
        e.kind = 'shell'
        e.vx = 0
      } else if (e.kind === 'shell') {
        e.vx = 0
      } else {
        e.squashed = SQUASH
      }
      continue
    }

    if (e.kind === 'shell' && e.vx === 0) {
      // A still shell is a weapon: walk into it and it goes.
      e.vx = next.body.x < e.x ? SHELL_SPEED : -SHELL_SPEED
      next.events.push('kick')
      continue
    }

    if (next.mercy > 0) continue
    if (next.body.big) {
      next.body = { ...next.body, big: false }
      next.mercy = MERCY
      next.events.push('shrink')
    } else {
      return { ...next, lives: next.lives - 1, status: 'dead', events: [...next.events, 'die'] }
    }
  }

  // A moving shell clears anything it runs into.
  for (const shell of next.enemies) {
    if (shell.kind !== 'shell' || shell.vx === 0) continue
    for (const e of next.enemies) {
      if (e === shell || e.dead || e.squashed > 0) continue
      if (Math.abs(e.x - shell.x) < ENEMY_W && Math.abs(e.y - shell.y) < 1) {
        e.dead = true
        next.score += 200
        next.events.push('stomp')
      }
    }
  }
  next.enemies = next.enemies.filter((e) => !e.dead)

  // --- the end of the level ------------------------------------------------
  if (next.body.x >= next.level.pole) {
    return {
      ...next,
      status: 'won',
      score: next.score + 2000 + Math.floor(next.seconds) * 10,
      events: [...next.events, 'win'],
    }
  }

  return next
}
