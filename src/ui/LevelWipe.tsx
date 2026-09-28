import { useEffect, useRef } from 'react'
import { playCue } from '../music/player'
import { drawRunner } from '../render/silhouettes'
import { drawDave } from '../dave/draw'
import { newDave } from '../dave/physics'
import { drawHero } from '../pipes/draw'
import { newBody } from '../pipes/physics'
import { drawPrince } from '../arcade/dungeon/draw'
import { newPrince } from '../arcade/dungeon/prince'
import { levelFor as dungeonLevel } from '../arcade/dungeon/levels'
import { drawShip } from '../space/draw'
import { drawMine } from '../road/draw'
import { CAR_LONG, CAR_WIDE, carNamed, type Racer } from '../road/level'

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
 * Every one of them is drawn by the game's own drawing code, and that is the
 * whole point of the file. The first version had a generic stick figure walk
 * through four of the six, which was reported straight away and rightly: a
 * character who looks like one thing in the game and another in the cutscene
 * is not that character. `src/render/silhouettes.ts` already exists for
 * exactly this reason, and says so at the top of itself.
 *
 * So the runner comes from the silhouette both the board and the intro draw
 * from, and Dave, the plumber, the prince, the car and the ship each come from
 * their own game's draw function. What each scene supplies is a camera and a
 * position — whatever that game's drawing expects — and nothing else.
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

type Scene = (ctx: Ctx, w: number, h: number, t: number, car: Racer) => void

