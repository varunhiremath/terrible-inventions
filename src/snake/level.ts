/**
 * The garden.
 *
 * The brief: "based on slither.io, a snake based game. Just one joystick that
 * lets you run around and eat stuff to grow bigger. Don't run into yourself or
 * other snakes. Encircle other snakes and trap. Collect special powers on the
 * map."
 *
 * Those last two sentences cannot both be literally true, and it is worth
 * saying where the line is rather than quietly picking one.
 *
 * To encircle anything you have to close a curve, and a curve is closed by
 * meeting itself. If meeting yourself kills you, there is no move that
 * encircles — not a hard one, not a risky one: none. So running into your own
 * body is the one thing here that is not fatal. It closes a ring, and
 * everything inside the ring is yours: the tail you looped over is cut away
 * and lost, and any snake caught in it is caught.
 *
 * Which leaves running into yourself expensive rather than safe, and running
 * into somebody else exactly as fatal as he asked for. The encircle is a trade
 * — length for a kill — and a trade is a better mechanic than a free win.
 */

/** How big the garden is, in the units everything else is measured in. */
export const ARENA = 12

/**
 * How fast a snake travels, and how quickly it can turn.
 *
 * The turn rate is the whole feel of the game and the one number that has to
 * be right. Too quick and the snake corkscrews into itself on every thumb
 * twitch; too slow and the loop you need for an encircle is wider than the
 * garden. It is set here against the arena rather than guessed: at this rate a
 * full circle takes about two and a half seconds and comes out a little over
 * one unit across, which is small enough to ring somebody inside a corner of
 * the map and large enough that a nervous thumb does not close it by accident.
 */
export const SPEED = 2.4
export const TURN = 2.6

/** A boost, while the stick is pushed right over or the button is held. */
export const DASH_SPEED = 4.3
/** What a dash costs, in length a second. Nothing is free. */
export const DASH_COST = 1.4

/** How far apart the beads of a body are, and how fat one is. */
export const BEAD = 0.14
export const GIRTH = 0.3

/** The length a snake starts with, and the shortest it can be cut to. */
export const NEW_LENGTH = 2.4
export const LEAST_LENGTH = 1.6

/** How much of the neck cannot catch its own head, in beads. */
export const NECK = 7

/** What one pellet adds, and what one is worth on the board. */
export const PELLET_FEEDS = 0.22
export const PELLET_SCORE = 10

/** How many pellets the garden keeps scattered about. */
export const PELLET_COUNT = 150

/**
 * What is left behind when a snake dies, per unit of its length.
 *
 * Two, and the big pellets are worth two each, so a snake that dies puts back
 * a little less than the length it was — eat all of it and you are nearly as
 * big as it was. That is the slither bargain and it has to be close to fair:
 * at seven, with pellets worth three, a dead rival fed the snake that got it
 * four and a half times its own length, and thirty seconds into a round
 * somebody was eighty units long in a garden twenty-four across.
 */
export const REMAINS = 2

export type Power = 'dash' | 'ghost' | 'lure' | 'frost'

export const POWERS: readonly Power[] = ['dash', 'ghost', 'lure', 'frost']

/** How long each lasts, in seconds. */
export const POWER_LASTS: Record<Power, number> = {
  dash: 6,
  ghost: 5,
  lure: 10,
  frost: 6,
}

export const POWER_SAYS: Record<Power, { name: string; says: string }> = {
  dash: { name: 'Quick', says: 'Faster, and the dash costs nothing.' },
  ghost: { name: 'Ghost', says: 'Straight through anybody. Including yourself.' },
  lure: { name: 'Lure', says: 'Food comes to you.' },
  frost: { name: 'Frost', says: 'Everybody else slows right down.' },
}

export const POWER_INK: Record<Power, string> = {
  dash: '#ffc84a',
  ghost: '#9fd8e8',
  lure: '#8ad48a',
  frost: '#58b9ff',
}

