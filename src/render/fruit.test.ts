import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { FRUITS, buildFruit, fruitForLevel } from './fruit'

describe('power fruit', () => {
  it('gives every level a fruit, however far the run goes', () => {
    for (const level of [1, 2, 3, 7, 40, 999]) {
      expect(fruitForLevel(level).name).toBeTruthy()
    }
  })

  it('starts on cherries and works down the list', () => {
    expect(fruitForLevel(1).name).toBe('cherries')
    expect(fruitForLevel(2).name).toBe('a strawberry')
    expect(fruitForLevel(3).name).toBe('an orange')
  })

  it('settles on the last one rather than running out', () => {
    const last = FRUITS[FRUITS.length - 1].name
    expect(fruitForLevel(FRUITS.length).name).toBe(last)
    expect(fruitForLevel(500).name).toBe(last)
  })

  it('survives a nonsense level', () => {
    expect(fruitForLevel(0).name).toBe(FRUITS[0].name)
    expect(fruitForLevel(-3).name).toBe(FRUITS[0].name)
  })

  it('names each one so Papa can say what was eaten', () => {
    const names = FRUITS.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name).toMatch(/^[a-z]/)
  })

  for (const kind of FRUITS) {
    describe(kind.name, () => {
      it('builds something visible', () => {
        const { group, dispose } = buildFruit(kind)
        expect(group.children.length).toBeGreaterThan(0)
        dispose()
      })

      it('sits on the board rather than through it', () => {
        const { group, dispose } = buildFruit(kind)
        const box = new THREE.Box3().setFromObject(group)
        expect(box.min.y).toBeGreaterThan(-0.05)
        dispose()
      })

      it('fits inside its tile', () => {
        const { group, dispose } = buildFruit(kind)
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
        expect(size.x).toBeLessThanOrEqual(1)
        expect(size.z).toBeLessThanOrEqual(1)
        // Big enough to spot from across the board.
        expect(Math.max(size.x, size.z)).toBeGreaterThan(0.7)
        dispose()
      })

      it('lets go of its geometry', () => {
        const { group, dispose } = buildFruit(kind)
        let freed = 0
        group.traverse((node) => {
          if (node instanceof THREE.Mesh) node.geometry.dispose = () => { freed++ }
        })
        dispose()
        expect(freed).toBeGreaterThan(0)
      })
    })
  }
})
