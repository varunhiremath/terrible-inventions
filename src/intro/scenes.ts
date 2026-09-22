/**
 * The pictures.
 *
 * Each scene is a function of how far through its beat we are, so it can be
 * scrubbed, paused or replayed and always looks the same at the same moment.
 * Nothing here reads a clock of its own.
 *
 * They are drawn with the games' own code wherever there is any — the dungeon's
 * figure, the pipes' apprentice and enemies — so the person in the intro is
 * literally the person in the game rather than a drawing of them. That costs
 * nothing and it is the difference between an intro about the game and an
 * intro next to it.
 */
import { drawFigure, type Look } from '../arcade/dungeon/figure'
import { poseFor } from '../arcade/dungeon/draw'
import { drawHero, INK as PIPE_INK } from '../pipes/draw'
import { VIEW_TOP } from '../pipes/level'
import { newBody } from '../pipes/physics'

type Ctx = CanvasRenderingContext2D

export interface Stage {
  ctx: Ctx
  w: number
  h: number
  /** How far through this beat, 0 to 1. */
  t: number
  /** Seconds since the story began, for anything that should not restart. */
  clock: number
}

/** Eased, so nothing in a cutscene moves at a constant speed. */
const ease = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function wash(ctx: Ctx, w: number, h: number, top: string, bottom: string): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, top)
  sky.addColorStop(1, bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
}

