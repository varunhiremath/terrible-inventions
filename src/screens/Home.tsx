import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type { Screen } from '../store'
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

const TILES: Tile[] = [
  {
    id: 'arcade',
    title: 'Papa Panic',
    blurb: 'Clear the maze. Four machines want a word.',
    tint: '#1b2340',
    emblem(ctx, w, h) {
      const s = Math.min(w, h)
      ctx.strokeStyle = '#4a5ea8'
      ctx.lineWidth = s * 0.05
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(w * 0.12, h * (0.3 + i * 0.22))
        ctx.lineTo(w * 0.88, h * (0.3 + i * 0.22))
        ctx.stroke()
      }
      ctx.fillStyle = '#ffd23f'
      ctx.beginPath()
      ctx.arc(w * 0.3, h * 0.52, s * 0.14, 0.5, Math.PI * 2 - 0.5)
      ctx.lineTo(w * 0.3, h * 0.52)
      ctx.fill()
      ctx.fillStyle = '#e8433a'
      ctx.beginPath()
      ctx.arc(w * 0.64, h * 0.52, s * 0.13, Math.PI, 0)
      ctx.lineTo(w * 0.64 + s * 0.13, h * 0.52 + s * 0.11)
      ctx.lineTo(w * 0.64 - s * 0.13, h * 0.52 + s * 0.11)
      ctx.fill()
    },
  },
  {
    id: 'dave',
    title: 'Dangerous Dave',
    blurb: 'Ten caves. Take the trophy, find the door.',
    tint: '#2b1810',
    emblem(ctx, w, h) {
      const s = Math.min(w, h)
      ctx.fillStyle = '#7a3508'
      ctx.fillRect(0, h * 0.72, w, h * 0.3)
      ctx.fillRect(0, 0, w, h * 0.14)
      ctx.fillStyle = '#f4c430'
      ctx.beginPath()
      ctx.moveTo(w * 0.62, h * 0.46)
      ctx.lineTo(w * 0.78, h * 0.46)
      ctx.lineTo(w * 0.72, h * 0.72)
      ctx.lineTo(w * 0.68, h * 0.72)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#3a6ed0'
      ctx.fillRect(w * 0.2, h * 0.52, s * 0.13, s * 0.2)
      ctx.fillStyle = '#e0a878'
      ctx.fillRect(w * 0.21, h * 0.44, s * 0.1, s * 0.08)
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
      ctx.fillStyle = '#79838f'
      ctx.fillRect(0, h * 0.68, w, h * 0.05)
      const glow = ctx.createRadialGradient(w * 0.72, h * 0.32, s * 0.02, w * 0.72, h * 0.32, s * 0.4)
      glow.addColorStop(0, 'rgba(255,180,80,0.7)')
      glow.addColorStop(1, 'rgba(255,150,50,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#efe7d6'
      ctx.fillRect(w * 0.28, h * 0.5, s * 0.07, s * 0.18)
      ctx.fillStyle = '#c0392b'
      ctx.fillRect(w * 0.28, h * 0.6, s * 0.07, s * 0.04)
    },
  },
  {
    id: 'pipes',
    title: 'The Pipes',
    blurb: 'Run, jump, stomp. The flag is a long way off.',
    tint: '#1d3a6e',
    emblem(ctx, w, h) {
      const s = Math.min(w, h)
      ctx.fillStyle = '#a05a20'
      ctx.fillRect(0, h * 0.74, w, h * 0.3)
      ctx.fillStyle = '#4fae2e'
      ctx.fillRect(0, h * 0.74, w, h * 0.07)
      ctx.fillStyle = '#3cc03c'
      ctx.fillRect(w * 0.6, h * 0.44, s * 0.24, h * 0.32)
      ctx.fillStyle = '#7ae87a'
      ctx.fillRect(w * 0.63, h * 0.44, s * 0.06, h * 0.32)
      ctx.fillStyle = '#e8a020'
      ctx.fillRect(w * 0.3, h * 0.36, s * 0.14, s * 0.14)
      ctx.fillStyle = '#2f7a3a'
      ctx.fillRect(w * 0.15, h * 0.6, s * 0.12, s * 0.14)
      ctx.fillStyle = '#e8c020'
      ctx.fillRect(w * 0.15, h * 0.55, s * 0.13, s * 0.05)
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
