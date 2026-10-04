/**
 * Drawing the garden.
 *
 * Canvas primitives only, like everything else in here: there is not an image
 * file in this project and there is not going to be one.
 *
 * The camera follows the head and pulls back as the snake grows, which is the
 * one thing this kind of game cannot do without. A fixed camera on a snake
 * forty units long shows you a wall of your own body and nothing you could
 * steer by, and the moment the camera pulls back too far the pellets vanish.
 */
import {
  ARENA, GIRTH, POWERS, POWER_INK, PICKUP, type Power,
} from './level'
import { bodyOf, girthOf, headOf, type Point, type Run, type Snake } from './run'

type Ctx = CanvasRenderingContext2D

export interface View {
  w: number
  h: number
  clock: number
}

export const INK = {
  back: '#0b1410',
  soil: '#13241c',
  line: '#20382b',
  wall: '#3f6b52',
  you: '#e9f2a6',
  youTrim: '#8fae3a',
  chalk: '#e8ebf5',
  dim: '#8a91ab',
} as const

/**
 * How much of the garden fits on the screen.
 *
 * Grows with the snake, so a long one can see the shape it is drawing — but
 * slowly, and with a floor and a ceiling, because the pellets have to stay
 * big enough to aim at.
 */
export function zoomFor(length: number, view: View): number {
  const across = Math.min(view.w, view.h)
  const want = 7 + Math.min(9, length * 0.22)
  return across / want
}

const camera = (run: Run, view: View) => {
  const you = run.snakes[0]
  const head = you ? headOf(you) : { x: 0, y: 0 }
  const zoom = zoomFor(you?.length ?? 0, view)
  return { zoom, cx: head.x, cy: head.y }
}

/** Garden units to pixels. */
const at = (p: Point, cam: { zoom: number; cx: number; cy: number }, view: View) => ({
  x: view.w / 2 + (p.x - cam.cx) * cam.zoom,
  y: view.h / 2 + (p.y - cam.cy) * cam.zoom,
})

function drawGround(ctx: Ctx, cam: { zoom: number; cx: number; cy: number }, view: View): void {
  ctx.fillStyle = INK.back
  ctx.fillRect(0, 0, view.w, view.h)

  // Inside the wall is a different colour from outside it, so the edge of the
  // world reads as ground running out rather than as a line drawn on it.
  const middle = at({ x: 0, y: 0 }, cam, view)
  ctx.save()
  ctx.beginPath()
  ctx.arc(middle.x, middle.y, ARENA * cam.zoom, 0, Math.PI * 2)
  ctx.fillStyle = INK.soil
  ctx.fill()
  ctx.clip()

  // A grid, so that moving reads as moving. Without it a snake on open ground
  // at a steady speed looks like it is standing still.
  const step = cam.zoom
  ctx.strokeStyle = INK.line
  ctx.lineWidth = 1
  ctx.beginPath()
  const firstX = view.w / 2 - ((cam.cx % 1) * cam.zoom)
  for (let x = firstX % step; x < view.w; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, view.h)
  }
  const firstY = view.h / 2 - ((cam.cy % 1) * cam.zoom)
  for (let y = firstY % step; y < view.h; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(view.w, y)
  }
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = INK.wall
  ctx.lineWidth = Math.max(3, cam.zoom * 0.14)
  ctx.beginPath()
  ctx.arc(middle.x, middle.y, ARENA * cam.zoom, 0, Math.PI * 2)
  ctx.stroke()
}

