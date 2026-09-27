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
import { CAR_LONG, CAR_WIDE, LANES, LENGTH_OF, SIGHT, WIDTH_OF, type CarKind } from './level'
import type { Can, Car, Racing, Run } from './run'

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

/**
 * How each sort of vehicle is painted.
 *
 * A glance has to tell them apart, so each one gets a colour and a shape
 * rather than relying on either alone — at this size colour-blind-unfriendly
 * pairs and similar outlines both read as "a car".
 */
const PAINT: Record<CarKind, { body: string; trim: string; glass: string }> = {
  cruiser: { body: '#5ad2e0', trim: '#2a8f9c', glass: '#0d2b30' },
  taxi: { body: '#f0c419', trim: '#14161c', glass: '#2a2410' },
  van: { body: '#e8ebf5', trim: '#8a91ab', glass: '#1a2028' },
  truck: { body: '#b07de0', trim: '#5f3f8f', glass: '#1a1030' },
  bus: { body: '#e8503a', trim: '#7a2418', glass: '#2a0d08' },
  patrol: { body: '#eef2f8', trim: '#1a2a5e', glass: '#0d1630' },
  ambulance: { body: '#f7f7f2', trim: '#e0b13c', glass: '#1a2028' },
  swerver: { body: '#ff3d3d', trim: '#8f1414', glass: '#2a0808' },
}

type Shape = { x: number; y: number }[]

/**
 * A body, tapered.
 *
 * Every vehicle here is a closed outline given as a fraction of its own width
 * and length, with the corners rounded off. That is what stops them being
 * rectangles: a nose narrower than the shoulders, and shoulders narrower than
 * the tail, reads as something built to go forwards.
 */
function body(ctx: Ctx, x: number, y: number, wide: number, long: number, shape: Shape, round: number): void {
  const at = (p: Shape[number]) => ({ px: x + p.x * wide * 0.5, py: y + p.y * long * 0.5 })
  ctx.beginPath()
  for (let i = 0; i < shape.length; i++) {
    const here = at(shape[i])
    const next = at(shape[(i + 1) % shape.length])
    const prev = at(shape[(i + shape.length - 1) % shape.length])
    const pull = (from: { px: number; py: number }, to: { px: number; py: number }) => {
      const dx = to.px - from.px
      const dy = to.py - from.py
      const len = Math.hypot(dx, dy) || 1
      const step = Math.min(round, len / 2) / len
      return { px: from.px + dx * step, py: from.py + dy * step }
    }
    const from = pull(here, prev)
    const to = pull(here, next)
    if (i === 0) ctx.moveTo(from.px, from.py)
    else ctx.lineTo(from.px, from.py)
    ctx.quadraticCurveTo(here.px, here.py, to.px, to.py)
  }
  ctx.closePath()
}

/** A single-seater: pointed nose, pinched waist, broad tail. */
const RACER: Shape = [
  { x: -0.22, y: -1 }, { x: 0.22, y: -1 },
  { x: 0.42, y: -0.52 }, { x: 0.34, y: -0.1 },
  { x: 0.5, y: 0.34 }, { x: 0.44, y: 1 },
  { x: -0.44, y: 1 }, { x: -0.5, y: 0.34 },
  { x: -0.34, y: -0.1 }, { x: -0.42, y: -0.52 },
]

/** A saloon: sloped bonnet, straight flanks, tucked boot. */
const SALOON: Shape = [
  { x: -0.3, y: -1 }, { x: 0.3, y: -1 },
  { x: 0.48, y: -0.62 }, { x: 0.5, y: 0.5 },
  { x: 0.36, y: 1 }, { x: -0.36, y: 1 },
  { x: -0.5, y: 0.5 }, { x: -0.48, y: -0.62 },
]

/** A low wedge with the shoulders set back. */
const WEDGE: Shape = [
  { x: -0.24, y: -1 }, { x: 0.24, y: -1 },
  { x: 0.5, y: -0.3 }, { x: 0.5, y: 0.62 },
  { x: 0.3, y: 1 }, { x: -0.3, y: 1 },
  { x: -0.5, y: 0.62 }, { x: -0.5, y: -0.3 },
]

/** A van: short bonnet, tall square box behind it. */
const VAN: Shape = [
  { x: -0.34, y: -1 }, { x: 0.34, y: -1 },
  { x: 0.48, y: -0.8 }, { x: 0.5, y: -0.5 },
  { x: 0.5, y: 0.94 }, { x: 0.42, y: 1 },
  { x: -0.42, y: 1 }, { x: -0.5, y: 0.94 },
  { x: -0.5, y: -0.5 }, { x: -0.48, y: -0.8 },
]

