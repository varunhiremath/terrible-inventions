/**
 * The outpost, painted flat.
 *
 * The same job the meadow's painting does, for the same reason, and the reason
 * is worth repeating rather than apologising for: this game is drawn with
 * three.js, a front-screen tile is a thumbnail with ten others beside it, and
 * a cutscene has to draw in a terminal with no graphics card. Ten WebGL
 * contexts for ten thumbnails would cost more than the whole front screen.
 *
 * So this paints the same place with a brush — the same night, the same
 * concrete, the same red eye and the same green fuse numbers — and keeps the
 * one thing that has to be true: what it shows you is what is in there.
 */
import { CELL } from './level'

type Ctx = CanvasRenderingContext2D

interface Lens {
  w: number
  h: number
  f: number
  yaw: number
  pitch: number
}

const lensFor = (w: number, h: number, yaw: number, pitch: number, fov = 62): Lens => ({
  w, h, yaw, pitch,
  f: (h / 2) / Math.tan((fov * Math.PI) / 180 / 2),
})

const EYE = 1.62

/** Where a point in the compound lands on the screen. */
function see(lens: Lens, x: number, y: number, z: number): { sx: number; sy: number; d: number } {
  const cx = x * Math.cos(lens.yaw) - z * Math.sin(lens.yaw)
  const cz = x * Math.sin(lens.yaw) + z * Math.cos(lens.yaw)
  const ahead = -cz
  const up = y - EYE
  const d = ahead * Math.cos(lens.pitch) + up * Math.sin(lens.pitch)
  const u = up * Math.cos(lens.pitch) - ahead * Math.sin(lens.pitch)
  return {
    sx: lens.w / 2 + (lens.f * cx) / Math.max(0.3, d),
    sy: lens.h / 2 - (lens.f * u) / Math.max(0.3, d),
    d,
  }
}

const NIGHT_HIGH = '#0a1430'
const NIGHT_LOW = '#2a3d63'

/** The one deterministic wobble, so the same picture comes out every time. */
const wobble = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Sky, stars, the moon, the ground and the far wall: everything still. */
function backdrop(ctx: Ctx, lens: Lens): void {
  const { w, h } = lens
  const horizon = see(lens, 0, EYE, -400).sy

  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon))
  sky.addColorStop(0, NIGHT_HIGH)
  sky.addColorStop(1, NIGHT_LOW)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(223,232,255,0.85)'
  for (let i = 0; i < 90; i++) {
    const sx = wobble(i * 3) * w
    const sy = wobble(i * 5 + 1) * Math.max(0, horizon)
    ctx.fillRect(sx, sy, 1.4, 1.4)
  }

  // The moon, low and off to one side.
  const moon = see(lens, -90, 70, -140)
  const halo = ctx.createRadialGradient(moon.sx, moon.sy, 0, moon.sx, moon.sy, w * 0.3)
  halo.addColorStop(0, 'rgba(226,236,255,0.85)')
  halo.addColorStop(0.18, 'rgba(200,216,255,0.22)')
  halo.addColorStop(1, 'rgba(200,216,255,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, w, h)

  // The ground, darker as it comes towards you.
  const floor = ctx.createLinearGradient(0, horizon, 0, h)
  floor.addColorStop(0, '#2f3640')
  floor.addColorStop(0.4, '#262c35')
  floor.addColorStop(1, '#171c23')
  ctx.fillStyle = floor
  ctx.fillRect(0, horizon - 1, w, h - horizon + 1)

  // The compound wall across the back, with the pale coping along the top of
  // it that gives it a height.
  const far = 34
  const base = see(lens, 0, 0, -far)
  const top = see(lens, 0, 5.8, -far)
  ctx.fillStyle = '#39404e'
  ctx.fillRect(0, top.sy, w, Math.max(1, base.sy - top.sy))
  ctx.fillStyle = '#aeb7c6'
  ctx.fillRect(0, top.sy, w, Math.max(1.5, (base.sy - top.sy) * 0.055))
  // Panel joints, so it is a wall rather than a band of colour.
  ctx.strokeStyle = 'rgba(16,20,28,0.55)'
  ctx.lineWidth = 1.5
  for (let i = -6; i <= 6; i++) {
    const seam = see(lens, i * CELL * 1.6, 0, -far)
    ctx.beginPath()
    ctx.moveTo(seam.sx, top.sy)
    ctx.lineTo(seam.sx, base.sy)
    ctx.stroke()
  }
}

