/**
 * The Scales, drawn.
 *
 * Papa's weighing machine on his bench: an iron beam on a post, a wooden
 * crate hanging off one end and a pan of brass weights off the other. Warm
 * and old-fashioned on purpose — every other game in this app is a screen of
 * light, and this one is the only one that wants to feel like a thing on a
 * table that you are allowed to touch.
 *
 * The drawing has one job beyond looking nice: the beam has to say *which way
 * you are wrong*. Too light and it tips towards the crate, too heavy and it
 * tips towards you, and the closer you get the flatter it sits. That is the
 * feedback the whole game runs on, and it is why the beam swings towards
 * where it should be rather than snapping there.
 */
import { WEIGHTS, bitsFor, bitsOf, saysOn, asks } from './level'
import { onPan, type Run } from './run'

export interface View {
  w: number
  h: number
  clock: number
}

const INK = {
  wall: '#231a16',
  wallLow: '#140f0d',
  bench: '#5a3c24',
  benchTop: '#7a5230',
  iron: '#4a4f58',
  ironLit: '#767d8a',
  brass: '#d9a441',
  brassLit: '#ffe29a',
  brassDim: '#6c5527',
  wood: '#a97142',
  woodDark: '#7b4f2c',
  chalk: '#f1e6d2',
  dim: '#9a8c78',
  good: '#4ade80',
  warn: '#ffc84a',
  bad: '#ff6b53',
} as const

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

/** The workshop behind the machine. */
function workshop(ctx: CanvasRenderingContext2D, view: View): void {
  const { w, h } = view
  const wall = ctx.createLinearGradient(0, 0, 0, h)
  wall.addColorStop(0, INK.wallLow)
  wall.addColorStop(0.55, INK.wall)
  wall.addColorStop(1, '#1b1310')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, w, h)

  // A lamp over the bench, because a workshop at night has one light in it
  // and everything else is the dark round the edge.
  const lamp = ctx.createRadialGradient(w / 2, h * 0.06, 0, w / 2, h * 0.06, h * 0.7)
  lamp.addColorStop(0, 'rgba(255,214,150,0.3)')
  lamp.addColorStop(0.5, 'rgba(255,196,120,0.07)')
  lamp.addColorStop(1, 'rgba(255,196,120,0)')
  ctx.fillStyle = lamp
  ctx.fillRect(0, 0, w, h)

  // The bench the machine stands on.
  const top = h * 0.78
  ctx.fillStyle = INK.benchTop
  ctx.fillRect(0, top, w, h * 0.03)
  ctx.fillStyle = INK.bench
  ctx.fillRect(0, top + h * 0.03, w, h - top)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = Math.max(1, h * 0.002)
  for (let i = 1; i < 6; i++) {
    const y = top + h * 0.03 + (i / 6) * (h - top - h * 0.03)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

/** One brass weight, with its number on it. */
export function drawWeight(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, wide: number, tall: number, value: number, on: boolean,
): void {
  const face = ctx.createLinearGradient(x, y, x, y + tall)
  face.addColorStop(0, on ? INK.brassLit : '#8a6c33')
  face.addColorStop(0.5, on ? INK.brass : '#6f5627')
  face.addColorStop(1, on ? '#a97c2c' : INK.brassDim)
  ctx.fillStyle = face
  // A weight is a trapezium with a handle: narrower at the top, like every
  // weight anybody has ever picked up.
  ctx.beginPath()
  ctx.moveTo(x + wide * 0.18, y)
  ctx.lineTo(x + wide * 0.82, y)
  ctx.lineTo(x + wide, y + tall)
  ctx.lineTo(x, y + tall)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = on ? 'rgba(255,226,154,0.85)' : 'rgba(140,110,60,0.6)'
  ctx.fillRect(x + wide * 0.3, y - tall * 0.16, wide * 0.4, tall * 0.1)

  ctx.fillStyle = on ? '#3a2a0c' : '#241c10'
  ctx.font = `bold ${Math.round(tall * 0.46)}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(value), x + wide / 2, y + tall * 0.6)
}

/** The crate on the other pan, with whatever is chalked on its side. */
function drawCrate(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, wide: number, tall: number, says: string, cheer: number,
): void {
  const face = ctx.createLinearGradient(x, y, x, y + tall)
  face.addColorStop(0, INK.wood)
  face.addColorStop(1, INK.woodDark)
  ctx.fillStyle = face
  box(ctx, x, y, wide, tall, Math.min(8, wide * 0.08))
  ctx.strokeStyle = 'rgba(60,34,16,0.8)'
  ctx.lineWidth = Math.max(1.5, tall * 0.045)
  ctx.beginPath()
  ctx.moveTo(x, y + tall * 0.25)
  ctx.lineTo(x + wide, y + tall * 0.25)
  ctx.moveTo(x, y + tall * 0.75)
  ctx.lineTo(x + wide, y + tall * 0.75)
  ctx.stroke()

  if (cheer > 0) {
    ctx.fillStyle = `rgba(74,222,128,${0.3 * cheer})`
    box(ctx, x, y, wide, tall, Math.min(8, wide * 0.08))
  }

  // Chalked on, in a hand rather than a typeface: this is the number the
  // whole crate is about and it should look written.
  ctx.fillStyle = INK.chalk
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const power = says.match(/^2\^(\d+)$/)
  if (power) {
    const size = Math.round(tall * 0.42)
    ctx.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`
    const base = ctx.measureText('2').width
    const sup = Math.round(size * 0.6)
    ctx.textAlign = 'left'
    const from = x + wide / 2 - (base + sup * 0.6) / 2
    ctx.fillText('2', from, y + tall / 2)
    ctx.font = `bold ${sup}px ui-monospace, Menlo, Consolas, monospace`
    ctx.fillText(power[1], from + base, y + tall * 0.34)
  } else {
    ctx.font = `bold ${Math.round(tall * (says.length > 2 ? 0.4 : 0.5))}px ui-monospace, Menlo, Consolas, monospace`
    ctx.fillText(says, x + wide / 2, y + tall / 2)
  }
}

