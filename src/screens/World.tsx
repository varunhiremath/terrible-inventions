import { useCallback, useEffect, useRef, useState } from 'react'
import { isSolid, roomAt, type Point } from '../world/map'
import { lastPosition, rememberPosition } from '../world/position'
import { MACHINES, PAPA_LINES, isPapaAt, machineAt, wingComplete } from '../world/characters'
import { draw } from '../world/render'
import { fill, getProfile } from '../config/profile'
import { Btn } from '../ui/bits'
import { useStore } from '../store'
import { play } from '../audio'

type Dir = 'up' | 'down' | 'left' | 'right'

const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** How long one tile of walking takes. Slow enough to see, fast enough to feel responsive. */
const MOVE_MS = 140

interface Talk {
  who: string
  lines: string[]
  at: number
  /** Offered on the last line. */
  action?: { label: string; run: () => void }
}

/**
 * The workshop, walked around rather than navigated.
 *
 * Movement runs entirely in refs against an animation frame, because a player
 * position that lived in React state would re-render the whole tree sixty times
 * a second. Only discrete events — starting a mission, opening a conversation —
 * reach the store.
 */
export function World() {
  const save = useStore((s) => s.save)
  const justFixed = useStore((s) => s.justFixed)
  const startMission = useStore((s) => s.startMission)
  const startCoop = useStore((s) => s.startCoop)
  const clearJustFixed = useStore((s) => s.clearJustFixed)
  const go = useStore((s) => s.go)
  const { kidName } = getProfile()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tile = useRef<Point>(lastPosition())
  const shown = useRef(lastPosition())
  const walk = useRef<{ from: Point; to: Point; started: number } | null>(null)
  const facing = useRef<Dir>('down')
  const held = useRef<Dir | null>(null)
  /**
   * A single step, queued by a key tap. Without this a quick press can be over
   * before the next animation frame looks at `held`, and the tap does nothing.
   */
  const tapped = useRef<Dir | null>(null)

  const [prompt, setPrompt] = useState<string | null>(null)
  const [talk, setTalk] = useState<Talk | null>(null)
  const [room, setRoom] = useState(() => roomAt(lastPosition()))

  const fixed = save.world.fixed
  const unlocked = wingComplete(fixed)

  /** What the player is looking at, if it is somebody. */
  const facingTarget = useCallback((): Point => {
    const step = STEP[facing.current]
    return { x: tile.current.x + step.x, y: tile.current.y + step.y }
  }, [])

  const interact = useCallback(() => {
    if (talk) return
    const target = facingTarget()

    const machine = machineAt(target)
    if (machine) {
      const isFixed = fixed.includes(machine.id)
      play(isFixed ? 'greeting' : 'struggle')
      setTalk({
        who: machine.name,
        at: 0,
        lines: isFixed ? [machine.working[Math.floor(Math.random() * machine.working.length)]] : machine.broken,
        action: isFixed
          ? undefined
          : { label: `Help ${machine.name}`, run: () => startMission(machine.id) },
      })
      return
    }

    if (isPapaAt(target)) {
      const stage = fixed.length === 0 ? 'none' : unlocked ? 'all' : 'some'
      const pool = PAPA_LINES[stage]
      play('greeting')
      setTalk({
        who: fill('{papa}'),
        at: 0,
        lines: [pool[Math.floor(Math.random() * pool.length)]],
        action: { label: 'Do a two-player puzzle', run: startCoop },
      })
    }
  }, [talk, facingTarget, fixed, unlocked, startMission, startCoop])

  // The moment a machine is repaired: it says its piece, and the world has
  // visibly changed behind the dialogue box.
  useEffect(() => {
    if (!justFixed) return
    const machine = MACHINES.find((m) => m.id === justFixed.machineId)
    if (!machine) return

    play('right')
    setTalk({ who: machine.name, at: 0, lines: [...machine.success, justFixed.praise] })
    clearJustFixed()
  }, [justFixed, clearJustFixed])

  // Keyboard, for playing at a desk.
  useEffect(() => {
    const keys: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
    }
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); interact(); return }
      const dir = keys[e.key]
      if (dir) { e.preventDefault(); held.current = dir; tapped.current = dir }
    }
    const up = (e: KeyboardEvent) => {
      if (keys[e.key] === held.current) held.current = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [interact])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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

      if (walk.current) {
        const t = Math.min(1, (now - walk.current.started) / MOVE_MS)
        const { from, to } = walk.current
        shown.current = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
        if (t >= 1) walk.current = null
      } else if ((held.current || tapped.current) && !talk) {
        const dir = held.current ?? tapped.current!
        tapped.current = null
        facing.current = dir
        const step = STEP[dir]
        const target = { x: tile.current.x + step.x, y: tile.current.y + step.y }
        const blocked = isSolid(target, unlocked) || !!machineAt(target) || isPapaAt(target)
        if (!blocked) {
          walk.current = { from: { ...tile.current }, to: target, started: now }
          tile.current = target
          rememberPosition(target)
          setRoom(roomAt(target))
        }
      }

      const target = facingTarget()
      const someone = machineAt(target)
      setPrompt(someone ? someone.name : isPapaAt(target) ? fill('{papa}') : null)

      const rect = canvas.getBoundingClientRect()
      draw(ctx, { player: shown.current, fixed, unlocked, facingTile: someone || isPapaAt(target) ? target : null }, rect.width, rect.height)

      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [fixed, unlocked, talk, facingTarget])

  const advance = () => {
    if (!talk) return
    if (talk.at < talk.lines.length - 1) setTalk({ ...talk, at: talk.at + 1 })
  }

  const hold = (dir: Dir | null) => () => {
    held.current = dir
    // A tap on the pad steps once even if it is released within a frame.
    if (dir) tapped.current = dir
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <header className="relative z-10 flex items-start justify-between gap-2 p-3">
        <div className="block-panel px-3 py-2">
          <p className="text-sm font-bold">{room}</p>
          <p className="text-xs text-dim">
            {fixed.length} of {MACHINES.length} working
            {unlocked && ' · the far door is open'}
          </p>
        </div>
        <button type="button" onClick={() => go('settings')} className="block-btn px-3 py-2 text-sm" aria-label="Settings">
          &#9881;
        </button>
      </header>

      <div className="flex-1" />

      {/* Controls sit low and wide so both thumbs reach them on a tablet. */}
      {!talk && (
        <div className="relative z-10 flex items-end justify-between p-4">
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            {([
              [null, 'up', null],
              ['left', null, 'right'],
              [null, 'down', null],
            ] as (Dir | null)[][]).flat().map((dir, i) =>
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
            onClick={interact}
            disabled={!prompt}
            className={`block-btn h-[86px] w-[86px] rounded-full p-0 text-sm font-bold ${
              prompt ? 'border-bolt bg-bolt text-ink' : 'opacity-40'
            }`}
          >
            {prompt ? 'Talk' : ''}
          </button>
        </div>
      )}

      {talk && (
        <div className="relative z-20 p-3">
          <div className="block-panel p-4">
            <p className="text-sm font-bold uppercase tracking-wider text-bolt">{talk.who}</p>
            <p className="mt-2 min-h-[3.5rem] text-lg leading-snug">{fill(talk.lines[talk.at])}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {talk.at < talk.lines.length - 1 ? (
                <Btn tone="go" onClick={advance}>Go on</Btn>
              ) : (
                <>
                  {talk.action && (
                    <Btn tone="go" onClick={talk.action.run}>{talk.action.label}</Btn>
                  )}
                  <Btn onClick={() => setTalk(null)}>
                    {talk.action ? 'Not now' : 'Bye'}
                  </Btn>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {fixed.length === 0 && !talk && (
        <p className="pointer-events-none absolute inset-x-0 bottom-32 z-10 text-center text-sm text-dim">
          {kidName}, find the machines with a <span className="text-bolt">!</span> over them
        </p>
      )}
    </div>
  )
}
