/**
 * A level of the caves, being played.
 *
 * `physics.ts` moves Dave and knows nothing else. This is everything that
 * changes the world around him: what he has picked up, what is chasing him,
 * what is in the air, and whether the level is over.
 *
 * Pure, like the maze and like the physics: same state in, same state out. A
 * whole level can be played through inside a test, which is the only way to
 * be sure a hand-drawn level can actually be finished.
 */
import {
  TILE,
  VIEW_TILES_X,
  WORTH,
  isPickup,
  normalise,
  onPath,
  pathLength,
  tileAt,
  type Level,
  type MonsterSpec,
} from './level'
import {
  BODY_H,
  BODY_W,
  bodyTiles,
  canLeave,
  fillTank,
  newDave,
  step as stepDave,
  type Dave,
  type Input,
} from './physics'

/** Tiles per second. Fast enough to feel like a shot, slow enough to dodge. */
export const BULLET_SPEED = 16
export const MONSTER_BULLET_SPEED = 9
/** Seconds between a creature's shots. */
export const MONSTER_RELOAD = 2.4
/** How far a creature can see along its own row. */
export const MONSTER_SIGHT = 14
export const MONSTER_WORTH = 300
export const STARTING_LIVES = 3

export interface Bullet {
  x: number
  y: number
  vx: number
  /** Dave's, rather than a creature's. */
  mine: boolean
}

export interface Monster {
  spec: MonsterSpec
  /** How far round the loop, 0 to 1. */
  t: number
  x: number
  y: number
  alive: boolean
  reload: number
}

export type Status = 'playing' | 'died' | 'levelComplete' | 'gameOver'

export interface Game {
  level: Level
  /** Which level this is, counting from one. */
  number: number
  dave: Dave
  monsters: Monster[]
  bullets: Bullet[]
  /** Pickups already eaten, as "x,y". */
  taken: Set<string>
  score: number
  lives: number
  status: Status
  /** What the bottom of the screen is saying, if anything. */
  message: string | null
  /** Counts down after taking the trophy, then the message clears. */
  messageFor: number
}

export const key = (x: number, y: number) => `${x},${y}`

function freshMonsters(level: Level): Monster[] {
  return (level.monsters ?? []).map((spec) => ({
    spec,
    t: spec.phase,
    x: spec.at.x + 0.5,
    y: spec.at.y + 0.5,
    alive: true,
    /*
     * Staggered, so a row of them never fires as one volley — and never less
     * than half a reload, so nothing shoots at the instant a level opens. A
     * player walking in and being shot before he has moved has learned
     * nothing except that the game is unfair.
     */
    reload: MONSTER_RELOAD * (0.5 + 0.5 * spec.phase),
  }))
}

export function newGame(level: Level, number = 1, lives = STARTING_LIVES, score = 0): Game {
  const ready = normalise(level)
  return {
    level: ready,
    number,
    dave: newDave(ready.start),
    monsters: freshMonsters(ready),
    bullets: [],
    taken: new Set(),
    score,
    lives,
    status: 'playing',
    message: null,
    messageFor: 0,
  }
}

/** Back to the top of the same level, a life down. Score and level survive. */
export function respawn(game: Game): Game {
  const next = newGame(game.level, game.number, game.lives, game.score)
  return { ...next, status: game.lives > 0 ? 'playing' : 'gameOver' }
}

/** Whether two boxes overlap, given their centres and sizes. */
function overlaps(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return (
    Math.abs(ax - bx) * 2 < aw + bw &&
    Math.abs(ay - by) * 2 < ah + bh
  )
}

/** Dave's box, centred, for hitting things with. */
function daveBox(dave: Dave) {
  return { x: dave.x, y: dave.y - BODY_H / 2, w: BODY_W, h: BODY_H }
}

export function shoot(game: Game): Game {
  if (!game.dave.hasGun || !game.dave.alive) return game
  // One bullet on screen at a time, exactly as the original. It is the only
  // thing that stops the gun trivialising the game.
  if (game.bullets.some((b) => b.mine)) return game

  const dave = game.dave
  return {
    ...game,
    bullets: [
      ...game.bullets,
      {
        x: dave.x + dave.facing * 0.5,
        y: dave.y - BODY_H / 2,
        vx: dave.facing * BULLET_SPEED,
        mine: true,
      },
    ],
  }
}