/** Papa, looming. The villain of all four of these. */
function papa(ctx: Ctx, cx: number, cy: number, s: number, menace: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(s, s)

  ctx.fillStyle = '#2a2f3a'
  ctx.beginPath()
  ctx.ellipse(0, 0.3, 1.1, 1.25, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d8a878'
  ctx.beginPath()
  ctx.ellipse(0, -0.05, 0.78, 0.92, 0, 0, Math.PI * 2)
  ctx.fill()
  // Hair, a moustache, and eyebrows that come down as the menace goes up.
  ctx.fillStyle = '#3a2a20'
  ctx.beginPath()
  ctx.ellipse(0, -0.62, 0.8, 0.34, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(-0.34, 0.3, 0.68, 0.14)
  const brow = lerp(-0.34, -0.22, menace)
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#3a2a20'
    ctx.save()
    ctx.translate(side * 0.34, brow)
    ctx.rotate(side * lerp(0, 0.45, menace))
    ctx.fillRect(-0.22, -0.05, 0.44, 0.1)
    ctx.restore()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(side * 0.34, -0.12, 0.19, 0.16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1410'
    ctx.beginPath()
    ctx.ellipse(side * 0.34 + 0.03, -0.12, 0.08, 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // A grin that widens with the menace, because that is all a villain needs.
  ctx.strokeStyle = '#8a4a3a'
  ctx.lineWidth = 0.07
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0.28, lerp(0.2, 0.36, menace), 0.2, Math.PI - 0.2)
  ctx.stroke()
  ctx.restore()
}

/** A wall of masonry, for the dungeon scenes. */
function stone(ctx: Ctx, w: number, h: number, s: number, shade: string, lit: string): void {
  for (let y = 0; y < h + s; y += s * 0.6) {
    const offset = Math.round(y / (s * 0.6)) % 2 === 0 ? 0 : s * 0.5
    for (let x = -s; x < w + s; x += s) {
      ctx.fillStyle = shade
      ctx.fillRect(x + offset + 2, y + 2, s - 4, s * 0.6 - 4)
      ctx.fillStyle = lit
      ctx.fillRect(x + offset + 2, y + 2, s - 4, s * 0.06)
    }
  }
}

const PRINCE: Look = {
  body: '#efe7d6', legs: '#e4dbc6', trim: '#c0392b', skin: '#e0a878',
  hair: '#2b1d14', band: '#2f5f9e', sleeveless: true, barefoot: true, loose: true,
}
const GUARD: Look = {
  body: '#a83232', legs: '#6b3a86', trim: '#e0b13c', skin: '#c99a6a',
  hair: '#1f1611', band: '#e0b13c', turban: true, coat: true, loose: true, curved: true,
}

/** Every scene any story can name. */
export const SCENES: Record<string, (stage: Stage) => void> = {
  /** A workshop at night: this is where all four of these start. */
  workshop({ ctx, w, h, t }) {
    wash(ctx, w, h, '#161a24', '#0a0c12')
    const s = Math.min(w, h)
    // Cogs turning behind him, at different rates so it reads as machinery.
    for (const [cx, cy, r, speed] of [[0.2, 0.3, 0.16, 1], [0.34, 0.2, 0.1, -1.6], [0.8, 0.72, 0.2, 0.7]] as const) {
      ctx.save()
      ctx.translate(cx * w, cy * h)
      ctx.rotate(t * speed * 4)
      ctx.strokeStyle = 'rgba(180,150,90,0.3)'
      ctx.lineWidth = s * 0.02
      ctx.beginPath()
      ctx.arc(0, 0, r * s, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * r * s, Math.sin(a) * r * s)
        ctx.lineTo(Math.cos(a) * r * s * 1.22, Math.sin(a) * r * s * 1.22)
        ctx.stroke()
      }
      ctx.restore()
    }
    // And Papa rising into the middle of it.
    // Up and settled inside the first second: he is the point of the scene,
    // and a villain still rising into shot when his line ends is not menacing,
    // he is late.
    papa(ctx, w / 2, h * lerp(1.25, 0.42, ease(Math.min(1, t * 4))), s * 0.28, Math.min(1, t * 3))
  },

  /** The maze, filling with chasers. */
  maze({ ctx, w, h, t }) {
    wash(ctx, w, h, '#05070c', '#0b1020')
    const s = Math.min(w, h) * 0.075
    ctx.strokeStyle = '#cdd6e2'
    ctx.lineWidth = Math.max(2, s * 0.12)
    for (let i = 0; i < 9; i++) {
      const y = h * 0.16 + i * s * 0.9
      ctx.globalAlpha = 0.25 + (i % 2) * 0.2
      ctx.beginPath()
      ctx.moveTo(w * 0.08, y)
      ctx.lineTo(w * 0.92, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    // Dots, going out one by one as the runner passes them.
    const eaten = ease(t) * 14
    for (let i = 0; i < 14; i++) {
      if (i < eaten) continue
      ctx.fillStyle = '#ffe9a8'
      ctx.beginPath()
      ctx.arc(w * 0.12 + i * w * 0.058, h * 0.62, s * 0.11, 0, Math.PI * 2)
      ctx.fill()
    }
    const runnerX = w * 0.1 + ease(t) * w * 0.8
    const chomp = Math.abs(Math.sin(t * 22)) * 0.5 + 0.06
    ctx.fillStyle = '#ffd23f'
    ctx.beginPath()
    ctx.arc(runnerX, h * 0.62, s * 0.55, chomp, Math.PI * 2 - chomp)
    ctx.lineTo(runnerX, h * 0.62)
    ctx.fill()
    // Four of them, strung out behind and closing.
    const chasers = ['#e8433a', '#f0a13c', '#6ad0e8', '#f28ac8']
    chasers.forEach((colour, i) => {
      const x = runnerX - w * (0.16 + i * 0.09) * (1.3 - ease(t) * 0.5)
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.arc(x, h * 0.62, s * 0.5, Math.PI, 0)
      ctx.lineTo(x + s * 0.5, h * 0.62 + s * 0.42)
      ctx.lineTo(x - s * 0.5, h * 0.62 + s * 0.42)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(x + side * s * 0.19, h * 0.62 - s * 0.1, s * 0.15, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },

  /** A cave, a trophy, and a very long way down. */
  cave({ ctx, w, h, t }) {
    wash(ctx, w, h, '#1a0f08', '#080503')
    const s = Math.min(w, h) * 0.08
    ctx.fillStyle = '#7a3508'
    for (let x = 0; x < w; x += s) {
      ctx.fillRect(x, h * 0.78, s - 2, h * 0.3)
      ctx.fillRect(x, 0, s - 2, h * 0.16)
    }
    // Fire, licking up out of the floor between two ledges.
    const flame = 0.6 + Math.sin(t * 18) * 0.4
    for (const fx of [0.42, 0.52]) {
      const grad = ctx.createLinearGradient(0, h * 0.78, 0, h * (0.78 - 0.2 * flame))
      grad.addColorStop(0, '#ffcf4a')
      grad.addColorStop(1, 'rgba(226,86,28,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(w * fx - s * 0.5, h * 0.78)
      ctx.quadraticCurveTo(w * fx, h * (0.78 - 0.3 * flame), w * fx + s * 0.5, h * 0.78)
      ctx.fill()
    }
    // The trophy, glinting, which is the whole of what the game wants from you.
    const glint = 0.5 + Math.sin(t * 8) * 0.5
    ctx.fillStyle = '#f4c430'
    ctx.beginPath()
    ctx.moveTo(w * 0.82, h * 0.7)
    ctx.lineTo(w * 0.9, h * 0.7)
    ctx.lineTo(w * 0.87, h * 0.78)
    ctx.lineTo(w * 0.85, h * 0.78)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = `rgba(255,255,255,${0.25 + glint * 0.5})`
    ctx.beginPath()
    ctx.arc(w * 0.86, h * 0.68, s * (0.3 + glint * 0.2), 0, Math.PI * 2)
    ctx.fill()
    // And a small figure picking his way towards it.
    const x = lerp(w * 0.1, w * 0.36, ease(t))
    ctx.fillStyle = '#3a6ed0'
    ctx.fillRect(x, h * 0.66, s * 0.4, s * 0.7)
    ctx.fillStyle = '#e0a878'
    ctx.fillRect(x + s * 0.06, h * 0.6, s * 0.28, s * 0.22)
  },

  /** Torchlight, stone, and a clock running down. */
  dungeon({ ctx, w, h, t, clock }) {
    wash(ctx, w, h, '#12151a', '#080a0e')
    stone(ctx, w, h * 0.55, Math.min(w, h) * 0.12, '#232a33', '#2f3842')
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, h * 0.55, w, h * 0.45)
    // A torch, with the pool of light a flame actually makes.
    const flick = Math.sin(clock * 11) * 0.5 + 0.5
    const s = Math.min(w, h)
    const glow = ctx.createRadialGradient(w * 0.78, h * 0.3, s * 0.02, w * 0.78, h * 0.3, s * (0.3 + flick * 0.04))
    glow.addColorStop(0, 'rgba(255,190,90,0.5)')
    glow.addColorStop(1, 'rgba(255,150,50,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ff9a1f'
    ctx.beginPath()
    ctx.ellipse(w * 0.78, h * 0.3, s * 0.022, s * (0.05 + flick * 0.02), 0, 0, Math.PI * 2)
    ctx.fill()
    // The floor he is running along, and him running along it.
    ctx.fillStyle = '#79838f'
    ctx.fillRect(0, h * 0.74, w, h * 0.03)
    const size = s * 0.2
    const frame = Math.floor(t * 14) % 4
    drawFigure(
      ctx, lerp(w * 0.12, w * 0.6, ease(t)), h * 0.74, size, 1,
      poseFor('run', frame, 'none'), PRINCE, 'warrior', false,
    )
    drawFigure(
      ctx, lerp(w * 1.15, w * 0.85, ease(t)), h * 0.74, size, -1,
      poseFor('stand', 0, 'ready'), GUARD, 'warrior', true,
    )
  },

  /** Blue sky, green pipes, and something marching towards you. */
  pipes({ ctx, w, h, t }) {
    wash(ctx, w, h, PIPE_INK.skyDeep, PIPE_INK.sky)
    const s = Math.min(w, h) * 0.15
    // The ground sits high enough that the caption along the bottom never
    // covers the thing the caption is talking about.
    const floor = h * 0.62
    ctx.fillStyle = PIPE_INK.earth
    ctx.fillRect(0, floor, w, h)
    ctx.fillStyle = PIPE_INK.grass
    ctx.fillRect(0, floor, w, s * 0.28)
    for (const [px, height] of [[0.58, 1.5], [0.86, 2.2]] as const) {
      ctx.fillStyle = PIPE_INK.pipe
      ctx.fillRect(w * px, floor - s * height, s * 1.3, s * height)
      ctx.fillStyle = PIPE_INK.pipeLight
      ctx.fillRect(w * px + s * 0.2, floor - s * height, s * 0.25, s * height)
      ctx.fillStyle = PIPE_INK.pipe
      ctx.fillRect(w * px - s * 0.12, floor - s * height, s * 1.54, s * 0.34)
    }
    // A wind-up machine plodding the other way.
    const gx = lerp(w * 0.98, w * 0.46, ease(t))
    ctx.fillStyle = PIPE_INK.grubDark
    ctx.fillRect(gx - s * 0.28, floor - s * 0.14, s * 0.22, s * 0.14)
    ctx.fillRect(gx + s * 0.06, floor - s * 0.14, s * 0.22, s * 0.14)
    ctx.fillStyle = PIPE_INK.grub
    ctx.beginPath()
    ctx.roundRect(gx - s * 0.38, floor - s * 0.76, s * 0.76, s * 0.62, s * 0.22)
    ctx.fill()
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(gx + side * s * 0.16, floor - s * 0.54, s * 0.11, s * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1410'
      ctx.beginPath()
      ctx.ellipse(gx + side * s * 0.16 - s * 0.03, floor - s * 0.54, s * 0.05, s * 0.07, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // And the apprentice, jumping clean over it. Drawn with the game's own
    // code, which measures rows from the top of the *visible* level rather
    // than from the top of the screen — so his feet have to be converted, not
    // guessed. Guessing put him off the top of the picture entirely.
    const hop = ease(Math.min(1, t * 1.15))
    const feet = VIEW_TOP + (floor - Math.sin(hop * Math.PI) * s * 2.2) / s
    drawHero(
      ctx,
      { ...newBody(0, 0), x: lerp(w * 0.08, w * 0.62, hop) / s, y: feet, facing: 1, onGround: false },
      { col: 0, size: s, clock: t },
      0,
      t,
    )
  },

  /** The maths door, which is the point of the whole app. */
  workshopDoor({ ctx, w, h, t }) {
    wash(ctx, w, h, '#1a1f2b', '#0c0f16')
    const s = Math.min(w, h)
    // A door standing open, with light coming through it.
    const open = ease(Math.min(1, t * 1.4))
    ctx.fillStyle = '#f2d98a'
    ctx.globalAlpha = 0.14 + open * 0.2
    ctx.beginPath()
    ctx.moveTo(w * 0.5, h * 0.2)
    ctx.lineTo(w * 1.1, h * 1.1)
    ctx.lineTo(w * -0.1, h * 1.1)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#e8c88a'
    ctx.fillRect(w * 0.5 - s * 0.14, h * 0.2, s * 0.28 * open, h * 0.6)
    ctx.strokeStyle = '#8a6a3a'
    ctx.lineWidth = Math.max(2, s * 0.012)
    ctx.strokeRect(w * 0.5 - s * 0.14, h * 0.2, s * 0.28, h * 0.6)
    // Sums drifting up out of it.
    ctx.fillStyle = '#ffe9a8'
    ctx.font = `bold ${s * 0.07}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    const sums = ['7 × 8', '144 ÷ 12', '96 + 47', '15²']
    sums.forEach((sum, i) => {
      const lift = ((t * 0.4 + i * 0.25) % 1)
      ctx.globalAlpha = Math.sin(lift * Math.PI) * 0.9
      ctx.fillText(sum, w * (0.5 + Math.sin(i * 2 + lift * 2) * 0.22), h * (0.8 - lift * 0.55))
    })
    ctx.globalAlpha = 1
  },

  /** The title card each story lands on. */
  title({ ctx, w, h, t }) {
    wash(ctx, w, h, '#0e1118', '#05070b')
    const s = Math.min(w, h)
    const grow = ease(Math.min(1, t * 2))
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.scale(lerp(0.7, 1, grow), lerp(0.7, 1, grow))
    ctx.globalAlpha = grow
    ctx.strokeStyle = '#f4c430'
    ctx.lineWidth = Math.max(2, s * 0.008)
    ctx.strokeRect(-w * 0.42, -h * 0.16, w * 0.84, h * 0.32)
    ctx.restore()
    ctx.globalAlpha = 1
  },
}
