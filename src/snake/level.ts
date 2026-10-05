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

// --- the snakes themselves ---------------------------------------------------

/**
 * Real snakes, with what is actually true about them turned into numbers.
 *
 * The brief: "use real snakes — cobra, rattle, viper, black mamba". So these
 * are the real animals and the trade-offs are the real differences between
 * them, not five colours of the same snake:
 *
 *  - A black mamba is the fastest snake on earth — about 12 mph over short
 *    stretches — and it is slender with it. Fast and thin is a real trade.
 *  - A puff adder, like most vipers, is heavy and slow and has the longest
 *    fangs of any snake. Slow and hits hardest.
 *  - A rattlesnake is heavy-bodied and deliberate, and the rattle is a warning
 *    rather than a weapon: it would rather you went away.
 *  - A cobra is quick, rears up, and is the all-rounder of the four.
 *  - A grass snake is harmless, eats frogs, and plays dead when frightened. It
 *    is the one to learn on: nimble, and it cannot hurt anybody much.
 *
 * `bite` is what turns length into strength, which is the whole of the new
 * game: a long rattlesnake beats a short mamba, and a long mamba beats both.
 */
export type Species = 'grass' | 'rattler' | 'cobra' | 'viper' | 'mamba'

export const SPECIES: readonly Species[] = ['grass', 'rattler', 'cobra', 'viper', 'mamba']

export type Pattern = 'bars' | 'diamond' | 'zigzag' | 'plain'

export interface Kind {
  name: string
  /** What it actually is, for the card that lets you pick one. */
  latin: string
  says: string
  /** Multipliers on the shared speed and turn rate. */
  speed: number
  turn: number
  /** How much of its length counts as strength. */
  bite: number
  /** How fat it is for its length, which is how it looks as much as anything. */
  build: number
  ink: string
  trim: string
  mark: string
  pattern: Pattern
}

export const KINDS: Record<Species, Kind> = {
  grass: {
    name: 'Grass snake',
    latin: 'Natrix natrix',
    says: 'Harmless, quick to turn, and no use in a fight. Start here.',
    speed: 1, turn: 1.15, bite: 0.8, build: 0.95,
    ink: '#6f9e4a', trim: '#3f6129', mark: '#2c4420', pattern: 'bars',
  },
  rattler: {
    name: 'Rattlesnake',
    latin: 'Crotalus atrox',
    says: 'Heavy and slow, and it hits hard. It would rather you went away.',
    speed: 0.9, turn: 0.85, bite: 1.3, build: 1.2,
    ink: '#c2a06a', trim: '#8a6c3c', mark: '#5c4426', pattern: 'diamond',
  },
  cobra: {
    name: 'Cobra',
    latin: 'Naja naja',
    says: 'Quick, strong, and good at everything. The all-rounder.',
    speed: 1.05, turn: 1, bite: 1.15, build: 1,
    ink: '#b08048', trim: '#73502a', mark: '#3f2d18', pattern: 'plain',
  },
  viper: {
    name: 'Puff adder',
    latin: 'Bitis arietans',
    says: 'The slowest of the five, with the longest fangs of any snake.',
    speed: 0.85, turn: 0.95, bite: 1.45, build: 1.3,
    ink: '#a89050', trim: '#6e5a2c', mark: '#473a1c', pattern: 'zigzag',
  },
  mamba: {
    name: 'Black mamba',
    latin: 'Dendroaspis polylepis',
    says: 'The fastest snake alive. Thin with it, so do not pick a fight.',
    speed: 1.3, turn: 1.05, bite: 0.95, build: 0.8,
    ink: '#5a5f63', trim: '#36393c', mark: '#232527', pattern: 'plain',
  },
}

/**
 * How much stronger one snake has to be before it wins.
 *
 * Not a hair's breadth: two snakes of nearly the same size should back off
 * rather than have the bigger one win by a hundredth. Inside this margin
 * neither can bite the other, which is what a standoff looks like.
 */
export const STANDOFF = 0.12

// --- what there is to eat ----------------------------------------------------

/**
 * Prey, which used to be dots.
 *
 * "Instead of eating dots, how about making it more realistic — you are in a
 * forest and you need to catch rodents, rats, insects, frogs, like a real
 * snake to grow."
 *
 * Four, and they make their own difficulty curve: the more a thing is worth,
 * the better it is at not being caught. An ant does not even look up. A rabbit
 * is gone before you have finished deciding.
 */
export type PreyKind = 'ant' | 'frog' | 'rat' | 'rabbit'

export const PREY: readonly PreyKind[] = ['ant', 'frog', 'rat', 'rabbit']

