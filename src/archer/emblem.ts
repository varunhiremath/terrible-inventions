/**
 * The meadow, painted flat.
 *
 * Everywhere else in this project a tile and a cutscene are the game itself:
 * the real level, drawn by the game's own drawing code. This one cannot be,
 * and the reason is worth writing down rather than apologising for. The meadow
 * is drawn with three.js, and a tile is a thumbnail on a screen with nine
 * others beside it — ten WebGL contexts to show ten thumbnails would cost more
 * than everything else on the front screen put together, and the cutscenes are
 * tested in a terminal with no graphics card at all.
 *
 * So this paints the same place with a brush instead: the same sky, the same
 * hills in the same haze, the game's own balloon colours and the game's own
 * numbers on them. And where the truth actually matters it is not painted at
 * all — the arrow in the cutscene is flown by the game's own gravity at the
 * game's own arrow speed, aimed by the game's own `aimFor`, and projected
 * through a camera like the real one. The arc you are shown is the arc you
 * will have to learn.
 */
import {
  ARROW_R, BALLOON_R, EYE, FAR, GRAVITY, NEAR, TINTS,
  arrowSpeed,
} from './level'
import { aimFor, facing } from './run'

type Ctx = CanvasRenderingContext2D

// --- the camera --------------------------------------------------------------

interface Lens {
  w: number
  h: number
  /** Focal length in pixels, from a sixty-degree view like the real one. */
  f: number
  pitch: number
  yaw: number
}

const lensFor = (w: number, h: number, yaw: number, pitch: number, fov = 60): Lens => ({
  w, h, pitch, yaw,
  f: (h / 2) / Math.tan((fov * Math.PI) / 180 / 2),
})

/** Where a point in the meadow lands on the screen, and how far off it is. */
function see(lens: Lens, x: number, y: number, z: number): { sx: number; sy: number; d: number } {
  // Turned to face the way the camera is looking, then tipped up.
  const cx = x * Math.cos(lens.yaw) - z * Math.sin(lens.yaw)
  const cz = x * Math.sin(lens.yaw) + z * Math.cos(lens.yaw)
  const ahead = -cz
  const up = y - EYE
  const d = ahead * Math.cos(lens.pitch) + up * Math.sin(lens.pitch)
  const u = up * Math.cos(lens.pitch) - ahead * Math.sin(lens.pitch)
  return { sx: lens.w / 2 + (lens.f * cx) / Math.max(0.3, d), sy: lens.h / 2 - (lens.f * u) / Math.max(0.3, d), d }
}

// --- the place ---------------------------------------------------------------

const SKY_HIGH = '#2a5ea8'
const SKY_LOW = '#bcd8ef'
const HAZE = '#8fb6dc'
const GRASS = '#4a7a3c'

