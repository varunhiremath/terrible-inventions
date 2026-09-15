/**
 * How the prince moves.
 *
 * Not physics. Every action is a fixed table of frames, each carrying an exact
 * displacement, exactly as the original was built — Mechner rotoscoped the
 * animation first and the movement fell out of it, rather than the other way
 * round.
 *
 * This is why the game feels the way it does, and why it is worth reproducing
 * faithfully: a running jump is a commitment, not a nudge. Once it starts you
 * cannot steer it, shorten it or cancel it, so the only way through a gap is to
 * have set off from the right place. That is the entire skill of the game, and
 * it only exists because the tables are fixed.
 */

export type Action =
  | 'stand'
  | 'turn'
  | 'startRun'
  | 'run'
  | 'stopRun'
  | 'step'
  | 'standJump'
  | 'runJump'
  | 'fall'
  | 'land'
  | 'hardLand'
  | 'hang'
  | 'climbUp'
  | 'crouch'
  | 'drinking'
  | 'dead'

export interface Frame {
  /** Tiles moved forward this frame. */
  dx: number
  /** Floors moved this frame. Only jumps and falls are ever non-zero. */
  dy: number
  /** Which drawing to show. */
  pose: string
}

export interface Sequence {
  frames: readonly Frame[]
  /** Where the prince goes when the sequence runs out. */
  then: Action
  /**
   * Whether a new command can cut this short.
   *
   * Almost nothing is. Committed actions are the whole point: a jump you can
   * cancel halfway is a jump with no consequences, and the game stops being
   * about judgement.
   */
  interruptible: boolean
  /** True while the prince is off the ground and should not be held up by floor. */
  airborne?: boolean
}

const f = (dx: number, dy: number, pose: string): Frame => ({ dx, dy, pose })

/** Frames per second of animation, as the original ran. */
export const FPS = 15

/**
 * Distances the player has to learn.
 *
 * A standing jump clears one tile of gap; a running jump clears three. Those
 * two numbers are the vocabulary of every level in the game, so they are
 * written down here and asserted in the tests rather than left to emerge from
 * whatever the frame tables happen to add up to.
 */
export const STAND_JUMP_TILES = 2
export const RUN_JUMP_TILES = 4

export const SEQUENCES: Record<Action, Sequence> = {
  stand: {
    frames: [f(0, 0, 'stand')],
    then: 'stand',
    interruptible: true,
  },

  // Turning costs time, which is why being caught facing the wrong way matters.
  turn: {
    frames: [f(0, 0, 'turn1'), f(0, 0, 'turn2'), f(0, 0, 'turn3'), f(0, 0, 'turn4')],
    then: 'stand',
    interruptible: false,
  },

  // A run has to be wound up; you cannot sprint from standing.
  startRun: {
    frames: [f(0.08, 0, 'run1'), f(0.16, 0, 'run2'), f(0.24, 0, 'run3'), f(0.3, 0, 'run4')],
    then: 'run',
    interruptible: false,
  },

  run: {
    frames: [f(0.34, 0, 'run5'), f(0.34, 0, 'run6'), f(0.34, 0, 'run7'), f(0.34, 0, 'run8')],
    then: 'run',
    interruptible: true,
  },

  // And it has to be wound down, which is how you end up over a ledge.
  stopRun: {
    frames: [f(0.26, 0, 'skid1'), f(0.16, 0, 'skid2'), f(0.08, 0, 'skid3')],
    then: 'stand',
    interruptible: false,
  },

  /** A single careful tile, for edging up to a drop. */
  step: {
    frames: [f(0.2, 0, 'step1'), f(0.25, 0, 'step2'), f(0.3, 0, 'step3'), f(0.25, 0, 'step4')],
    then: 'stand',
    interruptible: false,
  },

  standJump: {
    frames: [
      f(0, 0, 'crouch'),
      f(0.15, 0, 'jump1'),
      f(0.3, 0, 'jump2'),
      f(0.35, 0, 'jump3'),
      f(0.4, 0, 'jump4'),
      f(0.4, 0, 'jump5'),
      f(0.25, 0, 'jump6'),
      f(0.15, 0, 'jump7'),
    ],
    then: 'stand',
    interruptible: false,
    airborne: true,
  },

  runJump: {
    frames: [
      f(0.4, 0, 'rjump1'),
      f(0.5, 0, 'rjump2'),
      f(0.55, 0, 'rjump3'),
      f(0.6, 0, 'rjump4'),
      f(0.6, 0, 'rjump5'),
      f(0.55, 0, 'rjump6'),
      f(0.45, 0, 'rjump7'),
      f(0.35, 0, 'rjump8'),
    ],
    then: 'run',
    interruptible: false,
    airborne: true,
  },

  fall: {
    frames: [f(0.05, 0, 'fall1'), f(0.05, 0, 'fall2')],
    then: 'fall',
    interruptible: false,
    airborne: true,
  },

  land: {
    frames: [f(0, 0, 'land1'), f(0, 0, 'land2')],
    then: 'stand',
    interruptible: false,
  },

  /** A drop of two floors: survivable, but it takes a moment and it hurts. */
  hardLand: {
    frames: [f(0, 0, 'hurt1'), f(0, 0, 'hurt2'), f(0, 0, 'hurt3'), f(0, 0, 'hurt4'), f(0, 0, 'hurt5')],
    then: 'stand',
    interruptible: false,
  },

  hang: {
    frames: [f(0, 0, 'hang')],
    then: 'hang',
    interruptible: true,
  },

  // Pulling up leaves him standing on the ledge he was holding, which means no
  // forward movement at all: any and he ends up back over the drop.
  climbUp: {
    frames: [
      f(0, 0, 'climb1'),
      f(0, 0, 'climb2'),
      f(0, 0, 'climb3'),
      f(0, 0, 'climb4'),
      f(0, 0, 'climb5'),
      f(0, 0, 'climb6'),
    ],
    then: 'stand',
    interruptible: false,
  },

  crouch: {
    frames: [f(0, 0, 'crouch')],
    then: 'crouch',
    interruptible: true,
  },

  drinking: {
    frames: Array.from({ length: 10 }, (_, i) => f(0, 0, `drink${i % 3}`)),
    then: 'stand',
    interruptible: false,
  },

  dead: {
    frames: [f(0, 0, 'dead')],
    then: 'dead',
    interruptible: false,
  },
}

/** Total ground covered by an action, which is what the level design depends on. */
export function reachOf(action: Action): number {
  return SEQUENCES[action].frames.reduce((total, frame) => total + frame.dx, 0)
}
