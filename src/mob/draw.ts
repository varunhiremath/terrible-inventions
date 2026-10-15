/**
 * Drawing the swarm.
 *
 * Canvas primitives only, like the rest of this. The lane is drawn to fixed
 * units and scaled to whatever screen it lands on, because judging whether a
 * block will reach the line before your next shot does is the game, and a lane
 * that changes shape with the window is not a game.
 *
 * The one thing in here that is a decision rather than a drawing: a squad is
 * drawn as a cluster of little figures *and* has its number written on it. Not
 * one or the other. The cluster is what makes a squad of twenty feel like
 * twenty — a single sprite with "20" on it reads as a bullet with a label — and
 * the number is what makes the arithmetic legible, because nobody counts
 * seventeen dots while they are moving. Past a dozen figures the cluster stops
 * gaining anything, so it stops growing and the number carries the rest.
 */
import {
  CART_W, CART_Y, GATE_SLIDE, LANE, LINE_Y, MOB_H, MOB_W, SIGN, TALL, WEAPONS,
  kind, weaponFor, type Block, type Gate, type Op, type Weapon,
} from './level'
import type { Run, Said, Squad } from './run'

type Ctx = CanvasRenderingContext2D

export interface View {
  w: number
  h: number
  clock: number
}

export const INK = {
  back: '#070912',
  far: '#111a33',
  lane: '#1b2b44',
  edge: '#2b3c6b',
  chalk: '#e9edf8',
  dim: '#8d96b4',
  line: '#ff5f7a',
  cart: '#8fd3ff',
  cartTrim: '#2a6ea8',
  mob: '#b9603f',
  mobTrim: '#6d2f1c',
  good: '#9af5c0',
  bad: '#ff8c8c',
} as const

/** The lane, as a box on the screen, keeping its shape whatever the window. */
export function fieldOf(view: View): { x: number; y: number; scale: number } {
  const scale = Math.min(view.w / LANE, view.h / TALL)
  return { x: (view.w - LANE * scale) / 2, y: (view.h - TALL * scale) / 2, scale }
}

const mono = (size: number) => `bold ${size}px ui-monospace, Menlo, Consolas, monospace`

/**
 * One little figure: a head, a body, two legs.
 *
 * Three ovals and two lines at the size this is drawn at, which is a few pixels
 * tall. Anything more detailed is mud.
 */
function drawBody(ctx: Ctx, x: number, y: number, r: number, ink: string, step: number): void {
  ctx.fillStyle = ink
  // Body.
  ctx.beginPath()
  ctx.ellipse(x, y, r * 0.62, r * 0.95, 0, 0, Math.PI * 2)
  ctx.fill()
  // Head.
  ctx.beginPath()
  ctx.arc(x, y - r * 1.15, r * 0.52, 0, Math.PI * 2)
  ctx.fill()
  // Legs, out of step with each other so a crowd looks like it is walking.
  ctx.strokeStyle = ink
  ctx.lineWidth = Math.max(1, r * 0.32)
  ctx.beginPath()
  ctx.moveTo(x - r * 0.1, y + r * 0.8)
  ctx.lineTo(x - r * 0.45 + Math.sin(step) * r * 0.3, y + r * 1.7)
  ctx.moveTo(x + r * 0.1, y + r * 0.8)
  ctx.lineTo(x + r * 0.45 - Math.sin(step) * r * 0.3, y + r * 1.7)
  ctx.stroke()
}

/**
 * Where the figures in a cluster of this size sit, in units of their radius.
 *
 * Two and three stand side by side rather than in a ring, because a ring of two
 * puts one behind the other and a squad of two then looks like a squad of one
 * with a smudge — which is exactly the size where the number matters most,
 * since that is what the first gate of the game is about to double.
 */
function clusterSpots(many: number): { dx: number; dy: number }[] {
  if (many <= 3) {
    const spread = many === 1 ? [0] : many === 2 ? [-0.9, 0.9] : [-1.6, 0, 1.6]
    return spread.map((dx) => ({ dx, dy: 0 }))
  }

  const spots: { dx: number; dy: number }[] = []
  // Rings outward from the middle: one, then five, then as many as fit.
  const rings = [
    { at: 0, of: 1 },
    { at: 1.5, of: 5 },
    { at: 2.8, of: 6 },
  ]
  for (const ring of rings) {
    for (let i = 0; i < ring.of && spots.length < many; i++) {
      const turn = (i / ring.of) * Math.PI * 2 + ring.at
      spots.push({ dx: Math.cos(turn) * ring.at, dy: Math.sin(turn) * ring.at * 0.7 })
    }
    if (spots.length >= many) break
  }
  return spots
}

