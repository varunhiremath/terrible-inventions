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
  | 'hop'
  | 'standJump'
  | 'runJump'
  | 'fall'
  | 'land'
  | 'hardLand'
  | 'hang'
  | 'climbUp'
  | 'climbDown'
  | 'climbLedge'
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

  /**
   * Straight up, and down in the same place.
   *
   * The jump button used to fall through to `standJump` when there was nothing
   * overhead to climb, on the reasoning that a jump button has to jump. It
   * does — but `standJump` carries him two tiles forward, so the one button
   * that was meant to go up was also the fastest way to go sideways, and there
   * was no way to jump on the spot at all. Reported as: the jump button "not
   * only jumps but puts you ahead too, so it's a mix of run and jump".
   *
   * Every frame moves him nowhere. What makes it read as a jump is the arc it
   * is drawn on, not the ground it covers.
   */
  hop: {
    frames: [
      f(0, 0, 'crouch'),
      f(0, 0, 'jump1'),
      f(0, 0, 'jump3'),
      f(0, 0, 'jump5'),
      f(0, 0, 'jump6'),
      f(0, 0, 'jump7'),
    ],
    then: 'stand',
    interruptible: false,
    airborne: true,
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

  /**
   * Backing over an edge to hang from it.
   *
   * The move the original is really built around: walk to the lip, turn your
   * back on the drop, press down, and lower yourself until you are hanging off
   * it. From there you can see what is underneath before you commit to it,
   * which is the whole point — without it the only way to find out what is
   * below a ledge is to jump off and hope, which is exactly how it was being
   * played: "I basically had to jump into the darkness hoping I'll land on
   * something."
   *
   * He goes nowhere at all: the hands end up on the tile the feet were on.
   */
  climbDown: {
    frames: [f(0, 0, 'crouch'), f(0, 0, 'climb5'), f(0, 0, 'climb3'), f(0, 0, 'hang')],
    then: 'hang',
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

  /**
   * Catching the ledge in front and above and pulling up onto it.
   *
   * A different move from pulling up out of a hang, which puts him back on
   * the floor he was already holding: this one ends a floor higher and a tile
   * further on, which is where the ledge is.
   */
  climbLedge: {
    frames: [
      f(0, 0, 'climb1'),
      f(0, 0, 'climb2'),
      f(0, 0, 'climb3'),
      f(0, 0, 'climb4'),
      f(0, 0, 'climb5'),
      // Up a floor and onto the ledge in front, which is where he was
      // reaching. Both on the last frame, so the hands are over the lip
      // before the feet arrive.
      f(1, -1, 'climb6'),
    ],
    then: 'stand',
    interruptible: false,
    airborne: true,
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
