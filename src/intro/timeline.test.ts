import { describe, expect, it } from 'vitest'
import { beatAt, beatStart, totalSeconds, type Story } from './timeline'

const STORY: Story = {
  id: 'test',
  title: 'Test',
  beats: [
    { seconds: 2, line: 'one', voice: 'narrator', scene: 'a' },
    { seconds: 3, line: 'two', voice: 'papa', scene: 'b' },
    { seconds: 1, line: 'three', voice: 'narrator', scene: 'c' },
  ],
}

describe('a story', () => {
  it('adds up to its beats', () => {
    expect(totalSeconds(STORY)).toBe(6)
  })

  it('knows which beat a moment belongs to', () => {
    expect(beatAt(STORY, 0).beat.line).toBe('one')
    expect(beatAt(STORY, 1.9).beat.line).toBe('one')
    expect(beatAt(STORY, 2).beat.line).toBe('two')
    expect(beatAt(STORY, 4.9).beat.line).toBe('two')
    expect(beatAt(STORY, 5).beat.line).toBe('three')
  })

  it('measures how far through a beat it is', () => {
    expect(beatAt(STORY, 0).t).toBe(0)
    expect(beatAt(STORY, 1).t).toBeCloseTo(0.5, 6)
    expect(beatAt(STORY, 3.5).t).toBeCloseTo(0.5, 6)
  })

  it('holds the last beat rather than running off the end', () => {
    // The player needs something to draw while it fades out, and an index past
    // the end is a blank screen with nothing to explain it.
    const over = beatAt(STORY, 99)
    expect(over.beat.line).toBe('three')
    expect(over.t).toBe(1)
    expect(over.done).toBe(true)
  })

  it('is not done until every beat has had its time', () => {
    // The last line getting cut off is the easy mistake here, and it is
    // invisible unless you sit through the whole thing.
    expect(beatAt(STORY, 5.5).done).toBe(false)
    expect(beatAt(STORY, 5.99).done).toBe(false)
    expect(beatAt(STORY, 6).done).toBe(true)
  })

  it('survives a negative clock', () => {
    expect(beatAt(STORY, -1).index).toBe(0)
    expect(beatAt(STORY, -1).t).toBe(0)
  })

  it('says where each beat starts, for skipping ahead', () => {
    expect(beatStart(STORY, 0)).toBe(0)
    expect(beatStart(STORY, 1)).toBe(2)
    expect(beatStart(STORY, 2)).toBe(5)
    // And skipping to a beat lands on that beat, which is the whole point.
    expect(beatAt(STORY, beatStart(STORY, 2)).beat.line).toBe('three')
  })

  it('refuses a story with nothing in it', () => {
    expect(() => beatAt({ id: 'empty', title: '', beats: [] }, 0)).toThrow()
  })
})