/** Sky, sun, hills, grass and a line of pines: everything that does not move. */
function backdrop(ctx: Ctx, lens: Lens): void {
  const { w, h } = lens
  const horizon = see(lens, 0, EYE, -400).sy

  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon))
  sky.addColorStop(0, SKY_HIGH)
  sky.addColorStop(0.7, HAZE)
  sky.addColorStop(1, SKY_LOW)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // The sun, low and warm, off to one side.
  const sun = see(lens, -60, 34, -120)
  const glow = ctx.createRadialGradient(sun.sx, sun.sy, 0, sun.sx, sun.sy, w * 0.55)
  glow.addColorStop(0, 'rgba(255,248,214,0.95)')
  glow.addColorStop(0.3, 'rgba(255,240,190,0.3)')
  glow.addColorStop(1, 'rgba(255,240,190,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // Two rings of hills. The far one is nearly the haze, which is the whole
  // trick to making a flat picture look like it has air in it.
  const ridge = (lift: number, rough: number, ink: string) => {
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * w
      const bump = Math.sin(i * 0.9 + lift) * 0.5 + Math.sin(i * 2.3 + lift * 3) * 0.5
      ctx.lineTo(x, horizon - bump * rough * h - rough * h * 0.6)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
  }
  ridge(0.4, 0.035, '#8db0d2')
  ridge(2.1, 0.022, '#6f99ab')

  // The grass, from the horizon down, darkening as it comes towards you.
  const field = ctx.createLinearGradient(0, horizon, 0, h)
  field.addColorStop(0, '#6f9a5c')
  field.addColorStop(0.35, GRASS)
  field.addColorStop(1, '#2f5a28')
  ctx.fillStyle = field
  ctx.fillRect(0, horizon - 1, w, h - horizon + 1)

  // A speckle over the field, which is the flat picture's version of the
  // ground texture the game itself tiles over the meadow. Without it the grass
  // is a sheet of coloured paper.
  for (let i = 0; i < 1100; i++) {
    const angle = (i * 2.399) % (Math.PI * 2)
    const away = 1.5 + (((i * 7919) % 1000) / 1000) * 30
    const at = see(lens, Math.cos(angle) * away, 0, Math.sin(angle) * away)
    if (at.d < 1.5 || at.sy < horizon) continue
    const long = Math.max(1, (lens.f * 0.16) / at.d)
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(134,180,92,0.45)' : 'rgba(44,84,38,0.4)'
    ctx.lineWidth = Math.max(0.8, long * 0.12)
    ctx.beginPath()
    ctx.moveTo(at.sx, at.sy)
    ctx.lineTo(at.sx + long * 0.25, at.sy - long)
    ctx.stroke()
  }

  // Pines along the edge of the field, placed out in the meadow and projected,
  // so they stand in a line going away rather than in a row across a picture.
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + 0.3
    const away = 38 + ((i * 7) % 5) * 6
    const foot = see(lens, Math.cos(angle) * away, 0, Math.sin(angle) * away)
    if (foot.d < 2) continue
    const high = 6 + ((i * 3) % 4)
    const tall = see(lens, Math.cos(angle) * away, high, Math.sin(angle) * away)
    const high_px = foot.sy - tall.sy
    const wide = Math.abs(high_px) * 0.3
    // The trunk runs from the ground up to the lowest branches, worked out
    // from the same number the branches are placed with. Guessed at, it came
    // out as a brown block hanging in the air under each tree.
    ctx.fillStyle = '#4a3524'
    ctx.fillRect(foot.sx - wide * 0.1, foot.sy - high_px * 0.35, wide * 0.2, high_px * 0.35)
    // Two tiers, like the trees in the game, so they are pines rather than
    // triangles.
    for (const [tier, lift] of [0.35, 0.62].entries()) {
      const top = see(lens, Math.cos(angle) * away, high * (0.72 + tier * 0.28), Math.sin(angle) * away)
      ctx.fillStyle = tier === 0 ? '#2f5d33' : '#38703c'
      ctx.beginPath()
      ctx.moveTo(top.sx, top.sy)
      ctx.lineTo(foot.sx + wide * (1 - tier * 0.3), foot.sy - (foot.sy - tall.sy) * lift)
      ctx.lineTo(foot.sx - wide * (1 - tier * 0.3), foot.sy - (foot.sy - tall.sy) * lift)
      ctx.closePath()
      ctx.fill()
    }
  }
}

