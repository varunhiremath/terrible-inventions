/**
 * Drawing the swarm.
 *
 * Canvas primitives only, like the rest of this. The lane is drawn to fixed
 * units and scaled to whatever screen it lands on, because judging whether a
 * crate will pay for itself before the crowd arrives is the game, and a lane
 * that changes shape with the window is not a game.
 *
 * The monsters are Papa's wind-up ones: round, bug-eyed, bouncing, and drawn in
 * sweet colours on purpose. The brief that started this game said zombies; the
 * standing instruction about who plays it says nothing frightening, and those
 * two are not in conflict — a crowd shambling down a lane at you is exactly as
 * tense whether it is made of corpses or of grinning green blobs on springs.
 */
import {
  BREED, CRATE_H, CRATE_W, GUN_W, GUN_Y, LANE, LINE_Y, MON_H, MON_W, SHOT_W, TALL,
  gunAt, insideFor, rateOf, type Crate, type Gun, type Monster,
} from './level'
import { arriveIn, weaponOf, type Run, type Said, type Shot } from './run'

type Ctx = CanvasRenderingContext2D

export interface View {
  w: number
  h: number
  clock: number
}

export const INK = {
  back: '#070912',
  edge: '#2b3c6b',
  chalk: '#e9edf8',
  dim: '#8d96b4',
  line: '#ff5f7a',
  gun: '#8fd3ff',
  gunTrim: '#2a6ea8',
  shot: '#ffe08a',
  crate: '#c9a227',
  crateTrim: '#6d5410',
} as const

/** The lane, as a box on the screen, keeping its shape whatever the window. */
export function fieldOf(view: View): { x: number; y: number; scale: number } {
  const scale = Math.min(view.w / LANE, view.h / TALL)
  return { x: (view.w - LANE * scale) / 2, y: (view.h - TALL * scale) / 2, scale }
}

const mono = (size: number) => `bold ${size}px ui-monospace, Menlo, Consolas, monospace`

/**
 * Writing with a dark outline round it, which is the only kind that survives.
 *
 * `fit` is the width it must not exceed, and it is not optional anywhere the
 * text goes inside something: the crate labels were written at a size that
 * looked right on a desktop and ran off both ends of the crate and off the side
 * of the lane on a phone. Measuring and shrinking is four lines and it cannot
 * be got wrong by eye.
 */
function shout(
  ctx: Ctx, text: string, x: number, y: number, size: number, ink: string,
  align: CanvasTextAlign = 'center', fit?: number,
): void {
  ctx.font = mono(size)
  if (fit !== undefined) {
    const wide = ctx.measureText(text).width
    if (wide > fit) {
      size = Math.max(6, size * (fit / wide))
      ctx.font = mono(size)
    }
  }
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, size * 0.3)
  ctx.strokeStyle = 'rgba(5,6,12,0.9)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = ink
  ctx.fillText(text, x, y)
}

/**
 * One monster: a body, two eyes, a mouth, and legs that shuffle.
 *
 * The shape carries the breed, because colour alone is no use to anybody
 * working out which of them is nearly dead. A stomper is squat and heavy, a
 * runner is small and leggy, a spike has a crown of them.
 */