const SCENES: Record<WipeScene, Scene> = {
  /** A trail of dots, and the runner eating along it. */
  maze(ctx, w, h, t) {
    const y = h * 0.58
    const go = during(t, 0.1, 0.8)
    const x = w * 0.12 + smooth(go) * w * 0.76
    const r = Math.min(w, h) * 0.13

    ctx.fillStyle = '#f2d45c'
    for (let i = 0; i < 12; i++) {
      const dx = w * 0.12 + (i / 11) * w * 0.76
      // Eaten once he has passed, which is the whole joke of the scene.
      if (dx < x - r) continue
      ctx.beginPath()
      ctx.arc(dx, y, r * 0.14, 0, Math.PI * 2)
      ctx.fill()
    }

    // The same wedge-nosed scout the board and the intro draw, facing the way
    // he is going, with his skids shuffling.
    drawRunner(ctx, x, y, r, 0, t * 7)
  },

  /** Into one cave mouth and out of the next. */
  cave(ctx, w, h, t) {
    const tile = Math.min(w * 0.1, h * 0.26)
    const ground = h * 0.66
    const mouth = (cx: number) => {
      ctx.fillStyle = '#1b1410'
      ctx.beginPath()
      ctx.moveTo(cx - tile * 0.7, ground)
      ctx.lineTo(cx - tile * 0.55, ground - tile * 1.5)
      ctx.quadraticCurveTo(cx, ground - tile * 2.1, cx + tile * 0.55, ground - tile * 1.5)
      ctx.lineTo(cx + tile * 0.7, ground)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#2f2a24'
    ctx.fillRect(0, ground, w, h * 0.34)
    mouth(w * 0.3)
    mouth(w * 0.72)

    /*
     * Dave, drawn by the caves' own code.
     *
     * It wants a camera in tiles and a position in tiles, so the camera stays
     * at nought and the position is worked backwards from where on the screen
     * he should be. `y` is his feet.
     */
    const view = { camera: 0, size: tile, clock: t * 2 }
    const feet = ground / tile
    const inLeg = during(t, 0.08, 0.38)
    const outLeg = during(t, 0.52, 0.86)
    /*
     * A real Dave, from the caves' own constructor, moved to where he is
     * wanted. Built rather than written out field by field: a hand-written
     * copy of somebody else's type goes stale the first time a field is added
     * to it, and this one already did before it ever ran.
     */
    const at = (screenX: number) => ({
      ...newDave({ x: screenX / tile, y: feet }),
      vx: 4,
      onGround: true,
      facing: 1 as const,
      hasTrophy: outLeg > 0,
    })
    if (inLeg < 1) drawDave(ctx, at(w * 0.08 + smooth(inLeg) * w * 0.22), view)
    else if (outLeg > 0) drawDave(ctx, at(w * 0.72 + smooth(outLeg) * w * 0.2), view)
  },

  /** Down one pipe and up the next, which is the only way anybody travels here. */
  pipes(ctx, w, h, t) {
    const tile = Math.min(w * 0.09, h * 0.2)
    const ground = h * 0.66
    ctx.fillStyle = '#3a7d3a'
    ctx.fillRect(0, ground, w, h * 0.34)

    const pipe = (cx: number) => {
      ctx.fillStyle = '#2f9e44'
      ctx.fillRect(cx - tile * 0.6, ground - tile * 1.4, tile * 1.2, tile * 1.4)
      ctx.fillStyle = '#51cf66'
      ctx.fillRect(cx - tile * 0.78, ground - tile * 1.8, tile * 1.56, tile * 0.45)
      ctx.fillStyle = '#0f3f1b'
      ctx.fillRect(cx - tile * 0.42, ground - tile * 1.62, tile * 0.84, tile * 0.2)
    }

    const view = { col: 0, size: tile, clock: t * 2 }
    const body = (screenX: number, feetY: number) => ({
      ...newBody(screenX / tile, feetY / tile),
      vy: 4,
      facing: 1 as const,
    })

    /*
     * Drawn either side of the pipes, depending on which way he is going: into
     * one means behind its rim, out of the other means in front of it.
     */
    const down = during(t, 0.08, 0.42)
    const up = during(t, 0.5, 0.88)
    if (down < 1) {
      drawHero(ctx, body(w * 0.28, ground - tile * 3 + smooth(down) * tile * 2.4), view, 0, t)
    }
    pipe(w * 0.28)
    pipe(w * 0.72)
    if (down >= 1 && up > 0) {
      drawHero(ctx, body(w * 0.72, ground - tile * 1.4 - smooth(up) * tile * 1.6), view, 0, t)
    }
  },

  /** Down a flight of steps, which is the only direction this game goes. */
  dungeon(ctx, w, h, t) {
    const steps = 4
    const floor = h * 0.2
    const size = w * 0.16

    for (let i = 0; i < steps; i++) {
      const x = w * 0.14 + (i / steps) * w * 0.7
      const y = h * 0.54 + i * floor * 0.5
      ctx.fillStyle = i % 2 === 0 ? '#4a4032' : '#3a3226'
      ctx.fillRect(x, y, (w * 0.7) / steps + 1, h * 0.5)
    }

    const go = during(t, 0.12, 0.85)
    const at = smooth(go) * steps
    const i = Math.min(steps - 1, Math.floor(at))
    /*
     * The prince, drawn by the dungeon's own code.
     *
     * Its camera is in tiles across and floors down, so a one-floor view with
     * the floor height set to where the step is puts him on that step.
     */
    drawPrince(
      ctx,
      {
        ...newPrince(dungeonLevel(1)),
        col: 0,
        row: 0,
        facing: 1,
        action: 'run',
        frame: Math.floor(t * 24) % 8,
      },
      {
        col: -(w * 0.14 + ((i + 0.5) / steps) * w * 0.7) / size + 0,
        row: 0,
        rows: 1,
        size,
        floorHeight: h * 0.54 + i * floor * 0.5,
        clock: t * 2,
      },
      false,
    )
  },

  /** Past the flag and on to the next stretch. */
  road(ctx, w, h, t, car) {
    const y = h * 0.6
    ctx.fillStyle = '#4a4f5c'
    ctx.fillRect(0, y - h * 0.14, w, h * 0.3)
    ctx.fillStyle = '#eef2f8'
    const slide = (t * w * 1.6) % (w * 0.16)
    for (let x = -w * 0.16; x < w; x += w * 0.16) {
      ctx.fillRect(x + slide, y + h * 0.04, w * 0.07, h * 0.012)
    }
    const fx = w * 0.82
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#eef2f8' : '#14161c'
        ctx.fillRect(fx + c * w * 0.016, y - h * 0.3 + r * w * 0.016, w * 0.016, w * 0.016)
      }
    }
    ctx.fillStyle = '#8a91ab'
    ctx.fillRect(fx - w * 0.006, y - h * 0.3, w * 0.006, h * 0.36)

    /*
     * The car, drawn by the road's own code and in whichever one is in the
     * garage — so the thing that drives off the end of a level is the thing
     * that drove it.
     */
    const go = during(t, 0.05, 0.9)
    const x = -w * 0.1 + smooth(go) * w * 1.1
    /*
     * A camera that puts one car where it is wanted.
     *
     * The road's drawing takes its sizes from the view: a car is `CAR_WIDE` of
     * a lane across and `CAR_LONG` deep. So the lane width is chosen to give
     * the car the size this scene wants, and the road's left edge is placed so
     * that lane nought lands on `x`.
     */
    const depth = (Math.min(w, h) * 0.22) / CAR_LONG
    const laneWide = Math.min(w, h) * 0.1 / CAR_WIDE
    drawMine(
      ctx,
      0,
      {
        lane: laneWide,
        depth,
        left: x - laneWide * 0.5,
        line: y,
        distance: 0,
        clock: t * 2,
      },
      0,
      0,
      0,
      car,
      y,
    )
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

    const drift = smooth(during(t, 0, 1))
    ctx.fillStyle = '#8a6f4f'
    ctx.beginPath()
    ctx.arc(w * 0.78 - drift * w * 0.5, h * 0.5, Math.min(w, h) * 0.13, 0, Math.PI * 2)
    ctx.fill()

    /*
     * The ship, drawn by the space game's own code. It places itself down the
     * screen by its own rule, so the view is the whole frame and only the
     * across position is ours.
     */
    const go = during(t, 0.05, 0.9)
    /*
     * The ship puts itself near the bottom of whatever view it is handed, so
     * the view has to be the frame. Handing it a taller one — which the first
     * go did, to make the ship bigger — simply posted it off the bottom edge.
     */
    drawShip(ctx, smooth(go), { w, h, clock: t * 2 }, 0, t)
  },
}

export function LevelWipe({
  scene,
  title,
  car,
  onDone,
}: {
  scene: WipeScene
  /** What to call where it is going: "Level 3", "Room 4", "Mars". */
  title: string
  /** Which car drives off the end of a level: whichever one drove it. */
  car?: string
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

    // Something to walk to. The level's own music has already stopped by now,
    // so this has the place to itself.
    playCue('travel')

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

      SCENES[scene](ctx, w, h, t, carNamed(car))

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
  }, [scene, car])

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
