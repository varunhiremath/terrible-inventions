/**
 * Drawing the flood.
 *
 * Canvas primitives only. The screen is one tall field: a chamber at the top
 * with somebody in it and the water coming up, and the board of sums below.
 *
 * One rule governs every colour in here: **nothing on a block may hint at
 * whether it is true.** Colour by truth would turn the game straight back into
 * the matching game it is shaped like, and the whole point is that the only
 * way to know is to do the sum. So the colour says which operation it is —
 * useful, and it gives nothing away — and the blocks are otherwise identical
 * until they are tapped.
 */
import { COLS, ROWS, type Sign, type Soul } from './level'
import { TO_CLEAR, type Pop, type Run } from './run'

type Ctx = CanvasRenderingContext2D

/** The field, in units: the board is one unit a cell, the chamber sits above. */
export const WIDE = COLS
export const CHAMBER = 3.4
export const TALL = ROWS + CHAMBER

export interface View {
  w: number
  h: number
  clock: number
}

export const INK = {
  back: '#05060a',
  stone: '#1b2030',
  stoneLit: '#2b3245',
  glass: '#0b1424',
  water: '#2f7fd6',
  waterLit: '#6fc3f0',
  foam: '#dff2ff',
  chalk: '#e8ebf5',
  dim: '#8a91ab',
  good: '#7ce08a',
  bad: '#ff6b6b',
} as const

/**
 * A colour for each operation.
 *
 * Four strong, separable colours — he asked for colourful and these are the
 * four that stay telling apart on a phone in daylight.
 */
export const SIGN_INK: Record<Sign, { face: string; lit: string; edge: string }> = {
  '+': { face: '#2f6ad6', lit: '#5f9bf5', edge: '#16367a' },
  '-': { face: '#d64f9b', lit: '#f58cc3', edge: '#7a1f55' },
  '×': { face: '#e0a52f', lit: '#f7cf6b', edge: '#7d5812' },
  '÷': { face: '#3fb57a', lit: '#78e3ab', edge: '#1b5f3c' },
}

export function fieldOf(view: View): { x: number; y: number; scale: number } {
  const scale = Math.min(view.w / WIDE, view.h / TALL)
  return { x: (view.w - WIDE * scale) / 2, y: (view.h - TALL * scale) / 2, scale }
}

/** A rounded box, which every surface in here is. */
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

// --- the chamber -------------------------------------------------------------

/**
 * The person in the chamber.
 *
 * Drawn to a unit box so the same figure works at any size, and worried in
 * proportion to the water rather than at a threshold — a face that changes all
 * at once reads as a bug.
 */
function drawSoul(ctx: Ctx, soul: Soul, x: number, y: number, s: number, fear: number, clock: number): void {
  const sway = Math.sin(clock * (2 + fear * 4)) * 0.04 * s * (0.4 + fear)
  ctx.save()
  ctx.translate(x + sway, y)

  // Arms: down when the water is low, up and waving when it is not.
  const lift = fear * fear
  const wave = Math.sin(clock * (4 + fear * 8)) * 0.3 * lift
  ctx.strokeStyle = soul.skin
  ctx.lineWidth = s * 0.1
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * s * 0.16, -s * 0.52)
    const bend = -s * 0.52 - lift * s * 0.3
    ctx.lineTo(side * s * (0.3 + lift * 0.1), bend)
    ctx.lineTo(
      side * s * (0.34 + lift * 0.22),
      bend - lift * s * 0.34 + (side > 0 ? wave : -wave) * s * 0.3,
    )
    ctx.stroke()
  }

  // Legs, coat, head.
  ctx.strokeStyle = soul.trim
  ctx.lineWidth = s * 0.11
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * s * 0.07, -s * 0.12)
    ctx.lineTo(side * s * 0.13, 0)
    ctx.stroke()
  }

  ctx.fillStyle = soul.coat
  box(ctx, -s * 0.2, -s * 0.62, s * 0.4, s * 0.52, s * 0.1)
  ctx.fill()
  ctx.fillStyle = soul.trim
  ctx.fillRect(-s * 0.2, -s * 0.2, s * 0.4, s * 0.06)

  ctx.fillStyle = soul.skin
  ctx.beginPath()
  ctx.arc(0, -s * 0.76, s * 0.17, 0, Math.PI * 2)
  ctx.fill()

  // The face: eyes wider and the mouth rounder the higher it gets.
  ctx.fillStyle = '#10131c'
  const eye = s * (0.022 + fear * 0.016)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(side * s * 0.06, -s * 0.79, eye, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  if (fear > 0.25) ctx.arc(0, -s * 0.7, s * (0.02 + fear * 0.045), 0, Math.PI * 2)
  else { ctx.ellipse(0, -s * 0.71, s * 0.05, s * 0.018, 0, 0, Math.PI * 2) }
  ctx.fill()

  ctx.restore()
}

