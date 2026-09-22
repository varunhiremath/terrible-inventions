/**
 * Drawing the pipes.
 *
 * Built from primitives like everything else here: no image files, so the
 * whole game is a few kilobytes of text and stays sharp at any size.
 *
 * The characters are our own. A plumber's apprentice in goggles and green
 * dungarees, and Papa's little wind-up machines wandering about getting in the
 * way — the same genre, not the same people.
 */
import { TILE, VIEW_TOP, type Level } from './level'
import { BODY_W, bodyHeight, type Body } from './physics'
import type { Bumped, Enemy, Item, Run } from './run'
import { tileNow } from './run'

type Ctx = CanvasRenderingContext2D

export const INK = {
  sky: '#5c94fc',
  skyDeep: '#3a6ed0',
  earth: '#a05a20',
  earthDark: '#6d3a12',
  grass: '#4fae2e',
  grassDark: '#2f7c1c',
  brick: '#c05a18',
  brickDark: '#7a3508',
  query: '#e8a020',
  queryDark: '#9a5c08',
  solid: '#8a8f98',
  solidDark: '#5c626c',
  pipe: '#3cc03c',
  pipeDark: '#1d7a1d',
  pipeLight: '#7ae87a',
  coin: '#f4c430',
  cloth: '#2f7a3a',
  clothDark: '#1d5226',
  shirt: '#f2ece0',
  skin: '#e0a878',
  cap: '#e8c020',
  boot: '#4a2f1c',
  goggle: '#7fd8e8',
  grub: '#8a4f24',
  grubDark: '#5c3416',
  beetle: '#38a838',
  shell: '#d8d0a8',
  ink: '#1a1410',
} as const

export interface View {
  /** Leftmost tile on screen, which may be fractional as the world scrolls. */
  col: number
  /** Pixels per tile. */
  size: number
  clock: number
}

const px = (view: View, col: number) => (col - view.col) * view.size
const py = (view: View, row: number) => (row - VIEW_TOP) * view.size

