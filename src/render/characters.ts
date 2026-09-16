/**
 * The player and the chasers, drawn the way the arcade drew them.
 *
 * The procedural voxel bodies that were here before were good at being little
 * Minecraft creatures and bad at being these: from overhead they read as
 * coloured blobs, and no amount of colour-picking makes a blob look like a
 * character everybody already has a picture of in their head.
 *
 * These are the actual shapes. A disc with a wedge bitten out of it, opening
 * and closing as it goes; and a dome on a scalloped skirt with two eyes that
 * look the way it is travelling. Both are flat, because the board is seen from
 * straight above and flat is what the original is.
 *
 * They are built as geometry rather than drawn as pictures so they stay sharp
 * at any size — the board scales to whatever screen it lands on.
 */
import * as THREE from 'three'

/** A character is a little under a tile across, so it never touches the walls. */
export const BODY = 0.82

export interface Character {
  group: THREE.Group
  /** @param t 0 to 1 through the chomp, or the wobble of the skirt */
  animate: (t: number) => void
  dispose: () => void
}

export interface Ghost extends Character {
  /**
   * Point the eyes. In the original this is the only way to tell which way a
   * chaser is about to turn, and it is the whole tell.
   *
   * @param dx -1, 0 or 1
   * @param dy -1, 0 or 1, positive being down the screen
   */
  look: (dx: number, dy: number) => void
}

function flat(colour: number) {
  return new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide })
}

/**
 * How wide the mouth opens, in radians, at its widest. The original's mouth
 * shuts completely and opens to about a right angle.
 */
const MOUTH = Math.PI * 0.62

/**
 * The player: a disc with a wedge taken out of it.
 *
 * The wedge is rebuilt every frame rather than swapped between a few fixed
 * poses. It is a handful of triangles, and a mouth that moves continuously is
 * the difference between a character and a flickering sprite.
 */
export function buildPlayer(colour = 0xffe14d): Character {
  const material = flat(colour)
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(BODY / 2, 28), material)
  mesh.rotation.x = -Math.PI / 2

  const group = new THREE.Group()
  group.add(mesh)

  const animate = (t: number) => {
    // Open, shut, open: a triangle wave, not a sine, because the arcade mouth
    // moves at a constant rate rather than easing at the ends.
    const phase = Math.abs(((t % 1) * 2) - 1)
    const open = MOUTH * phase
    mesh.geometry.dispose()
    // The gap is centred on the way it is facing; the group does the turning.
    mesh.geometry = new THREE.CircleGeometry(
      BODY / 2,
      28,
      open / 2,
      Math.PI * 2 - open,
    )
  }
  animate(0)

  return {
    group,
    animate,
    dispose: () => {
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}

/** The skirt: a row of scallops along the bottom, as in the original. */
function ghostOutline(wobble: number): THREE.Shape {
  const r = BODY / 2
  const shape = new THREE.Shape()

  // Domed head, drawn from the left shoulder over the top to the right.
  // Clockwise: counterclockwise from pi to zero goes round underneath, which
  // leaves a ghost with no head and a pair of floating eyes.
  shape.absarc(0, 0, r, Math.PI, 0, true)

  const skirt = -r * 0.62
  const bumps = 3
  const span = (r * 2) / bumps
  shape.lineTo(r, skirt)

  for (let i = 0; i < bumps; i++) {
    const from = r - i * span
    const to = from - span
    // Alternate bumps rise and fall as the wobble runs, which is how the
    // original's feet appear to move without any legs being drawn.
    const lift = (i % 2 === 0 ? wobble : -wobble) * r * 0.22
    shape.quadraticCurveTo((from + to) / 2, skirt - span * 0.75 + lift, to, skirt)
  }

  shape.lineTo(-r, 0)
  return shape
}

export function buildGhost(colour: number, eyeWhite = 0xffffff): Ghost {
  const body = flat(colour)
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(ghostOutline(0)), body)

  const white = flat(eyeWhite)
  const dark = flat(0x1a1a3a)
  const eyes = new THREE.Group()
  const pupils: THREE.Mesh[] = []

  for (const side of [-1, 1]) {
    const sclera = new THREE.Mesh(new THREE.CircleGeometry(BODY * 0.17, 14), white)
    sclera.position.set(side * BODY * 0.2, BODY * 0.12, 0.01)
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(BODY * 0.09, 12), dark)
    pupil.position.set(side * BODY * 0.2, BODY * 0.12, 0.02)
    eyes.add(sclera)
    eyes.add(pupil)
    pupils.push(pupil)
  }

  // Everything is built facing the screen and then laid flat together, so the
  // eyes cannot drift off the face.
  const inner = new THREE.Group()
  inner.add(mesh)
  inner.add(eyes)
  inner.rotation.x = -Math.PI / 2

  const group = new THREE.Group()
  group.add(inner)

  const animate = (t: number) => {
    const wobble = Math.sin(t * Math.PI * 2)
    mesh.geometry.dispose()
    mesh.geometry = new THREE.ShapeGeometry(ghostOutline(wobble))
  }
  animate(0)

  const look = (dx: number, dy: number) => {
    pupils.forEach((pupil, i) => {
      const side = i === 0 ? -1 : 1
      pupil.position.x = side * BODY * 0.2 + dx * BODY * 0.07
      pupil.position.y = BODY * 0.12 - dy * BODY * 0.07
    })
  }

  return {
    group,
    animate,
    look,
    dispose: () => {
      mesh.geometry.dispose()
      for (const child of eyes.children) (child as THREE.Mesh).geometry.dispose()
      body.dispose()
      white.dispose()
      dark.dispose()
    },
  }
}
