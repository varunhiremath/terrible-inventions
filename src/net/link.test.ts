import { describe, expect, it } from 'vitest'
import { makeCode, relayUrl } from './link'
import { between, blend, shareable } from './race'
import { newRun, step, NO_INPUT } from '../road/run'

/**
 * The line between two devices.
 *
 * Most of what this does can only be judged by opening two browsers, which
 * `scripts/together-check.mjs` does. What can be pinned down here is the
 * fiddly, silent part: what happens to an address somebody typed, and whether
 * the blend between two frames is actually a blend.
 */
describe('the relay address', () => {
  it('takes whatever anybody would reasonably type', () => {
    expect(relayUrl('ws://192.168.1.24:8787', 'ABCD')).toBe('ws://192.168.1.24:8787/ABCD')
    // The deploy prints https, so that is what gets pasted.
    expect(relayUrl('https://relay.example.workers.dev', 'ABCD'))
      .toBe('wss://relay.example.workers.dev/ABCD')
    expect(relayUrl('http://192.168.1.24:8787', 'ABCD')).toBe('ws://192.168.1.24:8787/ABCD')
    // And an address looks like an address, with no scheme on the front.
    expect(relayUrl('192.168.1.24:8787', 'ABCD')).toBe('ws://192.168.1.24:8787/ABCD')
    // A trailing slash off the end of a copied URL.
    expect(relayUrl('ws://192.168.1.24:8787/', 'ABCD')).toBe('ws://192.168.1.24:8787/ABCD')
    expect(relayUrl('   ', 'ABCD')).toBe(null)
  })

  it('upper-cases the code, because the relay does', () => {
    expect(relayUrl('ws://x:1', 'abcd')).toBe('ws://x:1/ABCD')
  })
})

describe('the room code', () => {
  it('is four characters a child can read out', () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[A-Z0-9]{4}$/)
  })

  it('has no vowels in it, so it cannot come out as a word', () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).not.toMatch(/[AEIOU]/)
  })
})

describe('what goes down the wire', () => {
  it('leaves behind the two parts that never travel', () => {
    const run = step(newRun(1, 3, 0, 1, { twoPlayer: true }), NO_INPUT, 1 / 60)
    const sent = shareable(run) as Record<string, unknown>
    expect('trail' in sent, 'the whole record of the drive went down the wire').toBe(false)
    expect('events' in sent, 'the host sent its own sound effects').toBe(false)
    // And keeps everything the other end has to draw.
    expect(sent.racers).toBeDefined()
    expect(sent.cars).toBeDefined()
    expect(sent.level).toBeDefined()
    expect(sent.grid).toBeDefined()
  })

  it('fits in a message worth sending twenty times a second', () => {
    // The sixth level, which has the most traffic and the biggest field.
    let run = newRun(6, 3, 0, 1, { twoPlayer: true })
    for (let t = 0; t < 20; t += 1 / 60) run = step(run, NO_INPUT, 1 / 60)
    const bytes = JSON.stringify(shareable(run)).length
    expect(bytes, `a frame costs ${bytes} bytes`).toBeLessThan(12_000)
  })
})

describe('blending two frames', () => {
  const twoFrames = () => {
    let run = newRun(1, 3, 0, 1, { twoPlayer: true })
    for (let t = 0; t < 4; t += 1 / 60) run = step(run, { ...NO_INPUT, go: true }, 1 / 60)
    const older = shareable(run)
    for (let t = 0; t < 0.05; t += 1 / 60) run = step(run, { ...NO_INPUT, go: true }, 1 / 60)
    return { older, newer: shareable(run) }
  }

  it('lands between the two, and on them at the ends', () => {
    const { older, newer } = twoFrames()
    expect(older.distance).toBeLessThan(newer.distance)

    expect(blend(older, newer, 0).distance).toBeCloseTo(older.distance, 6)
    expect(blend(older, newer, 1).distance).toBeCloseTo(newer.distance, 6)
    const half = blend(older, newer, 0.5).distance
    expect(half).toBeGreaterThan(older.distance)
    expect(half).toBeLessThan(newer.distance)
  })

  it('will not run off the end of the two it has', () => {
    const { older, newer } = twoFrames()
    // A frame can be late — the next one has not turned up and the clock has
    // run past where it should have been. Holding still beats flying off.
    expect(blend(older, newer, 4).distance).toBeCloseTo(newer.distance, 6)
    expect(blend(older, newer, -2).distance).toBeCloseTo(older.distance, 6)
  })

  it('moves the field as well as the player', () => {
    const { older, newer } = twoFrames()
    const id = newer.racers[0].id
    const from = older.racers.find((r) => r.id === id)!
    const to = newer.racers.find((r) => r.id === id)!
    const mid = blend(older, newer, 0.5).racers.find((r) => r.id === id)!
    expect(mid.y).toBeCloseTo(between(from.y, to.y, 0.5), 6)
  })

  it('does not lose a car that has only just appeared', () => {
    const { older, newer } = twoFrames()
    const fresh = { ...newer, cars: [...newer.cars, { ...newer.cars[0], id: 99999, y: 500 }] }
    const mid = blend(older, fresh, 0.5)
    expect(mid.cars.find((c) => c.id === 99999)?.y, 'a new car was dropped or moved').toBe(500)
  })
})
