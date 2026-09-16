import * as THREE from 'three'
import { SPRITE_SIZE, makeSprite, type Palette, type SpriteGrid } from './sprites'

/**
 * Turns a sprite into a solid little body.
 *
 * Every lit pixel becomes a cube, so all the procedural character work carries
 * straight over into three dimensions — same machine, same colours, same eyes,
 * now with a back and sides. One instanced mesh per character keeps a roomful
 * of them to a handful of draw calls.
 */

const CUBE = new THREE.BoxGeometry(1, 1, 1)
/** Flat enough to read as its sprite, thick enough to be a thing. */
const DEPTH = 5

export interface Voxel {
  group: THREE.Group
  mesh: THREE.InstancedMesh
}

export interface VoxelOptions {
  /**
   * Lay the body flat, face upwards.
   *
   * A sprite extruded upright is five voxels thick, and from a near-overhead
   * camera that is all you see — a sliver. Laid flat it reads as a character
   * again, which is how top-down games have always drawn their sprites.
   */
  flat?: boolean
}

export function buildVoxel(seed: number, palette?: Palette, options: VoxelOptions = {}): Voxel {
  const grid: SpriteGrid = makeSprite(seed, palette)

  const cells: { x: number; y: number; colour: THREE.Color }[] = []
  grid.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (colour) cells.push({ x, y, colour: new THREE.Color(colour) })
    }),
  )

  const material = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const mesh = new THREE.InstancedMesh(CUBE, material, cells.length * DEPTH)

  const matrix = new THREE.Matrix4()
  const shaded = new THREE.Color()
  let i = 0

  for (const cell of cells) {
    for (let z = 0; z < DEPTH; z++) {
      // Sprite rows run downward; the world's y runs up. Every axis is
      // centred on the origin, which matters more than it looks: the holder
      // turns about its origin to face the way it is going, so a body built
      // off-centre does not merely sit in the wrong place, it *swings* as it
      // turns. This was three quarters of a tile out, and it made the board
      // very hard to read.
      matrix.setPosition(
        cell.x - SPRITE_SIZE / 2 + 0.5,
        SPRITE_SIZE / 2 - cell.y - 0.5,
        z - DEPTH / 2 + 0.5,
      )
      mesh.setMatrixAt(i, matrix)

      // Sides and back shade down, so the silhouette stays legible from an
      // angle instead of reading as one flat slab of colour.
      shaded.copy(cell.colour)
      if (z !== DEPTH - 1) shaded.multiplyScalar(0.72)
      mesh.setColorAt(i, shaded)
      i++
    }
  }

  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  const inner = new THREE.Group()
  // Slightly over a tile wide, so a character stands up against the walls
  // rather than looking like something dropped on the floor.
  inner.scale.setScalar(1.5 / SPRITE_SIZE)
  inner.add(mesh)

  if (options.flat) inner.rotation.x = -Math.PI / 2

  // The holder only ever turns about the world's vertical, so facing a
  // direction stays a single clean rotation whichever way the body is laid.
  const holder = new THREE.Group()
  holder.add(inner)
  return { group: holder, mesh }
}

export function disposeVoxel(voxel: Voxel): void {
  voxel.mesh.dispose()
  ;(voxel.mesh.material as THREE.Material).dispose()
}