/** How many powers lie about at once, and how far a pickup reaches. */
export const POWER_COUNT = 4
export const PICKUP = 0.34

/** How fast the lure drags a pellet, and how far it reaches. */
export const LURE_PULL = 3.2
export const LURE_REACH = 2.6

/** How much slower everything else moves under frost. */
export const FROST_SCALE = 0.45

/** The snakes in the garden besides you, when nobody says otherwise. */
export const RIVALS = 5

/**
 * Who else is in here.
 *
 * Original, as everything in this project is: these are garden things with
 * names to match, not anybody else's characters.
 */
export interface Rival {
  name: string
  ink: string
  trim: string
  /** How much it would rather chase you than eat. 0 is a grazer, 1 a hunter. */
  mean: number
  /** How far ahead it looks for trouble, in units. */
  care: number
}

export const ROSTER: readonly Rival[] = [
  { name: 'Mossback', ink: '#6fae5a', trim: '#3d6b33', mean: 0.1, care: 1.6 },
  { name: 'Copperhead', ink: '#d2823c', trim: '#8a4f1e', mean: 0.45, care: 1.3 },
  { name: 'Inky', ink: '#6b74c7', trim: '#3d4486', mean: 0.3, care: 1.9 },
  { name: 'Rust', ink: '#c25b4a', trim: '#7d2f24', mean: 0.55, care: 1.1 },
  { name: 'Pip', ink: '#d8c45a', trim: '#8f7d26', mean: 0.2, care: 2.1 },
  { name: 'Shadow', ink: '#7a6f8c', trim: '#443d52', mean: 0.6, care: 1.5 },
]

// --- the gardens ------------------------------------------------------------

/**
 * What a garden asks of you.
 *
 * The game had none of this: one endless round, three lives, and a score that
 * was how long you got. Which is what the game it is based on does, and the
 * verdict was "it's no fun without any clear objectives" — fair, because
 * slither.io has a leaderboard full of strangers doing the asking and this has
 * nobody. Something has to say what you are for.
 *
 * Four kinds, rotated so no two gardens in a row ask the same thing, and all
 * four are things he would be doing anyway — the goal names the point of the
 * game rather than bolting a chore onto it.
 */
export type GoalKind = 'grow' | 'catch' | 'graze' | 'last'

export const GOAL_SAYS: Record<GoalKind, (want: number) => string> = {
  grow: (n) => `get to ${n}`,
  catch: (n) => (n === 1 ? 'ring somebody' : `ring ${n}`),
  graze: (n) => `eat ${n}`,
  last: (n) => `last ${n}s`,
}

/**
 * How far along, in the goal's own words.
 *
 * Each goal counts something different, and "7" on its own tells nobody which
 * of the four things is being counted. The growing one says "long" because
 * that is the word the game uses for it everywhere else.
 */
export const GOAL_GOT: Record<GoalKind, (got: number) => string> = {
  grow: (n) => `${n.toFixed(1)} long`,
  catch: (n) => `${Math.floor(n)} ringed`,
  graze: (n) => `${Math.floor(n)} eaten`,
  last: (n) => `${Math.floor(n)}s`,
}

export interface Garden {
  name: string
  goal: GoalKind
  want: number
  rivals: number
  /** A multiplier on how mean the rivals are by nature. One is themselves. */
  mean: number
  /** How far the garden reaches from the middle. Smaller is tighter. */
  arena: number
  charms: number
  /** Hedges: lines of thorn, deadly to touch, and they do not move. */
  hedges: number
}

/**
 * Twelve gardens.
 *
 * The shape of the ladder: the first four teach the four things the game can
 * ask for — grow, graze, ring somebody, stay alive — one each, in a garden big
 * enough to make mistakes in. The hedges arrive at the fifth and are the only
 * genuinely new thing after that; everything later is the same garden with
 * less room, more company and worse manners.
 *
 * No two in a row ask for the same thing. Turning the page should be something
 * else, not more of it.
 *
 * Arena shrinks from twelve to nine rather than growing, because a bigger
 * garden is an easier one: the whole difficulty of a snake is how much room
 * you have to turn around in.
 */
