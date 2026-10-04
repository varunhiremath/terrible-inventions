/**
 * The wall.
 *
 * "A brick breaking game with a ball with complex maze of bricks. Some harder
 * that take multiple hits to break. Some bricks were special and would drop
 * special powers like a shooting gun, sticky ball, reduce ball speed. Start
 * with very simple levels and then make the maze more complex."
 *
 * So: the levels are written out as pictures, because a wall is a picture and
 * anything else is a worse way of saying the same thing. A letter per brick,
 * read straight off the page:
 *
 *     .   nothing
 *     a   one hit            A   one hit, and it is carrying something
 *     b   two hits           B   two hits, carrying
 *     c   three hits         C   three hits, carrying
 *     #   solid. Nothing breaks it; it is there to be in the way.
 *
 * The solid ones are what turns a wall into a maze. A row of bricks is a
 * chore; a room with a wall across it and one gap is a puzzle, and the ball
 * finding its way into the room above through that gap is the best thing this
 * kind of game does.
 */

/** How many bricks across and down the wall can be. */
export const COLS = 13
export const ROWS = 18

/** The playing field, in the units everything is measured in. 1 unit = 1 brick. */
export const WIDE = COLS
export const TALL = 24

export const BRICK_W = 1
export const BRICK_H = 0.55

/** Where the wall starts, measured down from the top. */
export const WALL_TOP = 1.6

export const PADDLE_W = 2.2
export const PADDLE_H = 0.34
/** How far up from the bottom the paddle sits. */
export const PADDLE_Y = TALL - 1.1

export const BALL_R = 0.17
export const BALL_SPEED = 9
/** The quickest and slowest it is ever allowed to go. */
export const BALL_FASTEST = 15
export const BALL_SLOWEST = 5.5

/** How much faster it gets for every wall cleared. */
export const SPEED_PER_LEVEL = 0.45

/**
 * How far from straight up the ball can ever be, in radians from vertical.
 *
 * Without this a ball can end up travelling almost horizontally and spend
 * twenty seconds crossing the screen under the wall, which is not difficulty,
 * it is waiting. The classic answer and still the right one.
 */
export const STEEPEST = 1.25

export const PADDLE_SPEED = 14

export type Power =
  | 'gun' | 'sticky' | 'slow' | 'wide' | 'split' | 'life'
  | 'through' | 'floor' | 'bomb' | 'swarm'
  | 'fast' | 'narrow'

export const POWERS: readonly Power[] = [
  'gun', 'sticky', 'slow', 'wide', 'split', 'life',
  'through', 'floor', 'bomb', 'swarm',
  'fast', 'narrow',
]

/** The ones that are bad news, which are drawn in red and worth dodging. */
export const NASTY: readonly Power[] = ['fast', 'narrow']

export const isNasty = (p: Power): boolean => NASTY.includes(p)

/**
 * How often each one turns up, out of the total.
 *
 * The quiet ones are common and the ones that change the game are rare — a
 * gun every other brick is not a gun, it is the gun being the game.
 *
 * Two of them are bad, and that is on purpose. With nothing but presents
 * falling, catching is not a decision: you go and get everything, every time.
 * One in six being something you would rather not have turns a shower of
 * charms into a thing to read, and both of them are drawn in red and shaped
 * like a warning so the reading is fair.
 */
export const POWER_ODDS: Record<Power, number> = {
  slow: 5,
  wide: 5,
  sticky: 4,
  gun: 4,
  split: 4,
  through: 3,
  bomb: 3,
  swarm: 2,
  floor: 2,
  life: 1,
  fast: 3,
  narrow: 3,
}