export function drawMonster(
  ctx: Ctx, mon: Monster, x: number, y: number, scale: number, clock: number,
): void {
  const was = BREED[mon.breed]
  const w = MON_W * scale * (mon.breed === 'stomper' ? 1 : mon.breed === 'runner' ? 0.72 : 0.88)
  const h = MON_H * scale * (mon.breed === 'runner' ? 0.7 : 0.82)
  // Everything bounces, out of step with its neighbours, so a crowd reads as a
  // crowd of things rather than one thing stamped out several times.
  const bob = Math.sin(clock * 5 * mon.pace + mon.id) * scale * 0.07
  const top = y - h / 2 + bob

  ctx.save()

  // Legs.
  ctx.strokeStyle = was.eye
  ctx.lineWidth = Math.max(1.5, scale * 0.09)
  const stride = Math.sin(clock * 8 * mon.pace + mon.id) * w * 0.16
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + side * w * 0.22, top + h * 0.8)
    ctx.lineTo(x + side * w * 0.3 + stride * side, top + h * 1.12)
    ctx.stroke()
  }

  ctx.fillStyle = mon.flash > 0 ? '#ffffff' : was.tint
  if (mon.breed === 'spike') {
    // A crown of spikes, drawn before the body so they sit behind it.
    ctx.beginPath()
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI
      ctx.moveTo(x, top + h / 2)
      ctx.lineTo(x + Math.cos(a) * w * 0.72, top + h / 2 + Math.sin(a) * h * 0.78)
    }
    ctx.strokeStyle = mon.flash > 0 ? '#ffffff' : was.tint
    ctx.lineWidth = Math.max(2, scale * 0.14)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.ellipse(x, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Eyes, both looking down the lane at you.
  const eyeR = scale * (mon.breed === 'runner' ? 0.1 : 0.13)
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x + side * w * 0.2, top + h * 0.38, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = was.eye
    ctx.beginPath()
    ctx.arc(x + side * w * 0.2, top + h * 0.44, eyeR * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }

  // A mouth, open, with a couple of teeth in it. Daft rather than grim.
  ctx.fillStyle = was.eye
  ctx.beginPath()
  ctx.ellipse(x, top + h * 0.68, w * 0.2, h * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + side * w * 0.11, top + h * 0.62)
    ctx.lineTo(x + side * w * 0.05, top + h * 0.62)
    ctx.lineTo(x + side * w * 0.08, top + h * 0.7)
    ctx.closePath()
    ctx.fill()
  }

  /*
   * What it can still take, as a number on its chest and a bar under it.
   *
   * Both, not one: the bar is what tells you at a glance which of a crowd is
   * nearly done, and the number is what lets you work out how many more shots
   * that is — which is the arithmetic this game is made of.
   */
  const size = Math.max(10, scale * 0.42)
  shout(ctx, String(mon.health), x, top + h / 2 + scale * 0.02, size, '#ffffff')

  const barW = w * 0.9
  const barH = scale * 0.12
  const barY = top + h * 1.22
  ctx.fillStyle = 'rgba(8,10,18,0.75)'
  ctx.fillRect(x - barW / 2, barY, barW, barH)
  ctx.fillStyle = mon.health / mon.max > 0.45 ? '#7ae582' : '#ff8c8c'
  ctx.fillRect(x - barW / 2, barY, barW * Math.max(0, mon.health / mon.max), barH)
  ctx.restore()
}

/**
 * A crate: what is inside it, and what it costs in hits.
 *
 * The price is the big number, because the price is the thing being decided
 * about. What is inside is underneath it in smaller type — a gun you cannot
 * afford yet is not worth reading about first.
 */
export function drawCrate(
  ctx: Ctx, crate: Crate, x: number, y: number, scale: number, rung: number,
): void {
  const inside = insideFor(crate, rung)
  const w = CRATE_W * scale
  const h = CRATE_H * scale
  const left = x - w / 2
  const top = y - h / 2
  const left_to_go = Math.max(0, crate.need - crate.got)
  const done = crate.got / crate.need

  ctx.save()
  ctx.fillStyle = crate.flash > 0 ? '#ffe9a8' : INK.crate
  ctx.strokeStyle = INK.crateTrim
  ctx.lineWidth = Math.max(1.5, scale * 0.07)
  ctx.beginPath()
  ctx.roundRect(left, top, w, h, scale * 0.14)
  ctx.fill()
  ctx.stroke()

  // Planks, and the cracks that open as the hits land.
  ctx.strokeStyle = INK.crateTrim
  ctx.lineWidth = Math.max(1, scale * 0.045)
  ctx.beginPath()
  ctx.moveTo(left, top + h * 0.33)
  ctx.lineTo(left + w, top + h * 0.33)
  ctx.stroke()
  if (done > 0) {
    ctx.strokeStyle = 'rgba(30,14,0,0.75)'
    ctx.lineWidth = Math.max(1, scale * 0.06 * (0.4 + done))
    const cracks = Math.min(5, 1 + Math.floor(done * 5))
    for (let i = 0; i < cracks; i++) {
      const at = left + w * ((i + 1) / (cracks + 1))
      ctx.beginPath()
      ctx.moveTo(at, top + h * 0.34)
      ctx.lineTo(at + (i % 2 === 0 ? w * 0.08 : -w * 0.08), top + h * 0.95)
      ctx.stroke()
    }
  }

  /*
   * The price first and biggest, then what it buys, on three short lines.
   *
   * It was one long line — "48 HITS · RATTLER · 3 A SHOT" — which ran off both
   * ends of the crate and off the sides of the lane, which is what happens when
   * a label is written without anybody looking at it on a phone. Three stacked
   * lines fit inside the box they belong to, and the order is the order the
   * decision is made in: what it costs, then what it is.
   */
  const room = w * 0.88
  shout(ctx, String(left_to_go), x, top + h * 0.3, Math.max(13, scale * 0.52), '#2b1d04', 'center', room)
  shout(ctx, 'HITS', x, top + h * 0.56, Math.max(8, scale * 0.24), '#3a2906', 'center', room)
  shout(
    ctx,
    `${inside.name.toUpperCase()} ${inside.hit}`,
    x,
    top + h * 0.81,
    Math.max(8, scale * 0.23),
    '#3a2906',
    'center',
    room,
  )
  ctx.restore()
}