/** One balloon, where it would be on the screen if you were standing there. */
function balloon(
  ctx: Ctx, lens: Lens,
  at: { x: number; y: number; z: number }, tint: string, number: number, sway: number,
): void {
  const seen = see(lens, at.x, at.y, at.z)
  if (seen.d < 1) return
  const r = (lens.f * BALLOON_R) / seen.d
  if (r < 1.5) return
  const cx = seen.sx + Math.sin(sway) * r * 0.2
  const cy = seen.sy

  // The skin, lit from the sun's side.
  const skin = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.25)
  skin.addColorStop(0, '#ffffff')
  skin.addColorStop(0.35, tint)
  skin.addColorStop(1, shade(tint, 0.55))
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 1.18, 0, 0, Math.PI * 2)
  ctx.fill()

  // Knot and string, which is most of what makes it a balloon and not a ball.
  ctx.strokeStyle = 'rgba(235,240,245,0.75)'
  ctx.lineWidth = Math.max(1, r * 0.06)
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 1.18)
  ctx.quadraticCurveTo(cx + r * 0.35, cy + r * 1.8, cx - r * 0.1, cy + r * 2.4)
  ctx.stroke()

  const size = Math.max(8, r * 0.95)
  ctx.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, size * 0.24)
  ctx.strokeStyle = 'rgba(14,18,28,0.75)'
  ctx.strokeText(String(number), cx, cy)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(number), cx, cy)
}

/** A colour, darkened, for the shaded side of a balloon. */
function shade(ink: string, by: number): string {
  const n = parseInt(ink.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * by)
  const g = Math.round(((n >> 8) & 255) * by)
  const b = Math.round((n & 255) * by)
  return `rgb(${r},${g},${b})`
}

/** The bow, in the corner of your view, where the real one sits. */
function bow(ctx: Ctx, w: number, h: number, pull: number): void {
  /*
   * Down in the corner, framing the picture rather than filling it. Drawn at
   * the size a bow is in your hands, it covered the meadow it is supposed to
   * be shooting into and sent an arrow the length of the screen across the
   * sky.
   */
  const r = Math.min(w, h) * 0.4
  ctx.save()
  ctx.translate(w * 0.64, h * 1.16)
  ctx.rotate(-0.5)

  // The limbs.
  ctx.strokeStyle = '#6f4420'
  ctx.lineWidth = Math.max(3, r * 0.085)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, r, Math.PI * 1.13, Math.PI * 1.87)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,230,180,0.3)'
  ctx.lineWidth = Math.max(1, r * 0.03)
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.03, Math.PI * 1.15, Math.PI * 1.85)
  ctx.stroke()

  // The string, pulled back towards you by however much of a draw this is.
  const topX = Math.cos(Math.PI * 1.13) * r
  const topY = Math.sin(Math.PI * 1.13) * r
  const lowX = Math.cos(Math.PI * 1.87) * r
  const lowY = Math.sin(Math.PI * 1.87) * r
  const nock = -r * (0.08 + pull * 0.3)
  ctx.strokeStyle = '#f2ead4'
  ctx.lineWidth = Math.max(1, r * 0.02)
  ctx.beginPath()
  ctx.moveTo(topX, topY)
  ctx.lineTo(0, nock)
  ctx.lineTo(lowX, lowY)
  ctx.stroke()

  // And the arrow on it, which slides back with the string.
  ctx.strokeStyle = '#caa469'
  ctx.lineWidth = Math.max(2, r * 0.042)
  ctx.beginPath()
  ctx.moveTo(0, nock)
  ctx.lineTo(0, nock - r * 1.05)
  ctx.stroke()
  ctx.fillStyle = '#d8dde4'
  ctx.beginPath()
  ctx.moveTo(0, nock - r * 1.2)
  ctx.lineTo(r * 0.045, nock - r * 1.02)
  ctx.lineTo(-r * 0.045, nock - r * 1.02)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// --- the tile ----------------------------------------------------------------

/**
 * The front screen's thumbnail: the meadow, three balloons and the bow.
 *
 * Tipped up a little, because the game is played looking up — a tile of the
 * horizon would be a tile of a field.
 */
export function drawMeadow(ctx: Ctx, w: number, h: number, clock: number): void {
  /*
   * A long lens, because a tile is a wide strip two fingers high: at the sixty
   * degrees the game is played at, the balloons in it come out three pixels
   * across and the whole thing is a picture of a hedge.
   */
  const lens = lensFor(w, h, 0, 0.16, 30)
  backdrop(ctx, lens)

  const ones = [
    { x: -3.4, y: 5.6, z: -16, tint: TINTS.wanted[0], n: 8 },
    { x: 4.6, y: 7.4, z: -20, tint: TINTS.other[0], n: 5 },
    { x: 0.9, y: 3.4, z: -12, tint: TINTS.wanted[2], n: 12 },
  ]
  for (const one of ones) {
    balloon(ctx, lens, { ...one, y: one.y + Math.sin(clock * 0.9 + one.n) * 0.2 }, one.tint, one.n, clock + one.n)
  }

  bow(ctx, w, h, 0.65)
}

