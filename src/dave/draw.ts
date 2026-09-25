/**
 * Drawing Dave's world.
 *
 * A flat canvas rather than the three.js the maze uses, because this is a flat
 * tile game and a 2D context is the right tool for one: crisp edges, no camera
 * arithmetic, and a brick is a handful of calls rather than a mesh.
 *
 * Everything is drawn from shapes rather than from pictures, so it stays sharp
 * at whatever size the board lands on and the whole game stays a few kilobytes
 * of text.
 *
 * The palette is EGA's sixteen. That constraint is most of what makes the
 * original look like itself — the blue of the bricks and the cyan of the
 * diamonds are not tasteful choices, they are the only choices, and anything
 * more sophisticated would look like a tribute rather than the thing.
 */
import { drawHint } from '../ui/padHints'
import { TILE, type Level, type Theme } from './level'
import type { Bullet, Monster } from './game'
import type { Dave } from './physics'
import { BODY_W } from './physics'

export const EGA = {
  black: '#000000',
  blue: '#0000aa',
  brightBlue: '#5555ff',
  green: '#00aa00',
  brightGreen: '#55ff55',
  cyan: '#00aaaa',
  brightCyan: '#55ffff',
  red: '#aa0000',
  brightRed: '#ff5555',
  magenta: '#aa00aa',
  brightMagenta: '#ff55ff',
  brown: '#aa5500',
  yellow: '#ffff55',
  grey: '#555555',
  silver: '#aaaaaa',
  white: '#ffffff',
} as const

/** The brick colours a level can be built from. */
export const BRICK: Record<string, { base: string; mortar: string; lit: string }> = {
  red: { base: EGA.red, mortar: '#6b0000', lit: EGA.brightRed },
  blue: { base: EGA.blue, mortar: '#000066', lit: EGA.brightBlue },
  purple: { base: EGA.magenta, mortar: '#660066', lit: EGA.brightMagenta },
  brown: { base: EGA.brown, mortar: '#663300', lit: EGA.yellow },
  green: { base: EGA.green, mortar: '#005500', lit: EGA.brightGreen },
}

export const DEFAULT_THEME: Theme = { frame: 'red', platform: 'red' }

export interface View {
  /** Leftmost tile shown, in tiles; may be fractional while scrolling. */
  camera: number
  /** Pixels per tile. */
  size: number
  /** Seconds since the level began, for anything that moves on its own. */
  clock: number
}

type Ctx = CanvasRenderingContext2D

const px = (view: View, tile: number) => (tile - view.camera) * view.size

/** The star field. Fixed to the world, so it scrolls with everything else. */
export function drawSky(ctx: Ctx, view: View, width: number, height: number): void {
  ctx.fillStyle = EGA.black
  ctx.fillRect(0, 0, width, height)

  // A repeatable scatter: the same stars in the same places every time, out of
  // arithmetic rather than out of a stored list.
  ctx.fillStyle = EGA.silver
  const first = Math.floor(view.camera) - 1
  for (let t = first; t < first + width / view.size + 3; t++) {
    for (let n = 0; n < 2; n++) {
      const seed = (t * 73 + n * 131) % 997
      const sx = px(view, t + (seed % 100) / 100)
      const sy = (((seed * 7) % 1000) / 1000) * height
      ctx.globalAlpha = (seed + Math.floor(view.clock * 2)) % 11 === 0 ? 0.9 : 0.3
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2)
    }
  }
  ctx.globalAlpha = 1
}

/**
 * A brick.
 *
 * Two courses, offset, with mortar between them, a lit edge along the top and
 * left of each brick, and a scatter of white specks. The specks are what stop
 * a wall of these reading as wallpaper — they are the thing the eye picks up
 * as texture, and without them the whole level looks printed rather than built.
 */
