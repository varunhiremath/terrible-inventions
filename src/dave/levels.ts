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
    start: { x: 2, y: 8 },
    rows: [
      "                                                                                                    ",
      "                                                                                                    ",
      "                                                                     T                              ",
      "                                              33                   ######                           ",
      "                                 22          #####                                                  ",
      "                                ####                           44                                   ",
      "         11                                             3     #####                     55          ",
      "        ####            22                            ####                             #####        ",
      "   1                   ####                                                44                 D     ",
      "#############################^^##############^^##########^^###################^^####################",
    ],
  },
  {
    name: "Over the Coals",
    start: { x: 2, y: 8 },
    rows: [
      "                                                                                                    ",
      "                                                                                                    ",
      "                             22                                 T                                   ",
      "                            #####                    33        #####                    55          ",
      "                                                    #####                              #####        ",
      "          11           2                                                  44                        ",
      "         #####        ####                    33                        #####                       ",
      "                                             #####                                          6       ",
      "   1                                                                                      D         ",
      "#######################^^######^^##############^^####################^^#########^^##################",
    ],
  },
  {
    name: "Wet Feet",
    start: { x: 2, y: 8 },
    rows: [
      "                                                                                                    ",
      "   !     !               !       !               !             !      !                             ",
      "                                                                    T                               ",
      "                                             33                   ######                 55         ",
      "                            22              #####                                       #####       ",
      "                           #####                               44                                   ",
      "        11                                          33        #####                                 ",
      "       #####                                       #####                                     D      ",
      "     1                                                                                              ",
      "#########################~~######~~#############~~###############~~######~~#########################",
    ],
  },
  {
    name: "First Flight",
    start: { x: 2, y: 8 },
    rows: [
      "                                              44                                                    ",
      "                                                                     T                              ",
      "                            22                      44             ######                           ",
      "                                                                                          66        ",
      "                          33               33                                            #####      ",
      "                                                                          J                         ",
      "        J               22                                              #####                       ",
      "       #####                                                                                   D    ",
      "     11                                                        55                                   ",
      "####################^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^########^^^^^^^^########################",
    ],
  },
  {
    name: "Armed",
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 34, y: 8 }, kind: 'spider', phase: 0.0 },
      { at: { x: 52, y: 8 }, kind: 'spider', phase: 0.5 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], speed: 3.0 },
    rows: [
      "                                                                                                    ",
      "                                                                                                    ",
      "                                                                     T                              ",
      "                                                                   ######                           ",
      "                                                 44                                     66          ",
      "                              22                #####             55                   #####        ",
      "         G                   #####                               #####                              ",
      "        #####                               33                                               D      ",
      "     11                 33                 #####                                                    ",
      "#################################################^^#################################################",
    ],
  },
  {
    name: "The Long Drop",
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
      "                                                                    T                               ",
      "                             22                                   ######                            ",
      "                            #####             33     33                                 66          ",
      "         G                                   ####   ####       44                      #####        ",
      "        #####                                                 #####                                 ",
      "                                                                                            D       ",
      "     11                                                                   55                        ",
      "#######################^^####^^####^^############~~######################^^#########################",
    ],
  },
  {
    name: "Up and Over",
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 26, y: 8 }, kind: 'spider', phase: 0.0 },
      { at: { x: 58, y: 8 }, kind: 'orb', phase: 0.5 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 0, y: -3 }, { x: 3, y: -3 }, { x: 3, y: 0 }], speed: 3.4 },
    rows: [
      "                                                                                                    ",
      "                                                 44                  T                              ",
      "                                                #####              ######                           ",
      "                              33                                                         66         ",
      "                             #####            44                  55                    #####       ",
      "         11                                  #####               #####                              ",
      "        #####            22                                                                         ",
      "                        #####               33                  55                         D        ",
      "      11                                   #####               #####                                ",
      "#############################################^^######^^#############################################",
    ],
  },
  {
    name: "Deep Water",
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 30, y: 4 }, kind: 'saucer', phase: 0.0 },
      { at: { x: 55, y: 3 }, kind: 'saucer', phase: 0.5 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 3 }], speed: 4.0 },
    rows: [
      "                        33                         55                                               ",
      "                                                                    T                               ",
      "                                 33         55                    ######                            ",
      "                                                                                         66         ",
      "                         44                                              J              #####       ",
      "        J                                        66                    #####                        ",
      "       #####                                                                                        ",
      "                                44                             33                             D     ",
      "     11    22                                                 #####                                 ",
      "####################^^^^^^^^^^^^^^^^^^^^~~~~~~~~~~~~~~~~~~~~####^^^^^^^^^^^^########################",
    ],
  },
  {
    name: "Crossfire",
    start: { x: 2, y: 8 },
    monsters: [
      { at: { x: 24, y: 6 }, kind: 'orb', phase: 0.0 },
      { at: { x: 48, y: 8 }, kind: 'spider', phase: 0.4 },
      { at: { x: 70, y: 8 }, kind: 'orb', phase: 0.7 },
    ],
    path: { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], speed: 3.6 },
    rows: [
      "                                                                                                    ",
      "                                             !      !                T                              ",
      "                                                                   ######                66         ",
      "                                                                                        #####       ",
      "                             22                    44               55                              ",
      "         G                  #####                 #####            #####                            ",
      "        #####                                                                               D       ",
      "                        33                  44                 55                                   ",
      "      11               #####               #####              #####                                 ",
      "#############################~~##################~~##############^^######^^#########################",
    ],
  },
  {
    name: "Clyde's Own Room",
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
      "                                                66                 ######                66         ",
      "                             33    J           #####                                    #####       ",
      "         G                  #####  #####                            55                              ",
      "        #####                                 44                   #####                            ",
      "                        33                          44                                     D        ",
      "     11    22          #####                                   55                                   ",
      "######################^^^^##^^^^##^^^^##~~~~~~~~~~~~~~~~~~~~####~~~~~~~~####^^^^####################",
    ],
  }
]

/** The level for a given number, counting from one, clamped to what exists. */
export function levelFor(number: number): Level {
  return LEVELS[Math.min(LEVELS.length, Math.max(1, number)) - 1]
}