// --- the cutscene ------------------------------------------------------------

/** A shot, flown properly: the arrow arcs up and comes down on the balloon. */
export interface Shot {
  path: { x: number; y: number; z: number }[]
  seconds: number
  target: { x: number; y: number; z: number }
  /** How near it came to the middle of the balloon, at its nearest. */
  miss: number
}

/**
 * One shot at a balloon, worked out rather than drawn.
 *
 * The aim comes from the game's `aimFor`, the speed from the game's
 * `arrowSpeed`, and the flight from the game's gravity, stepped the way the
 * game steps it. If any of those three changed and this picture stopped
 * landing, the cutscene would be showing a lie — so `emblem.test.ts` flies it
 * and checks that it arrives, which is the point of flying it at all instead
 * of painting a curve that looks about right.
 */
export function flyAt(target: { x: number; y: number; z: number }, draw = 1): Shot {
  const away = Math.hypot(target.x, target.z)
  const speed = arrowSpeed(draw)
  const pitch = aimFor(away, target.y - EYE, speed) ?? 0.4
  const yaw = Math.atan2(target.x, -target.z)
  const look = facing(yaw, pitch)

  const path: { x: number; y: number; z: number }[] = []
  let x = 0
  let y = EYE
  let z = 0
  let vx = look.x * speed
  let vy = look.y * speed
  let vz = look.z * speed
  const slice = 1 / 120
  let seconds = 0
  let miss = Infinity

  for (let i = 0; i < 600; i++) {
    path.push({ x, y, z })
    vy -= GRAVITY * slice
    x += vx * slice
    y += vy * slice
    z += vz * slice
    seconds += slice
    miss = Math.min(miss, Math.hypot(x - target.x, y - target.y, z - target.z))
    if (miss <= BALLOON_R + ARROW_R) break
    if (y < 0) break
  }
  // The point it actually reached, not the one before it. Without this the
  // path stops a frame short and every shot looks like a near miss.
  path.push({ x, y, z })

  return { path, seconds, target, miss }
}

/** The arrow partway along its flight, with the trail it has left behind it. */
function arrowAt(ctx: Ctx, lens: Lens, shot: Shot, through: number): void {
  const last = Math.min(shot.path.length - 1, Math.floor(through * (shot.path.length - 1)))

  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i <= last; i += 3) {
    const seen = see(lens, shot.path[i].x, shot.path[i].y, shot.path[i].z)
    if (i === 0) ctx.moveTo(seen.sx, seen.sy)
    else ctx.lineTo(seen.sx, seen.sy)
  }
  ctx.stroke()

  const now = shot.path[last]
  const before = shot.path[Math.max(0, last - 2)]
  const head = see(lens, now.x, now.y, now.z)
  const tail = see(lens, before.x, before.y, before.z)
  const long = Math.max(8, Math.hypot(head.sx - tail.sx, head.sy - tail.sy) * 4)
  const angle = Math.atan2(head.sy - tail.sy, head.sx - tail.sx)

  ctx.save()
  ctx.translate(head.sx, head.sy)
  ctx.rotate(angle)
  ctx.strokeStyle = '#caa469'
  ctx.lineWidth = Math.max(2, long * 0.06)
  ctx.beginPath()
  ctx.moveTo(-long, 0)
  ctx.lineTo(0, 0)
  ctx.stroke()
  ctx.fillStyle = '#e4e9f0'
  ctx.beginPath()
  ctx.moveTo(long * 0.14, 0)
  ctx.lineTo(-long * 0.05, long * 0.07)
  ctx.lineTo(-long * 0.05, -long * 0.07)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** A balloon coming apart, for the frame after the arrow lands. */
