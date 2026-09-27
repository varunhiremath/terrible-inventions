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
import {
  CAR_LONG, CAR_WIDE, GRID, GRID_ROW, LANES, LENGTH_OF, POLE, SIGHT, WIDTH_OF,
  type Build, type CarKind, type Face,
} from './level'
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

/** A stock car: wide shoulders, a nipped-in waist, and a lot of rear wing. */
const STOCK: Shape = [
  { x: -0.38, y: -1 }, { x: 0.38, y: -1 },
  { x: 0.5, y: -0.62 }, { x: 0.44, y: -0.1 },
  { x: 0.5, y: 0.4 }, { x: 0.46, y: 1 },
  { x: -0.46, y: 1 }, { x: -0.5, y: 0.4 },
  { x: -0.44, y: -0.1 }, { x: -0.5, y: -0.62 },
]

/** A tow truck: a snub nose, a cab, and a flat deck behind it. */
const TOW: Shape = [
  { x: -0.36, y: -1 }, { x: 0.36, y: -1 },
  { x: 0.46, y: -0.86 }, { x: 0.46, y: -0.2 },
  { x: 0.4, y: -0.12 }, { x: 0.4, y: 0.92 },
  { x: -0.4, y: 0.92 }, { x: -0.4, y: -0.12 },
  { x: -0.46, y: -0.2 }, { x: -0.46, y: -0.86 },
]

/** A little coupé: round at both ends and not much in between. */
const COUPE: Shape = [
  { x: -0.34, y: -1 }, { x: 0.34, y: -1 },
  { x: 0.44, y: -0.66 }, { x: 0.46, y: 0.3 },
  { x: 0.3, y: 0.92 }, { x: -0.3, y: 0.92 },
  { x: -0.46, y: 0.3 }, { x: -0.44, y: -0.66 },
]

/** A camper: a stubby bonnet and a great tall box on the back. */
const CAMPER: Shape = [
  { x: -0.32, y: -1 }, { x: 0.32, y: -1 },
  { x: 0.44, y: -0.88 }, { x: 0.46, y: -0.62 },
  { x: 0.5, y: -0.54 }, { x: 0.5, y: 0.96 },
  { x: -0.5, y: 0.96 }, { x: -0.5, y: -0.54 },
  { x: -0.46, y: -0.62 }, { x: -0.44, y: -0.88 },
]

export const BUILD_OF: Record<Build, Shape> = {
  stock: STOCK,
  tow: TOW,
  coupe: COUPE,
  camper: CAMPER,
}

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

/**
 * The grid, painted on the tarmac.
 *
 * A start line with kerbs either side, and a numbered box for every slot, laid
 * out in the two staggered columns a real grid uses. It is paint, so it is
 * drawn under everything and scrolls away behind you like the lane markings —
 * which is the right behaviour: the grid is a place on the road, not a screen
 * the game shows you before it starts.
 *
 * Only near the line, because there is no sense drawing a start line a
 * kilometre behind.
 */
export function drawGrid(ctx: Ctx, view: View): void {
  const road = roadWidth(view)
  // In front of pole, not behind the last car: the grid lines up behind the
  // start line, which is the whole reason it is called that.
  const lineY = roadY(view, GRID_ROW * 4 + CAR_LONG * 1.3)
  const band = view.depth * 0.9
  if (lineY < -view.depth * 8 || roadY(view, 0) > view.line + view.depth * 6) return

  // The start line itself: a solid white band, with a red and white kerb
  // running out to each verge.
  ctx.fillStyle = '#eef2f8'
  ctx.fillRect(view.left, lineY - band / 2, road, band)
  const kerb = view.lane * 0.5
  for (const side of [view.left - kerb, view.left + road]) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d94a3d' : '#eef2f8'
      ctx.fillRect(side + (i * kerb) / 4, lineY - band / 2, kerb / 4, band)
    }
  }

  /*
   * And a box for each slot.
   *
   * Open at the front, like the real ones, so a car sitting in it looks parked
   * in it rather than fenced in by it.
   */
  const slots = [POLE, ...GRID]
  ctx.strokeStyle = 'rgba(238,242,248,0.9)'
  ctx.lineWidth = Math.max(1.5, view.lane * 0.05)
  for (const slot of slots) {
    const y = roadY(view, slot.row * GRID_ROW)
    if (y < -view.depth * 4 || y > view.line + view.depth * 4) continue
    const x = laneX(view, slot.lane)
    const w = view.lane * CAR_WIDE * 1.5
    const h = CAR_LONG * view.depth * 1.15
    ctx.beginPath()
    ctx.moveTo(x - w / 2, y - h / 2)
    ctx.lineTo(x - w / 2, y + h / 2)
    ctx.lineTo(x + w / 2, y + h / 2)
    ctx.lineTo(x + w / 2, y - h / 2)
    ctx.stroke()
  }
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
  look = 0,
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

  /*
   * Your own face, looking where you are steering.
   *
   * It would be an odd world where four of his machines had faces and the one
   * you are driving did not. `look` comes from the steering, so the eyes go
   * where you go — which, when you are threading a gap, is oddly good at
   * telling you that you have committed to it.
   */
  drawFace(ctx, x, y, wide, long, 'eager', look)
}

