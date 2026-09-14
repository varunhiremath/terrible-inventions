import { MAP, TILE, mapHeight, mapWidth, type Point } from './map'
import { MACHINES, PAPA_AT } from './characters'
import { SPRITE_SIZE, makeSprite, paletteFor, type SpriteGrid } from './sprites'
import { fill } from '../config/profile'

/**
 * Draws the workshop.
 *
 * Flat colour and hard edges, at a deliberately chunky scale — the look is
 * doing the same job as the blocky games this is for. Sprites are rasterised
 * once into offscreen canvases and blitted, so the loop stays cheap on a tablet.
 */

/**
 * Tile size is chosen per frame from the space available, so the wing fills a
 * tablet instead of sitting in a letterbox with dead space beneath it.
 */
export function tileSizeFor(height: number): number {
  return Math.max(26, Math.min(64, Math.floor(height / (mapHeight + 1))))
}

/** The player, in a palette nothing else uses, so he is never lost on screen. */
const PLAYER_SEED = 31337
const PLAYER_PALETTE = {
  body: 'hsl(35 90% 58%)',
  shade: 'hsl(28 80% 42%)',
  accent: 'hsl(200 85% 62%)',
  outline: 'hsl(30 60% 14%)',
}

const PAPA_SEED = 90210
const PAPA_PALETTE = {
  body: 'hsl(280 35% 55%)',
  shade: 'hsl(280 35% 36%)',
  accent: 'hsl(45 85% 60%)',
  outline: 'hsl(280 40% 12%)',
}

export interface WorldView {
  /** Player position in tiles, fractional while walking. */
  player: { x: number; y: number }
  fixed: readonly string[]
  unlocked: boolean
  /** Tile the player is facing, highlighted if something is there. */
  facingTile: Point | null
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

export function draw(ctx: CanvasRenderingContext2D, view: WorldView, width: number, height: number): void {
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#0d0f16'
  ctx.fillRect(0, 0, width, height)

  const TILE_PX = tileSizeFor(height)

  // Camera centres on the player, then stops at the edges so the walls sit
  // against the frame rather than floating in void. Where the map is smaller
  // than the screen it is centred instead, which is the usual case vertically.
  const viewTilesX = width / TILE_PX
  const viewTilesY = height / TILE_PX
  const camX = clamp(view.player.x + 0.5 - viewTilesX / 2, 0, Math.max(0, mapWidth - viewTilesX))
  const camY = clamp(view.player.y + 0.5 - viewTilesY / 2, 0, Math.max(0, mapHeight - viewTilesY))

  const padX = Math.max(0, (width - mapWidth * TILE_PX) / 2)
  const padY = Math.max(0, (height - mapHeight * TILE_PX) / 2)

  const toScreen = (x: number, y: number) => ({
    sx: Math.round((x - camX) * TILE_PX + padX),
    sy: Math.round((y - camY) * TILE_PX + padY),
  })

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < MAP[y].length; x++) {
      const { sx, sy } = toScreen(x, y)
      if (sx < -TILE_PX || sy < -TILE_PX || sx > width || sy > height) continue
      drawTile(ctx, MAP[y][x], sx, sy, view.unlocked, TILE_PX)
    }
  }

  if (view.facingTile) {
    const { sx, sy } = toScreen(view.facingTile.x, view.facingTile.y)
    ctx.strokeStyle = 'rgba(255,200,74,0.85)'
    ctx.lineWidth = 3
    ctx.strokeRect(sx + 2, sy + 2, TILE_PX - 4, TILE_PX - 4)
  }

  // Names only for whoever is being looked at. Labelling everyone at once
  // clutters the room and covers the sprite standing below.
  const facing = view.facingTile

  for (const machine of MACHINES) {
    const { sx, sy } = toScreen(machine.at.x, machine.at.y)
    const broken = !view.fixed.includes(machine.id)
    drawCharacter(ctx, spriteCanvas(machine.id, makeSprite(machine.seed)), sx, sy, broken, TILE_PX)
    if (broken) exclamation(ctx, sx, sy, TILE_PX)
    if (facing && facing.x === machine.at.x && facing.y === machine.at.y) {
      label(ctx, machine.name, sx, sy, TILE_PX)
    }
  }

  const papa = toScreen(PAPA_AT.x, PAPA_AT.y)
  drawCharacter(ctx, spriteCanvas('papa', makeSprite(PAPA_SEED, PAPA_PALETTE)), papa.sx, papa.sy, false, TILE_PX)
  if (facing && facing.x === PAPA_AT.x && facing.y === PAPA_AT.y) {
    label(ctx, fill('{papa}'), papa.sx, papa.sy, TILE_PX)
  }

  const p = toScreen(view.player.x, view.player.y)
  drawCharacter(ctx, spriteCanvas('player', makeSprite(PLAYER_SEED, PLAYER_PALETTE)), p.sx, p.sy, false, TILE_PX)
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: string,
  sx: number,
  sy: number,
  unlocked: boolean,
  TILE_PX: number,
): void {
  switch (tile) {
    case TILE.WALL:
      ctx.fillStyle = '#2c3145'
      ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
      // A lighter cap reads as height without a real perspective pass.
      ctx.fillStyle = '#3a4160'
      ctx.fillRect(sx, sy, TILE_PX, 6)
      break

    case TILE.BENCH:
      ctx.fillStyle = '#1d2030'
      ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
      ctx.fillStyle = '#5c4326'
      ctx.fillRect(sx + 3, sy + 6, TILE_PX - 6, TILE_PX - 12)
      ctx.fillStyle = '#77572f'
      ctx.fillRect(sx + 3, sy + 6, TILE_PX - 6, 4)
      break

    case TILE.LOCKED:
      ctx.fillStyle = unlocked ? '#1d2030' : '#4a2f1c'
      ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
      if (!unlocked) {
        ctx.fillStyle = '#ffc84a'
        ctx.fillRect(sx + TILE_PX / 2 - 3, sy + TILE_PX / 2 - 4, 6, 9)
      }
      break

    default:
      ctx.fillStyle = '#1a1d2a'
      ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
      ctx.fillStyle = '#20243400'
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.strokeRect(sx + 0.5, sy + 0.5, TILE_PX - 1, TILE_PX - 1)
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  sx: number,
  sy: number,
  broken: boolean,
  TILE_PX: number,
): void {
  // A broken machine shudders, so it is obvious at a glance which need help.
  const shake = broken ? Math.round(Math.sin(Date.now() / 90) * 1.5) : 0
  ctx.save()
  if (broken) ctx.globalAlpha = 0.92
  ctx.drawImage(sprite, sx + shake, sy - 4, TILE_PX, TILE_PX)
  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, text: string, sx: number, sy: number, TILE_PX: number): void {
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const x = sx + TILE_PX / 2
  const y = sy + TILE_PX + 8
  ctx.fillStyle = 'rgba(13,15,22,0.75)'
  const w = ctx.measureText(text).width + 8
  ctx.fillRect(x - w / 2, y - 10, w, 14)
  ctx.fillStyle = '#e8ebf5'
  ctx.fillText(text, x, y)
}

function exclamation(ctx: CanvasRenderingContext2D, sx: number, sy: number, TILE_PX: number): void {
  const bob = Math.sin(Date.now() / 260) * 3
  const x = sx + TILE_PX / 2
  const y = sy - 12 + bob
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#14161f'
  ctx.fillText('!', x + 1, y + 1)
  ctx.fillStyle = '#ffc84a'
  ctx.fillText('!', x, y)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export const __palettes = { PLAYER_PALETTE, PAPA_PALETTE, paletteFor }
