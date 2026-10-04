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

export type Power = 'gun' | 'sticky' | 'slow' | 'wide' | 'split' | 'life'

export const POWERS: readonly Power[] = ['gun', 'sticky', 'slow', 'wide', 'split', 'life']

/**
 * How often each one turns up, out of the total.
 *
 * The gun and the splitter are the exciting ones and so are rarer; an extra
 * life is rarest of all, because a life handed out freely is not a life.
 */
export const POWER_ODDS: Record<Power, number> = {
  gun: 3,
  sticky: 3,
  slow: 4,
  wide: 4,
  split: 3,
  life: 1,
}

export const POWER_SAYS: Record<Power, { name: string; says: string }> = {
  gun: { name: 'Gun', says: 'Two barrels on the bat. Tap to fire.' },
  sticky: { name: 'Sticky', says: 'The ball waits on the bat until you let it go.' },
  slow: { name: 'Slow', says: 'Takes the pace off the ball.' },
  wide: { name: 'Wide', says: 'A longer bat.' },
  split: { name: 'Split', says: 'Three balls instead of one.' },
  life: { name: 'Spare', says: 'One more go.' },
}

export const POWER_INK: Record<Power, string> = {
  gun: '#ff6b53',
  sticky: '#f49ac1',
  slow: '#58b9ff',
  wide: '#8ad48a',
  split: '#ffc84a',
  life: '#e9f2a6',
}

/** How long the ones that wear off last, in seconds. */
export const POWER_LASTS: Record<Power, number> = {
  gun: 14, sticky: 14, slow: 12, wide: 16, split: 0, life: 0,
}

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

/** The colours a brick wears, by how many hits it has left. */
export const BRICK_INK: Record<number, { face: string; edge: string; shine: string }> = {
  1: { face: '#4f7fe0', edge: '#1c3a7a', shine: '#9fc0ff' },
  2: { face: '#c9843c', edge: '#7a4517', shine: '#ffcf96' },
  3: { face: '#b74fd6', edge: '#5f1f74', shine: '#eaa8ff' },
}
export const SOLID_INK = { face: '#8a93a6', edge: '#3d4455', shine: '#d6dbe6' }

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