/** A soft pool of light on the ground, or a halo in the air. */
function glow(ctx: Ctx, x: number, y: number, r: number, ink: string, strength = 0.8): void {
  const soft = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r))
  soft.addColorStop(0, ink.replace('ALPHA', String(strength)))
  soft.addColorStop(0.35, ink.replace('ALPHA', String(strength * 0.35)))
  soft.addColorStop(1, ink.replace('ALPHA', '0'))
  ctx.fillStyle = soft
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** A number, the way the game writes them. */
function figure(ctx: Ctx, x: number, y: number, size: number, n: number, ink: string): void {
  ctx.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, size * 0.26)
  ctx.strokeStyle = 'rgba(6,10,20,0.9)'
  ctx.strokeText(String(n), x, y)
  ctx.fillStyle = ink
  ctx.fillText(String(n), x, y)
}

/** One of Papa's machines, stood in the yard with its number over it. */
function machine(
  ctx: Ctx, lens: Lens, at: { x: number; z: number }, n: number, hunting: boolean,
): void {
  const foot = see(lens, at.x, 0, at.z)
  const top = see(lens, at.x, 2.4, at.z)
  if (foot.d < 1.5) return
  const tall = foot.sy - top.sy
  const wide = tall * 0.42

  // Legs.
  ctx.strokeStyle = '#2c323c'
  ctx.lineWidth = Math.max(1.5, wide * 0.14)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(foot.sx + side * wide * 0.2, foot.sy)
    ctx.lineTo(foot.sx + side * wide * 0.28, foot.sy - tall * 0.45)
    ctx.stroke()
  }
  // Body.
  ctx.fillStyle = '#4d5563'
  ctx.fillRect(foot.sx - wide / 2, foot.sy - tall * 0.9, wide, tall * 0.45)
  // The fuse on its back.
  ctx.fillStyle = '#9af5c0'
  ctx.fillRect(foot.sx + wide * 0.3, foot.sy - tall * 0.72, wide * 0.22, tall * 0.12)
  // And the eye, which is the whole of its face.
  const eyeY = foot.sy - tall * 0.95
  const ink = hunting ? 'rgba(255,72,56,ALPHA)' : 'rgba(255,176,97,ALPHA)'
  glow(ctx, foot.sx, eyeY, wide * 1.5, ink, hunting ? 0.9 : 0.6)
  ctx.fillStyle = hunting ? '#ff6a52' : '#ffb061'
  ctx.beginPath()
  ctx.arc(foot.sx, eyeY, Math.max(2, wide * 0.3), 0, Math.PI * 2)
  ctx.fill()

  figure(ctx, foot.sx, foot.sy - tall * 1.3, Math.max(9, tall * 0.3), n, '#9af5c0')
}

/** The cage, lit from inside, with somebody in it. */
function cage(ctx: Ctx, lens: Lens, at: { x: number; z: number }, wants: number, open: boolean): void {
  const foot = see(lens, at.x, 0, at.z)
  const top = see(lens, at.x, 3, at.z)
  if (foot.d < 2) return
  const tall = foot.sy - top.sy
  const wide = tall * 0.9

  glow(ctx, foot.sx, foot.sy - tall * 0.5, wide * 1.6, 'rgba(255,216,154,ALPHA)', 0.55)
  ctx.fillStyle = '#39404e'
  ctx.fillRect(foot.sx - wide / 2, foot.sy - tall * 0.95, wide, tall * 0.95)
  ctx.fillStyle = 'rgba(255,216,154,0.3)'
  ctx.fillRect(foot.sx - wide * 0.42, foot.sy - tall * 0.85, wide * 0.84, tall * 0.8)
  if (!open) {
    ctx.strokeStyle = '#aab3c5'
    ctx.lineWidth = Math.max(1.2, wide * 0.045)
    for (let i = 0; i <= 6; i++) {
      const bx = foot.sx - wide * 0.42 + (i / 6) * wide * 0.84
      ctx.beginPath()
      ctx.moveTo(bx, foot.sy - tall * 0.9)
      ctx.lineTo(bx, foot.sy)
      ctx.stroke()
    }
  }
  // The roof, which is what makes it a building rather than a doorway.
  ctx.fillStyle = '#515a69'
  ctx.fillRect(foot.sx - wide * 0.56, foot.sy - tall * 1.02, wide * 1.12, tall * 0.1)
  figure(ctx, foot.sx, foot.sy - tall * 1.3, Math.max(10, tall * 0.34), wants, '#ffe9b0')
}

