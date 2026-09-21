/**
 * The thirteen levels.
 *
 * Our own layouts, in the vocabulary the genre established: rooms ten tiles
 * across and three floors tall, a grid of them, and a view that moves a room
 * at a time. Each row of characters is a floor the prince stands on top of.
 *
 *   ' ' open air        '#' floor        'X' wall        'I' pillar
 *   '~' loose slab      '^' spikes       'C' chomper     '|' gate
 *   '.' pressure plate  'h' small potion 'H' big potion  'p' poison
 *   's' sword           'E' the way out
 *
 * They are drawn to teach in order: the first has nothing in it but a gap and
 * a sword, and by the last there is a swordsman in every room. `levels.test.ts`
 * checks each one for the things that are easy to get wrong by hand.
 */
import type { Level } from './level'

export const LEVELS: readonly Level[] = [
  {
    name: 'The Dungeon',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    torches: [{ col: 7, row: 0 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXX##  ##XXXXXXXXXXXXXX',
      'X###  ####X####X##   s####   X',
      'X#########X#XXXX#####   #####X',
      'X   ####  X  ##########   ###X',
      'X####  ###X###   ###  #######X',
      'X#########X##########E#######X',
    ],
  },
  {
    name: 'The Guardroom',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 16, row: 1, facing: -1, skill: 0, colour: 'guard' }],
    torches: [{ col: 12, row: 1 }, { col: 25, row: 2 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##.## ###X#######   ####    X',
      'X#####XXXXX###|#########  ###X',
      'X   #####  X  ####   ##   ###X',
      'X####   ###X####  ####  #####X',
      'X##########X#########E#######X',
    ],
  },
  {
    name: 'Spikes',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 25, row: 1, facing: -1, skill: 1, colour: 'guard' }],
    torches: [{ col: 9, row: 0 }, { col: 20, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##^## ##.X######  h###  ####X',
      'X#####XXXXX###|##########   #X',
      'X  ^###   X   ###^##   ##  ##X',
      'X####  ####X####   ####  ####X',
      'X##########X#########E#######X',
    ],
  },
  {
    name: 'Loose Ground',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 14, row: 3, facing: -1, skill: 1, colour: 'guard' }],
    torches: [{ col: 6, row: 1 }, { col: 24, row: 0 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##~~# ###X###~#### ##h#   ##X',
      'X#####XXXXX########X#####  ##X',
      'X  ###   .X  ##~~##X##   ####X',
      'X####  ####X####   X##  #####X',
      'X##########X#######|##E######X',
    ],
  },
  {
    name: 'The Chompers',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 24, row: 1, facing: -1, skill: 2, colour: 'guard' }],
    torches: [{ col: 11, row: 1 }, { col: 23, row: 2 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##C## ##.X####C###  ####   #X',
      'X#####XXXXX###|#####X#####  #X',
      'X  ###^  #X   ##C###X##   ###X',
      'X####  ####X####   #X##  ####X',
      'X##########X########X#E######X',
    ],
  },
  {
    name: 'The Long Drop',
    palette: 'dungeon',
    start: { col: 2, row: 0, facing: 1 },
    guards: [
      { col: 14, row: 2, facing: -1, skill: 2, colour: 'guard' },
      { col: 26, row: 4, facing: -1, skill: 2, colour: 'fat' },
    ],
    torches: [{ col: 8, row: 0 }, { col: 19, row: 3 }],
    rows: [
      'X###  ###X####~###  #####   #X',
      'X####XXXXX###########X####  #X',
      'X  ###   X   ####   #X##h####X',
      'X####  ###X###^  ####X##  ###X',
      'X##.######X#########|X##  ###X',
      'X#########X##########X#E#####X',
    ],
  },
  {
    name: 'The Palace Gate',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [
      { col: 12, row: 1, facing: -1, skill: 2, colour: 'guard' },
      { col: 27, row: 3, facing: -1, skill: 2, colour: 'guard' },
    ],
    torches: [{ col: 6, row: 0 }, { col: 17, row: 1 }, { col: 26, row: 2 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##.## ###X##C###### ###h   #X',
      'X#####XXXXX###|#####X####   #X',
      'X  ###^^ #X   ##   #X##   ###X',
      'X####  ####X###  ###X###  ###X',
      'X##########X########X##E#####X',
    ],
  },
  {
    name: 'The Cisterns',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [
      { col: 16, row: 1, facing: -1, skill: 3, colour: 'guard' },
      { col: 25, row: 4, facing: -1, skill: 2, colour: 'fat' },
    ],
    torches: [{ col: 9, row: 1 }, { col: 21, row: 3 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##~~# ##.X####C### ##H#    #X',
      'X#####XXXXX###|#####X#####  #X',
      'X ^###   #X   ##~~##X##   ###X',
      'X####  ####X####   #X##  ####X',
      'X##########X########X#E######X',
    ],
  },
  {
    name: 'The Upper Halls',
    palette: 'palace',
    start: { col: 2, row: 0, facing: 1 },
    guards: [
      { col: 15, row: 0, facing: -1, skill: 3, colour: 'guard' },
      { col: 22, row: 2, facing: -1, skill: 3, colour: 'guard' },
      { col: 27, row: 4, facing: -1, skill: 2, colour: 'fat' },
    ],
    torches: [{ col: 7, row: 0 }, { col: 18, row: 2 }, { col: 25, row: 4 }],
    rows: [
      'X##.## ###X###C##### ###h   #X',
      'X#####XXXXX#########X#####  #X',
      'X  ###^  #X   ##   #X##   ###X',
      'X####  ###X###  ####X###  ###X',
      'X#########X####~~###X##   ###X',
      'X#########X########|X##E#####X',
    ],
  },
  {
    name: 'Blades and Spikes',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [
      { col: 17, row: 1, facing: -1, skill: 3, colour: 'guard' },
      { col: 26, row: 3, facing: -1, skill: 3, colour: 'guard' },
    ],
    torches: [{ col: 8, row: 1 }, { col: 20, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##^C# ##.X##C##C## ###h    #X',
      'X#####XXXXX###|#####X####   #X',
      'X ^^##   #X   ##^^##X##   ###X',
      'X####  ####X####   #X###  ###X',
      'X##########X########X##E#####X',
    ],
  },
  {
    name: 'The Bone Yard',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [
      { col: 14, row: 1, facing: -1, skill: 3, colour: 'skeleton' },
      { col: 26, row: 3, facing: -1, skill: 3, colour: 'guard' },
    ],
    torches: [{ col: 6, row: 1 }, { col: 22, row: 2 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##~~# ##.X####~### ##H#    #X',
      'X#####XXXXX###|#####X####   #X',
      'X ^C##   #X   ##C###X##   ###X',
      'X####  ####X####   #X###  ###X',
      'X##########X########X##E#####X',
    ],
  },
  {
    name: 'The Mirror',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [
      { col: 15, row: 1, facing: -1, skill: 4, colour: 'shadow' },
      { col: 27, row: 3, facing: -1, skill: 3, colour: 'guard' },
    ],
    torches: [{ col: 10, row: 0 }, { col: 19, row: 1 }, { col: 24, row: 3 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##C## ##.X##C##C## ###h    #X',
      'X#####XXXXX###|#####X####   #X',
      'X ^^##^  #X   ##^^##X##   ###X',
      'X####  ####X###~~  #X###  ###X',
      'X##########X########X##E#####X',
    ],
  },
  {
    name: "Papa's Own Tower",
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [
      { col: 15, row: 1, facing: -1, skill: 4, colour: 'guard' },
      { col: 22, row: 3, facing: -1, skill: 4, colour: 'vizier' },
    ],
    torches: [{ col: 7, row: 1 }, { col: 18, row: 1 }, { col: 26, row: 3 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X##^C# ##.X##C##C## ##H#    #X',
      'X#####XXXXX###|#####X####   #X',
      'X ^^##^^ #X   ##^^##X##   ###X',
      'X####  ####X###~~  #X###  ###X',
      'X##########X########X##E#####X',
    ],
  },
]

export function levelFor(number: number): Level {
  return LEVELS[Math.min(LEVELS.length, Math.max(1, number)) - 1]
}