export function drawSquad(
  ctx: Ctx,
  squad: Squad,
  x: number,
  y: number,
  scale: number,
  clock: number,
  tint: string,
): void {
  // Twelve figures is as many as reads as a crowd; past that the number does
  // the work. Below that the count and the crowd agree exactly, which is the
  // whole point of drawing them at all.
  const shown = Math.min(12, squad.n)
  const r = scale * (squad.n > 6 ? 0.13 : 0.17)

  ctx.save()
  if (squad.flash > 0) {
    ctx.shadowColor = tint
    ctx.shadowBlur = scale * 0.5 * squad.flash
  }
  for (const [i, spot] of clusterSpots(shown).entries()) {
    drawBody(ctx, x + spot.dx * r * 1.9, y + spot.dy * r * 1.9, r, tint, clock * 14 + i)
  }
  ctx.restore()

  if (squad.n > 1) {
    const size = Math.max(9, scale * (squad.n > 9 ? 0.4 : 0.36))
    ctx.font = mono(size)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = Math.max(2, size * 0.3)
    ctx.strokeStyle = 'rgba(5,6,12,0.9)'
    ctx.strokeText(String(squad.n), x, y - r * 2.9)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(squad.n), x, y - r * 2.9)
  }
}

/** A block of Papa's machines: a crate on treads with a count on the side. */
export function drawBlock(
  ctx: Ctx,
  block: Block,
  x: number,
  y: number,
  scale: number,
  clock: number,
): void {
  const w = MOB_W * scale
  const h = MOB_H * scale
  const left = x - w / 2
  const top = y - h / 2
  const hurt = block.flash > 0

  ctx.save()
  ctx.fillStyle = hurt ? '#ffd9c9' : INK.mob
  ctx.strokeStyle = INK.mobTrim
  ctx.lineWidth = Math.max(1.5, scale * 0.06)
  ctx.beginPath()
  ctx.roundRect(left, top, w, h, scale * 0.18)
  ctx.fill()
  ctx.stroke()

  // Treads, shuffling along. The offset is the clock, so a row of them moves
  // together like one machine rather than twelve separate ones.
  ctx.fillStyle = INK.mobTrim
  const treadH = h * 0.2
  for (let i = 0; i < 5; i++) {
    const slide = ((clock * 0.8 + i / 5) % 1) * (w * 0.2)
    ctx.fillRect(left + w * 0.08 + slide + i * w * 0.18, top + h - treadH * 0.9, w * 0.1, treadH)
  }

  // One eye, because a crate with an eye is a thing coming for you and a crate
  // is a crate.
  ctx.fillStyle = '#10131f'
  ctx.beginPath()
  ctx.arc(x + w * 0.26, top + h * 0.34, scale * 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hurt ? '#ff6b6b' : '#ffd166'
  ctx.beginPath()
  ctx.arc(x + w * 0.28, top + h * 0.33, scale * 0.045, 0, Math.PI * 2)
  ctx.fill()

  const size = Math.max(11, scale * 0.52)
  ctx.font = mono(size)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#1a0f0a'
  ctx.fillText(String(block.count), left + w * 0.12, y)
  ctx.restore()
}

/** One gate: a frame across its half of the lane with the sum written in it. */
export function drawGate(
  ctx: Ctx,
  gate: Gate,
  field: { x: number; y: number; scale: number },
  clock: number,
): void {
  const { scale } = field
  const slide = Math.min(1, Math.max(0, (clock - gate.born) / GATE_SLIDE))
  const ease = 1 - (1 - slide) * (1 - slide)
  const left = field.x + gate.from * scale
  const wide = (gate.to - gate.from) * scale
  const y = field.y + gate.y * scale
  const tall = scale * 1.15
  const good = kind(gate.op) === 'good'
  const ink = good ? INK.good : INK.bad

  ctx.save()
  ctx.globalAlpha = 0.25 + 0.75 * ease
  ctx.translate(0, (1 - ease) * -scale * 1.2)

  // The frame. Open in the middle: it is a gate, not a wall, and a squad goes
  // through it rather than into it.
  ctx.fillStyle = good ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.12)'
  ctx.fillRect(left, y - tall / 2, wide, tall)
  ctx.strokeStyle = ink
  ctx.lineWidth = Math.max(2, scale * (gate.flash > 0 ? 0.13 : 0.08))
  ctx.beginPath()
  ctx.moveTo(left, y - tall / 2)
  ctx.lineTo(left + wide, y - tall / 2)
  ctx.moveTo(left, y + tall / 2)
  ctx.lineTo(left + wide, y + tall / 2)
  ctx.stroke()
  // Posts at the edges of the lane and down the middle, so which half is which
  // is unmistakable.
  ctx.fillStyle = ink
  ctx.fillRect(left - scale * 0.03, y - tall / 2, scale * 0.07, tall)
  ctx.fillRect(left + wide - scale * 0.04, y - tall / 2, scale * 0.07, tall)

  if (gate.flash > 0) {
    ctx.shadowColor = ink
    ctx.shadowBlur = scale * 0.8 * gate.flash
  }
  const size = Math.max(16, scale * 0.78)
  ctx.font = mono(size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  ctx.fillText(`${SIGN[gate.op]}${gate.by}`, left + wide / 2, y)
  ctx.restore()
}

/** The cart, which is the gun on wheels. */
export function drawCart(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  weapon: Weapon,
  clock: number,
): void {
  const w = CART_W * scale
  const h = scale * 0.8

  ctx.save()
  // Barrels: one for each in the squad it fires, which is the clearest way to
  // say what a new gun changed without a word of text.
  ctx.fillStyle = weapon.tint
  const barrels = Math.min(5, weapon.squad)
  for (let i = 0; i < barrels; i++) {
    const at = barrels === 1 ? 0 : (i / (barrels - 1) - 0.5) * w * 0.62
    ctx.fillRect(x + at - scale * 0.06, y - h * 0.95, scale * 0.12, h * 0.55)
  }

  ctx.fillStyle = INK.cart
  ctx.strokeStyle = INK.cartTrim
  ctx.lineWidth = Math.max(1.5, scale * 0.06)
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, scale * 0.2)
  ctx.fill()
  ctx.stroke()

  // Wheels, turning with the clock so standing still does not look broken.
  ctx.fillStyle = INK.cartTrim
  for (const side of [-1, 1]) {
    const cx = x + side * w * 0.3
    const cy = y + h * 0.45
    ctx.beginPath()
    ctx.arc(cx, cy, scale * 0.17, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0a0d17'
    ctx.lineWidth = Math.max(1, scale * 0.04)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(clock * 6) * scale * 0.15, cy + Math.sin(clock * 6) * scale * 0.15)
    ctx.stroke()
  }
  ctx.restore()
}

