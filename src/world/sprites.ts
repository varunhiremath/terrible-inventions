import { makeRng } from '../engine/rng'

/**
 * Machine sprites, grown from a seed.
 *
 * No artist and no asset pipeline: every machine's look is derived from its id,
 * so it is the same machine every time, and adding a character costs nothing.
 *
 * The rules that matter are the ones that make a blob read as *somebody*:
 * bilateral symmetry, a solid body rather than scattered pixels, and eyes —
 * always eyes, always in the top third. A shape with two eyes is a creature. The
 * same shape without them is a rock.
 */

export type SpriteGrid = (string | null)[][]

export interface Palette {
  body: string
  shade: string
  accent: string
  outline: string
}

const SIZE = 16

export function paletteFor(seed: number): Palette {
  const rng = makeRng(seed ^ 0x9e3779b9)
  const hue = rng.int(0, 359)
  // Accent sits well away from the body hue so panels and bolts stay legible.
  const accentHue = (hue + rng.int(110, 250)) % 360

  return {
    body: hsl(hue, rng.int(45, 70), rng.int(48, 62)),
    shade: hsl(hue, rng.int(40, 65), rng.int(28, 38)),
    accent: hsl(accentHue, rng.int(55, 80), rng.int(55, 68)),
    outline: hsl(hue, 35, 12),
  }
}

export function makeSprite(seed: number, palette = paletteFor(seed)): SpriteGrid {
  const rng = makeRng(seed)
  const half = SIZE / 2
  const filled: boolean[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false))

  // Body: denser toward the middle, so it grows a torso instead of confetti.
  const top = rng.int(2, 4)
  const bottom = rng.int(12, 14)
  const waist = rng.int(2, 4)

  for (let y = top; y <= bottom; y++) {
    for (let x = waist; x < half; x++) {
      const centreness = 1 - (half - x) / half
      const verticalness = 1 - Math.abs(y - (top + bottom) / 2) / ((bottom - top) / 2 + 1)
      const chance = 0.35 + centreness * 0.4 + verticalness * 0.3
      if (rng.next() < chance) {
        filled[y][x] = true
        filled[y][SIZE - 1 - x] = true
      }
    }
  }

  // Fill single-cell gaps, so the body is one solid mass rather than lace.
  // Counted against a snapshot rather than the live grid: filling a cell on the
  // left would otherwise change its neighbour's count before the mirrored cell
  // on the right is reached, and the sprite would come out lopsided.
  const before = filled.map((row) => row.slice())
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (before[y][x]) continue
      const neighbours =
        Number(before[y - 1]?.[x] ?? false) +
        Number(before[y + 1]?.[x] ?? false) +
        Number(before[y][x - 1] ?? false) +
        Number(before[y][x + 1] ?? false)
      if (neighbours >= 3) filled[y][x] = true
    }
  }

  const grid: SpriteGrid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null))
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!filled[y][x]) continue
      // Lower half sits in shadow, which reads as volume at this size.
      grid[y][x] = y > (top + bottom) / 2 + 1 ? palette.shade : palette.body
    }
  }

  // Accent panels: a couple of horizontal bars, mirrored.
  const bars = rng.int(1, 2)
  for (let i = 0; i < bars; i++) {
    const y = rng.int(top + 2, bottom - 1)
    const x = rng.int(waist, half - 1)
    if (!filled[y][x]) continue
    grid[y][x] = palette.accent
    grid[y][SIZE - 1 - x] = palette.accent
  }

  outline(grid, filled, palette.outline)
  addEyes(grid, filled, rng, top, bottom)

  return grid
}

/** A dark edge wherever the body meets empty space. Reads as a silhouette. */
function outline(grid: SpriteGrid, filled: boolean[][], colour: string): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (filled[y][x]) continue
      const touches =
        (filled[y - 1]?.[x] ?? false) ||
        (filled[y + 1]?.[x] ?? false) ||
        (filled[y][x - 1] ?? false) ||
        (filled[y][x + 1] ?? false)
      if (touches) grid[y][x] = colour
    }
  }
}

/**
 * Always two eyes, always symmetric, always in the top third. This is the single
 * rule that turns a generated shape into a character, so it is not left to
 * chance — if the body has no room, room is made.
 */
function addEyes(
  grid: SpriteGrid,
  filled: boolean[][],
  rng: ReturnType<typeof makeRng>,
  top: number,
  bottom: number,
): void {
  const half = SIZE / 2
  const row = Math.min(bottom - 2, top + rng.int(1, Math.max(1, Math.floor((bottom - top) / 3))))
  const offset = rng.int(1, 3)
  const left = half - offset - 1
  const right = SIZE - 1 - left

  for (const x of [left, right]) {
    filled[row][x] = true
    grid[row][x] = '#f4f7ff'
    // The pupil sits just below, which is what makes it look like it is looking.
    if (row + 1 <= bottom) {
      filled[row + 1][x] = true
      grid[row + 1][x] = '#14161f'
    }
  }
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h} ${s}% ${l}%)`
}

export const SPRITE_SIZE = SIZE
