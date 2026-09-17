import {
  GHOST_RESPAWN,
  PLAYER_START,
  WIDTH,
  HEIGHT,
  TILE,
  edibleCells,
  isWall,
  key,
  tileAt,
  wrapCell,
  type Cell,
} from './maze'
import {
  GHOSTS,
  OPPOSITE,
  STEP,
  chooseDirection,
  phaseAt,
  randomDirection,
  targetForAt,
  type Dir,
  type GhostSpec,
  type Phase,
} from './ghosts'

/**
 * Papa Panic.
 *
 * Grid movement with a continuous position between tiles: decisions happen when
 * an actor arrives at a tile centre, but drawing happens anywhere in between.
 * That split is what makes the original feel smooth while staying perfectly
 * predictable, and it is why the turn buffer below matters so much.
 */

/**
 * How fast anyone moves, in tiles per second.
 *
 * The first cut opened at full arcade pace, which is a lot to ask of someone
 * meeting the controls for the first time — the maze is unfamiliar, the turns
 * come up fast, and losing three lives in twenty seconds teaches nothing.
 *
 * So it opens slow and climbs a little each level. The chasers climb faster
 * than the player does, which is where the difficulty actually comes from: the
 * gap between them narrows from comfortable to nearly nothing. It never closes
 * completely — a chaser is always a shade slower than the player, so being
 * caught is always a cornering mistake rather than simply being outrun.
 */
const OPENING_PLAYER_SPEED = 3.6
const OPENING_GHOST_SPEED = 2.9
const PLAYER_SPEED_PER_LEVEL = 0.18
const GHOST_SPEED_PER_LEVEL = 0.24
const TOP_PLAYER_SPEED = 6.4
/** Kept under the player's, always. */
const CHASER_HANDICAP = 0.2

export function playerSpeed(level: number): number {
  const climb = OPENING_PLAYER_SPEED + PLAYER_SPEED_PER_LEVEL * (Math.max(1, level) - 1)
  return Math.min(TOP_PLAYER_SPEED, climb)
}

export function ghostSpeed(level: number): number {
  const climb = OPENING_GHOST_SPEED + GHOST_SPEED_PER_LEVEL * (Math.max(1, level) - 1)
  return Math.min(playerSpeed(level) - CHASER_HANDICAP, climb)
}

/** A frightened chaser dawdles, so catching one is a decision, not a race. */
export function frightenedSpeed(level: number): number {
  return ghostSpeed(level) * 0.62
}
export const FRIGHTENED_SECONDS = 7
export const EATEN_RESPAWN_SECONDS = 4
export const STARTING_LIVES = 3

/**
 * The pause every arcade game opens with.
 *
 * Nothing moves, so the player can see the board and choose a first direction.
 * Without it a level begins mid-chase, which is unfair rather than exciting.
 */
export const READY_SECONDS = 2.2

export interface Mover {
  cell: Cell
  dir: Dir
  /** 0..1 of the way from `cell` to the next tile. */
  progress: number
}

export interface GhostState extends Mover {
  spec: GhostSpec
  /** Edible, and fleeing. */
  frightened: boolean
  /** Eaten and waiting to come back. */
  eatenFor: number
}

export type Status = 'playing' | 'died' | 'levelComplete' | 'gameOver'

export interface PowerUps {
  /** Extra lives bought in the shop. */
  spareLives: number
  /** Multiplier on how long a power pellet lasts. */
  pelletBoost: number
  /** One-shot freeze that stops every chaser where it stands. */
  freezes: number
}

export interface Game {
  level: number
  lives: number
  score: number
  player: Mover & { queued: Dir | null; queuedFor: number }
  ghosts: GhostState[]
  dots: Set<string>
  power: Set<string>
  /** Seconds since the level started, which drives scatter and chase. */
  elapsed: number
  frightenedFor: number
  freezeFor: number
  /** Counts down at the start of a life. Nobody moves while it runs. */
  readyFor: number
  status: Status
  powerUps: PowerUps
  /** Rises with each ghost eaten in one pellet, and resets when it ends. */
  comboStep: number
}

export function emptyPowerUps(): PowerUps {
  return { spareLives: 0, pelletBoost: 1, freezes: 0 }
}

export function newGame(level = 1, powerUps = emptyPowerUps(), lives = STARTING_LIVES): Game {
  const { dots, power } = edibleCells()

  return {
    level,
    lives: lives + powerUps.spareLives,
    score: 0,
    player: { cell: { ...PLAYER_START }, dir: 'left', progress: 0, queued: null, queuedFor: 0 },
    ghosts: GHOSTS.map((spec) => ({
      spec,
      cell: { ...spec.start },
      dir: 'up',
      progress: 0,
      frightened: false,
      eatenFor: 0,
    })),
    dots: new Set(dots.map(key)),
    power: new Set(power.map(key)),
    elapsed: 0,
    frightenedFor: 0,
    freezeFor: 0,
    readyFor: READY_SECONDS,
    status: 'playing',
    powerUps,
    comboStep: 0,
  }
}

