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
/**
 * Long legs, narrow shoulders, a small head: the shape of an acrobat.
 *
 * The height is the same as the stocky build's on purpose — a figure much
 * taller than this is drawn through the floor above him, because a room is
 * only three floors and he has to fit inside one. What makes this build read
 * as long is where the hips are and how small the head is, not how tall he is.
 */
export const LEAN: Build = { height: 1.38, width: 0.15, head: 0.118, hip: 0.52, limb: 0.055 }

/**
 * A fighter: heavy through the chest and shoulders, thick in the limb.
 *
 * The lean build reads as an acrobat and, at the size this is played at, as a
 * stick. Mass is what separates a warrior from a diagram, and nearly all of it
 * is two numbers — how wide he is across the shoulders and how thick an arm
 * is. The head comes down a little, which is what lets the shoulders look
 * broad rather than merely wide.
 */
export const WARRIOR: Build = { height: 1.36, width: 0.2, head: 0.15, hip: 0.47, limb: 0.082 }

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

  // A knee folds the shin backwards; an elbow folds the forearm forwards. They
  // are opposite joints and the first version bent them the same way, which
  // gave everybody a second pair of knees where their elbows should be.
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
      x: shoulder.x + side * w * 0.14,
      y: shoulder.y + h * 0.025,
    }
    const elbow = reach(root, swing + pose.lean, upper)
    return { ...legs, shoulder: root, elbow, hand: reach(elbow, swing - bend + pose.lean, fore) }
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

/**
 * What somebody is wearing.
 *
 * Costume belongs to the character, not to the drawing style — one is who he
 * is and the other is how the lines are put down. Keeping them apart is what
 * lets a guard be a guard in the same frames.
 *
 * The flags here are all about skin. An earlier version had him in a hood, a
 * mask, a shoulder plate and bound forearms, and the result read as a machine:
 * there was no person anywhere in it. What makes a figure human at this size
 * is seeing the bits of them that are not cloth — a face, hair, bare arms,
 * bare feet — so those are the things this controls.
 */
export interface Look {
  body: string
  legs: string
  trim: string
  skin: string
  hair: string
  /** A band round the head, tied at the back with the ends left long. */
  band?: string
  /** A wrapped turban instead, for the guards. */
  turban?: boolean
  /** Bare arms: a sleeveless top, so the whole arm is skin. */
  sleeveless?: boolean
  /** No shoes at all, which is how he is drawn in the original. */
  barefoot?: boolean
  /** Trousers cut wide, so they flare at the ankle rather than ending. */
  loose?: boolean
  /** A curved blade. */
  curved?: boolean
  /** A long coat over the trousers, down to the knee. */
  coat?: boolean
}

export type Style = 'warrior' | 'outline' | 'acrobat' | 'silhouette' | 'inked'

interface Spec {
  build: Build
  ink: string | null
  inkWidth: number
  rim: string | null
  /** Cloth off the back of the head that trails when he moves. */
  scarf?: boolean
  /** How far to round every corner off, as a fraction of his height. */
  round?: number
}