/**
 * A face on the windscreen.
 *
 * Eyes in the glass and a mouth on the grille. It is the oldest trick in the
 * animated-car business and it has been around since long before any film you
 * could name — and it is the difference between four coloured wedges and four
 * machines somebody could tell apart and have an opinion about.
 *
 * The pupils look where the car is going, which costs nothing and is most of
 * what makes them read as alive: a racer that has just decided to pull out
 * glances that way before it moves, at the same moment its indicator starts.
 *
 * Every one of these is drawn here from ellipses and arcs, like everything
 * else in this project. Nothing is copied from anywhere.
 */
export function drawFace(
  ctx: Ctx,
  x: number,
  y: number,
  wide: number,
  long: number,
  face: Face,
  look: number,
): void {
  /*
   * The glass first, and the eyes sized from it rather than from the car.
   *
   * The first go took the eye size off the car's width and the glass off
   * nothing in particular, so the eyes were half again as wide as the window
   * they were supposed to be behind and every car looked like a skittle.
   */
  const at = { keen: -0.1, cheerful: -0.16, eager: -0.12, sleepy: -0.22 }[face]
  const cy = y + long * at
  /*
   * A windscreen, not a head.
   *
   * It has to be narrower than the car at that point or it spills over both
   * flanks and every machine looks like a skittle with eyes — which is what
   * the first two goes at this looked like. Tall enough to hold the eyes,
   * dark enough to read as glass.
   */
  const glassW = wide * 0.35
  const glassH = long * 0.21

  ctx.fillStyle = '#5f8399'
  ctx.beginPath()
  ctx.ellipse(x, cy, glassW, glassH, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.beginPath()
  ctx.ellipse(x - glassW * 0.32, cy - glassH * 0.34, glassW * 0.28, glassH * 0.26, 0, 0, Math.PI * 2)
  ctx.fill()

  const size = { keen: 0.4, cheerful: 0.46, eager: 0.48, sleepy: 0.4 }[face]
  const apart = { keen: 0.46, cheerful: 0.44, eager: 0.42, sleepy: 0.44 }[face]
  const r = Math.min(glassW * size, glassH * 0.62)

  for (const side of [-1, 1]) {
    const ex = x + side * glassW * apart
    // One of Gasket's eyes is bigger than the other, which is the whole of its
    // character and took one number to do.
    const grow = face === 'cheerful' && side < 0 ? 1.25 : 1

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(ex, cy, r * grow, r * 1.05 * grow, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#1a2230'
    ctx.beginPath()
    ctx.ellipse(ex + look * r * 0.38, cy + r * 0.12, r * 0.46, r * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // A spark of light, which is what stops an eye looking like a hole.
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(ex + look * r * 0.38 - r * 0.16, cy - r * 0.08, r * 0.14, 0, Math.PI * 2)
    ctx.fill()

    // Lids do the expression: narrowed for keen, heavy for sleepy.
    if (face === 'keen' || face === 'sleepy') {
      ctx.fillStyle = '#1a2230'
      const drop = face === 'sleepy' ? 0.85 : 0.55
      ctx.beginPath()
      ctx.ellipse(ex, cy - r * drop, r * grow * 1.05, r * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // And a mouth on the grille, a little way in front of the glass.
  ctx.strokeStyle = '#1a2230'
  ctx.lineWidth = Math.max(1.5, wide * 0.045)
  ctx.lineCap = 'round'
  ctx.beginPath()
  const mouth = cy - glassH - long * 0.1
  if (face === 'sleepy') {
    // A flat line, and not a happy one.
    ctx.moveTo(x - wide * 0.14, mouth)
    ctx.lineTo(x + wide * 0.14, mouth)
  } else {
    const grin = face === 'keen' ? 0.1 : 0.14
    ctx.arc(x, mouth - long * grin * 0.6, wide * grin * 1.6, Math.PI * 0.25, Math.PI * 0.75)
  }
  ctx.stroke()
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
  const shape = BUILD_OF[racer.who.build]

  ctx.fillStyle = INK.shadow
  body(ctx, x + wide * 0.07, y + long * 0.05, wide, long, shape, wide * 0.16)
  ctx.fill()

  wheels(ctx, x, y, wide * 0.86, long, wide * 0.06)

  ctx.fillStyle = racer.who.colour
  body(ctx, x, y, wide, long, shape, wide * 0.16)
  ctx.fill()

  /*
   * What makes each of them itself, beyond the colour.
   *
   * One or two marks each, drawn from the same primitives as everything else:
   * a wing and a scoop, a tow boom, a roof rack. Enough that a glance at the
   * mirror says which of them is behind you.
   */
  ctx.fillStyle = racer.who.trim
  if (racer.who.build === 'stock') {
    // A bonnet scoop and a rear wing you could serve dinner on.
    ctx.fillRect(x - wide * 0.12, y - long * 0.72, wide * 0.24, long * 0.14)
    ctx.fillRect(x - wide * 0.54, y + long * 0.5, wide * 1.08, long * 0.12)
    ctx.fillRect(x - wide * 0.46, y + long * 0.38, wide * 0.08, long * 0.14)
    ctx.fillRect(x + wide * 0.38, y + long * 0.38, wide * 0.08, long * 0.14)
  } else if (racer.who.build === 'tow') {
    // A flat deck, a boom down the middle of it, and a hook on the end.
    ctx.globalAlpha = 0.55
    ctx.fillRect(x - wide * 0.3, y + long * 0.2, wide * 0.6, long * 0.56)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#4a4f5c'
    ctx.fillRect(x - wide * 0.06, y + long * 0.22, wide * 0.12, long * 0.56)
    ctx.beginPath()
    ctx.arc(x, y + long * 0.84, wide * 0.11, Math.PI, Math.PI * 2.1)
    ctx.lineWidth = Math.max(2, wide * 0.08)
    ctx.strokeStyle = '#4a4f5c'
    ctx.stroke()
  } else if (racer.who.build === 'coupe') {
    // Two stripes over the roof, which is all a small car needs.
    for (const side of [-1, 1]) {
      ctx.fillRect(x + side * wide * 0.14 - wide * 0.05, y - long * 0.5, wide * 0.1, long * 1.3)
    }
  } else {
    // A roof rack with a bag strapped under it.
    ctx.fillRect(x - wide * 0.42, y + long * 0.24, wide * 0.84, long * 0.07)
    ctx.fillRect(x - wide * 0.42, y + long * 0.66, wide * 0.84, long * 0.07)
    ctx.fillStyle = '#c8cedb'
    ctx.beginPath()
    ctx.roundRect(x - wide * 0.26, y + long * 0.3, wide * 0.52, long * 0.34, wide * 0.08)
    ctx.fill()
  }

  // Rear lamps, since you are usually looking at the back of one.
  ctx.fillStyle = '#ff5b4a'
  for (const side of [-1, 1]) {
    ctx.fillRect(x + side * wide * 0.32 - wide * 0.06, y + long * 0.38, wide * 0.12, long * 0.06)
  }

  /*
   * And the face, last, over everything.
   *
   * It looks where the car is about to go — the same number that drives the
   * indicator — so a glance sideways is the first warning you get that one of
   * them is coming across.
   */
  drawFace(ctx, x, y, wide, long, racer.who.face, racer.signal)

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
export function drawRun(
  ctx: Ctx,
  run: Run,
  lane: number,
  view: View,
  w: number,
  h: number,
  look = 0,
): void {
  drawRoad(ctx, view, w, h)
  drawGrid(ctx, view)
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
  drawMine(ctx, lane, view, run.stunned, run.mercy, look)
}

/**
 * The start lights, on a gantry over the road.
 *
 * Three of them come on a second apart and then all of them go out, which is
 * the one signal every racing game and every real race agrees on. Drawn over
 * the road rather than in the readout strip, because a light you have to look
 * away from the road to see is not a start light.
 */
export function drawLights(
  ctx: Ctx,
  countdown: number,
  lights: number,
  every: number,
  w: number,
  top: number,
  h: number,
): void {
  const done = countdown <= 0
  const size = Math.min(w * 0.075, h * 0.1)
  const gap = size * 2.6
  // High up, clear of the front of the grid — the gantry was landing on top of
  // whoever was on pole.
  const cy = top + Math.max(size * 2.4, h * 0.14)

  if (!done) {
    // The gantry.
    ctx.fillStyle = '#12151c'
    ctx.fillRect(w / 2 - gap * 1.8, cy - size * 1.9, gap * 3.6, size * 3.4)
    ctx.strokeStyle = '#2a3040'
    ctx.lineWidth = Math.max(2, size * 0.12)
    ctx.strokeRect(w / 2 - gap * 1.8, cy - size * 1.9, gap * 3.6, size * 3.4)
  }

  // How many are lit: one more each second as the clock counts down.
  const lit = done ? 0 : lights - Math.ceil(countdown / every) + 1

  for (let i = 0; i < lights; i++) {
    const cx = w / 2 + (i - (lights - 1) / 2) * gap
    ctx.beginPath()
    ctx.arc(cx, cy, size, 0, Math.PI * 2)
    ctx.fillStyle = done ? '#1c2a1c' : i < lit ? '#ff3b2f' : '#2a1414'
    ctx.fill()
    ctx.strokeStyle = '#0a0c11'
    ctx.lineWidth = Math.max(2, size * 0.14)
    ctx.stroke()

    // A lit one throws some light about.
    if (!done && i < lit) {
      const glow = ctx.createRadialGradient(cx, cy, size * 0.4, cx, cy, size * 2.4)
      glow.addColorStop(0, 'rgba(255,59,47,0.45)')
      glow.addColorStop(1, 'rgba(255,59,47,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, size * 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
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
