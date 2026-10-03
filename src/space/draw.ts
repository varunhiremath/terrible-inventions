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
import {
  SCRAP_WIDE, SHIP_TALL, SHIP_WIDE, SHOT_WIDE, SIZE_OF, TOUGHNESS,
  type Look, type World,
} from './level'
import type { Bolt, Rubble, Run, Scrap, Shot } from './run'

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
  // The ones that are flying it. Green, because nothing else out here is, and
  // a thing that shoots back has to be recognised before it is identified.
  alien: '#5bd97a',
  alienDark: '#1f7a3c',
  alienGlass: '#d9fff0',
  /** What they fire. Not the colour of your own bolt, for obvious reasons. */
  incoming: '#ff5fa2',
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

/**
 * How far away something is, as a size.
 *
 * Asked for as "perhaps turning the game 3D somehow", and this is the somehow.
 * The model already has a depth in it and always has: `y` runs from nought at
 * the far end to one at the ship. Nothing about where things are had to
 * change — only what that number is taken to *mean*, which until now was
 * "down the screen" and is now "away from you".
 *
 * So a thing arrives small, near the middle, and grows and fans outward as it
 * comes, until at the ship's own line it is full size and exactly where the
 * model says it is. That last part is the one that matters: the fan converges
 * on nothing at the only moment anything is decided.
 *
 * What is deliberately *not* done is move anything up or down. The screen
 * height a thing is at still tracks its distance exactly as before, so the
 * time you have to react to something at a given place on the screen is the
 * same number it has always been. A perspective that also compressed the far
 * half would have made everything rush at the end, which is a harder game
 * wearing a graphics change as a disguise.
 */
const DEPTH = 0.62
export const sizeAt = (y: number) => 1 / (1 + DEPTH * (1 - Math.max(0, Math.min(1, y))))

const px = (view: View, x: number, y = 1) => (0.5 + (x - 0.5) * sizeAt(y)) * view.w
const py = (view: View, y: number) => y * view.h

/**
 * The starfield.
 *
 * Three layers, streaming out from the point everything comes from. Scrolling
 * them straight down was the cheapest way to say "moving"; radiating them is
 * the cheapest way to say which direction, and it is the thing that makes the
 * screen read as a tunnel rather than a waterfall.
 */
