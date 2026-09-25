/**
 * The two characters in the maze: the Runner and the Machines.
 *
 * They live here, as plain lists of points, because they are drawn twice — as
 * three.js geometry on the board and as canvas paths in the intro — and a
 * character that looks like one thing in the cutscene and another in the game
 * is the exact complaint that started this file.
 *
 * They are our own designs. The Runner is a wedge-nosed scout with a visor and
 * a pair of shuffling skids; a Machine is a boxy chassis on treads with a
 * scanner slot and a swaying aerial. Neither is anybody else's character.
 *
 * Every coordinate is in units of `r`, half a character's width, with +x
 * forward and +y up the screen, so the same numbers scale to a tile on a phone
 * or to a third of an intro frame.
 */
export type Point = readonly [number, number]

/** Anything that can take a path: a THREE.Shape or a 2D canvas context. */
export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void
  closePath(): void
}

/**
 * Trace a polygon with its corners rounded off.
 *
 * Each corner becomes a quadratic curve pulled back along both edges, which is
 * a rounded rectangle when the polygon is a rectangle and something friendlier
 * than a spike when it is not. `round` never eats more than half an edge, so a
 * short edge cannot turn the shape inside out.
 */
export function tracePolygon(
  sink: PathSink,
  points: readonly Point[],
  round: number,
  scale = 1,
): void {
  const n = points.length
  const towards = (from: Point, to: Point): Point => {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.hypot(dx, dy) || 1
    const step = Math.min(round, length / 2) / length
    return [(from[0] + dx * step) * scale, (from[1] + dy * step) * scale]
  }

  for (let i = 0; i < n; i++) {
    const corner = points[i]
    const from = towards(corner, points[(i + n - 1) % n])
    const to = towards(corner, points[(i + 1) % n])
    if (i === 0) sink.moveTo(from[0], from[1])
    else sink.lineTo(from[0], from[1])
    sink.quadraticCurveTo(corner[0] * scale, corner[1] * scale, to[0], to[1])
  }
  sink.closePath()
}

/**
 * The Runner's hull: a blunt nose, wide shoulders, a tapered tail.
 *
 * It has to read as pointing somewhere from directly overhead and at about
 * twenty pixels across, which rules out anything symmetrical.
 */
export const RUNNER_HULL: readonly Point[] = [
  [1, 0],
  [0.42, 0.84],
  [-0.86, 0.7],
  [-1, 0],
  [-0.86, -0.7],
  [0.42, -0.84],
]
export const RUNNER_ROUND = 0.22

/** A Machine's chassis: square-shouldered, with the top corners cut away. */
export const MACHINE_HULL: readonly Point[] = [
  [1, 0.34],
  [0.66, 0.6],
  [-0.66, 0.6],
  [-1, 0.34],
  [-1, -1],
  [1, -1],
]
export const MACHINE_ROUND = 0.16

/** How far a skid slides fore and aft, and a scanner bead side to side. */
export const SKID_THROW = 0.18
export const BEAD_THROW = 0.4

/** Open, shut, open: a triangle wave, so a step runs at a constant rate. */
export const triangle = (t: number) => Math.abs(((t % 1) * 2) - 1) * 2 - 1

/**
 * The same outline as an SVG path.
 *
 * For the places a character has to appear that are not a canvas — the row of
 * lives along the bottom of the maze, say. That row used to be its own hand-
 * written clip-path, which is how it ended up being a different character from
 * the one on the board.
 */
export function svgPath(points: readonly Point[], round: number, scale = 1): string {
  const at = (n: number) => n.toFixed(3)
  let d = ''
  tracePolygon(
    {
      moveTo: (x, y) => { d += `M${at(x)} ${at(y)}` },
      lineTo: (x, y) => { d += `L${at(x)} ${at(y)}` },
      quadraticCurveTo: (cx, cy, x, y) => { d += `Q${at(cx)} ${at(cy)} ${at(x)} ${at(y)}` },
      closePath: () => { d += 'Z' },
    },
    points,
    round,
    scale,
  )
  return d
}

type Ctx = CanvasRenderingContext2D

export interface RunnerInk {
  hull: string
  visor: string
  skid: string
}

