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
  BREED, CATCH, CRATE_H, CRATE_W, GUN_W, GUN_Y, LANE, LINE_Y, MON_H, MON_W, SHOT_W, TALL,
  gunAt, insideFor, rateOf, type Crate, type Falling, type Gun, type Monster,
} from './level'
import { arriveIn, weaponOf, type Gone, type Run, type Said, type Shot } from './run'

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

/** A colour, nudged lighter or darker, for giving a crowd a bit of variety. */
function shade(hex: string, by: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (at: number) => Math.max(0, Math.min(255, ((n >> at) & 255) + Math.round(by)))
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`
}

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
 * One of them, walking at you: head, shoulders, two arms out, two legs.
 *
 * Humanoid, which was asked for in those words and is the right call anyway. A
 * ball with eyes is a toy; a person-shaped thing shambling down a bridge with
 * its arms out is the oldest silhouette in this genre, and it reads at the size
 * of a thumbnail — which a face never does.
 *
 * Nothing about them is gruesome. No blood, no bones, no gore: they are
 * green-grey, ragged and bent, and that is the whole of it. A crowd shambling
 * at you is exactly as tense drawn kindly, and who plays this decides that.
 */
export function drawMonster(
  ctx: Ctx, mon: Monster, x: number, y: number, scale: number, clock: number,
): void {
  const was = BREED[mon.breed]
  const size = mon.size
  const h = MON_H * scale * size
  const w = MON_W * scale * size
  const walk = clock * 4.5 * mon.pace + mon.step
  const sway = Math.sin(walk) * w * 0.06
  const bob = Math.abs(Math.cos(walk)) * h * 0.05
  const top = y - h / 2 + bob
  const hurt = mon.flash > 0
  // A touch of its own in the colour, so a crowd of forty is not one drawing
  // printed forty times.
  const own = Math.sin(mon.step * 7) * 7
  const skin = hurt ? '#ffffff' : shade(was.skin, own)
  const lean = mon.breed === 'runner' ? w * 0.18 : mon.breed === 'brute' ? -w * 0.05 : w * 0.06

  ctx.save()
  ctx.lineCap = 'round'
  // Everything is drawn over a dark edge, which is what lifts a green figure
  // off a grey bridge at the size of a thumb.
  ctx.shadowColor = 'rgba(4,6,12,0.65)'
  ctx.shadowBlur = Math.max(1, scale * 0.08)

  /*
   * Legs, walking *at* you rather than past you.
   *
   * The first version swung them left and right, which is the stride you draw
   * for something crossing the screen — and that is exactly what it looked
   * like: a crowd shuffling sideways while sliding down the bridge. Something
   * walking towards the camera does not move its feet sideways at all. The near
   * leg lengthens and plants, the far one shortens and lifts, they swap, and
   * the whole body rocks a little from side to side over whichever foot is
   * down. Same two lines, completely different animation.
   */
  ctx.strokeStyle = was.rag
  ctx.lineWidth = Math.max(2, w * (mon.breed === 'brute' ? 0.3 : 0.2))
  for (const side of [-1, 1]) {
    const phase = Math.sin(walk + (side > 0 ? Math.PI : 0))
    // How far down this foot reaches: forward and planted, or lifted behind.
    const reach = h * (0.38 + 0.1 * phase)
    const lift = Math.max(0, -phase) * h * 0.06
    ctx.beginPath()
    ctx.moveTo(x + side * w * 0.16 + sway, top + h * 0.6 - lift)
    ctx.lineTo(x + side * w * 0.2 + sway * 0.5, top + h * 0.6 + reach - lift)
    ctx.stroke()
  }

  /*
   * Arms reaching towards you, which from this angle means *down the screen*
   * and foreshortened — out of the shoulder, forwards, and the hands end up
   * low and near the middle rather than out at the sides.
   */
  ctx.strokeStyle = skin
  ctx.lineWidth = Math.max(2, w * (mon.breed === 'brute' ? 0.26 : 0.16))
  for (const side of [-1, 1]) {
    const bobArm = Math.sin(walk + (side > 0 ? 0.6 : 0)) * h * 0.03
    ctx.beginPath()
    ctx.moveTo(x + side * w * 0.3 + sway, top + h * 0.34)
    ctx.lineTo(x + side * w * 0.36 + sway, top + h * 0.52 + bobArm)
    ctx.lineTo(x + side * w * 0.26 + sway, top + h * 0.68 + bobArm)
    ctx.stroke()
    // A hand on the end of it, which is what sells the foreshortening.
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.arc(x + side * w * 0.26 + sway, top + h * 0.7 + bobArm, w * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }

  // Body: ragged clothing over the shoulders, skin showing at the neck.
  ctx.fillStyle = was.rag
  ctx.beginPath()
  ctx.moveTo(x - w * 0.32 + sway, top + h * 0.3)
  ctx.lineTo(x + w * 0.32 + sway, top + h * 0.3)
  ctx.lineTo(x + w * 0.26 + sway, top + h * 0.68)
  // A torn hem, which is most of what makes a rectangle look like rags.
  ctx.lineTo(x + w * 0.1 + sway, top + h * 0.6)
  ctx.lineTo(x - w * 0.04 + sway, top + h * 0.68)
  ctx.lineTo(x - w * 0.26 + sway, top + h * 0.62)
  ctx.closePath()
  ctx.fill()

  if (mon.breed === 'brute') {
    /*
     * A brute is a silhouette problem, not a size problem. Scaled up, the same
     * drawing came out as a blob with wings and a head like a balloon — so it
     * gets its own shape: shoulders half again as wide as its hips, a head sunk
     * between them, and long arms hanging past its knees.
     */
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.moveTo(x - w * 0.46 + sway, top + h * 0.32)
    ctx.lineTo(x + w * 0.46 + sway, top + h * 0.32)
    ctx.lineTo(x + w * 0.3 + sway, top + h * 0.46)
    ctx.lineTo(x - w * 0.3 + sway, top + h * 0.46)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = skin
    ctx.lineWidth = Math.max(3, w * 0.22)
    for (const side of [-1, 1]) {
      const swing = Math.sin(walk + (side > 0 ? 1 : 0)) * w * 0.08
      ctx.beginPath()
      ctx.moveTo(x + side * w * 0.42 + sway, top + h * 0.36)
      ctx.lineTo(x + side * w * 0.46 + swing, top + h * 0.78)
      ctx.stroke()
    }
  }

  // Head, tilted, with the eyes glowing out of it.
  const headR = w * (mon.breed === 'brute' ? 0.17 : 0.2)
  const headY = top + h * (mon.breed === 'brute' ? 0.24 : 0.17)
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(x + sway + lean * 0.3, headY, headR, headR * 1.15, sway * 0.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = hurt ? '#c23b3b' : was.eye
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(
      x + sway + lean * 0.3 + side * headR * 0.42, headY - headR * 0.1,
      headR * 0.22, headR * 0.3, 0, 0, Math.PI * 2,
    )
    ctx.fill()
  }
  if (mon.breed === 'brute') {
    // And a pair of eyes that catch the light, so a brute is spotted in a crowd
    // before its size has registered.
    ctx.fillStyle = '#ffce5c'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(x + sway + side * headR * 0.42, headY - headR * 0.12, headR * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /*
   * What it can still take, as a number over it and a bar under it.
   *
   * Both, not one: the bar is what tells you at a glance which of a crowd is
   * nearly done, and the number is what lets you work out how many more shots
   * that is — which is the arithmetic this game is made of.
   */
  const label = Math.max(9, scale * 0.34 * Math.min(1.5, size))
  shout(ctx, String(mon.health), x, top - h * 0.08, label, '#ffffff')

  const barW = w * 0.9
  const barH = scale * 0.1 * Math.min(1.6, size)
  const barY = top + h * 1.04
  ctx.fillStyle = 'rgba(8,10,18,0.75)'
  ctx.fillRect(x - barW / 2, barY, barW, barH)
  ctx.fillStyle = mon.health / mon.max > 0.45 ? '#7ae582' : '#ff8c8c'
  ctx.fillRect(x - barW / 2, barY, barW * Math.max(0, mon.health / mon.max), barH)
  ctx.restore()
}

/**
 * Which of the five shapes a gun on this rung is drawn as.
 *
 * The ask, in the words it was asked in: "only your shooting power increases,
 * like bigger guns". A name changing in the corner of the screen is not a
 * bigger gun — so the thing in your hands changes shape five times over the
 * ladder, and each shape is visible from across the room: one barrel, then two,
 * then a wide muzzle, then a braced cannon, then the whole carriage.
 */
export const shapeOf = (rung: number): 0 | 1 | 2 | 3 | 4 => {
  if (rung >= 16) return 4
  if (rung >= 11) return 3
  if (rung >= 7) return 2
  if (rung >= 3) return 1
  return 0
}

/**
 * A weapon on a rack, riding down the parapet with a price on it.
 *
 * It was a wooden crate with words on it, and the question it got was the right
 * one: what is the difference between these and the things on parachutes? None
 * that you could see. So a rack shows the gun that is on it, drawn with the
 * same five silhouettes the soldier holds, and shooting it loose sends that gun
 * down on a parachute like everything else — one kind of thing to catch, and
 * the racks are where the good ones come from.
 */
export function drawCrate(
  ctx: Ctx, crate: Crate, x: number, y: number, scale: number, rung: number,
): void {
  const inside = insideFor(crate, rung)
  const w = CRATE_W * scale
  const h = CRATE_H * scale
  const left = x - w / 2
  const top = y - h / 2
  const togo = Math.max(0, crate.need - crate.got)
  const done = crate.got / crate.need

  ctx.save()

  // The rack: two posts and a crossbar, the gun hanging on it.
  ctx.fillStyle = crate.flash > 0 ? '#ffe9a8' : '#6b4a2f'
  ctx.strokeStyle = '#241812'
  ctx.lineWidth = Math.max(1, scale * 0.04)
  ctx.beginPath()
  ctx.roundRect(left, top + h * 0.1, w, h * 0.12, scale * 0.04)
  ctx.fill()
  ctx.stroke()
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.roundRect(x + side * w * 0.42 - scale * 0.05, top + h * 0.1, scale * 0.1, h * 0.72, scale * 0.03)
    ctx.fill()
    ctx.stroke()
  }

  // The gun itself, shaken looser the more hits have landed.
  const shake = done * scale * 0.08
  ctx.save()
  ctx.translate(x + Math.sin(crate.got * 2.3) * shake, top + h * 0.42 + done * h * 0.06)
  ctx.rotate(done * 0.25)
  drawWeapon(ctx, 0, 0, scale * 0.85, shapeOf(rung + crate.step), 0)
  ctx.restore()

  /*
   * The price, under it, in the hits it takes. Big, because the price is what
   * is being decided about — and measured against the width of the rack,
   * because the first version of this label ran off both ends of it on a phone.
   */
  const room = w * 1.1
  shout(ctx, `${togo} HITS`, x, top + h * 0.95, Math.max(11, scale * 0.42), '#ffe08a', 'center', room)
  shout(
    ctx,
    `${inside.name.toUpperCase()} ${inside.hit}`,
    x, top + h * 1.24, Math.max(8, scale * 0.26), '#cfe6ff', 'center', room,
  )
  ctx.restore()
}

/**
 * One weapon, at whatever size, pointing up.
 *
 * Pulled out of the soldier so that the rack, the parachute and the stash all
 * draw the same gun he is holding. Five of them; see `shapeOf`.
 */
export function drawWeapon(
  ctx: Ctx, x: number, y: number, scale: number, shape: number, kick = 0,
): void {
  ctx.save()
  ctx.fillStyle = '#cfe6ff'
  ctx.strokeStyle = '#4a86b8'
  ctx.lineWidth = Math.max(1, scale * 0.035)

  // Stock.
  ctx.fillStyle = '#6b4a2f'
  ctx.beginPath()
  ctx.roundRect(x - scale * 0.085, y + kick, scale * 0.17, scale * 0.34, scale * 0.05)
  ctx.fill()
  ctx.fillStyle = '#cfe6ff'

  const barrel = (dx: number, fat: number, long: number) => {
    ctx.beginPath()
    ctx.roundRect(x + dx - scale * fat, y - scale * long + kick, scale * fat * 2, scale * long, scale * 0.04)
    ctx.fill()
    ctx.stroke()
  }

  if (shape === 0) barrel(0, 0.06, 0.62)
  else if (shape === 1) { barrel(-scale * 0.08, 0.055, 0.68); barrel(scale * 0.08, 0.055, 0.68) }
  else if (shape === 2) {
    barrel(0, 0.1, 0.72)
    ctx.beginPath()
    ctx.moveTo(x - scale * 0.2, y - scale * 0.72 + kick)
    ctx.lineTo(x + scale * 0.2, y - scale * 0.72 + kick)
    ctx.lineTo(x + scale * 0.1, y - scale * 0.54 + kick)
    ctx.lineTo(x - scale * 0.1, y - scale * 0.54 + kick)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    barrel(0, shape === 3 ? 0.14 : 0.18, shape === 3 ? 0.84 : 0.96)
    ctx.fillStyle = '#4a86b8'
    for (const along of shape === 3 ? [0.4, 0.64] : [0.36, 0.56, 0.78]) {
      ctx.fillRect(
        x - scale * (shape === 3 ? 0.17 : 0.22), y - scale * along + kick,
        scale * (shape === 3 ? 0.34 : 0.44), scale * 0.06,
      )
    }
  }
  ctx.restore()
}

/**
 * You: a soldier at the gate, holding whatever the ladder has got you to.
 *
 * A wagon with a barrel on it was what this was, and the note about it was
 * fair — "change the shooting wagon into a real character, humanoid". So: boots
 * braced apart, a coat, a helmet with a brim, and the weapon held across the
 * body in two hands, shouldered and kicking when it fires.
 *
 * He is drawn facing away, up the bridge. That is deliberate and it is the
 * cheap trick that makes this work at thumbnail size: a back view needs no
 * face, never has to turn round, and reads instantly as *you* rather than as
 * another character on the screen.
 */
export function drawGun(
  ctx: Ctx, x: number, y: number, scale: number, weapon: Gun, clock: number, firing: number,
  rung = 0,
): void {
  const shape = shapeOf(rung)
  const grow = 1 + shape * 0.07
  const h = scale * 1.85 * grow
  const w = GUN_W * scale * 0.62 * grow
  const kick = Math.max(0, firing) * scale * 0.1
  const top = y - h * 0.82
  const sway = Math.sin(clock * 2) * scale * 0.02

  ctx.save()
  ctx.lineCap = 'round'

  // Boots, planted apart. He is braced, not walking.
  ctx.strokeStyle = '#2a3550'
  ctx.lineWidth = Math.max(2.5, w * 0.34)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + side * w * 0.22, top + h * 0.62)
    ctx.lineTo(x + side * w * 0.42, top + h * 0.99)
    ctx.stroke()
  }

  // Coat.
  ctx.fillStyle = '#3f7fc4'
  ctx.beginPath()
  ctx.moveTo(x - w * 0.52 + sway, top + h * 0.26)
  ctx.lineTo(x + w * 0.52 + sway, top + h * 0.26)
  ctx.lineTo(x + w * 0.44 + sway, top + h * 0.72)
  ctx.lineTo(x - w * 0.44 + sway, top + h * 0.72)
  ctx.closePath()
  ctx.fill()
  // A belt, which is what stops a coat reading as a bin bag.
  ctx.fillStyle = '#24406b'
  ctx.fillRect(x - w * 0.5 + sway, top + h * 0.52, w, h * 0.07)

  // Head and helmet, seen from behind.
  ctx.fillStyle = '#e0a878'
  ctx.beginPath()
  ctx.arc(x + sway, top + h * 0.16, w * 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#4e7a3a'
  ctx.beginPath()
  ctx.arc(x + sway, top + h * 0.14, w * 0.34, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(x - w * 0.38 + sway, top + h * 0.12, w * 0.76, h * 0.04)

  // --- the weapon, held out to the side, which is the thing that changes ---
  const bx = x + w * 0.52 + sway
  const by = top + h * 0.3 + kick
  drawWeapon(ctx, bx, by, scale, shape, 0)

  // Arms, over the top of the weapon, so it is held rather than floating.
  ctx.strokeStyle = '#3f7fc4'
  ctx.lineWidth = Math.max(2, w * 0.24)
  ctx.beginPath()
  ctx.moveTo(x - w * 0.3 + sway, top + h * 0.34)
  ctx.lineTo(bx - scale * 0.06, by + scale * 0.12)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + w * 0.36 + sway, top + h * 0.32)
  ctx.lineTo(bx + scale * 0.02, by - scale * 0.12)
  ctx.stroke()

  // Muzzle flash, which is most of what makes firing feel like firing.
  if (firing > 0.55) {
    const flash = (firing - 0.55) / 0.45
    const long = scale * (shape >= 3 ? 0.5 : 0.32) * flash
    ctx.save()
    ctx.globalAlpha = Math.min(1, flash * 1.4)
    ctx.fillStyle = '#fff3c4'
    ctx.beginPath()
    ctx.moveTo(bx, by - scale * (0.62 + shape * 0.08) - long)
    ctx.lineTo(bx + long * 0.7, by - scale * (0.62 + shape * 0.08))
    ctx.lineTo(bx - long * 0.7, by - scale * (0.62 + shape * 0.08))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
  void weapon
}

function drawShot(ctx: Ctx, shot: Shot, x: number, y: number, scale: number, shape = 0): void {
  // A heavier gun throws a heavier shot. Same hit box either way — the width
  // here is paint, not rules — but a Peashooter pellet and a cannon shell
  // should not be the same dot.
  const w = SHOT_W * scale * (1 + shape * 0.35)
  const long = scale * (0.52 + shape * 0.12)
  ctx.save()
  ctx.fillStyle = INK.shot
  ctx.shadowColor = INK.shot
  ctx.shadowBlur = scale * (0.3 + shape * 0.15)
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - long / 2, w, long, w / 2)
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

/**
 * Where this happens: a stone bridge out of the fog, and the gate at your end.
 *
 * It was a dark blue rectangle with lane markings, which is a diagram of a game
 * rather than a place. A bridge does three jobs at once: it explains why they
 * are coming at you in a column, it explains why you cannot simply walk away,
 * and it gives the far end somewhere to come *from* — the fog at the top is
 * doing more for the feel of this than anything else on the screen.
 */
function drawBridge(ctx: Ctx, field: { x: number; y: number; scale: number }, view: View): void {
  const { scale } = field
  const wide = LANE * scale
  const tall = TALL * scale
  const clock = view.clock

  // The gorge below and behind: night, and a long way down.
  const night = ctx.createLinearGradient(0, 0, 0, view.h)
  night.addColorStop(0, '#05070f')
  night.addColorStop(0.5, '#0a1020')
  night.addColorStop(1, '#070a14')
  ctx.fillStyle = night
  ctx.fillRect(0, 0, view.w, view.h)

  // Hills either side of the gorge, so the bridge is over something.
  ctx.fillStyle = '#0d1424'
  for (const side of [-1, 1]) {
    const base = side < 0 ? field.x : field.x + wide
    ctx.beginPath()
    ctx.moveTo(base, field.y + tall)
    for (let i = 0; i <= 6; i++) {
      const up = i / 6
      ctx.lineTo(
        base + side * (0.3 + Math.sin(i * 1.7 + (side as number)) * 0.25 + up * 0.5) * wide,
        field.y + tall * (1 - up),
      )
    }
    ctx.lineTo(base + side * wide, field.y)
    ctx.closePath()
    ctx.fill()
  }

  // The deck of the bridge: stone, with courses across it.
  /*
   * The deck: dark at the far end and lighter at your end, which is the whole
   * of the perspective in here and enough of it. A flat grey rectangle of big
   * tiles read as a brick wall seen face on.
   */
  const deck = ctx.createLinearGradient(0, field.y, 0, field.y + tall)
  deck.addColorStop(0, '#141b2b')
  deck.addColorStop(0.4, '#1d2537')
  deck.addColorStop(1, '#2a3146')
  ctx.fillStyle = deck
  ctx.fillRect(field.x, field.y, wide, tall)

  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = Math.max(1, scale * 0.035)
  for (let i = 1; i < TALL; i += 1) {
    ctx.beginPath()
    ctx.moveTo(field.x, field.y + i * scale)
    ctx.lineTo(field.x + wide, field.y + i * scale)
    ctx.stroke()
    // Staggered joints, like a real course of stones.
    for (let j = 0; j <= 5; j++) {
      const at = field.x + wide * ((j + (i % 2 === 1 ? 0.2 : 0.7)) / 6)
      ctx.beginPath()
      ctx.moveTo(at, field.y + i * scale)
      ctx.lineTo(at, field.y + (i + 1) * scale)
      ctx.stroke()
    }
  }

  // The parapets: a wall each side with merlons along the top of it, which is
  // also where the crates come down.
  for (const side of [0, 1]) {
    const at = field.x + side * (wide - scale * 1.5)
    const parapet = ctx.createLinearGradient(at, 0, at + scale * 1.5, 0)
    parapet.addColorStop(0, side === 0 ? '#39405a' : '#232a3e')
    parapet.addColorStop(1, side === 0 ? '#232a3e' : '#39405a')
    ctx.fillStyle = parapet
    ctx.fillRect(at, field.y, scale * 1.5, tall)
    ctx.fillStyle = '#4b5574'
    for (let i = 0; i < TALL; i += 1.6) {
      ctx.fillRect(at + scale * 0.1, field.y + i * scale, scale * 1.3, scale * 0.5)
    }
  }

  // Fog at the far end, where they are coming from. Two slow layers of it, so
  // the crowd walks out of something rather than appearing.
  for (const [i, band] of [1.6, 3].entries()) {
    const fog = ctx.createLinearGradient(0, field.y, 0, field.y + band * scale)
    fog.addColorStop(0, `rgba(176,196,232,${0.5 - i * 0.2})`)
    fog.addColorStop(1, 'rgba(176,196,232,0)')
    ctx.save()
    ctx.globalAlpha = 0.8 + Math.sin(clock * 0.4 + i) * 0.2
    ctx.fillStyle = fog
    ctx.fillRect(field.x, field.y, wide, band * scale)
    ctx.restore()
  }

  // --- the gate at your end ---
  const gateY = field.y + LINE_Y * scale
  const thick = scale * 0.9

  // Torches on the parapet beside the gate, guttering.
  for (const side of [0, 1]) {
    const at = field.x + (side === 0 ? scale * 0.75 : wide - scale * 0.75)
    const flare = 0.7 + Math.sin(clock * 9 + side * 2) * 0.3
    const glow = ctx.createRadialGradient(at, gateY - scale * 0.3, 0, at, gateY - scale * 0.3, scale * 2.4)
    glow.addColorStop(0, `rgba(255,170,60,${0.3 * flare})`)
    glow.addColorStop(1, 'rgba(255,170,60,0)')
    ctx.fillStyle = glow
    ctx.fillRect(at - scale * 2.4, gateY - scale * 2.7, scale * 4.8, scale * 4.8)
    ctx.fillStyle = '#2a1f14'
    ctx.fillRect(at - scale * 0.07, gateY - scale * 0.9, scale * 0.14, scale * 0.9)
    ctx.fillStyle = `rgba(255,${160 + flare * 60},80,0.95)`
    ctx.beginPath()
    ctx.ellipse(at, gateY - scale * 1.05, scale * 0.16 * flare, scale * 0.3 * flare, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // The gate itself: timbers, iron bands, and a line of sandbags in front.
  const timber = ctx.createLinearGradient(0, gateY - thick, 0, gateY + thick)
  timber.addColorStop(0, '#6b4a2f')
  timber.addColorStop(1, '#3d2a1b')
  ctx.fillStyle = timber
  ctx.fillRect(field.x, gateY - thick / 2, wide, thick)
  ctx.strokeStyle = '#241812'
  ctx.lineWidth = Math.max(1, scale * 0.04)
  for (let i = 0; i < LANE * 2; i++) {
    ctx.beginPath()
    ctx.moveTo(field.x + (i / 2) * scale, gateY - thick / 2)
    ctx.lineTo(field.x + (i / 2) * scale, gateY + thick / 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#8d96b4'
  ctx.fillRect(field.x, gateY - thick * 0.42, wide, scale * 0.1)
  ctx.fillRect(field.x, gateY + thick * 0.32, wide, scale * 0.1)

  ctx.fillStyle = '#5c6b4a'
  for (let i = 0; i < 11; i++) {
    const at = field.x + ((i + 0.5) / 11) * wide
    ctx.beginPath()
    ctx.roundRect(at - scale * 0.42, gateY + thick * 0.45, scale * 0.84, scale * 0.42, scale * 0.16)
    ctx.fill()
  }
}

/** One that has gone down: a heap, sinking into the stone. */
export function drawGone(
  ctx: Ctx, was: Gone, x: number, y: number, scale: number,
): void {
  const breed = BREED[was.breed]
  const w = MON_W * scale * was.size
  const fade = Math.min(1, was.life / 0.7)
  ctx.save()
  ctx.globalAlpha = fade * 0.85
  ctx.fillStyle = breed.rag
  ctx.beginPath()
  ctx.ellipse(x, y + w * 0.3, w * 0.75, w * 0.26 * fade, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = breed.skin
  ctx.beginPath()
  ctx.arc(x - w * 0.5, y + w * 0.2, w * 0.2 * fade, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** A thing falling, under a little parachute, to be caught. */
export function drawFalling(
  ctx: Ctx, drop: Falling, x: number, y: number, scale: number, clock: number, rung = 0,
): void {
  const was = CATCH[drop.kind]
  const sway = Math.sin(clock * 2 + drop.id) * scale * 0.18
  const w = scale * 0.8

  ctx.save()
  // Chute.
  ctx.fillStyle = 'rgba(233,237,248,0.85)'
  ctx.beginPath()
  ctx.ellipse(x + sway, y - w * 0.95, w * 0.78, w * 0.5, 0, Math.PI, 0)
  ctx.fill()
  ctx.strokeStyle = 'rgba(233,237,248,0.6)'
  ctx.lineWidth = Math.max(1, scale * 0.03)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + sway + side * w * 0.72, y - w * 0.95)
    ctx.lineTo(x + side * w * 0.3, y - w * 0.4)
    ctx.stroke()
  }

  if (drop.kind === 'gun') {
    // A gun comes down as itself, swinging on its straps — the same drawing
    // that was on the rack and the same one that ends up in his hands.
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.sin(clock * 2 + drop.id) * 0.12)
    drawWeapon(ctx, 0, w * 0.3, scale * 0.95, shapeOf(rung + drop.step), 0)
    ctx.restore()
    ctx.restore()
    return
  }

  // The box, in the colour of what is in it.
  ctx.fillStyle = was.tint
  ctx.strokeStyle = 'rgba(10,13,23,0.7)'
  ctx.lineWidth = Math.max(1.5, scale * 0.05)
  ctx.beginPath()
  ctx.roundRect(x - w * 0.42, y - w * 0.42, w * 0.84, w * 0.84, scale * 0.1)
  ctx.fill()
  ctx.stroke()

  // A mark that says which it is without a word: a turret, a chevron, a star.
  ctx.fillStyle = 'rgba(10,13,23,0.85)'
  if (drop.kind === 'turret') {
    ctx.fillRect(x - w * 0.06, y - w * 0.3, w * 0.12, w * 0.3)
    ctx.beginPath()
    ctx.roundRect(x - w * 0.22, y, w * 0.44, w * 0.2, scale * 0.05)
    ctx.fill()
  } else if (drop.kind === 'rapid') {
    for (const up of [-0.26, -0.02, 0.22]) {
      ctx.beginPath()
      ctx.moveTo(x - w * 0.2, y + w * (up + 0.14))
      ctx.lineTo(x, y + w * up)
      ctx.lineTo(x + w * 0.2, y + w * (up + 0.14))
      ctx.lineTo(x, y + w * (up + 0.07))
      ctx.closePath()
      ctx.fill()
    }
  } else {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const r = i % 2 === 0 ? w * 0.3 : w * 0.12
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The stash: every gun you have been handed so far, in a row at your feet.
 *
 * Asked for in those words — "show some upgraded guns at the bottom like a
 * stash that you have collected" — and it earns its space for a reason the ask
 * did not have to say: the ladder is twenty-four rungs long and until now the
 * only evidence of it was a word in the corner. A row that grows is the one
 * place the whole run is visible at once.
 *
 * Only the shapes you have actually held, newest at the right and lit up; the
 * older ones go dim and small, and past eight of them the oldest drop off the
 * left rather than squeezing the row.
 */
export function drawStash(
  ctx: Ctx, rung: number, x: number, y: number, scale: number,
): void {
  const shapes: number[] = []
  let last = -1
  for (let at = 0; at <= rung; at++) {
    const shape = shapeOf(at)
    if (shape !== last) {
      shapes.push(shape)
      last = shape
    }
  }
  // Every rung of the same shape is one entry, plus the rung you are on, so the
  // row says "five guns in" rather than "eleven rungs in" — which is what a
  // player can actually see in their hands.
  const show = shapes.slice(-8)
  const step = scale * 0.74
  const from = x - ((show.length - 1) * step) / 2

  ctx.save()
  // A dark board behind them, or a row of pale guns over pale timber is a row
  // of nothing.
  ctx.fillStyle = 'rgba(8,11,20,0.55)'
  ctx.beginPath()
  ctx.roundRect(
    from - step * 0.62, y - scale * 0.78, step * (show.length - 1) + step * 1.24, scale * 1.05,
    scale * 0.12,
  )
  ctx.fill()

  for (const [i, shape] of show.entries()) {
    const latest = i === show.length - 1
    ctx.globalAlpha = latest ? 1 : 0.45 + (i / show.length) * 0.25
    drawWeapon(ctx, from + i * step, y + scale * 0.12, scale * (latest ? 0.62 : 0.48), shape, 0)
  }
  ctx.restore()
}

/** A turret you caught, holding the line beside you until its time runs out. */
export function drawTurret(
  ctx: Ctx, left: number, x: number, y: number, scale: number, clock: number,
): void {
  ctx.save()
  // It blinks out its last two seconds, so nobody is surprised when it goes.
  if (left < 2) ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(clock * 9))
  ctx.fillStyle = '#5c6b4a'
  ctx.strokeStyle = '#2a3550'
  ctx.lineWidth = Math.max(1.5, scale * 0.05)
  ctx.beginPath()
  ctx.roundRect(x - scale * 0.42, y - scale * 0.3, scale * 0.84, scale * 0.6, scale * 0.12)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#cfe6ff'
  ctx.fillRect(x - scale * 0.07, y - scale * 0.95, scale * 0.14, scale * 0.7)
  ctx.fillStyle = '#2a3550'
  ctx.beginPath()
  ctx.arc(x, y - scale * 0.2, scale * 0.16, 0, Math.PI * 2)
  ctx.fill()
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

  drawBridge(ctx, field, view)

  ctx.save()
  ctx.beginPath()
  ctx.rect(field.x, field.y, LANE * scale, TALL * scale)
  ctx.clip()

  for (const was of run.gone) {
    const spot = at(was.x, was.y)
    drawGone(ctx, was, spot.x, spot.y, scale)
  }

  for (const mon of run.crowd) {
    const spot = at(mon.x, mon.y)
    drawMonster(ctx, mon, spot.x, spot.y, scale, run.clock)
  }

  for (const crate of run.crates) {
    const spot = at(crate.x, crate.y)
    drawCrate(ctx, crate, spot.x, spot.y, scale, run.rung)
  }

  for (const crate of run.crates) {
    const spot = at(crate.x, crate.y)
    drawCrate(ctx, crate, spot.x, spot.y, scale, run.rung)
  }

  for (const drop of run.falling) {
    const spot = at(drop.x, drop.y)
    drawFalling(ctx, drop, spot.x, spot.y, scale, run.clock, run.rung)
  }

  for (const turret of run.turrets) {
    const spot = at(turret.x, GUN_Y)
    drawTurret(ctx, turret.left, spot.x, spot.y, scale, run.clock)
  }

  const shape = shapeOf(run.rung)
  for (const shot of run.shots) {
    const spot = at(shot.x, shot.y)
    drawShot(ctx, shot, spot.x, spot.y, scale, shape)
  }

  // The stash goes down before he does, so he stands in front of his own guns
  // rather than being written over by them when he walks to the middle.
  drawStash(ctx, run.rung, field.x + (LANE / 2) * scale, field.y + (LINE_Y + 0.8) * scale, scale)

  const me = at(run.gun, GUN_Y)
  const weapon = weaponOf(run)
  drawGun(
    ctx, me.x, me.y, scale, weapon, run.clock,
    1 - Math.min(1, run.cool / weapon.every), run.rung,
  )

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

  // The bridge itself, so the tile is the place as well as the people.
  drawBridge(ctx, field, { w, h, clock })

  const one = (
    id: number, x: number, y: number, breed: Monster['breed'], health: number, max: number,
  ): Monster => ({
    id, x, y, breed, health, max,
    pace: BREED[breed].pace, size: BREED[breed].size, flash: 0, step: id,
  })

  const crowd: Monster[] = [
    one(1, 1.6, 1.5, 'shambler', 6, 9),
    one(2, 3.2, 1.1, 'runner', 3, 5),
    one(3, 4.8, 1.6, 'shambler', 8, 9),
    one(4, 2.4, 3.1, 'brute', 40, 54),
    one(5, 4.4, 3.4, 'lurcher', 9, 14),
  ]
  for (const mon of crowd) {
    const spot = at(mon.x, mon.y)
    drawMonster(ctx, mon, spot.x, spot.y, scale, clock)
  }

  const crate: Crate = { id: 6, x: 0.6, y: 4.4, need: 12, got: 4, step: 2, flash: 0 }
  const box = at(crate.x, crate.y)
  drawCrate(ctx, crate, box.x, box.y, scale, 1)

  for (const y of [5.3, 6]) {
    const spot = at(3.2, y)
    drawShot(ctx, { id: 9, x: 3.2, y, hit: 4 }, spot.x, spot.y, scale, 1)
  }

  const me = at(3.2, 6.8)
  drawGun(ctx, me.x, me.y, scale, gunAt(4), clock, 0.9, 4)
}
