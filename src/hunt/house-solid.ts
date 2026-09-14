import type { Point } from '../world/map'

/** Terrain test against an arbitrary tile grid. Shared by the house and its tests. */
export function isSolidIn(rows: readonly string[], { x, y }: Point): boolean {
  if (y < 0 || y >= rows.length) return true
  const row = rows[y]
  if (x < 0 || x >= row.length) return true
  return row[x] !== '.'
}