function drawSnake(ctx: Ctx, s: Snake, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View, clock: number): void {
  if (!s.alive) return
  const mine = s.id === run.snakes[0]?.id
  const ink = mine ? INK.you : s.who?.ink ?? INK.you
  const trim = mine ? INK.youTrim : s.who?.trim ?? INK.youTrim
  const beads = bodyOf(s)
  const fat = girthOf(s) * cam.zoom

  // Off the screen entirely? Nothing to draw, and on a long snake that is most
  // of the work saved.
  const head = at(headOf(s), cam, view)
  const span = (s.length + GIRTH) * cam.zoom
  if (head.x + span < -50 || head.x - span > view.w + 50) return
  if (head.y + span < -50 || head.y - span > view.h + 50) return

  const ghosting = s.held.ghost !== undefined
  ctx.save()
  if (ghosting) ctx.globalAlpha = 0.45

  // Drawn as one stroked line rather than a bead at a time: a hundred filled
  // circles a frame is the whole frame on a phone, and a round join makes the
  // same shape for nothing.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = trim
  ctx.lineWidth = fat
  ctx.beginPath()
  for (let i = beads.length - 1; i >= 0; i--) {
    const p = at(beads[i], cam, view)
    if (i === beads.length - 1) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()
  ctx.strokeStyle = ink
  ctx.lineWidth = fat * 0.7
  ctx.stroke()

  // The flash when a ring has just closed on this snake.
  if (s.flash > 0) {
    ctx.strokeStyle = '#ffe08a'
    ctx.globalAlpha = (ghosting ? 0.45 : 1) * (s.flash / 0.35)
    ctx.lineWidth = fat * 0.4
    ctx.stroke()
    ctx.globalAlpha = ghosting ? 0.45 : 1
  }

  // The head, and a face on it, because a line with eyes is a creature and a
  // line without them is a line.
  const look = s.heading
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(head.x, head.y, fat * 0.62, 0, Math.PI * 2)
  ctx.fill()
  for (const side of [-1, 1]) {
    const ex = head.x + Math.cos(look) * fat * 0.26 + Math.cos(look + Math.PI / 2) * fat * 0.3 * side
    const ey = head.y + Math.sin(look) * fat * 0.26 + Math.sin(look + Math.PI / 2) * fat * 0.3 * side
    ctx.fillStyle = '#f7fbff'
    ctx.beginPath()
    ctx.arc(ex, ey, fat * 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#14161f'
    ctx.beginPath()
    ctx.arc(ex + Math.cos(look) * fat * 0.07, ey + Math.sin(look) * fat * 0.07, fat * 0.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // A name over a rival, which is most of what makes five of them feel like
  // five of somebody rather than five of something.
  if (!mine && s.who) {
    ctx.font = `bold ${Math.max(9, fat * 0.5)}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = INK.dim
    ctx.fillText(s.who.name, head.x, head.y - fat * 0.9)
  }
  void clock
}

function drawPellets(ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View, clock: number): void {
  for (const p of run.pellets) {
    const q = at(p, cam, view)
    if (q.x < -20 || q.x > view.w + 20 || q.y < -20 || q.y > view.h + 20) continue
    const r = (p.big ? 0.13 : 0.08) * cam.zoom
    // A slow shimmer, out of phase per pellet, so a field of them is alive.
    const glow = 0.7 + 0.3 * Math.sin(clock * 2 + p.id)
    ctx.globalAlpha = glow
    ctx.fillStyle = p.big ? '#ffd27a' : '#9fe08a'
    ctx.beginPath()
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawDrops(ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View, clock: number): void {
  for (const d of run.drops) {
    const q = at(d, cam, view)
    if (q.x < -40 || q.x > view.w + 40 || q.y < -40 || q.y > view.h + 40) continue
    const r = PICKUP * cam.zoom * 0.8
    const lift = Math.sin(clock * 2.4 + d.bob * 6) * r * 0.18
    ctx.save()
    ctx.translate(q.x, q.y + lift)
    ctx.globalAlpha = 0.25
    ctx.fillStyle = POWER_INK[d.kind]
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = POWER_INK[d.kind]
    drawCharm(ctx, d.kind, r)
    ctx.restore()
  }
}

/** A shape per power, so they are told apart without reading anything. */
function drawCharm(ctx: Ctx, kind: Power, r: number): void {
  ctx.beginPath()
  if (kind === 'dash') {
    // A chevron: the arrow shape that means "faster" everywhere.
    ctx.moveTo(-r * 0.5, -r * 0.7)
    ctx.lineTo(r * 0.6, 0)
    ctx.lineTo(-r * 0.5, r * 0.7)
    ctx.lineTo(-r * 0.15, 0)
    ctx.closePath()
  } else if (kind === 'ghost') {
    // A ring: something you can see through.
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2)
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2, true)
  } else if (kind === 'lure') {
    // A flower, which is the thing food comes from.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.moveTo(0, 0)
      ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.3, 0, Math.PI * 2)
    }
  } else {
    // A snowflake's six spokes, blunt enough to read at this size.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75)
    }
    ctx.lineWidth = r * 0.22
    ctx.strokeStyle = POWER_INK.frost
    ctx.stroke()
    return
  }
  ctx.fill('evenodd')
}

/** The ring that just closed, held on screen for a moment. */
function drawRing(ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View): void {
  if (!run.ring || run.ring.length < 3) return
  const fade = Math.min(1, run.ringFor / 0.8)
  ctx.save()
  ctx.globalAlpha = fade * 0.4
  ctx.fillStyle = '#ffe08a'
  ctx.beginPath()
  run.ring.forEach((p, i) => {
    const q = at(p, cam, view)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  })
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * The little map in the corner.
 *
 * Five rivals in a garden this size are off the screen most of the time, and a
 * fight you cannot see coming is a fight you lose for no reason you could
 * name.
 */
function drawMap(ctx: Ctx, run: Run, view: View): void {
  const r = Math.min(view.w, view.h) * 0.11
  const cx = view.w - r - 12
  const cy = r + 12
  ctx.save()
  ctx.globalAlpha = 0.75
  ctx.fillStyle = '#0b1410'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = INK.wall
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.globalAlpha = 1
  for (const s of run.snakes) {
    if (!s.alive) continue
    const head = headOf(s)
    const mine = s.id === run.snakes[0]?.id
    const x = cx + (head.x / ARENA) * r * 0.92
    const y = cy + (head.y / ARENA) * r * 0.92
    ctx.fillStyle = mine ? INK.you : s.who?.ink ?? INK.dim
    ctx.beginPath()
    ctx.arc(x, y, mine ? 3.4 : 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawRun(ctx: Ctx, run: Run, view: View): void {
  const cam = camera(run, view)
  drawGround(ctx, cam, view)
  drawRing(ctx, run, cam, view)
  drawPellets(ctx, run, cam, view, view.clock)
  drawDrops(ctx, run, cam, view, view.clock)
  /*
   * Rivals first and you last, so your own head is never hidden under
   * somebody else's body. Which matters more here than it sounds: the head is
   * the only part of you that can be killed, so it is the only part worth
   * looking at.
   */
  for (const s of run.snakes) if (s.id !== run.snakes[0]?.id) drawSnake(ctx, s, run, cam, view, view.clock)
  if (run.snakes[0]) drawSnake(ctx, run.snakes[0], run, cam, view, view.clock)
  drawMap(ctx, run, view)
}

/** The powers in hand, as a row of charms with the time left on each. */
export function drawHeld(ctx: Ctx, run: Run, x: number, y: number, r: number): void {
  const you = run.snakes[0]
  if (!you) return
  let i = 0
  for (const kind of POWERS) {
    const left = you.held[kind]
    if (left === undefined) continue
    ctx.save()
    ctx.translate(x + i * r * 2.5, y)
    ctx.globalAlpha = Math.min(1, left)
    ctx.fillStyle = POWER_INK[kind]
    drawCharm(ctx, kind, r)
    ctx.restore()
    i += 1
  }
}