/** The chamber: stone, glass, a pipe pouring in, and the water in it. */
function drawChamber(ctx: Ctx, run: Run, x: number, y: number, s: number, clock: number): void {
  const w = WIDE * s
  const h = CHAMBER * s
  const pad = s * 0.22

  // Stone surround.
  ctx.fillStyle = INK.stone
  box(ctx, x, y, w, h, s * 0.2)
  ctx.fill()
  ctx.strokeStyle = INK.stoneLit
  ctx.lineWidth = Math.max(1, s * 0.03)
  ctx.stroke()

  const gx = x + pad
  const gy = y + pad
  const gw = w - pad * 2
  const gh = h - pad * 2

  ctx.save()
  box(ctx, gx, gy, gw, gh, s * 0.12)
  ctx.clip()

  ctx.fillStyle = INK.glass
  ctx.fillRect(gx, gy, gw, gh)

  // The floor he is standing on.
  const floor = gy + gh
  drawSoul(
    ctx, run.soul, gx + gw * 0.5, floor - s * 0.06, s * 1.5,
    Math.min(1, run.water / 0.9), clock,
  )

  // The water, with a surface that moves.
  const top = floor - gh * run.water
  if (run.water > 0.001) {
    const grad = ctx.createLinearGradient(0, top, 0, floor)
    grad.addColorStop(0, INK.waterLit)
    grad.addColorStop(1, INK.water)
    ctx.globalAlpha = 0.62
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(gx, top)
    const swell = s * 0.055
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const px = gx + gw * t
      const py = top
        + Math.sin(clock * 2.2 + t * 7) * swell
        + Math.sin(clock * 3.7 + t * 13) * swell * 0.4
      ctx.lineTo(px, py)
    }
    ctx.lineTo(gx + gw, floor)
    ctx.lineTo(gx, floor)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1

    // Foam on the surface, and bubbles under it.
    ctx.strokeStyle = INK.foam
    ctx.lineWidth = Math.max(1, s * 0.02)
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const px = gx + gw * t
      const py = top
        + Math.sin(clock * 2.2 + t * 7) * swell
        + Math.sin(clock * 3.7 + t * 13) * swell * 0.4
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    ctx.fillStyle = INK.foam
    for (let i = 0; i < 14; i++) {
      const seed = ((i * 2654435761) % 10007) / 10007
      const rise = (clock * (0.3 + seed * 0.4) + seed) % 1
      const by = floor - (floor - top) * rise
      ctx.globalAlpha = 0.25 * (1 - rise)
      ctx.beginPath()
      ctx.arc(gx + gw * seed, by, s * (0.02 + seed * 0.03), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // The pipe it is coming in through, always running, so it is obvious where
  // the trouble is coming from.
  const px = gx + gw * 0.82
  ctx.fillStyle = INK.stoneLit
  ctx.fillRect(px - s * 0.14, y - s * 0.02, s * 0.28, pad + s * 0.1)
  ctx.strokeStyle = INK.waterLit
  ctx.lineWidth = Math.max(1, s * 0.05)
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 9)
  ctx.beginPath()
  ctx.moveTo(px, gy + s * 0.05)
  ctx.lineTo(px + Math.sin(clock * 7) * s * 0.03, gy + s * 0.45)
  ctx.stroke()
  ctx.globalAlpha = 1

  // And the drain, which gurgles when the level drops.
  const drain = run.pops.some((p) => p.good && p.life > 0.1)
  ctx.fillStyle = drain ? INK.waterLit : INK.stoneLit
  ctx.fillRect(gx + gw * 0.1, floor - s * 0.08, s * 0.4, s * 0.1)
}

// --- the board ---------------------------------------------------------------

export const wordsOf = (sum: { a: number; sign: Sign; b: number; claim: number }): string =>
  `${sum.a}${sum.sign}${sum.b}=${sum.claim}`

const FACE = 'ui-monospace, "SF Mono", Menlo, monospace'

/**
 * One size of type for the whole board, set by the longest sum on it.
 *
 * Shrinking each block to fit its own sum was the obvious thing and it was
 * wrong: `7+8=15` came out half again as big as `68+73=141`, so the short sums
 * stood out as though the game were pointing at them. It is not a hint — size
 * follows how many digits there are, not whether it is true — but it looks
 * exactly like one, and a board you can read differently from block to block
 * is a board somebody will try to read that way.
 */
function sizeFor(ctx: Ctx, run: Run, w: number, h: number): number {
  let widest = 0
  for (const cell of run.cells) {
    const words = wordsOf(cell.sum)
    if (words.length > widest) widest = words.length
  }
  let size = h * 0.42
  const sample = '8'.repeat(widest)
  for (let tries = 0; tries < 10; tries++) {
    ctx.font = `700 ${size}px ${FACE}`
    if (ctx.measureText(sample).width <= w * 0.84) break
    size *= 0.92
  }
  return size
}

/** The sum, written out. */
function drawSum(
  ctx: Ctx, run: Run, i: number, x: number, y: number, w: number, h: number, size: number,
): void {
  const words = wordsOf(run.cells[i].sum)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${size}px ${FACE}`
  ctx.fillStyle = '#0a0d14'
  ctx.globalAlpha = 0.35
  ctx.fillText(words, x + w / 2, y + h / 2 + size * 0.07)
  ctx.globalAlpha = 1
  ctx.fillStyle = INK.chalk
  ctx.fillText(words, x + w / 2, y + h / 2)
}

/** One block. */
function drawCell(
  ctx: Ctx, run: Run, i: number, bx: number, by: number, s: number, clock: number, size: number,
): void {
  const cell = run.cells[i]
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const ink = SIGN_INK[cell.sum.sign]

  const shake = cell.shake > 0 ? Math.sin(clock * 60) * cell.shake * s * 0.1 : 0
  const pad = s * 0.055
  const x = bx + col * s + pad + shake
  const y = by + (row - cell.lift) * s + pad
  const w = s - pad * 2
  const h = s - pad * 2

  // Face, with the lit top edge that makes a flat rectangle look like a block.
  const grad = ctx.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, ink.lit)
  grad.addColorStop(0.45, ink.face)
  grad.addColorStop(1, ink.edge)
  ctx.fillStyle = grad
  box(ctx, x, y, w, h, s * 0.14)
  ctx.fill()

  ctx.strokeStyle = cell.shake > 0 ? INK.bad : ink.edge
  ctx.lineWidth = Math.max(1, s * (cell.shake > 0 ? 0.05 : 0.02))
  ctx.stroke()

  // A highlight along the top, a shadow along the bottom.
  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#ffffff'
  box(ctx, x + s * 0.08, y + s * 0.05, w - s * 0.16, h * 0.22, s * 0.08)
  ctx.fill()
  ctx.globalAlpha = 1

  drawSum(ctx, run, i, x, y, w, h, size)
}

/**
 * The sockets the blocks sit in.
 *
 * Behind everything, so the one slot a falling block has not reached yet reads
 * as an empty socket rather than a hole cut through to space. Cheap, and it is
 * the difference between a board and a floating pile of buttons.
 */
function drawSockets(ctx: Ctx, bx: number, by: number, s: number): void {
  ctx.save()
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const pad = s * 0.055
      ctx.fillStyle = (col + row) % 2 === 0 ? '#11151f' : '#0e1119'
      box(ctx, bx + col * s + pad, by + row * s + pad, s - pad * 2, s - pad * 2, s * 0.14)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** The flashes left where a block was, and where a wrong one was tapped. */
function drawPop(ctx: Ctx, pop: Pop, bx: number, by: number, s: number): void {
  const x = bx + (pop.col + 0.5) * s
  const y = by + (pop.row + 0.5) * s
  const t = pop.good ? 1 - pop.life / 0.26 : 1 - pop.life / 0.3
  ctx.save()
  if (pop.good) {
    ctx.globalAlpha = Math.max(0, 1 - t)
    ctx.strokeStyle = INK.good
    ctx.lineWidth = Math.max(1, s * 0.07 * (1 - t))
    ctx.beginPath()
    ctx.arc(x, y, s * (0.2 + t * 0.55), 0, Math.PI * 2)
    ctx.stroke()
    /*
     * Four bits rather than seven, off the diagonals, and fading.
     *
     * Seven evenly round a ring drew a cog — a spiked wheel sitting in the gap
     * the block left, which is not what bursting looks like and was the first
     * thing anybody noticed in the photograph.
     */
    ctx.fillStyle = INK.foam
    ctx.globalAlpha = Math.max(0, 0.8 - t)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const r = s * (0.1 + t * 0.5)
      ctx.beginPath()
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, s * 0.07 * (1 - t), 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.globalAlpha = Math.max(0, 0.7 - t * 0.7)
    ctx.strokeStyle = INK.bad
    ctx.lineWidth = Math.max(1, s * 0.05)
    ctx.beginPath()
    ctx.arc(x, y, s * 0.42, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** How many are still wanted, drawn as the beads along the top of the board. */
function drawTally(ctx: Ctx, run: Run, x: number, y: number, s: number): void {
  const done = TO_CLEAR - run.left
  const gap = (WIDE * s) / TO_CLEAR
  for (let i = 0; i < TO_CLEAR; i++) {
    ctx.fillStyle = i < done ? INK.good : '#2a3045'
    ctx.beginPath()
    ctx.arc(x + gap * (i + 0.5), y, Math.max(1.5, s * 0.055), 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Where the keyboard is pointing, for anybody playing this on a laptop. */
export interface Cursor {
  col: number
  row: number
}

export function drawRun(ctx: Ctx, run: Run, view: View, cursor?: Cursor | null): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = INK.back
  ctx.fillRect(0, 0, view.w, view.h)

  const { x, y, scale } = fieldOf(view)

  drawChamber(ctx, run, x, y, scale, view.clock)

  const by = y + CHAMBER * scale + scale * 0.16
  drawTally(ctx, run, x, y + CHAMBER * scale + scale * 0.07, scale)

  drawSockets(ctx, x, by, scale)

  ctx.save()
  // Clip the board so a block falling in from above arrives rather than
  // appearing: it comes down out of the chamber's shadow.
  ctx.beginPath()
  ctx.rect(x, by, WIDE * scale, ROWS * scale)
  ctx.clip()
  const size = sizeFor(ctx, run, scale, scale)
  for (let i = 0; i < run.cells.length; i++) drawCell(ctx, run, i, x, by, scale, view.clock, size)
  ctx.restore()

  for (const pop of run.pops) drawPop(ctx, pop, x, by, scale)

  if (cursor) {
    ctx.strokeStyle = INK.chalk
    ctx.lineWidth = Math.max(1.5, scale * 0.045)
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(view.clock * 6)
    box(
      ctx,
      x + cursor.col * scale + scale * 0.03,
      by + cursor.row * scale + scale * 0.03,
      scale * 0.94,
      scale * 0.94,
      scale * 0.16,
    )
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/** Which cell a point lands on, or null. The screen's half of the tapping. */
export function cellAt(view: View, px: number, py: number): { col: number; row: number } | null {
  const { x, y, scale } = fieldOf(view)
  const by = y + CHAMBER * scale + scale * 0.16
  const col = Math.floor((px - x) / scale)
  const row = Math.floor((py - by) / scale)
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null
  return { col, row }
}
