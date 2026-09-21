import { describe, expect, it } from 'vitest'
import { CUES, eighthSeconds, loopLength, noteFrequency, readPart, type CueName } from './score'

/**
 * The cues.
 *
 * Worth testing because of where they fail: a mistyped note name throws inside
 * the audio scheduler, the scheduler is wrapped in a try/catch so that a
 * refused audio context cannot take the game down with it, and the result is
 * that the cue is simply silent. No error, no sound, nothing to notice.
 */

const NAMES = Object.keys(CUES) as CueName[]

/**
 * Phrygian dominant on D — D Eb F# G A Bb C.
 *
 * The mode with a flattened second and a major third, so a step of three
 * semitones between them, which is the interval the ear hears as Persian. It
 * is what makes the cues sound like each other, so it is worth pinning: one
 * note from outside it is the single easiest way to make the set sound wrong
 * while every individual cue still sounds fine on its own.
 */
const SCALE = [2, 3, 6, 7, 9, 10, 0]

const pitchClass = (hz: number) => Math.round(12 * Math.log2(hz / 440) + 69) % 12

describe('the dungeon cues', () => {
  it('all have notes in them', () => {
    for (const name of NAMES) {
      const notes = CUES[name].parts.flatMap((p) => readPart(p.pattern))
      expect(notes.length, name).toBeGreaterThan(1)
      for (const note of notes) {
        expect(Number.isFinite(note.frequency), `${name} at ${note.at}`).toBe(true)
        expect(note.frequency, `${name} at ${note.at}`).toBeGreaterThan(20)
        expect(note.length, `${name} at ${note.at}`).toBeGreaterThan(0)
      }
    }
  })

  it('stay inside the one scale, so they sound like each other', () => {
    for (const name of NAMES) {
      for (const part of CUES[name].parts) {
        for (const note of readPart(part.pattern)) {
          expect(SCALE, `${name}: ${note.frequency.toFixed(1)}Hz at eighth ${note.at}`)
            .toContain(pitchClass(note.frequency))
        }
      }
    }
  })

  const seconds = (name: CueName) => loopLength(CUES[name]) * eighthSeconds(CUES[name])

  it('are short enough to be cues rather than tunes', () => {
    // Anything much past this stops being a cue and starts being music playing
    // over the game, which is the thing the original deliberately did not do.
    for (const name of NAMES) {
      expect(seconds(name), name).toBeGreaterThan(0.3)
      expect(seconds(name), name).toBeLessThan(10)
    }
  })

  it('keeps the ones that fire mid-fight out of the way', () => {
    // A cue that answers something the player just did has to be over before
    // they have done the next thing. The openers are allowed to be longer,
    // because nothing is happening while they play.
    for (const name of ['danger', 'blade', 'potion', 'timer'] as CueName[]) {
      expect(seconds(name), name).toBeLessThan(3)
    }
  })

  it('are quiet enough to sit under a game', () => {
    for (const name of NAMES) {
      const total = CUES[name].parts.reduce((sum, p) => sum + p.gain, 0)
      expect(total, name).toBeLessThan(0.5)
    }
  })

  it('reads a written note the way the scale expects', () => {
    // The guard on the guard: if `noteFrequency` were wrong, the scale check
    // above would be comparing two wrong things and agreeing.
    expect(noteFrequency('A4')).toBeCloseTo(440, 6)
    expect(pitchClass(noteFrequency('D4'))).toBe(2)
    expect(pitchClass(noteFrequency('Eb4'))).toBe(3)
    expect(pitchClass(noteFrequency('F#4'))).toBe(6)
  })
})
