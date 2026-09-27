import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TAUNTS, type TauntMoment } from './arcade/taunts'

/**
 * The tone of the thing.
 *
 * This game has one player and he is nine, and he got upset by a line that
 * read, in full: "Beaten by your own father! I am going to tell everyone!"
 * That line was written to be pantomime and it was received as a father
 * gloating, which is the only reading that counts.
 *
 * So the rule is written down here rather than only in a comment, because a
 * comment does not fail when somebody forgets it. {papa} is a pantomime
 * villain and is allowed to boast about himself endlessly — but never at the
 * player, never about the player, and above all never at the moment the
 * player has just lost.
 *
 * What this can and cannot check. It cannot judge whether a line is kind; a
 * person has to do that, and that is what the review in the commit was. What
 * it can do is catch the specific shapes that went wrong, so they cannot come
 * back in by accident: gloating at the flag, keeping score against him,
 * telling other people, and calling him anything.
 */

/** The moments where the player has just failed. The gentlest lines in here. */
const LOSING: TauntMoment[] = ['caught', 'gameOver']

const said = (moment: TauntMoment) => TAUNTS[moment].join('\n')

describe("{papa}'s lines when you lose", () => {
  it('never says he has won', () => {
    for (const moment of LOSING) {
      expect(said(moment), `${moment}`).not.toMatch(/\bI win\b|\bvictory\b|\bI beat\b|\bbeaten by\b/i)
    }
  })

  it('never threatens to tell anybody', () => {
    for (const moment of LOSING) {
      expect(said(moment), `${moment}`).not.toMatch(/tell (everyone|them|your|anybody|the)/i)
    }
  })

  it('never keeps score against him', () => {
    for (const moment of LOSING) {
      expect(said(moment), `${moment}`).not.toMatch(/scoreboard|that is one\b|\bI have a chart\b/i)
    }
  })

  it('always leaves a way back in', () => {
    /*
     * Every game-over line has to point at going again. Not as a rule of
     * style: the screen it appears on is the one somebody reads while feeling
     * bad about it, and the useful thing to put there is an invitation.
     */
    for (const line of TAUNTS.gameOver) {
      expect(line, `"${line}" does not offer another go`)
        .toMatch(/again|rematch|another|have a go|go on/i)
    }
  })
})

describe('the panels at the end of each game', () => {
  /*
   * Read out of the source rather than by rendering six screens. It is the
   * words that are being checked, and the words are right there.
   */
  const screens = [
    'src/screens/Arcade.tsx', 'src/screens/Dave.tsx', 'src/screens/Prince.tsx',
    'src/screens/Pipes.tsx', 'src/screens/Space.tsx', 'src/screens/Road.tsx',
  ]
  const prose = screens.map((f) => [f, readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')] as const)

  it('never gloats, wherever it is written', () => {
    for (const [file, text] of prose) {
      expect(text, file).not.toMatch(/I win\b|tell everyone|remains un-raided|my finest work/i)
    }
  })

  it('never sends him back to the start as a punishment', () => {
    for (const [file, text] of prose) {
      /*
       * "Back to the beginning with you" and its friends.
       *
       * Note what is *not* banned: "Back on the road with you", which is the
       * same four words doing the opposite job — it hands the car back. The
       * first version of this test banned both and had to be told apart, which
       * is the whole difficulty with tone in one line of regex.
       */
      expect(text, file).not.toMatch(/back to the (beginning|start)[^']*with you/i)
      expect(text, file).not.toMatch(/I told you/i)
    }
  })
})
