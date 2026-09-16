/**
 * Turning maze cells into wall shapes.
 *
 * The arcade original does not draw walls as solid blocks. It draws the
 * *outline* of them: a bright thin line tracing the edge of every blue shape,
 * with black inside. That is where the whole look comes from, and it is why a
 * maze of solid slabs never quite reads as one however the colours are chosen.
 *
 * So a wall cell contributes a bar along each of its sides that faces open
 * floor, and nothing along the sides it shares with another wall. Trace a run
 * of wall one tile thick and you get two parallel lines with black between
 * them — exactly the double line the original draws. Trace a thicker blob and
 * you get its silhouette.
 *
 * Corners get a little overlap so the two bars meet cleanly rather than
 * leaving a notch of background showing through.
 */

export interface WallBar {
  /** Centre, in tile coordinates. */
  x: number
  z: number
  width: number
  depth: number
}

const SIDES = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
] as const

/**
 * @param thickness how wide the drawn line is, as a fraction of a tile
 */
export function wallBars(
  maze: readonly string[],
  wall: string,
  thickness: number,
): WallBar[] {
  const t = Math.min(0.5, Math.max(0.02, thickness))
  const isWall = (x: number, y: number) => maze[y]?.[x] === wall

  const bars: WallBar[] = []
  maze.forEach((row, y) => {
    ;[...row].forEach((tile, x) => {
      if (tile !== wall) return

      for (const { dx, dy } of SIDES) {
        if (isWall(x + dx, y + dy)) continue

        // The bar hugs the inside of the edge it is drawn on. It runs the full
        // tile along that edge, and a touch further at each end wherever the
        // neighbour that way is also wall, so corners close up.
        const alongX = dx === 0
        const grow = (ax: number, ay: number) => (isWall(x + ax, y + ay) ? t / 2 : 0)
        const extendA = alongX ? grow(-1, 0) : grow(0, -1)
        const extendB = alongX ? grow(1, 0) : grow(0, 1)

        const length = 1 + extendA + extendB
        const shift = (extendB - extendA) / 2

        bars.push({
          x: x + dx * (0.5 - t / 2) + (alongX ? shift : 0),
          z: y + dy * (0.5 - t / 2) + (alongX ? 0 : shift),
          width: alongX ? length : t,
          depth: alongX ? t : length,
        })
      }
    })
  })
  return bars
}