export const POWER_SAYS: Record<Power, { name: string; says: string }> = {
  gun: { name: 'Gun', says: 'Two barrels. Tap to fire, and they lean the way you slide.' },
  sticky: { name: 'Sticky', says: 'The ball waits on the bat until you let it go.' },
  slow: { name: 'Slow', says: 'Takes the pace off the ball.' },
  wide: { name: 'Wide', says: 'A longer bat.' },
  split: { name: 'Split', says: 'Three balls instead of one.' },
  life: { name: 'Spare', says: 'One more go.' },
  through: { name: 'Through', says: 'The ball ploughs on instead of bouncing.' },
  floor: { name: 'Floor', says: 'A net under the bat. It saves one ball.' },
  bomb: { name: 'Bomb', says: 'Every brick you break takes its neighbours with it.' },
  swarm: { name: 'Swarm', says: 'Five balls. Good luck.' },
  fast: { name: 'Fast', says: 'The ball speeds up. Not a present.' },
  narrow: { name: 'Narrow', says: 'A shorter bat. Also not a present.' },
}

export const POWER_INK: Record<Power, string> = {
  gun: '#ff9a3c',
  sticky: '#f49ac1',
  slow: '#58b9ff',
  wide: '#8ad48a',
  split: '#ffc84a',
  life: '#e9f2a6',
  through: '#b74fd6',
  floor: '#5ad2e0',
  bomb: '#ff6b53',
  swarm: '#ffd27a',
  fast: '#e03a3a',
  narrow: '#e03a3a',
}

/** How long the ones that wear off last, in seconds. Nought is a one-off. */
export const POWER_LASTS: Record<Power, number> = {
  gun: 14, sticky: 14, slow: 12, wide: 16, split: 0, life: 0,
  through: 7, floor: 0, bomb: 10, swarm: 0, fast: 10, narrow: 10,
}

/** How far a bomb's blast reaches, in bricks. */
export const BLAST = 1

/** How fast a dropped power falls, and how wide it is to catch. */
export const DROP_SPEED = 3.4
export const DROP_W = 0.8
export const DROP_H = 0.36

/** The gun. */
export const SHOT_SPEED = 13
export const SHOT_W = 0.1
export const SHOT_H = 0.4
export const SHOT_EVERY = 0.3

/** What a brick is worth, by how many hits it took. */
export const WORTH = [0, 50, 90, 140]

export interface Ink {
  face: string
  edge: string
  shine: string
}

/**
 * The colours.
 *
 * The wall was blue, orange and purple and nothing else, and the note was
 * "make it colourful". So: an ordinary brick takes its colour from the row it
 * is in — a rainbow down the wall, the way these games have looked since the
 * first one — and the bricks that take more than one hit are *not* in the
 * rainbow at all. They are silver and gold.
 *
 * That split is the whole trick, and it is worth saying why it is not just
 * decoration. Colour in this game is information: it has to say how many more
 * goes a brick needs. A rainbow that also means toughness runs out of colours
 * at three and leaves the player counting. Pulling the tough ones out into two
 * metals keeps the message — silver takes two, gold takes three, everything
 * coloured takes one — and hands the whole rainbow back to be looked at.
 */
export const ROW_INK: readonly Ink[] = [
  { face: '#e8503a', edge: '#7d1f14', shine: '#ffb0a0' },
  { face: '#f08c3a', edge: '#8a4a12', shine: '#ffd2a0' },
  { face: '#f0c83a', edge: '#8a6e12', shine: '#fff0a8' },
  { face: '#8ad48a', edge: '#2f6b35', shine: '#ccffcc' },
  { face: '#4fd6c8', edge: '#1c6b66', shine: '#a8fff2' },
  { face: '#4f7fe0', edge: '#1c3a7a', shine: '#9fc0ff' },
  { face: '#8a6fe0', edge: '#3d2a7a', shine: '#c6b4ff' },
  { face: '#d64fb7', edge: '#741f5f', shine: '#ffa8ea' },
  { face: '#f49ac1', edge: '#a53f74', shine: '#ffd4e6' },
]

