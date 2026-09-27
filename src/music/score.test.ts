import { describe, expect, it } from 'vitest'
import {
  CAVERN,
  CHASE,
  CUES,
  PIPES,
  REST_EVERY,
  ROAD,
  SPACE,
  THINKING,
  TRACKS,
  eighthSeconds,
  loopLength,
  noteFrequency,
  readPart,
  beatAt,
  restEighths,
  type Track,
} from './score'

describe('notes', () => {
  it('puts middle A where everyone else puts it', () => {
    expect(noteFrequency('A4')).toBeCloseTo(440, 6)
  })

  it('doubles every octave', () => {
    expect(noteFrequency('A5')).toBeCloseTo(880, 6)
    expect(noteFrequency('A3')).toBeCloseTo(220, 6)
  })

  it('knows its sharps and flats', () => {
    expect(noteFrequency('A#4')).toBeCloseTo(noteFrequency('Bb4'), 6)
    expect(noteFrequency('C5')).toBeCloseTo(noteFrequency('B#4'), 6)
  })

  it('gets the well-known ones right', () => {
    expect(noteFrequency('C4')).toBeCloseTo(261.626, 3)
    expect(noteFrequency('E2')).toBeCloseTo(82.407, 3)
  })

  it('refuses something that is not a note', () => {
    for (const bad of ['H4', 'A', '4A', '', 'A#', 'Z#9']) {
      expect(() => noteFrequency(bad)).toThrow()
    }
  })
})

describe('reading a part', () => {
  it('turns each token into an eighth note', () => {
    const notes = readPart('A4 B4 C5')
    expect(notes).toHaveLength(3)
    expect(notes.map((n) => n.at)).toEqual([0, 1, 2])
    expect(notes.every((n) => n.length === 1)).toBe(true)
  })

  it('folds a hold into the note it holds rather than restriking it', () => {
    // A restruck note is a stutter; this is the difference between a tune and
    // a machine gun.
    const notes = readPart('A4 . . . B4')
    expect(notes).toHaveLength(2)
    expect(notes[0]).toMatchObject({ at: 0, length: 4 })
    expect(notes[1]).toMatchObject({ at: 4, length: 1 })
  })

  it('leaves a gap where a rest is', () => {
    const notes = readPart('A4 - B4')
    expect(notes.map((n) => n.at)).toEqual([0, 2])
  })

  it('does not let a hold jump across a rest', () => {
    const notes = readPart('A4 - .')
    expect(notes).toHaveLength(1)
    expect(notes[0].length).toBe(1)
  })

  it('shrugs at a hold with nothing before it', () => {
    expect(() => readPart('. . A4')).not.toThrow()
    expect(readPart('. . A4')).toHaveLength(1)
  })

  it('does not mind how the spacing is laid out', () => {
    expect(readPart('  A4   B4  ')).toHaveLength(2)
  })
})

describe('the tracks', () => {
  const all: [string, Track][] = Object.entries(TRACKS)

  for (const [key, track] of all) {
    describe(key, () => {
      it('parses without a bad note in it', () => {
        for (const part of track.parts) expect(() => readPart(part.pattern)).not.toThrow()
      })

      it('lines every part up to the same length, so it loops cleanly', () => {
        // A part one eighth short drifts a little further out of time on every
        // pass round the loop, which sounds like the game is breaking.
        const lengths = track.parts.map(
          (p) => p.pattern.trim().split(/\s+/).filter(Boolean).length,
        )
        for (const length of lengths) expect(length).toBe(lengths[0])
        if (track.drums) {
          expect(track.drums.trim().split(/\s+/).filter(Boolean).length).toBe(lengths[0])
        }
      })

      it('runs in whole bars', () => {
        expect(loopLength(track) % 8).toBe(0)
      })

      it('loops long enough not to grate', () => {
        const seconds = loopLength(track) * eighthSeconds(track)
        expect(seconds).toBeGreaterThan(7)
      })

      it('stays in a range a small speaker can actually produce', () => {
        for (const part of track.parts) {
          for (const note of readPart(part.pattern)) {
            expect(note.frequency).toBeGreaterThan(60)
            expect(note.frequency).toBeLessThan(2100)
          }
        }
      })

      it('leaves headroom, so nothing clips', () => {
        const total = track.parts.reduce((sum, p) => sum + p.gain, 0)
        expect(total).toBeLessThan(0.8)
      })

      it('is quiet enough to talk over', () => {
        // Papa has to be audible above it; it is background music.
        for (const part of track.parts) expect(part.gain).toBeLessThan(0.35)
      })
    })
  }

  it('makes the thinking music calmer than the chase', () => {
    expect(TRACKS.thinking.beatsPerMinute).toBeLessThan(TRACKS.chase.beatsPerMinute)
    expect(TRACKS.thinking.drums).toBeUndefined()
  })

  it('gives each game a tune of its own', () => {
    // Dave spent a while borrowing the maze's music, and two quite different
    // games sounded like one game with two skins.
    const tunes = Object.values(TRACKS).map((t) => t.parts[0].pattern)
    expect(new Set(tunes).size).toBe(tunes.length)
  })

  it('leaves the caves quieter and slower than the pipes', () => {
    // One game is about going somewhere, the other about not falling in a
    // hole, and they should not feel like the same errand.
    expect(TRACKS.cavern.beatsPerMinute).toBeLessThan(TRACKS.pipes.beatsPerMinute)
    expect(TRACKS.cavern.drums).toBeUndefined()
    expect(TRACKS.pipes.drums).toBeDefined()
  })
})

