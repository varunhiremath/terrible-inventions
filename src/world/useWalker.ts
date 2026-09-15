import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point } from './map'

export type Dir = 'up' | 'down' | 'left' | 'right'

export const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const MOVE_MS = 150

export interface Walker {
  /** Whole-tile position. */
  tile: React.RefObject<Point>
  /** Interpolated position, for drawing. */
  shown: React.RefObject<{ x: number; y: number }>
  facing: React.RefObject<Dir>
  /** 0 while standing still, ramping 0..1 across a step. Drives the walk bob. */
  progress: React.RefObject<number>
  facingPoint: () => Point
  /** Call once per frame before drawing. */
  tick: (now: number, canMove: boolean, blocked: (p: Point) => boolean, onMove?: (to: Point) => void) => void
  hold: (dir: Dir | null) => () => void
  prompt: string | null
  setPrompt: (next: string | null) => void
  act: () => void
}

/**
 * Walking, held entirely in refs.
 *
 * Position in React state would re-render the tree sixty times a second and any
 * parent re-render would restart a step mid-stride, so the only thing here that
 * reaches React is the action button's label.
 */
export function useWalker(start: Point, onAction: (facing: Point, on: Point) => void): Walker {
  const tile = useRef<Point>({ ...start })
  const shown = useRef({ x: start.x, y: start.y })
  const facing = useRef<Dir>('down')
  const progress = useRef(0)
  const walk = useRef<{ from: Point; to: Point; started: number } | null>(null)
  const held = useRef<Dir | null>(null)
  /** A step queued by a tap, in case the key is released before the next frame. */
  const tapped = useRef<Dir | null>(null)

  const [prompt, setPrompt] = useState<string | null>(null)

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

  const tick: Walker['tick'] = useCallback((now, canMove, blocked, onMove) => {
    if (walk.current) {
      const t = Math.min(1, (now - walk.current.started) / MOVE_MS)
      const { from, to } = walk.current
      shown.current = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
      progress.current = t
      if (t >= 1) { walk.current = null; progress.current = 0 }
      return
    }

    if (!canMove) { tapped.current = null; return }

    const dir = held.current ?? tapped.current
    if (!dir) return
    tapped.current = null
    facing.current = dir

    const step = STEP[dir]
    const target = { x: tile.current.x + step.x, y: tile.current.y + step.y }
    if (blocked(target)) return

    walk.current = { from: { ...tile.current }, to: target, started: now }
    tile.current = target
    onMove?.(target)
  }, [])

  const hold = useCallback(
    (dir: Dir | null) => () => {
      held.current = dir
      if (dir) tapped.current = dir
    },
    [],
  )

  return { tile, shown, facing, progress, facingPoint, tick, hold, prompt, setPrompt, act }
}
