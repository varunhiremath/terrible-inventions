/**
 * Drawing the flood.
 *
 * Canvas primitives only. The screen is one tall field: a chamber at the top
 * with somebody in it and the water coming up, and the board of blocks below.
 *
 * One rule governs every colour on a block: **nothing may hint at whether a
 * line is true.** The colour says what kind of block it is — a number, a plus,
 * an equals — which helps the eye find the shape of a line and gives nothing
 * away, because whether `2 + 3 = 5` is true is not a fact about its blocks.
 */
import { COLS, HUNT_SAYS, ROWS, colOf, perilFor, rowOf, type Soul } from './level'
import type { Token } from './find'
import { blastOf, type Run } from './run'

type Ctx = CanvasRenderingContext2D

/** The field, in units: the board is one unit a block, the chamber sits above. */
export const WIDE = COLS
export const CHAMBER = 3.4
/**
 * A strip between the chamber and the board, for the word the game says.
 *
 * Its own space, not an overlay. The first cut drew "up in 12s · 12 24 36 48"
 * across the middle of the tank, over the person, in green on blue — which is
 * both unreadable and on top of the one thing the player is watching.
 */
export const BANNER = 0.62
export const TALL = ROWS + CHAMBER + BANNER

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
 * A colour for each kind of block.
 *
 * Four strong, separable colours for the operators, a quiet slate for the
 * numbers, and cream for the equals — so the eye can pick out the skeleton of
 * an equation across a board without reading a single digit, which is exactly
 * the skill the game is for.
 */
export const TOKEN_INK: Record<string, { face: string; lit: string; edge: string }> = {
  num: { face: '#39415c', lit: '#616b8c', edge: '#1c2133' },
  '+': { face: '#2f6ad6', lit: '#5f9bf5', edge: '#16367a' },
  '-': { face: '#d64f9b', lit: '#f58cc3', edge: '#7a1f55' },
  '×': { face: '#e0a52f', lit: '#f7cf6b', edge: '#7d5812' },
  '÷': { face: '#3fb57a', lit: '#78e3ab', edge: '#1b5f3c' },
  '^': { face: '#9b5fe0', lit: '#c4a0f7', edge: '#4d2878' },
  eq: { face: '#c9cfe0', lit: '#eef1f8', edge: '#7a8099' },
}

const inkOf = (token: Token) =>
  token.kind === 'num' ? TOKEN_INK.num
  : token.kind === 'eq' ? TOKEN_INK.eq
  : TOKEN_INK[token.op] ?? TOKEN_INK.num

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

  // Hair, and the moustache, which is the whole of what makes a circle with
  // two dots in it read as somebody's dad.
  ctx.fillStyle = '#2b1d14'
  ctx.beginPath()
  ctx.arc(0, -s * 0.79, s * 0.17, Math.PI * 1.08, Math.PI * 1.92)
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
  if (fear > 0.25) ctx.arc(0, -s * 0.69, s * (0.02 + fear * 0.045), 0, Math.PI * 2)
  else { ctx.ellipse(0, -s * 0.7, s * 0.05, s * 0.018, 0, 0, Math.PI * 2) }
  ctx.fill()

  ctx.fillStyle = '#2b1d14'
  ctx.beginPath()
  ctx.ellipse(0, -s * 0.735, s * 0.075, s * 0.022, 0, 0, Math.PI * 2)
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

  /*
   * Whatever he is in this chamber, with a surface that moves.
   *
   * The same rising shape for all four, drawn in that peril's colours and at
   * that peril's liveliness — flames jump about and go fast, sand barely moves
   * at all, which is what makes sand the frightening one.
   */
  const peril = perilFor(run.level)
  const top = floor - gh * run.water
  if (run.water > 0.001) {
    const grad = ctx.createLinearGradient(0, top, 0, floor)
    grad.addColorStop(0, peril.top)
    grad.addColorStop(1, peril.deep)
    ctx.globalAlpha = 0.62
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(gx, top)
    const swell = s * 0.055 * peril.swell
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const px = gx + gw * t
      const py = top
        + Math.sin(clock * 2.2 * peril.churn + t * 7) * swell
        + Math.sin(clock * 3.7 * peril.churn + t * 13) * swell * 0.4
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
  ctx.strokeStyle = peril.top
  ctx.lineWidth = Math.max(1, s * 0.05)
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 9)
  ctx.beginPath()
  ctx.moveTo(px, gy + s * 0.05)
  ctx.lineTo(px + Math.sin(clock * 7) * s * 0.03, gy + s * 0.45)
  ctx.stroke()
  ctx.globalAlpha = 1

  // And the drain, which runs while the banner from the last find is still up
  // — so the water going somewhere is visibly the find's doing.
  const drain = run.said !== null && run.said.life > 0.4
  ctx.fillStyle = drain ? peril.top : INK.stoneLit
  ctx.fillRect(gx + gw * 0.1, floor - s * 0.08, s * 0.4, s * 0.1)
}

