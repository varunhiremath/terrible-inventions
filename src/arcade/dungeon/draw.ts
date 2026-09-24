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
import { drawFigure, type Look, type Style } from './figure'

export interface Stone {
  face: string
  joint: string
  lit: string
  shade: string
  floor: string
  /** The room behind everything, and the brickwork drawn on it. */
  back: string
  backFace: string
  backLit: string
}

export const STONE: Record<string, Stone> = {
  dungeon: {
    face: '#5c6672',
    joint: '#262c34',
    lit: '#8994a2',
    shade: '#3a424d',
    floor: '#79838f',
    back: '#12151a',
    backFace: '#232a33',
    backLit: '#2f3842',
  },
  palace: {
    face: '#8f8065',
    joint: '#3f3a2e',
    lit: '#c4b088',
    shade: '#635941',
    floor: '#ab9873',
    back: '#191510',
    backFace: '#2e281e',
    backLit: '#3e3627',
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

/**
 * The guards.
 *
 * Each one is a silhouette you can name across a dark room: the dungeon guard
 * in dull brown under a red headdress, the fat one in purple, the skeleton
 * bone-white, the shadow a hole in the wall, the vizier's man in blue.
 */
export const ROBES: Record<string, { robe: string; legs: string; trim: string; skin: string }> = {
  guard: { robe: '#a83232', legs: '#6b3a86', trim: '#e0b13c', skin: '#c99a6a' },
  fat: { robe: '#8a3f7c', legs: '#4a2050', trim: '#e0a0d8', skin: '#c99a6a' },
  skeleton: { robe: '#aab2c0', legs: '#4e5766', trim: '#7d8694', skin: '#dfe3e8' },
  shadow: { robe: '#2a2a38', legs: '#14141c', trim: '#6a6a88', skin: '#3e3e4c' },
  vizier: { robe: '#2c5ea8', legs: '#16294a', trim: '#7ab6f0', skin: '#c99a6a' },
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

/**
 * How far a floor slab hangs below the surface you walk on, as a fraction of
 * a floor's height.
 *
 * The room needs this much room underneath its lowest floor or that floor is
 * drawn off the bottom of the board and whoever is standing on it appears to
 * be standing on nothing.
 */
export const FLOOR_DEPTH = 0.42

const px = (view: View, col: number) => (col - view.col) * view.size
/** The top surface of a floor, which is what everything stands on. */
const py = (view: View, row: number) => (row - view.row + 1) * view.floorHeight

/**
 * A course of cut stone.
 *
 * Big blocks, two to a tile across, with mortar you can see. The first version
 * drew thin courses and the wall came out looking like bathroom tiling; what
 * makes cut stone read as cut stone is each block being large enough to carry
 * a lit top, a shaded bottom and some wear across the middle.
 */
function stoneBlock(ctx: Ctx, x: number, y: number, w: number, h: number, stone: Stone, seed: number): void {
  ctx.fillStyle = stone.joint
  ctx.fillRect(x, y, w, h)

  const courses = Math.max(1, Math.round(h / (w * 0.52)))
  const ch = h / courses
  const mortar = Math.max(1.5, w * 0.045)

  for (let c = 0; c < courses; c++) {
    const offset = c % 2 === 0 ? 0 : w / 4
    for (let b = -1; b < 3; b++) {
      const bx = x + offset + (b * w) / 2
      const left = Math.max(x, bx) + mortar / 2
      const right = Math.min(x + w, bx + w / 2) - mortar / 2
      if (right <= left) continue
      const top = y + c * ch + mortar / 2
      const bh = ch - mortar

      ctx.fillStyle = stone.face
      ctx.fillRect(left, top, right - left, bh)
      ctx.fillStyle = stone.lit
      ctx.fillRect(left, top, right - left, Math.max(1, bh * 0.16))
      ctx.fillStyle = stone.shade
      ctx.fillRect(left, top + bh - Math.max(1, bh * 0.16), right - left, Math.max(1, bh * 0.16))

      // Wear: the same scuffs in the same places every time, out of arithmetic.
      const n = (Math.round(left) * 31 + Math.round(top) * 17 + seed) % 89
      ctx.globalAlpha = 0.55
      ctx.fillStyle = stone.shade
      ctx.fillRect(left + ((n % 5) / 5) * (right - left) * 0.7, top + bh * 0.42, (right - left) * 0.2, Math.max(1, bh * 0.1))
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(left + (((n * 3) % 7) / 7) * (right - left) * 0.8, top + bh * 0.64, mortar, mortar)
      ctx.globalAlpha = 1
    }
  }
}

/**
 * The wall at the back of the room.
 *
 * Not black. A room whose background is nothing reads as a cut-out floating in
 * space; the same room with a wall behind it reads as somewhere you are
 * standing in. The first attempt drew it at a fifth opacity and it may as well
 * not have been there — so it is brickwork you can plainly see, just far
 * enough down in tone that there is never a question about which stone is
 * floor and which is scenery.
 */
function backWall(ctx: Ctx, width: number, height: number, stone: Stone, size: number): void {
  ctx.fillStyle = stone.back
  ctx.fillRect(0, 0, width, height)

  const bh = size * 0.52
  const bw = size * 0.86
  for (let y = -bh; y < height + bh; y += bh) {
    const course = Math.round(y / bh)
    const offset = course % 2 === 0 ? 0 : bw * 0.5
    for (let x = -bw; x < width + bw; x += bw) {
      const left = x + offset + 1.5
      const top = y + 1.5
      ctx.fillStyle = stone.backFace
      ctx.fillRect(left, top, bw - 3, bh - 3)
      ctx.fillStyle = stone.backLit
      ctx.fillRect(left, top, bw - 3, Math.max(1, bh * 0.12))
    }
  }

  // The corners of a room are always darker than the middle of it. Without
  // this the back wall is an even field and the eye has nothing to settle on.
  const dark = ctx.createRadialGradient(
    width / 2, height * 0.45, size * 0.5,
    width / 2, height * 0.45, Math.max(width, height) * 0.72,
  )
  dark.addColorStop(0, 'rgba(0,0,0,0)')
  dark.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = dark
  ctx.fillRect(0, 0, width, height)
}

/**
 * A floor slab.
 *
 * The lip along the top is what you actually walk on, and it is the brightest
 * thing in the room — so the eye finds the ledges before it finds anything
 * else, which is the whole of reading one of these rooms at a glance. The
 * notches cut into it are what stop a long run of floor reading as one
 * extruded bar; they give the eye something to count along.
 * Underneath, the face falls away into shadow and a hard dark line closes it.
 */
function slab(ctx: Ctx, x: number, y: number, w: number, h: number, stone: Stone, seed: number): void {
  const lip = Math.max(4, h * 0.26)
  ctx.fillStyle = stone.floor
  ctx.fillRect(x, y, w, lip)
  ctx.fillStyle = stone.lit
  ctx.fillRect(x, y, w, Math.max(1, lip * 0.3))

  // Notches along the walking surface, four to a tile.
  ctx.fillStyle = stone.shade
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + ((i + 0.5) * w) / 4 - Math.max(1, w * 0.012), y + lip * 0.34, Math.max(1.5, w * 0.025), lip * 0.4)
  }
  ctx.fillStyle = stone.shade
  ctx.fillRect(x, y + lip - Math.max(1, lip * 0.2), w, Math.max(1, lip * 0.2))

  stoneBlock(ctx, x, y + lip, w, h - lip, stone, seed)

  // The underside. A ledge you can hang from has to look like it has an edge.
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x, y + h - Math.max(2, h * 0.12), w, Math.max(2, h * 0.12))
}