/** Where an actor actually is, between tiles. */
export function positionOf(mover: Mover): { x: number; y: number } {
  const step = STEP[mover.dir]
  return { x: mover.cell.x + step.x * mover.progress, y: mover.cell.y + step.y * mover.progress }
}

/**
 * Where to draw something, part way between two simulation states.
 *
 * The simulation runs in fixed slices and the screen refreshes on its own
 * schedule, so a frame almost never lands on a slice boundary: at sixty frames
 * and a hundred and twenty steps a second, a frame usually covers two steps but
 * jitter makes it sometimes one and sometimes three. Drawing the latest state
 * as-is therefore moves everything by an uneven amount each frame, which reads
 * as a fine stutter — worst running alongside a wall, where there is a straight
 * edge to judge it against.
 *
 * Interpolating between the last two states fixes it: the simulation stays
 * exact and fixed-step, and the drawing is smooth regardless of frame rate.
 *
 * @param t how far through the pending slice the frame falls, 0 to 1
 */
export function positionBetween(before: Mover, after: Mover, t: number): { x: number; y: number } {
  const a = positionOf(before)
  const b = positionOf(after)
  const blend = Math.min(1, Math.max(0, t))

  // Stepping through the tunnel takes x from one edge of the maze to the other.
  // Interpolating across that would fly the whole way back instead, so a wrap
  // simply snaps — for one frame, at the one place nobody is looking closely.
  if (Math.abs(b.x - a.x) > WIDTH / 2 || Math.abs(b.y - a.y) > HEIGHT / 2) return b

  return { x: a.x + (b.x - a.x) * blend, y: a.y + (b.y - a.y) * blend }
}

function canGo(cell: Cell, dir: Dir): boolean {
  return !isWall(wrapCell({ x: cell.x + STEP[dir].x, y: cell.y + STEP[dir].y }))
}

/**
 * Advances the world by `dt` seconds.
 *
 * Pure: the same state and the same dt always produce the same result, which is
 * what lets a whole level be played out inside a test.
 */
export function step(game: Game, dt: number, roll: () => number = Math.random): Game {
  if (game.status !== 'playing') return game

  const next: Game = {
    ...game,
    player: { ...game.player, cell: { ...game.player.cell } },
    ghosts: game.ghosts.map((g) => ({ ...g, cell: { ...g.cell } })),
    dots: new Set(game.dots),
    power: new Set(game.power),
    elapsed: game.elapsed + dt,
    frightenedFor: Math.max(0, game.frightenedFor - dt),
    freezeFor: Math.max(0, game.freezeFor - dt),
    readyFor: Math.max(0, game.readyFor - dt),
  }

  // Everyone waits, including the chasers, and a queued turn is still accepted
  // so the first move can be lined up during the pause.
  if (next.readyFor > 0) return next

  if (game.frightenedFor > 0 && next.frightenedFor === 0) {
    for (const ghost of next.ghosts) ghost.frightened = false
    next.comboStep = 0
  }

  movePlayer(next, dt)
  eat(next)

  const frozen = next.freezeFor > 0
  for (const ghost of next.ghosts) moveGhost(next, ghost, dt, frozen, roll)

  collide(next)

  if (next.dots.size === 0 && next.power.size === 0) next.status = 'levelComplete'
  return next
}

function movePlayer(game: Game, dt: number): void {
  const player = game.player
  let remaining = playerSpeed(game.level) * dt

  // A turn pressed early gets a couple of tiles to find its corner, then
  // gives up. Spent in tiles travelled, so it is the same grace at any speed.
  if (player.queued) {
    player.queuedFor -= remaining
    if (player.queuedFor <= 0) {
      player.queued = null
      player.queuedFor = 0
    }
  }

  while (remaining > 0) {
    // A queued turn is taken the moment it becomes legal. Without this the
    // controls feel unresponsive, because a turn pressed a fraction early is
    // simply dropped — it is the single most important detail in the game.
    if (player.progress === 0 && player.queued && canGo(player.cell, player.queued)) {
      player.dir = player.queued
      player.queued = null
      player.queuedFor = 0
    }

    if (!canGo(player.cell, player.dir)) {
      player.progress = 0
      return
    }

    const advance = Math.min(remaining, 1 - player.progress)
    player.progress += advance
    remaining -= advance

    if (player.progress >= 1) {
      player.cell = wrapCell({
        x: player.cell.x + STEP[player.dir].x,
        y: player.cell.y + STEP[player.dir].y,
      })
      player.progress = 0
    }
  }
}

function eat(game: Game): void {
  const id = key(game.player.cell)

  if (game.dots.delete(id)) game.score += 10

  if (game.power.delete(id)) {
    game.score += 50
    game.frightenedFor = FRIGHTENED_SECONDS * game.powerUps.pelletBoost
    game.comboStep = 0
    for (const ghost of game.ghosts) {
      if (ghost.eatenFor > 0) continue
      ghost.frightened = true
      // Everyone turns on the spot, which is the tell that the tables have
      // turned and is worth more than any sound effect.
      ghost.dir = OPPOSITE[ghost.dir]
    }
  }
}

