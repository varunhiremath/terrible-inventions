import { SEQUENCES, type Action } from './sequences'
import { TILE, blocksMovement, climbable, standable, tileAt, type Level } from './level'
import type { Stance } from './combat'

/**
 * The prince.
 *
 * A state machine over the animation tables, not a physics body. Most actions
 * cannot be interrupted, which is the source of everything the game asks of
 * you: having started a running jump you are committed to where it lands, so
 * the decision that matters happened several tiles earlier.
 */

export interface Input {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  /** Careful mode: a single step, and grabbing ledges on the way down. */
  shift: boolean
}

export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, shift: false }

export interface Prince {
  /** Fractional tile position along the floor. */
  col: number
  /** Which floor he is standing on. */
  row: number
  facing: 1 | -1
  action: Action
  frame: number
  /** Floor he began the current fall from, for working out the damage. */
  fellFrom: number
  framesFalling: number
  health: number
  dead: boolean
  /** Tiles that have given way and are no longer there. */
  collapsed: string[]
  /** Loose tile currently wobbling, and how long until it goes. */
  wobbling: { key: string; frames: number } | null
  potionsDrunk: number
  atExit: boolean
  /**
   * What he is doing with the sword, while a guard is in front of him.
   * 'ready' whenever there is no fight on.
   */
  stance?: Stance
  stanceFrame?: number
}

export const MAX_HEALTH = 3
export const FRAMES_PER_FLOOR = 3
/** Falling this far hurts; one more than this is fatal. */
export const SAFE_FALL = 1
export const HURT_FALL = 2

export function newPrince(level: Level): Prince {
  return {
    col: level.start.col,
    row: level.start.row,
    facing: 1,
    action: 'stand',
    frame: 0,
    fellFrom: 0,
    framesFalling: 0,
    health: MAX_HEALTH,
    dead: false,
    collapsed: [],
    wobbling: null,
    potionsDrunk: 0,
    atExit: false,
    stance: 'ready',
    stanceFrame: 0,
  }
}

const cellKey = (col: number, row: number) => `${Math.round(col)},${row}`

/** The tile beneath his feet, taking collapsed floors into account. */
export function underfoot(prince: Prince, level: Level, col = prince.col, row = prince.row): string {
  if (prince.collapsed.includes(cellKey(col, row))) return TILE.SPACE
  return tileAt(level, Math.round(col), row)
}

function hasGround(prince: Prince, level: Level, col = prince.col, row = prince.row): boolean {
  return standable(level, Math.round(col), row) && !prince.collapsed.includes(cellKey(col, row))
}

/** Whether he can move into a column at his own floor. */
function canEnter(prince: Prince, level: Level, col: number, gateOpen: boolean): boolean {
  return !blocksMovement(tileAt(level, Math.round(col), prince.row), gateOpen)
}

function begin(prince: Prince, action: Action): Prince {
  return { ...prince, action, frame: 0 }
}

/**
 * Chooses a new action from the controls.
 *
 * Only ever consulted when the current sequence permits it, which is what makes
 * committed actions committed.
 */
function command(prince: Prince, level: Level, input: Input): Prince {
  const forward = input.right ? 1 : input.left ? -1 : 0
  const running = prince.action === 'run'

  if (prince.action === 'hang') {
    if (input.up) return begin(prince, 'climbUp')
    if (input.down || !input.shift) return { ...begin(prince, 'fall'), fellFrom: prince.row, framesFalling: 0 }
    return prince
  }

  // Facing the wrong way costs a turn before anything else can happen.
  if (forward !== 0 && forward !== prince.facing) return begin(prince, 'turn')

  if (input.up) {
    if (running) return begin(prince, 'runJump')
    if (forward !== 0) return begin(prince, 'standJump')
    // Straight up. A floor above him is a ledge to climb; a wall above him is
    // the ceiling, and the first version of this started a climb into it that
    // played six frames and put him back exactly where he stood — which is
    // what "the jump button does nothing" looked like from the outside.
    const ledge =
      climbable(level, Math.round(prince.col), prince.row - 1) &&
      !prince.collapsed.includes(cellKey(prince.col, prince.row - 1))
    return begin(prince, ledge ? 'climbLedge' : 'hop')
  }

  if (input.down) {
    return begin(prince, 'crouch')
  }

  if (forward !== 0) {
    if (input.shift) return begin(prince, 'step')
    if (running) return prince
    return begin(prince, 'startRun')
  }

  if (running) return begin(prince, 'stopRun')
  if (prince.action === 'crouch') return begin(prince, 'stand')
  return prince
}

