/**
 * The Yard, drawn.
 *
 * A sheet of ply on trestles in the daylight, marked out in squares, with the
 * piece you are about to cut chalked on it. Deliberately nothing like the
 * scales: that game is brass under a lamp at night, this one is a tape
 * measure and a pencil behind your ear at ten in the morning.
 *
 * The one thing the drawing has to do beyond looking like a yard is show the
 * measurements the way his book shows them — a dimension line along the
 * bottom with the width on it, another up the side with the height, arrows at
 * both ends. That is the picture he is being taught to read, so it is the
 * picture the game draws.
 */
import { TALL, WIDE, areaOf, cubesOf, edgeOf, wants, type Cut } from './level'
import { ready, type Run } from './run'

export interface View {
  w: number
  h: number
  clock: number
}

const INK = {
  sky: '#2b3340',
  skyLow: '#1b2029',
  ground: '#4a4236',
  ply: '#c89a5e',
  plyDark: '#a67a42',
  plyEdge: '#6f4e28',
  chalk: '#f4ecdc',
  line: 'rgba(255,255,255,0.18)',
  cut: '#58b9ff',
  cutFill: 'rgba(88,185,255,0.22)',
  good: '#4ade80',
  warn: '#ffc84a',
  bad: '#ff6b53',
} as const

/** Where the sheet sits on the screen, and how big a square is. */
export interface Board {
  x: number
  y: number
  cell: number
}

export function boardOf(view: View): Board {
  const { w, h } = view
  /*
   * The sheet is as big as the narrower of the two fits allows, and then
   * everything below it is hung off the bottom of it rather than placed at
   * its own fraction of the screen. Laid out in fractions the sheet floated
   * in the middle of a tall phone with a hand's width of nothing above it and
   * another below, which is what fractions do when the thing they are placing
   * has an aspect ratio of its own.
   */
  const top = h * 0.135
  const cell = Math.min((w * 0.94) / WIDE, (h * 0.62) / TALL)
  return {
    x: (w - cell * WIDE) / 2,
    y: top,
    cell,
  }
}

/** Where the readout plate sits: just under the sheet, whatever size it is. */
const plateAt = (board: Board): number => board.y + board.cell * TALL + board.cell * 1.5

/** A rounded box, which is most of this drawing. */
function box(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}