/**
 * A fire lamp on the wall.
 *
 * Not a light: a bowl of burning oil on an iron bracket, which is a different
 * thing to draw. The first version was a soft circular pool of orange, and a
 * soft circular pool of orange is a spotlight — it reads as electric, because
 * a flame does not light a wall evenly in all directions. So the glow is an
 * oval, taller than it is wide and brighter above the bowl than below it, the
 * flame is the brightest thing in the room by a distance, and there is a
 * bracket you can see holding it up.
 */
function torch(ctx: Ctx, x: number, y: number, s: number, clock: number, seed: number): void {
  // Two flickers at different rates, so it never settles into a pulse.
  const flick = (Math.sin(clock * 11 + seed) + Math.sin(clock * 17.3 + seed * 2)) * 0.25 + 0.5
  const bowlY = y - s * 0.42
  const cx = x + s * 0.5

  ctx.save()
  const glow = ctx.createRadialGradient(cx, bowlY, s * 0.04, cx, bowlY, s * (1.5 + flick * 0.2))
  glow.addColorStop(0, 'rgba(255,196,96,0.4)')
  glow.addColorStop(0.35, 'rgba(255,150,48,0.16)')
  glow.addColorStop(1, 'rgba(255,140,40,0)')
  ctx.fillStyle = glow
  // Squashed sideways and lifted, because the heat and the light both go up.
  ctx.translate(cx, bowlY - s * 0.25)
  ctx.scale(1, 1.35)
  ctx.translate(-cx, -(bowlY - s * 0.25))
  ctx.fillRect(x - s * 1.6, bowlY - s * 2.2, s * 4.2, s * 3.6)
  ctx.restore()

  // The bracket: an arm out of the wall, and the bowl sitting in it.
  ctx.fillStyle = '#3d3226'
  ctx.fillRect(x + s * 0.46, bowlY + s * 0.06, s * 0.08, s * 0.46)
  ctx.fillStyle = '#584734'
  ctx.beginPath()
  ctx.moveTo(x + s * 0.3, bowlY - s * 0.02)
  ctx.lineTo(x + s * 0.7, bowlY - s * 0.02)
  ctx.lineTo(x + s * 0.62, bowlY + s * 0.14)
  ctx.lineTo(x + s * 0.38, bowlY + s * 0.14)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7a6144'
  ctx.fillRect(x + s * 0.3, bowlY - s * 0.04, s * 0.4, s * 0.04)

  // The flame, in three tongues so it has an edge rather than a gradient.
  const h = s * (0.5 + flick * 0.26)
  const tongue = (width: number, height: number, colour: string, lift: number) => {
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.moveTo(cx, bowlY - height - lift)
    ctx.quadraticCurveTo(cx + width, bowlY - height * 0.35, cx + width * 0.62, bowlY - s * 0.02)
    ctx.lineTo(cx - width * 0.62, bowlY - s * 0.02)
    ctx.quadraticCurveTo(cx - width, bowlY - height * 0.35, cx, bowlY - height - lift)
    ctx.fill()
  }
  tongue(s * 0.26, h, '#e2561c', 0)
  tongue(s * 0.19, h * 0.82, INK.flame, s * 0.02)
  tongue(s * 0.1, h * 0.5, INK.flameHot, s * 0.01)
  ctx.fillStyle = 'rgba(255,255,220,0.9)'
  ctx.fillRect(cx - s * 0.035, bowlY - h * 0.22, s * 0.07, h * 0.2)
}

