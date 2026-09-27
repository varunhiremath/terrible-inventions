/**
 * Space, drawn.
 *
 * Everything from primitives, like the rest of this project. The model works
 * in fractions of the screen, so everything here is one multiply away from
 * pixels — which also means the picture is the same shape on any phone.
 *
 * The world you are flying to sits at the top and grows as you close on it.
 * That is the whole of the progress bar: you can see how far there is to go by
 * looking at Jupiter.
 */
import { drawHint } from '../ui/padHints'
import { SCRAP_WIDE, SHIP_TALL, SHIP_WIDE, SIZE_OF, TOUGHNESS, type World } from './level'
import type { Bolt, Rubble, Run, Scrap } from './run'

type Ctx = CanvasRenderingContext2D

export const INK = {
  deep: '#05060f',
  mid: '#0b1024',
  hull: '#d8e2f0',
  hullDark: '#8a97ad',
  glass: '#58b9ff',
  flame: '#ffb02e',
  bolt: '#8ff0ff',
  rock: '#7a6a5a',
  rockDark: '#584b3f',
  shard: '#a89a86',
  drone: '#e8503a',
  droneDark: '#8f2a1c',
  mine: '#b07de0',
  scrap: '#ffd23f',
} as const

export interface View {
  w: number
  h: number
  clock: number
}

/**
 * How wide the flyable column is, and where it starts.
 *
 * The model works in fractions of the screen's width, which is fine until the
 * phone is held sideways: at that point one fraction of the width is three
 * times as many pixels as the same fraction of the height, so the rocks come
 * out the size of houses and the ship comes out a pancake. Held sideways the
 * first version of this was unplayable and looked like a bug.
 *
 * So the column the game is played in is capped against the height and centred,
 * and the sky carries on past it either side. Everything inside keeps its
 * proportions and the fairness maths — which is all in those same fractions —
 * does not have to know this happened. The road solved the identical problem
 * the identical way; it is the same lesson twice.
 *
 * The ratio is chosen so the ship is a little wider than tall, which is what a
 * delta looks like from behind.
 */
const COLUMN = 1.15

export function columnOf(view: View): { width: number; left: number } {
  const width = Math.min(view.w, view.h * COLUMN)
  return { width, left: (view.w - width) / 2 }
}

/** Inside the column: the view a piece of rubble is positioned against. */
const inside = (view: View): View => ({ ...view, w: columnOf(view).width })

const px = (view: View, x: number) => x * view.w
const py = (view: View, y: number) => y * view.h

/**
 * The starfield.
 *
 * Three layers at different speeds, which is the cheapest way to say "moving"
 * when there is nothing else on screen to measure against.
 */
export function drawSky(ctx: Ctx, view: View, travelled: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, view.h)
  sky.addColorStop(0, INK.mid)
  sky.addColorStop(1, INK.deep)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, view.w, view.h)

  for (let layer = 0; layer < 3; layer++) {
    const speed = 12 + layer * 26
    const size = 1 + layer * 0.8
    ctx.fillStyle = `rgba(232,235,245,${0.25 + layer * 0.25})`
    for (let i = 0; i < 26; i++) {
      // Fixed pseudo-random positions, scrolled: the same stars every time, so
      // the sky does not boil.
      const seed = Math.sin(i * 12.9898 + layer * 78.233) * 43758.5453
      const fx = seed - Math.floor(seed)
      const fy = (((seed * 7.13) % 1) + 1) % 1
      const y = ((fy * view.h + travelled * speed) % (view.h + 20)) - 10
      ctx.fillRect(fx * view.w, y, size, size)
    }
  }
}