/**
 * The whole machine.
 *
 * Laid out off the canvas rather than in fixed pixels, so the same drawing
 * works on a phone held upright, a phone on its side and a tablet — which is
 * the only reason any of these games survive being turned round.
 */
export function drawRun(ctx: CanvasRenderingContext2D, run: Run, view: View): void {
  const { w, h } = view
  workshop(ctx, view)

  const bits = bitsFor(run.level)
  /*
   * The machine fills the picture. The first go at this hung the pans half
   * way up a tall screen with a hand's width of empty bench underneath, which
   * is what a drawing laid out in fractions does when nobody looks at it on a
   * phone.
   */
  const middle = w / 2
  const postTop = h * 0.2
  const benchTop = h * 0.72

  // --- the clock, a bar across the top -------------------------------------
  const left = run.clock / Math.max(1, run.crate.seconds)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, w, h * 0.022)
  ctx.fillStyle = left > 0.5 ? INK.good : left > 0.22 ? INK.warn : INK.bad
  ctx.fillRect(0, 0, w * left, h * 0.022)

  // --- what the machine is asking ------------------------------------------
  ctx.fillStyle = INK.dim
  ctx.font = `bold ${Math.round(h * 0.026)}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(asks(run.crate), middle, h * 0.045)

  // --- the belt, with what is still to come --------------------------------
  const beltY = h * 0.1
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(w * 0.06, beltY, w * 0.88, h * 0.012)
  for (let i = 0; i < Math.min(6, run.left); i++) {
    const cx = w * 0.12 + i * (w * 0.08)
    ctx.fillStyle = INK.woodDark
    box(ctx, cx, beltY - h * 0.028, w * 0.05, h * 0.028, 2)
  }
  if (run.left > 6) {
    ctx.fillStyle = INK.dim
    ctx.font = `${Math.round(h * 0.02)}px ui-monospace, Menlo, Consolas, monospace`
    ctx.textAlign = 'left'
    ctx.fillText(`+${run.left - 6}`, w * 0.12 + 6 * (w * 0.08), beltY - h * 0.012)
  }

  // --- the post ------------------------------------------------------------
  ctx.fillStyle = INK.iron
  ctx.fillRect(middle - w * 0.018, postTop, w * 0.036, benchTop - postTop)
  ctx.fillStyle = INK.ironLit
  ctx.fillRect(middle - w * 0.018, postTop, w * 0.012, benchTop - postTop)
  ctx.fillStyle = INK.iron
  box(ctx, middle - w * 0.12, benchTop - h * 0.02, w * 0.24, h * 0.025, 4)

  // --- the beam ------------------------------------------------------------
  const arm = w * 0.33
  const tip = Math.max(-0.3, Math.min(0.3, run.beam)) * 0.8
  ctx.save()
  ctx.translate(middle, postTop)
  ctx.rotate(tip)
  ctx.fillStyle = INK.iron
  box(ctx, -arm, -h * 0.008, arm * 2, h * 0.016, h * 0.008)
  ctx.fillStyle = INK.ironLit
  ctx.fillRect(-arm, -h * 0.008, arm * 2, h * 0.004)
  ctx.restore()
  // The pivot.
  ctx.fillStyle = INK.brass
  ctx.beginPath()
  ctx.arc(middle, postTop, w * 0.022, 0, Math.PI * 2)
  ctx.fill()

  // Where each end of the beam has got to, which is where the pans hang from.
  const endL = { x: middle - Math.cos(tip) * arm, y: postTop - Math.sin(tip) * arm }
  const endR = { x: middle + Math.cos(tip) * arm, y: postTop + Math.sin(tip) * arm }

  const hang = (from: { x: number; y: number }): number => {
    const drop = h * 0.32
    ctx.strokeStyle = '#8d93a0'
    ctx.lineWidth = Math.max(1, h * 0.0025)
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(from.x + side * w * 0.1, from.y + drop)
      ctx.stroke()
    }
    // The pan itself.
    const panY = from.y + drop
    ctx.fillStyle = INK.ironLit
    ctx.beginPath()
    ctx.moveTo(from.x - w * 0.12, panY)
    ctx.lineTo(from.x + w * 0.12, panY)
    ctx.lineTo(from.x + w * 0.1, panY + h * 0.018)
    ctx.lineTo(from.x - w * 0.1, panY + h * 0.018)
    ctx.closePath()
    ctx.fill()
    return panY
  }

  const panL = hang(endL)
  const panR = hang(endR)

  // --- the crate, on the left pan ------------------------------------------
  const crateW = w * 0.2
  const crateH = h * 0.115
  drawCrate(ctx, endL.x - crateW / 2, panL - crateH, crateW, crateH, saysOn(run.crate), run.cheer)

  // --- your weights, stacked on the right pan ------------------------------
  /*
   * Stacked biggest at the bottom, which is how anybody stacks weights and
   * also happens to put the binary number the right way up.
   */
  const stack: { value: number; many: number }[] = []
  for (let bit = bits - 1; bit >= 0; bit--) {
    if (run.pan[bit] > 0) stack.push({ value: WEIGHTS[bit], many: run.pan[bit] })
  }
  let y = panR
  const unit = h * 0.042
  for (const { value, many } of stack) {
    for (let i = 0; i < many; i++) {
      const wide = w * (0.055 + 0.012 * String(value).length)
      y -= unit
      drawWeight(ctx, endR.x - wide / 2, y, wide, unit * 0.92, value, true)
    }
  }

  // --- the readout ---------------------------------------------------------
  /*
   * The line this whole game is for. The weights on the pan, written out as
   * the bits they are, with what they come to beside it — so that putting
   * brass on a pan and writing 101101 are visibly the same act.
   */
  const readY = benchTop + h * 0.13
  const written = bitsOf(run.pan, bits)
  const total = onPan(run)

  // A dark plate to read it off, because the bench is a busy brown and this
  // line is the one thing on the screen worth being certain about.
  ctx.fillStyle = 'rgba(12,10,9,0.72)'
  box(ctx, w * 0.04, readY - h * 0.075, w * 0.92, h * 0.14, h * 0.018)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const spacing = Math.min(w * 0.082, (w * 0.62) / bits)
  const wide = spacing * (written.length - 1)
  const sum = `= ${run.crate.job === 'name' ? '?' : total}`
  ctx.font = `bold ${Math.round(h * 0.055)}px ui-monospace, Menlo, Consolas, monospace`
  const sumWide = ctx.measureText(sum).width
  const from = middle - (wide + spacing * 0.8 + sumWide) / 2

  /*
   * What is on the pan, written as the bits it is — the line this whole game
   * is for. The place value goes over each one, small, so that "the third
   * light from the right is the fours" is on the screen rather than in
   * somebody's head.
   */
  for (const [i, ch] of [...written].entries()) {
    const x = from + i * spacing
    const bit = written.length - 1 - i
    ctx.font = `${Math.round(h * 0.018)}px ui-monospace, Menlo, Consolas, monospace`
    ctx.fillStyle = 'rgba(241,230,210,0.4)'
    ctx.fillText(String(WEIGHTS[bit]), x, readY - h * 0.04)
    ctx.font = `bold ${Math.round(h * 0.06)}px ui-monospace, Menlo, Consolas, monospace`
    ctx.fillStyle = ch === '1' ? INK.brassLit : 'rgba(241,230,210,0.22)'
    ctx.fillText(ch, x, readY + h * 0.012)
  }

  ctx.font = `bold ${Math.round(h * 0.055)}px ui-monospace, Menlo, Consolas, monospace`
  ctx.fillStyle = run.crate.job === 'name' ? 'rgba(241,230,210,0.35)' : INK.chalk
  ctx.textAlign = 'left'
  ctx.fillText(sum, from + wide + spacing * 0.8, readY + h * 0.012)
}
