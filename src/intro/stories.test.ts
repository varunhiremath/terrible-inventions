import { describe, expect, it } from 'vitest'
import { SCENES } from './scenes'
import { STORIES, STORY_ORDER } from './stories'
import { totalSeconds } from './timeline'

/**
 * The stories, checked for the things that break them quietly.
 *
 * A scene name with a typo in it draws nothing at all and says nothing about
 * it: the cutscene plays through in silence over a black screen, which looks
 * like a loading bug rather than a missing picture.
 */
/** The scenes that are a real level being played. */
const LEVELS = ['maze', 'cave', 'dungeon', 'pipes']

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
    const controls = /touch|thumb|jump|button|hold|walk|step|point|run/i
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