/** The destination, growing as you close on it. */
export function drawWorld(ctx: Ctx, world: World, progress: number, view: View): void {
  const grow = 0.08 + progress * 0.9
  const r = Math.min(view.w, view.h) * 0.26 * grow
  const cx = view.w * 0.5
  /*
   * Fully on screen, always.
   *
   * It used to sit half off the top edge, which at the start of a run — when
   * it is barely bigger than a star — left a grey smudge behind the header
   * that read as a rendering fault rather than as Mercury. Sitting just below
   * the top it is small and distant at the start and fills the sky by the
   * time you get there, which is the entire progress bar as far as the eye is
   * concerned.
   */
  const cy = r * 0.95 + view.h * 0.02

  if (world.rings) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1, 0.26)
    ctx.strokeStyle = 'rgba(232,211,163,0.75)'
    ctx.lineWidth = r * 0.16
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(232,211,163,0.4)'
    ctx.lineWidth = r * 0.08
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.85, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  ctx.fillStyle = world.body
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Bands across it, clipped to the disc, which is what stops a planet being
  // a circle of flat colour.
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = world.band
  for (let i = 0; i < 4; i++) {
    const by = cy - r + (i * 2 + 1) * r * 0.26
    ctx.beginPath()
    ctx.ellipse(cx, by, r * 1.1, r * 0.09, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // A terminator, so it reads as a ball rather than a disc.
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.arc(cx + r * 0.42, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  world.moons.forEach((moon, i) => {
    const turn = view.clock * 0.18 + i * 2.2
    const orbit = r * (1.5 + i * 0.32)
    const mx = cx + Math.cos(turn) * orbit
    const my = cy + Math.sin(turn) * orbit * 0.34
    ctx.fillStyle = '#cfd6e2'
    ctx.beginPath()
    ctx.arc(mx, my, r * moon.size * 0.6, 0, Math.PI * 2)
    ctx.fill()
  })
}

/** One piece of rubble. */
export function drawRubble(ctx: Ctx, rock: Rubble, view: View): void {
  const x = px(view, rock.x)
  const y = py(view, rock.y)
  const size = SIZE_OF[rock.kind] * view.w * 0.5
  const lit = rock.flash > 0

  if (rock.kind === 'shard') {
    ctx.fillStyle = lit ? '#ffffff' : INK.shard
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(view.clock * 1.4 + rock.id)
    ctx.beginPath()
    ctx.moveTo(0, -size)
    ctx.lineTo(size * 0.55, size * 0.5)
    ctx.lineTo(-size * 0.55, size * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    return
  }

  if (rock.kind === 'drone') {
    // A craft rather than a stone: swept wings and a lit eye.
    ctx.fillStyle = lit ? '#ffffff' : INK.drone
    ctx.beginPath()
    ctx.moveTo(x, y + size)
    ctx.lineTo(x + size, y - size * 0.35)
    ctx.lineTo(x + size * 0.35, y - size * 0.7)
    ctx.lineTo(x - size * 0.35, y - size * 0.7)
    ctx.lineTo(x - size, y - size * 0.35)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = INK.droneDark
    ctx.fillRect(x - size * 0.5, y - size * 0.1, size, size * 0.18)
    ctx.fillStyle = Math.floor(view.clock * 6) % 2 === 0 ? '#ffe08a' : '#ffb02e'
    ctx.beginPath()
    ctx.arc(x, y - size * 0.3, size * 0.2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  if (rock.kind === 'mine') {
    // Spikes, and a colour nothing else uses, because this one cannot be shot
    // and has to be recognised instantly.
    ctx.strokeStyle = INK.mine
    ctx.lineWidth = Math.max(2, size * 0.18)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + view.clock * 0.6
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * size * 0.4, y + Math.sin(a) * size * 0.4)
      ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size)
      ctx.stroke()
    }
    ctx.fillStyle = INK.mine
    ctx.beginPath()
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = Math.floor(view.clock * 8) % 2 === 0 ? '#ffffff' : '#2a0d30'
    ctx.beginPath()
    ctx.arc(x, y, size * 0.18, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  // A rock: a lumpy polygon, the same lumps every time for a given piece.
  ctx.fillStyle = lit ? '#ffffff' : INK.rock
  ctx.beginPath()
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const wobble = 0.72 + ((Math.sin(rock.id * 3.1 + i * 2.7) + 1) / 2) * 0.42
    const rx = x + Math.cos(a) * size * wobble
    const ry = y + Math.sin(a) * size * wobble
    if (i === 0) ctx.moveTo(rx, ry)
    else ctx.lineTo(rx, ry)
  }
  ctx.closePath()
  ctx.fill()

  // Craters, so a rock is not a blob.
  ctx.fillStyle = INK.rockDark
  for (let i = 0; i < 3; i++) {
    const a = rock.id * 1.7 + i * 2.1
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * size * 0.4, y + Math.sin(a) * size * 0.4, size * 0.17, 0, Math.PI * 2)
    ctx.fill()
  }

  /*
   * How much is left in it — but only once it has been hit.
   *
   * Drawn on every rock from the start, this was three white ticks hanging off
   * the bottom of each one, which read as debris rather than as a reading. The
   * shape and colour already say what kind of thing it is; the pips only need
   * to answer the question you ask after the first shot, which is "how many
   * more of those?"
   */
  if (TOUGHNESS[rock.kind] > 1 && rock.health < TOUGHNESS[rock.kind]) {
    const pip = size * 0.2
    const span = pip * (rock.health * 1.4 - 0.4)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(x - span / 2 - pip * 0.3, y - pip * 0.5, span + pip * 0.6, pip)
    ctx.fillStyle = '#ffe08a'
    for (let i = 0; i < rock.health; i++) {
      ctx.fillRect(x - span / 2 + i * pip * 1.4, y - pip * 0.4, pip, pip * 0.8)
    }
  }
}

/**
 * A cell of scrap, falling.
 *
 * Gold, spinning, and the only thing on screen you are allowed to fly into.
 * It has to be readable as "get this" at a glance and it has to look nothing
 * like a mine, which is the other small round thing in the sky.
 */
export function drawCell(ctx: Ctx, cell: Scrap, view: View): void {
  const x = px(view, cell.x)
  const y = py(view, cell.y)
  const size = SCRAP_WIDE * view.w * (cell.worth >= 5 ? 1.25 : 1)
  const turn = view.clock * 3 + cell.id

  // A squashed hexagon, spinning about its upright: a coin seen edge-on and
  // then flat again, which is the oldest "pick me up" in the business.
  const squash = Math.abs(Math.cos(turn)) * 0.8 + 0.2
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(squash, 1)
  ctx.fillStyle = INK.scrap
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const cx2 = Math.cos(a) * size
    const cy2 = Math.sin(a) * size
    if (i === 0) ctx.moveTo(cx2, cy2)
    else ctx.lineTo(cx2, cy2)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#8a5a12'
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // A little light around it, so it is findable against the star field.
  const glow = ctx.createRadialGradient(x, y, size * 0.4, x, y, size * 2.2)
  glow.addColorStop(0, 'rgba(255,210,63,0.35)')
  glow.addColorStop(1, 'rgba(255,210,63,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, size * 2.2, 0, Math.PI * 2)
  ctx.fill()
}

export function drawBolt(ctx: Ctx, bolt: Bolt, view: View): void {
  const x = px(view, bolt.x)
  const y = py(view, bolt.y)
  const long = view.h * 0.035
  const grad = ctx.createLinearGradient(x, y - long, x, y + long)
  grad.addColorStop(0, 'rgba(143,240,255,0)')
  grad.addColorStop(0.5, INK.bolt)
  grad.addColorStop(1, 'rgba(143,240,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(x - view.w * 0.008, y - long, view.w * 0.016, long * 2)
}

/**
 * Yours: a delta with the engines outboard.
 *
 * Its own shape rather than anybody else's — a long nose, swept wings, two
 * pods at the back with the flame coming out of them.
 */
export function drawShip(ctx: Ctx, x: number, view: View, mercy: number, clock: number): void {
  const cx = px(view, x)
  const cy = view.h * (1 - SHIP_TALL * 0.8)
  const w = SHIP_WIDE * view.w
  const h = SHIP_TALL * view.h

  // Shielded: flickers, so it is obvious you cannot be hit for the moment.
  if (mercy > 0 && Math.floor(clock * 12) % 2 === 0) return

  // Flame first, so the hull sits over it.
  const flare = 0.6 + Math.abs(Math.sin(clock * 22)) * 0.5
  ctx.fillStyle = INK.flame
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + side * w * 0.3, cy + h * 0.38)
    ctx.lineTo(cx + side * w * 0.16, cy + h * 0.38)
    ctx.lineTo(cx + side * w * 0.23, cy + h * (0.38 + 0.5 * flare))
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = INK.hull
  ctx.beginPath()
  ctx.moveTo(cx, cy - h * 0.62)
  ctx.lineTo(cx + w * 0.18, cy - h * 0.1)
  ctx.lineTo(cx + w * 0.5, cy + h * 0.3)
  ctx.lineTo(cx + w * 0.34, cy + h * 0.4)
  ctx.lineTo(cx - w * 0.34, cy + h * 0.4)
  ctx.lineTo(cx - w * 0.5, cy + h * 0.3)
  ctx.lineTo(cx - w * 0.18, cy - h * 0.1)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = INK.hullDark
  ctx.fillRect(cx - w * 0.4, cy + h * 0.26, w * 0.8, h * 0.1)

  ctx.fillStyle = INK.glass
  ctx.beginPath()
  ctx.ellipse(cx, cy - h * 0.18, w * 0.11, h * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Everything, in the order it has to go down.
 *
 * The sky is painted across the whole box; the game is played in the column,
 * which on a phone held upright is the whole box and held sideways is a strip
 * down the middle of it.
 */
export function drawRun(ctx: Ctx, run: Run, view: View, travelled: number): void {
  drawSky(ctx, view, travelled)

  const { width, left } = columnOf(view)
  const play = inside(view)
  ctx.save()
  ctx.translate(left, 0)

  // The edges of what you can fly in, when there is anything outside them.
  // Without these a wall you cannot see stops the ship halfway across a wide
  // screen, which reads as the controls sticking.
  if (left > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(-left, 0, left, view.h)
    ctx.fillRect(width, 0, left, view.h)
    ctx.fillStyle = 'rgba(88,185,255,0.25)'
    ctx.fillRect(-1, 0, 2, view.h)
    ctx.fillRect(width - 1, 0, 2, view.h)
  }

  drawWorld(ctx, run.world, run.progress, play)
  for (const bolt of run.bolts) drawBolt(ctx, bolt, play)
  for (const cell of run.scrap) drawCell(ctx, cell, play)
  for (const rock of run.rubble) drawRubble(ctx, rock, play)
  drawShip(ctx, run.x, play, run.mercy, view.clock)
  ctx.restore()
}

/** The pad, in the same style as everywhere else. */
export function drawPad(
  ctx: Ctx,
  keys: { id: string; cx: number; cy: number; r: number; glyph: string }[],
  pressed: Record<string, boolean>,
  hints?: { alpha: number; labels: Record<string, string> },
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
      ctx.font = `bold ${key.r * 0.42}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('FIRE', key.cx, key.cy)
    }
    ctx.globalAlpha = 1
  }

  if (hints && hints.alpha > 0) {
    for (const key of keys) {
      const text = hints.labels[key.id]
      if (!text) continue
      drawHint(ctx, key.cx, key.cy - key.r * 1.45, text, Math.max(9, key.r * 0.3), hints.alpha)
    }
  }
}
