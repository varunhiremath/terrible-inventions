import { describe, expect, it } from 'vitest'
import { NOTHING_PRESSED, combine, keyAt, keyRadius, padHeight, padLayout, type Key } from './controls'

const W = 900
const H = 500
const plain = padLayout(W, H)
const armed = padLayout(W, H, { gun: true, jetpack: true })

const find = (keys: Key[], id: string) => keys.find((k) => k.id === id)!

describe('where the buttons are', () => {
  it('puts walking in the bottom left and jumping in the bottom right', () => {
    // Where thumbs already are when a tablet is held in two hands.
    expect(find(plain, 'left').cx).toBeLessThan(W / 3)
    expect(find(plain, 'right').cx).toBeLessThan(W / 2)
    expect(find(plain, 'up').cx).toBeGreaterThan((W * 2) / 3)
    for (const key of plain) expect(key.cy).toBeGreaterThan(H * 0.6)
  })

  it('keeps every button on the board', () => {
    for (const keys of [plain, armed]) {
      for (const key of keys) {
        expect(key.cx - key.r).toBeGreaterThanOrEqual(0)
        expect(key.cx + key.r).toBeLessThanOrEqual(W)
        expect(key.cy - key.r).toBeGreaterThanOrEqual(0)
        expect(key.cy + key.r).toBeLessThanOrEqual(H)
      }
    }
  })

  it('never overlaps two buttons', () => {
    for (let i = 0; i < armed.length; i++) {
      for (let j = i + 1; j < armed.length; j++) {
        const apart = Math.hypot(armed[i].cx - armed[j].cx, armed[i].cy - armed[j].cy)
        expect(apart).toBeGreaterThanOrEqual(armed[i].r + armed[j].r)
      }
    }
  })

  it('shows only three buttons until there is more to do', () => {
    // A button for a thing you have not got is a button that teaches nothing.
    expect(plain.map((k) => k.id).sort()).toEqual(['left', 'right', 'up'])
    expect(armed).toHaveLength(5)
  })

  it('asks for room rather than borrowing it', () => {
    /*
     * Drawn over the board, the walk-left button sits exactly where Dave
     * starts, and the first thing a player sees is a level with no Dave in it.
     * The strip has to be subtracted from the board's height before the board
     * is fitted.
     */
    const strip = padHeight(W, H)
    expect(strip).toBeGreaterThan(keyRadius(W, H) * 2)
    for (const key of padLayout(W, H)) {
      expect(key.cy - key.r).toBeGreaterThanOrEqual(H - strip)
    }
  })

  it('stays a thumb on a phone and does not become a plate on a desktop', () => {
    expect(padLayout(360, 200)[0].r).toBeGreaterThanOrEqual(26)
    expect(padLayout(2400, 1500)[0].r).toBeLessThanOrEqual(58)
  })

  it('survives a board with no size yet', () => {
    expect(() => padLayout(0, 0)).not.toThrow()
  })
})

describe('pressing them', () => {
  it('reads a touch in the middle of a button', () => {
    const up = find(plain, 'up')
    expect(keyAt(up.cx, up.cy, plain)).toBe('up')
  })

  it('reads a touch a little outside one, because thumbs are wide', () => {
    const left = find(plain, 'left')
    expect(keyAt(left.cx, left.cy + left.r * 1.15, plain)).toBe('left')
  })

  it('reads nothing in the middle of the board', () => {
    expect(keyAt(W / 2, H / 2, plain)).toBeNull()
  })

  it('takes the nearer button when two are close', () => {
    const left = find(plain, 'left')
    const right = find(plain, 'right')
    const between = (left.cx + right.cx) / 2
    expect(keyAt(between - 6, left.cy, plain)).toBe('left')
    expect(keyAt(between + 6, left.cy, plain)).toBe('right')
  })

  it('lets two thumbs walk and jump at once', () => {
    const left = find(plain, 'left')
    const up = find(plain, 'up')
    const pressed = combine([keyAt(left.cx, left.cy, plain), keyAt(up.cx, up.cy, plain)])
    expect(pressed.left).toBe(true)
    expect(pressed.up).toBe(true)
    expect(pressed.right).toBe(false)
  })

  it('asks for nothing when nothing is touching', () => {
    expect(combine([])).toEqual(NOTHING_PRESSED)
    expect(combine([null, null])).toEqual(NOTHING_PRESSED)
  })

  it('reaches the fire button only once he has a gun', () => {
    const fire = find(armed, 'fire')
    expect(keyAt(fire.cx, fire.cy, armed)).toBe('fire')
    expect(keyAt(fire.cx, fire.cy, plain)).toBeNull()
  })
})