/**
 * And the tough ones wear their metal as a frame, not as a face.
 *
 * The first go made a two-hit brick silver all over and a three-hit brick
 * gold, which reads beautifully on one brick and turned out to be a disaster
 * across twelve walls: the later ones are mostly tough bricks, so the game
 * that had just been made colourful came out grey. Every wall but the first
 * was silver and gold with a stripe of rainbow at the bottom.
 *
 * So the face keeps the row's colour, whatever the brick is made of, and the
 * metal goes round the edge. Which is better than a compromise: the rainbow
 * runs the whole way down the wall, and toughness is read off the frame — and
 * off the notches in `drawBrick`, so it survives being colour-blind, being on
 * a bad screen, and being four bricks away.
 */
export const TOUGH_EDGE: Record<number, { edge: string; shine: string }> = {
  2: { edge: '#aeb8c8', shine: '#ffffff' },
  3: { edge: '#e0b43a', shine: '#fff0b0' },
}

export const SOLID_INK: Ink = { face: '#6c7488', edge: '#2d3344', shine: '#aab2c4' }

/** What a brick is drawn in, given how tough it still is and where it sits. */
export function inkFor(life: number, row: number, solid: boolean): Ink {
  if (solid) return SOLID_INK
  const colour = ROW_INK[row % ROW_INK.length]
  const metal = TOUGH_EDGE[Math.min(3, life)]
  return metal ? { ...colour, edge: metal.edge, shine: metal.shine } : colour
}

/**
 * The walls, as pictures.
 *
 * The brief was "start with very simple levels and then make the maze more
 * complex", so the first is four rows of nothing but blue and the ninth has
 * rooms in it. Each one adds exactly one idea to the one before, which is the
 * only way a game of this shape teaches anybody anything:
 *
 *   1  a wall. Hit it.
 *   2  bricks that take two hits, and the first powers.
 *   3  gaps, so the ball can get behind
 *   4  the first solid bricks, in a line you have to go round
 *   5  a chequer, which cannot be cleared by standing still
 *   6  three-hit bricks in the middle of it
 *   7  a funnel: solid sides, everything channelled to the middle
 *   8  two rooms with one way into each
 *   9  a proper maze
 *  10  a fortress, solid all round a core
 *  11  columns, so the ball runs up the gaps
 *  12  the lot
 */