/** Her: a coat, a scarf and a face, because there is one person in here. */
function person(ctx: Ctx, lens: Lens, at: { x: number; z: number }): void {
  const foot = see(lens, at.x, 0, at.z)
  const top = see(lens, at.x, 1.7, at.z)
  if (foot.d < 1) return
  const tall = foot.sy - top.sy
  const wide = tall * 0.34
  glow(ctx, foot.sx, foot.sy - tall * 0.6, wide * 2.2, 'rgba(255,196,214,ALPHA)', 0.4)
  ctx.fillStyle = '#b65a7a'
  ctx.beginPath()
  ctx.ellipse(foot.sx, foot.sy - tall * 0.42, wide * 0.5, tall * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0e6d2'
  ctx.fillRect(foot.sx - wide * 0.3, foot.sy - tall * 0.82, wide * 0.6, tall * 0.07)
  ctx.fillStyle = '#e8c9a8'
  ctx.beginPath()
  ctx.arc(foot.sx, foot.sy - tall * 0.9, wide * 0.32, 0, Math.PI * 2)
  ctx.fill()
}

/** A lamp on a pole, and the pool it throws. */
function lamp(ctx: Ctx, lens: Lens, at: { x: number; z: number }): void {
  const foot = see(lens, at.x, 0, at.z)
  const head = see(lens, at.x, 6, at.z)
  if (foot.d < 2) return
  glow(ctx, foot.sx, foot.sy, Math.abs(foot.sy - head.sy) * 0.8, 'rgba(255,206,138,ALPHA)', 0.22)
  ctx.strokeStyle = '#2e333c'
  ctx.lineWidth = Math.max(1.2, Math.abs(foot.sy - head.sy) * 0.03)
  ctx.beginPath()
  ctx.moveTo(foot.sx, foot.sy)
  ctx.lineTo(head.sx, head.sy)
  ctx.stroke()
  glow(ctx, head.sx, head.sy, Math.abs(foot.sy - head.sy) * 0.35, 'rgba(255,206,138,ALPHA)', 0.85)
  ctx.fillStyle = '#ffd089'
  ctx.fillRect(head.sx - 3, head.sy - 2, 6, 4)
}

/** The rifle, in the corner of your view, where the real one sits. */
function rifle(ctx: Ctx, w: number, h: number, firing: boolean): void {
  const long = Math.min(w, h) * 0.62
  ctx.save()
  ctx.translate(w * 0.72, h * 1.04)
  ctx.rotate(-0.42)
  ctx.fillStyle = '#2f343d'
  ctx.fillRect(-long * 0.05, -long * 0.95, long * 0.1, long * 0.95)
  ctx.fillRect(-long * 0.1, -long * 0.3, long * 0.2, long * 0.3)
  ctx.fillStyle = '#4a3524'
  ctx.fillRect(-long * 0.09, -long * 0.08, long * 0.18, long * 0.24)
  if (firing) {
    ctx.restore()
    const muzzle = { x: w * 0.72 - Math.sin(-0.42) * long * 0.95, y: h * 1.04 - Math.cos(-0.42) * long * 0.95 }
    glow(ctx, muzzle.x, muzzle.y, long * 0.3, 'rgba(255,228,150,ALPHA)', 0.95)
    return
  }
  ctx.restore()
}

// --- the tile ----------------------------------------------------------------

/**
 * The front screen's thumbnail: the yard, a machine, the cage, the rifle.
 *
 * A long lens, because a tile is a wide strip two fingers high and at the
 * sixty degrees the game is played at everything in it would be a speck.
 */
export function drawCompound(ctx: Ctx, w: number, h: number, clock: number): void {
  const lens = lensFor(w, h, 0, 0.06, 34)
  backdrop(ctx, lens)
  lamp(ctx, lens, { x: -9, z: -22 })
  cage(ctx, lens, { x: 5.5, z: -19 }, 10, false)
  person(ctx, lens, { x: 5.5, z: -19.6 })
  machine(ctx, lens, { x: -3.4, z: -12 }, 7, true)
  machine(ctx, lens, { x: 9.5, z: -26 }, 4, false)
  // A fuse on the floor, glowing where something went down.
  const fuse = see(lens, -7, 0.5, -14)
  glow(ctx, fuse.sx, fuse.sy, Math.max(6, lens.f * 0.05), 'rgba(154,245,192,ALPHA)', 0.6)
  figure(ctx, fuse.sx, fuse.sy - 10, Math.max(8, h * 0.1), 6, '#d6ffe8')
  rifle(ctx, w, h, Math.sin(clock * 2.5) > 0.9)
}

// --- the cutscene -------------------------------------------------------------

/** The yard, with one of them coming at you and the cage lit up behind. */
export function drawYard(ctx: Ctx, w: number, h: number, t: number, clock: number): void {
  const swing = Math.sin(clock * 0.3) * 0.14
  const lens = lensFor(w, h, swing, 0.03)
  backdrop(ctx, lens)
  lamp(ctx, lens, { x: -11, z: -26 })
  cage(ctx, lens, { x: 7, z: -24 }, 10, false)
  person(ctx, lens, { x: 7, z: -24.6 })
  // One walking at you, which is the whole of the middle of a mission.
  const near = 16 - (t % 1) * 9
  machine(ctx, lens, { x: -2.5, z: -near }, 7, true)
  machine(ctx, lens, { x: 11, z: -30 }, 4, false)
  const fuse = see(lens, -8, 0.5, -15)
  glow(ctx, fuse.sx, fuse.sy, Math.max(6, lens.f * 0.05), 'rgba(154,245,192,ALPHA)', 0.6)
  figure(ctx, fuse.sx, fuse.sy - h * 0.05, Math.max(9, h * 0.07), 6, '#d6ffe8')
  rifle(ctx, w, h, (t * 6) % 1 > 0.72)
}

/** The other half: the cage open, her beside you, and the pad to get to. */
export function drawHomeward(ctx: Ctx, w: number, h: number, t: number, clock: number): void {
  const lens = lensFor(w, h, -0.1 + Math.sin(clock * 0.25) * 0.05, 0.02)
  backdrop(ctx, lens)
  lamp(ctx, lens, { x: 12, z: -26 })

  // The pad, ahead, with its ring and its beacon breathing.
  const pad = see(lens, -1.5, 0, -20 + t * 6)
  glow(ctx, pad.sx, pad.sy, Math.max(10, lens.f * 0.18), 'rgba(126,240,192,ALPHA)', 0.5)
  ctx.strokeStyle = 'rgba(126,240,192,0.85)'
  ctx.lineWidth = Math.max(1.5, lens.f * 0.006)
  ctx.beginPath()
  ctx.ellipse(pad.sx, pad.sy, Math.max(8, lens.f * 0.12), Math.max(3, lens.f * 0.045), 0, 0, Math.PI * 2)
  ctx.stroke()

  cage(ctx, lens, { x: 9, z: -27 }, 10, true)
  // Her, keeping up — nearer as the beat goes on, because that is the point
  // of the beat.
  person(ctx, lens, { x: 1.4 - t * 0.3, z: -5.5 + t * 1.6 })
  machine(ctx, lens, { x: -8, z: -24 }, 4, false)
  rifle(ctx, w, h, false)
}