export const RUNNER_INK: RunnerInk = { hull: '#ffd23f', visor: '#8ff0ff', skid: '#4a3a12' }

/**
 * The Runner, drawn flat on a canvas.
 *
 * @param angle which way it is heading, in radians, 0 being to the right
 * @param step  0 to 1 through the shuffle
 */
export function drawRunner(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  angle: number,
  step: number,
  ink: RunnerInk = RUNNER_INK,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-angle)

  // Skids first, so the hull sits over their inner ends and they read as
  // legs coming out from under it rather than bars stuck on the side.
  const throwBy = triangle(step) * SKID_THROW * r
  ctx.fillStyle = ink.skid
  for (const side of [-1, 1]) {
    const shift = side * throwBy
    ctx.beginPath()
    tracePolygon(
      ctx,
      [
        [-0.2 + shift / r, side * 0.62],
        [0.5 + shift / r, side * 0.62],
        [0.5 + shift / r, side * 0.94],
        [-0.2 + shift / r, side * 0.94],
      ],
      0.12,
      r,
    )
    ctx.fill()
  }

  ctx.fillStyle = ink.hull
  ctx.beginPath()
  tracePolygon(ctx, RUNNER_HULL, RUNNER_ROUND, r)
  ctx.fill()

  // The visor: a bright slot across the nose, which is the whole of the tell
  // for which way it is about to go.
  ctx.fillStyle = ink.visor
  ctx.beginPath()
  tracePolygon(
    ctx,
    [[0.3, 0.42], [0.72, 0.2], [0.72, -0.2], [0.3, -0.42]],
    0.14,
    r,
  )
  ctx.fill()
  ctx.restore()
}

export interface MachineInk {
  chassis: string
  slot: string
  bead: string
  tread: string
}

export const MACHINE_INK = (chassis: string, bead = '#ffffff'): MachineInk => ({
  chassis,
  slot: '#12162c',
  bead,
  tread: '#12162c',
})

/**
 * A Machine, drawn flat on a canvas.
 *
 * It never turns to face its way — it always faces the screen and the scanner
 * bead moves instead, so `lookX` and `lookY` carry the same warning the game
 * needs: which way this one is about to go.
 *
 * @param lookX -1, 0 or 1
 * @param lookY -1, 0 or 1, positive being down the screen
 * @param wobble 0 to 1 through the sway
 */
export function drawMachine(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  lookX: number,
  lookY: number,
  wobble: number,
  ink: MachineInk,
): void {
  ctx.save()
  ctx.translate(x, y)

  const sway = Math.sin(wobble * Math.PI * 2)

  // Treads, bobbing out of step with each other so it walks rather than slides.
  ctx.fillStyle = ink.tread
  for (const side of [-1, 1]) {
    const bob = side * sway * 0.06
    ctx.beginPath()
    tracePolygon(
      ctx,
      [
        [side * 0.22, -0.66 + bob],
        [side * 0.96, -0.66 + bob],
        [side * 0.96, -1.02 + bob],
        [side * 0.22, -1.02 + bob],
      ],
      0.1,
      r,
    )
    ctx.fill()
  }

  // The aerial, leaning with the sway, with a bead on the end.
  ctx.strokeStyle = ink.chassis
  ctx.lineWidth = r * 0.12
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.6)
  ctx.lineTo(sway * r * 0.18, -r * 0.86)
  ctx.stroke()
  ctx.fillStyle = ink.bead
  ctx.beginPath()
  ctx.arc(sway * r * 0.18, -r * 0.86, r * 0.12, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = ink.chassis
  ctx.beginPath()
  // Canvas y runs down the screen and the point lists run up it.
  tracePolygon(ctx, MACHINE_HULL.map(([px, py]) => [px, -py] as Point), MACHINE_ROUND, r)
  ctx.fill()

  ctx.fillStyle = ink.slot
  ctx.beginPath()
  tracePolygon(
    ctx,
    [[-0.78, 0.1], [0.78, 0.1], [0.78, -0.36], [-0.78, -0.36]],
    0.12,
    r,
  )
  ctx.fill()

  ctx.fillStyle = ink.bead
  ctx.beginPath()
  ctx.arc(lookX * BEAD_THROW * r, (-0.13 + lookY * 0.08) * r, r * 0.17, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
