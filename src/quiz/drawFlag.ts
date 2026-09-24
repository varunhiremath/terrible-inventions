/**
 * Painting a flag.
 *
 * Nothing here knows which flag it is drawing. It takes a list of shapes in
 * unit coordinates and puts them on a canvas in order, which is why adding a
 * flag is a few lines of data rather than a few lines of code.
 */
import type { Flag, Shape } from './flags'

/** A star with `points` points, drawn about a centre. */
function starPath(cx: number, cy: number, r: number, points: number, turn: number): Path2D {
  const path = new Path2D()
  const inner = r * 0.382
  for (let i = 0; i < points * 2; i++) {
    // Start at the top: a star resting on a point looks upside down.
    const angle = turn + (i * Math.PI) / points - Math.PI / 2
    const radius = i % 2 === 0 ? r : inner
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
  return path
}

function paint(ctx: CanvasRenderingContext2D, shape: Shape, w: number, h: number): void {
  // Set per branch rather than once up front: a banded field carries a list of
  // colours and has no single one of its own.
  if (shape.kind !== 'bands') ctx.fillStyle = shape.color

  switch (shape.kind) {
    case 'bands': {
      const n = shape.colors.length
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = shape.colors[i]
        // Overlap by a hair: at some sizes a seam of background shows between
        // two bands that are meant to touch, and it reads as a drawing bug.
        if (shape.dir === 'h') ctx.fillRect(0, (i * h) / n, w, h / n + 1)
        else ctx.fillRect((i * w) / n, 0, w / n + 1, h)
      }
      return
    }
    case 'rect': {
      const [x, y, rw, rh] = shape.at
      ctx.fillRect(x * w, y * h, rw * w, rh * h)
      return
    }
    case 'disc': {
      const [cx, cy, r] = shape.at
      ctx.beginPath()
      ctx.arc(cx * w, cy * h, r * h, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    case 'ring': {
      const [cx, cy, r, thickness] = shape.at
      ctx.strokeStyle = shape.color
      ctx.lineWidth = thickness * h
      ctx.beginPath()
      ctx.arc(cx * w, cy * h, r * h, 0, Math.PI * 2)
      ctx.stroke()
      return
    }
    case 'star': {
      const [cx, cy, r] = shape.at
      ctx.fill(starPath(cx * w, cy * h, r * h, shape.points ?? 5, shape.turn ?? 0))
      return
    }
    case 'cross': {
      // The Nordic cross: the upright sits left of centre, both arms the same
      // thickness, and both run the whole way across.
      const [across, thickness] = shape.at
      ctx.fillRect(across * w - (thickness * h) / 2, 0, thickness * h, h)
      ctx.fillRect(0, h / 2 - (thickness * h) / 2, w, thickness * h)
      return
    }
    case 'poly': {
      ctx.beginPath()
      shape.at.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x * w, y * h)
        else ctx.lineTo(x * w, y * h)
      })
      ctx.closePath()
      ctx.fill()
      return
    }
    case 'moon': {
      // A crescent is one disc with a second disc taken out of it, and the
      // second one is painted in the field colour rather than cut out, which
      // keeps this to two fills and no clipping.
      const [cx, cy, r, offset] = shape.at
      ctx.beginPath()
      ctx.arc(cx * w, cy * h, r * h, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = shape.bite
      ctx.beginPath()
      ctx.arc(cx * w + offset * h, cy * h, r * h * 0.82, 0, Math.PI * 2)
      ctx.fill()
      return
    }
  }
}

/**
 * Draws a flag into a box.
 *
 * The box is filled exactly: flags have their own proportions in real life,
 * but a row of quiz answers where one is a different shape to the others is a
 * row of quiz answers with a clue in it.
 */
export function drawFlag(
  ctx: CanvasRenderingContext2D,
  flag: Flag,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.clip()
  for (const shape of flag.shapes) paint(ctx, shape, w, h)
  ctx.restore()
}