export interface Creature {
  name: string
  /** What eating one adds to your length. */
  feeds: number
  score: number
  /** How far off it notices a snake, and how fast it goes when it does. */
  notice: number
  flees: number
  /** Hops in bursts rather than running, like a frog does. */
  hops: boolean
  /** How many of this kind the forest keeps about, as a share of them all. */
  share: number
  size: number
  ink: string
  trim: string
}

export const CREATURES: Record<PreyKind, Creature> = {
  ant: {
    name: 'ant', feeds: 0.07, score: 5, notice: 0, flees: 0, hops: false,
    share: 0.5, size: 0.1, ink: '#6b4a2a', trim: '#3d2a17',
  },
  frog: {
    name: 'frog', feeds: 0.16, score: 15, notice: 1.5, flees: 2.6, hops: true,
    share: 0.28, size: 0.17, ink: '#5fa05a', trim: '#2f5d2c',
  },
  rat: {
    name: 'rat', feeds: 0.3, score: 35, notice: 2.2, flees: 2.9, hops: false,
    share: 0.17, size: 0.2, ink: '#8a7f72', trim: '#4d453c',
  },
  rabbit: {
    name: 'rabbit', feeds: 0.65, score: 90, notice: 3.2, flees: 3.9, hops: false,
    share: 0.05, size: 0.27, ink: '#b9a894', trim: '#6e6052',
  },
}

/** How many creatures the forest keeps about. */
/**
 * How a frightened animal runs, which is not flat out for ever.
 *
 * A rabbit is faster than a snake — that is true of real ones and it has to
 * stay true here, or catching one means nothing. What was missing is the other
 * half of it: a rabbit sprints and then it is blown. Measured before this went
 * in, a straight chase after a rabbit ended with it caught nine times in
 * twenty and sixty-five per cent of the chase spent out at the fence, which is
 * not a hunt, it is a treadmill.
 *
 * So the burst stays quick and it runs out, and what is left afterwards is
 * slower than a snake. The chase became: it bolts, you stay after it, it tires,
 * you have it.
 */
export const SPRINT = 1.3
export const BLOWN = 0.42
/** Seconds of sprint got back for each second spent not running. */
export const RECOVER = 0.8

/**
 * How fast a frightened animal can turn, in radians a second.
 *
 * It used to turn instantly, recomputing the way away from the snake every
 * frame, which made it perfectly evasive and made the chase a tail-chase that
 * could only ever be won at the fence. An animal that commits to a direction
 * for a moment can be cut off, which is the whole of how you catch one.
 */
export const PREY_TURN = 4.5

export const PREY_COUNT = 90

// --- somewhere to hide -------------------------------------------------------

/**
 * Burrows.
 *
 * "There are holes to hide." A head over a burrow cannot be bitten — which is
 * the only way a small snake gets away from a big one, since a big one is also
 * usually a faster one.
 *
 * It is not a bed, though: four seconds and the burrow is used up for a while,
 * or hiding would simply be the game. Rodents bolt down them too, which is
 * both true and the reason a burrow is somewhere you want to be anyway.
 */
export const BURROW_R = 0.55
export const HIDE_FOR = 4
export const HIDE_AGAIN = 7

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
  /** Which real snake it is, which decides how it looks and how it fights. */
  kind: Species
  /** How much it would rather hunt than eat. 0 is a grazer, 1 a hunter. */
  mean: number
  /** How far ahead it looks for trouble, in units. */
  care: number
  /** How much longer than you it starts, as a share. */
  size: number
}

/**
 * The other snakes in the forest.
 *
 * Named individuals of real species, so "a cobra called Ash" is somebody you
 * can learn to be wary of rather than an orange line. The grass snakes are
 * company; the mamba and the adder are the reason to look before you turn.
 */