/** A box on wheels, near enough the full length of its lane. */
const BOX: Shape = [
  { x: -0.44, y: -1 }, { x: 0.44, y: -1 },
  { x: 0.5, y: -0.92 }, { x: 0.5, y: 0.92 },
  { x: 0.44, y: 1 }, { x: -0.44, y: 1 },
  { x: -0.5, y: 0.92 }, { x: -0.5, y: -0.92 },
]

const SHAPE_OF: Record<CarKind, Shape> = {
  cruiser: SALOON,
  taxi: SALOON,
  van: VAN,
  truck: BOX,
  bus: BOX,
  patrol: SALOON,
  ambulance: VAN,
  swerver: WEDGE,
}

/** Four wheels, poking out at the corners, which is most of what says "car". */
function wheels(ctx: Ctx, x: number, y: number, wide: number, long: number, out: number): void {
  ctx.fillStyle = '#14161c'
  const tyreW = wide * 0.17
  const tyreL = long * 0.2
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.beginPath()
      ctx.roundRect(
        x + sx * (wide * 0.5 + out) - tyreW / 2,
        y + sy * long * 0.3 - tyreL / 2,
        tyreW, tyreL, tyreW * 0.35,
      )
      ctx.fill()
    }
  }
}

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

  ctx.fillStyle = INK.kerb
  ctx.fillRect(view.left - view.lane * 0.06, 0, view.lane * 0.06, h)
  ctx.fillRect(view.left + road, 0, view.lane * 0.06, h)

  // Dashes between the lanes, tied to the distance travelled rather than to a
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

/**
 * The line, and the banner over it.
 *
 * A stage used to simply stop: you were driving, and then you were reading a
 * panel. Seeing the chequers coming from a long way off is most of what makes
 * the last twenty lengths of a stage worth driving.
 */
export function drawFinish(ctx: Ctx, at: number, view: View): void {
  const y = roadY(view, at)
  const road = roadWidth(view)
  const band = view.depth * 1.6
  if (y < -band * 2 || y > view.line + band * 4) return

  const squares = 8
  const size = road / squares
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < squares; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#eef2f8' : '#14161c'
      ctx.fillRect(view.left + col * size, y - band / 2 + row * (band / 2), size, band / 2)
    }
  }

  // Posts either side, so it reads as a gantry rather than a painted stripe.
  ctx.fillStyle = '#eef2f8'
  ctx.fillRect(view.left - view.lane * 0.22, y - band * 1.1, view.lane * 0.16, band * 2.2)
  ctx.fillRect(view.left + road + view.lane * 0.06, y - band * 1.1, view.lane * 0.16, band * 2.2)
}

