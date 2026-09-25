import { SEQUENCES, type Action } from './sequences'
import { TILE, blocksMovement, climbable, isSolid, standable, tileAt, type Level } from './level'
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
  /**
   * Frames left of a grip that cannot be let go of yet.
   *
   * Lowering yourself over an edge is done by holding down, and hanging is let
   * go of by pressing down — so without this the same press that starts the
   * move finishes it, and holding the button drops you the instant you arrive.
   *
   * It only counts down once the button is up. It used to count down on the
   * clock, which meant holding the button — the natural thing to do on a
   * touchscreen, and the only way to lower yourself over an edge in the first
   * place — expired the grip after about a second and then dropped him on the
   * very press that was holding him there. Reported as pressing down a few
   * times on any platform and dying, and it was not occasional: past a second
   * of holding, it was certain.
   */
  gripFrames: number
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
/**
 * How long a grip keeps ignoring the button, after the button comes up.
 *
 * Short, because letting go is now decided by the button being released
 * rather than by this running out. All this does is stop the bounce of a
 * press-release-press being read as two separate intentions.
 */
export const GRIP = 6

export const HURT_FALL = 2

export function newPrince(level: Level): Prince {
  return {
    col: level.start.col,
    row: level.start.row,
    // The level says which way he is looking, and it used to be ignored here
    // and patched afterwards by the screen — so the solver, which builds its
    // princes straight from this, explored every level facing the wrong way.
    facing: level.start.facing,
    action: 'stand',
    frame: 0,
    fellFrom: 0,
    framesFalling: 0,
    gripFrames: 0,
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
/**
 * How far below a ledge there has to be a floor for climbing down to mean
 * anything.
 *
 * Hanging is how you look before you commit, so it only earns its place where
 * there is something to look at. Past this, the drop is not a route to
 * anywhere — it is the bottom of the level with nothing in between.
 */
const REACHABLE_BELOW = 3

/** Is there any floor under this column, close enough to be climbing down to? */
function somethingBelow(level: Level, col: number, row: number): boolean {
  for (let below = row + 1; below <= row + REACHABLE_BELOW; below++) {
    if (below >= level.rows.length) return false
    if (isSolid(tileAt(level, col, below))) return true
  }
  return false
}

function command(prince: Prince, level: Level, input: Input): Prince {
  const forward = input.right ? 1 : input.left ? -1 : 0
  const running = prince.action === 'run'

  if (prince.action === 'hang') {
    if (input.up) return begin(prince, 'climbUp')
    /*
     * Letting go is a thing you ask for, not a thing that happens to you.
     *
     * Two presses: the one that lowered him over the edge, and a separate one
     * that drops him. Holding the first down hangs him there for as long as he
     * likes, which is the entire point of hanging — it is how you see what is
     * under you before committing to it.
     */
    if (prince.gripFrames > 0) return prince
    if (input.down) return { ...begin(prince, 'fall'), fellFrom: prince.row, framesFalling: 0 }
    return prince
  }

  // Facing the wrong way costs a turn before anything else can happen.
  if (forward !== 0 && forward !== prince.facing) return begin(prince, 'turn')

  if (input.up) {
    if (running) return begin(prince, 'runJump')
    if (forward !== 0) return begin(prince, 'standJump')
    /**
     * Straight up.
     *
     * You climb at the edge of a ledge, not anywhere a floor happens to be
     * overhead. Two things have to be true: open air directly above his head,
     * so there is somewhere to rise into, and a floor one level up and one
     * tile in front, which is the ledge he catches. The version before this
     * climbed wherever there was any floor above him at all, so running along
     * under a ceiling and tapping jump put him on the next storey at what
     * looked like random moments.
     */
    const col = Math.round(prince.col)
    const headroom = !isSolid(tileAt(level, col, prince.row - 1))
    const ahead = col + prince.facing
    const ledge =
      climbable(level, ahead, prince.row - 1) &&
      !prince.collapsed.includes(`${ahead},${prince.row - 1}`)
    if (headroom && ledge) return begin(prince, 'climbLedge')
    // Nothing to climb, so he jumps on the spot. Holding a direction as well
    // is what sends him forward, and that is the whole difference between the
    // two: up is up, up and across is across.
    return begin(prince, 'hop')
  }

  if (input.down) {
    /*
     * At the lip of a drop, down lowers him over it instead of crouching.
     *
     * The edge has to be behind him — you back over a ledge, you do not walk
     * off one forwards — which is why the move starts with turning round.
     *
     * And there has to be something down there. Every floor in this dungeon
     * starts him at column two with column one empty, so the tile behind him
     * is a gap before he has moved at all — which meant the first thing a
     * curious player did, press down, was read as "lower yourself over the
     * edge" into a drop with no bottom. Pressing down a few times on any
     * platform killed him, on all thirteen floors, and that is precisely what
     * was reported.
     *
     * You climb down *to* somewhere. If there is nowhere, this is not a climb,
     * it is stepping off a tower, and it is not what a press of down means.
     */
    const col = Math.round(prince.col)
    const behind = col - prince.facing
    const gap = !isSolid(tileAt(level, behind, prince.row))
    if (gap && somethingBelow(level, behind, prince.row)) {
      return { ...begin(prince, 'climbDown'), col, gripFrames: GRIP }
    }
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

  // The grip is let go of by the thumb, not by the clock: it only runs down
  // while the button is up.
  let next = {
    ...prince,
    gripFrames: input.down ? prince.gripFrames : Math.max(0, prince.gripFrames - 1),
  }
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

  // Vertical first, which only a climb ever asks for: the tile he is climbing
  // onto is one floor up, and testing the sideways move at the floor he is
  // leaving would find the wall he is climbing past and refuse it.
  next.row += frame.dy
  // Then horizontal, stopped dead by anything solid in the way.
  const wanted = next.col + frame.dx * next.facing
  if (canEnter(next, level, wanted, gateOpen)) next.col = wanted

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

  /*
   * Off the bottom of the map.
   *
   * Every row past the last one reads as empty space, so nothing is ever
   * underfoot again and the landing below never runs: he dropped a floor every
   * three frames for the rest of the level, which is not a death and not a
   * fall either, just the game quietly ending while still running. Reported by
   * the person playing it, in four words: "if I fall I keep falling".
   *
   * A drop with no bottom to it is fatal, which is also what it looks like.
   */
  if (next.row >= level.rows.length) {
    return { ...begin(next, 'dead'), row: level.rows.length, dead: true, health: 0 }
  }

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
