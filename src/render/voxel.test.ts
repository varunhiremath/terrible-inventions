import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildVoxel, disposeVoxel } from './voxel'

const SEEDS = [31337, 1, 2, 7, 4242, 99999]

/** The bounding box of a built body, in its own local space. */
function boundsOf(seed: number, flat: boolean) {
  const voxel = buildVoxel(seed, undefined, { flat })
  const box = new THREE.Box3().setFromObject(voxel.group)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  disposeVoxel(voxel)
  return { centre, size }
}

describe('building a body', () => {
  for (const flat of [false, true]) {
    describe(flat ? 'laid flat' : 'standing up', () => {
      it('is centred on its own origin', () => {
        /*
         * The holder rotates about its origin to face the way it is going. A
         * body built off-centre therefore swings around as it turns, and is
         * drawn somewhere other than the tile it is on — which is exactly the
         * bug this test was written for: three quarters of a tile out, in a
         * direction that changed as the character turned.
         */
        for (const seed of SEEDS) {
          const { centre, size } = boundsOf(seed, flat)
          // Generously within a tile: a sprite is not symmetric, so the
          // centre of its ink is not the centre of its grid.
          expect(Math.abs(centre.x)).toBeLessThan(0.3)
          expect(Math.abs(centre.y)).toBeLessThan(0.3)
          expect(Math.abs(centre.z)).toBeLessThan(0.3)
          expect(size.length()).toBeGreaterThan(0)
        }
      })

      it('stays about a tile across, whichever way up it is', () => {
        for (const seed of SEEDS) {
          const { size } = boundsOf(seed, flat)
          expect(size.x).toBeGreaterThan(0.3)
          expect(size.x).toBeLessThanOrEqual(1.6)
        }
      })
    })
  }

  it('does not move when it turns to face a new direction', () => {
    // The consequence of being centred, stated as the thing a player sees.
    const voxel = buildVoxel(31337, undefined, { flat: true })
    voxel.group.position.set(5, 0.46, 9)

    const centres = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => {
      voxel.group.rotation.set(0, angle, 0)
      voxel.group.updateMatrixWorld(true)
      return new THREE.Box3().setFromObject(voxel.group).getCenter(new THREE.Vector3())
    })

    for (const centre of centres) {
      expect(centre.x).toBeCloseTo(5, 1)
      expect(centre.z).toBeCloseTo(9, 1)
    }
    disposeVoxel(voxel)
  })
})
