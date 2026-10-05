/**
 * Drawing the garden.
 *
 * Canvas primitives only, like everything else in here: there is not an image
 * file in this project and there is not going to be one.
 *
 * The camera follows the head and pulls back as the snake grows, which is the
 * one thing this kind of game cannot do without. A fixed camera on a snake
 * forty units long shows you a wall of your own body and nothing you could
 * steer by, and the moment the camera pulls back too far the pellets vanish.
 */
import {
  BURROW_R, CREATURES, GIRTH, HEDGE_GIRTH, HIDE_AGAIN, KINDS, POWERS, POWER_INK, PICKUP,
  type Power, type Species,
} from './level'
import { bodyOf, fight, girthOf, headOf, type Point, type Run, type Snake } from './run'
import type { PreyKind } from './level'

type Ctx = CanvasRenderingContext2D

export interface View {
  w: number
  h: number
  clock: number
}

export const INK = {
  back: '#0b1410',
  soil: '#13241c',
  line: '#20382b',
  wall: '#3f6b52',
  you: '#e9f2a6',
  youTrim: '#8fae3a',
  chalk: '#e8ebf5',
  dim: '#8a91ab',
} as const

/**
 * How much of the garden fits on the screen.
 *
 * Grows with the snake, so a long one can see the shape it is drawing — but
 * slowly, and with a floor and a ceiling, because the pellets have to stay
 * big enough to aim at.
 */
export function zoomFor(length: number, view: View): number {
  const across = Math.min(view.w, view.h)
  const want = 7 + Math.min(9, length * 0.22)
  return across / want
}

const camera = (run: Run, view: View) => {
  const you = run.snakes[0]
  const head = you ? headOf(you) : { x: 0, y: 0 }
  const zoom = zoomFor(you?.length ?? 0, view)
  return { zoom, cx: head.x, cy: head.y }
}

/** Garden units to pixels. */
const at = (p: Point, cam: { zoom: number; cx: number; cy: number }, view: View) => ({
  x: view.w / 2 + (p.x - cam.cx) * cam.zoom,
  y: view.h / 2 + (p.y - cam.cy) * cam.zoom,
})

function drawGround(
  ctx: Ctx, cam: { zoom: number; cx: number; cy: number }, view: View, arena: number,
): void {
  ctx.fillStyle = INK.back
  ctx.fillRect(0, 0, view.w, view.h)

  // Inside the wall is a different colour from outside it, so the edge of the
  // world reads as ground running out rather than as a line drawn on it.
  const middle = at({ x: 0, y: 0 }, cam, view)
  ctx.save()
  ctx.beginPath()
  ctx.arc(middle.x, middle.y, arena * cam.zoom, 0, Math.PI * 2)
  ctx.fillStyle = INK.soil
  ctx.fill()
  ctx.clip()

  // A grid, so that moving reads as moving. Without it a snake on open ground
  // at a steady speed looks like it is standing still.
  const step = cam.zoom
  ctx.strokeStyle = INK.line
  ctx.lineWidth = 1
  ctx.beginPath()
  const firstX = view.w / 2 - ((cam.cx % 1) * cam.zoom)
  for (let x = firstX % step; x < view.w; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, view.h)
  }
  const firstY = view.h / 2 - ((cam.cy % 1) * cam.zoom)
  for (let y = firstY % step; y < view.h; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(view.w, y)
  }
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = INK.wall
  ctx.lineWidth = Math.max(3, cam.zoom * 0.14)
  ctx.beginPath()
  ctx.arc(middle.x, middle.y, arena * cam.zoom, 0, Math.PI * 2)
  ctx.stroke()
}

/**
 * What makes a cobra look like a cobra.
 *
 * Four patterns off the real animals: the grass snake's dark bars, the
 * rattlesnake's diamonds, the puff adder's chevrons, and a plain back for the
 * cobra and the mamba, which really are plain. It is decoration and it is also
 * information — once he knows the diamonds, he knows what is coming before the
 * name is close enough to read.
 */