export const GARDENS: readonly Garden[] = [
  { name: 'The lawn', goal: 'grow', want: 6, rivals: 2, mean: 0.6, arena: 12, charms: 4, hedges: 0 },
  { name: 'The border', goal: 'graze', want: 25, rivals: 3, mean: 0.7, arena: 12, charms: 4, hedges: 0 },
  { name: 'First ring', goal: 'catch', want: 1, rivals: 3, mean: 0.8, arena: 12, charms: 4, hedges: 0 },
  { name: 'Hold still', goal: 'last', want: 40, rivals: 3, mean: 1, arena: 12, charms: 3, hedges: 0 },
  { name: 'The hedges', goal: 'grow', want: 10, rivals: 3, mean: 1, arena: 12, charms: 3, hedges: 2 },
  { name: 'Thicket', goal: 'catch', want: 2, rivals: 4, mean: 1, arena: 11, charms: 3, hedges: 3 },
  { name: 'The maze', goal: 'graze', want: 40, rivals: 4, mean: 1.1, arena: 11, charms: 3, hedges: 5 },
  { name: 'Close quarters', goal: 'grow', want: 12, rivals: 4, mean: 1.2, arena: 10, charms: 2, hedges: 4 },
  { name: 'Hold on', goal: 'last', want: 60, rivals: 5, mean: 1.3, arena: 10, charms: 2, hedges: 4 },
  { name: 'The hunt', goal: 'catch', want: 3, rivals: 5, mean: 1.4, arena: 10, charms: 2, hedges: 5 },
  { name: 'Bramble', goal: 'grow', want: 14, rivals: 5, mean: 1.5, arena: 9, charms: 2, hedges: 7 },
  { name: 'The whole garden', goal: 'catch', want: 4, rivals: 6, mean: 1.6, arena: 9, charms: 2, hedges: 6 },
]

/**
 * Which garden, with the twelfth hardening for ever after.
 *
 * It asks for more of the same rather than inventing anything, because
 * somebody who has cleared twelve gardens does not need a thirteenth idea,
 * they need the twelfth one to stop being easy.
 */
export function gardenFor(level: number): Garden {
  if (level <= GARDENS.length) return GARDENS[level - 1]
  const past = level - GARDENS.length
  const last = GARDENS[GARDENS.length - 1]
  /*
   * Everything is capped. A garden a hundred deep asking somebody to ring
   * ninety-eight snakes is not a hard garden, it is a broken one — and a
   * mistyped level number is how that was found: a screen handed `newRun` a
   * random seed where the level now goes and opened garden 9836, which asked
   * for 4916 rings.
   */
  return {
    ...last,
    name: `Garden ${level}`,
    want: Math.min(last.want * 3, last.want + Math.floor(past / 2)),
    mean: Math.min(2.2, last.mean + past * 0.08),
    hedges: Math.min(12, last.hedges + Math.floor(past / 2)),
  }
}

/** How long a hedge is, in points, and how far apart they are. */
export const HEDGE_BEADS = 9
export const HEDGE_STEP = 0.32
/** How fat a hedge is, which is what you die by touching. */
export const HEDGE_GIRTH = 0.34

/**
 * How long you are left alone after coming back.
 *
 * Appearing and dying in the same second is the worst thing a game can do to
 * anybody, and four lives in forty-three ended inside two seconds before this
 * existed. It is the ghost power under another name, so it draws as a snake
 * you can see through — which is also what it is.
 *
 * There is no clock on a round. This game ends when your lives do, the way the
 * thing it is based on does: the score is how long you got, and a timer on top
 * of that is a second way to lose for no reason anybody asked for.
 */
export const SETTLING = 2.5
