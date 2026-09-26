import { useEffect, useRef } from 'react'
import { drawCan, drawCar, drawMine, drawRoad } from '../road/draw'
import { useStore } from '../store'
import type { Screen } from '../store'
import { drawFigure, type Look } from '../arcade/dungeon/figure'
import { poseFor } from '../arcade/dungeon/draw'
import { drawHero } from '../pipes/draw'
import { VIEW_TOP } from '../pipes/level'
import { newBody } from '../pipes/physics'
import { fill } from '../config/profile'

/**
 * The front door.
 *
 * Four games, and nothing else on the screen. The app used to open straight
 * into the maze, which quietly made that one the game and the other three
 * things you had to know were hidden in the settings.
 *
 * Each tile draws its own emblem rather than carrying a picture file, in
 * keeping with the rest of this: no assets, nothing to download, and it stays
 * sharp on any screen.
 */

interface Tile {
  id: Screen
  title: string
  blurb: string
  tint: string
  emblem: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

/**
 * The four tiles.
 *
 * Each one shows the character you will actually be, drawn with that game's
 * own code wherever there is any — the dungeon's figure and the pipes'
 * apprentice are the same functions the games call. The first version of these
 * was shapes: a rectangle for a person, a triangle for a trophy. It was
 * reported as "I only see some blocks", which was fair.
 *
 * The maze's two are drawn here rather than borrowed, because that game is
 * rendered in three dimensions and has no flat drawing to reuse. They are
 * Papa and one of his machines: our own, like everything else in here.
 */
/** What he wears, matching the figure the dungeon draws. */
const PRINCE_LOOK: Look = {
  body: '#3f7fc4', legs: '#24406b', trim: '#f0c419', skin: '#e0a878',
  hair: '#2b1d14', band: '#f0c419', turban: true, coat: true, loose: true, curved: true,
}

const TILES: Tile[] = [
  {
    id: 'arcade',
    title: 'Papa Panic',
    blurb: 'Clear the maze. Four machines want a word.',
    tint: '#1b2340',
    emblem(ctx, w, h) {
      const s = Math.min(w, h)
      const floor = h * 0.62

      // Maze corridors behind them, with the dots still to be eaten.
      ctx.strokeStyle = '#3d4f8f'
      ctx.lineWidth = s * 0.045
      for (const y of [0.24, 0.82]) {
        ctx.beginPath()
        ctx.moveTo(w * 0.08, h * y)
        ctx.lineTo(w * 0.92, h * y)
        ctx.stroke()
      }
      ctx.fillStyle = '#f2d98c'
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.arc(w * (0.12 + i * 0.19), floor + s * 0.02, s * 0.028, 0, Math.PI * 2)
        ctx.fill()
      }

      // The machine, chasing: a box on treads with one eye and an aerial.
      const mx = w * 0.66
      const mw = s * 0.3
      const mh = s * 0.32
      ctx.strokeStyle = '#8e2f26'
      ctx.lineWidth = s * 0.02
      ctx.beginPath()
      ctx.moveTo(mx + mw * 0.1, floor - mh)
      ctx.lineTo(mx + mw * 0.1, floor - mh - s * 0.1)
      ctx.stroke()
      ctx.fillStyle = '#e8503a'
      ctx.beginPath()
      ctx.arc(mx + mw * 0.1, floor - mh - s * 0.12, s * 0.035, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c94436'
      ctx.fillRect(mx - mw / 2, floor - mh, mw, mh)
      ctx.fillStyle = '#2a1a1a'
      ctx.fillRect(mx - mw / 2, floor - s * 0.07, mw, s * 0.07)
      ctx.fillStyle = '#ffe9b0'
      ctx.beginPath()
      ctx.arc(mx - mw * 0.05, floor - mh * 0.62, s * 0.055, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1b2340'
      ctx.beginPath()
      ctx.arc(mx - mw * 0.11, floor - mh * 0.62, s * 0.025, 0, Math.PI * 2)
      ctx.fill()

      // And the one being chased, running the other way.
      const px = w * 0.27
      ctx.fillStyle = '#2f5f9e'
      ctx.fillRect(px - s * 0.05, floor - s * 0.11, s * 0.04, s * 0.11)
      ctx.fillRect(px + s * 0.02, floor - s * 0.11, s * 0.04, s * 0.11)
      ctx.fillStyle = '#ffd23f'
      ctx.fillRect(px - s * 0.08, floor - s * 0.28, s * 0.16, s * 0.18)
      ctx.fillStyle = '#e8b98a'
      ctx.beginPath()
      ctx.arc(px, floor - s * 0.34, s * 0.075, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2b1d14'
      ctx.beginPath()
      ctx.arc(px, floor - s * 0.375, s * 0.075, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = '#1b2340'
      ctx.beginPath()
      ctx.arc(px - s * 0.03, floor - s * 0.335, s * 0.014, 0, Math.PI * 2)
      ctx.fill()
    },
  },
  {
    id: 'dave',
    title: 'The Caves',
    blurb: 'Ten caves. Take the trophy, find the door.',
    tint: '#2b1810',
    emblem(ctx, w, h) {
      const s = Math.min(w, h)
      const floor = h * 0.72

      ctx.fillStyle = '#7a3508'
      ctx.fillRect(0, floor, w, h)
      ctx.fillRect(0, 0, w, h * 0.12)
      ctx.fillStyle = '#5d2806'
      for (let x = 0; x < w; x += s * 0.22) ctx.fillRect(x, floor, s * 0.2, s * 0.05)

      // The trophy, which is the whole reason for going in.
      const tx = w * 0.72
      ctx.fillStyle = '#f4c430'
      ctx.beginPath()
      ctx.moveTo(tx - s * 0.1, floor - s * 0.3)
      ctx.lineTo(tx + s * 0.1, floor - s * 0.3)
      ctx.lineTo(tx + s * 0.04, floor - s * 0.12)
      ctx.lineTo(tx - s * 0.04, floor - s * 0.12)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(tx - s * 0.07, floor - s * 0.1, s * 0.14, s * 0.035)
      ctx.strokeStyle = '#f4c430'
      ctx.lineWidth = s * 0.022
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(tx + side * s * 0.1, floor - s * 0.26, s * 0.045, -Math.PI / 2, Math.PI / 2, side < 0)
        ctx.stroke()
      }

      // Dave himself: helmet, jacket, boots.
      const dx = w * 0.3
      ctx.fillStyle = '#2f2f3a'
      ctx.fillRect(dx - s * 0.075, floor - s * 0.08, s * 0.06, s * 0.08)
      ctx.fillRect(dx + s * 0.015, floor - s * 0.08, s * 0.06, s * 0.08)
      ctx.fillStyle = '#3a6ed0'
      ctx.fillRect(dx - s * 0.09, floor - s * 0.27, s * 0.18, s * 0.19)
      ctx.fillStyle = '#2b529e'
      ctx.fillRect(dx - s * 0.09, floor - s * 0.27, s * 0.18, s * 0.05)
      ctx.fillStyle = '#e0a878'
      ctx.beginPath()
      ctx.arc(dx, floor - s * 0.335, s * 0.075, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c0392b'
      ctx.beginPath()
      ctx.arc(dx, floor - s * 0.35, s * 0.08, Math.PI, 0)
      ctx.fill()
      ctx.fillRect(dx - s * 0.08, floor - s * 0.36, s * 0.16, s * 0.022)
      ctx.fillStyle = '#1a1208'
      ctx.beginPath()
      ctx.arc(dx + s * 0.03, floor - s * 0.33, s * 0.014, 0, Math.PI * 2)
      ctx.fill()
    },
  },
  {
    id: 'prince',
    title: 'The Dungeon',
    blurb: 'Thirteen floors. One hour. It never stops.',
    tint: '#151a22',
    emblem(ctx, w, h) {
      const s = Math.min(w, h)
      ctx.fillStyle = '#232a33'
      for (let y = 0; y < h; y += s * 0.16) {
        for (let x = -s * 0.1; x < w; x += s * 0.26) {
          const off = Math.round(y / (s * 0.16)) % 2 === 0 ? 0 : s * 0.13
          ctx.fillRect(x + off, y, s * 0.24, s * 0.14)
        }
      }
      const floor = h * 0.72
      ctx.fillStyle = '#79838f'
      ctx.fillRect(0, floor, w, h * 0.04)

      // The torch, and the light it throws down the wall.
      const glow = ctx.createRadialGradient(w * 0.76, h * 0.3, s * 0.02, w * 0.76, h * 0.3, s * 0.55)
      glow.addColorStop(0, 'rgba(255,180,80,0.75)')
      glow.addColorStop(1, 'rgba(255,150,50,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#3b3b44'
      ctx.fillRect(w * 0.75, h * 0.3, s * 0.025, s * 0.14)
      ctx.fillStyle = '#ffb347'
      ctx.beginPath()
      ctx.ellipse(w * 0.762, h * 0.27, s * 0.045, s * 0.075, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffe9b0'
      ctx.beginPath()
      ctx.ellipse(w * 0.762, h * 0.28, s * 0.022, s * 0.04, 0, 0, Math.PI * 2)
      ctx.fill()

      // Him, drawn with the dungeon's own figure code.
      drawFigure(
        ctx, w * 0.36, floor, s * 0.34, 1,
        poseFor('run', 1, 'none'), PRINCE_LOOK, 'warrior', false,
      )
    },
  },
  {
    id: 'pipes',
    title: 'The Pipes',
    blurb: 'Run, jump, stomp. The flag is a long way off.',
    tint: '#1d3a6e',
    emblem(ctx, w, h) {
      const s = Math.min(w, h)
      const floor = h * 0.74

      ctx.fillStyle = '#a05a20'
      ctx.fillRect(0, floor, w, h)
      ctx.fillStyle = '#4fae2e'
      ctx.fillRect(0, floor, w, h * 0.055)

      // A question block to bump, and a coin already out of it.
      ctx.fillStyle = '#d98b1f'
      ctx.fillRect(w * 0.56, h * 0.3, s * 0.17, s * 0.17)
      ctx.fillStyle = '#f7c948'
      ctx.fillRect(w * 0.575, h * 0.315, s * 0.14, s * 0.14)
      ctx.fillStyle = '#8a5a12'
      ctx.font = `bold ${s * 0.12}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', w * 0.645, h * 0.315 + s * 0.075)

      ctx.fillStyle = '#3cc03c'
      ctx.fillRect(w * 0.76, h * 0.5, s * 0.26, floor - h * 0.5)
      ctx.fillStyle = '#7ae87a'
      ctx.fillRect(w * 0.79, h * 0.5, s * 0.07, floor - h * 0.5)

      // Him, standing on the ground, drawn with the pipes' own code. Its rows
      // are counted from the top of the visible level, so the feet have to be
      // converted rather than guessed — guessing once put a figure clean off
      // the top of a picture entirely.
      const tile = s * 0.36
      const feet = VIEW_TOP + floor / tile
      drawHero(
        ctx,
        { ...newBody(0, 0), x: (w * 0.28) / tile, y: feet, facing: 1, onGround: true },
        { col: 0, size: tile, clock: 0 },
        0,
        0,
      )
    },
  },
  {
    id: 'road',
    title: 'The Road',
    blurb: 'Four lanes, no brakes worth speaking of. Mind the fuel.',
    tint: '#2f4a2e',
    emblem(ctx, w, h) {
      const lane = w / 5.6
      const view = {
        lane,
        depth: h / 5,
        left: (w - lane * 4) / 2,
        line: h * 0.78,
        distance: 0,
        clock: 0,
      }
      drawRoad(ctx, view, w, h)
      // Two of his and one of yours, drawn by the game's own code so the tile
      // is the game rather than a picture of it.
      drawCar(ctx, { id: 1, y: 3.4, lane: 0, speed: 0, kind: 0 }, view)
      drawCar(ctx, { id: 2, y: 2.6, lane: 2, speed: 0, kind: 1 }, view)
      drawCan(ctx, { id: 3, y: 1.6, lane: 3, taken: false }, view)
      drawMine(ctx, 1, view, 0)
    },
  },
]

function Emblem({ tile }: { tile: Tile }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      tile.emblem(ctx, canvas.width, canvas.height)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [tile])
  return <canvas ref={ref} className="block h-full w-full" aria-hidden />
}

export function Home() {
  const go = useStore((s) => s.go)
  const save = useStore((s) => s.save)

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-3 p-3 sm:gap-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-mono text-lg font-bold uppercase tracking-widest text-chalk sm:text-2xl">
          Terrible Inventions
        </h1>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => go('settings')}
          className="rounded-full border border-dim/40 px-4 py-2 font-mono text-xs uppercase tracking-widest text-dim"
        >
          Settings
        </button>
      </div>

      <p className="text-sm text-dim">
        {fill('{papa}')} built four terrible machines. Pick one.
      </p>

      {/* Two by two, and each tile is a whole thumb's worth of target. */}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => go(tile.id)}
            style={{ backgroundColor: tile.tint }}
            className="block-btn flex min-h-0 flex-col justify-between overflow-hidden p-0 text-left"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <Emblem tile={tile} />
            </div>
            <div className="w-full bg-ink/70 px-3 py-2">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-chalk sm:text-sm">
                {tile.title}
              </p>
              <p className="mt-0.5 hidden text-xs leading-snug text-dim sm:block">{tile.blurb}</p>
            </div>
          </button>
        ))}
      </div>

      {save.note && !save.note.seen && (
        <button
          type="button"
          onClick={() => go('note')}
          className="block-btn border-bolt/60 px-3 py-3 text-left text-sm"
        >
          A note from {fill('{papa}')} is waiting.
        </button>
      )}
    </div>
  )
}
