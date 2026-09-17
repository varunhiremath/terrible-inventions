/**
 * Drawing Dave's world.
 *
 * A flat canvas rather than the three.js the maze uses, because this is a flat
 * tile game and a 2D context is the right tool for one: crisp edges, no camera
 * arithmetic, and a brick is four calls rather than a mesh.
 *
 * Everything is drawn from shapes rather than from pictures, so it stays sharp
 * at whatever size the board ends up on a given screen, and so the whole game
 * stays a few kilobytes of text.
 *
 * The palette is EGA's sixteen. That constraint is most of what makes the
 * original look like itself — the blue of the bricks and the magenta of the
 * tentacles are not tasteful choices, they are the only choices, and picking
 * anything more sophisticated would make it look like a tribute rather than
 * the thing.
 */
import { TILE, type Level } from './level'
import type { Bullet, Monster } from './game'
import type { Dave } from './physics'
import { BODY_H, BODY_W } from './physics'

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

  ctx.fillStyle = EGA.silver
  // A repeatable scatter: the same stars in the same places every time, from
  // arithmetic rather than from a stored list.
  const first = Math.floor(view.camera) - 1
  for (let t = first; t < first + width / view.size + 3; t++) {
    for (let n = 0; n < 2; n++) {
      const seed = (t * 73 + n * 131) % 997
      const sx = px(view, t + ((seed % 100) / 100))
      const sy = ((seed * 7) % 1000) / 1000 * height
      const twinkle = (seed + Math.floor(view.clock * 2)) % 11 === 0
      ctx.globalAlpha = twinkle ? 0.9 : 0.35
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2)
    }
  }
  ctx.globalAlpha = 1
}

function brick(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = EGA.blue
  ctx.fillRect(x, y, s, s)
  // Mortar. Two courses per tile, offset, which is what makes it read as a
  // wall rather than as a blue square.
  ctx.fillStyle = EGA.brightBlue
  const line = Math.max(1, Math.round(s / 16))
  ctx.fillRect(x, y, s, line)
  ctx.fillRect(x, y + s / 2, s, line)
  ctx.fillRect(x + s / 2, y, line, s / 2)
  ctx.fillRect(x, y + s / 2, line, s / 2)
}

function fire(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  ctx.fillStyle = EGA.red
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = EGA.brightRed
  for (let i = 0; i < 4; i++) {
    const wobble = Math.sin(clock * 9 + seed + i * 1.7) * 0.5 + 0.5
    const h = s * (0.35 + wobble * 0.4)
    ctx.fillRect(x + (i * s) / 4, y + s - h, s / 4 - 1, h)
  }
  ctx.fillStyle = EGA.yellow
  for (let i = 0; i < 3; i++) {
    const wobble = Math.sin(clock * 11 + seed + i * 2.3) * 0.5 + 0.5
    ctx.fillRect(x + s * 0.15 + (i * s) / 3.4, y + s - s * 0.3 * wobble, s / 7, s * 0.3 * wobble)
  }
}

function water(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  ctx.fillStyle = EGA.blue
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = EGA.brightCyan
  const line = Math.max(1, Math.round(s / 14))
  for (let i = 0; i < 3; i++) {
    const lift = Math.sin(clock * 3 + seed + i) * s * 0.08
    ctx.fillRect(x + (i * s) / 3, y + s * 0.2 + lift, s / 3 - 1, line)
  }
  ctx.fillStyle = EGA.white
  const crest = Math.sin(clock * 4 + seed) * s * 0.1
  ctx.fillRect(x, y + s * 0.05 + crest, s, line)
}

function tentacle(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  ctx.fillStyle = EGA.magenta
  const sway = Math.sin(clock * 2.5 + seed) * s * 0.18
  const w = s * 0.34
  ctx.fillRect(x + s / 2 - w / 2, y, w, s * 0.55)
  ctx.fillRect(x + s / 2 - w / 2 + sway, y + s * 0.45, w, s * 0.55)
  ctx.fillStyle = EGA.brightMagenta
  ctx.fillRect(x + s / 2 - w / 4 + sway, y + s * 0.6, w / 2, s * 0.3)
}

function trophy(ctx: Ctx, x: number, y: number, s: number, clock: number): void {
  const glow = 0.6 + 0.4 * Math.sin(clock * 5)
  ctx.globalAlpha = glow
  ctx.fillStyle = EGA.yellow
  ctx.fillRect(x + s * 0.25, y + s * 0.15, s * 0.5, s * 0.4)
  ctx.fillRect(x + s * 0.15, y + s * 0.2, s * 0.12, s * 0.2)
  ctx.fillRect(x + s * 0.73, y + s * 0.2, s * 0.12, s * 0.2)
  ctx.fillRect(x + s * 0.42, y + s * 0.55, s * 0.16, s * 0.2)
  ctx.fillRect(x + s * 0.25, y + s * 0.75, s * 0.5, s * 0.14)
  ctx.globalAlpha = 1
}

function door(ctx: Ctx, x: number, y: number, s: number, open: boolean): void {
  ctx.fillStyle = open ? EGA.brightGreen : EGA.brown
  ctx.fillRect(x + s * 0.12, y + s * 0.05, s * 0.76, s * 0.95)
  ctx.fillStyle = EGA.black
  ctx.fillRect(x + s * 0.22, y + s * 0.18, s * 0.56, s * 0.7)
  ctx.fillStyle = open ? EGA.white : EGA.yellow
  ctx.fillRect(x + s * 0.64, y + s * 0.48, s * 0.1, s * 0.1)
}