/** The sums, floating where they happened. */
function drawSaid(ctx: Ctx, said: Said, x: number, y: number, scale: number): void {
  const fade = Math.min(1, said.life / 0.5)
  const size = Math.max(12, scale * 0.52)
  ctx.save()
  ctx.globalAlpha = fade
  ctx.font = mono(size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, size * 0.32)
  ctx.strokeStyle = 'rgba(5,6,12,0.92)'
  ctx.strokeText(said.text, x, y)
  ctx.fillStyle = said.tint
  ctx.fillText(said.text, x, y)
  ctx.restore()
}

/**
 * The lane itself: the dark beyond the top, the walls, and the line.
 *
 * The top of the lane fades out rather than ending in a hard edge, because the
 * mob walks in from above and a block appearing at a line looks like a bug.
 */
function drawLane(ctx: Ctx, field: { x: number; y: number; scale: number }, view: View): void {
  const { scale } = field
  const wide = LANE * scale
  const tall = TALL * scale

  ctx.fillStyle = INK.back
  ctx.fillRect(0, 0, view.w, view.h)

  const sky = ctx.createLinearGradient(0, field.y, 0, field.y + tall)
  sky.addColorStop(0, '#0a1024')
  sky.addColorStop(0.45, '#121a35')
  sky.addColorStop(1, '#1a2345')
  ctx.fillStyle = sky
  ctx.fillRect(field.x, field.y, wide, tall)

  // Lane markings, to give the walk down something to be measured against.
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'
  ctx.lineWidth = Math.max(1, scale * 0.04)
  for (let i = 1; i < LANE; i++) {
    ctx.beginPath()
    ctx.moveTo(field.x + i * scale, field.y)
    ctx.lineTo(field.x + i * scale, field.y + tall)
    ctx.stroke()
  }

  ctx.strokeStyle = INK.edge
  ctx.lineWidth = Math.max(2, scale * 0.09)
  ctx.strokeRect(field.x, field.y, wide, tall)

  // The line they must not cross, drawn as hazard stripes rather than a line:
  // a thin red line reads as decoration and this is the whole stake.
  const y = field.y + LINE_Y * scale
  const thick = scale * 0.26
  ctx.save()
  ctx.beginPath()
  ctx.rect(field.x, y - thick / 2, wide, thick)
  ctx.clip()
  ctx.fillStyle = 'rgba(255,95,122,0.22)'
  ctx.fillRect(field.x, y - thick / 2, wide, thick)
  ctx.strokeStyle = INK.line
  ctx.lineWidth = thick * 0.5
  for (let i = -1; i < LANE * 2; i++) {
    ctx.beginPath()
    ctx.moveTo(field.x + i * scale * 0.5, y + thick)
    ctx.lineTo(field.x + (i + 0.6) * scale * 0.5, y - thick)
    ctx.stroke()
  }
  ctx.restore()
}

