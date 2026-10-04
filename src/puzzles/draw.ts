/**
 * Drawing the notebook.
 *
 * The one game in here that is not a lit screen in the dark. These are pencil
 * puzzles, so they are drawn on paper: a cream sheet on a dark desk, faint
 * printed guides, and a heavy ink line where a finger has been. The paper is
 * warm rather than white, because a white rectangle on a phone at bedtime is a
 * torch.
 *
 * Canvas primitives only, like everything else here.
 */
import { INKS, type Kind } from './level'
import type { Board, Run } from './run'

type Ctx = CanvasRenderingContext2D

export interface View {
  w: number
  h: number
  clock: number
}

export const INK = {
  desk: '#14161f',
  deskLit: '#1d212d',
  paper: '#efe7d6',
  paperEdge: '#d8cdb6',
  rule: '#cfc3a8',
  print: '#9c8e71',
  pencil: '#2a2b33',
  nib: '#1a1b22',
  done: '#2f8f55',
} as const

/** How many places across and down the board is, in grid steps. */
export function shapeOf(board: Board): { across: number; down: number; dots: boolean } {
  if (board.kind === 'stroke') return { across: board.figure.across, down: board.figure.down, dots: true }
  if (board.kind === 'maze') return { across: board.maze.across, down: board.maze.down, dots: false }
  return { across: board.flow.across, down: board.flow.down, dots: false }
}

export interface Sheet {
  /** The paper. */
  x: number
  y: number
  w: number
  h: number
  /** One grid step, in pixels, and where the grid starts. */
  cell: number
  gx: number
  gy: number
}

/**
 * The sheet of paper, and the grid on it.
 *
 * A figure of dots is measured corner to corner, so it needs one fewer step
 * than it has dots; a grid of squares needs one step per square. Getting that
 * the wrong way round makes the puzzle a step too big for its paper, which is
 * invisible until the right-hand column goes off the edge.
 */
/** The margin of paper round the puzzle, in grid steps. */
const BORDER = 0.9

export function sheetOf(view: View, board: Board): Sheet {
  const { across, down, dots } = shapeOf(board)
  const steps = {
    x: Math.max(1, dots ? across - 1 : across),
    y: Math.max(1, dots ? down - 1 : down),
  }

  /*
   * The paper is cut to fit the puzzle, not the other way round.
   *
   * The first cut filled the screen with a sheet and then drew the puzzle in
   * the middle of it at whatever size fitted both ways — so a tall phone
   * showing a square puzzle got a postage stamp in the middle of an acre of
   * cream. Working out the step first and then cutting the paper round it
   * gives the puzzle the whole of the short side.
   */
  const edge = Math.min(view.w, view.h) * 0.04
  const room = { x: view.w - edge * 2, y: view.h - edge * 2 }
  const cell = Math.min(
    room.x / (steps.x + BORDER * 2),
    room.y / (steps.y + BORDER * 2),
  )
  const w = (steps.x + BORDER * 2) * cell
  const h = (steps.y + BORDER * 2) * cell
  const x = (view.w - w) / 2
  const y = (view.h - h) / 2

  return { x, y, w, h, cell, gx: x + BORDER * cell, gy: y + BORDER * cell }
}

/** Where a place sits on the paper. */
export function spotOf(board: Board, sheet: Sheet, place: number): { x: number; y: number } {
  if (board.kind === 'stroke') {
    const dot = board.figure.dots[place]
    if (!dot) return { x: sheet.gx, y: sheet.gy }
    return { x: sheet.gx + dot.x * sheet.cell, y: sheet.gy + dot.y * sheet.cell }
  }
  const { across } = shapeOf(board)
  return {
    x: sheet.gx + ((place % across) + 0.5) * sheet.cell,
    y: sheet.gy + (Math.floor(place / across) + 0.5) * sheet.cell,
  }
}

/** Which place a point on the screen is nearest, or null if it is nowhere. */
export function placeAt(board: Board, sheet: Sheet, px: number, py: number): number | null {
  if (board.kind === 'stroke') {
    // The nearest corner, if the finger is close enough to mean it. Generous,
    // because a fingertip is about a corner and a half wide.
    let best: number | null = null
    let near = sheet.cell * 0.55
    for (let i = 0; i < board.figure.dots.length; i++) {
      const at = spotOf(board, sheet, i)
      const d = Math.hypot(at.x - px, at.y - py)
      if (d < near) { near = d; best = i }
    }
    return best
  }
  const { across, down } = shapeOf(board)
  const cx = Math.floor((px - sheet.gx) / sheet.cell)
  const cy = Math.floor((py - sheet.gy) / sheet.cell)
  if (cx < 0 || cx >= across || cy < 0 || cy >= down) return null
  return cy * across + cx
}