function moveGhost(game: Game, ghost: GhostState, dt: number, frozen: boolean, roll: () => number): void {
  if (ghost.eatenFor > 0) {
    ghost.eatenFor = Math.max(0, ghost.eatenFor - dt)
    if (ghost.eatenFor === 0) {
      ghost.cell = { ...GHOST_RESPAWN }
      ghost.progress = 0
      ghost.frightened = game.frightenedFor > 0
    }
    return
  }

  if (frozen) return

  const phase: Phase = ghost.frightened ? 'frightened' : phaseAt(game.elapsed)
  let remaining =
    (ghost.frightened ? frightenedSpeed(game.level) : ghostSpeed(game.level)) * dt

  while (remaining > 0) {
    if (ghost.progress === 0) {
      ghost.dir =
        phase === 'frightened'
          ? randomDirection(ghost.cell, ghost.dir, roll())
          : chooseDirection(
              ghost.cell,
              ghost.dir,
              targetForAt(ghost.spec, phase, ghost.cell, game.player.cell, game.player.dir, game.ghosts[0].cell),
            )
    }

    const advance = Math.min(remaining, 1 - ghost.progress)
    ghost.progress += advance
    remaining -= advance

    if (ghost.progress >= 1) {
      ghost.cell = wrapCell({ x: ghost.cell.x + STEP[ghost.dir].x, y: ghost.cell.y + STEP[ghost.dir].y })
      ghost.progress = 0
    }
  }
}

/** Close enough to touch, measured between continuous positions. */
const TOUCHING = 0.6

function collide(game: Game): void {
  const player = positionOf(game.player)

  for (const ghost of game.ghosts) {
    if (ghost.eatenFor > 0) continue

    const at = positionOf(ghost)
    const dx = Math.abs(at.x - player.x)
    const dy = Math.abs(at.y - player.y)
    // The tunnel makes the two ends of a row adjacent, so a plain difference
    // would miss a catch that happens across the seam.
    const near = Math.min(dx, WIDTH - dx) < TOUCHING && dy < TOUCHING
    if (!near) continue

    if (ghost.frightened) {
      ghost.frightened = false
      ghost.eatenFor = EATEN_RESPAWN_SECONDS
      game.comboStep += 1
      game.score += 200 * 2 ** (game.comboStep - 1)
      continue
    }

    game.lives -= 1
    game.status = game.lives > 0 ? 'died' : 'gameOver'
    return
  }
}

/** Puts everyone back after a death, keeping the dots already eaten. */
export function respawn(game: Game): Game {
  return {
    ...game,
    status: 'playing',
    player: { cell: { ...PLAYER_START }, dir: 'left', progress: 0, queued: null, queuedFor: 0 },
    ghosts: GHOSTS.map((spec) => ({
      spec,
      cell: { ...spec.start },
      dir: 'up',
      progress: 0,
      frightened: false,
      eatenFor: 0,
    })),
    elapsed: 0,
    frightenedFor: 0,
    freezeFor: 0,
    readyFor: READY_SECONDS,
    comboStep: 0,
  }
}

/**
 * How far a turn pressed early waits for a corner to arrive, in tiles.
 *
 * It used to wait for ever, which sounds generous and is not: press up in a
 * corridor with no way up, carry on for half the board, and the first opening
 * that appears takes it — a turn you asked for seconds ago and had forgotten
 * about. That reads as the game doing something of its own accord.
 *
 * Measured in tiles rather than seconds on purpose. Two tiles of grace is
 * about how early a thumb presses, and it stays two tiles at every level;
 * a fixed number of seconds would quietly become four tiles of grace by the
 * time the game is running fast.
 */
export const TURN_BUFFER_TILES = 2

export function turn(game: Game, dir: Dir): Game {
  const player = game.player

  /*
   * Turning back the way you came happens on the spot, not at the next tile
   * centre.
   *
   * It is always legal — you have just come from there — and waiting up to a
   * whole tile to honour it is the single most obvious way this game can feel
   * unresponsive. The position does not change: the same point is described
   * from the other end, as the tile ahead with the progress counted backwards.
   */
  if (dir === OPPOSITE[player.dir] && player.progress > 0) {
    const ahead = wrapCell({
      x: player.cell.x + STEP[player.dir].x,
      y: player.cell.y + STEP[player.dir].y,
    })
    return {
      ...game,
      player: {
        ...player,
        cell: ahead,
        dir,
        progress: 1 - player.progress,
        queued: null,
        queuedFor: 0,
      },
    }
  }

  return { ...game, player: { ...player, queued: dir, queuedFor: TURN_BUFFER_TILES } }
}

export function useFreeze(game: Game): Game {
  if (game.powerUps.freezes <= 0) return game
  return {
    ...game,
    freezeFor: 4,
    powerUps: { ...game.powerUps, freezes: game.powerUps.freezes - 1 },
  }
}

export function dotsRemaining(game: Game): number {
  return game.dots.size + game.power.size
}

export function tileUnder(game: Game): string {
  return tileAt(game.player.cell) === TILE.WALL ? TILE.WALL : tileAt(game.player.cell)
}
