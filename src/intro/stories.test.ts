import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { FOOTAGE_SECONDS, SCENES } from './scenes'
import { STORIES, STORY_ORDER } from './stories'
import { beatStart, totalSeconds } from './timeline'
import lengths from '../../public/spoken/index.json'

/**
 * The stories, checked for the things that break them quietly.
 *
 * A scene name with a typo in it draws nothing at all and says nothing about
 * it: the cutscene plays through in silence over a black screen, which looks
 * like a loading bug rather than a missing picture.
 */
/** The scenes that are a real level being played. */
const LEVELS = ['maze', 'cave', 'dungeon', 'pipes', 'road', 'space', 'deep', 'garden', 'wall', 'flood',
  'oneline', 'throughit', 'joined']

/**
 * How `scripts/render-voice.py` names a clip: the line as written, unfilled.
 *
 * Kept in step by hand, which is a risk — but the alternative is shipping the
 * hashing to the app, and the app never needs it. If this drifts, every lookup
 * misses and the check below quietly passes on nothing, so it also asserts
 * that it found most of them.
 */
function keyOf(voice: string, line: string): string {
  return createHash('sha1').update(`${voice}|${line}`).digest('hex').slice(0, 16)
}

describe('the stories', () => {
  it('has one for every game', () => {
    for (const id of STORY_ORDER) expect(STORIES[id], id).toBeDefined()
  })

  it('names only scenes that exist', () => {
    for (const story of Object.values(STORIES)) {
      for (const beat of story.beats) {
        expect(SCENES[beat.scene], `${story.id}: no scene called "${beat.scene}"`).toBeDefined()
      }
    }
  })

  it('gives every line long enough to be read and said', () => {
    // Roughly what speech costs, plus a moment to look at the picture. A line
    // that outruns its beat gets cut off mid-word by the next one.
    for (const story of Object.values(STORIES)) {
      for (const beat of story.beats) {
        const spoken = beat.line.split(/\s+/).length / 2.6
        expect(beat.seconds, `${story.id}: "${beat.line}"`).toBeGreaterThan(spoken)
      }
    }
  })

  it('gives every line long enough for the clip that was actually rendered', () => {
    /*
     * The rule above is an estimate — words over two and a half a second —
     * and it is wrong in the direction that matters. {papa} is read at a
     * different pace from the narrator and leans on his syllables, so his
     * lines come out longer than the arithmetic says. Four beats across three
     * stories were cutting their own clip off mid-word, and the estimate
     * passed all four.
     *
     * So this reads the lengths the renderer measured and wrote down. A line
     * with no clip is not a failure: anything missing falls back to the
     * phone's own synthesiser at runtime.
     */
    const clips = lengths as Record<string, number>
    let found = 0
    let beats = 0
    for (const story of Object.values(STORIES)) {
      for (const beat of story.beats) {
        beats++
        const clip = clips[keyOf(beat.voice, beat.line)]
        if (clip === undefined) continue
        found++
        expect(beat.seconds, `${story.id}: "${beat.line}" is a ${clip}s clip`)
          .toBeGreaterThanOrEqual(clip + 0.25)
      }
    }
    // And that it looked at anything at all. A check that keys its lookups by
    // a hash can pass by matching nothing, which is the failure mode of a flag
    // detector that searched for the wrong element and reported no flags.
    expect(found, `only matched ${found} of ${beats} beats to a clip`).toBeGreaterThan(beats * 0.9)
  })

  it('stays short enough that nobody has to sit through it', () => {
    for (const story of Object.values(STORIES)) {
      expect(totalSeconds(story), story.id).toBeLessThan(45)
      expect(totalSeconds(story), story.id).toBeGreaterThan(15)
    }
  })

  it('tells you how to play, which is the part usually left out', () => {
    // Every story has to name a control somewhere in it. An intro that sets up
    // a story and then drops you in with no idea which button does what is an
    // intro you skip.
    // `slide` and `tap` arrived with the two newest games, which are played
    // with one finger on the picture rather than with buttons.
    const controls = /touch|thumb|jump|button|hold|walk|step|point|run|slide|tap|drag/i
    for (const story of Object.values(STORIES)) {
      const said = story.beats.some((b) => controls.test(b.line))
      expect(said, `${story.id} never says how to play`).toBe(true)
    }
  })

  it('shows the game in every beat', () => {
    /*
     * There used to be a workshop scene with a villain looming in it and a
     * title card on a black plate, and the verdict on both was that it "still
     * looks dark and weird... just use snapshots from the game itself if
     * nothing else works". So every beat is a level now, bar the question card
     * — which earns its place by being the one thing in the app that is not in
     * a level.
     */
    for (const story of Object.values(STORIES)) {
      for (const beat of story.beats) {
        expect([...LEVELS, 'question'], `${story.id} shows ${beat.scene}`).toContain(beat.scene)
      }
    }
  })

  it('never outlasts the footage it is playing back', () => {
    /*
     * Three scenes are recordings — a race and two flights, flown once at
     * module load and read back by the clock. Past the end they hold the last
     * frame, which is a still photograph of a game and reads as a freeze. The
     * road story outran its recording by two seconds and the space story by
     * eight, and nothing anywhere said so.
     */
    for (const story of Object.values(STORIES)) {
      for (const [index, beat] of story.beats.entries()) {
        const have = FOOTAGE_SECONDS[beat.scene]
        if (have === undefined) continue
        const ends = beatStart(story, index) + beat.seconds
        expect(ends, `${story.id}: ${beat.scene} runs out ${(ends - have).toFixed(1)}s early`)
          .toBeLessThanOrEqual(have)
      }
    }
    /*
     * A generous limit, because whichever test asks first is the one that
     * grows the footage: the recordings are built on demand now, and the
     * garden's is a second of simulation. Asking for the default five on a
     * build machine slower than the one this was written on is how this turned
     * red having passed locally.
     */
  }, 30_000)

  it('lands its title over the game rather than a black plate', () => {
    // The title is drawn over the last beat instead of having a scene of its
    // own, so the last beat has to be a level for there to be anything behind
    // it.
    for (const story of Object.values(STORIES)) {
      const last = story.beats[story.beats.length - 1].scene
      expect(LEVELS, `${story.id} ends on ${last}`).toContain(last)
      expect(story.title.length, story.id).toBeGreaterThan(2)
    }
  })

  it('keeps the real name out of the repo', () => {
    // The villain is written as a placeholder and filled in on the device.
    for (const story of Object.values(STORIES)) {
      for (const beat of story.beats) {
        expect(beat.line).not.toMatch(/\bdad\b/i)
      }
    }
  })
})
