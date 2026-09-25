import { describe, expect, it } from 'vitest'
import { newPrince, tick, type Input } from './prince'
import type { Level } from './level'

/**
 * The down button, and hanging from a ledge.
 *
 * Every case in here is one somebody actually hit: "I just press the down
 * button a few times on any platform, I fall and I die." That was real, and it
 * was certain rather than occasional — the grip that stops the press which
 * lowers him also dropping him ran down on the clock rather than on the
 * button, so holding the button (the only way to lower yourself over an edge,
 * and the natural thing to do on a touchscreen) expired the grip after about a
 * second and then dropped him on the very press that was holding him there.
 *
 * Hanging is the one move in this game you make in order to *look* before you
 * commit. A hang you cannot hold is not a hang.
 */

const press = (keys: Partial<Input>): Input => ({
  left: false, right: false, up: false, down: false, shift: false, ...keys,
})

/** A wide floor with a long drop off the right-hand end, and a floor far below. */
const LEDGE: Level = {
  name: 'ledge',
  rows: [
    'XXXXXXXXXXXX',
    'X#######   X',
    'X          X',
    'X          X',
    'X##########X',
    'XXXXXXXXXXXX',
  ],
  start: { col: 3, row: 1, facing: 1 },
}

const hold = (level: Level, input: Input, frames: number, from = newPrince(level)) => {
  let p = from
  for (let i = 0; i < frames; i++) p = tick(p, level, input)
  return p
}

describe('the down button on solid ground', () => {
  it('crouches, and never once drops him', () => {
    // Standing in the middle of a floor with floor on both sides. There is
    // nothing here to climb down to and down must never mean anything but
    // crouch.
    const p = hold(LEDGE, press({ down: true }), 60)
    expect(p.dead).toBe(false)
    expect(p.row).toBe(1)
    expect(['crouch', 'stand']).toContain(p.action)
  })

  it('survives the button being jabbed over and over', () => {
    /*
     * The report, as nearly as it can be written down: press down a few times
     * on a platform and die. Twenty presses with a gap between them, standing
     * on solid floor, must leave him exactly where he started.
     */
    let p = newPrince(LEDGE)
    for (let i = 0; i < 20; i++) {
      p = hold(LEDGE, press({ down: true }), 4, p)
      p = hold(LEDGE, press({}), 4, p)
    }
    expect(p.dead).toBe(false)
    expect(p.row).toBe(1)
    expect(p.health).toBe(newPrince(LEDGE).health)
  })
})

describe('hanging from a ledge', () => {
  /** Backed up to the lip, facing away from the drop, which is how you do it. */
  const atLip = () => ({ ...newPrince(LEDGE), col: 7, row: 1, facing: -1 as const })

  it('lowers him over the edge when he backs onto it', () => {
    const p = hold(LEDGE, press({ down: true }), 12, atLip())
    expect(p.action).toBe('hang')
    expect(p.dead).toBe(false)
  })

  it('holds on for as long as the button is held', () => {
    /*
     * The bug. Ten seconds of holding: he used to let go after about one and
     * fall three floors onto the stone.
     */
    const p = hold(LEDGE, press({ down: true }), 150, atLip())
    expect(p.action).toBe('hang')
    expect(p.dead).toBe(false)
    expect(p.row).toBe(1)
  })

  it('lets go only when the button is released and pressed again', () => {
    let p = hold(LEDGE, press({ down: true }), 20, atLip())
    expect(p.action).toBe('hang')

    // Let the button up. Still hanging: releasing is not the same as dropping.
    p = hold(LEDGE, press({}), 10, p)
    expect(p.action).toBe('hang')

    // Now ask, and only now does he go.
    p = hold(LEDGE, press({ down: true }), 4, p)
    expect(p.action).not.toBe('hang')
  })

  it('climbs back up, which is the other half of the move', () => {
    let p = hold(LEDGE, press({ down: true }), 20, atLip())
    expect(p.action).toBe('hang')
    p = hold(LEDGE, press({ up: true }), 30, p)
    expect(p.dead).toBe(false)
    expect(p.row).toBe(1)
    expect(p.action).not.toBe('hang')
  })
})