function brick(ctx: Ctx, x: number, y: number, s: number, kind: string, seed: number): void {
  const paint = BRICK[kind] ?? BRICK.red
  ctx.fillStyle = paint.mortar
  ctx.fillRect(x, y, s, s)

  const h = s / 2
  const line = Math.max(1, Math.round(s / 16))
  ctx.fillStyle = paint.base
  // Top course: one whole brick. Bottom course: two halves, offset.
  ctx.fillRect(x + line, y + line, s - line * 2, h - line * 2)
  ctx.fillRect(x + line, y + h + line, h - line * 1.5, h - line * 2)
  ctx.fillRect(x + h + line * 0.5, y + h + line, h - line * 1.5, h - line * 2)

  ctx.fillStyle = paint.lit
  ctx.fillRect(x + line, y + line, s - line * 2, line)
  ctx.fillRect(x + line, y + h + line, h - line * 1.5, line)
  ctx.fillRect(x + h + line * 0.5, y + h + line, h - line * 1.5, line)

  ctx.fillStyle = EGA.white
  for (let i = 0; i < 3; i++) {
    const n = (seed * 31 + i * 17) % 101
    const dx = ((n % 10) / 10) * (s - line * 2) + line
    const dy = (((n * 7) % 10) / 10) * (s - line * 2) + line
    ctx.fillRect(x + dx, y + dy, line, line)
  }
}

function fire(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  ctx.fillStyle = EGA.black
  ctx.fillRect(x, y, s, s)
  for (let i = 0; i < 4; i++) {
    const wobble = Math.sin(clock * 9 + seed + i * 1.7) * 0.5 + 0.5
    const h = s * (0.45 + wobble * 0.45)
    ctx.fillStyle = EGA.red
    ctx.fillRect(x + (i * s) / 4, y + s - h, s / 4 - 1, h)
    ctx.fillStyle = EGA.brightRed
    ctx.fillRect(x + (i * s) / 4 + s / 16, y + s - h * 0.7, s / 4 - s / 8, h * 0.7)
  }
  ctx.fillStyle = EGA.yellow
  for (let i = 0; i < 3; i++) {
    const wobble = Math.sin(clock * 11 + seed + i * 2.3) * 0.5 + 0.5
    const h = s * 0.34 * wobble
    ctx.fillRect(x + s * 0.16 + (i * s) / 3.3, y + s - h, s / 8, h)
  }
}

function water(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  ctx.fillStyle = EGA.blue
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = EGA.brightBlue
  ctx.fillRect(x, y, s, s * 0.18)
  ctx.fillStyle = EGA.white
  const line = Math.max(1, Math.round(s / 14))
  const crest = Math.sin(clock * 3.5 + seed) * s * 0.06
  ctx.fillRect(x, y + s * 0.06 + crest, s, line)
  ctx.fillStyle = EGA.brightCyan
  for (let i = 0; i < 2; i++) {
    const lift = Math.sin(clock * 2.6 + seed + i * 2) * s * 0.07
    ctx.fillRect(x + (i * s) / 2, y + s * 0.45 + lift, s / 2 - 2, line)
  }
}

function tentacle(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  const sway = Math.sin(clock * 2.5 + seed) * s * 0.18
  const w = s * 0.34
  ctx.fillStyle = EGA.magenta
  ctx.fillRect(x + s / 2 - w / 2, y, w, s * 0.55)
  ctx.fillRect(x + s / 2 - w / 2 + sway, y + s * 0.45, w, s * 0.55)
  ctx.fillStyle = EGA.brightMagenta
  ctx.fillRect(x + s / 2 - w / 4 + sway, y + s * 0.6, w / 2, s * 0.3)
}

/** A rhombus, which is what a diamond is once you take the sparkle off. */
function facet(ctx: Ctx, cx: number, cy: number, w: number, h: number, colour: string, lit: string): void {
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(cx, cy - h / 2)
  ctx.lineTo(cx + w / 2, cy)
  ctx.lineTo(cx, cy + h / 2)
  ctx.lineTo(cx - w / 2, cy)
  ctx.closePath()
  ctx.fill()

  // One lit face, top left, which is what makes it read as cut rather than flat.
  ctx.fillStyle = lit
  ctx.beginPath()
  ctx.moveTo(cx, cy - h / 2)
  ctx.lineTo(cx, cy)
  ctx.lineTo(cx - w / 2, cy)
  ctx.closePath()
  ctx.fill()
}