function drawMarkings(ctx: Ctx, kind: Species, beads: readonly Point[], cam: { zoom: number; cx: number; cy: number }, view: View, fat: number): void {
  const sort = KINDS[kind]
  const pts = beads.map((b) => at(b, cam, view))
  if (pts.length < 4 || fat < 3) return
  ctx.strokeStyle = sort.mark
  ctx.fillStyle = sort.mark
  ctx.lineCap = 'round'

  const headingAt = (i: number) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  if (sort.pattern === 'plain') {
    // A single darker line down the spine, which is all a plain snake has.
    ctx.globalAlpha = 0.5
    ctx.lineWidth = fat * 0.16
    ctx.beginPath()
    pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)))
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }

  /*
   * Every sixth bead. At every third — which is where this started — the bars
   * run into each other and a grass snake comes out looking like a centipede.
   */
  const every = 6
  for (let i = 2; i < pts.length - 1; i += every) {
    const q = pts[i]
    const look = headingAt(i)
    const across = look + Math.PI / 2
    if (sort.pattern === 'bars') {
      ctx.lineWidth = fat * 0.22
      ctx.beginPath()
      ctx.moveTo(q.x - Math.cos(across) * fat * 0.34, q.y - Math.sin(across) * fat * 0.34)
      ctx.lineTo(q.x + Math.cos(across) * fat * 0.34, q.y + Math.sin(across) * fat * 0.34)
      ctx.stroke()
    } else if (sort.pattern === 'diamond') {
      const w = fat * 0.33
      const l = fat * 0.3
      ctx.beginPath()
      ctx.moveTo(q.x + Math.cos(look) * l, q.y + Math.sin(look) * l)
      ctx.lineTo(q.x + Math.cos(across) * w, q.y + Math.sin(across) * w)
      ctx.lineTo(q.x - Math.cos(look) * l, q.y - Math.sin(look) * l)
      ctx.lineTo(q.x - Math.cos(across) * w, q.y - Math.sin(across) * w)
      ctx.closePath()
      ctx.fill()
    } else {
      // A chevron, pointing up the body, alternating is wrong — a real adder's
      // zigzag is one continuous band, so these all point the same way.
      const w = fat * 0.33
      ctx.lineWidth = fat * 0.17
      ctx.beginPath()
      ctx.moveTo(q.x + Math.cos(across) * w, q.y + Math.sin(across) * w)
      ctx.lineTo(q.x + Math.cos(look) * fat * 0.3, q.y + Math.sin(look) * fat * 0.3)
      ctx.lineTo(q.x - Math.cos(across) * w, q.y - Math.sin(across) * w)
      ctx.stroke()
    }
  }

  // And a rattle on the one that has a rattle.
  if (kind === 'rattler') {
    const tail = pts[pts.length - 1]
    // The tail points back the way the body came, so the rattle hangs off the
    // far end rather than being buried in it.
    const look = headingAt(pts.length - 1) + Math.PI
    ctx.fillStyle = '#efe4c8'
    ctx.strokeStyle = sort.mark
    ctx.lineWidth = Math.max(0.6, fat * 0.07)
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath()
      ctx.arc(
        tail.x + Math.cos(look) * fat * 0.3 * k,
        tail.y + Math.sin(look) * fat * 0.3 * k,
        fat * (0.3 - k * 0.05), 0, Math.PI * 2,
      )
      ctx.fill()
      ctx.stroke()
    }
    ctx.fillStyle = sort.mark
  }
}