/** One of {papa}'s, coming the other way. */
export function drawCar(ctx: Ctx, car: Car, view: View): void {
  const x = laneX(view, car.lane)
  const y = roadY(view, car.y)
  const wide = view.lane * WIDTH_OF[car.kind]
  const long = CAR_LONG * LENGTH_OF[car.kind] * view.depth
  const paint = PAINT[car.kind]
  const round = wide * 0.16

  ctx.fillStyle = INK.shadow
  body(ctx, x + wide * 0.07, y + long * 0.05, wide, long, SHAPE_OF[car.kind], round)
  ctx.fill()

  wheels(ctx, x, y, wide * 0.92, long, -wide * 0.04)

  ctx.fillStyle = paint.body
  body(ctx, x, y, wide, long, SHAPE_OF[car.kind], round)
  ctx.fill()

  // The glass, towards the back: these are all travelling away from you.
  ctx.fillStyle = paint.glass
  ctx.beginPath()
  ctx.roundRect(x - wide * 0.3, y + long * 0.02, wide * 0.6, long * 0.3, wide * 0.1)
  ctx.fill()
  ctx.fillStyle = paint.trim
  ctx.beginPath()
  ctx.roundRect(x - wide * 0.34, y - long * 0.3, wide * 0.68, long * 0.16, wide * 0.08)
  ctx.fill()

  if (car.kind === 'truck') {
    // A cab at the front and a container behind it, with ribs down the sides.
    ctx.fillStyle = paint.trim
    ctx.fillRect(x - wide * 0.46, y - long * 0.12, wide * 0.92, long * 0.05)
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x - wide * 0.44, y + long * (0.02 + i * 0.18), wide * 0.88, long * 0.05)
    }
  }

  if (car.kind === 'bus') {
    // A row of windows down each side, which is the whole of what says bus.
    ctx.fillStyle = paint.glass
    for (let i = 0; i < 5; i++) {
      const wy = y - long * 0.28 + i * long * 0.28
      ctx.fillRect(x - wide * 0.47, wy, wide * 0.12, long * 0.17)
      ctx.fillRect(x + wide * 0.35, wy, wide * 0.12, long * 0.17)
    }
    ctx.fillStyle = paint.trim
    ctx.fillRect(x - wide * 0.5, y + long * 0.06, wide, long * 0.05)
  }

  if (car.kind === 'taxi') {
    // A sign on the roof and a chequer down the flank.
    ctx.fillStyle = '#14161c'
    ctx.fillRect(x - wide * 0.16, y - long * 0.24, wide * 0.32, long * 0.12)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#14161c' : '#eef2f8'
      ctx.fillRect(x - wide * 0.5, y + long * (0.1 + i * 0.07), wide * 0.07, long * 0.07)
      ctx.fillRect(x + wide * 0.43, y + long * (0.1 + i * 0.07), wide * 0.07, long * 0.07)
    }
  }

  if (car.kind === 'van') {
    ctx.fillStyle = paint.trim
    ctx.fillRect(x - wide * 0.44, y + long * 0.2, wide * 0.88, long * 0.06)
  }

  if (car.kind === 'patrol') {
    const on = Math.floor(view.clock * 6) % 2 === 0
    ctx.fillStyle = on ? '#3d7bff' : '#ff3d3d'
    ctx.fillRect(x - wide * 0.4, y - long * 0.1, wide * 0.38, long * 0.08)
    ctx.fillStyle = on ? '#ff3d3d' : '#3d7bff'
    ctx.fillRect(x + wide * 0.02, y - long * 0.1, wide * 0.38, long * 0.08)
    ctx.fillStyle = paint.trim
    ctx.fillRect(x - wide * 0.5, y + long * 0.14, wide, long * 0.09)
  }

  if (car.kind === 'ambulance') {
    ctx.fillStyle = '#e8503a'
    const armW = wide * 0.1
    const armL = long * 0.18
    ctx.fillRect(x - armW / 2, y + long * 0.3, armW, armL)
    ctx.fillRect(x - armL / 2, y + long * 0.3 + armL / 2 - armW / 2, armL, armW)
    const on = Math.floor(view.clock * 7) % 2 === 0
    ctx.fillStyle = on ? '#3d7bff' : '#0d1630'
    ctx.beginPath()
    ctx.arc(x, y - long * 0.44, wide * 0.1, 0, Math.PI * 2)
    ctx.fill()
  }

  if (car.kind === 'swerver') {
    // A rear wing, because the one that comes after you should look like it.
    ctx.fillStyle = paint.trim
    ctx.fillRect(x - wide * 0.54, y + long * 0.4, wide * 1.08, long * 0.1)
  }

  // Lamps: red at the back of everything, which is the end you are looking at.
  ctx.fillStyle = '#ff4d3d'
  ctx.fillRect(x - wide * 0.42, y + long * 0.42, wide * 0.16, long * 0.05)
  ctx.fillRect(x + wide * 0.26, y + long * 0.42, wide * 0.16, long * 0.05)

  /*
   * The indicator.
   *
   * Amber, blinking, on the side it is about to pull towards, and it comes on
   * most of a second before anything moves. Traffic that changes lane without
   * warning can only be read by knowing the road already; traffic that tells
   * you first is a puzzle you can solve on sight.
   *
   * Drawn well outside the body so it is visible against the tarmac rather
   * than lost against the paintwork.
   */
  if (car.signal !== 0 && Math.floor(view.clock * 5) % 2 === 0) {
    const side = car.signal
    ctx.fillStyle = '#ffb02e'
    for (const end of [-0.38, 0.34]) {
      ctx.beginPath()
      ctx.ellipse(
        x + side * wide * 0.62, y + long * end,
        wide * 0.12, long * 0.05, 0, 0, Math.PI * 2,
      )
      ctx.fill()
    }
  }
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

/**
 * Yours: an open-wheel single-seater.
 *
 * Pointed nose, wheels outside the bodywork, a wing at each end — the shape
 * says "fastest thing here" before anything else on screen does, which is the
 * one thing your own car has to say. The visor is the same light bar the
 * runner in the maze wears, because it is the same person driving.
 */