function trophy(ctx: Ctx, x: number, y: number, s: number, clock: number): void {
  const glow = 0.7 + 0.3 * Math.sin(clock * 5)
  ctx.globalAlpha = glow
  ctx.fillStyle = EGA.yellow
  // Bowl, handles, stem, foot.
  ctx.fillRect(x + s * 0.26, y + s * 0.14, s * 0.48, s * 0.34)
  ctx.fillRect(x + s * 0.32, y + s * 0.46, s * 0.36, s * 0.08)
  ctx.fillRect(x + s * 0.14, y + s * 0.18, s * 0.1, s * 0.22)
  ctx.fillRect(x + s * 0.76, y + s * 0.18, s * 0.1, s * 0.22)
  ctx.fillRect(x + s * 0.44, y + s * 0.52, s * 0.12, s * 0.22)
  ctx.fillRect(x + s * 0.26, y + s * 0.74, s * 0.48, s * 0.12)
  ctx.fillStyle = EGA.brown
  ctx.fillRect(x + s * 0.32, y + s * 0.18, s * 0.08, s * 0.24)
  ctx.globalAlpha = 1
}

function door(ctx: Ctx, x: number, y: number, s: number, open: boolean): void {
  ctx.fillStyle = open ? EGA.brightGreen : EGA.brown
  ctx.fillRect(x + s * 0.14, y + s * 0.04, s * 0.72, s * 0.96)
  ctx.fillStyle = open ? EGA.green : '#663300'
  const plank = Math.max(1, Math.round(s / 14))
  for (let i = 1; i < 5; i++) {
    ctx.fillRect(x + s * 0.14, y + s * 0.04 + (i * s * 0.96) / 5, s * 0.72, plank)
  }
  ctx.fillStyle = EGA.yellow
  ctx.fillRect(x + s * 0.68, y + s * 0.46, s * 0.1, s * 0.1)
}

function jetpackTile(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = EGA.silver
  ctx.fillRect(x + s * 0.26, y + s * 0.18, s * 0.48, s * 0.5)
  ctx.fillStyle = EGA.grey
  ctx.fillRect(x + s * 0.32, y + s * 0.26, s * 0.36, s * 0.12)
  ctx.fillRect(x + s * 0.32, y + s * 0.44, s * 0.36, s * 0.1)
  ctx.fillStyle = EGA.brightRed
  ctx.fillRect(x + s * 0.32, y + s * 0.7, s * 0.14, s * 0.22)
  ctx.fillRect(x + s * 0.56, y + s * 0.7, s * 0.14, s * 0.22)
  ctx.fillStyle = EGA.yellow
  ctx.fillRect(x + s * 0.35, y + s * 0.82, s * 0.08, s * 0.12)
  ctx.fillRect(x + s * 0.59, y + s * 0.82, s * 0.08, s * 0.12)
}

function gunTile(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = EGA.silver
  ctx.fillRect(x + s * 0.14, y + s * 0.36, s * 0.7, s * 0.18)
  ctx.fillStyle = EGA.grey
  ctx.fillRect(x + s * 0.26, y + s * 0.52, s * 0.2, s * 0.3)
  ctx.fillRect(x + s * 0.14, y + s * 0.3, s * 0.24, s * 0.08)
}

