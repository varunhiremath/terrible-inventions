import { describe, expect, it } from 'vitest'
import { poseFor, ROBES, STONE } from './draw'

/**
 * These check the two things about the drawing code that fail silently.
 *
 * A NaN anywhere in a pose reaches the canvas as a transform, and a canvas
 * given a NaN transform draws nothing at all and says nothing about it: the
 * figure simply is not there. A missing palette entry is the same story one
 * step earlier — `undefined` as a fill style is ignored, and the stone stays
 * whatever colour was set last.
 */

const ACTIONS = [
  'stand', 'run', 'startRun', 'stopRun', 'step', 'standJump', 'runJump', 'fall',
  'land', 'hardLand', 'hang', 'climbUp', 'crouch', 'turn', 'drinking', 'dead',
]
const STANCES = ['none', 'ready', 'strike', 'parry', 'hurt', 'advance', 'retreat', 'dead']

describe('poses', () => {
  it('are finite numbers for every action, stance and frame', () => {
    for (const action of ACTIONS) {
      for (const stance of STANCES) {
        for (let frame = 0; frame < 16; frame++) {
          const pose = poseFor(action, frame, stance)
          for (const [key, value] of Object.entries(pose)) {
            expect(Number.isFinite(value), `${action}/${stance}/${frame}: ${key} is ${value}`).toBe(true)
          }
        }
      }
    }
  })

  it('keep the figure inside something like a human range', () => {
    for (const action of ACTIONS) {
      for (const stance of STANCES) {
        const pose = poseFor(action, stance === 'none' ? 2 : 2, stance)
        // Half a turn in any joint means a limb has gone through the body.
        expect(Math.abs(pose.lean)).toBeLessThan(Math.PI / 2)
        expect(Math.abs(pose.legFront)).toBeLessThan(Math.PI / 2)
        expect(Math.abs(pose.legBack)).toBeLessThan(Math.PI / 2)
        expect(pose.kneeFront).toBeGreaterThanOrEqual(0)
        expect(pose.kneeBack).toBeGreaterThanOrEqual(0)
        expect(pose.crouch).toBeGreaterThanOrEqual(0)
        expect(pose.crouch).toBeLessThanOrEqual(1)
        expect(pose.twist).toBeGreaterThanOrEqual(0)
        expect(pose.twist).toBeLessThan(1)
      }
    }
  })

  it('draw a blade whenever a sword is in hand, and never otherwise', () => {
    for (const stance of ['ready', 'strike', 'parry', 'hurt', 'advance', 'retreat']) {
      expect(poseFor('stand', 0, stance).blade, stance).toBeGreaterThan(0)
    }
    expect(poseFor('run', 1, 'none').blade).toBe(0)
  })

  it('lay the dead flat, whichever way round the news arrives', () => {
    expect(poseFor('dead', 0, 'none').flat).toBe(1)
    expect(poseFor('stand', 0, 'dead').flat).toBe(1)
  })
})

describe('palettes', () => {
  const HEX = /^#[0-9a-f]{6}$/i

  it('give every kind of stone every colour the room asks it for', () => {
    for (const [name, stone] of Object.entries(STONE)) {
      for (const key of ['face', 'joint', 'lit', 'shade', 'floor', 'back', 'backFace', 'backLit']) {
        expect(stone[key as keyof typeof stone], `${name}.${key}`).toMatch(HEX)
      }
    }
  })

  it('give every guard a full set of robes', () => {
    for (const [name, robe] of Object.entries(ROBES)) {
      for (const key of ['robe', 'legs', 'trim', 'skin']) {
        // Six hex digits, because the figure darkens these by arithmetic and
        // a three-digit shorthand would parse to the wrong colour entirely.
        expect(robe[key as keyof typeof robe], `${name}.${key}`).toMatch(HEX)
      }
    }
  })
})
