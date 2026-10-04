/**
 * Drawing the wall.
 *
 * Canvas primitives only, like everything else here. The whole field is drawn
 * to a fixed set of units and scaled to whatever screen it lands on, because
 * a brick game is a game of judging angles and an angle that changes with the
 * shape of the window is not a game.
 */
import {
  BALL_R, BRICK_INK, DROP_H, DROP_W, PADDLE_H, PADDLE_Y, POWERS, POWER_INK, SHOT_H, SHOT_W,
  SOLID_INK, TALL, WIDE, type Power,
} from './level'
import { batBox, boxOf, type Run } from './run'

type Ctx = CanvasRenderingContext2D

export interface View {
  w: number
  h: number
  clock: number
}

export const INK = {
  back: '#05060a',
  edge: '#2a3ad6',
  chalk: '#e8ebf5',
  dim: '#8a91ab',
  ball: '#ffd27a',
  bat: '#f49ac1',
  batTrim: '#a53f74',
} as const

/** The field, as a box on the screen, keeping its shape whatever the window. */
export function fieldOf(view: View): { x: number; y: number; scale: number } {
  const scale = Math.min(view.w / WIDE, view.h / TALL)
  return { x: (view.w - WIDE * scale) / 2, y: (view.h - TALL * scale) / 2, scale }
}

/**
 * The stars behind it.
 *
 * Scattered from a fixed set of numbers rather than stored, so the field looks
 * the same every time without an array of a hundred points living anywhere.
 */
function drawStars(ctx: Ctx, view: View, clock: number): void {
  ctx.save()
  for (let i = 0; i < 90; i++) {
    const x = ((i * 2654435761) % 10007) / 10007
    const y = ((i * 40503 + 7) % 10009) / 10009
    const twinkle = 0.35 + 0.45 * Math.sin(clock * 1.5 + i)
    ctx.globalAlpha = twinkle
    ctx.fillStyle = '#ffffff'
    const r = i % 11 === 0 ? 1.6 : 1
    ctx.fillRect(x * view.w, y * view.h, r, r)
  }
  ctx.restore()
}

/** One brick, with the bevel that makes a flat rectangle look like a thing. */
function drawBrick(
  ctx: Ctx,
  box: [number, number, number, number],
  ink: { face: string; edge: string; shine: string },
  flash: number,
): void {
  const [l, t, r, b] = box
  const w = r - l
  const h = b - t
  ctx.fillStyle = ink.edge
  ctx.fillRect(l, t, w, h)
  ctx.fillStyle = ink.face
  ctx.fillRect(l + w * 0.06, t + h * 0.1, w * 0.88, h * 0.8)
  // A highlight along the top and left, which is the whole of the bevel.
  ctx.fillStyle = ink.shine
  ctx.globalAlpha = 0.55
  ctx.fillRect(l + w * 0.06, t + h * 0.1, w * 0.88, Math.max(1, h * 0.14))
  ctx.fillRect(l + w * 0.06, t + h * 0.1, Math.max(1, w * 0.05), h * 0.8)
  ctx.globalAlpha = 1
  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash / 0.09)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(l, t, w, h)
    ctx.globalAlpha = 1
  }
}

/** A charm, by shape, so the powers are told apart without reading anything. */
export function drawCharm(ctx: Ctx, kind: Power, r: number): void {
  ctx.beginPath()
  if (kind === 'gun') {
    // Two barrels.
    ctx.rect(-r * 0.55, -r * 0.5, r * 0.3, r)
    ctx.rect(r * 0.25, -r * 0.5, r * 0.3, r)
  } else if (kind === 'sticky') {
    // A blob with a ball sitting on it.
    ctx.rect(-r * 0.7, r * 0.15, r * 1.4, r * 0.4)
    ctx.arc(0, -r * 0.25, r * 0.4, 0, Math.PI * 2)
  } else if (kind === 'slow') {
    // A tortoise shell: a dome with a line across it.
    ctx.arc(0, r * 0.2, r * 0.65, Math.PI, 0)
    ctx.rect(-r * 0.65, r * 0.1, r * 1.3, r * 0.22)
  } else if (kind === 'wide') {
    // Arrows pointing out.
    ctx.rect(-r * 0.2, -r * 0.18, r * 0.4, r * 0.36)
    ctx.moveTo(-r * 0.35, -r * 0.45)
    ctx.lineTo(-r * 0.75, 0)
    ctx.lineTo(-r * 0.35, r * 0.45)
    ctx.moveTo(r * 0.35, -r * 0.45)
    ctx.lineTo(r * 0.75, 0)
    ctx.lineTo(r * 0.35, r * 0.45)
  } else if (kind === 'split') {
    // Three balls.
    for (const [dx, dy] of [[0, -r * 0.4], [-r * 0.45, r * 0.3], [r * 0.45, r * 0.3]]) {
      ctx.moveTo(dx + r * 0.3, dy)
      ctx.arc(dx, dy, r * 0.3, 0, Math.PI * 2)
    }
  } else {
    // A heart, near enough, for a spare go.
    ctx.moveTo(0, r * 0.6)
    ctx.bezierCurveTo(-r * 1.1, -r * 0.1, -r * 0.45, -r * 0.8, 0, -r * 0.25)
    ctx.bezierCurveTo(r * 0.45, -r * 0.8, r * 1.1, -r * 0.1, 0, r * 0.6)
  }
  ctx.fill()
}