/** The six pickups. Diamonds are the common one, and the crown is not. */
function loot(ctx: Ctx, tile: string, x: number, y: number, s: number, clock: number): void {
  const bob = Math.sin(clock * 3.5 + x * 0.7) * s * 0.05
  const cx = x + s / 2
  const cy = y + s / 2 + bob

  switch (tile) {
    case TILE.DIAMOND:
      facet(ctx, cx, cy, s * 0.6, s * 0.78, EGA.cyan, EGA.brightCyan)
      ctx.fillStyle = EGA.white
      ctx.fillRect(cx - s * 0.16, cy - s * 0.18, s * 0.08, s * 0.08)
      break
    case TILE.RUBY:
      facet(ctx, cx, cy, s * 0.58, s * 0.72, EGA.red, EGA.brightRed)
      ctx.fillStyle = EGA.white
      ctx.fillRect(cx - s * 0.14, cy - s * 0.16, s * 0.07, s * 0.07)
      break
    case TILE.GEM:
      facet(ctx, cx, cy, s * 0.44, s * 0.54, EGA.magenta, EGA.brightMagenta)
      break
    case TILE.SPHERE: {
      ctx.fillStyle = EGA.magenta
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = EGA.brightMagenta
      ctx.beginPath()
      ctx.arc(cx - s * 0.08, cy - s * 0.08, s * 0.12, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case TILE.RING: {
      ctx.strokeStyle = EGA.yellow
      ctx.lineWidth = Math.max(2, s * 0.11)
      ctx.beginPath()
      ctx.arc(cx, cy + s * 0.06, s * 0.24, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = EGA.brightCyan
      ctx.fillRect(cx - s * 0.07, cy - s * 0.34, s * 0.14, s * 0.14)
      break
    }
    case TILE.CROWN: {
      ctx.fillStyle = EGA.yellow
      ctx.fillRect(cx - s * 0.3, cy + s * 0.08, s * 0.6, s * 0.18)
      // Three points, with the middle one taller.
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.3, cy + s * 0.1)
      ctx.lineTo(cx - s * 0.22, cy - s * 0.22)
      ctx.lineTo(cx - s * 0.1, cy + s * 0.02)
      ctx.lineTo(cx, cy - s * 0.32)
      ctx.lineTo(cx + s * 0.1, cy + s * 0.02)
      ctx.lineTo(cx + s * 0.22, cy - s * 0.22)
      ctx.lineTo(cx + s * 0.3, cy + s * 0.1)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = EGA.brightRed
      ctx.fillRect(cx - s * 0.05, cy + s * 0.11, s * 0.1, s * 0.1)
      break
    }
  }
}

/** Everything in the level that is made of tiles. */
export function drawLevel(
  ctx: Ctx,
  level: Level,
  view: View,
  taken: Set<string>,
  hasTrophy: boolean,
  width: number,
): void {
  const theme = level.theme ?? DEFAULT_THEME
  const floorRow = level.rows.length - 1
  const first = Math.max(0, Math.floor(view.camera) - 1)
  const last = Math.min(level.rows[0].length - 1, first + Math.ceil(width / view.size) + 2)

  for (let y = 0; y < level.rows.length; y++) {
    for (let x = first; x <= last; x++) {
      const tile = level.rows[y][x]
      if (tile === TILE.EMPTY) continue
      if (taken.has(`${x},${y}`)) continue

      const sx = px(view, x)
      const sy = y * view.size
      const s = view.size
      const seed = x * 3 + y * 7

      switch (tile) {
        case TILE.BRICK:
          // The ground the room stands on is the frame's colour; the ledges
          // inside it are their own. That contrast is half of what makes each
          // level look like a different place.
          brick(ctx, sx, sy, s, y >= floorRow ? theme.frame : theme.platform, seed)
          break
        case TILE.FIRE: fire(ctx, sx, sy, s, view.clock, seed); break
        case TILE.WATER: water(ctx, sx, sy, s, view.clock, seed); break
        case TILE.TENTACLE: tentacle(ctx, sx, sy, s, view.clock, seed); break
        case TILE.TROPHY: trophy(ctx, sx, sy, s, view.clock); break
        case TILE.DOOR: door(ctx, sx, sy, s, hasTrophy); break
        case TILE.JETPACK: jetpackTile(ctx, sx, sy, s); break
        case TILE.GUN: gunTile(ctx, sx, sy, s); break
        default: loot(ctx, tile, sx, sy, s, view.clock)
      }
    }
  }
}

/**
 * The brick frame around the room.
 *
 * Drawn over the board rather than built into it, so the shape of a level and
 * the look of a level stay separate things. Every screenful in the original is
 * framed, and without it the play area has no edges — it just stops.
 */
export function drawFrame(
  ctx: Ctx,
  level: Level,
  view: View,
  width: number,
  height: number,
): void {
  const theme = level.theme ?? DEFAULT_THEME
  const s = view.size
  const thick = s

  for (let x = -1; x < width / s + 1; x++) {
    brick(ctx, x * s, 0, s, theme.frame, x * 5 + 1)
  }
  for (let y = 0; y < height / s + 1; y++) {
    brick(ctx, 0, y * s, s, theme.frame, y * 11 + 3)
    brick(ctx, width - thick, y * s, s, theme.frame, y * 13 + 7)
  }
}

/** Dave: red cap, pale face, red shirt, blue trousers. */
export function drawDave(ctx: Ctx, dave: Dave, view: View): void {
  const s = view.size
  const w = BODY_W * s * 1.15
  const h = s * 1.12
  const x = px(view, dave.x) - w / 2
  const y = dave.y * s - h

  if (dave.flying) {
    const flicker = 0.5 + Math.abs(Math.sin(view.clock * 30)) * 0.6
    ctx.fillStyle = EGA.brightRed
    ctx.fillRect(x + w * 0.2, y + h, w * 0.24, h * 0.3 * flicker)
    ctx.fillStyle = EGA.yellow
    ctx.fillRect(x + w * 0.56, y + h, w * 0.24, h * 0.22 * flicker)
  }

  // Legs, striding when he moves, together when he does not.
  const striding = dave.onGround && Math.abs(dave.vx) > 0.1
  const swing = striding ? Math.sin(view.clock * 14) * w * 0.16 : 0
  ctx.fillStyle = EGA.blue
  ctx.fillRect(x + w * 0.16 + swing, y + h * 0.62, w * 0.28, h * 0.3)
  ctx.fillRect(x + w * 0.56 - swing, y + h * 0.62, w * 0.28, h * 0.3)
  ctx.fillStyle = EGA.grey
  ctx.fillRect(x + w * 0.12 + swing, y + h * 0.9, w * 0.34, h * 0.1)
  ctx.fillRect(x + w * 0.54 - swing, y + h * 0.9, w * 0.34, h * 0.1)

  // Shirt, with a white flash across it, and bare arms.
  ctx.fillStyle = EGA.brightRed
  ctx.fillRect(x + w * 0.12, y + h * 0.36, w * 0.76, h * 0.28)
  ctx.fillStyle = EGA.white
  ctx.fillRect(x + w * 0.12, y + h * 0.5, w * 0.76, h * 0.07)
  ctx.fillStyle = '#ffccaa'
  const armFront = dave.facing > 0 ? x + w * 0.82 : x - w * 0.06
  ctx.fillRect(armFront, y + h * 0.4, w * 0.24, h * 0.2)

  // Face and cap.
  ctx.fillStyle = '#ffccaa'
  ctx.fillRect(x + w * 0.24, y + h * 0.14, w * 0.52, h * 0.24)
  ctx.fillStyle = EGA.black
  const eye = dave.facing > 0 ? 0.56 : 0.3
  ctx.fillRect(x + w * eye, y + h * 0.2, w * 0.12, h * 0.06)
  ctx.fillStyle = EGA.red
  ctx.fillRect(x + w * 0.18, y + h * 0.02, w * 0.64, h * 0.14)
  ctx.fillRect(dave.facing > 0 ? x + w * 0.7 : x + w * 0.02, y + h * 0.12, w * 0.28, h * 0.05)

  if (dave.hasJetpack) {
    ctx.fillStyle = EGA.silver
    const back = dave.facing > 0 ? x - w * 0.02 : x + w * 0.8
    ctx.fillRect(back, y + h * 0.36, w * 0.22, h * 0.3)
  }
}

export function drawMonster(ctx: Ctx, monster: Monster, view: View): void {
  if (!monster.alive) return
  const s = view.size
  const x = px(view, monster.x) - s * 0.45
  const y = monster.y * s - s * 0.45
  const wobble = Math.sin(view.clock * 6 + monster.spec.phase * 9) * s * 0.06

  if (monster.spec.kind === 'spider') {
    ctx.fillStyle = EGA.magenta
    ctx.fillRect(x + s * 0.18, y + s * 0.24, s * 0.54, s * 0.42)
    ctx.fillStyle = EGA.brightMagenta
    for (let i = 0; i < 4; i++) {
      const legY = y + s * 0.26 + (i % 2) * s * 0.24
      ctx.fillRect(x + (i < 2 ? -s * 0.06 : s * 0.72), legY + wobble, s * 0.26, s * 0.1)
    }
  } else if (monster.spec.kind === 'orb') {
    ctx.fillStyle = EGA.brightGreen
    ctx.beginPath()
    ctx.arc(x + s * 0.45, y + s * 0.45 + wobble, s * 0.34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = EGA.green
    ctx.beginPath()
    ctx.arc(x + s * 0.45, y + s * 0.45 + wobble, s * 0.17, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = EGA.brightCyan
    ctx.fillRect(x - s * 0.04, y + s * 0.38 + wobble, s * 0.98, s * 0.18)
    ctx.fillStyle = EGA.cyan
    ctx.fillRect(x + s * 0.22, y + s * 0.16 + wobble, s * 0.46, s * 0.24)
  }

  ctx.fillStyle = EGA.white
  ctx.fillRect(x + s * 0.26, y + s * 0.32 + wobble, s * 0.12, s * 0.12)
  ctx.fillRect(x + s * 0.54, y + s * 0.32 + wobble, s * 0.12, s * 0.12)
  ctx.fillStyle = EGA.black
  ctx.fillRect(x + s * 0.3, y + s * 0.35 + wobble, s * 0.05, s * 0.05)
  ctx.fillRect(x + s * 0.58, y + s * 0.35 + wobble, s * 0.05, s * 0.05)
}

export function drawBullet(ctx: Ctx, bullet: Bullet, view: View): void {
  const s = view.size
  const cx = px(view, bullet.x)
  const cy = bullet.y * s
  ctx.fillStyle = bullet.mine ? EGA.brightGreen : EGA.brightRed
  ctx.beginPath()
  ctx.ellipse(cx, cy, s * 0.2, s * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = bullet.mine ? EGA.white : EGA.yellow
  ctx.fillRect(cx - s * 0.04, cy - s * 0.04, s * 0.08, s * 0.08)
}

/** A little Dave, for the lives row in the score bar. */
export function drawLifeIcon(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = '#ffccaa'
  ctx.fillRect(x + s * 0.2, y + s * 0.3, s * 0.6, s * 0.5)
  ctx.fillStyle = EGA.black
  ctx.fillRect(x + s * 0.33, y + s * 0.45, s * 0.1, s * 0.1)
  ctx.fillRect(x + s * 0.57, y + s * 0.45, s * 0.1, s * 0.1)
  ctx.fillRect(x + s * 0.38, y + s * 0.64, s * 0.24, s * 0.07)
  ctx.fillStyle = EGA.red
  ctx.fillRect(x + s * 0.14, y + s * 0.12, s * 0.72, s * 0.2)
  ctx.fillRect(x + s * 0.06, y + s * 0.28, s * 0.88, s * 0.07)
}

/**
 * The buttons, drawn where they are.
 *
 * Translucent, because they sit over the room and the room is the thing you
 * are looking at; solid enough to find without hunting. A pressed one lights
 * up, which is the only feedback a sheet of glass can give you.
 */
export function drawPad(
  ctx: Ctx,
  keys: { id: string; cx: number; cy: number; r: number }[],
  pressed: Record<string, boolean>,
  hints?: { alpha: number; labels: Record<string, string> },
): void {
  for (const key of keys) {
    const down = pressed[key.id]
    ctx.globalAlpha = down ? 0.78 : 0.4

    ctx.fillStyle = EGA.black
    ctx.beginPath()
    ctx.arc(key.cx, key.cy, key.r, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = down ? EGA.yellow : EGA.silver
    ctx.lineWidth = Math.max(2, key.r * 0.1)
    ctx.stroke()

    ctx.fillStyle = down ? EGA.yellow : EGA.white
    const a = key.r * 0.42
    ctx.beginPath()
    if (key.id === 'fire') {
      ctx.arc(key.cx, key.cy, a * 0.7, 0, Math.PI * 2)
    } else {
      // A triangle pointing whichever way the button means.
      const turn = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[key.id] ?? 0
      for (let i = 0; i < 3; i++) {
        const angle = turn + (i * Math.PI * 2) / 3
        const px2 = key.cx + Math.cos(angle) * a
        const py2 = key.cy + Math.sin(angle) * a
        if (i === 0) ctx.moveTo(px2, py2)
        else ctx.lineTo(px2, py2)
      }
      ctx.closePath()
    }
    ctx.fill()
    ctx.globalAlpha = 1
  }

  /*
   * The labels, last, so no button is drawn over its own name. They sit above
   * the pad rather than inside the circles: a word small enough to fit inside
   * one of these is a word too small to read on a phone.
   */
  if (hints && hints.alpha > 0) {
    for (const key of keys) {
      const text = hints.labels[key.id]
      if (!text) continue
      drawHint(ctx, key.cx, key.cy - key.r * 1.45, text, Math.max(9, key.r * 0.3), hints.alpha)
    }
  }
}
