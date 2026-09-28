/**
 * The places the level transitions walk through.
 *
 * The first version of the transitions drew a backdrop by hand — a couple of
 * cave mouths, two green pipes, a flight of steps — and put the game's real
 * character in front of it. That was reported as not being the game, and it
 * was not: a character can be the right one and still be standing somewhere
 * that exists nowhere else in the app.
 *
 * So there is no scenery in the transitions any more. Each of these is a real
 * fragment of its game's world, written in that game's own tile vocabulary,
 * and it is handed to that game's own drawing code. Whatever a wall looks
 * like in Dave, it looks like that here, for ever, without anybody having to
 * remember to change two places.
 *
 * They are all the same shape of idea, because the idea came from watching
 * somebody nine years old describe what he wanted: two rooms with a thin way
 * through between them, something to pick up along the way, and a door at the
 * far end. Every game says that sentence in its own words.
 *
 * `wipeWorlds.test.ts` checks each one is rectangular and that the way
 * through is actually open, because a corridor with a tile left in it is a
 * character walking into a wall for two and a half seconds.
 */
import { TILE as MAZE_TILE } from '../arcade/maze/maze'
import { TILE as CAVE_TILE, type Level as CaveLevel } from '../dave/level'
import { readLevel, type Level as PipeLevel } from '../pipes/level'
import type { Level as KeepLevel } from '../arcade/dungeon/level'

/**
 * Papa Panic: two rooms joined by a single-tile passage, dots all the way
 * along it.
 *
 * Nine rows and seventeen columns. It was as wide as the board itself at
 * first, and a strip that wide is width-limited on a phone: the tiles came out
 * a third the size of the board's own, which is the one thing a fragment of
 * the same maze must not be.
 */
export const MAZE_STRIP: readonly string[] = [
  '#################',
  '# . . ##### . . #',
  '#     #####     #',
  '# . . ##### . . #',
  '#...............#',
  '# . . ##### . . #',
  '#     #####     #',
  '# . . ##### . . #',
  '#################',
]

/** The row the passage runs along, which is the row he is eating. */
export const MAZE_LANE = 4

/** Where the dots in the strip are, worked out once rather than every frame. */
export const MAZE_DOTS: readonly { x: number; y: number }[] = MAZE_STRIP.flatMap((row, y) =>
  [...row].flatMap((tile, x) => (tile === MAZE_TILE.DOT ? [{ x, y }] : [])),
)

/**
 * Dave's caves: a room, a two-tile tunnel with diamonds in it, and the door
 * out on the other side.
 *
 * Blue brick, which is the colour the caves' own third level is built from —
 * `theme` is the same field the real levels set, so this is the same wall.
 */
export const CAVE_TUNNEL: CaveLevel = {
  name: 'the way through',
  theme: { frame: 'blue', platform: 'blue' },
  start: { x: 2, y: 7 },
  rows: [
    '############################',
    '############################',
    '############################',
    '############################',
    '#        ##########        #',
    '#        ##########        #',
    '#                          #',
    '#  3  3  3  3  3  3  3   D #',
    '############################',
    '############################',
  ],
}

/** The floor of the tunnel, which is what Dave walks along. */
export const CAVE_FLOOR = 8

/**
 * How far Dave goes, and how much of the cave is on screen while he does.
 *
 * Twelve columns of twenty-eight. Sixteen was the first go and it made the
 * rooms and the tunnel the same size on a phone, which is the one thing the
 * scene is trying to say the difference between.
 */
export const CAVE_WALK = { from: 2, to: 25, visible: 12 }

/** Where the diamonds are, for taking them as he passes. */
export const CAVE_LOOT: readonly { x: number; y: number }[] = CAVE_TUNNEL.rows.flatMap((row, y) =>
  [...row].flatMap((tile, x) => (tile === CAVE_TILE.DIAMOND ? [{ x, y }] : [])),
)

/**
 * The pipes: out of one pipe, along a low run of blocks with coins under it,
 * and up to the flag.
 *
 * Fifteen rows, because that is how tall that game's screen is, and the top
 * four are never drawn.
 */
export const PIPE_RUN: PipeLevel = readLevel('the way through', [
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '                               |  ',
  '                               |  ',
  '                               |  ',
  '                               |  ',
  '        SSSSSSSSSSSSSSSSSS        ',
  '   []   o o o o o o o o o    []   ',
  '   ()                        ()   ',
  '###############################=##',
  '##################################',
])

/** The top of the ground, which is what he runs along. */
export const PIPE_GROUND = 13

/**
 * The clear stretch between the two pipes.
 *
 * Not the whole row: the pipe shafts stand on the ground at either end, and a
 * run that started at the edge would start inside one.
 */
export const PIPE_WALK = { from: 5, to: 28 }

/** The coins in the run, for spending them as he goes under. */
export const PIPE_COINS: readonly { col: number; row: number }[] = PIPE_RUN.rows.flatMap(
  (row, r) => [...row].flatMap((tile, c) => (tile === 'o' ? [{ col: c, row: r }] : [])),
)

/**
 * The dungeon: one long floor through three rooms, with a gate half way and
 * the way out at the end.
 *
 * Thirty columns, which is three rooms of ten, exactly as the real levels are
 * built — so the camera pans across it the way it pans across a level.
 */
export const KEEP_HALL: KeepLevel = {
  name: 'the way through',
  palette: 'dungeon',
  start: { col: 2, row: 1, facing: 1 },
  torches: [
    { col: 5, row: 0 },
    { col: 15, row: 0 },
    { col: 25, row: 0 },
  ],
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X############|############E##X',
    'X                            X',
  ],
}

/** The floor he runs along, and the columns he runs between. */
export const KEEP_WALK = { row: 1, from: 2, to: 26 }
