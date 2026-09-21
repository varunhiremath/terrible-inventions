/**
 * Four ways of drawing the same person.
 *
 * The pose system says where every joint is; this says what to draw there.
 * Keeping those two apart is the whole point — the run cycle, the sword
 * stances and the landings are hard-won and style-independent, so trying a
 * different-looking character should not mean redoing any of them.
 *
 * A skeleton is worked out once, in a frame that has already been mirrored to
 * face the right way, so forward is always +x and no geometry carries a
 * `* facing` to get wrong.
 */

type Ctx = CanvasRenderingContext2D

export interface Joints {
  hip: Point
  shoulder: Point
  /** Base of the skull, where the neck meets it. */
  neck: Point
  /** How far the torso is tipped, for drawing the head and body on the slant. */
  lean: number
  near: Limbs
  far: Limbs
  /** Width unit: everything is a fraction of this. */
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

interface Limbs {
  hip: Point
  knee: Point
  ankle: Point
  shoulder: Point
  elbow: Point
  hand: Point
}

export interface Build {
  /** Total height as a multiple of a tile's width. */
  height: number
  /** Shoulder width as a fraction of height. */
  width: number
  /** Head height as a fraction of total height. Small heads read as heroic. */
  head: number
  /** Where the hips sit, as a fraction of height off the ground. */
  hip: number
  /** Limb thickness as a fraction of height. */
  limb: number
}

/** The build the game has shipped with so far, for comparison. */
export const STOCKY: Build = { height: 1.34, width: 0.19, head: 0.155, hip: 0.48, limb: 0.072 }
/** Long legs, narrow shoulders, a small head: the shape of an acrobat. */
export const LEAN: Build = { height: 1.5, width: 0.15, head: 0.118, hip: 0.52, limb: 0.055 }

interface Pose {
  lean: number
  twist: number
  crouch: number
  legFront: number
  legBack: number
  kneeFront: number
  kneeBack: number
  liftFront: number
  liftBack: number
  armSword: number
  armFree: number
  elbowSword: number
  elbowFree: number
  blade: number
  bladeTilt: number
  flat: number
}

/** Where a limb's far end lands, given where it starts and how it is bent. */
function reach(from: Point, angle: number, length: number): Point {
  // Canvas rotation is clockwise with y downwards, so a positive angle swings
  // the limb backwards. Same convention the poses are written in.
  return { x: from.x - Math.sin(angle) * length, y: from.y + Math.cos(angle) * length }
}

export function skeleton(pose: Pose, size: number, build: Build): Joints {
  const h = size * build.height
  const w = h * build.width * 2
  const fold = pose.crouch * h * 0.2
  const hipY = -h * build.hip + fold
  const torso = h * (0.86 - build.hip - build.head * 0.45) - fold * 0.5
  const thigh = h * (build.hip / 2) - fold * 0.35
  const shin = thigh
  const upper = h * 0.17
  const fore = h * 0.16

  const hip = { x: 0, y: hipY }
  // The torso pivots about the hips, so the shoulders swing with the lean.
  const shoulder = {
    x: hip.x + Math.sin(pose.lean) * torso,
    y: hip.y - Math.cos(pose.lean) * torso,
  }
  const neck = {
    x: shoulder.x + Math.sin(pose.lean) * h * 0.03,
    y: shoulder.y - Math.cos(pose.lean) * h * 0.03,
  }

  const leg = (swing: number, bend: number, lift: number, side: number): Limbs => {
    const root = { x: hip.x + side * w * 0.09, y: hip.y - lift * h }
    const knee = reach(root, swing, thigh)
    return {
      hip: root,
      knee,
      ankle: reach(knee, swing + bend, shin),
      shoulder: root,
      elbow: knee,
      hand: knee,
    }
  }
  const arm = (swing: number, bend: number, side: number, legs: Limbs): Limbs => {
    const root = {
      x: shoulder.x + side * w * 0.14 + Math.sin(pose.lean) * 0,
      y: shoulder.y + h * 0.025,
    }
    const elbow = reach(root, swing + pose.lean, upper)
    return { ...legs, shoulder: root, elbow, hand: reach(elbow, swing + bend + pose.lean, fore) }
  }

  const nearLeg = leg(pose.legFront, pose.kneeFront, pose.liftFront, 1)
  const farLeg = leg(pose.legBack, pose.kneeBack, pose.liftBack, -1)

  return {
    hip,
    shoulder,
    neck,
    lean: pose.lean,
    near: arm(pose.armSword, pose.elbowSword, 1, nearLeg),
    far: arm(pose.armFree, pose.elbowFree, -1, farLeg),
    w,
    h,
  }
}

export interface Look {
  body: string
  legs: string
  trim: string
  skin: string
  hair: string
  hat?: string
}

export type Style = 'outline' | 'acrobat' | 'silhouette' | 'inked'

/** How each style is put together. Kept as data so they can be compared fairly. */
export const STYLES: Record<Style, { build: Build; ink: string | null; inkWidth: number; rim: string | null }> = {
  // Flat colour with a heavy dark line round everything. An outline is what
  // makes flat shapes read as drawn rather than as shapes.
  outline: { build: STOCKY, ink: '#171a1f', inkWidth: 0.026, rim: null },
  // No line at all: soft rounded limbs on a long-legged build, so the
  // silhouette alone has to do the work.
  acrobat: { build: LEAN, ink: null, inkWidth: 0, rim: null },
  // Almost a shadow, with a light down the leading edge and the sash and skin
  // as the only colour. Reads instantly against stone at any size.
  silhouette: { build: LEAN, ink: null, inkWidth: 0, rim: '#f0e6d2' },
  // The long build with the heavy line: the crispest of the four.
  inked: { build: LEAN, ink: '#12151a', inkWidth: 0.022, rim: null },
}

/** A point some fraction of the way from one joint to another. */
function along(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/**
 * A tapered slab between two joints — a torso, or a sash across one.
 *
 * Square-ended on purpose: a body has shoulders, and a shape that rounds off
 * at the top has none.
 */
function slab(
  ctx: Ctx, from: Point, to: Point, fromHalf: number, toHalf: number,
  fill: string, ink: string | null, inkWidth: number,
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const path = new Path2D()
  path.moveTo(from.x + px * fromHalf, from.y + py * fromHalf)
  path.lineTo(to.x + px * toHalf, to.y + py * toHalf)
  path.lineTo(to.x - px * toHalf, to.y - py * toHalf)
  path.lineTo(from.x - px * fromHalf, from.y - py * fromHalf)
  path.closePath()
  if (ink) {
    ctx.strokeStyle = ink
    ctx.lineWidth = inkWidth * 2
    ctx.lineJoin = 'round'
    ctx.stroke(path)
  }
  ctx.fillStyle = fill
  ctx.fill(path)
}

function bone(ctx: Ctx, a: Point, b: Point, thick: number, fill: string, ink: string | null, inkWidth: number): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (ink) {
    ctx.strokeStyle = ink
    ctx.lineWidth = thick + inkWidth * 2
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.strokeStyle = fill
  ctx.lineWidth = thick
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

/** A limb: two bones and a foot or a hand at the end of them. */
function limb(
  ctx: Ctx, l: Limbs, thick: number, upper: string, lower: string,
  ink: string | null, inkWidth: number, boot: { size: number; colour: string } | null,
): void {
  bone(ctx, l.hip, l.knee, thick, upper, ink, inkWidth)
  bone(ctx, l.knee, l.ankle, thick * 0.88, lower, ink, inkWidth)
  if (boot) {
    // The foot points forward from the ankle, which is +x in this frame.
    const toe = { x: l.ankle.x + boot.size, y: l.ankle.y }
    bone(ctx, l.ankle, toe, thick * 1.05, boot.colour, ink, inkWidth)
  }
}

/**
 * The head, in profile.
 *
 * A silhouette, not a decorated box: a flat back to the skull, a brow, a nose
 * that juts, a notch for the mouth and a chin that falls away behind it. The
 * hair stops where hair stops, which is most of what tells you which way
 * somebody is facing.
 */
function profile(ctx: Ctx, at: Point, lean: number, hh: number, look: Look, ink: string | null, inkWidth: number): void {
  const hw = hh * 0.62
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.rotate(-lean)

  const back = -hw * 0.5
  const front = hw * 0.34
  const y = (f: number) => -hh + hh * f

  const face = new Path2D()
  face.moveTo(back, y(0.84))
  face.lineTo(back, y(0.22))
  face.lineTo(back + hw * 0.26, y(0.02))
  face.lineTo(front - hw * 0.16, y(0))
  face.lineTo(front, y(0.3))
  face.lineTo(front - hw * 0.05, y(0.42))
  face.lineTo(front + hw * 0.13, y(0.55))
  face.lineTo(front - hw * 0.04, y(0.61))
  face.lineTo(front + hw * 0.02, y(0.7))
  face.lineTo(front - hw * 0.07, y(0.76))
  face.lineTo(front - hw * 0.02, y(0.88))
  face.lineTo(back + hw * 0.36, y(0.95))
  face.closePath()

  if (ink) {
    ctx.strokeStyle = ink
    ctx.lineWidth = inkWidth * 2
    ctx.lineJoin = 'round'
    ctx.stroke(face)
  }
  ctx.fillStyle = look.skin
  ctx.fill(face)

  const hair = new Path2D()
  hair.moveTo(back - hw * 0.07, y(1.0))
  hair.lineTo(back - hw * 0.07, y(0.2))
  hair.lineTo(back + hw * 0.22, y(-0.04))
  hair.lineTo(front - hw * 0.14, y(-0.04))
  hair.lineTo(front - hw * 0.01, y(0.32))
  hair.lineTo(front - hw * 0.3, y(0.28))
  hair.lineTo(back + hw * 0.26, y(0.34))
  hair.lineTo(back + hw * 0.24, y(1.0))
  hair.closePath()
  if (ink) ctx.stroke(hair)
  ctx.fillStyle = look.hair
  ctx.fill(hair)

  if (look.hat) {
    const hat = new Path2D()
    hat.moveTo(back - hw * 0.14, y(0.34))
    hat.lineTo(back - hw * 0.05, y(-0.16))
    hat.lineTo(front - hw * 0.05, y(-0.16))
    hat.lineTo(front + hw * 0.03, y(0.3))
    hat.closePath()
    if (ink) ctx.stroke(hat)
    ctx.fillStyle = look.hat
    ctx.fill(hat)
  }

  ctx.fillStyle = ink ?? '#1a140d'
  ctx.fillRect(front - hw * 0.26, y(0.4), hw * 0.15, Math.max(1.5, hh * 0.08))
  ctx.restore()
}

/** Everything, in one of the four styles. */
export function drawFigure(
  ctx: Ctx, x: number, footY: number, size: number, facing: 1 | -1,
  pose: Pose, look: Look, style: Style, armed: boolean,
): void {
  const spec = STYLES[style]
  const j = skeleton(pose, size, spec.build)
  const ink = spec.ink
  const iw = j.h * spec.inkWidth
  const thick = j.h * spec.build.limb
  const dim = (c: string, by: number) => {
    const n = parseInt(c.slice(1), 16)
    const at = (s: number) => Math.round(((n >> s) & 255) * by)
    return `rgb(${at(16)},${at(8)},${at(0)})`
  }

  // In silhouette the body is almost a shadow and only the skin and the sash
  // carry colour, so the whole figure is a shape first and a person second.
  const body = style === 'silhouette' ? '#20222e' : look.body
  const legs = style === 'silhouette' ? '#191b25' : look.legs
  const farLegs = dim(legs, 0.66)
  const boot = { size: thick * 0.9, colour: style === 'silhouette' ? '#12131b' : '#3a2c22' }

  ctx.save()
  ctx.translate(x, footY)
  ctx.scale(facing * (1 - pose.twist * 0.62), 1)

  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.ellipse(0, 0, j.w * 0.55, j.h * 0.028, 0, 0, Math.PI * 2)
  ctx.fill()

  if (pose.flat > 0) {
    // Face down along the floor.
    const head = { x: j.w * 1.1, y: -j.h * 0.06 }
    bone(ctx, { x: -j.w * 1.3, y: -j.h * 0.05 }, { x: j.w * 0.1, y: -j.h * 0.05 }, thick * 1.1, legs, ink, iw)
    bone(ctx, { x: -j.w * 0.1, y: -j.h * 0.07 }, head, thick * 1.5, body, ink, iw)
    profile(ctx, { x: head.x + j.w * 0.2, y: -j.h * 0.09 }, -1.35, j.h * spec.build.head * 0.9, look, ink, iw)
    ctx.restore()
    return
  }

  // An upper arm in the tunic's own colour disappears into the tunic. With a
  // line round it you can still see where it is; without one the sleeve has to
  // carry its own shade or the figure comes out armless.
  const sleeve = ink ? body : dim(body, 0.84)

  limb(ctx, j.far, thick, farLegs, farLegs, ink, iw, boot)
  bone(ctx, j.far.shoulder, j.far.elbow, thick * 0.82, dim(sleeve, 0.72), ink, iw)
  bone(ctx, j.far.elbow, j.far.hand, thick * 0.72, dim(look.skin, 0.66), ink, iw)

  // Neck, then the torso as a shape rather than a fat stroke. A round-capped
  // stroke overshoots the shoulder by half its own width, which put a white
  // dome over the head and turned every one of these into an egg.
  bone(ctx, j.shoulder, j.neck, thick * 0.62, dim(look.skin, 0.88), ink, iw)
  slab(ctx, j.hip, j.shoulder, j.w * 0.24, j.w * 0.29, body, ink, iw)
  const waist = along(j.hip, j.shoulder, 0.16)
  slab(ctx, along(j.hip, j.shoulder, 0.02), waist, j.w * 0.3, j.w * 0.3, look.trim, ink, iw)

  profile(ctx, j.neck, j.lean, j.h * spec.build.head, look, ink, iw)

  limb(ctx, j.near, thick, legs, legs, ink, iw, boot)
  bone(ctx, j.near.shoulder, j.near.elbow, thick * 0.86, sleeve, ink, iw)
  bone(ctx, j.near.elbow, j.near.hand, thick * 0.76, look.skin, ink, iw)

  // A light down the leading edge, which is the whole of why a silhouette
  // reads as a body rather than as a hole in the wall.
  if (spec.rim) {
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = spec.rim
    ctx.lineWidth = Math.max(1.2, j.h * 0.012)
    ctx.lineCap = 'round'
    for (const [a, b] of [[j.hip, j.shoulder], [j.near.hip, j.near.knee], [j.near.knee, j.near.ankle]] as const) {
      ctx.beginPath()
      ctx.moveTo(a.x + j.w * 0.28, a.y)
      ctx.lineTo(b.x + j.w * 0.2, b.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (armed && pose.blade > 0) {
    ctx.save()
    ctx.translate(j.near.hand.x, j.near.hand.y)
    ctx.rotate(pose.bladeTilt)
    const len = size * (0.3 + pose.blade * 0.36)
    const t = Math.max(2.5, j.w * 0.09)
    ctx.fillStyle = '#c8a24a'
    ctx.fillRect(-j.w * 0.08, -j.w * 0.12, j.w * 0.2, j.w * 0.24)
    ctx.fillStyle = '#d8dee8'
    ctx.beginPath()
    ctx.moveTo(j.w * 0.12, -t / 2)
    ctx.lineTo(j.w * 0.12 + len, -t * 0.15)
    ctx.lineTo(j.w * 0.12 + len, t * 0.15)
    ctx.lineTo(j.w * 0.12, t / 2)
    ctx.closePath()
    if (ink) { ctx.strokeStyle = ink; ctx.lineWidth = iw * 1.4; ctx.stroke() }
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
}