/**
 * The voices.
 *
 * These settings are the difference between something that sounds like a chip
 * and something that sounds like a signal generator, and every one of them
 * fails silently: a duty cycle of 0 is a wave with no sound in it at all, and
 * an arpeggio of one note is just a note.
 */
describe('how the parts are played', () => {
  const everyPart = [
    ...Object.entries(TRACKS).flatMap(([name, track]) =>
      track.parts.map((part) => [name, part] as const),
    ),
    ...Object.entries(CUES).flatMap(([name, cue]) => cue.parts.map((part) => [name, part] as const)),
  ]

  it('gives every pulse a usable width', () => {
    // At 0 or 1 a pulse is flat, and flat is silence.
    for (const [name, part] of everyPart) {
      if (part.wave !== 'pulse') continue
      expect(part.duty ?? 0.25, name).toBeGreaterThan(0.05)
      expect(part.duty ?? 0.25, name).toBeLessThan(0.95)
    }
  })

  it('only sets a width on a wave that has one', () => {
    for (const [name, part] of everyPart) {
      if (part.duty !== undefined) expect(part.wave, name).toBe('pulse')
    }
  })

  it('makes every arpeggio more than one note', () => {
    for (const [name, part] of everyPart) {
      if (!part.arp) continue
      expect(part.arp.length, name).toBeGreaterThan(1)
      // Flicking through notes slowly is not an arpeggio, it is a tune.
      expect(part.arpRate ?? 18, name).toBeGreaterThan(10)
    }
  })

  it('keeps vibrato to a waver rather than a siren', () => {
    for (const [name, part] of everyPart) {
      if (!part.vibrato) continue
      expect(part.vibrato.cents, name).toBeLessThan(60)
      expect(part.vibrato.hz, name).toBeGreaterThan(2)
      expect(part.vibrato.hz, name).toBeLessThan(9)
    }
  })

  it('actually uses the pulse waves it went to the trouble of building', () => {
    // The whole engine is pointless if every part is still a plain square.
    const pulses = everyPart.filter(([, part]) => part.wave === 'pulse')
    expect(pulses.length).toBeGreaterThan(6)
  })

  it('gives every tune played over a game a chord, one way or another', () => {
    // A melody and a bass with nothing between them sounds thin at any tempo.
    // The thinking music is the exception and stays two voices on purpose: it
    // plays while somebody is working something out, and the whole job of it
    // is to be ignorable.
    for (const [name, track] of Object.entries(TRACKS)) {
      if (name === 'thinking') continue
      const voices = track.parts.length
      const arps = track.parts.filter((p) => p.arp).length
      expect(voices + arps, name).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps the thinking music out of the way', () => {
    expect(TRACKS.thinking.parts.length).toBeLessThan(3)
    expect(TRACKS.thinking.parts.some((p) => p.arp)).toBe(false)
  })
})

/**
 * The gaps.
 *
 * A loop that never stops stops being music and becomes a room tone — after
 * the third time round nobody is listening, they are only slightly more tired
 * than they were. These check the gap exists, lands on a bar line, and is a
 * pause rather than an interruption.
 */
describe('room to breathe', () => {
  const LOOPS: Track[] = [CHASE, THINKING, PIPES, CAVERN, ROAD, SPACE]

  it('gives every tune somebody has to sit with a gap', () => {
    for (const track of LOOPS) {
      expect(restEighths(track), `${track.name} never stops`).toBeGreaterThan(0)
    }
  })

  it('stops for about three seconds, not one and not ten', () => {
    for (const track of LOOPS) {
      const seconds = restEighths(track) * eighthSeconds(track, 0)
      expect(seconds, `${track.name} rests for ${seconds.toFixed(1)}s`).toBeGreaterThan(1.5)
      expect(seconds, `${track.name} rests for ${seconds.toFixed(1)}s`).toBeLessThan(6)
    }
  })

  it('comes back on a bar line rather than wherever the seconds landed', () => {
    for (const track of LOOPS) {
      expect(restEighths(track) % 8, `${track.name} resumes mid-bar`).toBe(0)
    }
  })

  it('plays a good deal more than it rests', () => {
    for (const track of LOOPS) {
      const playing = loopLength(track) * (track.restEvery ?? REST_EVERY)
      expect(playing / restEighths(track), `${track.name} is mostly silence`)
        .toBeGreaterThan(3)
    }
  })
})

describe('the gap, beat by beat', () => {
  it('plays the loop right through, then stops, then picks up where it was', () => {
    const bars = loopLength(CHASE)
    const rest = restEighths(CHASE)
    const plays = bars * REST_EVERY

    // Every eighth of the playing part, in order, twice round.
    for (let i = 0; i < plays; i++) {
      expect(beatAt(CHASE, i), `eighth ${i}`).toBe(i % bars)
    }
    // Then nothing at all.
    for (let i = plays; i < plays + rest; i++) {
      expect(beatAt(CHASE, i), `eighth ${i} should be silent`).toBe(-1)
    }
    // And back to the top of the loop, not to wherever the clock had got to.
    expect(beatAt(CHASE, plays + rest)).toBe(0)
  })

  /*
   * There is deliberately nothing here about cues.
   *
   * The first version of this test asserted that a cue never rests, which is
   * both false — `restEighths` will happily give one a number — and beside the
   * point, because a cue is fired note by note by `playCue` and never goes
   * near the scheduler that reads `beatAt`. Testing it would have been testing
   * a property nothing relies on.
   */
})
