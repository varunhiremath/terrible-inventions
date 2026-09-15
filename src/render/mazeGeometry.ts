/**
 * Turning maze cells into wall shapes.
 *
 * A wall cell drawn as a full tile-sized cube gives you the fat, blocky maze
 * the game started with. Making the cube smaller instead breaks every run of
 * wall into a line of separate posts with daylight between them.
 *
 * So a wall cell is drawn thin, but stretched out to meet each neighbouring
 * wall cell. A straight run becomes one continuous rail, a corner meets
 * cleanly, a lone cell stays a post, and the inside of a thick block still
 * fills its tile. The corridors read wider because the walls take up less of
 * them, which is the whole point.
 */

export interface WallBox {
  /** Centre, in tile coordinates. */
  x: number
  z: number
  /** Footprint. How tall it stands is the renderer's business. */
  width: number
  depth: number
}

/**
 * @param thickness  how much of a tile a wall takes up, 0 to 1. Anything at or
 *                   above 1 gives you the old fat maze back.
 */
export function wallBoxes(
  maze: readonly string[],
  wall: string,
  thickness: number,
): WallBox[] {
  const half = Math.min(1, Math.max(0.05, thickness)) / 2
  const isWall = (x: number, y: number) => maze[y]?.[x] === wall

  const boxes: WallBox[] = []
  maze.forEach((row, y) => {
    ;[...row].forEach((tile, x) => {
      if (tile !== wall) return

      // Reach out to the centre of any neighbour that is also wall, so the two
      // boxes meet; stop short at the thin edge otherwise.
      const left = isWall(x - 1, y) ? -0.5 : -half
      const right = isWall(x + 1, y) ? 0.5 : half
      const back = isWall(x, y - 1) ? -0.5 : -half
      const front = isWall(x, y + 1) ? 0.5 : half

      boxes.push({
        x: x + (left + right) / 2,
        z: y + (back + front) / 2,
        width: right - left,
        depth: front - back,
      })
    })
  })
  return boxes
}