/**
 * Every place a finger passed through on its way from one point to another.
 *
 * The rules of all three puzzles are written about one step at a time, quite
 * deliberately — it is the only way they stay simple enough to be right. But a
 * finger crossing a phone covers two or three squares between frames, so
 * something has to turn a jump into the steps it was made of, and if nothing
 * does the trail stalls the moment anybody draws at a normal speed.
 *
 * It lives here rather than in the screen so it can be tested. It was in the
 * screen first, where nothing could reach it.
 */
export function placesBetween(
  board: Board, sheet: Sheet,
  from: { x: number; y: number }, to: { x: number; y: number },
): number[] {
  const span = Math.hypot(to.x - from.x, to.y - from.y)
  // A third of a square: fine enough that no square between the two points is
  // stepped over, coarse enough that a slow finger is not asked the same
  // question forty times.
  const steps = Math.max(1, Math.ceil(span / (sheet.cell * 0.34)))
  const out: number[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const place = placeAt(
      board, sheet,
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
    )
    if (place === null) continue
    if (out.length > 0 && out[out.length - 1] === place) continue
    out.push(place)
  }
  return out
}

/** A rounded box. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const round = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + round, y)
  ctx.arcTo(x + w, y, x + w, y + h, round)
  ctx.arcTo(x + w, y + h, x, y + h, round)
  ctx.arcTo(x, y + h, x, y, round)
  ctx.arcTo(x, y, x + w, y, round)
  ctx.closePath()
}

/** The desk and the sheet on it. */
function drawPaper(ctx: Ctx, view: View, sheet: Sheet): void {
  const grad = ctx.createLinearGradient(0, 0, 0, view.h)
  grad.addColorStop(0, INK.deskLit)
  grad.addColorStop(1, INK.desk)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, view.w, view.h)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = sheet.cell * 0.5
  ctx.shadowOffsetY = sheet.cell * 0.14
  ctx.fillStyle = INK.paper
  box(ctx, sheet.x, sheet.y, sheet.w, sheet.h, sheet.cell * 0.18)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = INK.paperEdge
  ctx.lineWidth = 1
  box(ctx, sheet.x, sheet.y, sheet.w, sheet.h, sheet.cell * 0.18)
  ctx.stroke()
}

/** A line with round ends, which is every line in here. */
function stroke(ctx: Ctx, points: { x: number; y: number }[], width: number, colour: string): void {
  if (points.length === 0) return
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2)
    ctx.fillStyle = colour
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
}

// --- the three puzzles -------------------------------------------------------