export const ROSTER: readonly Rival[] = [
  { name: 'Mossback', kind: 'grass', mean: 0.1, care: 1.6, size: 0.8 },
  { name: 'Hiss', kind: 'grass', mean: 0.2, care: 1.8, size: 0.9 },
  { name: 'Ash', kind: 'cobra', mean: 0.45, care: 1.3, size: 1.1 },
  { name: 'Diamond', kind: 'rattler', mean: 0.35, care: 1.5, size: 1.25 },
  { name: 'Shadow', kind: 'mamba', mean: 0.6, care: 1.9, size: 1.1 },
  { name: 'Bramble', kind: 'viper', mean: 0.55, care: 1.1, size: 1.35 },
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
  // "See off", not "ring": there are two ways to take a snake down now, and
  // naming only one of them sends him looking for the wrong move.
  catch: (n) => (n === 1 ? 'see off somebody' : `see off ${n}`),
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
  catch: (n) => `${Math.floor(n)} seen off`,
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
  /** Burrows to hide down. */
  burrows: number
  /**
   * Which rivals this garden draws from, as indices into the roster.
   *
   * So the first garden is two grass snakes and the last one has the adder and
   * the mamba in it. Meeting a black mamba in the first garden is not a hard
   * garden, it is a short one.
   */
  roster: readonly number[]
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
/**
 * The twelve.
 *
 * The forest does not shrink much and it never fills with thorns, which is a
 * change made after measuring it. The ladder used to take the arena from
 * twelve down to nine and put seven hedges in it, and taking the last garden
 * apart one variable at a time showed where the difficulty was really coming
 * from: cutting the rivals from six to two bought one second, while giving
 * the forest its old size back bought seven and clearing the hedges five.
 *
 * Which is the wrong difficulty. The rule the whole game now rests on is find
 * a stronger snake and run — and in a forest that small, with that many
 * thorns, there is nowhere to run to, so the rule is a lie and the last
 * gardens are not hard, they are arbitrary. The pressure comes from who is in
 * the forest instead, which is the part he can learn to read.
 */
/*
 * Every late forest keeps a grass snake in it, which is both the realistic
 * thing — a real forest holds far more small snakes than big ones — and the
 * playable one: a garden where every rival opens stronger than you is a garden
 * with nothing to hunt, and growing by fighting is half of what the game is.
 */
export const GARDENS: readonly Garden[] = [
  { name: 'The lawn', goal: 'grow', want: 6, rivals: 2, mean: 0.6, arena: 12, charms: 4, hedges: 0, burrows: 2, roster: [0, 1] },
  { name: 'The border', goal: 'graze', want: 25, rivals: 3, mean: 0.7, arena: 12, charms: 4, hedges: 0, burrows: 2, roster: [0, 1] },
  { name: 'First ring', goal: 'catch', want: 1, rivals: 3, mean: 0.8, arena: 12, charms: 4, hedges: 0, burrows: 3, roster: [0, 1, 2] },
  { name: 'Hold still', goal: 'last', want: 40, rivals: 3, mean: 1, arena: 12, charms: 3, hedges: 0, burrows: 3, roster: [0, 1, 2] },
  { name: 'The hedges', goal: 'grow', want: 10, rivals: 3, mean: 1, arena: 12, charms: 3, hedges: 2, burrows: 3, roster: [0, 2, 3] },
  { name: 'Thicket', goal: 'catch', want: 2, rivals: 4, mean: 1, arena: 12, charms: 3, hedges: 3, burrows: 4, roster: [0, 2, 3] },
  { name: 'The warren', goal: 'graze', want: 40, rivals: 4, mean: 1.1, arena: 11.5, charms: 3, hedges: 3, burrows: 5, roster: [1, 2, 3] },
  { name: 'Close quarters', goal: 'grow', want: 12, rivals: 4, mean: 1.2, arena: 11.5, charms: 2, hedges: 4, burrows: 4, roster: [1, 2, 3, 4] },
  { name: 'Hold on', goal: 'last', want: 60, rivals: 5, mean: 1.3, arena: 11, charms: 2, hedges: 3, burrows: 5, roster: [1, 2, 3, 4] },
  { name: 'The hunt', goal: 'catch', want: 3, rivals: 5, mean: 1.4, arena: 11, charms: 2, hedges: 4, burrows: 5, roster: [1, 2, 3, 4, 5] },
  { name: 'Bramble', goal: 'grow', want: 14, rivals: 5, mean: 1.5, arena: 11, charms: 2, hedges: 5, burrows: 5, roster: [1, 3, 4, 5] },
  { name: 'The whole forest', goal: 'catch', want: 4, rivals: 6, mean: 1.6, arena: 10.5, charms: 2, hedges: 4, burrows: 6, roster: [1, 2, 3, 4, 5] },
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
    burrows: Math.max(2, last.burrows - Math.floor(past / 4)),
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

/**
 * How long you start a garden.
 *
 * Measured, after the ladder was found to have a wall in it rather than a
 * curve: from garden nine onwards every rival opened stronger than the player,
 * all of them, so there was nothing to hunt and nowhere to go, and a life in
 * the last garden lasted two seconds. The rivals are bigger there because a
 * puff adder is bigger than a grass snake — the answer is not to shrink them
 * but to let you turn up grown as well. Capped, because the point is to open
 * with a mix: something you can take, something you must not.
 */
export const openingLength = (level: number): number =>
  NEW_LENGTH * (1 + Math.min(0.6, Math.max(0, level - 1) * 0.055))