export function drawRun(ctx: Ctx, run: Run, view: View): void {
  ctx.fillStyle = INK.back
  ctx.fillRect(0, 0, view.w, view.h)
  drawStars(ctx, view, view.clock)

  const field = fieldOf(view)
  const at = (x: number, y: number) => ({ x: field.x + x * field.scale, y: field.y + y * field.scale })
  const px = (n: number) => n * field.scale

  ctx.save()
  // The border, which is also what says where the ball can go.
  const topLeft = at(0, 0)
  ctx.strokeStyle = INK.edge
  ctx.lineWidth = Math.max(2, px(0.08))
  ctx.strokeRect(topLeft.x, topLeft.y, px(WIDE), px(TALL))

  ctx.beginPath()
  ctx.rect(topLeft.x, topLeft.y, px(WIDE), px(TALL))
  ctx.clip()

  for (const brick of run.bricks) {
    const [l, t, r, b] = boxOf(brick)
    const a = at(l, t)
    const c = at(r, b)
    const ink = brick.solid ? SOLID_INK : BRICK_INK[Math.min(3, Math.max(1, brick.life))]
    drawBrick(ctx, [a.x, a.y, c.x, c.y], ink, brick.flash)
  }

  for (const drop of run.drops) {
    const middle = at(drop.x, drop.y + DROP_H / 2)
    ctx.save()
    ctx.translate(middle.x, middle.y)
    ctx.fillStyle = '#0d1016'
    ctx.globalAlpha = 0.75
    ctx.fillRect(-px(DROP_W / 2), -px(DROP_H / 2), px(DROP_W), px(DROP_H))
    ctx.globalAlpha = 1
    ctx.strokeStyle = POWER_INK[drop.kind]
    ctx.lineWidth = Math.max(1.5, px(0.05))
    ctx.strokeRect(-px(DROP_W / 2), -px(DROP_H / 2), px(DROP_W), px(DROP_H))
    ctx.fillStyle = POWER_INK[drop.kind]
    drawCharm(ctx, drop.kind, px(DROP_H * 0.42))
    ctx.restore()
  }

  for (const shot of run.shots) {
    const a = at(shot.x - SHOT_W / 2, shot.y)
    ctx.fillStyle = '#ff6b53'
    ctx.fillRect(a.x, a.y, px(SHOT_W), px(SHOT_H))
  }

  // The bat, with the gun on it when there is one.
  const [bl, bt, br] = batBox(run)
  const bat = at(bl, bt)
  const batW = px(br - bl)
  const batH = px(PADDLE_H)
  ctx.fillStyle = INK.batTrim
  ctx.fillRect(bat.x, bat.y, batW, batH)
  ctx.fillStyle = run.held.sticky !== undefined ? '#8ad48a' : INK.bat
  ctx.fillRect(bat.x + batW * 0.04, bat.y + batH * 0.18, batW * 0.92, batH * 0.6)
  if (run.held.gun !== undefined) {
    ctx.fillStyle = '#ff6b53'
    for (const side of [0.15, 0.85]) {
      ctx.fillRect(bat.x + batW * side - px(0.06), bat.y - px(0.22), px(0.12), px(0.22))
    }
  }

  for (const ball of run.balls) {
    const middle = at(ball.x, ball.y)
    const r = px(BALL_R)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(middle.x, middle.y, r * 1.5, 0, Math.PI * 2)
    ctx.globalAlpha = 0.18
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = INK.ball
    ctx.beginPath()
    ctx.arc(middle.x, middle.y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
  void PADDLE_Y
}

/** The powers in hand, as a row of charms along the bottom. */
export function drawHeld(ctx: Ctx, run: Run, x: number, y: number, r: number): void {
  let i = 0
  for (const kind of POWERS) {
    const left = run.held[kind]
    if (left === undefined) continue
    ctx.save()
    ctx.translate(x + i * r * 2.6, y)
    ctx.globalAlpha = Math.min(1, left)
    ctx.fillStyle = POWER_INK[kind]
    drawCharm(ctx, kind, r)
    ctx.restore()
    i += 1
  }
}
