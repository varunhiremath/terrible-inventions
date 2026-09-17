/**
 * How Dave moves.
 *
 * Everything is in tiles and seconds, and every number here is a feel
 * decision rather than a fact: how high he jumps against how far he travels
 * while doing it is most of what makes this game itself. They are gathered at
 * the top so they can be tuned against the real thing by playing both.
 *
 * Collision is resolved one axis at a time — move horizontally and push out of
 * anything solid, then vertically and do the same. It is the oldest trick in
 * platformers and it is the right one: try to resolve both together and you
 * get a player who catches on the seams between two flat floor tiles.
 *
 * Pure, like the maze: the same state and the same input always give the same
 * result, so a whole level can be played out inside a test.
 */
import { LEVEL_TILES_X, LEVEL_TILES_Y, TILE, isDeadly, isSolid, tileAt, type Level } from './level'

/** Tiles per second on the flat. */
export const RUN_SPEED = 7.2
/** Tiles per second per second. */
export const GRAVITY = 62
/** Upward tiles per second at the moment of the jump. */
export const JUMP_SPEED = 17.5
/** Nothing falls faster than this, so nothing tunnels through a floor. */
export const TERMINAL_SPEED = 26

/**
 * How much of a tile Dave occupies.
 *
 * Narrower than a tile on purpose: a body exactly a tile wide cannot enter a
 * one-tile gap without catching on both sides at once, and the original is
 * full of one-tile gaps.
 */
export const BODY_W = 0.7
export const BODY_H = 0.95

/** Tiles per second while flying, and how long a full tank lasts. */
export const JET_SPEED = 5.4
export const JET_SECONDS = 12.8

export interface Input {
  left: boolean
  right: boolean
  /** Held, not tapped: the jetpack rises for as long as it is held. */
  up: boolean
  down: boolean
  /** True only on the frame the jump begins. */
  jump: boolean
}

export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false }

export interface Dave {
  /** The middle of his feet, in tiles. */
  x: number
  y: number
  vx: number
  vy: number
  onGround: boolean
  facing: 1 | -1
  /** Flying, rather than falling. */
  flying: boolean
  fuel: number
  hasJetpack: boolean
  hasGun: boolean
  hasTrophy: boolean
  alive: boolean
}

export function newDave(at: { x: number; y: number }): Dave {
  return {
    x: at.x + 0.5,
    y: at.y + 1,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    flying: false,
    fuel: 0,
    hasJetpack: false,
    hasGun: false,
    hasTrophy: false,
    alive: true,
  }
}

/** The tiles Dave's body overlaps, given where it is. */
export function bodyTiles(dave: Dave): { x: number; y: number }[] {
  const left = Math.floor(dave.x - BODY_W / 2)
  const right = Math.floor(dave.x + BODY_W / 2)
  const top = Math.floor(dave.y - BODY_H)
  const bottom = Math.floor(dave.y - 0.001)

  const out: { x: number; y: number }[] = []
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) out.push({ x, y })
  }
  return out
}

function hitsSolid(level: Level, dave: Dave): boolean {
  return bodyTiles(dave).some((t) => isSolid(tileAt(level, t.x, t.y)))
}

/** Whether anything under his feet holds him up. */
function standingOn(level: Level, dave: Dave): boolean {
  const probe = { ...dave, y: dave.y + 0.02 }
  return hitsSolid(level, probe)
}

/**
 * Advances Dave by `dt` seconds.
 *
 * Returns a new Dave; the level is never modified here. Picking things up and
 * scoring happen a layer above, because they change the world and this does
 * not.
 */
export function step(level: Level, dave: Dave, input: Input, dt: number): Dave {
  if (!dave.alive) return dave
  const next: Dave = { ...dave }

  // --- sideways -----------------------------------------------------------
  const push = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (push !== 0) next.facing = push > 0 ? 1 : -1
  next.vx = push * RUN_SPEED

  // --- up and down --------------------------------------------------------
  if (next.hasJetpack && next.fuel > 0 && input.up) next.flying = true
  if (next.fuel <= 0) next.flying = false

  if (next.flying) {
    // Flying ignores gravity entirely and burns fuel whether or not it moves,
    // exactly as the original does. That is what makes a tank a decision.
    const lift = (input.up ? -1 : 0) + (input.down ? 1 : 0)
    next.vy = lift * JET_SPEED
    next.fuel = Math.max(0, next.fuel - dt)
    if (next.fuel === 0) next.flying = false
  } else {
    if (input.jump && next.onGround) next.vy = -JUMP_SPEED
    next.vy = Math.min(TERMINAL_SPEED, next.vy + GRAVITY * dt)
  }

  // --- move, one axis at a time -------------------------------------------
  next.x += next.vx * dt
  if (hitsSolid(level, next)) {
    // Back out to the edge of the tile he walked into.
    const into = next.vx > 0 ? 1 : -1
    const edge = into > 0
      ? Math.floor(next.x + BODY_W / 2) - BODY_W / 2
      : Math.floor(next.x - BODY_W / 2) + 1 + BODY_W / 2
    next.x = edge - into * 0.001
    next.vx = 0
  }

  next.y += next.vy * dt
  if (hitsSolid(level, next)) {
    if (next.vy > 0) {
      // Landed: sit exactly on top of the tile below.
      next.y = Math.floor(next.y - 0.001)
    } else {
      // Banged his head: drop to just under the ceiling.
      next.y = Math.floor(next.y - BODY_H) + 1 + BODY_H + 0.001
    }
    next.vy = 0
  }

  next.onGround = !next.flying && standingOn(level, next)
  if (next.onGround) next.vy = 0

  // --- what kills him -----------------------------------------------------
  // Only the tiles do. Everything outside the level counts as solid wall, so
  // there is no falling out of the world to handle: a level is exactly one
  // screen tall and its edges are the edges. What that does mean is that an
  // empty bottom row reads as an invisible floor, which is a level-authoring
  // mistake rather than a physics one — `floorIsHonest` below catches it.
  if (bodyTiles(next).some((t) => isDeadly(tileAt(level, t.x, t.y)))) next.alive = false

  return next
}

/** A full tank, from picking a jetpack up. */
export function fillTank(dave: Dave): Dave {
  return { ...dave, hasJetpack: true, fuel: JET_SECONDS }
}

/** Where the view should sit, in tiles, to keep Dave on screen. */
export function cameraFor(dave: Dave, viewTiles: number, levelTiles: number): number {
  const wanted = dave.x - viewTiles / 2
  return Math.max(0, Math.min(levelTiles - viewTiles, wanted))
}

/** Whether Dave may leave through the door he is standing in. */
export function canLeave(level: Level, dave: Dave): boolean {
  if (!dave.hasTrophy) return false
  return bodyTiles(dave).some((t) => tileAt(level, t.x, t.y) === TILE.DOOR)
}

/**
 * Whether a level's bottom row holds Dave up honestly.
 *
 * Everything past the edge of the map counts as solid, so a gap in the bottom
 * row is an invisible floor: Dave stands in mid-air on nothing, at the one
 * place a player is most likely to be falling. Every column of the bottom row
 * has to be something you can see — brick to stand on, or fire or water to die
 * in. Returns the columns that are neither.
 */
export function floorIsHonest(level: Level): number[] {
  const bottom = LEVEL_TILES_Y - 1
  const bad: number[] = []
  for (let x = 0; x < LEVEL_TILES_X; x++) {
    const tile = tileAt(level, x, bottom)
    if (!isSolid(tile) && !isDeadly(tile)) bad.push(x)
  }
  return bad
}