export function tick(prince: Prince, level: Level, input: Input, gateOpen = false): Prince {
  if (prince.dead || prince.atExit) return prince

  let next = { ...prince }
  const sequence = SEQUENCES[next.action]

  // A loose tile gives way a moment after it takes weight.
  if (next.wobbling) {
    const frames = next.wobbling.frames - 1
    next.wobbling = frames > 0 ? { ...next.wobbling, frames } : null
    if (!next.wobbling) {
      next.collapsed = [...next.collapsed, prince.wobbling!.key]
    }
  }

  if (sequence.interruptible) next = command(next, level, input)

  const active = SEQUENCES[next.action]
  const frame = active.frames[Math.min(next.frame, active.frames.length - 1)]

  // Horizontal movement, stopped dead by anything solid in the way.
  const wanted = next.col + frame.dx * next.facing
  if (canEnter(next, level, wanted, gateOpen)) next.col = wanted
  // And vertical, which only a climb ever asks for.
  next.row += frame.dy

  next.frame += 1

  if (next.frame >= active.frames.length) {
    next.frame = 0
    if (next.action === 'turn') next.facing = (next.facing * -1) as 1 | -1
    next.action = active.then
  }

  const nowSequence = SEQUENCES[next.action]

  if (next.action === 'fall') {
    next = applyFall(next, level, input)
  } else if (
    !nowSequence.airborne &&
    next.action !== 'hang' &&
    next.action !== 'climbUp' &&
    next.action !== 'climbLedge'
  ) {
    // Nothing underfoot and not mid-jump: he goes down.
    if (!hasGround(next, level)) {
      next = { ...begin(next, 'fall'), fellFrom: next.row, framesFalling: 0 }
    } else {
      next = touchTile(next, level)
    }
  }

  return next
}

function applyFall(prince: Prince, level: Level, input: Input): Prince {
  const next = { ...prince, framesFalling: prince.framesFalling + 1 }

  // Catching the ledge on the way past is the one thing that saves a bad step,
  // and it only works if you were already holding on.
  if (next.framesFalling === 1 && (input.shift || input.up)) {
    const behind = Math.round(next.col - next.facing)
    if (standable(level, behind, next.row) && !next.collapsed.includes(`${behind},${next.row}`)) {
      // Held exactly on the ledge. Hanging half a tile past it means the climb
      // puts him back over the drop and he falls again, forever.
      return { ...begin(next, 'hang'), col: behind, framesFalling: 0 }
    }
  }

  if (next.framesFalling % FRAMES_PER_FLOOR !== 0) return next

  next.row += 1
  if (!hasGround(next, level)) return next

  // Landed. How far he fell decides what it cost.
  const dropped = next.row - next.fellFrom
  next.framesFalling = 0

  if (dropped > HURT_FALL) return { ...begin(next, 'dead'), dead: true, health: 0 }
  if (dropped === HURT_FALL) {
    const health = next.health - 1
    return health <= 0
      ? { ...begin(next, 'dead'), dead: true, health: 0 }
      : { ...touchTile(begin(next, 'hardLand'), level), health }
  }

  return touchTile(begin(next, 'land'), level)
}

/** What the tile he is standing on does to him. */
function touchTile(prince: Prince, level: Level): Prince {
  const tile = underfoot(prince, level)
  const key = cellKey(prince.col, prince.row)

  switch (tile) {
    case TILE.SPIKES:
      return { ...begin(prince, 'dead'), dead: true, health: 0 }

    case TILE.LOOSE:
      return prince.wobbling || prince.collapsed.includes(key)
        ? prince
        : { ...prince, wobbling: { key, frames: 6 } }

    case TILE.POTION_HEAL:
      return { ...prince, health: Math.min(MAX_HEALTH, prince.health + 1), potionsDrunk: prince.potionsDrunk + 1 }

    case TILE.POTION_POISON: {
      const health = prince.health - 1
      return health <= 0
        ? { ...begin(prince, 'dead'), dead: true, health: 0 }
        : { ...prince, health, potionsDrunk: prince.potionsDrunk + 1 }
    }

    case TILE.EXIT:
      return { ...prince, atExit: true }

    default:
      return prince
  }
}