/**
 * Spikes. Out, or barely showing.
 *
 * They sit in a dark slot in the floor, so a retracted set still warns you
 * that the tile is not one to stand about on.
 */
function spikes(ctx: Ctx, x: number, y: number, w: number, h: number, out: boolean): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(x + w * 0.08, y - Math.max(2, h * 0.07), w * 0.84, Math.max(3, h * 0.1))

  const tips = 4
  const height = h * (out ? 0.8 : 0.1)
  for (let i = 0; i < tips; i++) {
    const cx = x + w * 0.1 + ((i + 0.5) * w * 0.8) / tips
    const half = (w * 0.8) / (tips * 2.6)
    ctx.fillStyle = INK.blade
    ctx.beginPath()
    ctx.moveTo(cx, y - height)
    ctx.lineTo(cx + half, y)
    ctx.lineTo(cx - half, y)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = INK.bladeDark
    ctx.beginPath()
    ctx.moveTo(cx, y - height)
    ctx.lineTo(cx, y)
    ctx.lineTo(cx - half, y)
    ctx.closePath()
    ctx.fill()
  }
}

function chomper(ctx: Ctx, x: number, y: number, w: number, h: number, shut: number): void {
  const inset = w * 0.16
  const left = x + inset
  const width = w - inset * 2

  // The recess it lives in, so it is part of the wall rather than on top of it.
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(left, y - h, width, h)
  ctx.fillStyle = INK.bladeDark
  ctx.fillRect(left, y - h, Math.max(2, w * 0.05), h)
  ctx.fillRect(left + width - Math.max(2, w * 0.05), y - h, Math.max(2, w * 0.05), h)

  const teeth = 4
  const bite = h * 0.34 * shut
  const toothH = h * 0.2

  const jaw = (topY: number, down: boolean) => {
    // The backing plate goes behind the teeth, which is above them on the top
    // jaw and below them on the bottom one.
    ctx.fillStyle = INK.bladeDark
    ctx.fillRect(left, down ? topY - h * 0.06 : topY, width, h * 0.06)
    ctx.fillStyle = INK.blade
    for (let i = 0; i < teeth; i++) {
      const cx = left + ((i + 0.5) * width) / teeth
      const half = width / (teeth * 2.3)
      ctx.beginPath()
      ctx.moveTo(cx, topY + (down ? toothH : -toothH))
      ctx.lineTo(cx + half, topY)
      ctx.lineTo(cx - half, topY)
      ctx.closePath()
      ctx.fill()
    }
  }

  jaw(y - h + h * 0.06 + bite, true)
  jaw(y - bite, false)

  // A wink of red when it is shut on something.
  if (shut > 0.92) {
    ctx.fillStyle = 'rgba(200,50,40,0.6)'
    ctx.fillRect(left, y - h * 0.5 - h * 0.03, width, h * 0.06)
  }
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
  backWall(ctx, width, height, stone, view.size)

  /*
   * One extra column at each end.
   *
   * The camera follows the prince now, so `view.col` is fractional and the
   * left-hand column is usually half off the edge. Drawing exactly ROOM_COLS
   * of them leaves a sliver of bare background down one side that slides about
   * as he walks. The clip rectangle takes care of the overhang.
   */
  const first = Math.floor(view.col)
  for (let row = view.row; row < view.row + ROOM_ROWS; row++) {
    for (let col = first; col <= first + ROOM_COLS; col++) {
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
      if (!gone) slab(ctx, x, y, s, fh * FLOOR_DEPTH, stone, seed)

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
    if (t.col < first || t.col > first + ROOM_COLS) continue
    if (t.row < view.row || t.row >= view.row + ROOM_ROWS) continue
    torch(ctx, px(view, t.col), py(view, t.row), view.size, view.clock, t.col * 3)
  }
}

/**
 * What a body is doing, in the few numbers it takes to draw it.
 *
 * Every value is a fraction of the figure's own height or width, so the same
 * pose works at any size. `lean` is the giveaway: a run leans into itself and
 * a skid leans away, and without that a running figure is just a standing one
 * with its legs apart.
 */
interface Pose {
  /** Forward tilt of everything above the hips, in radians. */
  lean: number
  /** Shoulders coming round to face you, 0 to 1. Narrows the whole body. */
  twist: number
  /** How far down the body is folded, 0 to 1. */
  crouch: number
  /**
   * Near and far thigh, in radians from straight down.
   *
   * Canvas rotation is clockwise and its y axis points down, so a limb at a
   * positive angle swings *backwards*. `lean` is the other way round, because
   * the torso is rotated by its negative. Worth writing down: the sign of
   * these is the easiest thing in the file to get wrong.
   */
  legFront: number
  legBack: number
  /** How far each knee is bent on top of what the swing gives it. */
  kneeFront: number
  kneeBack: number
  /** How far off the ground each foot is, as a fraction of height. */
  liftFront: number
  liftBack: number
  /** The sword arm and the free arm, in radians from straight down, backwards positive. */
  armSword: number
  armFree: number
  /** Bend at each elbow. */
  elbowSword: number
  elbowFree: number
  /** How much blade is showing, 0 to 1. */
  blade: number
  /** Where the blade points, in radians from level. Up is negative. */
  bladeTilt: number
  /** Face down on the floor. */
  flat: number
}

const REST: Pose = {
  lean: 0, twist: 0, crouch: 0,
  // Standing at ease: weight on the back foot, the front one a little ahead.
  // Both legs at the same angle puts one exactly behind the other and the
  // figure becomes a column.
  legFront: -0.17, legBack: 0.1, kneeFront: 0.06, kneeBack: 0.14,
  liftFront: 0, liftBack: 0,
  armSword: 0.05, armFree: 0.12, elbowSword: 0.16, elbowFree: 0.2,
  blade: 0, bladeTilt: -0.2, flat: 0,
}

/**
 * One leg of a walk or a run, at a phase of the stride.
 *
 * The first version swung both legs as mirror images of a single hip angle, so
 * at two frames out of every four they were straight down and exactly on top
 * of one another, and the run read as a hop. A leg is doing two things at
 * once: the thigh swings, and the knee folds up behind it on the way through.
 * Driving each leg from its own phase, half a cycle apart, is what turns four
 * frames into a stride rather than a bounce — the two passing frames are no
 * longer the same drawing, because on each of them a different knee is folded.
 *
 * Angles come out in the convention `Pose` uses: positive swings backwards.
 */
function gait(phase: number, reach: number): { thigh: number; knee: number; lift: number } {
  const swing = Math.sin(phase)
  // The knee folds hardest just after the foot has left the ground behind him.
  const fold = Math.max(0, -Math.sin(phase + 0.8))
  return {
    thigh: -reach * swing,
    knee: 0.08 + fold * (0.9 + reach * 1.2),
    lift: Math.max(0, -swing) * reach * 0.05,
  }
}

/** Both legs and both arms, for anything with a stride in it. */
function stride(pose: Pose, phase: number, reach: number): void {
  const near = gait(phase, reach)
  const far = gait(phase + Math.PI, reach)
  pose.legFront = near.thigh
  pose.kneeFront = near.knee
  pose.liftFront = near.lift
  pose.legBack = far.thigh
  pose.kneeBack = far.knee
  pose.liftBack = far.lift
  // Arms counter the leg on their own side, which is the other half of what
  // makes a run look like one.
  pose.armSword = far.thigh * 1.3
  pose.armFree = near.thigh * 1.3
  pose.elbowSword = 0.35 + Math.max(0, -far.thigh) * 1.1
  pose.elbowFree = 0.35 + Math.max(0, -near.thigh) * 1.1
}

/**
 * The pose for an action, at a frame.
 *
 * Fifteen frames a second means every one of these is on screen long enough to
 * be read, so they are worth getting right — a run that does not lean, or a
 * landing that does not fold, reads as a sprite sliding about rather than as
 * somebody moving.
 */
export function poseFor(action: string, frame: number, stance: string): Pose {
  const pose = { ...REST }

  switch (action) {
    case 'startRun':
    case 'run': {
      // A run winds up over its first four frames, so the stride grows with
      // them rather than arriving at full length on frame one.
      const reach = action === 'startRun' ? 0.26 + frame * 0.09 : 0.62
      stride(pose, (frame / 4) * Math.PI * 2, reach)
      pose.lean = 0.1 + reach * 0.22
      // The body rides lowest as he passes over the planted foot.
      pose.crouch = 0.07 * (1 - Math.abs(Math.sin((frame / 4) * Math.PI * 2)))
      break
    }
    case 'stopRun':
      // Heels dug in, weight back, arms thrown out for balance.
      pose.lean = -0.34
      pose.legFront = 0.62
      pose.legBack = -0.3
      pose.kneeFront = 0.1
      pose.kneeBack = 0.5
      pose.armFree = -1.0
      pose.armSword = 0.5
      pose.elbowFree = 0.5
      break
    case 'step':
      // One careful tile: the same stride, a quarter of the size, and taken
      // across the four frames instead of cycling.
      stride(pose, ((frame + 0.5) / 4) * Math.PI, 0.26)
      pose.lean = 0.05
      break
    case 'hop':
    case 'standJump':
    case 'runJump': {
      const air = frame / 8
      pose.lean = 0.26
      // Tucked at the top of the arc, reaching for the landing on the way down.
      pose.crouch = air < 0.25 ? 0.5 : 0.12
      pose.legFront = air < 0.25 ? 0.7 : 0.5
      pose.legBack = air < 0.25 ? -0.2 : -0.62
      pose.kneeFront = air < 0.25 ? 1.3 : 0.25
      pose.kneeBack = air < 0.25 ? 1.5 : 0.7
      pose.liftFront = 0.04
      pose.liftBack = 0.04
      pose.armSword = -0.9
      pose.armFree = -0.5
      pose.elbowSword = 1.1
      pose.elbowFree = 1.3
      break
    }
    case 'fall':
      // Arms up, legs trailing: the shape of somebody who has run out of floor.
      pose.lean = 0.1
      pose.legFront = 0.38
      pose.legBack = -0.42
      pose.kneeBack = 0.45
      pose.armSword = -2.75
      pose.armFree = -2.1
      pose.elbowSword = 0.3
      pose.elbowFree = -0.35
      break
    case 'land':
      pose.crouch = 0.5
      pose.lean = 0.24
      pose.legFront = 0.34
      pose.legBack = -0.34
      pose.kneeFront = 0.5
      pose.kneeBack = 0.5
      pose.armFree = 0.45
      pose.armSword = 0.3
      pose.elbowFree = 1.0
      pose.elbowSword = 0.9
      break
    case 'hardLand':
      // Down on one knee, and slow about getting up.
      pose.crouch = 0.9 - frame * 0.11
      pose.lean = 0.42
      pose.legFront = 0.5
      pose.legBack = -0.7
      pose.kneeFront = 0.9
      pose.kneeBack = 1.5
      pose.armFree = -0.2
      pose.armSword = 0.1
      pose.elbowFree = 1.0
      break
    case 'hang':
      // Hanging off a ledge by the fingers: arms straight up, body dead weight.
      pose.crouch = 0.05
      pose.legFront = 0.16
      pose.legBack = -0.2
      pose.kneeBack = 0.45
      pose.kneeFront = 0.12
      pose.armSword = -3.08
      pose.armFree = -2.85
      pose.elbowSword = 0.06
      pose.elbowFree = -0.16
      break
    case 'climbUp': {
      // Pulling up: the elbows fold, the knee comes over the lip.
      const t = Math.min(1, frame / 6)
      pose.crouch = 0.65 - t * 0.6
      pose.armSword = -3.0 + t * 1.6
      pose.armFree = -2.95 + t * 1.6
      pose.elbowSword = 1.5 - t * 1.3
      pose.elbowFree = 1.5 - t * 1.3
      pose.legFront = 0.5 - t * 0.35
      pose.legBack = -0.3
      pose.kneeFront = 1.4 - t * 1.2
      pose.kneeBack = 0.4
      pose.lean = 0.3 - t * 0.25
      break
    }
    case 'crouch':
      pose.crouch = 0.85
      pose.lean = 0.26
      pose.legFront = 0.55
      pose.legBack = -0.35
      pose.kneeFront = 1.5
      pose.kneeBack = 1.3
      pose.armFree = 0.3
      pose.armSword = 0.2
      pose.elbowFree = 0.9
      break
    case 'turn':
      // Mid-turn: feet together, shoulders already coming round, so he is a
      // narrower figure for the moment it takes.
      pose.twist = 0.75
      pose.legFront = 0.04
      pose.legBack = -0.04
      pose.armFree = -0.3
      pose.elbowFree = 0.7
      pose.lean = -0.06
      break
    case 'drinking':
      pose.armSword = -2.5
      pose.elbowSword = 1.5
      pose.lean = -0.15
      pose.crouch = 0.1
      break
    case 'dead':
      pose.flat = 1
      break
  }

  // A drawn sword overrides the arms: it is the loudest thing about a pose.
  switch (stance) {
    case 'strike':
      // The whole body behind the point, front foot a long way forward.
      pose.blade = 1
      pose.bladeTilt = -0.05
      pose.armSword = -1.5
      pose.elbowSword = 0
      pose.armFree = 0.9
      pose.elbowFree = 0.5
      pose.lean = 0.3
      pose.legFront = 0.75
      pose.legBack = -0.45
      pose.kneeFront = 0.35
      pose.kneeBack = 0.05
      break
    case 'parry':
      // Blade up and across, body turned away behind it.
      pose.blade = 0.85
      pose.bladeTilt = -1.25
      pose.armSword = -1.05
      pose.elbowSword = 0.8
      pose.armFree = -0.3
      pose.elbowFree = 1.1
      pose.lean = -0.14
      pose.legFront = 0.3
      pose.legBack = -0.3
      pose.kneeFront = 0.3
      pose.kneeBack = 0.3
      break
    case 'hurt':
      // Knocked back off the front foot, blade dropping.
      pose.blade = 0.6
      pose.bladeTilt = 0.5
      pose.lean = -0.42
      pose.armSword = -0.3
      pose.elbowSword = 0.5
      pose.armFree = -1.3
      pose.elbowFree = 0.6
      pose.legFront = 0.2
      pose.legBack = -0.6
      pose.kneeBack = 0.5
      break
    case 'advance':
    case 'ready':
    case 'retreat': {
      // On guard: blade level and forward, free arm out behind for balance.
      const forward = stance === 'advance' ? 1 : stance === 'retreat' ? -1 : 0
      pose.blade = 0.8
      pose.bladeTilt = -0.28
      pose.armSword = -0.95
      pose.elbowSword = 0.55
      pose.armFree = 0.75
      pose.elbowFree = 0.7
      pose.lean = 0.12 * forward
      pose.legFront = 0.34 + 0.18 * forward
      pose.legBack = -0.34 - 0.18 * Math.max(0, -forward)
      pose.kneeFront = 0.35
      pose.kneeBack = 0.2
      break
    }
    case 'dead':
      pose.flat = 1
      break
  }

  return pose
}

/**
 * The style every character in the dungeon is drawn in.
 *
 * One word, because it is meant to be changed: 'outline', 'acrobat',
 * 'silhouette' and 'inked' are four different-looking people over the same
 * skeleton, and picking between them should cost one line rather than a
 * redraw.
 */
const STYLE: Style = 'warrior'

/**
 * The runner.
 *
 * Off the original: a sleeveless top, loose trousers, a sash at the waist, a
 * band round the head with the ends left long, and no shoes. Bare arms and
 * bare feet are not a detail — they are most of the reason he reads as a
 * person. An earlier version had him hooded and masked with a shoulder plate
 * and bound forearms, and it looked like a machine, because there was no skin
 * anywhere in it.
 *
 * Cream on purpose. These rooms are dark and every guard is darker than he is,
 * so the lightest thing on the screen is always him.
 */
const PRINCE_LOOK: Look = {
  body: '#efe7d6',
  legs: '#e4dbc6',
  trim: '#c0392b',
  skin: '#e0a878',
  hair: '#2b1d14',
  band: '#2f5f9e',
  sleeveless: true,
  barefoot: true,
  loose: true,
}

/**
 * How far off the ground an action lifts him, in floors.
 *
 * The frame tables carry displacement along the floor and nothing else,
 * because that is all the simulation needs: a jump lands where the table says
 * and the arc in between changes nothing. But on screen it changes
 * everything. Without it a standing jump is a figure sliding two tiles
 * forward slightly faster than a walk, which is exactly what it was reported
 * as — "jump doesn't work, it just makes me move forward faster".
 *
 * So the arc lives here, in the drawing, where it belongs: a half sine over
 * the length of the sequence, peaking in the middle. A climb rises instead of
 * arcing, and drops to nothing on the last frame because that is the frame
 * where the simulation actually moves him up a floor.
 */
function liftOf(action: string, frame: number): number {
  const over = (frames: number, height: number) =>
    Math.sin((Math.min(frame, frames) / frames) * Math.PI) * height
  switch (action) {
    case 'hop':
      // Shorter and quicker than a jump that travels: it is one bob.
      return over(6, 0.5)
    case 'standJump':
      return over(8, 0.62)
    case 'runJump':
      return over(8, 0.7)
    case 'climbLedge':
      // Climbing, not jumping: he goes up and stays up.
      return frame >= 5 ? 0 : (frame / 5) * 0.95
    case 'climbUp':
      return frame >= 5 ? 0 : (frame / 5) * 0.4
    default:
      return 0
  }
}

/** Where the prince's feet are, and how he is standing. */
export function drawPrince(ctx: Ctx, prince: Prince, view: View, fighting: boolean): void {
  drawFigure(
    ctx,
    px(view, prince.col) + view.size / 2,
    py(view, prince.row) - liftOf(prince.action, prince.frame) * view.floorHeight,
    view.size,
    prince.facing,
    poseFor(prince.action, prince.frame, fighting ? (prince.stance ?? 'ready') : 'none'),
    PRINCE_LOOK,
    STYLE,
    fighting,
  )
}

export function drawGuard(ctx: Ctx, guard: Guard, view: View): void {
  if (guard.health <= 0 && guard.stance !== 'dead') return
  const robe = ROBES[guard.colour] ?? ROBES.guard
  drawFigure(
    ctx,
    px(view, guard.col) + view.size / 2,
    py(view, guard.row),
    view.size,
    guard.facing,
    // A guard always has his sword out. That is the whole of what a guard is.
    poseFor('stand', guard.frame, guard.health <= 0 ? 'dead' : guard.stance),
    {
      body: robe.robe,
      legs: robe.legs,
      trim: robe.trim,
      skin: robe.skin,
      hair: '#1f1611',
      band: robe.trim,
      // Turban, coat over baggy trousers, curved blade, and shoes — dressed
      // apart from him in every way, so a room with one in it reads at a
      // glance.
      turban: true,
      coat: true,
      loose: true,
      curved: true,
    },
    STYLE,
    true,
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