/** A rounded box, which is how everything in this game is drawn. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2))
  ctx.fill()
}

export function drawSky(ctx: Ctx, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, INK.skyDeep)
  sky.addColorStop(1, INK.sky)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
}

/** Hills and clouds, which is how you tell the world is moving past you. */
export function drawBackdrop(ctx: Ctx, view: View, h: number): void {
  const s = view.size
  ctx.globalAlpha = 0.5
  for (let i = -1; i < 12; i++) {
    // Drifting at a fraction of the world's speed, so distance reads as
    // distance rather than as a wall of stickers moving with the floor.
    const x = ((i * 9 - view.col * 0.35) % 24) * s
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(x, h * 0.16 + (i % 3) * s * 0.7, s * 1.5, s * 0.55, 0, 0, Math.PI * 2)
    ctx.ellipse(x + s * 1.1, h * 0.16 + (i % 3) * s * 0.7, s * 1.1, s * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.35
  for (let i = -1; i < 12; i++) {
    const x = ((i * 11 - view.col * 0.55) % 28) * s
    ctx.fillStyle = INK.grassDark
    ctx.beginPath()
    ctx.moveTo(x - s * 3, h)
    ctx.quadraticCurveTo(x, h - s * 3.2, x + s * 3, h)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function bumpLift(bumped: Bumped[], col: number, row: number, size: number): number {
  const hit = bumped.find((b) => b.col === col && b.row === row)
  if (!hit) return 0
  // A short hop up and back down, so a knock reads even when nothing comes out.
  return Math.sin((1 - hit.time / 0.18) * Math.PI) * size * 0.34
}

export function drawLevel(ctx: Ctx, run: Run, view: View, w: number): void {
  const s = view.size
  const first = Math.floor(view.col) - 1
  const last = Math.ceil(view.col + w / s) + 1
  const rows = run.level.rows.length

  for (let row = VIEW_TOP; row < rows; row++) {
    for (let col = first; col <= last; col++) {
      const tile = tileNow(run, col, row)
      if (tile === TILE.SKY) continue
      const x = px(view, col)
      const y = py(view, row) - bumpLift(run.bumped, col, row, s)

      switch (tile) {
        case TILE.GROUND: {
          ctx.fillStyle = INK.earth
          ctx.fillRect(x, y, s + 1, s + 1)
          ctx.fillStyle = INK.earthDark
          ctx.fillRect(x, y + s * 0.62, s + 1, s * 0.12)
          ctx.fillRect(x + s * 0.44, y + s * 0.2, s * 0.12, s * 0.3)
          // Grass only on the top course, so the ground has a surface.
          if (tileNow(run, col, row - 1) === TILE.SKY) {
            ctx.fillStyle = INK.grass
            ctx.fillRect(x, y, s + 1, s * 0.3)
            ctx.fillStyle = INK.grassDark
            ctx.fillRect(x, y + s * 0.26, s + 1, s * 0.08)
          }
          break
        }
        case TILE.BRICK:
          box(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.12, INK.brick)
          ctx.fillStyle = INK.brickDark
          ctx.fillRect(x + 1, y + s * 0.46, s - 2, s * 0.08)
          ctx.fillRect(x + s * 0.46, y + 1, s * 0.08, s * 0.45)
          ctx.fillRect(x + s * 0.2, y + s * 0.54, s * 0.08, s * 0.44)
          ctx.fillRect(x + s * 0.72, y + s * 0.54, s * 0.08, s * 0.44)
          break
        case TILE.QUERY:
        case TILE.QUERY_UP: {
          // Question blocks pulse, because a block that might hold something
          // has to look different from one that certainly does not.
          const glow = 0.5 + Math.sin(view.clock * 4 + col) * 0.5
          box(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.14, INK.query)
          ctx.globalAlpha = 0.35 + glow * 0.4
          box(ctx, x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, s * 0.1, '#ffe08a')
          ctx.globalAlpha = 1
          ctx.fillStyle = INK.queryDark
          ctx.font = `bold ${s * 0.62}px system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('?', x + s / 2, y + s * 0.56)
          break
        }
        case TILE.SOLID:
          box(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.1, INK.solid)
          ctx.fillStyle = '#b9bec6'
          ctx.fillRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.14)
          ctx.fillStyle = INK.solidDark
          ctx.fillRect(x + 1, y + s * 0.76, s - 2, s * 0.2)
          break
        case TILE.PIPE_TOP_L:
        case TILE.PIPE_TOP_R: {
          const lip = tile === TILE.PIPE_TOP_L
          ctx.fillStyle = INK.pipe
          ctx.fillRect(x - (lip ? s * 0.12 : 0), y, s + s * 0.12, s)
          ctx.fillStyle = INK.pipeLight
          ctx.fillRect(x - (lip ? s * 0.12 : 0), y, s + s * 0.12, s * 0.16)
          if (lip) ctx.fillRect(x + s * 0.06, y, s * 0.2, s)
          ctx.fillStyle = INK.pipeDark
          ctx.fillRect(x - (lip ? s * 0.12 : 0), y + s * 0.84, s + s * 0.12, s * 0.16)
          break
        }
        case TILE.PIPE_L:
        case TILE.PIPE_R:
          ctx.fillStyle = INK.pipe
          ctx.fillRect(x, y, s + 1, s + 1)
          if (tile === TILE.PIPE_L) {
            ctx.fillStyle = INK.pipeLight
            ctx.fillRect(x + s * 0.18, y, s * 0.2, s + 1)
          } else {
            ctx.fillStyle = INK.pipeDark
            ctx.fillRect(x + s * 0.7, y, s * 0.3, s + 1)
          }
          break
        case TILE.COIN:
          coin(ctx, x + s / 2, y + s / 2, s * 0.3, view.clock + col)
          break
        case TILE.POLE:
          ctx.fillStyle = '#d8d8d8'
          ctx.fillRect(x + s * 0.44, y, s * 0.12, s + 1)
          break
        case TILE.BASE:
          box(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.1, '#2f7c1c')
          break
      }
    }
  }
}

function coin(ctx: Ctx, cx: number, cy: number, r: number, spin: number): void {
  // Spun by squashing it, which is all a coin ever did.
  const wide = Math.abs(Math.cos(spin * 3)) * 0.85 + 0.15
  ctx.fillStyle = INK.coin
  ctx.beginPath()
  ctx.ellipse(cx, cy, r * wide, r, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#b8860b'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r * wide * 0.5, r * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function drawItems(ctx: Ctx, run: Run, view: View): void {
  const s = view.size
  for (const it of run.items) {
    const x = px(view, it.x)
    const y = py(view, it.y)
    if (it.kind === 'coin') {
      coin(ctx, x, y - s * 0.5, s * 0.3, view.clock * 3)
      continue
    }
    // A mushroom: a domed cap with spots, on a stubby stalk.
    box(ctx, x - s * 0.26, y - s * 0.34, s * 0.52, s * 0.34, s * 0.1, '#f0e0c0')
    ctx.fillStyle = '#d83828'
    ctx.beginPath()
    ctx.ellipse(x, y - s * 0.42, s * 0.42, s * 0.34, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    for (const [dx, dy, rr] of [[-0.2, -0.5, 0.1], [0.18, -0.56, 0.09], [0, -0.34, 0.08]] as const) {
      ctx.beginPath()
      ctx.ellipse(x + dx * s, y + dy * s, rr * s, rr * s * 0.85, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function drawEnemies(ctx: Ctx, run: Run, view: View): void {
  const s = view.size
  for (const e of run.enemies) enemy(ctx, e, view, s)
}

function enemy(ctx: Ctx, e: Enemy, view: View, s: number): void {
  const x = px(view, e.x)
  const y = py(view, e.y)
  const squashed = e.squashed > 0

  if (e.kind === 'shell') {
    ctx.fillStyle = INK.shell
    ctx.beginPath()
    ctx.ellipse(x, y - s * 0.3, s * 0.42, s * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = INK.beetle
    ctx.beginPath()
    ctx.ellipse(x, y - s * 0.34, s * 0.36, s * 0.24, 0, Math.PI, 0)
    ctx.fill()
    return
  }

  if (squashed) {
    box(ctx, x - s * 0.42, y - s * 0.2, s * 0.84, s * 0.2, s * 0.08, INK.grubDark)
    return
  }

  const body = e.kind === 'koopa' ? INK.beetle : INK.grub
  const dark = e.kind === 'koopa' ? '#1d6b1d' : INK.grubDark
  // Feet that shuffle, driven by where it is rather than by a clock, so two
  // of them side by side are never in step.
  const shuffle = Math.sin(e.x * 6) * s * 0.1
  ctx.fillStyle = dark
  ctx.fillRect(x - s * 0.3 + shuffle, y - s * 0.16, s * 0.24, s * 0.16)
  ctx.fillRect(x + s * 0.06 - shuffle, y - s * 0.16, s * 0.24, s * 0.16)

  box(ctx, x - s * 0.4, y - s * 0.78, s * 0.8, s * 0.64, s * 0.24, body)
  if (e.kind === 'koopa') {
    ctx.fillStyle = INK.shell
    ctx.beginPath()
    ctx.ellipse(x, y - s * 0.5, s * 0.3, s * 0.2, 0, Math.PI, 0)
    ctx.fill()
  }
  // Eyes, looking the way it is going, which is the only thing that makes a
  // lump of machinery read as alive enough to be worth avoiding.
  const look = Math.sign(e.vx) || 1
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(x + side * s * 0.17, y - s * 0.56, s * 0.12, s * 0.14, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = INK.ink
    ctx.beginPath()
    ctx.ellipse(x + side * s * 0.17 + look * s * 0.04, y - s * 0.56, s * 0.055, s * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * The apprentice.
 *
 * Ours, not anyone else's: goggles pushed up on a yellow cap, green dungarees
 * over a pale shirt, work boots. Bigger after a mushroom, which is the whole
 * point of a mushroom — you can see at a glance what state you are in.
 */
export function drawHero(ctx: Ctx, body: Body, view: View, mercy: number, clock: number): void {
  // Flashing while he cannot be hurt, so the mercy is visible rather than a
  // thing you only learn by being hit twice.
  if (mercy > 0 && Math.floor(clock * 14) % 2 === 0) return

  const s = view.size
  const x = px(view, body.x)
  const y = py(view, body.y)
  const h = bodyHeight(body) * s
  const w = BODY_W * s

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(body.facing, 1)

  const legs = body.onGround ? Math.sin(body.x * 5) * w * 0.18 : w * 0.12
  ctx.fillStyle = INK.boot
  ctx.fillRect(-w * 0.42 + legs, -h * 0.13, w * 0.42, h * 0.13)
  ctx.fillRect(w * 0.02 - legs, -h * 0.13, w * 0.42, h * 0.13)

  // Dungarees over a shirt: the bib is what makes the shape read at any size.
  box(ctx, -w * 0.42, -h * 0.62, w * 0.84, h * 0.5, w * 0.16, INK.cloth)
  box(ctx, -w * 0.34, -h * 0.78, w * 0.68, h * 0.24, w * 0.14, INK.shirt)
  box(ctx, -w * 0.2, -h * 0.74, w * 0.4, h * 0.2, w * 0.1, INK.cloth)
  ctx.fillStyle = INK.clothDark
  ctx.fillRect(-w * 0.42, -h * 0.4, w * 0.84, h * 0.05)

  // An arm, forward, so there is something in front of the body.
  ctx.fillStyle = INK.skin
  const swing = body.onGround ? Math.sin(body.x * 5 + Math.PI) * h * 0.06 : -h * 0.1
  ctx.beginPath()
  ctx.roundRect(w * 0.22, -h * 0.72 + swing, w * 0.26, h * 0.3, w * 0.13)
  ctx.fill()

  // Head, cap and goggles.
  const head = -h * 0.78
  box(ctx, -w * 0.32, head - h * 0.22, w * 0.64, h * 0.24, w * 0.22, INK.skin)
  ctx.fillStyle = INK.skin
  ctx.beginPath()
  ctx.ellipse(w * 0.3, head - h * 0.1, w * 0.1, h * 0.04, 0, 0, Math.PI * 2)
  ctx.fill()
  box(ctx, -w * 0.36, head - h * 0.3, w * 0.72, h * 0.12, w * 0.08, INK.cap)
  ctx.fillStyle = INK.cap
  ctx.fillRect(w * 0.2, head - h * 0.24, w * 0.3, h * 0.05)
  box(ctx, -w * 0.3, head - h * 0.22, w * 0.6, h * 0.07, w * 0.04, INK.goggle)
  ctx.fillStyle = INK.ink
  ctx.fillRect(w * 0.1, head - h * 0.13, w * 0.09, h * 0.05)

  ctx.restore()
}

export function drawFlag(ctx: Ctx, level: Level, view: View, won: boolean, clock: number): void {
  const s = view.size
  const x = px(view, level.pole)
  const top = py(view, VIEW_TOP)
  ctx.fillStyle = won ? '#f4c430' : '#e0e0e0'
  ctx.beginPath()
  ctx.moveTo(x + s * 0.56, top + (won ? s * 6 : s * 0.2) + Math.sin(clock * 3) * 2)
  ctx.lineTo(x + s * 2.1, top + (won ? s * 6.4 : s * 0.6))
  ctx.lineTo(x + s * 0.56, top + (won ? s * 7 : s * 1.2))
  ctx.closePath()
  ctx.fill()
}

/** The buttons, drawn where the pad says they are. */
export function drawPad(
  ctx: Ctx,
  keys: { id: string; cx: number; cy: number; r: number; glyph: string }[],
  pressed: Record<string, boolean>,
): void {
  for (const key of keys) {
    const down = pressed[key.id]
    ctx.globalAlpha = down ? 0.8 : 0.4
    ctx.fillStyle = '#0d1016'
    ctx.beginPath()
    ctx.arc(key.cx, key.cy, key.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = down ? '#ffe08a' : '#cdd6e2'
    ctx.lineWidth = Math.max(2, key.r * 0.09)
    ctx.stroke()

    const a = key.r * 0.42
    ctx.fillStyle = down ? '#ffe08a' : '#eef2f8'
    if (key.glyph === 'left' || key.glyph === 'right') {
      const turn = key.glyph === 'left' ? Math.PI : 0
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const angle = turn + (i * Math.PI * 2) / 3
        const gx = key.cx + Math.cos(angle) * a
        const gy = key.cy + Math.sin(angle) * a
        if (i === 0) ctx.moveTo(gx, gy)
        else ctx.lineTo(gx, gy)
      }
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.font = `bold ${key.r * (key.glyph === 'jump' ? 0.5 : 0.44)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(key.glyph === 'jump' ? 'JUMP' : 'RUN', key.cx, key.cy)
    }
    ctx.globalAlpha = 1
  }
}

export type { Enemy, Item }
