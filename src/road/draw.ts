/**
 * The road, drawn.
 *
 * Seen from directly above, which is the only view that lets a small screen
 * show enough road ahead to react to. Everything is built from primitives —
 * there is not an image file anywhere in this project and there is not going
 * to be, because the whole thing has to work with the wifi off.
 *
 * The cars are our own. Yours is the one with the light bar across the nose,
 * which is the same visor the runner in the maze wears; {papa}'s are boxy
 * things with aerials, which is what his machines look like everywhere else.
 * At this size a vehicle is a coloured rectangle with two details on it, so
 * the two details have to be the ones that say whose it is.
 */
import { drawHint } from '../ui/padHints'
import { CAR_LONG, CAR_WIDE, LANES, SIGHT } from './level'
import type { Can, Car, Run } from './run'

type Ctx = CanvasRenderingContext2D

export const INK = {
  verge: '#2f9e44',
  vergeDark: '#22803a',
  kerb: '#e8ebf5',
  road: '#4a4f57',
  roadDark: '#40454c',
  line: '#e8ebf5',
  mine: '#ffd23f',
  visor: '#8ff0ff',
  can: '#ff6b53',
  canCap: '#ffc84a',
  shadow: 'rgba(0,0,0,0.35)',
} as const

/** {papa}'s fleet. Four of them, so a glance tells one from another. */
const FLEET = ['#e8503a', '#5ad2e0', '#f49ac1', '#b07de0'] as const

export interface View {
  /** Pixels across one lane. */
  lane: number
  /** Pixels down the screen per car length. */
  depth: number
  /** Left edge of the road, in pixels. */
  left: number
  /** Where along the screen his own car sits, in pixels from the top. */
  line: number
  /** How far he has come, so everything else can be placed relative to it. */
  distance: number
  clock: number
}

/** Where a lane sits on screen, at its centre. */
export const laneX = (view: View, lane: number) => view.left + (lane + 0.5) * view.lane
/** Where a point up the road sits on screen. */
export const roadY = (view: View, y: number) => view.line - (y - view.distance) * view.depth

export function roadWidth(view: View): number {
  return view.lane * LANES
}

