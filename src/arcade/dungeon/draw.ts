/**
 * Drawing the dungeon.
 *
 * A flat canvas, a room at a time. Everything is built from rectangles because
 * that is what the walls of this kind of game are: courses of cut stone with a
 * lit top edge, a dark joint, and a scatter of chipped marks that stop a wall
 * of them reading as wallpaper.
 *
 * The characters are our own — a runner in a pale tunic and sash, guards in
 * coloured robes — drawn from primitives like everything else in this project,
 * so they stay sharp at any size and cost nothing to ship.
 */
import { ROOM_COLS, ROOM_ROWS, TILE, tileAt, type Level } from './level'
import type { Prince } from './prince'
import type { Guard } from './run'

export interface Stone {
  face: string
  joint: string
  lit: string
  shade: string
  floor: string
}

export const STONE: Record<string, Stone> = {
  dungeon: {
    face: '#5c6672',
    joint: '#2b323b',
    lit: '#8994a2',
    shade: '#3a424d',
    floor: '#6d7885',
  },
  palace: {
    face: '#8f8065',
    joint: '#4a4234',
    lit: '#c4b088',
    shade: '#635941',
    floor: '#a08e6e',
  },
}

export const INK = {
  black: '#000000',
  flame: '#ff9a1f',
  flameHot: '#ffe066',
  blade: '#d8dee8',
  bladeDark: '#8a93a1',
  gate: '#3fae9a',
  gateDark: '#1d6f62',
  chevron: '#e8433a',
  caption: '#e8e2d0',
  tunic: '#f2ece0',
  sash: '#c8452f',
  skin: '#e8b98f',
  hair: '#3a2a20',
} as const

export const ROBES: Record<string, { robe: string; trim: string; skin: string }> = {
  guard: { robe: '#c96a1e', trim: '#f0a13c', skin: '#d8a978' },
  fat: { robe: '#8c4bb0', trim: '#bb86d6', skin: '#d8a978' },
  skeleton: { robe: '#d8dee8', trim: '#9aa3b0', skin: '#e8e8e8' },
  shadow: { robe: '#2b2b38', trim: '#5a5a72', skin: '#4a4a5c' },
  vizier: { robe: '#1f5fb0', trim: '#5fa0e8', skin: '#d8a978' },
}

export interface View {
  /** Leftmost tile of the room on screen. */
  col: number
  /** Top floor of the room on screen. */
  row: number
  /** Pixels per tile across. */
  size: number
  /** Pixels per floor. Floors are taller than tiles are wide. */
  floorHeight: number
  clock: number
}

type Ctx = CanvasRenderingContext2D

const px = (view: View, col: number) => (col - view.col) * view.size
/** The top surface of a floor, which is what everything stands on. */
const py = (view: View, row: number) => (row - view.row + 1) * view.floorHeight

/**
 * A course of cut stone.
 *
 * Two rows of blocks, offset, with a lit top edge on each and a few chipped
 * marks. The marks are what the eye reads as stone rather than as paint.
 */
function stoneBlock(ctx: Ctx, x: number, y: number, w: number, h: number, stone: Stone, seed: number): void {
  ctx.fillStyle = stone.joint
  ctx.fillRect(x, y, w, h)

  // Courses about as tall as half a block is wide. Fixing the count at two
  // made every wall a column of tall lockers rather than masonry.
  const courses = Math.max(2, Math.round(h / (w * 0.42)))
  const ch = h / courses
  const line = Math.max(1, Math.round(h / 22))
  for (let c = 0; c < courses; c++) {
    const offset = c % 2 === 0 ? 0 : w / 4
    for (let b = -1; b < 3; b++) {
      const bx = x + offset + (b * w) / 2
      const bw = w / 2 - line
      const left = Math.max(x + line, bx)
      const right = Math.min(x + w - line, bx + bw)
      if (right <= left) continue
      ctx.fillStyle = stone.face
      ctx.fillRect(left, y + c * ch + line, right - left, ch - line * 2)
      ctx.fillStyle = stone.lit
      ctx.fillRect(left, y + c * ch + line, right - left, line)
    }
  }

  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 2; i++) {
    const n = (seed * 37 + i * 91) % 97
    ctx.fillRect(x + ((n % 8) / 8) * w * 0.8 + w * 0.1, y + (((n * 5) % 8) / 8) * h * 0.8 + h * 0.1, line, line)
  }
  ctx.globalAlpha = 1
}

