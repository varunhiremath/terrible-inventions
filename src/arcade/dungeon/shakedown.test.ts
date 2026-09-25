import { describe, expect, it } from 'vitest'
import { newPrince, tick, type Input } from './prince'
import { LEVELS } from './levels'

/**
 * A sweep of every floor, pressing every button.
 *
 * This exists because of one sentence: "it still behaves weird in so many
 * places that it's getting hard to report." That is a fair complaint and the
 * answer to it is not to wait for better reports. It is to press the buttons
 * here, on every level, and find the weirdness first.
 *
 * What it checks is deliberately blunt, because blunt is what survives: no
 * single thing a player can do at the start of a floor should kill them. A
 * game may be hard. It may not be arbitrary — and dying for touching a button
 * once, having moved nowhere, is arbitrary.
 */

const press = (keys: Partial<Input>): Input => ({
  left: false, right: false, up: false, down: false, shift: false, ...keys,
})

/**
 * Buttons that do not take him anywhere.
 *
 * These are the ones where dying is never the right answer: he has not moved,
 * so nothing he did can have earned it.
 *
 * Left and right are deliberately not in here. Holding right for five seconds
 * can walk you off a ledge, and it should — that is the game, not a fault, and
 * a test that forbids it would be a test demanding the game be safe.
 */
const STANDING_STILL: { name: string; input: Input }[] = [
  { name: 'down', input: press({ down: true }) },
  { name: 'up', input: press({ up: true }) },
  { name: 'careful', input: press({ shift: true }) },
]

describe('holding a button that goes nowhere', () => {
  for (const level of LEVELS) {
    for (const button of STANDING_STILL) {
      it(`${level.name}: ${button.name} does not kill him`, () => {
        let prince = newPrince(level)
        // Five seconds of it. Long enough for anything on a timer to fire.
        for (let i = 0; i < 75; i++) prince = tick(prince, level, button.input)
        expect(prince.dead, `${button.name} killed him on ${level.name}`).toBe(false)
        expect(prince.row, 'he left the level entirely').toBeLessThan(level.rows.length)
      })
    }
  }
})

describe('the first half second of a floor', () => {
  /*
   * Walking off a ledge is fair. Doing it before the player has had time to
   * see the room is not — wherever a floor drops you, it has to give you a
   * moment on solid ground first.
   */
  for (const level of LEVELS) {
    for (const [name, input] of [
      ['walking forward', press({ right: true })],
      ['walking back', press({ left: true })],
    ] as const) {
      it(`${level.name}: ${name} is survivable for half a second`, () => {
        let prince = newPrince(level)
        for (let i = 0; i < 8; i++) prince = tick(prince, level, input)
        expect(prince.dead, `${name} killed him instantly on ${level.name}`).toBe(false)
      })
    }
  }
})

describe('jabbing a button at the start of a floor', () => {
  /*
   * Held and jabbed are different inputs and they go down different paths:
   * holding is one press that never ends, jabbing is a string of fresh presses
   * with gaps. The reported death came from the second kind.
   */
  for (const level of LEVELS) {
    it(`${level.name}: twenty jabs of down does not kill him`, () => {
      let prince = newPrince(level)
      for (let i = 0; i < 20; i++) {
        for (let f = 0; f < 4; f++) prince = tick(prince, level, press({ down: true }))
        for (let f = 0; f < 4; f++) prince = tick(prince, level, press({}))
      }
      expect(prince.dead, `jabbing down killed him on ${level.name}`).toBe(false)
    })
  }
})

describe('standing still', () => {
  it('never kills him on any floor', () => {
    // The baseline. If this ever fails, something is happening on its own.
    for (const level of LEVELS) {
      let prince = newPrince(level)
      for (let i = 0; i < 150; i++) prince = tick(prince, level, press({}))
      expect(prince.dead, `${level.name} killed him while he stood still`).toBe(false)
    }
  })
})