// --- the board ---------------------------------------------------------------

const FACE = 'ui-monospace, "SF Mono", Menlo, monospace'

const sayOf = (t: Token): string => (t.kind === 'num' ? String(t.n) : t.kind === 'eq' ? '=' : t.op)

/**
 * One size of type for the whole board, set by the widest block on it.
 *
 * Sizing each block to its own contents was the obvious thing and it was
 * wrong: a `7` came out twice the size of a `144`, so the small numbers stood
 * out as though the board were pointing at them. It is not a hint — size would
 * follow how many digits there are, not whether anything is true — but it
 * looks exactly like one.
 */
function sizeFor(ctx: Ctx, run: Run, s: number): number {
  let widest = 1
  for (const cell of run.cells) widest = Math.max(widest, sayOf(cell.token).length)
  let size = s * 0.46
  const sample = '8'.repeat(widest)
  for (let tries = 0; tries < 10; tries++) {
    ctx.font = `700 ${size}px ${FACE}`
    if (ctx.measureText(sample).width <= s * 0.76) break
    size *= 0.92
  }
  return size
}

/** The sockets the blocks sit in, so a gap is a recess and not a hole. */
function drawSockets(ctx: Ctx, bx: number, by: number, s: number): void {
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const pad = s * 0.05
      ctx.fillStyle = (col + row) % 2 === 0 ? '#11151f' : '#0e1119'
      box(ctx, bx + col * s + pad, by + row * s + pad, s - pad * 2, s - pad * 2, s * 0.14)
      ctx.fill()
    }
  }
}

