import { useEffect, useRef } from 'react'

/**
 * The walk from one level to the next.
 *
 * Cutting straight from a finished board to a fresh one loses the only moment
 * in the game that is purely a reward. Nothing is being asked of anybody here:
 * it is two and a half seconds of somebody small going somewhere, and then the
 * next level. Every game gets its own, because "Dave walks into a pipe" and
 * "the runner eats his way across" are the same idea told in the two games'
 * own language, and a shared curtain would say neither.
 *
 * Drawn from primitives like everything else in this project. The sprites are
 * deliberately simpler than the ones in the games — at this size and this
 * speed, a shape that reads instantly beats a shape that is accurate.
 */
export type WipeScene = 'maze' | 'cave' | 'pipes' | 'dungeon' | 'road' | 'space'

/** How long the whole thing takes. Long enough to watch, short enough to sit through. */
export const WIPE_SECONDS = 2.4

type Ctx = CanvasRenderingContext2D

/** Eased 0..1, so nothing starts or stops abruptly. */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** The stretch of `t` a thing happens over, as its own 0..1. */
function during(t: number, from: number, to: number): number {
  return Math.max(0, Math.min(1, (t - from) / (to - from)))
}

function wheels(ctx: Ctx, x: number, y: number, r: number, roll: number): void {
  ctx.fillStyle = '#14161c'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(x + side * r * 1.1, y + r * 0.9, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
    // A spoke, so a wheel reads as turning rather than sliding.
    ctx.strokeStyle = '#4a4f5c'
    ctx.lineWidth = Math.max(1, r * 0.1)
    ctx.beginPath()
    ctx.moveTo(x + side * r * 1.1, y + r * 0.9)
    ctx.lineTo(
      x + side * r * 1.1 + Math.cos(roll) * r * 0.4,
      y + r * 0.9 + Math.sin(roll) * r * 0.4,
    )
    ctx.stroke()
  }
}

/** A small person: a head, a body, and two legs that swing. */
function walker(ctx: Ctx, x: number, y: number, h: number, step: number, colour: string): void {
  const swing = Math.sin(step * Math.PI * 2) * h * 0.18
  ctx.strokeStyle = colour
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(2, h * 0.12)
  ctx.beginPath()
  ctx.moveTo(x, y - h * 0.45)
  ctx.lineTo(x, y + h * 0.1)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + h * 0.1)
  ctx.lineTo(x + swing, y + h * 0.5)
  ctx.moveTo(x, y + h * 0.1)
  ctx.lineTo(x - swing, y + h * 0.5)
  ctx.stroke()
  // Arms, opposite the legs, which is what makes a walk look like a walk.
  ctx.beginPath()
  ctx.moveTo(x, y - h * 0.25)
  ctx.lineTo(x - swing * 0.8, y + h * 0.02)
  ctx.moveTo(x, y - h * 0.25)
  ctx.lineTo(x + swing * 0.8, y + h * 0.02)
  ctx.stroke()
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.arc(x, y - h * 0.58, h * 0.16, 0, Math.PI * 2)
  ctx.fill()
}