export function drawMine(
  ctx: Ctx,
  lane: number,
  view: View,
  stunned: number,
  mercy = 0,
): void {
  const x = laneX(view, lane)
  const y = view.line
  const wide = view.lane * CAR_WIDE
  const long = CAR_LONG * view.depth

  // A wreck flashes, so it is obvious the controls are not listening yet.
  if (stunned > 0 && Math.floor(stunned * 12) % 2 === 0) return
  // And so does a car that cannot be hit yet, for the same reason: the state
  // the game is in should be visible without being explained.
  if (stunned <= 0 && mercy > 0 && Math.floor(mercy * 9) % 2 === 0) return

  ctx.fillStyle = INK.shadow
  body(ctx, x + wide * 0.07, y + long * 0.05, wide, long, RACER, wide * 0.16)
  ctx.fill()

  wheels(ctx, x, y, wide * 0.86, long, wide * 0.06)

  ctx.fillStyle = INK.mine
  body(ctx, x, y, wide, long, RACER, wide * 0.16)
  ctx.fill()

  // Front wing, cockpit, rear wing.
  ctx.fillStyle = '#c99a1f'
  ctx.fillRect(x - wide * 0.46, y - long * 0.52, wide * 0.92, long * 0.08)
  ctx.fillRect(x - wide * 0.5, y + long * 0.42, wide, long * 0.1)

  ctx.fillStyle = INK.visor
  ctx.beginPath()
  ctx.ellipse(x, y - long * 0.02, wide * 0.19, long * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0d2b30'
  ctx.beginPath()
  ctx.ellipse(x, y + long * 0.02, wide * 0.13, long * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * One of the four you are racing.
 *
 * The same shape as your own car, because they are the same kind of thing —
 * that is the point of them. Their own colours, a number on the nose, and the
 * indicator, because a racer pulling out gives the same warning everything
 * else on this road does.
 */
export function drawRacer(ctx: Ctx, racer: Racing, view: View): void {
  const x = laneX(view, racer.lane)
  const y = roadY(view, racer.y)
  const wide = view.lane * CAR_WIDE
  const long = CAR_LONG * view.depth

  ctx.fillStyle = INK.shadow
  body(ctx, x + wide * 0.07, y + long * 0.05, wide, long, RACER, wide * 0.16)
  ctx.fill()

  wheels(ctx, x, y, wide * 0.86, long, wide * 0.06)

  ctx.fillStyle = racer.who.colour
  body(ctx, x, y, wide, long, RACER, wide * 0.16)
  ctx.fill()

  ctx.fillStyle = racer.who.trim
  ctx.fillRect(x - wide * 0.46, y - long * 0.52, wide * 0.92, long * 0.08)
  ctx.fillRect(x - wide * 0.5, y + long * 0.42, wide, long * 0.1)

  ctx.fillStyle = INK.visor
  ctx.beginPath()
  ctx.ellipse(x, y - long * 0.02, wide * 0.19, long * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()

  // Rear lamps, since you are usually looking at the back of one.
  ctx.fillStyle = '#ff5b4a'
  for (const side of [-1, 1]) {
    ctx.fillRect(x + side * wide * 0.32 - wide * 0.06, y + long * 0.34, wide * 0.12, long * 0.06)
  }

  if (racer.signal !== 0 && Math.floor(view.clock * 5) % 2 === 0) {
    ctx.fillStyle = '#ffb02e'
    for (const end of [-0.38, 0.34]) {
      ctx.beginPath()
      ctx.ellipse(
        x + racer.signal * wide * 0.62, y + long * end,
        wide * 0.1, long * 0.06, 0, 0, Math.PI * 2,
      )
      ctx.fill()
    }
  }
}

/** Everything on the road, in the order it has to be drawn. */
export function drawRun(ctx: Ctx, run: Run, lane: number, view: View, w: number, h: number): void {
  drawRoad(ctx, view, w, h)
  drawFinish(ctx, run.stage.distance, view)
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
  for (const racer of run.racers) {
    if (racer.finished !== null) continue
    const y = racer.y - view.distance
    // Further back than the traffic, because the field comes up behind you
    // and headlights in the mirror are half the point of having one.
    if (y < -CAR_LONG * 4 || y > SIGHT * 1.6) continue
    drawRacer(ctx, racer, view)
  }
  drawMine(ctx, lane, view, run.stunned, run.mercy)
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
      ctx.font = `bold ${key.r * (key.glyph === 'go' ? 0.5 : 0.3)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(key.glyph === 'go' ? 'GO' : 'BRAKE', key.cx, key.cy)
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
