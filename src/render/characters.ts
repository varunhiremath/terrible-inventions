/**
 * The Runner and the Machines, as they appear on the board.
 *
 * These are our own characters, and they are built from the same point lists
 * the intro draws with (`./silhouettes`), so the thing chasing you in the
 * cutscene is the thing chasing you in the game.
 *
 * Both are flat, because the board is seen from straight above, and both are
 * built as geometry rather than drawn as pictures so they stay sharp at any
 * size — the board scales to whatever screen it lands on.
 *
 * What each has to do at twenty pixels across:
 *  - the Runner must show which way it is pointing, which the visor does;
 *  - a Machine must show which way it is about to turn without ever turning
 *    itself, which the scanner bead does.
 * Everything else is decoration.
 */
import * as THREE from 'three'
import {
  BEAD_THROW,
  MACHINE_HULL,
  MACHINE_ROUND,
  RUNNER_HULL,
  RUNNER_ROUND,
  SKID_THROW,
  tracePolygon,
  triangle,
  type Point,
} from './silhouettes'

/** A character is a little under a tile across, so it never touches the walls. */
export const BODY = 0.82

export interface Character {
  group: THREE.Group
  /** @param t 0 to 1 through the shuffle, or the sway of the aerial */
  animate: (t: number) => void
  dispose: () => void
}

export interface Ghost extends Character {
  /**
   * Point the scanner. A Machine never turns to face its way, so this is the
   * only warning of which way it is about to go, and it is the whole tell.
   *
   * @param dx -1, 0 or 1
   * @param dy -1, 0 or 1, positive being down the screen
   */
  look: (dx: number, dy: number) => void
}

function flat(colour: number) {
  return new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide })
}

/** A rounded polygon from `silhouettes`, in units of half a body width. */
function slab(points: readonly Point[], round: number, r: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  tracePolygon(shape, points, round, r)
  return new THREE.ShapeGeometry(shape)
}

/**
 * The Runner: a wedge-nosed hull with a lit visor and two shuffling skids.
 *
 * The skids are separate meshes that slide rather than geometry rebuilt every
 * frame. A shuffle is a translation; rebuilding a hull sixty times a second to
 * move two bars is work for nothing.
 */
export function buildPlayer(colour = 0xffe14d): Character {
  const r = BODY / 2
  const hullMaterial = flat(colour)
  const visorMaterial = flat(0x8ff0ff)
  const skidMaterial = flat(0x4a3a12)

  const hull = new THREE.Mesh(slab(RUNNER_HULL, RUNNER_ROUND, r), hullMaterial)
  const visor = new THREE.Mesh(
    slab([[0.3, 0.42], [0.72, 0.2], [0.72, -0.2], [0.3, -0.42]], 0.14, r),
    visorMaterial,
  )
  visor.position.z = 0.004

  const skids = [-1, 1].map((side) => {
    const mesh = new THREE.Mesh(
      slab(
        [[-0.2, side * 0.62], [0.5, side * 0.62], [0.5, side * 0.94], [-0.2, side * 0.94]],
        0.12,
        r,
      ),
      skidMaterial,
    )
    mesh.position.z = -0.004
    return mesh
  })

  // Built facing the screen and laid flat all together, so the visor cannot
  // drift off the nose.
  const inner = new THREE.Group()
  inner.add(hull)
  inner.add(visor)
  for (const skid of skids) inner.add(skid)
  inner.rotation.x = -Math.PI / 2

  const group = new THREE.Group()
  group.add(inner)

  const animate = (t: number) => {
    const throwBy = triangle(t) * SKID_THROW * r
    skids[0].position.x = throwBy
    skids[1].position.x = -throwBy
  }
  animate(0)

  return {
    group,
    animate,
    dispose: () => {
      hull.geometry.dispose()
      visor.geometry.dispose()
      for (const skid of skids) skid.geometry.dispose()
      hullMaterial.dispose()
      visorMaterial.dispose()
      skidMaterial.dispose()
    },
  }
}

/**
 * A Machine: a boxy chassis on two treads, with a scanner slot and an aerial.
 *
 * The aerial and the treads carry the sway; the bead in the slot carries the
 * direction. Keeping those two apart matters — if the tell moved with the
 * animation you could not read it while the thing was walking.
 */
export function buildGhost(colour: number, lens = 0xffffff): Ghost {
  const r = BODY / 2
  const chassisMaterial = flat(colour)
  const slotMaterial = flat(0x12162c)
  const beadMaterial = flat(lens)

  const chassis = new THREE.Mesh(slab(MACHINE_HULL, MACHINE_ROUND, r), chassisMaterial)

  const slot = new THREE.Mesh(
    slab([[-0.78, -0.1], [0.78, -0.1], [0.78, 0.36], [-0.78, 0.36]], 0.12, r),
    slotMaterial,
  )
  slot.position.z = 0.004

  const bead = new THREE.Mesh(new THREE.CircleGeometry(r * 0.17, 14), beadMaterial)
  bead.position.set(0, r * 0.13, 0.008)

  const treads = [-1, 1].map((side) => {
    const mesh = new THREE.Mesh(
      slab(
        [
          [side * 0.22, -0.66], [side * 0.96, -0.66],
          [side * 0.96, -1.02], [side * 0.22, -1.02],
        ],
        0.1,
        r,
      ),
      slotMaterial,
    )
    mesh.position.z = -0.004
    return mesh
  })

  // The aerial leans from its base, so the rod and the bead stay joined.
  const aerial = new THREE.Group()
  const rod = new THREE.Mesh(slab([[-0.06, 0], [0.06, 0], [0.06, 0.26], [-0.06, 0.26]], 0.04, r), chassisMaterial)
  const tip = new THREE.Mesh(new THREE.CircleGeometry(r * 0.12, 12), beadMaterial)
  tip.position.set(0, r * 0.26, 0.004)
  aerial.add(rod)
  aerial.add(tip)
  aerial.position.y = r * 0.6

  const inner = new THREE.Group()
  inner.add(chassis)
  for (const tread of treads) inner.add(tread)
  inner.add(aerial)
  inner.add(slot)
  inner.add(bead)
  inner.rotation.x = -Math.PI / 2

  const group = new THREE.Group()
  group.add(inner)

  const animate = (t: number) => {
    const sway = Math.sin(t * Math.PI * 2)
    aerial.rotation.z = -sway * 0.3
    treads.forEach((tread, i) => {
      tread.position.y = (i === 0 ? sway : -sway) * r * 0.06
    })
  }
  animate(0)

  const look = (dx: number, dy: number) => {
    bead.position.x = dx * BEAD_THROW * r
    bead.position.y = (0.13 - dy * 0.08) * r
  }

  return {
    group,
    animate,
    look,
    dispose: () => {
      chassis.geometry.dispose()
      slot.geometry.dispose()
      bead.geometry.dispose()
      rod.geometry.dispose()
      tip.geometry.dispose()
      for (const tread of treads) tread.geometry.dispose()
      chassisMaterial.dispose()
      slotMaterial.dispose()
      beadMaterial.dispose()
    },
  }
}