export function drawSky(ctx: Ctx, view: View, travelled: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, view.h)
  sky.addColorStop(0, INK.mid)
  sky.addColorStop(1, INK.deep)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, view.w, view.h)

  for (let layer = 0; layer < 3; layer++) {
    const speed = 0.1 + layer * 0.16
    for (let i = 0; i < 26; i++) {
      // Fixed pseudo-random positions, scrolled: the same stars every time, so
      // the sky does not boil.
      const seed = Math.sin(i * 12.9898 + layer * 78.233) * 43758.5453
      const fx = seed - Math.floor(seed)
      const fy = (((seed * 7.13) % 1) + 1) % 1
      /*
       * Each star runs the same journey the rubble does — from the far end to
       * the near one — so it grows, fans out and streaks as it passes. Its
       * `fx` is where in the sky it lives; `fy` only staggers them so they do
       * not all arrive at once.
       */
      const at = (fy + travelled * speed) % 1
      const grow = sizeAt(at)
      const x = (0.5 + (fx - 0.5) * grow) * view.w
      const y = at * view.h
      const size = (0.6 + layer * 0.5) * (0.4 + grow)
      // A streak rather than a dot once it is close, which is what speed looks
      // like when there is nothing else out there to measure against.
      const tail = size * (1 + at * 5)
      ctx.fillStyle = `rgba(232,235,245,${(0.2 + layer * 0.22) * (0.35 + at * 0.8)})`
      ctx.fillRect(x, y - tail, size, tail)
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

  /*
   * Past Neptune it stops being a planet, so it stops being drawn like one.
   *
   * Each of these is the same handful of arcs and gradients as everything else
   * in this project — nothing is an image — and each is built round the one
   * thing that makes it recognisable to somebody who already knows the name.
   * A star has rays. A nebula is a cloud with a point of light buried in it.
   * A black hole is a hole: a disc of nothing with a bright ring round it and
   * the sky bent round the outside. A galaxy is a spiral seen at an angle.
   */
  const look = world.look ?? 'planet'
  if (look !== 'planet' && look !== 'ice') {
    drawFarThing(ctx, world, look, cx, cy, r, view)
    return
  }

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
/**
 * A stable handful of numbers for one piece of rubble.
 *
 * Every rock has to look the same on every frame, so nothing here may use
 * `Math.random`: the shape is a pure function of the piece's id. Each `which`
 * is a different dial on the same rock — corner count, roughness, the angle of
 * the fourth crater — and hashing id and dial together is what stops the
 * dials moving in step, which is what made the first version's rocks all
 * variations on one rock.
 */
function seeded(id: number): (which: number) => number {
  return (which) => {
    let t = (id * 0x9e3779b1 + which * 0x85ebca6b) >>> 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A star, a nebula, a black hole or a galaxy: the things past the planets. */
function drawFarThing(
  ctx: Ctx,
  world: World,
  look: Look,
  cx: number,
  cy: number,
  r: number,
  view: View,
): void {
  const turn = view.clock * 0.1

  if (look === 'star') {
    // A corona, then rays, then the disc. The rays breathe, because a star
    // that holds perfectly still reads as a ball of paint.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.2)
    halo.addColorStop(0, world.band)
    halo.addColorStop(0.35, `${world.body}88`)
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(turn)
    ctx.fillStyle = `${world.band}66`
    for (let i = 0; i < 8; i++) {
      const long = r * (1.8 + Math.sin(view.clock * 1.7 + i) * 0.25)
      ctx.rotate(Math.PI / 4)
      ctx.beginPath()
      ctx.moveTo(0, -r * 0.2)
      ctx.lineTo(long, 0)
      ctx.lineTo(0, r * 0.2)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()

    ctx.fillStyle = world.body
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = world.band
    ctx.beginPath()
    ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
  } else if (look === 'nebula') {
    // Overlapping clouds of two colours, and a few new stars inside it, which
    // is what a nebula is for.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 7; i++) {
      const a = turn * (i % 2 === 0 ? 1 : -1) + i * 1.4
      const px = cx + Math.cos(a) * r * 0.55
      const py = cy + Math.sin(a * 1.3) * r * 0.4
      const puff = ctx.createRadialGradient(px, py, 0, px, py, r * (0.7 + (i % 3) * 0.25))
      puff.addColorStop(0, `${i % 2 === 0 ? world.body : world.band}55`)
      puff.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = puff
      ctx.beginPath()
      ctx.arc(px, py, r * (0.7 + (i % 3) * 0.25), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 9; i++) {
      const seed = Math.sin(i * 42.1) * 9999
      const sx = cx + ((seed - Math.floor(seed)) - 0.5) * r * 1.9
      const sy = cy + ((((seed * 3.7) % 1) + 1) % 1 - 0.5) * r * 1.5
      ctx.globalAlpha = 0.5 + Math.abs(Math.sin(view.clock * 2 + i)) * 0.5
      ctx.beginPath()
      ctx.arc(sx, sy, r * 0.035, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (look === 'hole') {
    /*
     * The sky bent round the outside, then the disc of hot stuff going round,
     * then nothing at all in the middle. The nothing is the point: it is the
     * only thing in this game drawn by *not* drawing.
     */
    const bend = ctx.createRadialGradient(cx, cy, r * 1.0, cx, cy, r * 2.4)
    bend.addColorStop(0, 'rgba(255,176,46,0.22)')
    bend.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = bend
    ctx.beginPath()
    ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1, 0.3)
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 0 ? world.band : `${world.band}${i === 1 ? '99' : '55'}`
      ctx.lineWidth = r * (0.22 - i * 0.06)
      ctx.beginPath()
      ctx.arc(0, 0, r * (1.35 + i * 0.3), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()

    // A jet out of the top, which the real one has.
    ctx.fillStyle = 'rgba(255,224,138,0.3)'
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.12, cy)
    ctx.lineTo(cx + r * 0.12, cy)
    ctx.lineTo(cx + r * 0.4, cy - r * 2.6)
    ctx.lineTo(cx - r * 0.4, cy - r * 2.6)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // A galaxy: a bright middle, and arms wound round it, seen at an angle.
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(0.4)
    ctx.scale(1, 0.42)
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2)
    core.addColorStop(0, world.band)
    core.addColorStop(0.2, `${world.band}aa`)
    core.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = `${world.body}88`
    ctx.lineWidth = r * 0.3
    for (const side of [0, Math.PI]) {
      ctx.beginPath()
      for (let t = 0; t < 1; t += 0.02) {
        const a = side + turn + t * Math.PI * 1.6
        const rad = r * (0.3 + t * 1.7)
        const x = Math.cos(a) * rad
        const y = Math.sin(a) * rad
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  // Whatever is going round it, which for a star is its planets and for a
  // galaxy is nothing at all.
  world.moons.forEach((moon, i) => {
    const going = view.clock * 0.18 + i * 2.2
    const orbit = r * (1.5 + i * 0.32)
    ctx.fillStyle = '#cfd6e2'
    ctx.beginPath()
    ctx.arc(
      cx + Math.cos(going) * orbit,
      cy + Math.sin(going) * orbit * 0.34,
      r * moon.size * 0.6, 0, Math.PI * 2,
    )
    ctx.fill()
  })
}

export function drawRubble(ctx: Ctx, rock: Rubble, view: View): void {
  const x = px(view, rock.x, rock.y)
  const y = py(view, rock.y)
  // Smaller the further off it is. See `sizeAt`: by the time it reaches the
  // ship's line it is full size and exactly where the model says.
  const size = SIZE_OF[rock.kind] * view.w * 0.5 * sizeAt(rock.y)
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

  if (rock.kind === 'comet') {
    /*
     * A head and a tail, and the tail points the way it came from — which for
     * a real comet is away from the Sun rather than backwards along its path,
     * but a comet dropping straight at you from a star dead ahead happens to
     * be the same direction, so the honest drawing and the readable one agree
     * for once.
     *
     * It is drawn bright and small because it is the fastest thing out here:
     * the whole of what it has to say in the fiftieth of a second you get is
     * "that one is not going to wait".
     */
    ctx.save()
    ctx.translate(x, y)
    const tail = ctx.createLinearGradient(0, -size * 7, 0, size)
    tail.addColorStop(0, 'rgba(120,230,255,0)')
    tail.addColorStop(0.6, 'rgba(120,230,255,0.28)')
    tail.addColorStop(1, 'rgba(216,250,255,0.75)')
    ctx.fillStyle = tail
    ctx.beginPath()
    ctx.moveTo(-size * 0.25, -size * 7)
    ctx.lineTo(size * 0.25, -size * 7)
    ctx.lineTo(size * 1.1, size * 0.4)
    ctx.lineTo(-size * 1.1, size * 0.4)
    ctx.closePath()
    ctx.fill()

    const head = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5)
    head.addColorStop(0, '#ffffff')
    head.addColorStop(0.4, lit ? '#ffffff' : '#9fe8ff')
    head.addColorStop(1, 'rgba(159,232,255,0)')
    ctx.fillStyle = head
    ctx.beginPath()
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  if (rock.kind === 'alien') {
    /*
     * A saucer, and it is a saucer on purpose.
     *
     * It needs to be told apart from a drone at a glance and while something
     * else is happening: the drone is a red arrowhead pointing down, this is a
     * green disc with a dome, and the two share no line. Drawn from arcs and
     * ellipses like everything in this project; nothing is copied.
     */
    const tilt = Math.sin(view.clock * 2 + rock.id) * 0.12
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tilt)

    // The hull: a flattened disc with a rim under it.
    ctx.fillStyle = lit ? '#ffffff' : INK.alienDark
    ctx.beginPath()
    ctx.ellipse(0, size * 0.18, size, size * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = lit ? '#ffffff' : INK.alien
    ctx.beginPath()
    ctx.ellipse(0, 0, size, size * 0.34, 0, 0, Math.PI * 2)
    ctx.fill()

    // The dome, and somebody inside it.
    ctx.fillStyle = lit ? '#ffffff' : INK.alienGlass
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.12, size * 0.44, size * 0.42, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = INK.alienDark
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.2, size * 0.17, size * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()

    // Lamps round the rim, chasing, which is how you tell it is alive.
    for (let i = 0; i < 5; i++) {
      const lamp = (Math.floor(view.clock * 7) + i) % 5 === 0
      ctx.fillStyle = lamp ? '#ffe08a' : INK.alienDark
      ctx.beginPath()
      ctx.arc(-size * 0.7 + (i * size * 1.4) / 4, size * 0.2, size * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
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

  /*
   * A rock: a lumpy polygon, the same lumps every time for a given piece.
   *
   * The first version was nine points with a sine wobble off the id, three
   * craters at a fixed radius, and no rotation. Every asteroid in the sky was
   * therefore the same nearly-round blob at the same angle with the same three
   * dents in it, and it was reported exactly that way: they start looking the
   * same. One number varying is not variety — the eye reads the silhouette,
   * and the silhouette was identical.
   *
   * So five things vary now: how many corners it has, how deep the dents
   * between them go, how stretched it is, which way up it is, and how
   * cratered. A seven-cornered sharp one and a thirteen-cornered smooth one
   * are different rocks at a glance, which is the whole job.
   */
  const roll = seeded(rock.id)
  const corners = 7 + Math.floor(roll(1) * 7)
  // How far the corners swing in and out. Low is a pebble, high is a shard.
  const rough = 0.16 + roll(2) * 0.34
  // Stretched one way or the other, then turned, so no two sit the same way up.
  const stretch = 0.76 + roll(3) * 0.5
  const turn = roll(4) * Math.PI * 2

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(turn)

  ctx.fillStyle = lit ? '#ffffff' : INK.rock
  ctx.beginPath()
  for (let i = 0; i < corners; i++) {
    const a = (i / corners) * Math.PI * 2
    const wobble = 1 - rough + roll(10 + i) * rough * 2
    const rx = Math.cos(a) * size * wobble * stretch
    const ry = Math.sin(a) * size * wobble
    if (i === 0) ctx.moveTo(rx, ry)
    else ctx.lineTo(rx, ry)
  }
  ctx.closePath()
  ctx.fill()

  // Craters, so a rock is not a blob — a different number in different places
  // on each one, and small enough to stay inside the outline.
  ctx.fillStyle = INK.rockDark
  const pits = 2 + Math.floor(roll(5) * 4)
  for (let i = 0; i < pits; i++) {
    const a = roll(30 + i) * Math.PI * 2
    const out = 0.16 + roll(50 + i) * 0.42
    const wide = size * (0.09 + roll(70 + i) * 0.13)
    ctx.beginPath()
    ctx.arc(Math.cos(a) * size * out * stretch, Math.sin(a) * size * out, wide, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

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
  const x = px(view, cell.x, cell.y)
  const y = py(view, cell.y)
  const size = SCRAP_WIDE * view.w * (cell.worth >= 5 ? 1.25 : 1) * sizeAt(cell.y)
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

/**
 * Something coming the other way.
 *
 * A ball with a tail behind it rather than a line like yours, and in a colour
 * your own fire never uses — at the moment there are six things on the screen
 * the only question worth answering in a fiftieth of a second is "is that one
 * mine".
 */
export function drawShot(ctx: Ctx, shot: Shot, view: View): void {
  const x = px(view, shot.x, shot.y)
  const y = py(view, shot.y)
  const r = SHOT_WIDE * view.w * 0.5 * sizeAt(shot.y)

  ctx.fillStyle = 'rgba(255,95,162,0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y - r * 1.6, r * 0.7, r * 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = INK.incoming
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffe3ef'
  ctx.beginPath()
  ctx.arc(x, y, r * 0.42, 0, Math.PI * 2)
  ctx.fill()
}

export function drawBolt(ctx: Ctx, bolt: Bolt, view: View): void {
  const x = px(view, bolt.x, bolt.y)
  const y = py(view, bolt.y)
  // Yours shrinks as it goes away from you, which is the other half of the
  // depth: without it the bolt is the one thing on the screen with no distance.
  const long = view.h * 0.035 * sizeAt(bolt.y)
  const grad = ctx.createLinearGradient(x, y - long, x, y + long)
  grad.addColorStop(0, 'rgba(143,240,255,0)')
  grad.addColorStop(0.5, INK.bolt)
  grad.addColorStop(1, 'rgba(143,240,255,0)')
  ctx.fillStyle = grad
  const wide = view.w * 0.016 * sizeAt(bolt.y)
  ctx.fillRect(x - wide / 2, y - long, wide, long * 2)
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

  /*
   * Which way the current is running, if there is one.
   *
   * A force you cannot see is a game cheating at you. Out past Neptune the
   * place drags the ship sideways and turns a few times on the way, so the
   * sky says so: a drift of streaks across it, going the way you are being
   * pushed and as fast as you are being pushed. Nothing to read, nothing to
   * learn — you can feel the stick fighting you and the sky agrees with it.
   */
  const pull = run.world.pull ?? 0
  if (pull > 0) {
    const way = Math.sin(run.progress * Math.PI * 2 * 2.5)
    ctx.save()
    ctx.strokeStyle = `rgba(216,226,240,${0.07 + Math.abs(way) * 0.13})`
    ctx.lineWidth = Math.max(1, view.h * 0.002)
    for (let i = 0; i < 14; i++) {
      const seed = Math.sin(i * 33.7) * 9999
      const fy = seed - Math.floor(seed)
      const y = fy * view.h
      const drift = ((view.clock * way * 0.22 + fy) % 1.4) - 0.2
      const x = drift * width
      const long = width * 0.1 * Math.abs(way)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + long * Math.sign(way || 1), y)
      ctx.stroke()
    }
    ctx.restore()
  }
  for (const bolt of run.bolts) drawBolt(ctx, bolt, play)
  for (const cell of run.scrap) drawCell(ctx, cell, play)
  /*
   * Furthest first, so the near thing is the one in front.
   *
   * It did not matter while everything was the same size and simply fell: two
   * rocks overlapping looked like two rocks overlapping whichever order they
   * went down in. It matters the moment there is depth, because a saucer drawn
   * over a rock that is plainly closer than it is reads as a mistake — which
   * is exactly what the first picture of this showed.
   */
  for (const rock of [...run.rubble].sort((a, b) => a.y - b.y)) drawRubble(ctx, rock, play)
  // Over the rubble whatever its distance: what is about to hit you is never
  // the thing hidden behind something else.
  for (const shot of run.shots) drawShot(ctx, shot, play)
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