/** You: a little gun on a stand, and the barrel it fires out of. */
export function drawGun(
  ctx: Ctx, x: number, y: number, scale: number, weapon: Gun, clock: number, firing: number,
): void {
  const w = GUN_W * scale
  const h = scale * 0.75

  ctx.save()
  // The barrel, which grows with the gun: a bigger number needs a bigger gun or
  // the upgrade is a line of text and nothing else.
  const fat = Math.min(0.3, 0.1 + Math.log2(Math.max(1, weapon.hit)) * 0.035)
  const kick = Math.max(0, firing) * scale * 0.12
  ctx.fillStyle = '#cfe6ff'
  ctx.fillRect(x - scale * fat, y - h * 0.95 + kick, scale * fat * 2, h * 0.7)

  ctx.fillStyle = INK.gun
  ctx.strokeStyle = INK.gunTrim
  ctx.lineWidth = Math.max(1.5, scale * 0.06)
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, scale * 0.18)
  ctx.fill()
  ctx.stroke()

  // Treads, turning, so standing still does not look broken.
  ctx.fillStyle = INK.gunTrim
  for (const side of [-1, 1]) {
    const cx = x + side * w * 0.28
    const cy = y + h * 0.42
    ctx.beginPath()
    ctx.arc(cx, cy, scale * 0.16, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0a0d17'
    ctx.lineWidth = Math.max(1, scale * 0.04)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(clock * 6) * scale * 0.14, cy + Math.sin(clock * 6) * scale * 0.14)
    ctx.stroke()
  }
  ctx.restore()
}

function drawShot(ctx: Ctx, shot: Shot, x: number, y: number, scale: number): void {
  const w = SHOT_W * scale
  ctx.save()
  ctx.fillStyle = INK.shot
  ctx.shadowColor = INK.shot
  ctx.shadowBlur = scale * 0.3
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - scale * 0.26, w, scale * 0.52, w / 2)
  ctx.fill()
  ctx.restore()
  void shot
}

function drawSaid(ctx: Ctx, said: Said, x: number, y: number, scale: number): void {
  const fade = Math.min(1, said.life / 0.4)
  ctx.save()
  ctx.globalAlpha = fade
  shout(ctx, said.text, x, y, Math.max(said.big ? 15 : 11, scale * (said.big ? 0.6 : 0.4)), said.tint)
  ctx.restore()
}

/** The lane itself: the dark beyond the top, the walls, and the line. */
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

  // The line they must not cross, as hazard stripes rather than a thin line: a
  // thin red line reads as decoration and this is the whole stake.
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

/**
 * The clock at the top: how long until the nearest one reaches you.
 *
 * Half of every sum in this game, so it is on the screen in seconds rather than
 * left to be judged by eye. The other half is the number on a crate, and a
 * child who can work out that twelve hits at three a second is four seconds —
 * and that four is less than six — is playing this game properly.
 */
