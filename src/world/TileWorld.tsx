import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point } from './map'
import { draw, type Scene } from './render'

type Dir = 'up' | 'down' | 'left' | 'right'

const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const MOVE_MS = 140

export interface TileWorldProps {
  /** Terrain and occupants the player cannot walk through. */
  blocked: (point: Point) => boolean
  /** Rebuilt every frame from the current position. */
  buildScene: (player: { x: number; y: number }, facing: Point) => Scene
  /** What the action button says here, or null to grey it out. */
  actionLabel: (facing: Point, standingOn: Point) => string | null
  onAction: (facing: Point, standingOn: Point) => void
  /** Hidden while a dialogue or overlay owns the screen. */
  controlsVisible: boolean
  onMove?: (to: Point) => void
  start: Point
}

/**
 * A walkable tile map with a thumb pad.
 *
 * Everything to do with position lives in refs against an animation frame. A
 * player position in React state would re-render the tree sixty times a second,
 * and any parent re-render would restart the loop mid-step.
 */
export function TileWorld({
  blocked,
  buildScene,
  actionLabel,
  onAction,
  controlsVisible,
  onMove,
  start,
}: TileWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tile = useRef<Point>({ ...start })
  const shown = useRef({ x: start.x, y: start.y })
  const walk = useRef<{ from: Point; to: Point; started: number } | null>(null)
  const facing = useRef<Dir>('down')
  const held = useRef<Dir | null>(null)
  /** A single step queued by a tap, in case it ends before the next frame. */
  const tapped = useRef<Dir | null>(null)

  const [prompt, setPrompt] = useState<string | null>(null)

  const latest = useRef({ blocked, buildScene, actionLabel, controlsVisible, onMove })
  latest.current = { blocked, buildScene, actionLabel, controlsVisible, onMove }

  const facingPoint = useCallback((): Point => {
    const step = STEP[facing.current]
    return { x: tile.current.x + step.x, y: tile.current.y + step.y }
  }, [])

  const act = useCallback(() => {
    onAction(facingPoint(), { ...tile.current })
  }, [onAction, facingPoint])

  useEffect(() => {
    const keys: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
    }
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(); return }
      const dir = keys[e.key]
      if (dir) { e.preventDefault(); held.current = dir; tapped.current = dir }
    }
    const up = (e: KeyboardEvent) => { if (keys[e.key] === held.current) held.current = null }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [act])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let frame = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const now = performance.now()
      const api = latest.current

      if (walk.current) {
        const t = Math.min(1, (now - walk.current.started) / MOVE_MS)
        const { from, to } = walk.current
        shown.current = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
        if (t >= 1) walk.current = null
      } else if ((held.current || tapped.current) && api.controlsVisible) {
        const dir = held.current ?? tapped.current!
        tapped.current = null
        facing.current = dir
        const step = STEP[dir]
        const target = { x: tile.current.x + step.x, y: tile.current.y + step.y }
        if (!api.blocked(target)) {
          walk.current = { from: { ...tile.current }, to: target, started: now }
          tile.current = target
          api.onMove?.(target)
        }
      }

      const face = facingPoint()
      setPrompt(api.actionLabel(face, tile.current))

      const rect = canvas.getBoundingClientRect()
      draw(ctx, api.buildScene(shown.current, face), rect.width, rect.height)
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [facingPoint])

  const hold = (dir: Dir | null) => () => {
    held.current = dir
    if (dir) tapped.current = dir
  }

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {controlsVisible && (
        <div className="relative z-10 mt-auto flex items-end justify-between p-4">
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            {([[null, 'up', null], ['left', null, 'right'], [null, 'down', null]] as (Dir | null)[][])
              .flat()
              .map((dir, i) =>
                dir ? (
                  <button
                    key={i}
                    type="button"
                    aria-label={dir}
                    onPointerDown={hold(dir)}
                    onPointerUp={hold(null)}
                    onPointerLeave={hold(null)}
                    onPointerCancel={hold(null)}
                    className="block-btn h-[58px] w-[58px] p-0 text-lg"
                  >
                    {{ up: '▲', down: '▼', left: '◀', right: '▶' }[dir]}
                  </button>
                ) : (
                  <span key={i} />
                ),
              )}
          </div>

          <button
            type="button"
            onClick={act}
            disabled={!prompt}
            className={`block-btn h-[92px] min-w-[92px] rounded-full px-4 text-sm font-bold leading-tight ${
              prompt ? 'border-bolt bg-bolt text-ink' : 'opacity-40'
            }`}
          >
            {prompt ?? ''}
          </button>
        </div>
      )}
    </>
  )
}
