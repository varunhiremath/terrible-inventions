import { describe, expect, it } from 'vitest'
import { poseFor } from './draw'
import { LEAN, STOCKY, skeleton, type Build } from './figure'

/**
 * Which way the joints bend, and which way he is pointing.
 *
 * These are the things that were wrong and that nothing caught: elbows folded
 * backwards like a second pair of knees, and limbs that did not agree with the
 * direction he was facing. None of it is visible in a still frame unless you
 * know to look, and all of it is obvious in motion.
 *
 * The figure is built in a frame that has already been mirrored by its facing,
 * so forward is always +x here and every one of these holds for both
 * directions at once.
 */

const BUILDS: [string, Build][] = [['stocky', STOCKY], ['lean', LEAN]]
const ACTIONS = ['stand', 'run', 'startRun', 'stopRun', 'step', 'standJump', 'runJump',
  'fall', 'land', 'hardLand', 'hang', 'climbUp', 'crouch', 'turn', 'drinking']
const STANCES = ['none', 'ready', 'strike', 'parry', 'hurt', 'advance', 'retreat']

describe('joints', () => {
  it('folds elbows forwards, the way an elbow folds', () => {
    // Upper arm hanging straight down, forearm folded: the hand has to end up
    // in front of the elbow. Bent the other way it is a knee.
    for (const [name, build] of BUILDS) {
      const pose = { ...poseFor('stand', 0, 'none'), lean: 0, armSword: 0, elbowSword: 1, armFree: 0, elbowFree: 1 }
      const j = skeleton(pose, 100, build)
      expect(j.near.hand.x, `${name} sword arm`).toBeGreaterThan(j.near.elbow.x)
      expect(j.far.hand.x, `${name} free arm`).toBeGreaterThan(j.far.elbow.x)
    }
  })

  it('folds knees backwards, the way a knee folds', () => {
    for (const [name, build] of BUILDS) {
      const pose = { ...poseFor('stand', 0, 'none'), lean: 0, legFront: 0, kneeFront: 1, legBack: 0, kneeBack: 1 }
      const j = skeleton(pose, 100, build)
      expect(j.near.ankle.x, `${name} near leg`).toBeLessThan(j.near.knee.x)
      expect(j.far.ankle.x, `${name} far leg`).toBeLessThan(j.far.knee.x)
    }
  })

  it('never lets a joint come apart from the one above it', () => {
    // Every segment has to stay its own length, whatever the pose asks for.
    for (const [, build] of BUILDS) {
      for (const action of ACTIONS) {
        for (const stance of STANCES) {
          const j = skeleton(poseFor(action, 2, stance), 100, build)
          const span = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
          for (const side of [j.near, j.far]) {
            expect(span(side.hip, side.knee)).toBeGreaterThan(0)
            expect(span(side.shoulder, side.elbow)).toBeGreaterThan(0)
            expect(Number.isFinite(side.hand.x)).toBe(true)
            expect(Number.isFinite(side.ankle.y)).toBe(true)
          }
        }
      }
    }
  })

  it('keeps him the right way up and on the floor', () => {
    for (const [, build] of BUILDS) {
      for (const action of ACTIONS) {
        const j = skeleton(poseFor(action, 2, 'none'), 100, build)
        // Feet at or near the ground, head above the hips, hips above the feet.
        expect(j.shoulder.y, action).toBeLessThan(j.hip.y)
        expect(j.neck.y, action).toBeLessThan(j.shoulder.y)
        const lowest = Math.max(j.near.ankle.y, j.far.ankle.y)
        expect(lowest, action).toBeGreaterThan(j.hip.y)
      }
    }
  })

  it('swings an arm against the leg on its own side, all through a run', () => {
    // Opposite arm to leg is most of what makes a run read as one. If the near
    // arm ever swings with the near leg he is skipping, not running.
    for (let frame = 0; frame < 4; frame++) {
      const pose = poseFor('run', frame, 'none')
      const near = pose.legFront
      const far = pose.legBack
      expect(Math.sign(pose.armSword), `frame ${frame}`).toBe(Math.sign(far))
      expect(Math.sign(pose.armFree), `frame ${frame}`).toBe(Math.sign(near))
    }
  })

  it('points the sword hand forward whenever the blade is out', () => {
    for (const stance of ['ready', 'strike', 'advance', 'retreat']) {
      const pose = poseFor('stand', 2, stance)
      const j = skeleton(pose, 100, STOCKY)
      expect(j.near.hand.x, stance).toBeGreaterThan(j.hip.x)
    }
  })
})