function jetpackTile(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = EGA.silver
  ctx.fillRect(x + s * 0.28, y + s * 0.2, s * 0.44, s * 0.5)
  ctx.fillStyle = EGA.grey
  ctx.fillRect(x + s * 0.34, y + s * 0.28, s * 0.32, s * 0.14)
  ctx.fillStyle = EGA.brightRed
  ctx.fillRect(x + s * 0.34, y + s * 0.72, s * 0.12, s * 0.2)
  ctx.fillRect(x + s * 0.54, y + s * 0.72, s * 0.12, s * 0.2)
}

function gunTile(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = EGA.silver
  ctx.fillRect(x + s * 0.18, y + s * 0.38, s * 0.64, s * 0.16)
  ctx.fillStyle = EGA.grey
  ctx.fillRect(x + s * 0.28, y + s * 0.5, s * 0.18, s * 0.26)
}

/** Colour and size for each of the six pickups, cheapest to dearest. */
const LOOT: Record<string, { colour: string; inner: string }> = {
  [TILE.GUMBALL]: { colour: EGA.brightGreen, inner: EGA.white },
  [TILE.SHOE]: { colour: EGA.brown, inner: EGA.yellow },
  [TILE.COIN]: { colour: EGA.yellow, inner: EGA.brown },
  [TILE.RING]: { colour: EGA.brightCyan, inner: EGA.white },
  [TILE.WAND]: { colour: EGA.white, inner: EGA.brightMagenta },
  [TILE.CROWN]: { colour: EGA.yellow, inner: EGA.brightRed },
}

function loot(ctx: Ctx, tile: string, x: number, y: number, s: number, clock: number): void {
  const look = LOOT[tile]
  if (!look) return
  const bob = Math.sin(clock * 4 + x) * s * 0.06
  ctx.fillStyle = look.colour
  ctx.beginPath()
  ctx.arc(x + s / 2, y + s / 2 + bob, s * 0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = look.inner
  ctx.fillRect(x + s * 0.42, y + s * 0.34 + bob, s * 0.16, s * 0.16)
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
        case TILE.BRICK: brick(ctx, sx, sy, s); break
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

/** Dave himself: red shirt, blue trousers, and a hat he never takes off. */
export function drawDave(ctx: Ctx, dave: Dave, view: View): void {
  const s = view.size
  const w = BODY_W * s
  const h = BODY_H * s
  const x = px(view, dave.x) - w / 2
  const y = (dave.y - BODY_H) * s

  if (dave.flying) {
    ctx.fillStyle = EGA.brightRed
    const flame = (0.4 + Math.random() * 0.5) * s * 0.5
    ctx.fillRect(x + w * 0.2, y + h, w * 0.2, flame)
    ctx.fillStyle = EGA.yellow
    ctx.fillRect(x + w * 0.6, y + h, w * 0.2, flame * 0.7)
  }

  // Legs, striding when he moves and together when he does not.
  const stride = dave.onGround && Math.abs(dave.vx) > 0.1
  const swing = stride ? Math.sin(view.clock * 16) * w * 0.18 : 0
  ctx.fillStyle = EGA.blue
  ctx.fillRect(x + w * 0.18 + swing, y + h * 0.6, w * 0.26, h * 0.4)
  ctx.fillRect(x + w * 0.56 - swing, y + h * 0.6, w * 0.26, h * 0.4)

  ctx.fillStyle = EGA.brightRed
  ctx.fillRect(x + w * 0.12, y + h * 0.28, w * 0.76, h * 0.36)

  // Head and hat.
  ctx.fillStyle = EGA.brown
  ctx.fillRect(x + w * 0.26, y + h * 0.08, w * 0.48, h * 0.24)
  ctx.fillStyle = EGA.white
  const eye = dave.facing > 0 ? 0.56 : 0.3
  ctx.fillRect(x + w * eye, y + h * 0.15, w * 0.14, h * 0.08)
  ctx.fillStyle = EGA.red
  ctx.fillRect(x + w * 0.18, y, w * 0.64, h * 0.1)

  if (dave.hasJetpack) {
    ctx.fillStyle = EGA.silver
    const back = dave.facing > 0 ? x : x + w * 0.78
    ctx.fillRect(back, y + h * 0.3, w * 0.22, h * 0.34)
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
    ctx.fillRect(x + s * 0.2, y + s * 0.25, s * 0.5, s * 0.4)
    ctx.fillStyle = EGA.brightMagenta
    for (let i = 0; i < 4; i++) {
      const legY = y + s * 0.25 + (i % 2) * s * 0.25
      ctx.fillRect(x + (i < 2 ? 0 : s * 0.7), legY + wobble, s * 0.22, s * 0.1)
    }
  } else if (monster.spec.kind === 'orb') {
    ctx.fillStyle = EGA.brightGreen
    ctx.beginPath()
    ctx.arc(x + s * 0.45, y + s * 0.45 + wobble, s * 0.34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = EGA.green
    ctx.beginPath()
    ctx.arc(x + s * 0.45, y + s * 0.45 + wobble, s * 0.16, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = EGA.brightCyan
    ctx.fillRect(x, y + s * 0.38 + wobble, s * 0.9, s * 0.18)
    ctx.fillStyle = EGA.cyan
    ctx.fillRect(x + s * 0.24, y + s * 0.18 + wobble, s * 0.42, s * 0.22)
  }

  ctx.fillStyle = EGA.white
  ctx.fillRect(x + s * 0.28, y + s * 0.34 + wobble, s * 0.1, s * 0.1)
  ctx.fillRect(x + s * 0.52, y + s * 0.34 + wobble, s * 0.1, s * 0.1)
}

export function drawBullet(ctx: Ctx, bullet: Bullet, view: View): void {
  const s = view.size
  ctx.fillStyle = bullet.mine ? EGA.yellow : EGA.brightRed
  ctx.fillRect(px(view, bullet.x) - s * 0.14, bullet.y * s - s * 0.07, s * 0.28, s * 0.14)
}
