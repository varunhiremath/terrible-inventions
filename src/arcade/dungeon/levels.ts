/**
 * The thirteen levels.
 *
 * Generated rather than written out, and then proved. Every one of these was
 * hand-written once, and all thirteen turned out to be sealed inside their
 * first room: a wall ran the full height between room nought and room one
 * with no doorway cut in it anywhere, so the game was unfinishable from the
 * opening screen and nothing but playing it would have said so.
 *
 * Now `scripts/dungeon.py` lays a route first — walk, drop, climb through a
 * gap, or a short pit you can jump or fall into and climb back out of — and
 * draws the level round it, keeping every trap and every spare ledge off the
 * route so no decoration can seal anything. Then `solve.test.ts` plays each
 * level every way there is, using the game's own movement code rather than a
 * model of it, and checks the way out comes up. A level that cannot be
 * finished fails the build.
 *
 * Each row of characters is a floor the prince stands on top of.
 *
 *   ' ' open air        '#' floor        'X' wall        'I' pillar
 *   '~' loose slab      '^' spikes       'C' chomper     '|' gate
 *   '.' pressure plate  'h' small potion 'H' big potion  'p' poison
 *   's' sword           'E' the way out
 */
import type { Level } from './level'

export const LEVELS: readonly Level[] = [
  {
    name: 'The Dungeon',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    torches: [{ col: 4, row: 0 }, { col: 13, row: 2 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ######                     X',
      'X       ###.# #####| ######E#X',
      'X  #         ##     ##       X',
      'X # #### #      #            X',
      'X #  #sh   ###  #       # #  X',
    ],
  },
  {
    name: 'The Guardroom',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 19, row: 3, facing: -1, skill: 0, colour: 'guard' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 2 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ######  .####              X',
      'X       ###    ###|    ####E#X',
      'X    # #   #       ####      X',
      'X ##   #     #  # #       ## X',
      'X         #    # ##h    #  # X',
    ],
  },
  {
    name: 'Spikes',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 15, row: 2, facing: -1, skill: 0, colour: 'guard' }, { col: 21, row: 2, facing: -1, skill: 0, colour: 'guard' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 1 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ####                 ####E#X',
      'X     #####  ##### |###      X',
      'X #        .##    ##      #  X',
      'X   #  ^#      #    #  #H #  X',
      'X             #   #    # ### X',
    ],
  },
  {
    name: 'Loose Ground',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 15, row: 2, facing: -1, skill: 1, colour: 'fat' }, { col: 21, row: 3, facing: -1, skill: 1, colour: 'fat' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 2 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ########.####              X',
      'X              ###|#   ####E#X',
      'X   # ##      #     ###      X',
      'X      ##  ##^    ^       #  X',
      'X  #  # ^~       h # ~# #    X',
    ],
  },
  {
    name: 'The Chompers',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 16, row: 2, facing: -1, skill: 1, colour: 'guard' }, { col: 22, row: 2, facing: -1, skill: 1, colour: 'guard' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ####   #.###             # X',
      'X     ###     ###  |#####    X',
      'X #          ~   ###     ##E#X',
      'X   C   ~  ### ^^    # #     X',
      'X    #  ~   C       ^ #  h   X',
    ],
  },
  {
    name: 'The Long Drop',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 14, row: 2, facing: -1, skill: 1, colour: 'skeleton' }, { col: 19, row: 1, facing: -1, skill: 1, colour: 'skeleton' }, { col: 23, row: 2, facing: -1, skill: 1, colour: 'skeleton' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 1 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X #### ##.##     #|###       X',
      'X     ##    #####     #####E#X',
      'X   ^    # #         C       X',
      'X #  #  # ^# #  # #    H##   X',
      'X         ~     #        ~ # X',
    ],
  },
  {
    name: 'The Palace Gate',
    palette: 'dungeon',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 14, row: 2, facing: -1, skill: 2, colour: 'fat' }, { col: 18, row: 3, facing: -1, skill: 2, colour: 'fat' }, { col: 22, row: 4, facing: -1, skill: 2, colour: 'fat' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 2 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ##### ##.###       #       X',
      'X      ##     ####           X',
      'X   #    ##       #|# #####E#X',
      'X #  ~h## ###        ##      X',
      'X    C   ^#   #   #~   C ##  X',
    ],
  },
  {
    name: 'The Cisterns',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 13, row: 1, facing: -1, skill: 2, colour: 'guard' }, { col: 17, row: 3, facing: -1, skill: 2, colour: 'guard' }, { col: 22, row: 2, facing: -1, skill: 2, colour: 'guard' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X #####  #####     ~         X',
      'X      ##.    ###    ######E#X',
      'X  ^ ^    #      #|##        X',
      'X   ## h       #      #   #  X',
      'X  C#  C ^#      ~   ^ # ### X',
    ],
  },
  {
    name: 'The Upper Halls',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 13, row: 1, facing: -1, skill: 2, colour: 'shadow' }, { col: 16, row: 2, facing: -1, skill: 2, colour: 'shadow' }, { col: 19, row: 3, facing: -1, skill: 2, colour: 'shadow' }, { col: 22, row: 2, facing: -1, skill: 2, colour: 'shadow' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ########.####         ###E#X',
      'X              ### |####     X',
      'X    #     ##     ##    #    X',
      'X   ^    ## ~ #     ##   #   X',
      'X  ~ #H      #^~  ^ # #C     X',
    ],
  },
  {
    name: 'Blades and Spikes',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 13, row: 1, facing: -1, skill: 3, colour: 'skeleton' }, { col: 15, row: 1, facing: -1, skill: 3, colour: 'skeleton' }, { col: 19, row: 1, facing: -1, skill: 3, colour: 'skeleton' }, { col: 22, row: 2, facing: -1, skill: 3, colour: 'skeleton' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ########.  #####|##     ## X',
      'X          ###       ####    X',
      'X  #  ^  #               ##E#X',
      'X    ~# C  #                 X',
      'X #  #    #    ~ ~   h#C # # X',
    ],
  },
  {
    name: 'The Bone Yard',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 12, row: 1, facing: -1, skill: 3, colour: 'shadow' }, { col: 15, row: 2, facing: -1, skill: 3, colour: 'shadow' }, { col: 19, row: 1, facing: -1, skill: 3, colour: 'shadow' }, { col: 22, row: 2, facing: -1, skill: 3, colour: 'shadow' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 1 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X #######  ####    ###       X',
      'X        #.#   ###|   ####   X',
      'X ##  h#                  #E#X',
      'X #  ###C^   #    #~ ##      X',
      'X   #      C~  #  #    #     X',
    ],
  },
  {
    name: 'The Mirror',
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 13, row: 2, facing: -1, skill: 3, colour: 'fat' }, { col: 16, row: 3, facing: -1, skill: 3, colour: 'fat' }, { col: 20, row: 3, facing: -1, skill: 3, colour: 'fat' }, { col: 23, row: 4, facing: -1, skill: 3, colour: 'fat' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 1 }, { col: 22, row: 3 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ###  ###        ^       ^  X',
      'X    ###  .#####             X',
      'X  #H           ###|##  ###E#X',
      'X  C  # ~  C          ###    X',
      'X # #     ^ #  ~ ^ # ~       X',
    ],
  },
  {
    name: "Papa's Own Tower",
    palette: 'palace',
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 13, row: 1, facing: -1, skill: 4, colour: 'vizier' }, { col: 16, row: 1, facing: -1, skill: 4, colour: 'vizier' }, { col: 20, row: 1, facing: -1, skill: 4, colour: 'vizier' }, { col: 23, row: 1, facing: -1, skill: 4, colour: 'vizier' }],
    torches: [{ col: 4, row: 0 }, { col: 13, row: 0 }, { col: 22, row: 0 }],
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X ###  ##.########|########E#X',
      'X    ###                     X',
      'X  #        #          h # # X',
      'X  ##~ # ^ #  C    ~    ## # X',
      'X #  #~         #   # # # C# X',
    ],
  },
]

export function levelFor(number: number): Level {
  return LEVELS[Math.min(Math.max(1, number), LEVELS.length) - 1]
}