export function drawClock(ctx: Ctx, run: Run, x: number, y: number, size: number): void {
  const left = arriveIn(run)
  const soon = left < 3
  ctx.save()
  shout(ctx, 'THEY GET HERE IN', x, y - size * 0.85, size * 0.55, INK.dim, 'left')
  shout(
    ctx,
    Number.isFinite(left) ? `${left.toFixed(1)}s` : '—',
    x,
    y + size * 0.5,
    size * 1.4,
    soon ? '#ff8c8c' : INK.chalk,
    'left',
  )
  ctx.restore()
}

/** What you are holding: the damage and the rate, which are the sum's numbers. */
export function drawHeld(ctx: Ctx, run: Run, x: number, y: number, size: number): void {
  const weapon = weaponOf(run)
  ctx.save()
  shout(ctx, weapon.name.toUpperCase(), x, y - size * 0.85, size * 0.62, INK.gun, 'right')
  shout(
    ctx,
    `${weapon.hit} a shot · ${rateOf(weapon)} a second`,
    x,
    y + size * 0.5,
    size * 0.6,
    INK.dim,
    'right',
  )
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

  for (const mon of run.crowd) {
    const spot = at(mon.x, mon.y)
    drawMonster(ctx, mon, spot.x, spot.y, scale, run.clock)
  }

  for (const crate of run.crates) {
    const spot = at(crate.x, crate.y)
    drawCrate(ctx, crate, spot.x, spot.y, scale, run.rung)
  }

  for (const shot of run.shots) {
    const spot = at(shot.x, shot.y)
    drawShot(ctx, shot, spot.x, spot.y, scale)
  }

  const me = at(run.gun, GUN_Y)
  const weapon = weaponOf(run)
  drawGun(ctx, me.x, me.y, scale, weapon, run.clock, 1 - Math.min(1, run.cool / weapon.every))

  for (const said of run.says) {
    const spot = at(said.x, said.y)
    drawSaid(ctx, said, spot.x, spot.y, scale)
  }
  ctx.restore()
}

/**
 * A stretch of the lane for the front screen's tile and the opening story.
 *
 * The game's own pieces at the game's own scale: a couple of monsters, a crate
 * with its price on it, and you at the bottom. Drawn from the same functions the
 * game draws with, so it cannot drift away from what the game looks like — the
 * fault this project has found three times now is a tile showing something that
 * is nowhere in the game it opens.
 */
export function drawTaste(ctx: Ctx, w: number, h: number, clock: number): void {
  const wide = 6.4
  const tall = 7.2
  const scale = Math.min(w / wide, h / tall)
  const field = { x: (w - wide * scale) / 2, y: (h - tall * scale) / 2, scale }
  const at = (x: number, y: number) => ({ x: field.x + x * scale, y: field.y + y * scale })

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0a1024')
  sky.addColorStop(1, '#1b2446')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const crowd: Monster[] = [
    { id: 1, x: 1.5, y: 1.4, breed: 'blob', health: 6, max: 9, pace: 1, flash: 0 },
    { id: 2, x: 4.6, y: 1.1, breed: 'spike', health: 11, max: 12, pace: 0.85, flash: 0 },
    { id: 3, x: 3, y: 2.9, breed: 'runner', health: 3, max: 5, pace: 1.6, flash: 0 },
  ]
  for (const mon of crowd) {
    const spot = at(mon.x, mon.y)
    drawMonster(ctx, mon, spot.x, spot.y, scale, clock)
  }

  const crate: Crate = { id: 4, x: 4.4, y: 4.4, need: 12, got: 4, step: 2, flash: 0 }
  const box = at(crate.x, crate.y)
  drawCrate(ctx, crate, box.x, box.y, scale, 1)

  for (const y of [5.1, 5.9]) {
    const spot = at(1.9, y)
    drawShot(ctx, { id: 9, x: 1.9, y }, spot.x, spot.y, scale)
  }

  const me = at(1.9, 6.7)
  drawGun(ctx, me.x, me.y, scale, gunAt(1), clock, 0.4)
}
