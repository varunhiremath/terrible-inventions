import { describe, expect, it } from 'vitest'
import { MAZE, TILE, WIDTH } from '../arcade/maze/maze'
import { wallBoxes, type WallBox } from './mazeGeometry'

const T = 0.34
const boxes = wallBoxes(MAZE, TILE.WALL, T)

const wallCells = () => {
  const out: { x: number; y: number }[] = []
  MAZE.forEach((row, y) => [...row].forEach((tile, x) => tile === TILE.WALL && out.push({ x, y })))
  return out
}

const bounds = (b: WallBox) => ({
  left: b.x - b.width / 2,
  right: b.x + b.width / 2,
  back: b.z - b.depth / 2,
  front: b.z + b.depth / 2,
})

const at = (x: number, y: number) =>
  boxes.find((b) => Math.abs(b.x - x) < 0.5 && Math.abs(b.z - y) < 0.5)

describe('wall geometry', () => {
  it('draws one box per wall cell', () => {
    expect(boxes).toHaveLength(wallCells().length)
  })

  it('makes the walls thinner than a tile', () => {
    const thin = boxes.filter((b) => b.width < 1 || b.depth < 1)
    expect(thin.length).toBeGreaterThan(boxes.length / 2)
  })

  it('never spills into a corridor', () => {
    // A box may reach the centre of a neighbouring wall, but no further — half
    // a tile in any direction. Past that it would eat into the path.
    for (const box of boxes) {
      const b = bounds(box)
      const cx = Math.round(box.x)
      const cy = Math.round(box.z)
      expect(b.left).toBeGreaterThanOrEqual(cx - 0.5 - 1e-9)
      expect(b.right).toBeLessThanOrEqual(cx + 0.5 + 1e-9)
      expect(b.back).toBeGreaterThanOrEqual(cy - 0.5 - 1e-9)
      expect(b.front).toBeLessThanOrEqual(cy + 0.5 + 1e-9)
    }
  })

  it('joins neighbouring walls with no gap', () => {
    // The bug this guards against is a run of wall reading as a dotted line.
    let checked = 0
    MAZE.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        if (tile !== TILE.WALL) return
        if (MAZE[y][x + 1] === TILE.WALL) {
          const a = at(x, y)!
          const b = at(x + 1, y)!
          expect(bounds(a).right).toBeCloseTo(bounds(b).left, 9)
          checked++
        }
        if (MAZE[y + 1]?.[x] === TILE.WALL) {
          const a = at(x, y)!
          const b = at(x, y + 1)!
          expect(bounds(a).front).toBeCloseTo(bounds(b).back, 9)
          checked++
        }
      }),
    )
    expect(checked).toBeGreaterThan(50)
  })

  it('leaves a lone wall as a post', () => {
    const post = wallBoxes(['   ', ' # ', '   '], '#', T)
    expect(post).toEqual([{ x: 1, z: 1, width: T, depth: T }])
  })

  it('keeps the inside of a thick block solid', () => {
    const block = wallBoxes(['###', '###', '###'], '#', T)
    const middle = block.find((b) => b.x === 1 && b.z === 1)!
    expect(middle.width).toBeCloseTo(1, 9)
    expect(middle.depth).toBeCloseTo(1, 9)
  })

  it('stretches a straight run into one unbroken rail', () => {
    const run = wallBoxes(['#####'], '#', T)
    const left = bounds(run[0])
    const right = bounds(run[run.length - 1])
    const covered = run.reduce((sum, b) => sum + b.width, 0)
    expect(covered).toBeCloseTo(right.right - left.left, 9)
    // The ends taper in; only the middle reaches a full tile.
    expect(run[0].width).toBeCloseTo(0.5 + T / 2, 9)
    expect(run[2].width).toBeCloseTo(1, 9)
  })

  it('stays symmetric, because the maze is', () => {
    for (const box of boxes) {
      const mirrored = boxes.find(
        (b) => Math.abs(b.x - (WIDTH - 1 - box.x)) < 1e-9 && Math.abs(b.z - box.z) < 1e-9,
      )
      expect(mirrored).toBeDefined()
      expect(mirrored!.width).toBeCloseTo(box.width, 9)
      expect(mirrored!.depth).toBeCloseTo(box.depth, 9)
    }
  })

  it('refuses a thickness that would erase the walls', () => {
    expect(wallBoxes([' # '], '#', 0)[0].width).toBeGreaterThan(0)
    expect(wallBoxes([' # '], '#', 5)[0].width).toBeLessThanOrEqual(1)
  })
})