function burst(ctx: Ctx, lens: Lens, at: { x: number; y: number; z: number }, tint: string, through: number): void {
  const seen = see(lens, at.x, at.y, at.z)
  const r = (lens.f * BALLOON_R) / Math.max(1, seen.d)
  ctx.save()
  ctx.globalAlpha = Math.max(0, 1 - through)
  ctx.fillStyle = tint
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const out = r * (0.6 + through * 3.2)
    const bit = r * 0.3 * (1 - through * 0.6)
    ctx.beginPath()
    ctx.ellipse(seen.sx + Math.cos(a) * out, seen.sy + Math.sin(a) * out - through * r, bit, bit * 0.7, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The cutscene: a round of the meadow, a turn of the head, and one shot.
 *
 * The camera swings round the way the game makes you swing round, the bow comes
 * to full draw, and the arrow goes up over the balloon and comes down on it.
 * Everything a first shot needs to know is in those three seconds.
 */
export function drawFlight(ctx: Ctx, w: number, h: number, t: number, clock: number): void {
  // The head turn: most of the way through the beat, then held.
  // A slow look around, but a small one: swung half a radian the camera spent
  // most of the beat pointed at a patch of sky with nothing in it.
  const turn = Math.sin(clock * 0.3) * 0.16
  const lens = lensFor(w, h, turn, 0.2)
  backdrop(ctx, lens)

  const target = { x: 6, y: 9.5, z: -19 }
  const shot = flyAt(target)
  /*
   * One shot per beat, off the beat's own clock rather than a loop of its own:
   * that way the cutscene can be scrubbed or paused and shows the same thing at
   * the same moment, which is the rule every scene in here follows.
   */
  const loop = t
  const pull = Math.min(1, loop / 0.4)
  const flying = loop > 0.45 ? Math.min(1, (loop - 0.45) / 0.22) : 0
  const gone = loop > 0.67

  const others = [
    { x: -7, y: 6 + Math.sin(clock * 0.8) * 0.3, z: -14, tint: TINTS.other[1], n: 7 },
    { x: -2.5, y: 11.5, z: -17, tint: TINTS.wanted[1], n: 20 },
    { x: 2, y: 3.4 + (clock * 0.2) % 6, z: -11, tint: TINTS.other[2], n: 3 },
  ]
  for (const one of others) balloon(ctx, lens, one, one.tint, one.n, clock + one.n)

  if (!gone) balloon(ctx, lens, target, TINTS.wanted[0], 14, clock)
  else burst(ctx, lens, target, TINTS.wanted[0], (loop - 0.67) / 0.33)

  if (flying > 0 && !gone) arrowAt(ctx, lens, shot, flying)

  bow(ctx, w, h, gone ? 0 : pull)
  void NEAR
  void FAR
}

/**
 * The other half of the lesson: one you wanted, going up over the trees.
 *
 * A game where nothing is ever lost does not need you, so the story has to
 * show the loss once. This is the same meadow with the camera looking the
 * wrong way, and the one with the right number on it climbing out of the
 * picture behind you.
 */
export function drawEscape(ctx: Ctx, w: number, h: number, t: number, clock: number): void {
  const lens = lensFor(w, h, 0.25, 0.46)
  backdrop(ctx, lens)

  const climb = 5 + t * 15
  for (const one of [
    { x: -7, y: 7, z: -17, tint: TINTS.other[0], n: 9 },
    { x: 9, y: 5.5, z: -15, tint: TINTS.other[2], n: 1 },
  ]) {
    balloon(ctx, lens, one, one.tint, one.n, clock + one.n)
  }

  balloon(ctx, lens, { x: 2, y: climb, z: -15 }, TINTS.wanted[0], 16, clock)
  bow(ctx, w, h, 0)
}