const SCENES: Record<WipeScene, (ctx: Ctx, w: number, h: number, t: number) => void> = {
  /** A trail of dots, and somebody eating along it. */
  maze(ctx, w, h, t) {
    const y = h * 0.55
    const go = during(t, 0.1, 0.8)
    const x = w * 0.12 + smooth(go) * w * 0.76
    const r = Math.min(w, h) * 0.075

    ctx.fillStyle = '#f2d45c'
    for (let i = 0; i < 12; i++) {
      const dx = w * 0.12 + (i / 11) * w * 0.76
      // Eaten once he has passed, which is the whole joke of the scene.
      if (dx < x - r) continue
      ctx.beginPath()
      ctx.arc(dx, y, r * 0.22, 0, Math.PI * 2)
      ctx.fill()
    }

    // The runner, mouth opening and shutting as he goes.
    const bite = Math.abs(Math.sin(t * Math.PI * 9)) * 0.38
    ctx.fillStyle = '#ffd83d'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, r, bite, Math.PI * 2 - bite)
    ctx.closePath()
    ctx.fill()
  },

  /** Into one cave mouth and out of the next. */
  cave(ctx, w, h, t) {
    const y = h * 0.6
    const mouth = (cx: number) => {
      ctx.fillStyle = '#1b1410'
      ctx.beginPath()
      ctx.moveTo(cx - w * 0.055, y + h * 0.08)
      ctx.lineTo(cx - w * 0.04, y - h * 0.13)
      ctx.quadraticCurveTo(cx, y - h * 0.22, cx + w * 0.04, y - h * 0.13)
      ctx.lineTo(cx + w * 0.055, y + h * 0.08)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#2f2a24'
    ctx.fillRect(0, y + h * 0.08, w, h * 0.06)
    mouth(w * 0.3)
    mouth(w * 0.72)

    // Walks in at the first, out of the second, and is underground between.
    const inLeg = during(t, 0.08, 0.38)
    const outLeg = during(t, 0.52, 0.86)
    if (inLeg < 1) walker(ctx, w * 0.08 + smooth(inLeg) * w * 0.22, y, h * 0.3, t * 5, '#e0c48a')
    else if (outLeg > 0) walker(ctx, w * 0.72 + smooth(outLeg) * w * 0.2, y, h * 0.3, t * 5, '#e0c48a')
  },

  /** Down one pipe and up the next, which is the only way anybody travels here. */
  pipes(ctx, w, h, t) {
    const ground = h * 0.66
    ctx.fillStyle = '#3a7d3a'
    ctx.fillRect(0, ground, w, h * 0.34)

    const pipe = (cx: number) => {
      ctx.fillStyle = '#2f9e44'
      ctx.fillRect(cx - w * 0.05, ground - h * 0.14, w * 0.1, h * 0.14)
      ctx.fillStyle = '#51cf66'
      ctx.fillRect(cx - w * 0.065, ground - h * 0.18, w * 0.13, h * 0.045)
      ctx.fillStyle = '#0f3f1b'
      ctx.fillRect(cx - w * 0.035, ground - h * 0.16, w * 0.07, h * 0.02)
    }
    const down = during(t, 0.1, 0.4)
    const up = during(t, 0.55, 0.85)
    const hero = (cx: number, cy: number) => {
      ctx.fillStyle = '#e8503a'
      ctx.beginPath()
      ctx.arc(cx, cy, Math.min(w, h) * 0.055, 0, Math.PI * 2)
      ctx.fill()
    }

    /*
     * Drawn either side of the pipes, depending on which way he is going.
     *
     * Going in means going behind the rim, so he is painted first and the pipe
     * covers him as he drops. Coming out is the other way round. Painted in
     * one order both ways he sat on top of the rim like an ornament.
     */
    if (down < 1) hero(w * 0.28, ground - h * 0.32 + smooth(down) * h * 0.2)
    pipe(w * 0.28)
    pipe(w * 0.72)
    if (down >= 1 && up > 0) hero(w * 0.72, ground - h * 0.14 - smooth(up) * h * 0.2)
  },

  /** Down a flight of steps, which is the only direction this game goes. */
  dungeon(ctx, w, h, t) {
    const steps = 5
    for (let i = 0; i < steps; i++) {
      const x = w * 0.18 + (i / steps) * w * 0.64
      const y = h * 0.5 + (i / steps) * h * 0.26
      ctx.fillStyle = i % 2 === 0 ? '#4a4032' : '#3a3226'
      ctx.fillRect(x, y, (w * 0.64) / steps + 1, h * 0.34)
    }
    const go = during(t, 0.1, 0.85)
    const at = smooth(go) * steps
    const i = Math.min(steps - 1, Math.floor(at))
    walker(
      ctx,
      w * 0.18 + ((i + 0.5) / steps) * w * 0.64,
      h * 0.5 + (i / steps) * h * 0.26,
      h * 0.3,
      t * 5,
      '#d8dce8',
    )
  },

  /** Past the flag and on to the next stretch. */
  road(ctx, w, h, t) {
    const y = h * 0.6
    ctx.fillStyle = '#4a4f5c'
    ctx.fillRect(0, y - h * 0.1, w, h * 0.26)
    // A dashed line, sliding past, which is most of what says "moving".
    ctx.fillStyle = '#eef2f8'
    const slide = (t * w * 1.6) % (w * 0.16)
    for (let x = -w * 0.16; x < w; x += w * 0.16) {
      ctx.fillRect(x + slide, y + h * 0.02, w * 0.07, h * 0.012)
    }
    // The flag it is heading past.
    const fx = w * 0.82
    ctx.fillStyle = '#eef2f8'
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#eef2f8' : '#14161c'
        ctx.fillRect(fx + c * w * 0.016, y - h * 0.22 + r * w * 0.016, w * 0.016, w * 0.016)
      }
    }
    ctx.fillStyle = '#8a91ab'
    ctx.fillRect(fx - w * 0.006, y - h * 0.22, w * 0.006, h * 0.3)

    const go = during(t, 0.05, 0.9)
    const x = -w * 0.1 + smooth(go) * w * 1.05
    const r = Math.min(w, h) * 0.055
    ctx.fillStyle = '#e4e8f0'
    ctx.beginPath()
    ctx.roundRect(x - r * 1.6, y - r * 0.6, r * 3.2, r * 1.5, r * 0.4)
    ctx.fill()
    wheels(ctx, x, y - r * 0.2, r, t * 22)
  },

  /** On towards the next world. */
  space(ctx, w, h, t) {
    ctx.fillStyle = '#e8ebf5'
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97) % 100) / 100
      const sy = ((i * 61) % 100) / 100
      ctx.globalAlpha = 0.25 + ((i * 13) % 10) / 20
      ctx.fillRect(sx * w, sy * h, 2, 2)
    }
    ctx.globalAlpha = 1

    // The world being left behind, sliding off.
    const drift = smooth(during(t, 0, 1))
    ctx.fillStyle = '#8a6f4f'
    ctx.beginPath()
    ctx.arc(w * 0.78 - drift * w * 0.5, h * 0.52, Math.min(w, h) * 0.13, 0, Math.PI * 2)
    ctx.fill()

    const go = during(t, 0.05, 0.9)
    const x = -w * 0.08 + smooth(go) * w * 1.05
    const y = h * 0.78
    const r = Math.min(w, h) * 0.055
    ctx.fillStyle = '#dfe7f5'
    ctx.beginPath()
    ctx.moveTo(x + r * 1.6, y)
    ctx.lineTo(x - r, y - r * 0.8)
    ctx.lineTo(x - r, y + r * 0.8)
    ctx.closePath()
    ctx.fill()
    // A flame that flickers, because a steady one looks painted on.
    ctx.fillStyle = Math.floor(t * 30) % 2 === 0 ? '#ffb02e' : '#ff6b53'
    ctx.beginPath()
    ctx.moveTo(x - r, y - r * 0.4)
    ctx.lineTo(x - r * (1.8 + Math.sin(t * 40) * 0.3), y)
    ctx.lineTo(x - r, y + r * 0.4)
    ctx.closePath()
    ctx.fill()
  },
}