function drawFigure(ctx: Ctx, run: Run, sheet: Sheet, clock: number): void {
  const board = run.board
  if (board.kind !== 'stroke') return
  const trail = run.trails[0]

  /*
   * The figure as printed: every line, in pale ink, so there is something to
   * trace.
   *
   * All the same weight. The first cut drew the ones already done a little
   * thinner, which was a distinction nobody could see and which would have
   * been a hint if they could — the heavy stroke on top already says exactly
   * what has been drawn, because there is only ever one stroke.
   */
  for (const line of board.figure.lines) {
    stroke(ctx, [spotOf(board, sheet, line.a), spotOf(board, sheet, line.b)],
      sheet.cell * 0.07, INK.print)
  }

  // And the stroke so far, heavy, over the top.
  stroke(
    ctx,
    trail.map((p) => spotOf(board, sheet, p)),
    sheet.cell * 0.15,
    run.solved ? INK.done : INK.pencil,
  )

  // The corners, so it is clear where a line may turn.
  for (let i = 0; i < board.figure.dots.length; i++) {
    const at = spotOf(board, sheet, i)
    ctx.fillStyle = INK.pencil
    ctx.beginPath()
    ctx.arc(at.x, at.y, sheet.cell * 0.075, 0, Math.PI * 2)
    ctx.fill()
  }

  // The nib: where the next line would start from.
  if (trail.length > 0 && !run.solved) {
    const at = spotOf(board, sheet, trail[trail.length - 1])
    ctx.strokeStyle = INK.nib
    ctx.lineWidth = sheet.cell * 0.045
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(clock * 5)
    ctx.beginPath()
    ctx.arc(at.x, at.y, sheet.cell * 0.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function drawMaze(ctx: Ctx, run: Run, sheet: Sheet, clock: number): void {
  const board = run.board
  if (board.kind !== 'maze') return
  const maze = board.maze
  const { across, down } = maze
  const w = sheet.cell * 0.085

  // The way in and the way out, marked before the walls so the walls sit over
  // them and the doorways read as gaps rather than as decoration.
  for (const [place, tint] of [[maze.from, '#7fb98f'], [maze.to, '#e07a5f']] as const) {
    const at = spotOf(board, sheet, place)
    ctx.fillStyle = tint
    ctx.globalAlpha = 0.45
    ctx.fillRect(at.x - sheet.cell / 2, at.y - sheet.cell / 2, sheet.cell, sheet.cell)
    ctx.globalAlpha = 1
  }

  stroke(ctx, run.trails[0].map((p) => spotOf(board, sheet, p)),
    sheet.cell * 0.36, run.solved ? 'rgba(47,143,85,0.5)' : 'rgba(42,43,51,0.32)')

  ctx.strokeStyle = INK.pencil
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const cell = y * across + x
      const px = sheet.gx + x * sheet.cell
      const py = sheet.gy + y * sheet.cell
      if (x < across - 1 && maze.right[cell]) {
        ctx.moveTo(px + sheet.cell, py)
        ctx.lineTo(px + sheet.cell, py + sheet.cell)
      }
      if (y < down - 1 && maze.below[cell]) {
        ctx.moveTo(px, py + sheet.cell)
        ctx.lineTo(px + sheet.cell, py + sheet.cell)
      }
    }
  }
  // The outside, with the two doorways left open.
  ctx.moveTo(sheet.gx, sheet.gy)
  ctx.lineTo(sheet.gx + across * sheet.cell, sheet.gy)
  ctx.moveTo(sheet.gx, sheet.gy + down * sheet.cell)
  ctx.lineTo(sheet.gx + across * sheet.cell, sheet.gy + down * sheet.cell)
  ctx.moveTo(sheet.gx, sheet.gy + sheet.cell)
  ctx.lineTo(sheet.gx, sheet.gy + down * sheet.cell)
  ctx.moveTo(sheet.gx + across * sheet.cell, sheet.gy)
  ctx.lineTo(sheet.gx + across * sheet.cell, sheet.gy + (down - 1) * sheet.cell)
  ctx.stroke()

  if (!run.solved) {
    const head = run.trails[0][run.trails[0].length - 1]
    const at = spotOf(board, sheet, head)
    ctx.strokeStyle = INK.nib
    ctx.lineWidth = sheet.cell * 0.07
    ctx.globalAlpha = 0.5 + 0.35 * Math.sin(clock * 5)
    ctx.beginPath()
    ctx.arc(at.x, at.y, sheet.cell * 0.3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function drawFlow(ctx: Ctx, run: Run, sheet: Sheet, clock: number): void {
  const board = run.board
  if (board.kind !== 'flow') return
  const flow = board.flow
  const { across, down } = flow

  // The faint grid it is all drawn on.
  ctx.strokeStyle = INK.rule
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= across; x++) {
    ctx.moveTo(sheet.gx + x * sheet.cell, sheet.gy)
    ctx.lineTo(sheet.gx + x * sheet.cell, sheet.gy + down * sheet.cell)
  }
  for (let y = 0; y <= down; y++) {
    ctx.moveTo(sheet.gx, sheet.gy + y * sheet.cell)
    ctx.lineTo(sheet.gx + across * sheet.cell, sheet.gy + y * sheet.cell)
  }
  ctx.stroke()

  for (const [i, trail] of run.trails.entries()) {
    const colour = INKS[i % INKS.length]
    stroke(ctx, trail.map((p) => spotOf(board, sheet, p)), sheet.cell * 0.42, colour)
  }

  for (const [i, ends] of flow.ends.entries()) {
    const colour = INKS[i % INKS.length]
    for (const place of ends) {
      const at = spotOf(board, sheet, place)
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.arc(at.x, at.y, sheet.cell * 0.33, 0, Math.PI * 2)
      ctx.fill()
      // A ring on the two ends of a finished pair, so done is visible without
      // counting.
      const trail = run.trails[i]
      const joined = trail.length > 1
        && (trail[0] === ends[0] || trail[0] === ends[1])
        && (trail[trail.length - 1] === ends[0] || trail[trail.length - 1] === ends[1])
      if (joined) {
        ctx.strokeStyle = INK.paper
        ctx.lineWidth = sheet.cell * 0.06
        ctx.beginPath()
        ctx.arc(at.x, at.y, sheet.cell * 0.19, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  if (run.drawing !== null && !run.solved) {
    const trail = run.trails[run.drawing]
    if (trail.length > 0) {
      const at = spotOf(board, sheet, trail[trail.length - 1])
      ctx.strokeStyle = INK.nib
      ctx.lineWidth = sheet.cell * 0.05
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(clock * 6)
      ctx.beginPath()
      ctx.arc(at.x, at.y, sheet.cell * 0.44, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}

export function drawRun(ctx: Ctx, run: Run, view: View): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const sheet = sheetOf(view, run.board)
  drawPaper(ctx, view, sheet)

  ctx.save()
  if (run.board.kind === 'stroke') drawFigure(ctx, run, sheet, view.clock)
  else if (run.board.kind === 'maze') drawMaze(ctx, run, sheet, view.clock)
  else drawFlow(ctx, run, sheet, view.clock)
  ctx.restore()
}

/** The emblem for the front door: one of each, small. */
export const KIND_FOR_TILE: Kind = 'stroke'