function collectAt(game: Game, next: Game): void {
  for (const t of bodyTiles(next.dave)) {
    const id = key(t.x, t.y)
    if (next.taken.has(id)) continue
    const tile = tileAt(next.level, t.x, t.y)

    if (isPickup(tile)) {
      next.taken.add(id)
      next.score += WORTH[tile] ?? 0
      continue
    }
    if (tile === TILE.TROPHY) {
      next.taken.add(id)
      next.score += WORTH[TILE.TROPHY]
      next.dave = { ...next.dave, hasTrophy: true }
      next.message = 'GO THRU THE DOOR'
      next.messageFor = 3
      continue
    }
    if (tile === TILE.JETPACK) {
      next.taken.add(id)
      next.dave = fillTank(next.dave)
      continue
    }
    if (tile === TILE.GUN) {
      next.taken.add(id)
      next.dave = { ...next.dave, hasGun: true }
      continue
    }
  }
  void game
}

/**
 * Advances the level by `dt` seconds.
 *
 * The order matters and is the usual one: move everything, then work out what
 * has hit what. Resolving each thing as it moves lets whoever moved first win
 * the tie, which makes deaths look arbitrary.
 */
export function step(game: Game, input: Input, dt: number): Game {
  if (game.status !== 'playing') return game

  const next: Game = {
    ...game,
    dave: stepDave(game.level, game.dave, input, dt),
    taken: new Set(game.taken),
    monsters: game.monsters.map((m) => ({ ...m })),
    bullets: game.bullets.map((b) => ({ ...b })),
  }

  if (next.messageFor > 0) {
    next.messageFor -= dt
    if (next.messageFor <= 0) {
      next.messageFor = 0
      next.message = null
    }
  }

  collectAt(game, next)

  // --- creatures ----------------------------------------------------------
  const path = next.level.path
  const loop = path ? pathLength(path) : 0
  for (const monster of next.monsters) {
    if (!monster.alive) continue
    if (path && loop > 0) {
      monster.t += (path.speed / loop) * dt
      const at = onPath(path, monster.t)
      monster.x = monster.spec.at.x + 0.5 + at.x
      monster.y = monster.spec.at.y + 0.5 + at.y
    }

    monster.reload -= dt
    if (monster.reload <= 0) {
      monster.reload = MONSTER_RELOAD
      const dx = next.dave.x - monster.x
      const sameRow = Math.abs(next.dave.y - BODY_H / 2 - monster.y) < 1.2
      if (sameRow && Math.abs(dx) < MONSTER_SIGHT) {
        next.bullets.push({
          x: monster.x,
          y: monster.y,
          vx: Math.sign(dx) * MONSTER_BULLET_SPEED,
          mine: false,
        })
      }
    }
  }

  // --- bullets ------------------------------------------------------------
  /*
   * A bullet dies at a wall or once it leaves the screen. Off the screen and
   * not off the level: the original's rule is one bullet *on screen*, and a
   * bullet that keeps travelling out of sight for six more seconds would stop
   * Dave firing again long after the shot visibly missed.
   */
  const reach = VIEW_TILES_X / 2 + 1
  const flying: Bullet[] = []
  for (const bullet of next.bullets) {
    bullet.x += bullet.vx * dt
    const tile = tileAt(next.level, Math.floor(bullet.x), Math.floor(bullet.y))
    if (tile === TILE.BRICK) continue
    if (Math.abs(bullet.x - next.dave.x) > reach) continue
    flying.push(bullet)
  }
  next.bullets = flying

  // --- what hit what ------------------------------------------------------
  const box = daveBox(next.dave)
  for (const bullet of next.bullets) {
    if (bullet.mine) {
      for (const monster of next.monsters) {
        if (!monster.alive) continue
        if (overlaps(bullet.x, bullet.y, 0.3, 0.3, monster.x, monster.y, 0.9, 0.9)) {
          monster.alive = false
          bullet.vx = 0
          bullet.x = -99 // gone next tick
          next.score += MONSTER_WORTH
        }
      }
    } else if (
      next.dave.alive &&
      overlaps(bullet.x, bullet.y, 0.3, 0.3, box.x, box.y, box.w, box.h)
    ) {
      next.dave = { ...next.dave, alive: false }
    }
  }
  next.bullets = next.bullets.filter((b) => b.x > -50)

  for (const monster of next.monsters) {
    if (!monster.alive || !next.dave.alive) continue
    if (overlaps(monster.x, monster.y, 0.85, 0.85, box.x, box.y, box.w, box.h)) {
      next.dave = { ...next.dave, alive: false }
    }
  }

  // --- how the level ends -------------------------------------------------
  if (!next.dave.alive) {
    next.lives -= 1
    next.status = next.lives > 0 ? 'died' : 'gameOver'
    return next
  }
  if (canLeave(next.level, next.dave)) {
    next.score += WORTH[TILE.DOOR]
    next.status = 'levelComplete'
  }

  return next
}