function drawCell(
  ctx: Ctx, run: Run, i: number, bx: number, by: number, s: number, clock: number,
  size: number, picked: Set<number>, lit: boolean,
): void {
  const cell = run.cells[i]
  const ink = inkOf(cell.token)
  const chosen = picked.has(i)

  const shake = cell.shake > 0 ? Math.sin(clock * 60) * cell.shake * s * 0.1 : 0
  const pad = s * 0.05
  const x = bx + colOf(i) * s + pad + shake
  const y = by + (rowOf(i) - cell.lift) * s + pad
  const w = s - pad * 2
  const h = s - pad * 2

  /*
   * Everything outside the selection steps back while a finger is down.
   *
   * The outline alone was not enough: a green line round a pink block is not
   * visible on a phone, and the one thing the player has to be able to see is
   * exactly which blocks they have got. Dimming the other sixty does more than
   * any amount of brightening the seven.
   */
  ctx.globalAlpha = run.anchor !== null && !chosen ? 0.45 : 1

  const grad = ctx.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, ink.lit)
  grad.addColorStop(0.45, ink.face)
  grad.addColorStop(1, ink.edge)
  ctx.fillStyle = grad
  box(ctx, x, y, w, h, s * 0.14)
  ctx.fill()

  /*
   * A chosen block is lifted and outlined, and the outline turns green the
   * moment the run reads as something true — before the finger comes up.
   *
   * That is the single most useful thing on the screen: it turns a guess into
   * a search you can feel your way through, which is the difference between
   * hunting and poking.
   */
  if (chosen) {
    // Two rings: a dark one first so the bright one reads against a block of
    // any colour underneath it.
    ctx.strokeStyle = '#05060a'
    ctx.lineWidth = Math.max(2.5, s * 0.1)
    box(ctx, x, y, w, h, s * 0.14)
    ctx.stroke()
    ctx.strokeStyle = lit ? INK.good : INK.chalk
    ctx.lineWidth = Math.max(1.5, s * 0.06)
    box(ctx, x, y, w, h, s * 0.14)
    ctx.stroke()
    if (lit) {
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(clock * 8)
      ctx.fillStyle = INK.good
      box(ctx, x, y, w, h, s * 0.14)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  } else {
    ctx.strokeStyle = cell.shake > 0 ? INK.bad : ink.edge
    ctx.lineWidth = Math.max(1, s * (cell.shake > 0 ? 0.05 : 0.02))
    box(ctx, x, y, w, h, s * 0.14)
    ctx.stroke()
  }

  ctx.globalAlpha = 0.3
  ctx.fillStyle = '#ffffff'
  box(ctx, x + s * 0.08, y + s * 0.05, w - s * 0.16, h * 0.2, s * 0.07)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.globalAlpha = run.anchor !== null && !chosen ? 0.45 : 1

  const words = sayOf(cell.token)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // An operator is drawn bigger than a number: it is one character doing the
  // work of three, and at the same size it disappears.
  ctx.font = `700 ${cell.token.kind === 'num' ? size : size * 1.3}px ${FACE}`
  ctx.fillStyle = '#0a0d14'
  ctx.globalAlpha = 0.35
  ctx.fillText(words, x + w / 2, y + h / 2 + size * 0.07)
  ctx.globalAlpha = 1
  ctx.fillStyle = cell.token.kind === 'eq' ? '#141822' : INK.chalk
  ctx.fillText(words, x + w / 2, y + h / 2)
  ctx.globalAlpha = 1

  /*
   * A spark, drawn round the block rather than over it.
   *
   * It has to be unmissable from across the room and it must not get in the
   * way of the number, because the number is still the thing being read — the
   * spark rides on an ordinary block and the sum it is part of is an ordinary
   * sum. So: a turning ring of light outside the block, and a warm glow behind
   * the digits.
   */
  if (cell.spark) {
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    const beat = 0.75 + 0.25 * Math.sin(clock * 5)
    ctx.globalAlpha = 0.33 * beat
    ctx.fillStyle = '#ffd166'
    ctx.beginPath()
    ctx.arc(0, 0, w * 0.46, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = beat
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = Math.max(1.5, s * 0.045)
    ctx.rotate(clock * 1.6)
    // Four short arcs rather than a circle, so it reads as turning.
    for (let k = 0; k < 4; k++) {
      ctx.beginPath()
      ctx.arc(0, 0, w * 0.56, k * Math.PI / 2, k * Math.PI / 2 + 0.75)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }
}

/**
 * The outline of what a find would take with it.
 *
 * Drawn while the selection reads as true, so the prize for a long one is
 * visible before it is claimed rather than explained in a menu somebody will
 * not read.
 */
function drawBlast(ctx: Ctx, picked: number[], bx: number, by: number, s: number, clock: number): void {
  if (picked.length < 5) return
  const hit = new Set(blastOf(picked))
  const mine = new Set(picked)
  ctx.save()
  ctx.globalAlpha = 0.14 + 0.07 * Math.sin(clock * 7)
  ctx.fillStyle = INK.good
  for (const i of hit) {
    if (mine.has(i)) continue
    box(ctx, bx + colOf(i) * s + s * 0.05, by + rowOf(i) * s + s * 0.05, s * 0.9, s * 0.9, s * 0.14)
    ctx.fill()
  }
  ctx.restore()
}

/** How many blocks the chamber still wants gone, as beads along the top. */
function drawTally(ctx: Ctx, run: Run, x: number, y: number, s: number): void {
  const beads = 15
  const done = Math.round(((45 - run.left) / 45) * beads)
  const gap = (WIDE * s) / beads
  for (let i = 0; i < beads; i++) {
    ctx.fillStyle = i < done ? INK.good : '#2a3045'
    ctx.beginPath()
    ctx.arc(x + gap * (i + 0.5), y, Math.max(1.5, s * 0.05), 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * The strip that says what the game can see.
 *
 * Two jobs, and the first is the important one: while a finger is still down
 * and the run under it reads as something, it says so — "square numbers",
 * "each one is the two before it added up" — before anything is claimed. A
 * game that names the pattern is teaching; a game that only says "correct"
 * afterwards is marking.
 *
 * The second job is the receipt: what was found, written out, and what it was
 * worth.
 */
function drawBanner(ctx: Ctx, run: Run, x: number, y: number, w: number, s: number): void {
  const middle = x + w / 2
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (run.reading) {
    ctx.font = `700 ${s * 0.3}px ${FACE}`
    ctx.fillStyle = INK.good
    ctx.fillText(run.reading.says, middle, y + s * 0.3)
    ctx.restore()
    return
  }

  const said = run.said
  if (!said) {
    /*
     * Nothing found and nothing being dragged, so this is the line that is on
     * screen most of the time — which makes it the right place to say what the
     * chamber is asking for, rather than a general instruction nobody needs
     * twice. It carries the example too, because "find a sequence" means
     * nothing on its own and "like 2 4 8 16" means all of it.
     */
    const asking = HUNT_SAYS[run.hunt]
    ctx.font = `700 ${s * 0.21}px ${FACE}`
    ctx.fillStyle = asking.tint
    ctx.fillText(asking.wants, middle, y + s * 0.18)
    ctx.font = `600 ${s * 0.18}px ${FACE}`
    ctx.fillStyle = 'rgba(138,145,171,0.55)'
    ctx.fillText(asking.like, middle, y + s * 0.45)
    ctx.restore()
    return
  }

  ctx.globalAlpha = Math.min(1, said.life / 0.5)
  ctx.font = `700 ${s * 0.26}px ${FACE}`
  // A find of the kind the chamber did not ask for is still a find and still
  // says so; it just does not get the green. That is the whole of how "quietly"
  // is drawn — no cross, no telling-off, a smaller number and a calmer colour.
  ctx.fillStyle = said.asked ? INK.good : INK.dim
  ctx.fillText(said.says, middle, y + s * 0.18)
  ctx.font = `600 ${s * 0.19}px ${FACE}`
  ctx.fillStyle = INK.dim
  ctx.fillText(`${said.line}   +${said.worth}`, middle, y + s * 0.45)
  ctx.restore()
}

export function drawRun(ctx: Ctx, run: Run, view: View): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = INK.back
  ctx.fillRect(0, 0, view.w, view.h)

  const { x, y, scale } = fieldOf(view)
  drawChamber(ctx, run, x, y, scale, view.clock)
  drawBanner(ctx, run, x, y + CHAMBER * scale, WIDE * scale, scale)

  const by = y + (CHAMBER + BANNER) * scale
  drawTally(ctx, run, x, by - scale * 0.1, scale)

  drawSockets(ctx, x, by, scale)

  const picked = new Set(run.picked)
  const lit = run.reading !== null
  if (lit) drawBlast(ctx, run.picked, x, by, scale, view.clock)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, by, WIDE * scale, ROWS * scale)
  ctx.clip()
  const size = sizeFor(ctx, run, scale)
  for (let i = 0; i < run.cells.length; i++) {
    drawCell(ctx, run, i, x, by, scale, view.clock, size, picked, lit)
  }
  ctx.restore()

}

/** Which block a point lands on, or null. The screen's half of the dragging. */
export function cellAt(view: View, px: number, py: number): number | null {
  const { x, y, scale } = fieldOf(view)
  const by = y + (CHAMBER + BANNER) * scale
  const col = Math.floor((px - x) / scale)
  const row = Math.floor((py - by) / scale)
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null
  return row * COLS + col
}