export const WALLS: readonly string[][] = [
  /*
   * 1 — a wall. Six rows rather than four.
   *
   * Simple is not the same as thin. At four rows the wall was a strip across
   * the top of a mostly empty field and most of a go was the ball travelling,
   * which reads as a slow game rather than an easy one. Six fills it without
   * asking anything of anybody.
   */
  [
    '.aaaaaaaaaaa.',
    '.aaaaaaaaaaa.',
    '.aaaAaaaAaaa.',
    '.aaaaaaaaaaa.',
    '.aaaaaaaaaaa.',
    '.aaaAaaaAaaa.',
  ],
  // 2 — harder bricks on top, and something to catch.
  [
    '.bbbbbbbbbbb.',
    '.bbbBbbbBbbb.',
    '.bbbbbbbbbbb.',
    '.aaaaaaaaaaa.',
    '.aaaAaaaAaaa.',
    '.aaaaaaaaaaa.',
    '.aaaaaaaaaaa.',
  ],
  // 3 — gaps to slip through.
  [
    '.aa.aaaaa.aa.',
    '.bb.bbbbb.bb.',
    '.bbbbbBbbbbb.',
    '.bb.bbbbb.bb.',
    '.aa.aaAaa.aa.',
    '.aa.aaaaa.aa.',
    '.aaaaaaaaaaa.',
  ],
  // 4 — a line that cannot be broken, with two ways past it.
  [
    'aaaaaaaaaaaaa',
    'bbbbbbbbbbbbb',
    '##.#######.##',
    '.aaaAaaaAaaa.',
    '.aaaaaaaaaaa.',
    '..bbbbbbbbb..',
  ],
  // 5 — a chequer.
  [
    'a.a.a.a.a.a.a',
    '.b.b.b.b.b.b.',
    'a.a.A.a.A.a.a',
    '.b.b.b.b.b.b.',
    'a.a.a.a.a.a.a',
    '.b.b.B.b.b.b.',
  ],
  // 6 — a hard middle.
  [
    '.bbbbbbbbbbb.',
    '.b.........b.',
    '.b..cccCc..b.',
    '.b..cCccc..b.',
    '.b..ccccc..b.',
    '.b.........b.',
    '.aaaAaaaAaaa.',
  ],
  /*
   * 7 — a funnel.
   *
   * The first draft had a solid floor across the bottom of it, which sealed
   * every brick inside away from the ball for ever. A level that cannot be
   * finished is not a hard level, it is a level with no way out of it but the
   * back button, and nothing about looking at the picture said so — the test
   * that floods the field did.
   */
  [
    '#...........#',
    '#.bbbbbbbbb.#',
    '#..bbbBbbb..#',
    '.#..aaaaa..#.',
    '..#..aAa..#..',
    '...#.....#...',
  ],
  // 8 — two rooms, one door each.
  [
    'bbbbbb.bbbbbb',
    'b....#.#....b',
    'b.AaC#.#Caa.b',
    'b.aaa#.#aaA.b',
    'b....#.#....b',
    'b#####.#####b',
    '.aaaaaaaaaaa.',
    '..aaaAaaaa...',
  ],
  // 9 — a maze.
  [
    'aaaaaaaaaaaaa',
    'a#.#.#.#.#.#a',
    'a.b.b.B.b.b.a',
    'a#.#.#.#.#.#a',
    'a.c.C.c.C.c.a',
    'a#.#.#.#.#.#a',
    'a.b.b.b.b.B.a',
    'a#.#.#.#.#.#a',
    'aaaaaaaaaaaaa',
  ],
  // 10 — a fortress, with one way into the keep.
  [
    '#############',
    '#...........#',
    '#.#########.#',
    '#.#ccccccc#.#',
    '#.#cCCCCCc#.#',
    '#.#ccccccc#.#',
    '#.##.....##.#',
    '#...........#',
    '#.bbbbbbbbb.#',
    '...aaAaaAa...',
  ],
  // 11 — columns.
  [
    'c.c.c.c.c.c.c',
    'b.b.b.C.b.b.b',
    'b.B.b.c.b.B.b',
    'a.a.a.b.a.a.a',
    'a.a.a.a.a.a.a',
    '#.#.#.#.#.#.#',
    'aaaaaaaaaaaaa',
    '.aaaAaaaAaaa.',
  ],
  // 12 — the lot.
  [
    '####.....####',
    '#ccc.aAa.ccc#',
    '#cCc.aaa.cCc#',
    '#ccc.....ccc#',
    '..#.bbbbb.#..',
    '...bbBbBbb...',
    '..bbbbbbbbb..',
    '.#.........#.',
    '.aaaaaaaaaaa.',
    '..aaaAaaaa...',
  ],
]

/**
 * A wall for any level, going on past the ones drawn out above.
 *
 * Past the end it comes back round, but harder: every one-hit brick becomes a
 * two, every two becomes a three. That makes a twentieth wall out of a known
 * good shape rather than out of a random generator, which in a game of this
 * kind reliably produces something either trivial or impossible.
 */
export function wallFor(level: number): string[] {
  const round = Math.floor((level - 1) / WALLS.length)
  const picture = WALLS[(level - 1) % WALLS.length]
  if (round === 0) return [...picture]
  const harder: Record<string, string> = { a: 'b', b: 'c', c: 'c', A: 'B', B: 'C', C: 'C' }
  return picture.map((row) =>
    [...row].map((cell) => {
      let now = cell
      for (let i = 0; i < round; i++) now = harder[now] ?? now
      return now
    }).join(''),
  )
}

export const LIVES = 3