/** Everything, in the order it has to be in. */
export function drawRun(ctx: Ctx, run: Run, view: View): void {
  const field = fieldOf(view)
  const { scale } = field
  const at = (x: number, y: number) => ({ x: field.x + x * scale, y: field.y + y * scale })

  drawLane(ctx, field, view)

  ctx.save()
  ctx.beginPath()
  ctx.rect(field.x, field.y, LANE * scale, TALL * scale)
  ctx.clip()

  for (const gate of run.gates) drawGate(ctx, gate, field, run.clock)

  for (const block of run.blocks) {
    const spot = at(block.x, block.y)
    drawBlock(ctx, block, spot.x, spot.y, scale, run.clock)
  }

  const weapon = weaponFor(run.hits)
  for (const squad of run.squads) {
    const spot = at(squad.x, squad.y)
    drawSquad(ctx, squad, spot.x, spot.y, scale, run.clock, weapon.tint)
  }

  const cart = at(run.cart, CART_Y)
  drawCart(ctx, cart.x, cart.y, scale, weapon, run.clock)

  for (const said of run.says) {
    const spot = at(said.x, said.y)
    drawSaid(ctx, said, spot.x, spot.y, scale)
  }
  ctx.restore()
}

/**
 * The gun you have, named, for the corner of the screen.
 *
 * Drawn rather than written as a word on its own: the thing that changed is how
 * many barrels there are, so showing the barrels says it without reading.
 */
export function drawGun(ctx: Ctx, run: Run, x: number, y: number, size: number): void {
  const weapon = weaponFor(run.hits)
  const next = WEAPONS.find((w) => w.at > run.hits)

  ctx.save()
  ctx.font = mono(size)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = weapon.tint
  ctx.fillText(weapon.name.toUpperCase(), x, y)
  if (next) {
    ctx.font = mono(size * 0.8)
    ctx.fillStyle = INK.dim
    ctx.fillText(`${next.at - run.hits} to ${next.name.toLowerCase()}`, x, y + size * 1.3)
  }
  ctx.restore()
}

/**
 * A stretch of the lane for the front screen's tile and the opening story.
 *
 * The game's own pieces, at the game's own scale: a gate row, a block walking
 * down into it and a squad on its way up. Drawn from the same functions the
 * game draws with, so it cannot drift away from what the game looks like — the
 * fault this project has found three times now is a tile showing something
 * that is nowhere in the game it opens.
 */
export function drawTaste(ctx: Ctx, w: number, h: number, clock: number): void {
  const scale = Math.min(w / 6.4, h / 7.2)
  const field = { x: (w - 6.4 * scale) / 2, y: (h - 7.2 * scale) / 2, scale }
  const at = (x: number, y: number) => ({ x: field.x + x * scale, y: field.y + y * scale })

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0a1024')
  sky.addColorStop(1, '#1b2446')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const row: Gate[] = [
    { id: 1, op: 'times' as Op, by: 3, from: 0, to: 3.2, y: 3.5, flash: 0, born: -9 },
    { id: 2, op: 'plus' as Op, by: 4, from: 3.2, to: 6.4, y: 3.5, flash: 0, born: -9 },
  ]
  for (const gate of row) drawGate(ctx, gate, field, clock)

  const block = { id: 3, x: 1.6, y: 1.2, count: 12, flash: 0 }
  const spot = at(block.x, block.y)
  drawBlock(ctx, block, spot.x, spot.y, scale, clock)

  const squad = { id: 4, x: 1.6, y: 5.1, n: 4, flash: 0 }
  const up = at(squad.x, squad.y)
  drawSquad(ctx, squad, up.x, up.y, scale, clock, WEAPONS[1].tint)

  const cart = at(3.2, 6.6)
  drawCart(ctx, cart.x, cart.y, scale, WEAPONS[1], clock)
}