/** A floor slab: a lit walking surface, a block face, and a shadow beneath. */
function slab(ctx: Ctx, x: number, y: number, w: number, h: number, stone: Stone, seed: number): void {
  const lip = Math.max(2, h * 0.14)
  ctx.fillStyle = stone.floor
  ctx.fillRect(x, y, w, lip)
  ctx.fillStyle = stone.lit
  ctx.fillRect(x, y, w, Math.max(1, lip * 0.35))
  stoneBlock(ctx, x, y + lip, w, h - lip, stone, seed)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(x, y + h - Math.max(1, h * 0.06), w, Math.max(1, h * 0.06))
}

function torch(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  ctx.fillStyle = '#4a3a2a'
  ctx.fillRect(x + s * 0.44, y - s * 0.28, s * 0.12, s * 0.3)
  const flick = Math.sin(clock * 11 + seed) * 0.5 + 0.5
  const h = s * (0.34 + flick * 0.2)
  ctx.fillStyle = INK.flame
  ctx.beginPath()
  ctx.moveTo(x + s * 0.5, y - s * 0.28 - h)
  ctx.lineTo(x + s * 0.62, y - s * 0.24)
  ctx.lineTo(x + s * 0.38, y - s * 0.24)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = INK.flameHot
  ctx.beginPath()
  ctx.moveTo(x + s * 0.5, y - s * 0.3 - h * 0.6)
  ctx.lineTo(x + s * 0.57, y - s * 0.25)
  ctx.lineTo(x + s * 0.43, y - s * 0.25)
  ctx.closePath()
  ctx.fill()
}

function spikes(ctx: Ctx, x: number, y: number, w: number, h: number, out: boolean): void {
  const tips = 3
  const height = h * (out ? 0.75 : 0.12)
  for (let i = 0; i < tips; i++) {
    const cx = x + ((i + 0.5) * w) / tips
    ctx.fillStyle = INK.blade
    ctx.beginPath()
    ctx.moveTo(cx, y - height)
    ctx.lineTo(cx + w / (tips * 2.4), y)
    ctx.lineTo(cx - w / (tips * 2.4), y)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = INK.bladeDark
    ctx.fillRect(cx - w / (tips * 8), y - height * 0.5, w / (tips * 8), height * 0.5)
  }
}

function chomper(ctx: Ctx, x: number, y: number, w: number, h: number, shut: number): void {
  // Two blades that come together. `shut` runs 0 to 1.
  ctx.fillStyle = INK.bladeDark
  ctx.fillRect(x + w * 0.42, y - h, w * 0.16, h)
  const bite = h * 0.45 * shut
  ctx.fillStyle = INK.blade
  ctx.fillRect(x + w * 0.2, y - h + bite * 0.2, w * 0.6, Math.max(2, h * 0.1))
  ctx.fillRect(x + w * 0.2, y - bite * 0.4 - h * 0.1, w * 0.6, Math.max(2, h * 0.1))
}

function gate(ctx: Ctx, x: number, y: number, w: number, h: number, open: boolean): void {
  const drop = open ? h * 0.15 : h
  ctx.fillStyle = INK.gateDark
  ctx.fillRect(x + w * 0.05, y - h, w * 0.9, Math.max(2, h * 0.08))
  ctx.strokeStyle = INK.gate
  ctx.lineWidth = Math.max(1, w * 0.06)
  for (let i = 0; i <= 4; i++) {
    const gx = x + w * 0.08 + (i * w * 0.84) / 4
    ctx.beginPath()
    ctx.moveTo(gx, y - h)
    ctx.lineTo(gx, y - h + drop)
    ctx.stroke()
  }
  for (let i = 1; i <= 3; i++) {
    const gy = y - h + (i * drop) / 4
    ctx.beginPath()
    ctx.moveTo(x + w * 0.08, gy)
    ctx.lineTo(x + w * 0.92, gy)
    ctx.stroke()
  }
}

