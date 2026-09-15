/**
 * The power fruit.
 *
 * Four big flashing dots did the job but looked like nothing. The original
 * game put a cherry on the board at level one, a strawberry at two, an orange
 * at three, and every kid who played it can still name the order — so the
 * power pellets here are fruit, and the fruit changes as the levels climb.
 * Reaching a new one is a small thing to look forward to that costs nothing to
 * give.
 *
 * They are built from spheres and cylinders rather than drawn, because the
 * board is seen from above at a slight tilt and at that angle a silhouette and
 * a colour are all that survive. Everything else on the board is grey, so the
 * fruit is the only colour on it and the eye goes straight there.
 */
import * as THREE from 'three'

export interface FruitKind {
  /** What Papa calls it when it is eaten. */
  name: string
  build: () => THREE.Object3D[]
}

const STEM = 0x6f4a2a
const LEAF = 0x4f9e3c

function material(colour: number, shine = 0.25) {
  return new THREE.MeshLambertMaterial({ color: colour, emissive: colour, emissiveIntensity: shine })
}

function berry(colour: number, radius: number, x: number, y: number, z = 0) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material(colour))
  mesh.position.set(x, y, z)
  return mesh
}

function stalk(height: number, tilt: number, x = 0) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, height, 6),
    new THREE.MeshLambertMaterial({ color: STEM }),
  )
  mesh.position.set(x, 0.24 + height / 2, 0)
  mesh.rotation.z = tilt
  return mesh
}

function leaf(x: number, y: number, tilt: number, scale = 1) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12 * scale, 8, 6),
    new THREE.MeshLambertMaterial({ color: LEAF }),
  )
  mesh.scale.set(1.5, 0.35, 0.8)
  mesh.position.set(x, y, 0)
  mesh.rotation.y = tilt
  return mesh
}

/**
 * In the order the original served them, which is the order anyone who played
 * it remembers.
 */
export const FRUITS: readonly FruitKind[] = [
  {
    name: 'cherries',
    build: () => [
      berry(0xd8213a, 0.2, -0.16, 0.2, 0.04),
      berry(0xb3152c, 0.17, 0.17, 0.18, -0.06),
      stalk(0.3, 0.35, -0.1),
      stalk(0.26, -0.3, 0.12),
      leaf(0.02, 0.46, 0.4, 0.9),
    ],
  },
  {
    name: 'a strawberry',
    build: () => {
      // Wide at the top, tapering to a point underneath.
      const body = berry(0xe02845, 0.26, 0, 0.3)
      body.scale.set(1, 1.15, 1)
      const tip = berry(0xe02845, 0.14, 0, 0.15)
      return [body, tip, leaf(-0.1, 0.56, 0.5), leaf(0.1, 0.56, -0.5)]
    },
  },
  {
    name: 'an orange',
    build: () => [berry(0xf08a1c, 0.28, 0, 0.26), stalk(0.14, 0), leaf(0.12, 0.48, 0.3)],
  },
  {
    name: 'an apple',
    build: () => {
      const body = berry(0xcf2f2f, 0.28, 0, 0.26)
      body.scale.set(1, 0.92, 1)
      return [body, stalk(0.2, 0.15), leaf(0.14, 0.5, 0.35)]
    },
  },
  {
    name: 'a melon',
    build: () => {
      const body = berry(0x7ac943, 0.3, 0, 0.27)
      body.scale.set(1, 0.85, 1)
      // Each stripe is squashed to follow the curve of the melon at the point
      // it sits on. Left to full length they stuck out past the edge as fins.
      const stripes = [-0.18, 0, 0.18].map((x) => {
        const s = new THREE.Mesh(
          new THREE.SphereGeometry(0.31, 10, 8),
          new THREE.MeshLambertMaterial({ color: 0x3f7a22 }),
        )
        const reach = Math.sqrt(Math.max(0, 0.3 * 0.3 - x * x)) / 0.31
        s.scale.set(0.09, 0.86, reach * 0.94)
        s.position.set(x, 0.27, 0)
        return s
      })
      return [body, ...stripes, stalk(0.14, 0)]
    },
  },
  {
    name: 'a golden bell',
    build: () => {
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), material(0xf5c518, 0.35))
      bell.scale.set(1, 0.9, 1)
      bell.position.y = 0.26
      const lip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.07, 12),
        material(0xffe07a, 0.3),
      )
      lip.position.y = 0.1
      return [bell, lip, stalk(0.12, 0)]
    },
  },
  {
    name: 'a key',
    build: () => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 14), material(0xdfe6f2, 0.3))
      ring.position.set(0, 0.34, 0)
      ring.rotation.x = Math.PI / 2
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.34),
        material(0xdfe6f2, 0.3),
      )
      shaft.position.set(0, 0.34, 0.24)
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.07), material(0xdfe6f2, 0.3))
      tooth.position.set(0.07, 0.34, 0.34)
      return [ring, shaft, tooth]
    },
  },
]

/** Which fruit a level gets. Past the list it stays on the last one. */
export function fruitForLevel(level: number): FruitKind {
  return FRUITS[Math.min(FRUITS.length - 1, Math.max(0, level - 1))]
}

/**
 * Built at a comfortable size to model and then scaled up, because at the zoom
 * the whole board is seen at, a fruit built to life size reads as a smudge.
 * Kept under a tile so it never laps into the corridor beside it.
 */
const SCALE = 1.3

/** A fruit ready to drop into the scene. Call `dispose` when it leaves. */
export function buildFruit(kind: FruitKind) {
  const group = new THREE.Group()
  for (const part of kind.build()) group.add(part)
  group.scale.setScalar(SCALE)

  const dispose = () => {
    group.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose()
        const m = node.material
        if (Array.isArray(m)) m.forEach((one) => one.dispose())
        else m.dispose()
      }
    })
  }

  return { group, dispose }
}