/** How each style is put together. Kept as data so they can be compared fairly. */
export const STYLES: Record<Style, Spec> = {
  // The one the game uses. A soft dark line rather than a hard black one:
  // black outlines everywhere are most of what made the earlier figure read
  // as stamped out of metal.
  warrior: {
    build: WARRIOR, ink: '#2a2118', inkWidth: 0.014, rim: null,
    scarf: true, round: 0.018,
  },
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
/**
 * Rounds off every corner of a path, by stroking it with its own colour.
 *
 * A polygon filled on its own has mitred corners, and a body made of mitred
 * corners reads as cut from card. Stroking the same path with a round join and
 * then filling it grows the shape by the stroke's half-width and softens every
 * corner by exactly that much, which costs one extra call and no geometry.
 */
function soften(ctx: Ctx, path: Path2D, fill: string, radius: number): void {
  if (radius > 0) {
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = fill
    ctx.lineWidth = radius * 2
    ctx.stroke(path)
  }
  ctx.fillStyle = fill
  ctx.fill(path)
}

function slab(
  ctx: Ctx, from: Point, to: Point, fromHalf: number, toHalf: number,
  fill: string, ink: string | null, inkWidth: number,
  /** Shifts the whole slab sideways, for a panel down one edge of a torso. */
  offset = 0,
  /** How far to round the corners off. */
  round = 0,
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const path = new Path2D()
  path.moveTo(from.x + px * (fromHalf + offset), from.y + py * (fromHalf + offset))
  path.lineTo(to.x + px * (toHalf + offset), to.y + py * (toHalf + offset))
  path.lineTo(to.x - px * (toHalf - offset), to.y - py * (toHalf - offset))
  path.lineTo(from.x - px * (fromHalf - offset), from.y - py * (fromHalf - offset))
  path.closePath()
  if (ink) {
    ctx.strokeStyle = ink
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = inkWidth * 2 + round * 2
    ctx.stroke(path)
  }
  soften(ctx, path, fill, round)
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

/** A limb: two bones, and a foot or a hand at the end of them. */
function limb(
  ctx: Ctx, l: Limbs, thick: number, upper: string, lower: string,
  ink: string | null, inkWidth: number,
  foot: { size: number; colour: string; bare: boolean } | null,
  /** Trousers cut wide: the leg widens towards the ankle instead of ending. */
  loose = false,
  round = 0,
): void {
  bone(ctx, l.hip, l.knee, thick, upper, ink, inkWidth)
  if (loose) {
    // A tapered slab rather than a capsule, because a trouser leg hangs and a
    // tube does not, and the hang is most of what says cloth rather than pipe.
    slab(ctx, l.knee, l.ankle, thick * 0.46, thick * 0.8, lower, ink, inkWidth, 0, round)
  } else {
    bone(ctx, l.knee, l.ankle, thick * 0.88, lower, ink, inkWidth)
  }
  if (!foot) return

  // The foot points forward from the ankle and stays near level, whatever the
  // shin is doing. Drawn in the shin's own frame it swings round with the leg,
  // and a foot that points backwards on the back half of a stride is the
  // single loudest thing that can be wrong with a walk.
  const shin = Math.atan2(l.ankle.x - l.knee.x, l.ankle.y - l.knee.y)
  const tilt = Math.max(-0.5, Math.min(0.5, -shin * 0.35))
  const length = foot.size * (foot.bare ? 0.82 : 1)
  const toe = {
    x: l.ankle.x + Math.cos(tilt) * length,
    y: l.ankle.y + Math.sin(tilt) * length,
  }
  if (foot.bare) {
    // A bare foot is thinner than a boot and has a heel behind the ankle,
    // rather than being a block stuck on the end of the leg.
    const heel = {
      x: l.ankle.x - Math.cos(tilt) * length * 0.32,
      y: l.ankle.y - Math.sin(tilt) * length * 0.32,
    }
    bone(ctx, heel, toe, thick * 0.62, foot.colour, ink, inkWidth)
  } else {
    bone(ctx, l.ankle, toe, thick * 1.05, foot.colour, ink, inkWidth)
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
function profile(
  ctx: Ctx, at: Point, lean: number, hh: number, look: Look,
  ink: string | null, inkWidth: number, round = 0,
): void {
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
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = inkWidth * 2 + round * 2
    ctx.stroke(face)
  }
  soften(ctx, face, look.skin, round)

  const hair = new Path2D()
  hair.moveTo(back - hw * 0.06, y(0.88))
  hair.lineTo(back - hw * 0.08, y(0.16))
  hair.lineTo(back + hw * 0.2, y(-0.05))
  hair.lineTo(front - hw * 0.26, y(-0.04))
  hair.lineTo(front - hw * 0.2, y(0.18))
  hair.lineTo(front - hw * 0.42, y(0.16))
  hair.lineTo(back + hw * 0.26, y(0.26))
  hair.lineTo(back + hw * 0.22, y(0.86))
  hair.closePath()
  if (ink) ctx.stroke(hair)
  soften(ctx, hair, look.hair, round)

  if (look.turban) {
    /**
     * Cloth wound round the head, sitting above the brow and wider than the
     * skull, with the winding shown by two lighter bands across it and a tail
     * hanging at the back. A turban drawn as a smooth dome is a helmet.
     */
    const wrap = new Path2D()
    wrap.moveTo(back - hw * 0.26, y(0.3))
    wrap.lineTo(back - hw * 0.18, y(-0.16))
    wrap.lineTo(back + hw * 0.24, y(-0.42))
    wrap.lineTo(front - hw * 0.06, y(-0.34))
    wrap.lineTo(front + hw * 0.12, y(0.06))
    wrap.lineTo(front + hw * 0.06, y(0.28))
    wrap.closePath()
    if (ink) ctx.stroke(wrap)
    soften(ctx, wrap, look.band ?? look.trim, round)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.fillRect(back - hw * 0.22, y(0.02), hw * 1.2, hh * 0.07)
    ctx.fillRect(back - hw * 0.18, y(-0.2), hw * 1.1, hh * 0.06)
  } else if (look.band) {
    // A band across the forehead, over the hair and under the fringe.
    ctx.fillStyle = look.band
    ctx.beginPath()
    ctx.moveTo(back - hw * 0.16, y(0.22))
    ctx.lineTo(back - hw * 0.14, y(0.03))
    ctx.lineTo(front + hw * 0.02, y(0.14))
    ctx.lineTo(front + hw * 0.02, y(0.32))
    ctx.closePath()
    ctx.fill()
    if (ink) { ctx.strokeStyle = ink; ctx.lineWidth = inkWidth * 1.6; ctx.stroke() }
  }

  // One eye, under the brow, because a profile has one — and a mouth, because
  // without one the lower half of the face is blank and he looks like a mask.
  ctx.fillStyle = '#20180f'
  ctx.fillRect(front - hw * 0.28, y(0.38), hw * 0.17, Math.max(1.5, hh * 0.09))
  ctx.fillStyle = 'rgba(90,50,32,0.75)'
  ctx.fillRect(front - hw * 0.2, y(0.69), hw * 0.2, Math.max(1.2, hh * 0.05))
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
  const round = j.h * (spec.round ?? 0)
  const bare = look.barefoot ?? false
  const boot = {
    size: thick * 0.95,
    colour: bare ? look.skin : style === 'silhouette' ? '#12131b' : '#3a2c22',
    bare,
  }

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
    profile(ctx, { x: head.x + j.w * 0.2, y: -j.h * 0.09 }, -1.35, j.h * spec.build.head * 0.9, look, ink, iw, j.h * (spec.round ?? 0))
    ctx.restore()
    return
  }

  // An upper arm in the tunic's own colour disappears into the tunic. A line
  // round it is not enough either — an outlined white shape on a white chest
  // is still a puzzle — so the sleeve always carries its own shade.
  const sleeve = dim(body, 0.86)

  /**
   * An arm: sleeve to the wrist, then a hand.
   *
   * Drawing the whole forearm in skin put a bare peach stripe down the middle
   * of a white tunic in every standing pose — he wears sleeves, so only the
   * hand is skin, and the hand is short.
   */
  /**
   * An arm.
   *
   * Sleeveless means the whole thing is skin, which is most of why the figure
   * reads as a person rather than as a suit: at this size a bare arm against a
   * pale top is the clearest human thing on the screen. With sleeves it is
   * cloth to the wrist and a hand on the end.
   */
  const arm = (l: Limbs, cloth: string, hand: string, t: number) => {
    if (look.sleeveless) {
      bone(ctx, l.shoulder, l.elbow, t * 0.92, hand, ink, iw)
      bone(ctx, l.elbow, l.hand, t * 0.82, hand, ink, iw)
      return
    }
    bone(ctx, l.shoulder, l.elbow, t, cloth, ink, iw)
    const wrist = along(l.elbow, l.hand, 0.72)
    bone(ctx, l.elbow, wrist, t * 0.88, cloth, ink, iw)
    bone(ctx, wrist, l.hand, t * 0.8, hand, ink, iw)
  }

  limb(ctx, j.far, thick, farLegs, farLegs, ink, iw,
    { ...boot, colour: bare ? dim(look.skin, 0.72) : boot.colour }, look.loose, round * 0.8)
  arm(j.far, dim(sleeve, 0.74), dim(look.skin, 0.68), thick * 0.82)

  // The scarf goes on before he does, so it hangs behind him. How far it
  // streams out comes from how far his legs are apart and how hard he is
  // leaning — no clock needed, and it lands differently on every frame of a
  // run for free.
  if (spec.scarf && look.band) {
    /**
     * The ends of the headband, left long and hanging down his back.
     *
     * How far they lift comes from how far his legs are apart and how hard he
     * is leaning, so they stream on a run and hang when he stands — no clock
     * needed, and they land differently on every frame for free. Tapered to a
     * point: at a constant width the first version was a red girder sticking
     * out of the back of his head.
     */
    const drive = Math.min(1, Math.abs(pose.legFront - pose.legBack) * 0.6 + Math.abs(pose.lean) * 0.9)
    const root = { x: j.neck.x - j.w * 0.12, y: j.neck.y - j.h * 0.05 }
    for (const [reach, drop] of [[0.14, 0.16], [0.1, 0.22]] as const) {
      const tip = {
        x: root.x - j.w * (reach + drive * 0.26),
        y: root.y + j.h * (drop - drive * (drop - 0.03)),
      }
      const mid = along(root, tip, 0.5)
      slab(ctx, root, mid, thick * 0.2, thick * 0.15, look.band, null, 0, 0, round * 0.4)
      slab(ctx, mid, tip, thick * 0.15, thick * 0.03, look.band, null, 0, 0, round * 0.4)
    }
  }

  // Neck and bare shoulders first. The torso as a shape rather than a fat
  // stroke: a round-capped stroke overshoots the shoulder by half its own
  // width, which put a dome over the head and turned every one of these into
  // an egg.
  bone(ctx, j.shoulder, j.neck, thick * 0.66, dim(look.skin, 0.9), ink, iw)
  slab(ctx, j.hip, j.shoulder, j.w * 0.2, j.w * 0.25, look.sleeveless ? look.skin : body, ink, iw, 0, round)

  /**
   * The top itself.
   *
   * Sleeveless means it stops short of the shoulders, so the chest and the
   * shoulder are skin and the whole arm hangs off bare. Drawing the garment
   * all the way up to the neck is what made an earlier version look like a
   * man in a suit rather than a man.
   */
  const collar = along(j.hip, j.shoulder, look.sleeveless ? 0.82 : 1)
  slab(ctx, j.hip, collar, j.w * 0.21, j.w * 0.23, body, ink, iw, 0, round)

  /**
   * The back of him, in shadow.
   *
   * Only the back. The first version shaded both edges and left a light stripe
   * down the middle, which is how you light a body that is facing you — with a
   * profile head above it the whole figure read as somebody standing with
   * their back turned and their neck wrenched round. The light has to come
   * from one side, and it has to be the side he is facing.
   */
  slab(ctx, j.hip, collar, j.w * 0.07, j.w * 0.08, dim(body, 0.82), null, 0, -j.w * 0.13, round * 0.7)

  // A coat over the trousers, for the guards, cut away at the front so it does
  // not swallow the legs.
  if (look.coat) {
    const hem = { x: j.hip.x - j.w * 0.12, y: j.hip.y + j.h * 0.17 }
    slab(ctx, along(j.hip, j.shoulder, 0.3), hem, j.w * 0.22, j.w * 0.26, dim(body, 0.88), ink, iw, -j.w * 0.05, round)
  }

  // The sash: wound round the waist, with the end hanging at the front.
  const waist = along(j.hip, j.shoulder, 0.2)
  slab(ctx, along(j.hip, j.shoulder, 0.01), waist, j.w * 0.25, j.w * 0.25, look.trim, ink, iw, 0, round * 0.8)
  const knot = along(j.hip, j.shoulder, 0.1)
  bone(ctx, { x: knot.x + j.w * 0.14, y: knot.y }, { x: knot.x + j.w * 0.1, y: knot.y + j.h * 0.14 },
    thick * 0.4, look.trim, ink, iw)

  profile(ctx, j.neck, j.lean, j.h * spec.build.head, look, ink, iw, round)

  limb(ctx, j.near, thick, legs, legs, ink, iw, boot, look.loose, round * 0.8)
  arm(j.near, sleeve, look.skin, thick * 0.86)

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
    if (look.curved) {
      // A scimitar: the back of the blade bows away and the edge follows it,
      // so the whole thing sweeps rather than pointing.
      const rise = len * 0.3
      ctx.moveTo(j.w * 0.12, -t / 2)
      ctx.quadraticCurveTo(j.w * 0.12 + len * 0.6, -rise * 0.7, j.w * 0.12 + len, -rise)
      ctx.quadraticCurveTo(j.w * 0.12 + len * 0.6, -rise * 0.25, j.w * 0.12, t / 2)
    } else {
      ctx.moveTo(j.w * 0.12, -t / 2)
      ctx.lineTo(j.w * 0.12 + len, -t * 0.15)
      ctx.lineTo(j.w * 0.12 + len, t * 0.15)
      ctx.lineTo(j.w * 0.12, t / 2)
    }
    ctx.closePath()
    if (ink) { ctx.strokeStyle = ink; ctx.lineWidth = iw * 1.4; ctx.stroke() }
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
}
