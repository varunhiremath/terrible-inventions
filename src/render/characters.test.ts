import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BODY, buildGhost, buildPlayer } from './characters'

/** Bounding box of a built character, laid out as it will be on the board. */
function box(group: THREE.Object3D) {
  group.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(group)
}

/**
 * The first mesh alone — the hull or the chassis — measured in world space, so
 * the whole chain of transforms above it has to be brought up to date first.
 * Read off the mesh on its own it comes back unrotated and flat in the wrong
 * plane.
 */
function bodyBox(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  let found: THREE.Mesh | null = null
  root.traverse((n) => {
    if (!found && n instanceof THREE.Mesh) found = n
  })
  return new THREE.Box3().setFromObject(found!)
}

/** Every mesh's own position, in the order they were added. */
function parts(root: THREE.Object3D) {
  const found: THREE.Vector3[] = []
  root.traverse((n) => {
    if (n instanceof THREE.Mesh) found.push(n.position.clone())
  })
  return found
}

describe('the Runner', () => {
  it('fits inside a tile', () => {
    const p = buildPlayer()
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

  it('shows which way it is pointing', () => {
    /*
     * From overhead and at twenty pixels across, the visor is the only thing
     * that says which way he is about to go. It has to sit forward of centre —
     * +x is the way the group is turned to face.
     */
    const p = buildPlayer()
    p.group.updateMatrixWorld(true)
    const meshes: THREE.Mesh[] = []
    p.group.traverse((n) => {
      if (n instanceof THREE.Mesh) meshes.push(n)
    })
    const visor = new THREE.Box3().setFromObject(meshes[1]).getCenter(new THREE.Vector3())
    expect(visor.x).toBeGreaterThan(BODY * 0.15)
    p.dispose()
  })

  it('shuffles its skids, one forward while the other goes back', () => {
    const p = buildPlayer()
    const skids = () => parts(p.group).slice(2)

    p.animate(0)
    const start = skids()
    p.animate(0.5)
    const half = skids()

    expect(start.length).toBe(2)
    // They move, and they move opposite ways, which is what makes it a walk
    // rather than a slide.
    expect(Math.abs(half[0].x - start[0].x)).toBeGreaterThan(0.01)
    expect(Math.sign(start[0].x - half[0].x)).toBe(-Math.sign(start[1].x - half[1].x))
    p.dispose()
  })

  it('comes back to the same pose each time round', () => {
    const p = buildPlayer()
    const skid = (t: number) => {
      p.animate(t)
      return parts(p.group)[2].x
    }
    expect(skid(0.25)).toBeCloseTo(skid(1.25), 9)
    expect(skid(0)).toBeCloseTo(skid(1), 9)
    p.dispose()
  })

  it('centres on its own origin, so turning does not move it', () => {
    const p = buildPlayer()
    const centre = box(p.group).getCenter(new THREE.Vector3())
    expect(Math.abs(centre.x)).toBeLessThan(0.12)
    expect(Math.abs(centre.z)).toBeLessThan(0.12)
    p.dispose()
  })
})

describe('a Machine', () => {
  it('has a chassis, not just a scanner', () => {
    const g = buildGhost(0xe8503a)
    const size = bodyBox(g.group).getSize(new THREE.Vector3())
    // As wide as the body, and deep enough to be a machine rather than a bar.
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

  it('keeps its shape through the whole sway', () => {
    const g = buildGhost(0xf0a04b)
    for (let t = 0; t <= 1; t += 0.1) {
      g.animate(t)
      const size = box(g.group).getSize(new THREE.Vector3())
      expect(size.x).toBeLessThanOrEqual(1)
      expect(size.z).toBeLessThanOrEqual(1)
      expect(bodyBox(g.group).getSize(new THREE.Vector3()).x).toBeCloseTo(BODY, 1)
    }
    g.dispose()
  })

  it('slides its scanner the way it is travelling', () => {
    /*
     * The tell has to survive the sway: it is read while the thing is walking
     * or it is not read at all. So the bead is moved by `look` and nothing
     * else, and `animate` never touches it.
     */
    const g = buildGhost(0xe8503a)

    g.look(1, 0)
    g.animate(0.3)
    const right = parts(g.group)
    g.look(-1, 0)
    g.animate(0.8)
    const left = parts(g.group)

    expect(right.length).toBe(left.length)
    let moved = 0
    for (let i = 0; i < right.length; i++) {
      if (right[i].x > left[i].x) moved++
    }
    expect(moved).toBe(1)
    g.dispose()
  })

  it('looks up and down as well as side to side', () => {
    const g = buildGhost(0x2632d6)
    const bead = () => parts(g.group).map((p) => p.y)
    g.look(0, 1)
    const down = bead()
    g.look(0, -1)
    const up = bead()
    expect(up.some((y, i) => y > down[i])).toBe(true)
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