/** The verges, the kerbs and the tarmac. */
export function drawRoad(ctx: Ctx, view: View, w: number, h: number): void {
  ctx.fillStyle = INK.verge
  ctx.fillRect(0, 0, w, h)

  // Hedges down both verges, moving with the road so the speed reads even
  // when there is no traffic to measure yourself against.
  const spacing = 3
  ctx.fillStyle = INK.vergeDark
  for (let n = Math.floor(view.distance / spacing) - 1; n < view.distance / spacing + 40; n++) {
    const y = roadY(view, n * spacing)
    if (y < -40 || y > h + 40) continue
    const size = view.lane * 0.3
    for (const x of [view.left * 0.5, view.left + roadWidth(view) + (w - view.left - roadWidth(view)) * 0.5]) {
      ctx.beginPath()
      ctx.ellipse(x, y, size, size * 0.8, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const road = roadWidth(view)
  ctx.fillStyle = INK.road
  ctx.fillRect(view.left, 0, road, h)

  // Kerbs.
  ctx.fillStyle = INK.kerb
  ctx.fillRect(view.left - view.lane * 0.06, 0, view.lane * 0.06, h)
  ctx.fillRect(view.left + road, 0, view.lane * 0.06, h)

  // Dashes between the lanes. Tied to the distance travelled rather than to a
  // clock, so they stand still when you do.
  ctx.fillStyle = INK.line
  const dash = 1.2
  for (let lane = 1; lane < LANES; lane++) {
    const x = view.left + lane * view.lane
    for (let n = Math.floor(view.distance / (dash * 2)) - 1; n < view.distance / (dash * 2) + 40; n++) {
      const y = roadY(view, n * dash * 2)
      if (y < -40 || y > h + 40) continue
      ctx.fillRect(x - view.lane * 0.02, y, view.lane * 0.04, dash * view.depth)
    }
  }
}

/** One of {papa}'s: a boxy thing with an aerial and a lit strip down the back. */
export function drawCar(ctx: Ctx, car: Car, view: View): void {
  const x = laneX(view, car.lane)
  const y = roadY(view, car.y)
  const wide = view.lane * CAR_WIDE
  const long = CAR_LONG * view.depth
  const colour = FLEET[car.kind % FLEET.length]

  ctx.fillStyle = INK.shadow
  ctx.beginPath()
  ctx.roundRect(x - wide / 2 + wide * 0.08, y - long / 2 + long * 0.06, wide, long, wide * 0.22)
  ctx.fill()

  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.roundRect(x - wide / 2, y - long / 2, wide, long, wide * 0.22)
  ctx.fill()

  // The cab, towards the back, because these are all heading away from you.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.roundRect(x - wide * 0.34, y - long * 0.1, wide * 0.68, long * 0.34, wide * 0.12)
  ctx.fill()

  // The aerial, which is what makes it one of his.
  ctx.strokeStyle = colour
  ctx.lineWidth = Math.max(1, wide * 0.08)
  ctx.beginPath()
  ctx.moveTo(x, y + long * 0.4)
  ctx.lineTo(x, y + long * 0.62)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y + long * 0.64, wide * 0.09, 0, Math.PI * 2)
  ctx.fill()
}

/** A fuel can, sitting in a lane. */
export function drawCan(ctx: Ctx, can: Can, view: View): void {
  const x = laneX(view, can.lane)
  const y = roadY(view, can.y)
  const size = view.lane * 0.34
  const bob = Math.sin(view.clock * 5 + can.id) * size * 0.08

  ctx.fillStyle = INK.shadow
  ctx.beginPath()
  ctx.ellipse(x, y + size * 0.7, size * 0.55, size * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = INK.can
  ctx.beginPath()
  ctx.roundRect(x - size / 2, y - size / 2 + bob, size, size, size * 0.18)
  ctx.fill()
  ctx.fillStyle = INK.canCap
  ctx.fillRect(x - size * 0.16, y - size * 0.62 + bob, size * 0.32, size * 0.16)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.52}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('F', x, y + bob + size * 0.04)
}

/** Yours: the light bar across the nose is the same visor the runner wears. */
export function drawMine(ctx: Ctx, lane: number, view: View, stunned: number): void {
  const x = laneX(view, lane)
  const y = view.line
  const wide = view.lane * CAR_WIDE
  const long = CAR_LONG * view.depth

  // A wreck flashes, so it is obvious the controls are not listening yet.
  if (stunned > 0 && Math.floor(stunned * 12) % 2 === 0) return

  ctx.fillStyle = INK.shadow
  ctx.beginPath()
  ctx.roundRect(x - wide / 2 + wide * 0.08, y - long / 2 + long * 0.06, wide, long, wide * 0.22)
  ctx.fill()

  ctx.fillStyle = INK.mine
  ctx.beginPath()
  ctx.roundRect(x - wide / 2, y - long / 2, wide, long, wide * 0.22)
  ctx.fill()

  ctx.fillStyle = INK.visor
  ctx.beginPath()
  ctx.roundRect(x - wide * 0.36, y - long * 0.42, wide * 0.72, long * 0.22, wide * 0.1)
  ctx.fill()

  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.roundRect(x - wide * 0.3, y - long * 0.02, wide * 0.6, long * 0.3, wide * 0.1)
  ctx.fill()
}

/** Everything on the road, in the order it has to be drawn. */
export function drawRun(ctx: Ctx, run: Run, lane: number, view: View, w: number, h: number): void {
  drawRoad(ctx, view, w, h)
  for (const can of run.cans) {
    if (can.taken) continue
    const y = can.y - view.distance
    if (y < -CAR_LONG * 2 || y > SIGHT * 1.6) continue
    drawCan(ctx, can, view)
  }
  for (const car of run.cars) {
    const y = car.y - view.distance
    if (y < -CAR_LONG * 2 || y > SIGHT * 1.6) continue
    drawCar(ctx, car, view)
  }
  drawMine(ctx, lane, view, run.stunned)
}

/**
 * The pad.
 *
 * Same look as everywhere else in the app — a dark disc that brightens under a
 * thumb — with the labels sitting above the buttons rather than inside them,
 * because a word small enough to fit inside one of these is too small to read
 * on a phone.
 */
export function drawPad(
  ctx: Ctx,
  keys: { id: string; cx: number; cy: number; r: number; glyph: string }[],
  pressed: Record<string, boolean>,
  hints?: { alpha: number; labels: Record<string, string> },
): void {
  for (const key of keys) {
    const down = pressed[key.id]
    ctx.globalAlpha = down ? 0.8 : 0.4
    ctx.fillStyle = '#0d1016'
    ctx.beginPath()
    ctx.arc(key.cx, key.cy, key.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = down ? '#ffe08a' : '#cdd6e2'
    ctx.lineWidth = Math.max(2, key.r * 0.09)
    ctx.stroke()

    const a = key.r * 0.42
    ctx.fillStyle = down ? '#ffe08a' : '#eef2f8'
    if (key.glyph === 'left' || key.glyph === 'right') {
      const turn = key.glyph === 'left' ? Math.PI : 0
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const angle = turn + (i * Math.PI * 2) / 3
        const gx = key.cx + Math.cos(angle) * a
        const gy = key.cy + Math.sin(angle) * a
        if (i === 0) ctx.moveTo(gx, gy)
        else ctx.lineTo(gx, gy)
      }
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.font = `bold ${key.r * (key.glyph === 'go' ? 0.5 : 0.38)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(key.glyph === 'go' ? 'GO' : 'STOP', key.cx, key.cy)
    }
    ctx.globalAlpha = 1
  }

  if (hints && hints.alpha > 0) {
    for (const key of keys) {
      const text = hints.labels[key.id]
      if (!text) continue
      drawHint(ctx, key.cx, key.cy - key.r * 1.45, text, Math.max(9, key.r * 0.3), hints.alpha)
    }
  }
}