function drawSnake(ctx: Ctx, s: Snake, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View, clock: number): void {
  if (!s.alive) return
  const mine = s.id === run.snakes[0]?.id
  const sort = KINDS[s.kind]
  /*
   * Everybody wears their own species, you included.
   *
   * The first version kept the player pale green whatever they had chosen, so
   * that you could always find yourself — which meant picking a black mamba
   * and then playing a grass snake, and the choice may as well not have been
   * offered. You are told apart by the pale line down your back instead.
   */
  const ink = sort.ink
  const trim = sort.trim
  const beads = bodyOf(s)
  const fat = girthOf(s) * cam.zoom

  // Off the screen entirely? Nothing to draw, and on a long snake that is most
  // of the work saved.
  const head = at(headOf(s), cam, view)
  const span = (s.length + GIRTH) * cam.zoom
  if (head.x + span < -50 || head.x - span > view.w + 50) return
  if (head.y + span < -50 || head.y - span > view.h + 50) return

  const ghosting = s.held.ghost !== undefined
  ctx.save()
  if (ghosting) ctx.globalAlpha = 0.45

  // Drawn as one stroked line rather than a bead at a time: a hundred filled
  // circles a frame is the whole frame on a phone, and a round join makes the
  // same shape for nothing.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = trim
  ctx.lineWidth = fat
  ctx.beginPath()
  for (let i = beads.length - 1; i >= 0; i--) {
    const p = at(beads[i], cam, view)
    if (i === beads.length - 1) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()
  ctx.strokeStyle = ink
  ctx.lineWidth = fat * 0.7
  ctx.stroke()

  drawMarkings(ctx, s.kind, beads, cam, view, fat)

  // And the pale line that says which one is you, drawn over the markings so
  // it survives a dark-patterned species.
  if (mine) {
    ctx.strokeStyle = INK.you
    ctx.globalAlpha = (ghosting ? 0.45 : 1) * 0.4
    ctx.lineWidth = Math.max(1, fat * 0.1)
    ctx.stroke()
    ctx.globalAlpha = ghosting ? 0.45 : 1
  }

  // The flash when a ring has just closed on this snake.
  if (s.flash > 0) {
    ctx.strokeStyle = '#ffe08a'
    ctx.globalAlpha = (ghosting ? 0.45 : 1) * (s.flash / 0.35)
    ctx.lineWidth = fat * 0.4
    ctx.stroke()
    ctx.globalAlpha = ghosting ? 0.45 : 1
  }

  // The head, and a face on it, because a line with eyes is a creature and a
  // line without them is a line.
  const look = s.heading
  if (s.kind === 'cobra') {
    // The hood. A cobra without one is a brown snake.
    ctx.fillStyle = trim
    ctx.save()
    ctx.translate(head.x, head.y)
    ctx.rotate(look)
    ctx.beginPath()
    ctx.ellipse(-fat * 0.55, 0, fat * 0.72, fat * 1.4, 0, 0, Math.PI * 2)
    ctx.fill()
    // The spectacle mark on the back of it, which is the other half of what
    // makes a cobra a cobra.
    ctx.fillStyle = sort.mark
    ctx.globalAlpha = 0.8
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(-fat * 0.6, side * fat * 0.62, fat * 0.26, fat * 0.34, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(head.x, head.y, fat * 0.62, 0, Math.PI * 2)
  ctx.fill()
  for (const side of [-1, 1]) {
    const ex = head.x + Math.cos(look) * fat * 0.26 + Math.cos(look + Math.PI / 2) * fat * 0.3 * side
    const ey = head.y + Math.sin(look) * fat * 0.26 + Math.sin(look + Math.PI / 2) * fat * 0.3 * side
    ctx.fillStyle = '#f7fbff'
    ctx.beginPath()
    ctx.arc(ex, ey, fat * 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#14161f'
    ctx.beginPath()
    ctx.arc(ex + Math.cos(look) * fat * 0.07, ey + Math.sin(look) * fat * 0.07, fat * 0.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  if (mine) {
    ctx.fillStyle = INK.you
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.moveTo(head.x, head.y - fat * 0.95)
    ctx.lineTo(head.x - fat * 0.34, head.y - fat * 1.5)
    ctx.lineTo(head.x + fat * 0.34, head.y - fat * 1.5)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }

  /*
   * A name over a rival, and with it the only question that matters when you
   * meet one: can I take this, or do I run?
   *
   * The verdict comes from `fight` itself rather than from comparing lengths
   * here, so what the label says is exactly what will happen — a readout that
   * can disagree with the rules is worse than no readout.
   */
  if (!mine && s.who) {
    const you = run.snakes[0]
    const odds = you?.alive ? fight(you, s) : 0
    const tint = odds > 0 ? '#9fe08a' : odds < 0 ? '#f0877f' : '#f2d08a'
    const mark = odds > 0 ? '\u25bc' : odds < 0 ? '\u25b2' : '\u25c6'
    ctx.font = `bold ${Math.max(9, fat * 0.46)}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = tint
    ctx.fillText(`${mark} ${s.who.name}`, head.x, head.y - fat * 0.95)
  }
  void clock
}

/**
 * The creatures.
 *
 * All four have to read at about ten pixels across, which rules out detail and
 * leaves silhouette: the rat is a tail, the rabbit is a pair of ears, the frog
 * is a pair of eyes on top of its head and the ant is three beads in a row.
 * Those are the parts a nine-year-old names them by, so those are the parts
 * that get the pixels.
 */
function drawAnt(ctx: Ctx, r: number, look: number): void {
  const along = (d: number) => ({ x: Math.cos(look) * d, y: Math.sin(look) * d })
  // Six legs, as three strokes straight through the body.
  ctx.strokeStyle = CREATURES.ant.trim
  ctx.lineWidth = Math.max(0.6, r * 0.14)
  for (const d of [-0.5, 0, 0.5]) {
    const o = along(d * r)
    const side = { x: Math.cos(look + Math.PI / 2) * r * 0.9, y: Math.sin(look + Math.PI / 2) * r * 0.9 }
    ctx.beginPath()
    ctx.moveTo(o.x - side.x, o.y - side.y)
    ctx.lineTo(o.x + side.x, o.y + side.y)
    ctx.stroke()
  }
  ctx.fillStyle = CREATURES.ant.ink
  for (const [d, size] of [[0.75, 0.42], [0, 0.3], [-0.7, 0.5]] as const) {
    const o = along(d * r)
    ctx.beginPath()
    ctx.arc(o.x, o.y, r * size, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFrog(ctx: Ctx, r: number, look: number, hop: number): void {
  // A hop is a stretch and a squash, which is the whole animation budget.
  const stretch = 1 + Math.sin(hop * Math.PI) * 0.35
  ctx.save()
  ctx.rotate(look)
  ctx.scale(stretch, 1 / stretch)
  // Back legs, folded, because a frog at rest is mostly folded back legs.
  ctx.fillStyle = CREATURES.frog.trim
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(-r * 0.45, side * r * 0.6, r * 0.6, r * 0.28, side * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = CREATURES.frog.ink
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2)
  ctx.fill()
  // Eyes on top of the head, a frog's one unmistakable feature.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#f2f6e8'
    ctx.beginPath()
    ctx.arc(r * 0.5, side * r * 0.42, r * 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#17210f'
    ctx.beginPath()
    ctx.arc(r * 0.58, side * r * 0.42, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawRat(ctx: Ctx, r: number, look: number, clock: number, id: number): void {
  ctx.save()
  ctx.rotate(look)
  // The tail, which is the whole point, and it whips.
  ctx.strokeStyle = CREATURES.rat.trim
  ctx.lineWidth = Math.max(0.7, r * 0.16)
  ctx.lineCap = 'round'
  const whip = Math.sin(clock * 6 + id) * r * 0.8
  ctx.beginPath()
  ctx.moveTo(-r * 0.8, 0)
  ctx.quadraticCurveTo(-r * 1.7, whip * 0.5, -r * 2.4, whip)
  ctx.stroke()
  ctx.fillStyle = CREATURES.rat.ink
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.05, r * 0.68, 0, 0, Math.PI * 2)
  ctx.fill()
  // A pointed snout rather than a round one: that is a rat and not a mouse.
  ctx.beginPath()
  ctx.moveTo(r * 0.6, -r * 0.4)
  ctx.lineTo(r * 1.6, 0)
  ctx.lineTo(r * 0.6, r * 0.4)
  ctx.closePath()
  ctx.fill()
  // Ears: small, round, set back.
  ctx.fillStyle = CREATURES.rat.trim
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(r * 0.35, side * r * 0.6, r * 0.33, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#1a1410'
  ctx.beginPath()
  ctx.arc(r * 0.85, -r * 0.12, r * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawRabbit(ctx: Ctx, r: number, look: number, clock: number, id: number): void {
  ctx.save()
  ctx.rotate(look)
  ctx.fillStyle = CREATURES.rabbit.ink
  // Haunches first, then the body over them: a rabbit is a sitting triangle.
  ctx.beginPath()
  ctx.ellipse(-r * 0.5, 0, r * 0.8, r * 0.66, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(r * 0.2, 0, r * 0.85, r * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  // The ears, which swivel. Nothing else in the forest has these.
  const twitch = Math.sin(clock * 3 + id) * 0.22
  ctx.fillStyle = CREATURES.rabbit.ink
  ctx.strokeStyle = CREATURES.rabbit.trim
  ctx.lineWidth = Math.max(0.5, r * 0.1)
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(r * 0.55, side * r * 0.3)
    ctx.rotate(side * (0.35 + twitch * side) - 0.3)
    ctx.beginPath()
    ctx.ellipse(r * 0.5, 0, r * 0.75, r * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  // A scut, white and round and the last thing you see of one.
  ctx.fillStyle = '#f4efe6'
  ctx.beginPath()
  ctx.arc(-r * 1.15, 0, r * 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a1410'
  ctx.beginPath()
  ctx.arc(r * 0.75, -r * 0.2, r * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * One creature, at a radius, facing a way.
 *
 * Pulled out of the loop below so the cutscene's card can draw the four of
 * them with the game's own code rather than a second set of drawings that
 * would quietly drift from it.
 */
export function drawCreature(
  ctx: Ctx, kind: PreyKind, r: number, look: number, hop: number, clock: number, id: number,
): void {
  if (kind === 'ant') drawAnt(ctx, r, look)
  else if (kind === 'frog') drawFrog(ctx, r, look, hop)
  else if (kind === 'rat') drawRat(ctx, r, look, clock, id)
  else drawRabbit(ctx, r, look, clock, id)
}

/**
 * A short length of a snake, for a card that has to show five of them.
 *
 * Same patterning the game uses, so a diamond on the card is the diamond on
 * the thing coming at you.
 */
export function drawSwatch(
  ctx: Ctx, kind: Species, x: number, y: number, len: number, fat: number,
): void {
  const sort = KINDS[kind]
  const beads: Point[] = []
  const step = len / 24
  for (let i = 0; i < 25; i++) beads.push({ x: x + len / 2 - i * step, y })
  const flat = { zoom: 1, cx: 0, cy: 0 }
  const view: View = { w: 0, h: 0, clock: 0 }
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = sort.trim
  ctx.lineWidth = fat
  ctx.beginPath()
  beads.forEach((b, i) => (i === 0 ? ctx.moveTo(b.x, b.y) : ctx.lineTo(b.x, b.y)))
  ctx.stroke()
  ctx.strokeStyle = sort.ink
  ctx.lineWidth = fat * 0.7
  ctx.stroke()
  // `at` maps garden units to pixels; these beads are already in pixels, so it
  // is handed a camera and a view that leave them where they are.
  drawMarkings(ctx, kind, beads.map((b) => ({ x: b.x - view.w / 2, y: b.y - view.h / 2 })), flat, view, fat)
  if (kind === 'cobra') {
    ctx.fillStyle = sort.trim
    ctx.beginPath()
    ctx.ellipse(x + len / 2 - fat * 0.55, y, fat * 0.72, fat * 1.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = sort.mark
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(x + len / 2 - fat * 0.6, y + side * fat * 0.62, fat * 0.26, fat * 0.34, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = sort.ink
  ctx.beginPath()
  ctx.arc(x + len / 2, y, fat * 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCreatures(ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View, clock: number): void {
  for (const p of run.prey) {
    const q = at(p, cam, view)
    if (q.x < -30 || q.x > view.w + 30 || q.y < -30 || q.y > view.h + 30) continue
    const sort = CREATURES[p.kind]
    const r = sort.size * cam.zoom
    // Too small to be an animal at this zoom: a dot is honest and readable
    // where a drawn rabbit would be four grey pixels of nothing.
    ctx.save()
    ctx.translate(q.x, q.y)
    if (p.big) {
      /*
       * What is left of a dead snake. Drawn as a flattened lump rather than a
       * rat, so a free meal never looks like something that might run.
       */
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#7e4a42'
      ctx.beginPath()
      ctx.ellipse(0, 0, r * 0.85, r * 0.55, p.heading, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#a3625a'
      ctx.beginPath()
      ctx.ellipse(-r * 0.12, -r * 0.12, r * 0.45, r * 0.28, p.heading, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      continue
    }
    if (r < 3.5) {
      ctx.fillStyle = sort.ink
      ctx.beginPath()
      ctx.arc(0, 0, Math.max(1.5, r), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      continue
    }
    // Frightened creatures are drawn a shade brighter, so a field full of
    // animals bolting reads as *something is happening* without a word of UI.
    if (p.scare > 0) ctx.globalAlpha = 1
    else ctx.globalAlpha = 0.92
    drawCreature(ctx, p.kind, r, p.heading, p.hop, clock, p.id)
    ctx.restore()
  }
}

/**
 * The holes.
 *
 * A burrow has three states and they have to be told apart at a glance, since
 * running for a hole that turns out to be spent is how you die: open is a dark
 * mouth with a rim, occupied has somebody's tail still showing, and spent is
 * collapsed and flat.
 */
function drawBurrows(ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View, clock: number): void {
  for (const b of run.burrows) {
    const q = at(b, cam, view)
    const r = BURROW_R * cam.zoom
    if (q.x + r < 0 || q.x - r > view.w || q.y + r < 0 || q.y - r > view.h) continue
    const sheltering = b.used > HIDE_AGAIN
    const spent = b.used > 0 && !sheltering
    ctx.save()
    ctx.translate(q.x, q.y)
    // The mound of earth around the mouth.
    ctx.fillStyle = spent ? '#2a2119' : '#3a2e22'
    ctx.beginPath()
    ctx.ellipse(0, r * 0.12, r, r * 0.78, 0, 0, Math.PI * 2)
    ctx.fill()
    // The mouth itself, which is only dark when there is somewhere to go.
    ctx.fillStyle = spent ? '#2f2b24' : '#090705'
    ctx.beginPath()
    ctx.ellipse(0, 0, r * (spent ? 0.4 : 0.62), r * (spent ? 0.22 : 0.44), 0, 0, Math.PI * 2)
    ctx.fill()
    if (sheltering) {
      // Somebody is down there: a ring of safety, breathing.
      ctx.strokeStyle = '#8fd6a0'
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 5)
      ctx.lineWidth = Math.max(1.5, r * 0.12)
      ctx.beginPath()
      ctx.ellipse(0, r * 0.12, r * 1.05, r * 0.84, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawDrops(ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View, clock: number): void {
  for (const d of run.drops) {
    const q = at(d, cam, view)
    if (q.x < -40 || q.x > view.w + 40 || q.y < -40 || q.y > view.h + 40) continue
    const r = PICKUP * cam.zoom * 0.8
    const lift = Math.sin(clock * 2.4 + d.bob * 6) * r * 0.18
    ctx.save()
    ctx.translate(q.x, q.y + lift)
    ctx.globalAlpha = 0.25
    ctx.fillStyle = POWER_INK[d.kind]
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = POWER_INK[d.kind]
    drawCharm(ctx, d.kind, r)
    ctx.restore()
  }
}

/** A shape per power, so they are told apart without reading anything. */
function drawCharm(ctx: Ctx, kind: Power, r: number): void {
  ctx.beginPath()
  if (kind === 'dash') {
    // A chevron: the arrow shape that means "faster" everywhere.
    ctx.moveTo(-r * 0.5, -r * 0.7)
    ctx.lineTo(r * 0.6, 0)
    ctx.lineTo(-r * 0.5, r * 0.7)
    ctx.lineTo(-r * 0.15, 0)
    ctx.closePath()
  } else if (kind === 'ghost') {
    // A ring: something you can see through.
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2)
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2, true)
  } else if (kind === 'lure') {
    // A flower, which is the thing food comes from.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.moveTo(0, 0)
      ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.3, 0, Math.PI * 2)
    }
  } else {
    // A snowflake's six spokes, blunt enough to read at this size.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75)
    }
    ctx.lineWidth = r * 0.22
    ctx.strokeStyle = POWER_INK.frost
    ctx.stroke()
    return
  }
  ctx.fill('evenodd')
}

/** The ring that just closed, held on screen for a moment. */
function drawRing(ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View): void {
  if (!run.ring || run.ring.length < 3) return
  const fade = Math.min(1, run.ringFor / 0.8)
  ctx.save()
  ctx.globalAlpha = fade * 0.4
  ctx.fillStyle = '#ffe08a'
  ctx.beginPath()
  run.ring.forEach((p, i) => {
    const q = at(p, cam, view)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  })
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * The little map in the corner.
 *
 * Five rivals in a garden this size are off the screen most of the time, and a
 * fight you cannot see coming is a fight you lose for no reason you could
 * name.
 */
function drawMap(ctx: Ctx, run: Run, view: View): void {
  const arena = run.arena
  const r = Math.min(view.w, view.h) * 0.11
  const cx = view.w - r - 12
  const cy = r + 12
  ctx.save()
  ctx.globalAlpha = 0.75
  ctx.fillStyle = '#0b1410'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = INK.wall
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.globalAlpha = 1
  for (const s of run.snakes) {
    if (!s.alive) continue
    const head = headOf(s)
    const mine = s.id === run.snakes[0]?.id
    const x = cx + (head.x / arena) * r * 0.92
    const y = cy + (head.y / arena) * r * 0.92
    /*
     * Rivals on the map are coloured by the verdict, not by species.
     *
     * The map exists because a fight you cannot see coming is a fight you lose
     * for no reason you could name — so what it has to carry is not who is out
     * there but which of them you can take.
     */
    const you = run.snakes[0]
    const odds = !mine && you?.alive ? fight(you, s) : 0
    ctx.fillStyle = mine
      ? INK.you
      : odds > 0 ? '#9fe08a' : odds < 0 ? '#f0877f' : '#f2d08a'
    ctx.beginPath()
    ctx.arc(x, y, mine ? 3.4 : 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The hedges: lines of thorn that do not move and end anybody who touches one.
 *
 * Drawn as a dark bar with spikes off both sides rather than as a smooth line,
 * because a smooth line in a garden full of smooth snake-shaped lines is
 * something he will try to eat. It has to look like it would hurt.
 */
function drawHedges(
  ctx: Ctx, run: Run, cam: { zoom: number; cx: number; cy: number }, view: View,
): void {
  const fat = HEDGE_GIRTH * cam.zoom
  for (const hedge of run.hedges) {
    const points = hedge.map((p) => at(p, cam, view))
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.strokeStyle = '#1d3320'
    ctx.lineWidth = fat * 1.25
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()

    // The thorns, off alternate sides.
    ctx.strokeStyle = '#4a6b3c'
    ctx.lineWidth = Math.max(1, fat * 0.2)
    ctx.beginPath()
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      const len = Math.hypot(dx, dy) || 1
      const side = i % 2 === 0 ? 1 : -1
      const nx = (-dy / len) * fat * 0.75 * side
      const ny = (dx / len) * fat * 0.75 * side
      ctx.moveTo(points[i].x, points[i].y)
      ctx.lineTo(points[i].x + nx, points[i].y + ny)
    }
    ctx.stroke()

    ctx.strokeStyle = '#2f4a2c'
    ctx.lineWidth = fat * 0.5
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ctx.restore()
  }
}

/**
 * What the last ring did, across the middle of the screen.
 *
 * The one thing in this game nobody could work out on their own: the head
 * meeting its own body does not kill you, it closes a loop and cuts away what
 * it looped over — so a careless nick takes a chunk off and gives nothing
 * back, and from outside it is a snake that shrank for no reason. It is a good
 * rule and it was invisible.
 */
function drawSaid(ctx: Ctx, run: Run, view: View): void {
  const said = run.said
  if (!said) return
  const size = Math.min(view.w, view.h) * 0.055
  ctx.save()
  // In quickly, held, then out — a plain fade over two seconds reads as a
  // fault rather than as something being said.
  ctx.globalAlpha = Math.min(1, said.life * 4, (2.2 - said.life) * 6)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${size}px ui-monospace, "SF Mono", Menlo, monospace`
  ctx.fillStyle = '#05060a'
  ctx.fillText(said.words, view.w / 2 + size * 0.06, view.h * 0.3 + size * 0.06)
  ctx.fillStyle = said.tint
  ctx.fillText(said.words, view.w / 2, view.h * 0.3)
  ctx.restore()
}

export function drawRun(ctx: Ctx, run: Run, view: View): void {
  const cam = camera(run, view)
  drawGround(ctx, cam, view, run.arena)
  drawHedges(ctx, run, cam, view)
  drawRing(ctx, run, cam, view)
  drawBurrows(ctx, run, cam, view, view.clock)
  drawCreatures(ctx, run, cam, view, view.clock)
  drawDrops(ctx, run, cam, view, view.clock)
  /*
   * Rivals first and you last, so your own head is never hidden under
   * somebody else's body. Which matters more here than it sounds: the head is
   * the only part of you that can be killed, so it is the only part worth
   * looking at.
   */
  for (const s of run.snakes) if (s.id !== run.snakes[0]?.id) drawSnake(ctx, s, run, cam, view, view.clock)
  if (run.snakes[0]) drawSnake(ctx, run.snakes[0], run, cam, view, view.clock)
  drawMap(ctx, run, view)
  drawSaid(ctx, run, view)
}

/** The powers in hand, as a row of charms with the time left on each. */
export function drawHeld(ctx: Ctx, run: Run, x: number, y: number, r: number): void {
  const you = run.snakes[0]
  if (!you) return
  let i = 0
  for (const kind of POWERS) {
    const left = you.held[kind]
    if (left === undefined) continue
    ctx.save()
    ctx.translate(x + i * r * 2.5, y)
    ctx.globalAlpha = Math.min(1, left)
    ctx.fillStyle = POWER_INK[kind]
    drawCharm(ctx, kind, r)
    ctx.restore()
    i += 1
  }
}
