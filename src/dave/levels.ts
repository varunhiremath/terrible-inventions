/**
 * The ten levels.
 *
 * Authored as five screens of twenty columns each, because that is exactly
 * what the player sees at a time: a level drawn any other way is a level
 * nobody can picture. They are joined here into the hundred-wide rows the
 * physics wants.
 *
 * Our own layouts, in the original's vocabulary. `levels.test.ts` checks every
 * one of them for the things that are easy to get wrong by hand — a floor you
 * can see through, a start inside a wall, a trophy or door that cannot be
 * reached — and those checks caught nine faults in the first draft of this
 * file, so none of it is as obvious as it looks.
 *
 * Creatures arrive at level five, with the gun. One that turns up before you
 * can answer it is just a wall that moves.
 */
import type { Level } from './level'

export const LEVELS: readonly Level[] = [
  {
    name: "The Way In",
    theme: { frame: 'red', platform: 'red' },
    start: { x: 2, y: 8 },
    rows: [
      "                                                                                                    ",
      "       3     3     3     3     33    3     3     3           33          3     3     3              ",
      "                33            ####                     3    ####   3 T3     33            ####      ",
      "      33       ####                           33 3                 ######  ####            33       ",
      "     ####            33          33          #####                               33                 ",
      "                    ####        ####    3333                   44     3333      ####                ",
      "         33                             ####           33     #####   ####              55 3        ",
      "        ####            33                            ####                             #####        ",
      "   3                   ####                                                44                 D     ",
      "#############################^^##############^^##########^^###################^^####################",
    ],
  },
  {
    name: "Over the Coals",
    theme: { frame: 'red', platform: 'purple' },
    start: { x: 2, y: 8 },
    rows: [
      "                                                                                                    ",
      "                                                       3333                                         ",
      "       3  3333     3     3  3333     3  3333     3     ####  3  T  3  3333     3    3####           ",
      "          ####              #####       ####        3333       #####  ####           33             ",
      "                33                            33    #####                             5#####        ",
      "          33 3 ####   33 3          33       ####                 33     3443           35 3        ",
      "         #####        ####         ####       33 3               ####   #####    33                 ",
      "                                             #####                              ####        6       ",
      "   3                                                                                      D         ",
      "#######################^^######^^##############^^####################^^#########^^##################",
    ],
  },
  {
    name: "Wet Feet",
    theme: { frame: 'blue', platform: 'blue' },
    start: { x: 2, y: 8 },
    rows: [
      "                                                                                                    ",
      "   !     !   3    3      !       !         3     !     3     3 !      !  3     3 33  3     3        ",
      "                    ####                                           3T 3         ####                ",
      "     ####            33            ####      33        3333       ######                3553        ",
      "      33  3333            3     3   33      #####      ####           3333              #####       ",
      "          ####             #####                               44     ####                 33       ",
      "       3333     33           3 3              33    33 3      #####         33            ####      ",
      "       #####   ####                          ####  #####           ###     ####              D      ",
      "     3                                                                                              ",
      "#########################~~######~~#############~~###############~~######~~#########################",
    ],
  },
  {
    name: "First Flight",
    theme: { frame: 'blue', platform: 'brown' },
    start: { x: 2, y: 8 },
    rows: [
      "                                                                                                    ",
      "                                                                     T                              ",
      "                                                                   ######                           ",
      "                                                                                                    ",
      "                    3434                                                                 #####      ",
      "                     3634                                                 J                         ",
      "        J             6633                                              #####                       ",
      "       #####            34                                                                     D    ",
      "     33 53             5                                                                            ",
      "####################^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^########^^^^^^^^########################",
    ],
  },
  {
    name: "Armed",
    theme: { frame: 'brown', platform: 'red' },
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 34, y: 8 }, kind: 'spider', phase: 0.0 },
      { at: { x: 52, y: 8 }, kind: 'spider', phase: 0.5 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], speed: 3.0 },
    rows: [
      "                                                                                                    ",
      "       3  3333     3           3     3  3333     3           3           3     3           3        ",
      "          ####           3333           ####           3333        3 T3              3333           ",
      "                33       ####                          ####        ######   33       ####           ",
      "               ####                              44 3        33            ####         66 3        ",
      "                     33       33                #####       ####  55             33    #####        ",
      "         G3         ####     #####  33                           #####          ####                ",
      "        #####                      ####    3333                                              D      ",
      "     33                 33                 #####                                                    ",
      "#################################################^^#################################################",
    ],
  },
  {
    name: "The Long Drop",
    theme: { frame: 'blue', platform: 'red' },
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 45, y: 8 }, kind: 'orb', phase: 0.0 },
      { at: { x: 63, y: 8 }, kind: 'orb', phase: 0.33 },
      { at: { x: 72, y: 8 }, kind: 'spider', phase: 0.66 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 3, y: 0 }], speed: 3.2 },
    rows: [
      "                                                                                                    ",
      "    !     !    !       !   !   !   !         !       !         !    !     !           !       !     ",
      "       3           3 33  3           3                   3   3     3T 3  3     3 33  3              ",
      "          3333      ####    3333      3           ####            ######        ####                ",
      "          ####              #####       ####3    333    3                             6     3       ",
      "         G3     33                       333 ####  3####       44           33         #####        ",
      "        #####  ####            33              3     33       #####        ####          6 3        ",
      "                              ####                                                          D       ",
      "     33                                                                   55                        ",
      "#######################^^####^^####^^############~~######################^^#########################",
    ],
  },
  {
    name: "Up and Over",
    theme: { frame: 'green', platform: 'brown' },
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 26, y: 8 }, kind: 'spider', phase: 0.0 },
      { at: { x: 58, y: 8 }, kind: 'orb', phase: 0.5 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 0, y: -3 }, { x: 3, y: -3 }, { x: 3, y: 0 }], speed: 3.4 },
    rows: [
      "                                                                                                    ",
      "       3     3     3     3     33    3     3     44 3  3     33    3 T3  3     3     3     33       ",
      "                33            ####              #####       ####   ######   33            ####      ",
      "      33       ####           33    33                                     ####         3663        ",
      "     ####            33      ##### ####       44 3                55             33     #####       ",
      "         33         ####                3333 #####               #####          ####                ",
      "        #####            33 3           ####           3333                          3333           ",
      "                        #####              3333        ####     55 3                 ####  D        ",
      "      33                                   #####               #####                                ",
      "#############################################^^######^^#############################################",
    ],
  },
  {
    name: "Deep Water",
    theme: { frame: 'blue', platform: 'purple' },
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 30, y: 4 }, kind: 'saucer', phase: 0.0 },
      { at: { x: 55, y: 3 }, kind: 'saucer', phase: 0.5 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 3 }], speed: 4.0 },
    rows: [
      "                                                                                                    ",
      "                                                                    T                               ",
      "                                                                  ######                            ",
      "                                                                                                    ",
      "                     553                                                 J              #####       ",
      "        J            6633                                              #####                        ",
      "       #####          6635                                                                          ",
      "                      3445                                                                    D     ",
      "     33    33          344                                    #####                                 ",
      "####################^^^^^^^^^^^^^^^^^^^^~~~~~~~~~~~~~~~~~~~~####^^^^^^^^^^^^########################",
    ],
  },
  {
    name: "Crossfire",
    theme: { frame: 'purple', platform: 'blue' },
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 24, y: 6 }, kind: 'orb', phase: 0.0 },
      { at: { x: 48, y: 8 }, kind: 'spider', phase: 0.4 },
      { at: { x: 70, y: 8 }, kind: 'orb', phase: 0.7 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], speed: 3.6 },
    rows: [
      "                                                                                                    ",
      "             3     3 33  3     3           3 !   3  !  3     3     3 T3  3                          ",
      "      33            ####            33                             ######      3####                ",
      "     ####                          ####                3333                      33     #####       ",
      "                            3333        3333       44  ####        3553              3  3663        ",
      "         G3                 #####       ####      #####      33    #####                            ",
      "        #####   33                                          ####            33              D       ",
      "               ####     33                 3443                55          ####                     ",
      "      33               #####               #####              #####                                 ",
      "#############################~~##################~~##############^^######^^#########################",
    ],
  },
  {
    name: "Clyde's Own Room",
    theme: { frame: 'purple', platform: 'red' },
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 23, y: 7 }, kind: 'spider', phase: 0.0 },
      { at: { x: 44, y: 6 }, kind: 'saucer', phase: 0.25 },
      { at: { x: 65, y: 8 }, kind: 'orb', phase: 0.5 },
      { at: { x: 86, y: 8 }, kind: 'spider', phase: 0.75 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: -2 }, { x: 0, y: -2 }], speed: 4.0 },
    rows: [
      "                                                                                                    ",
      "   !      !     !       !    !    !                            !     !      !         !      !      ",
      "                                                                     T                              ",
      "                                            66                     ######                           ",
      "                             33    J          6#####                                    #####       ",
      "         G                  #####  #####     55                                                     ",
      "        #####                                44                    #####                            ",
      "                        33                   44                                            D        ",
      "     33    33          #####                55                                                      ",
      "######################^^^^##^^^^##^^^^##~~~~~~~~~~~~~~~~~~~~####~~~~~~~~####^^^^####################",
    ],
  }
]

/** The level for a given number, counting from one, clamped to what exists. */
export function levelFor(number: number): Level {
  return LEVELS[Math.min(LEVELS.length, Math.max(1, number)) - 1]
}