export function LevelWipe({
  scene,
  title,
  onDone,
}: {
  scene: WipeScene
  /** What to call where it is going: "Level 3", "Room 4", "Mars". */
  title: string
  onDone: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    const began = performance.now()
    /*
     * Ends on its own clock rather than on the last frame.
     *
     * A backgrounded tab stops painting, and a wipe that waited for its own
     * animation to finish would leave somebody staring at a frozen picture
     * when they came back. The timer runs whatever the browser is doing.
     */
    const timer = window.setTimeout(() => done.current(), WIPE_SECONDS * 1000)

    const paint = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(box.width * dpr))
      canvas.height = Math.max(1, Math.round(box.height * dpr))
      const w = canvas.width
      const h = canvas.height
      const t = Math.min(1, (performance.now() - began) / (WIPE_SECONDS * 1000))

      ctx.clearRect(0, 0, w, h)
      // In and out at the ends, so it arrives and leaves rather than blinking.
      ctx.globalAlpha = Math.min(smooth(during(t, 0, 0.12)), 1 - smooth(during(t, 0.9, 1)))
      ctx.fillStyle = '#0d1016'
      ctx.fillRect(0, 0, w, h)

      SCENES[scene](ctx, w, h, t)

      const text = smooth(during(t, 0.25, 0.5))
      ctx.globalAlpha *= text
      ctx.fillStyle = '#eef2f8'
      ctx.font = `bold ${Math.max(16, Math.min(w, h) * 0.1)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(title.toUpperCase(), w / 2, h * 0.24)
      ctx.globalAlpha = 1

      if (t < 1) frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [scene])

  return (
    <div
      className="fade-in absolute inset-0 z-50"
      aria-live="polite"
      aria-label={`On to ${title}`}
      /* The games steer on pointer events and capture them. */
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  )
}
