import type { Point } from './map'
import { SPRITE_SIZE, makeSprite, type Palette, type SpriteGrid } from './sprites'

/**
 * Draws a tile scene.
 *
 * Deliberately knows nothing about workshops or houses — it takes rows of tiles
 * and a list of actors, so a second location costs a data file rather than a
 * second renderer. Sprites are rasterised once into offscreen canvases and
 * blitted, keeping the loop cheap on a tablet.
 */

export interface Actor {
  key: string
  at: Point
  seed: number
  palette?: Palette
  label?: string
  /** Bobbing marker above the head: something to do here. */
  marker?: string
  /** Shudders, for anything that is not right. */
  agitated?: boolean
}

export interface Scene {
  rows: readonly string[]
  actors: readonly Actor[]
  player: { x: number; y: number }
  facingTile: Point | null
  /** Big faint numerals painted on the floor, for rooms that have numbers. */
  floorLabels?: readonly { at: Point; text: string; dim?: boolean }[]
}

export function tileSizeFor(height: number, rows: number): number {
  return Math.max(22, Math.min(64, Math.floor(height / (rows + 1))))
}

const cache = new Map<string, HTMLCanvasElement>()

function spriteCanvas(key: string, grid: SpriteGrid): HTMLCanvasElement {
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE
  canvas.height = SPRITE_SIZE
  const ctx = canvas.getContext('2d')!
  grid.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return
      ctx.fillStyle = colour
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  cache.set(key, canvas)
  return canvas
}

export function draw(ctx: CanvasRenderingContext2D, scene: Scene, width: number, height: number): void {
  const rows = scene.rows
  const mapH = rows.length
  const mapW = Math.max(...rows.map((r) => r.length))
  const T = tileSizeFor(height, mapH)

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#0d0f16'
  ctx.fillRect(0, 0, width, height)

  // Camera follows the player and stops at the edges; where the map is smaller
  // than the screen it is centred instead.
  const camX = clamp(scene.player.x + 0.5 - width / T / 2, 0, Math.max(0, mapW - width / T))
  const camY = clamp(scene.player.y + 0.5 - height / T / 2, 0, Math.max(0, mapH - height / T))
  const padX = Math.max(0, (width - mapW * T) / 2)
  const padY = Math.max(0, (height - mapH * T) / 2)
  const at = (x: number, y: number) => ({
    sx: Math.round((x - camX) * T + padX),
    sy: Math.round((y - camY) * T + padY),
  })

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const { sx, sy } = at(x, y)
      if (sx < -T || sy < -T || sx > width || sy > height) continue
      drawTile(ctx, rows[y][x], sx, sy, T)
    }
  }

  for (const floor of scene.floorLabels ?? []) {
    const { sx, sy } = at(floor.at.x, floor.at.y)
    ctx.font = `bold ${Math.round(T * 1.5)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = floor.dim ? 'rgba(232,235,245,0.06)' : 'rgba(88,185,255,0.16)'
    ctx.fillText(floor.text, sx + T / 2, sy + T / 2)
    ctx.textBaseline = 'alphabetic'
  }

  if (scene.facingTile) {
    const { sx, sy } = at(scene.facingTile.x, scene.facingTile.y)
    ctx.strokeStyle = 'rgba(255,200,74,0.85)'
    ctx.lineWidth = 3
    ctx.strokeRect(sx + 2, sy + 2, T - 4, T - 4)
  }

  for (const actor of scene.actors) {
    const { sx, sy } = at(actor.at.x, actor.at.y)
    const sprite = spriteCanvas(actor.key, makeSprite(actor.seed, actor.palette))
    const shake = actor.agitated ? Math.round(Math.sin(Date.now() / 90) * 1.5) : 0
    ctx.drawImage(sprite, sx + shake, sy - 4, T, T)
    if (actor.marker) marker(ctx, actor.marker, sx, sy, T)
    if (actor.label) label(ctx, actor.label, sx, sy, T)
  }

  const p = at(scene.player.x, scene.player.y)
  ctx.drawImage(spriteCanvas('player', makeSprite(PLAYER_SEED, PLAYER_PALETTE)), p.sx, p.sy - 4, T, T)
}

export const PLAYER_SEED = 31337
export const PLAYER_PALETTE: Palette = {
  body: 'hsl(35 90% 58%)',
  shade: 'hsl(28 80% 42%)',
  accent: 'hsl(200 85% 62%)',
  outline: 'hsl(30 60% 14%)',
}

export const PAPA_SEED = 90210
export const PAPA_PALETTE: Palette = {
  body: 'hsl(280 35% 55%)',
  shade: 'hsl(280 35% 36%)',
  accent: 'hsl(45 85% 60%)',
  outline: 'hsl(280 40% 12%)',
}

function drawTile(ctx: CanvasRenderingContext2D, tile: string, sx: number, sy: number, T: number): void {
  switch (tile) {
    case '#':
      ctx.fillStyle = '#2c3145'
      ctx.fillRect(sx, sy, T, T)
      ctx.fillStyle = '#3a4160'
      ctx.fillRect(sx, sy, T, Math.max(4, T / 6))
      break
    case '=':
      ctx.fillStyle = '#1d2030'
      ctx.fillRect(sx, sy, T, T)
      ctx.fillStyle = '#5c4326'
      ctx.fillRect(sx + 3, sy + 6, T - 6, T - 12)
      break
    case 'D':
      ctx.fillStyle = '#4a2f1c'
      ctx.fillRect(sx, sy, T, T)
      ctx.fillStyle = '#ffc84a'
      ctx.fillRect(sx + T / 2 - 3, sy + T / 2 - 4, 6, 9)
      break
    default:
      ctx.fillStyle = '#1a1d2a'
      ctx.fillRect(sx, sy, T, T)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.strokeRect(sx + 0.5, sy + 0.5, T - 1, T - 1)
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, sx: number, sy: number, T: number): void {
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const x = sx + T / 2
  const y = sy + T + 8
  const w = ctx.measureText(text).width + 8
  ctx.fillStyle = 'rgba(13,15,22,0.78)'
  ctx.fillRect(x - w / 2, y - 10, w, 14)
  ctx.fillStyle = '#e8ebf5'
  ctx.fillText(text, x, y)
}

function marker(ctx: CanvasRenderingContext2D, text: string, sx: number, sy: number, T: number): void {
  const bob = Math.sin(Date.now() / 260) * 3
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#14161f'
  ctx.fillText(text, sx + T / 2 + 1, sy - 11 + bob)
  ctx.fillStyle = '#ffc84a'
  ctx.fillText(text, sx + T / 2, sy - 12 + bob)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
