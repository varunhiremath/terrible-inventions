import { describe, expect, it } from 'vitest'
import { createPacer } from './pacing'

const FIXED = 1 / 120
/** A world that is nothing but a position moving at a steady pace. */
const SPEED = 6
const step = (x: number) => x + SPEED * FIXED

/**
 * Plays a sequence of frame durations and reports where each frame drew.
 */
function play(frames: number[]) {
  const pacer = createPacer<number>(FIXED, 0.25)
  let state = 0
  const drawn: number[] = []
  for (const elapsed of frames) {
    const frame = pacer.advance(state, elapsed, step)
    state = frame.next
    drawn.push(frame.previous + (frame.next - frame.previous) * frame.alpha)
  }
  return drawn
}

/**
 * The biggest and smallest step between consecutive drawn positions, once it
 * is running.
 *
 * The opening frames are skipped on purpose: until a whole slice of real time
 * has gone by there is no earlier state to draw from, so the first frame or
 * two sit still. That is honest rather than jerky — there is nothing else they
 * could show — and it is over before anybody has looked at the screen.
 */
function spread(drawn: number[], skip = 4) {
  const settled = drawn.slice(skip)
  const deltas = settled.slice(1).map((x, i) => x - settled[i])
  return { biggest: Math.max(...deltas), smallest: Math.min(...deltas) }
}

const repeat = (n: number, value: number) => Array.from({ length: n }, () => value)

describe('pacing a fixed simulation against a real screen', () => {
  it('draws evenly at sixty frames a second', () => {
    const { biggest, smallest } = spread(play(repeat(60, 1 / 60)))
    expect(biggest - smallest).toBeLessThan(1e-9)
  })

  it('draws evenly at a hundred and twenty frames a second', () => {
    const { biggest, smallest } = spread(play(repeat(120, 1 / 120)))
    expect(biggest - smallest).toBeLessThan(1e-9)
  })

  it('draws evenly at a hundred and forty-four', () => {
    const { biggest, smallest } = spread(play(repeat(144, 1 / 144)))
    expect(biggest - smallest).toBeLessThan(1e-4)
  })

  it('draws evenly at a hundred and sixty-five', () => {
    /*
     * The rate that actually catches it, and it took three goes to find one.
     *
     * The fault is drawing the newest state on a frame too short to take a
     * step. At sixty it never happens — two steps always fit in a frame. At a
     * hundred and twenty and a hundred and forty-four it happens, but the
     * leftover time lands back on zero exactly when it does, so the wrong
     * answer and the right one agree. Here they do not: with the pair of
     * states rebuilt each frame the drawn step swings by a quarter either way.
     */
    const { biggest, smallest } = spread(play(repeat(165, 1 / 165)))
    const even = SPEED / 165
    expect(biggest - smallest).toBeLessThan(even * 0.02)
  })

  it('draws evenly when every frame is shorter than a slice', () => {
    // Which is the whole family of cases the fault lives in.
    for (const fps of [130, 150, 165, 180, 200, 240]) {
      const { biggest, smallest } = spread(play(repeat(fps, 1 / fps)))
      const even = SPEED / fps
      expect(biggest - smallest, `at ${fps} frames a second`).toBeLessThan(even * 0.02)
    }
  })

  it('survives a frame rate that wobbles', () => {
    const wobbly = Array.from({ length: 200 }, (_, i) => (1 / 60) * (0.72 + ((i * 37) % 11) / 20))
    const drawn = play(wobbly)
    // Not perfectly even — the frames themselves are not — but each drawn step
    // has to be in proportion to the frame it belongs to.
    for (let i = 5; i < drawn.length; i++) {
      const expected = SPEED * wobbly[i]
      expect(drawn[i] - drawn[i - 1]).toBeCloseTo(expected, 6)
    }
  })

  it('keeps the drawn moment exactly one slice behind real time', () => {
    // Which is the whole claim: a lag nobody can see, rather than a varying
    // one that everybody can.
    const frames = repeat(90, 1 / 90)
    const drawn = play(frames)
    let realTime = 0
    frames.forEach((elapsed, i) => {
      realTime += elapsed
      if (i < 4) return
      expect(drawn[i]).toBeCloseTo(SPEED * (realTime - FIXED), 6)
    })
  })

  it('never draws ahead of the simulation', () => {
    const pacer = createPacer<number>(FIXED, 0.25)
    let state = 0
    for (let i = 0; i < 100; i++) {
      const frame = pacer.advance(state, 1 / 75, step)
      state = frame.next
      const drawnAt = frame.previous + (frame.next - frame.previous) * frame.alpha
      expect(drawnAt).toBeLessThanOrEqual(frame.next + 1e-9)
      expect(drawnAt).toBeGreaterThanOrEqual(frame.previous - 1e-9)
    }
  })

  it('refuses to spend more than its catch-up on one frame', () => {
    // A tab left in the background for a minute must not teleport everything
    // across the board when it comes back.
    const pacer = createPacer<number>(FIXED, 0.25)
    const frame = pacer.advance(0, 60, step)
    expect(frame.next).toBeLessThanOrEqual(SPEED * 0.25 + 1e-9)
  })

  it('takes a state that input has changed underneath it', () => {
    // Turning happens between frames, not inside a step, so the state handed in
    // is not always the state handed back last time.
    const pacer = createPacer<number>(FIXED, 0.25)
    let frame = pacer.advance(0, 1 / 60, step)
    frame = pacer.advance(frame.next + 100, 1 / 60, step)
    expect(frame.next).toBeGreaterThan(100)
  })

  it('forgets the past when it is told to', () => {
    const pacer = createPacer<number>(FIXED, 0.25)
    pacer.advance(0, 1 / 30, step)
    pacer.reset()
    const frame = pacer.advance(500, 0, step)
    expect(frame.previous).toBe(500)
    expect(frame.next).toBe(500)
    expect(frame.alpha).toBe(0)
  })

  it('ignores a clock that goes backwards', () => {
    const pacer = createPacer<number>(FIXED, 0.25)
    expect(() => pacer.advance(0, -5, step)).not.toThrow()
  })
})