function potion(ctx: Ctx, x: number, y: number, s: number, colour: string, big: boolean): void {
  const w = s * (big ? 0.34 : 0.24)
  const h = s * (big ? 0.5 : 0.36)
  ctx.fillStyle = '#cfe0ea'
  ctx.fillRect(x + s / 2 - w * 0.2, y - h - s * 0.1, w * 0.4, s * 0.12)
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.ellipse(x + s / 2, y - h * 0.45, w * 0.6, h * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillRect(x + s / 2 - w * 0.35, y - h * 0.7, w * 0.18, h * 0.3)
}

function doorway(ctx: Ctx, x: number, y: number, w: number, h: number, stone: Stone): void {
  ctx.fillStyle = INK.black
  ctx.fillRect(x + w * 0.12, y - h * 0.95, w * 0.76, h * 0.95)
  ctx.strokeStyle = stone.lit
  ctx.lineWidth = Math.max(2, w * 0.08)
  ctx.beginPath()
  ctx.moveTo(x + w * 0.12, y)
  ctx.lineTo(x + w * 0.12, y - h * 0.6)
  ctx.quadraticCurveTo(x + w * 0.5, y - h * 1.15, x + w * 0.88, y - h * 0.6)
  ctx.lineTo(x + w * 0.88, y)
  ctx.stroke()
}

/** The room the prince is in, drawn whole. */
export function drawRoom(
  ctx: Ctx,
  level: Level,
  view: View,
  width: number,
  height: number,
  gatesOpen: boolean,
  collapsed: string[],
): void {
  const stone = STONE[level.palette ?? 'dungeon']
  ctx.fillStyle = INK.black
  ctx.fillRect(0, 0, width, height)

  for (let row = view.row; row < view.row + ROOM_ROWS; row++) {
    for (let col = view.col; col < view.col + ROOM_COLS; col++) {
      const tile = tileAt(level, col, row)
      const x = px(view, col)
      const y = py(view, row)
      const s = view.size
      const fh = view.floorHeight
      const seed = col * 7 + row * 13
      const gone = collapsed.includes(`${col},${row}`)

      if (tile === TILE.WALL || tile === TILE.PILLAR) {
        stoneBlock(ctx, x, y - fh, s, fh, stone, seed)
        continue
      }
      if (tile === TILE.SPACE) continue

      // Everything else stands on a slab of floor.
      if (!gone) slab(ctx, x, y, s, fh * 0.42, stone, seed)

      switch (tile) {
        case TILE.SPIKES:
          spikes(ctx, x, y, s, fh * 0.5, true)
          break
        case TILE.CHOMPER:
          chomper(ctx, x, y, s, fh * 0.9, Math.abs(Math.sin(view.clock * 2.2 + seed)))
          break
        case TILE.GATE:
          gate(ctx, x, y, s, fh * 0.9, gatesOpen)
          break
        case TILE.BUTTON:
          ctx.fillStyle = stone.lit
          ctx.fillRect(x + s * 0.18, y - fh * 0.05, s * 0.64, Math.max(2, fh * 0.05))
          break
        case TILE.POTION_HEAL:
          potion(ctx, x, y, s, '#d8443a', false)
          break
        case TILE.POTION_LIFE:
          potion(ctx, x, y, s, '#d8443a', true)
          break
        case TILE.POTION_POISON:
          potion(ctx, x, y, s, '#4a7fd8', false)
          break
        case TILE.SWORD:
          ctx.fillStyle = INK.blade
          ctx.fillRect(x + s * 0.15, y - fh * 0.1, s * 0.62, Math.max(2, fh * 0.035))
          ctx.fillStyle = '#c8a24a'
          ctx.fillRect(x + s * 0.74, y - fh * 0.14, s * 0.06, fh * 0.1)
          break
        case TILE.EXIT:
          doorway(ctx, x, y, s, fh * 0.95, stone)
          break
      }
    }
  }

  for (const t of level.torches ?? []) {
    if (t.col < view.col || t.col >= view.col + ROOM_COLS) continue
    if (t.row < view.row || t.row >= view.row + ROOM_ROWS) continue
    torch(ctx, px(view, t.col), py(view, t.row), view.size, view.clock, t.col * 3)
  }
}

/** A person: head, tunic, sash, arms and legs. Ours, not anybody else's. */
function figure(
  ctx: Ctx,
  x: number,
  footY: number,
  s: number,
  facing: 1 | -1,
  look: { body: string; trim: string; skin: string; hair: string },
  pose: { stride: number; crouch: number; arm: number; sword: number },
): void {
  const h = s * 1.3
  const w = s * 0.78
  const top = footY - h * (1 - pose.crouch * 0.28)
  const cx = x

  // Legs
  ctx.fillStyle = look.body
  const swing = pose.stride * w * 0.42
  ctx.fillRect(cx - w * 0.36 + swing, footY - h * 0.38, w * 0.3, h * 0.38)
  ctx.fillRect(cx + w * 0.06 - swing, footY - h * 0.38, w * 0.3, h * 0.38)
  ctx.fillStyle = look.trim
  ctx.fillRect(cx - w * 0.4 + swing, footY - h * 0.05, w * 0.38, h * 0.05)
  ctx.fillRect(cx + w * 0.02 - swing, footY - h * 0.05, w * 0.38, h * 0.05)

  // Tunic
  ctx.fillStyle = look.body
  ctx.fillRect(cx - w * 0.45, top + h * 0.26, w * 0.9, h * 0.4)
  ctx.fillStyle = look.trim
  ctx.fillRect(cx - w * 0.45, top + h * 0.52, w * 0.9, h * 0.07)

  // Head and hair
  ctx.fillStyle = look.skin
  ctx.fillRect(cx - w * 0.26, top + h * 0.05, w * 0.52, h * 0.21)
  ctx.fillStyle = look.hair
  ctx.fillRect(cx - w * 0.3, top, w * 0.6, h * 0.09)
  ctx.fillRect(cx - w * 0.3 - facing * w * 0.04, top + h * 0.05, w * 0.16, h * 0.14)

  // Sword arm
  ctx.fillStyle = look.skin
  const armY = top + h * (0.3 + pose.arm * 0.06)
  ctx.fillRect(cx + facing * w * 0.3, armY, w * 0.5 * facing, h * 0.1)
  if (pose.sword > 0) {
    ctx.fillStyle = INK.blade
    const reach = s * (0.5 + pose.sword * 0.75)
    ctx.fillRect(
      facing > 0 ? cx + w * 0.7 : cx - w * 0.7 - reach,
      armY + h * 0.02,
      reach,
      Math.max(2, h * 0.045),
    )
  }
}

/** Where the prince's feet are, and how he is standing. */
export function drawPrince(ctx: Ctx, prince: Prince, view: View, fighting: boolean): void {
  const x = px(view, prince.col) + view.size / 2
  const footY = py(view, prince.row)
  const running = prince.action === 'run' || prince.action === 'startRun'
  const stance = prince.stance ?? 'ready'
  figure(
    ctx,
    x,
    footY,
    view.size,
    prince.facing,
    { body: INK.tunic, trim: INK.sash, skin: INK.skin, hair: INK.hair },
    {
      stride: running ? Math.sin(view.clock * 14) : 0,
      crouch: prince.action === 'crouch' || prince.action === 'hang' ? 1 : 0,
      arm: stance === 'strike' ? 1 : 0,
      sword: fighting ? (stance === 'strike' ? 1 : stance === 'parry' ? 0.3 : 0.5) : 0,
    },
  )
}

export function drawGuard(ctx: Ctx, guard: Guard, view: View): void {
  if (guard.health <= 0) return
  const look = ROBES[guard.colour] ?? ROBES.guard
  figure(
    ctx,
    px(view, guard.col) + view.size / 2,
    py(view, guard.row),
    view.size,
    guard.facing,
    { body: look.robe, trim: look.trim, skin: look.skin, hair: '#241c18' },
    {
      stride: 0,
      crouch: 0,
      arm: guard.stance === 'strike' ? 1 : 0,
      sword: guard.stance === 'strike' ? 1 : guard.stance === 'parry' ? 0.3 : 0.5,
    },
  )
}

/** Health, as a row of chevrons along the bottom left. */
export function drawChevrons(ctx: Ctx, x: number, y: number, s: number, health: number, max: number): void {
  for (let i = 0; i < max; i++) {
    const cx = x + i * s * 0.9
    ctx.fillStyle = i < health ? INK.chevron : 'rgba(120,40,36,0.35)'
    ctx.beginPath()
    ctx.moveTo(cx, y - s * 0.4)
    ctx.lineTo(cx + s * 0.55, y)
    ctx.lineTo(cx, y + s * 0.4)
    ctx.lineTo(cx + s * 0.2, y)
    ctx.closePath()
    ctx.fill()
  }
}


/** The glyph inside a button: arrows, a careful footstep, a blade, a guard. */
function glyphFor(ctx: Ctx, glyph: string, cx: number, cy: number, a: number, colour: string): void {
  ctx.fillStyle = colour
  ctx.strokeStyle = colour
  ctx.lineWidth = Math.max(2, a * 0.22)

  if (glyph === 'left' || glyph === 'right' || glyph === 'up' || glyph === 'down') {
    const turn = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[glyph] ?? 0
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const angle = turn + (i * Math.PI * 2) / 3
      const x = cx + Math.cos(angle) * a
      const y = cy + Math.sin(angle) * a
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    return
  }

  if (glyph === 'care') {
    // A single careful footstep, which is what the button does.
    ctx.fillRect(cx - a * 0.75, cy + a * 0.3, a * 0.6, a * 0.3)
    ctx.fillRect(cx + a * 0.15, cy - a * 0.5, a * 0.6, a * 0.3)
    ctx.globalAlpha = 0.5
    ctx.fillRect(cx - a * 0.2, cy - a * 0.1, a * 0.4, a * 0.12)
    ctx.globalAlpha = 1
    return
  }

  if (glyph === 'sword') {
    ctx.fillRect(cx - a * 0.1, cy - a, a * 0.2, a * 1.5)
    ctx.fillRect(cx - a * 0.55, cy + a * 0.35, a * 1.1, a * 0.18)
    return
  }

  // A shield.
  ctx.beginPath()
  ctx.moveTo(cx, cy - a)
  ctx.lineTo(cx + a * 0.8, cy - a * 0.55)
  ctx.lineTo(cx + a * 0.6, cy + a * 0.6)
  ctx.lineTo(cx, cy + a)
  ctx.lineTo(cx - a * 0.6, cy + a * 0.6)
  ctx.lineTo(cx - a * 0.8, cy - a * 0.55)
  ctx.closePath()
  ctx.fill()
}

/**
 * The pad, drawn where it is.
 *
 * Its own, rather than borrowed from the other game, because these buttons
 * have to say what they do: an arrow is obvious, a careful step and a parry
 * are not, and this pad changes its meanings the moment a guard appears.
 */
export function drawPad(
  ctx: Ctx,
  keys: { id: string; cx: number; cy: number; r: number; glyph: string }[],
  pressed: Record<string, boolean>,
): void {
  for (const key of keys) {
    const down = pressed[key.id]
    ctx.globalAlpha = down ? 0.82 : 0.42

    ctx.fillStyle = INK.black
    ctx.beginPath()
    ctx.arc(key.cx, key.cy, key.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = down ? INK.flameHot : '#9aa3b0'
    ctx.lineWidth = Math.max(2, key.r * 0.1)
    ctx.stroke()

    glyphFor(ctx, key.glyph, key.cx, key.cy, key.r * 0.42, down ? INK.flameHot : '#e2e6ee')
    ctx.globalAlpha = 1
  }
}
