import { describe, expect, it } from 'vitest'
import {
  TRACKS, eighthSeconds, heatGain, loopLength, readPart, type Part, type Track, type TrackName,
} from './score'

/**
 * The heat.
 *
 * One number a game raises as things get worse, which brings in extra voices,
 * swaps the drums and nudges the tempo. Worth testing because every way it can
 * go wrong is silent: a voice whose gain never reaches 1 is just quiet, a
 * track whose bar count changes with the heat drifts out of phase with its own
 * bass line over half a minute, and neither throws anything.
 */

const names = Object.keys(TRACKS) as TrackName[]
const hot = (t: Track) => t.parts.filter((p) => p.from !== undefined)
const pitchClass = (hz: number) => Math.round(12 * Math.log2(hz / 440) + 69) % 12
const notesIn = (parts: Part[]) => parts.flatMap((p) => readPart(p.pattern))

describe('heatGain', () => {
  it('leaves a voice with no threshold alone at every heat', () => {
    const plain: Part = { wave: 'pulse', gain: 0.1, pattern: 'A4' }
    for (const heat of [0, 0.3, 0.7, 1]) expect(heatGain(plain, heat)).toBe(1)
  })

  it('holds a voice silent until its heat', () => {
    const late: Part = { wave: 'pulse', gain: 0.1, pattern: 'A4', from: 0.5 }
    expect(heatGain(late, 0)).toBe(0)
    expect(heatGain(late, 0.5)).toBe(0)
    expect(heatGain(late, 0.51)).toBeGreaterThan(0)
  })

  it('fades it in rather than switching it on', () => {
    // A voice appearing at full volume between one bar and the next is heard
    // as a fault. It has to arrive over a few bars.
    const late: Part = { wave: 'pulse', gain: 0.1, pattern: 'A4', from: 0.5 }
    const partway = heatGain(late, 0.55)
    expect(partway).toBeGreaterThan(0)
    expect(partway).toBeLessThan(1)
  })

  it('reaches full volume well before the top of the range', () => {
    // A voice that is still fading in at heat 1 never plays as written.
    const late: Part = { wave: 'pulse', gain: 0.1, pattern: 'A4', from: 0.7 }
    expect(heatGain(late, 1)).toBe(1)
  })
})

describe('the tempo', () => {
  it('is unchanged when nothing is heated', () => {
    for (const name of names) {
      expect(eighthSeconds(TRACKS[name], 0), name).toBe(eighthSeconds(TRACKS[name]))
    }
  })

  it('only ever hurries, and only a little', () => {
    for (const name of names) {
      const track = TRACKS[name]
      const cold = eighthSeconds(track, 0)
      const blazing = eighthSeconds(track, 1)
      expect(blazing, name).toBeLessThanOrEqual(cold)
      // Beyond about a sixth and it stops being the same tune under pressure
      // and starts being a novelty record.
      expect(cold / blazing, name).toBeLessThan(1.18)
    }
  })

  it('clamps, so a game that miscounts cannot run the music away', () => {
    for (const name of names) {
      expect(eighthSeconds(TRACKS[name], 40), name).toBe(eighthSeconds(TRACKS[name], 1))
      expect(eighthSeconds(TRACKS[name], -5), name).toBe(eighthSeconds(TRACKS[name], 0))
    }
  })
})

describe('the loops that heat up', () => {
  const heated = names.filter((n) => hot(TRACKS[n]).length > 0)

  it('covers every game that has a loop running under it', () => {
    // The thinking track is the exception and is meant to be: it plays while a
    // question is on screen and is supposed to sit still.
    expect(heated.sort()).toEqual(['cavern', 'chase', 'pipes', 'road', 'space'])
  })

  it('keeps the same number of bars at every heat', () => {
    /*
     * The bar count is worked out over every part, silent ones included, so a
     * voice arriving cannot shorten or lengthen the loop. If it could, the
     * tune would step out of phase with its own bass the moment things got
     * difficult, which is both the worst possible time and the hardest to
     * notice in a test that only checks heat 0.
     */
    for (const name of heated) {
      const track = TRACKS[name]
      const full = loopLength(track)
      const cold = loopLength({ ...track, parts: track.parts.filter((p) => p.from === undefined) })
      expect(cold, name).toBe(full)
    }
  })

  it('brings the extra voices in over the range rather than all at once', () => {
    for (const name of heated) {
      const thresholds = hot(TRACKS[name]).map((p) => p.from ?? 0)
      expect(Math.min(...thresholds), name).toBeGreaterThan(0.2)
      expect(Math.max(...thresholds), name).toBeLessThan(0.8)
      // Two voices arriving together is one louder voice, not an escalation.
      expect(new Set(thresholds).size, name).toBe(thresholds.length)
    }
  })

  it('builds the extra voices from the notes the tune is already using', () => {
    /*
     * A tension voice is meant to sour the key, not leave it. Every heated
     * part is checked against the pitches its own track already plays, which
     * catches the one mistake that matters here — a note from another key
     * that sounds fine on its own and wrong over the tune.
     */
    for (const name of heated) {
      const track = TRACKS[name]
      const home = new Set(
        notesIn(track.parts.filter((p) => p.from === undefined)).map((n) => pitchClass(n.frequency)),
      )
      for (const part of hot(track)) {
        for (const note of readPart(part.pattern)) {
          expect([...home], `${name}: ${note.frequency.toFixed(1)}Hz`)
            .toContain(pitchClass(note.frequency))
        }
      }
    }
  })

  it('keeps the extra voices under the tune they are heating', () => {
    for (const name of heated) {
      const track = TRACKS[name]
      const loudest = Math.max(...track.parts.filter((p) => p.from === undefined).map((p) => p.gain))
      for (const part of hot(track)) expect(part.gain, name).toBeLessThan(loudest)
    }
  })

  it('leaves headroom once every voice is playing', () => {
    // The existing headroom test reads the track as written. At full heat
    // there are two more voices in it, which is when it would actually clip.
    for (const name of heated) {
      const total = TRACKS[name].parts.reduce((sum, p) => sum + p.gain, 0)
      expect(total, name).toBeLessThan(0.85)
    }
  })

  it('gives the caves their drums only once the timer is against you', () => {
    // The caves are a slow errand and the pipes are a run, and the drum is
    // most of what says so. It stays out until things are going badly.
    expect(TRACKS.cavern.drums).toBeUndefined()
    expect(TRACKS.cavern.hotDrums).toBeDefined()
  })

  it('lines a hot drum pattern up with the loop it replaces', () => {
    for (const name of names) {
      const track = TRACKS[name]
      if (!track.hotDrums) continue
      const beats = track.hotDrums.trim().split(/\s+/).length
      expect(beats, name).toBe(loopLength(track))
    }
  })
})
