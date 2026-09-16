import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BODY, buildGhost, buildPlayer } from './characters'

/** Bounding box of a built character, laid out as it will be on the board. */
function box(group: THREE.Object3D) {
  group.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(group)
}

/**
 * The body mesh alone, without the eyes — measured in world space, so the
 * whole chain of transforms above it has to be brought up to date first. Read
 * off the mesh on its own it comes back unrotated and flat in the wrong plane.
 */
function bodyBox(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  let found: THREE.Mesh | null = null
  root.traverse((n) => {
    if (!found && n instanceof THREE.Mesh) found = n
  })
  return new THREE.Box3().setFromObject(found!)
}

describe('the player', () => {
  it('fits inside a tile', () => {
    const p = buildPlayer()
    // Measured with the mouth shut, which is when he is at his widest.
    p.animate(0.5)
    const size = box(p.group).getSize(new THREE.Vector3())
    expect(size.x).toBeLessThanOrEqual(1)
    expect(size.z).toBeLessThanOrEqual(1)
    expect(size.x).toBeCloseTo(BODY, 1)
    p.dispose()
  })

  it('is flat, because the board is seen from straight above', () => {
    const p = buildPlayer()
    expect(box(p.group).getSize(new THREE.Vector3()).y).toBeLessThan(0.01)
    p.dispose()
  })

  it('opens and shuts its mouth as the chomp runs', () => {
    // The wedge comes out of the side he faces, so an open mouth is narrower
    // across than a shut one. Counting vertices tells you nothing: the fan has
    // the same number of segments however wide the gap is.
    const p = buildPlayer()
    const width = (t: number) => {
      p.animate(t)
      return box(p.group).getSize(new THREE.Vector3()).x
    }
    const open = width(0)
    const shut = width(0.5)
    expect(open).toBeLessThan(shut)
    expect(shut).toBeCloseTo(BODY, 2)
    p.dispose()
  })

  it('comes back to the same pose each time round', () => {
    const p = buildPlayer()
    const width = (t: number) => {
      p.animate(t)
      return box(p.group).getSize(new THREE.Vector3()).x
    }
    expect(width(0.25)).toBeCloseTo(width(0.75), 9)
    expect(width(0)).toBeCloseTo(width(1), 9)
    p.dispose()
  })

  it('centres on its own origin, so turning does not move it', () => {
    const p = buildPlayer()
    p.animate(0.5) // shut, so the wedge does not pull the centre off
    const centre = box(p.group).getCenter(new THREE.Vector3())
    expect(Math.abs(centre.x)).toBeLessThan(0.12)
    expect(Math.abs(centre.z)).toBeLessThan(0.12)
    p.dispose()
  })
})

describe('a chaser', () => {
  it('has a head above its skirt, not just a pair of eyes', () => {
    /*
     * The bug this is for: the dome was drawn the long way round the circle,
     * which left the body as two little scallops with eyes floating over them.
     * It looked nothing like a ghost and the tests at the time said nothing.
     */
    const g = buildGhost(0xe8503a)
    const size = bodyBox(g.group).getSize(new THREE.Vector3())
    // As wide as the body, and tall enough to have a head on it.
    expect(size.x).toBeCloseTo(BODY, 1)
    expect(size.z).toBeGreaterThan(BODY * 0.6)
    g.dispose()
  })

  it('fits inside a tile', () => {
    const g = buildGhost(0x5ad2e0)
    const size = box(g.group).getSize(new THREE.Vector3())
    expect(size.x).toBeLessThanOrEqual(1)
    expect(size.z).toBeLessThanOrEqual(1)
    g.dispose()
  })

  it('is flat', () => {
    const g = buildGhost(0xf49ac1)
    expect(box(g.group).getSize(new THREE.Vector3()).y).toBeLessThan(0.05)
    g.dispose()
  })

  it('keeps its shape through the whole wobble', () => {
    const g = buildGhost(0xf0a04b)
    for (let t = 0; t <= 1; t += 0.1) {
      g.animate(t)
      const size = bodyBox(g.group).getSize(new THREE.Vector3())
      expect(size.x).toBeCloseTo(BODY, 1)
      expect(size.z).toBeGreaterThan(BODY * 0.6)
    }
    g.dispose()
  })

  it('moves its eyes the way it is travelling', () => {
    const g = buildGhost(0xe8503a)
    const pupils = () => {
      const found: THREE.Vector3[] = []
      g.group.traverse((n) => {
        if (n instanceof THREE.Mesh && n.geometry.boundingSphere !== undefined) {
          found.push(n.position.clone())
        }
      })
      return found
    }

    g.look(0, 0)
    const centred = pupils()
    g.look(1, 0)
    const right = pupils()
    g.look(-1, 0)
    const left = pupils()

    // Looking right puts every pupil further right than looking left does.
    expect(right.length).toBe(left.length)
    let moved = 0
    for (let i = 0; i < right.length; i++) {
      if (right[i].x > left[i].x) moved++
    }
    expect(moved).toBeGreaterThan(0)
    expect(centred.length).toBe(right.length)
    g.dispose()
  })

  it('lets go of its geometry', () => {
    const g = buildGhost(0x2632d6)
    let freed = 0
    g.group.traverse((n) => {
      if (n instanceof THREE.Mesh) n.geometry.dispose = () => { freed++ }
    })
    g.dispose()
    expect(freed).toBeGreaterThan(0)
  })
})