/** A line with an arrowhead at each end, and a number sitting on it. */
function dimension(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number, toX: number, toY: number,
  says: string, size: number,
): void {
  ctx.strokeStyle = INK.chalk
  ctx.fillStyle = INK.chalk
  ctx.lineWidth = Math.max(1, size * 0.05)
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()

  const angle = Math.atan2(toY - fromY, toX - fromX)
  const head = Math.max(4, size * 0.28)
  for (const [x, y, turn] of [[fromX, fromY, angle], [toX, toY, angle + Math.PI]] as const) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(turn + 0.4) * head, y + Math.sin(turn + 0.4) * head)
    ctx.lineTo(x + Math.cos(turn - 0.4) * head, y + Math.sin(turn - 0.4) * head)
    ctx.closePath()
    ctx.fill()
  }

  // The number, on a little plate so it reads over the line it sits on.
  const midX = (fromX + toX) / 2
  const midY = (fromY + toY) / 2
  ctx.font = `bold ${Math.round(size)}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const wide = ctx.measureText(says).width + size * 0.5
  ctx.fillStyle = 'rgba(20,22,28,0.78)'
  box(ctx, midX - wide / 2, midY - size * 0.62, wide, size * 1.24, size * 0.3)
  ctx.fillStyle = INK.chalk
  ctx.fillText(says, midX, midY)
}

/** The sheet of ply, with its grid of squares. */
function sheet(ctx: CanvasRenderingContext2D, board: Board): void {
  const { x, y, cell } = board
  const w = cell * WIDE
  const h = cell * TALL

  ctx.fillStyle = INK.plyEdge
  box(ctx, x - cell * 0.18, y - cell * 0.18, w + cell * 0.36, h + cell * 0.36, cell * 0.2)

  const face = ctx.createLinearGradient(x, y, x, y + h)
  face.addColorStop(0, INK.ply)
  face.addColorStop(1, INK.plyDark)
  ctx.fillStyle = face
  ctx.fillRect(x, y, w, h)

  // The grain, which is what stops it being a brown rectangle.
  ctx.strokeStyle = 'rgba(111,78,40,0.25)'
  ctx.lineWidth = Math.max(1, cell * 0.03)
  for (let i = 0; i < 14; i++) {
    const at = y + ((i + 0.5) / 14) * h
    ctx.beginPath()
    ctx.moveTo(x, at)
    for (let s = 0; s <= 6; s++) {
      ctx.lineTo(x + (s / 6) * w, at + Math.sin(i * 2.3 + s) * cell * 0.09)
    }
    ctx.stroke()
  }

  // And the squares, pencilled on.
  ctx.strokeStyle = INK.line
  ctx.lineWidth = Math.max(1, cell * 0.025)
  ctx.beginPath()
  for (let i = 0; i <= WIDE; i++) {
    ctx.moveTo(x + i * cell, y)
    ctx.lineTo(x + i * cell, y + h)
  }
  for (let i = 0; i <= TALL; i++) {
    ctx.moveTo(x, y + i * cell)
    ctx.lineTo(x + w, y + i * cell)
  }
  ctx.stroke()
}

/** The piece chalked on the sheet, flat. */
function chalked(
  ctx: CanvasRenderingContext2D, board: Board, cut: Cut, right: boolean, cheer: number,
): void {
  const { x, y, cell } = board
  const left = x + cut.x * cell
  const top = y + cut.y * cell
  const w = cut.wide * cell
  const h = cut.tall * cell

  ctx.fillStyle = right ? 'rgba(74,222,128,0.26)' : INK.cutFill
  ctx.fillRect(left, top, w, h)
  if (cheer > 0) {
    ctx.fillStyle = `rgba(74,222,128,${0.3 * cheer})`
    ctx.fillRect(left, top, w, h)
  }

  // A dashed cut line, because that is what a line you are about to cut along
  // looks like on a piece of wood.
  ctx.strokeStyle = right ? INK.good : INK.cut
  ctx.lineWidth = Math.max(2, cell * 0.08)
  ctx.setLineDash([cell * 0.3, cell * 0.22])
  ctx.strokeRect(left, top, w, h)
  ctx.setLineDash([])
}

/** And the piece as a tank: the floor, with slabs stacked on it. */
function stacked(
  ctx: CanvasRenderingContext2D, board: Board, cut: Cut, deep: number, right: boolean,
): void {
  const { x, y, cell } = board
  const left = x + cut.x * cell
  const top = y + cut.y * cell
  const w = cut.wide * cell
  const h = cut.tall * cell
  const step = cell * 0.34

  /*
   * Back to front, each layer a little up and to the right. It is not a
   * drawing anybody would call three-dimensional, and it does not need to be:
   * what it has to say is "this many floors of that many squares", and a
   * stack of slabs you can count says it better than a shaded cuboid would.
   */
  for (let layer = deep - 1; layer >= 0; layer--) {
    const shift = layer * step
    ctx.fillStyle = layer === 0
      ? (right ? 'rgba(74,222,128,0.3)' : INK.cutFill)
      : `rgba(88,185,255,${0.1 + 0.05 * layer})`
    ctx.fillRect(left + shift, top - shift, w, h)
    ctx.strokeStyle = right ? INK.good : INK.cut
    ctx.lineWidth = Math.max(1, cell * 0.04)
    ctx.strokeRect(left + shift, top - shift, w, h)
  }

  // The depth, written up the side of the stack.
  dimension(
    ctx,
    left + w + cell * 0.25, top,
    left + w + cell * 0.25 + (deep - 1) * step, top - (deep - 1) * step,
    `${deep} deep`, cell * 0.42,
  )
}

/**
 * The lorry, waiting at the gate with the rest of the day on its back.
 *
 * It is here because there was a hand's width of empty yard under the sheet
 * and because the clock needed a face. The crates on the flatbed are the
 * orders still to come, so how much work is left is a thing you can see
 * rather than a number in the corner; and as the clock runs down on the one
 * in hand the lorry creeps forward, which says what the clock means better
 * than the bar along the top does.
 */
function lorry(ctx: CanvasRenderingContext2D, view: View, run: Run, top: number): void {
  const { w, h } = view
  const room = h - top
  if (room < h * 0.06) return
  const tall = Math.min(h * 0.11, room * 0.7)
  const long = Math.min(w * 0.62, tall * 3.4)
  // Creeping towards the gate as the time on this order runs out.
  const gone = 1 - run.clock / Math.max(1, run.order.seconds)
  const x = w * 0.08 + gone * w * 0.3
  const y = top + room * 0.45

  // The bed and the cab.
  ctx.fillStyle = '#3c4654'
  box(ctx, x, y - tall * 0.3, long * 0.66, tall * 0.3, tall * 0.06)
  ctx.fillStyle = '#54606f'
  box(ctx, x + long * 0.68, y - tall * 0.72, long * 0.3, tall * 0.72, tall * 0.12)
  ctx.fillStyle = '#8fb6dc'
  box(ctx, x + long * 0.74, y - tall * 0.62, long * 0.18, tall * 0.3, tall * 0.06)

  // The orders still to come, stacked on the back.
  const many = Math.min(6, Math.max(0, run.left))
  for (let i = 0; i < many; i++) {
    const cw = long * 0.1
    ctx.fillStyle = i % 2 === 0 ? '#a67a42' : '#c89a5e'
    box(ctx, x + long * 0.03 + i * cw * 1.05, y - tall * 0.3 - cw, cw, cw, 2)
  }
  if (run.left > 6) {
    ctx.fillStyle = 'rgba(241,236,220,0.6)'
    ctx.font = `${Math.round(tall * 0.3)}px ui-monospace, Menlo, Consolas, monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+${run.left - 6}`, x + long * 0.03 + 6 * long * 0.105, y - tall * 0.45)
  }

  // Wheels.
  ctx.fillStyle = '#1b1f26'
  for (const at of [0.12, 0.42, 0.82]) {
    ctx.beginPath()
    ctx.arc(x + long * at, y, tall * 0.17, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** The whole yard. */
export function drawRun(ctx: CanvasRenderingContext2D, run: Run, view: View): void {
  const { w, h } = view
  const board = boardOf(view)
  const { cell } = board

  // --- the yard behind it --------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, INK.skyLow)
  sky.addColorStop(0.5, INK.sky)
  sky.addColorStop(1, '#262b33')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = INK.ground
  ctx.fillRect(0, boardOf(view).y + boardOf(view).cell * TALL + boardOf(view).cell * 0.4, w, h)

  // --- the clock -----------------------------------------------------------
  const left = run.clock / Math.max(1, run.order.seconds)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, w, h * 0.022)
  ctx.fillStyle = left > 0.5 ? INK.good : left > 0.22 ? INK.warn : INK.bad
  ctx.fillRect(0, 0, w * left, h * 0.022)

  // --- the order ------------------------------------------------------------
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(241,236,220,0.5)'
  ctx.font = `${Math.round(h * 0.021)}px ui-monospace, Menlo, Consolas, monospace`
  ctx.fillText('ORDER', w / 2, h * 0.042)
  ctx.fillStyle = INK.chalk
  let size = Math.round(h * 0.036)
  ctx.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`
  const said = wants(run.order)
  while (ctx.measureText(said).width > w * 0.9 && size > 9) {
    size -= 1
    ctx.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`
  }
  ctx.fillText(said, w / 2, h * 0.075)

  // --- the sheet and what is chalked on it ----------------------------------
  sheet(ctx, board)
  const right = ready(run)
  if (run.order.job === 'tank') stacked(ctx, board, run.cut, run.deep, right)
  else chalked(ctx, board, run.cut, right, run.cheer)

  // The two measurements, written the way his book writes them.
  const cutL = board.x + run.cut.x * cell
  const cutT = board.y + run.cut.y * cell
  const cutW = run.cut.wide * cell
  const cutH = run.cut.tall * cell
  dimension(
    ctx, cutL, cutT + cutH + cell * 0.4, cutL + cutW, cutT + cutH + cell * 0.4,
    String(run.cut.wide), cell * 0.44,
  )
  dimension(
    ctx, cutL - cell * 0.4, cutT, cutL - cell * 0.4, cutT + cutH,
    String(run.cut.tall), cell * 0.44,
  )

  // --- the readout ----------------------------------------------------------
  /*
   * What the chalk comes to, with the number this order is asking about lit
   * up and the others left plain. Every order shows all of them on purpose:
   * the whole confusion this game is for is between area and perimeter, and
   * the only cure is seeing both change as the rectangle does.
   */
  const plateY = plateAt(board)
  ctx.fillStyle = 'rgba(12,14,18,0.76)'
  box(ctx, w * 0.04, plateY - h * 0.055, w * 0.92, h * 0.115, h * 0.018)

  const tank = run.order.job === 'tank'
  const cells: { name: string; value: string; lit: boolean }[] = [
    { name: 'SIDES', value: `${run.cut.wide}x${run.cut.tall}`, lit: false },
    { name: 'SQUARES', value: String(areaOf(run.cut)), lit: run.order.job === 'panel' || run.order.job === 'exact' },
    { name: 'EDGE', value: String(edgeOf(run.cut)), lit: run.order.job === 'edging' || run.order.job === 'exact' },
  ]
  if (tank) {
    cells.push({ name: 'CUBES', value: String(cubesOf(run.cut, run.deep)), lit: true })
  }
  const slot = (w * 0.92) / cells.length
  for (const [i, cell2] of cells.entries()) {
    const midX = w * 0.04 + slot * (i + 0.5)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(241,236,220,0.45)'
    ctx.font = `${Math.round(h * 0.017)}px ui-monospace, Menlo, Consolas, monospace`
    ctx.fillText(cell2.name, midX, plateY - h * 0.028)
    ctx.fillStyle = cell2.lit ? (right ? INK.good : INK.cut) : 'rgba(241,236,220,0.75)'
    ctx.font = `bold ${Math.round(h * 0.042)}px ui-monospace, Menlo, Consolas, monospace`
    ctx.fillText(cell2.value, midX, plateY + h * 0.016)
  }

  // --- the lorry, waiting ---------------------------------------------------
  lorry(ctx, view, run, plateY + h * 0.07)

  // --- and what was wrong with the last one ---------------------------------
  if (run.grumbleFor > 0 && run.grumble) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.round(h * 0.028)}px ui-monospace, Menlo, Consolas, monospace`
    const wideEnough = ctx.measureText(run.grumble).width + h * 0.04
    const grumbleY = plateAt(board) - h * 0.085
    ctx.fillStyle = 'rgba(255,107,83,0.92)'
    box(ctx, w / 2 - wideEnough / 2, grumbleY - h * 0.023, wideEnough, h * 0.046, h * 0.012)
    ctx.fillStyle = '#1b1012'
    ctx.fillText(run.grumble, w / 2, grumbleY)
  }
}

/** Which square of the sheet a point on the screen is in. */
export function squareAt(board: Board, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(WIDE - 1, Math.floor((x - board.x) / board.cell))),
    y: Math.max(0, Math.min(TALL - 1, Math.floor((y - board.y) / board.cell))),
  }
}
