import { useEffect, useRef, useState } from 'react'
import { ROOM_COLS, ROOM_ROWS, roomAt } from '../arcade/dungeon/level'
import { FPS } from '../arcade/dungeon/sequences'
import { NO_INPUT, type Input } from '../arcade/dungeon/prince'
import {
  fightingGuard,
  gatesOpen,
  minutesLeft,
  newRun,
  step,
  type Run,
} from '../arcade/dungeon/run'
import { LEVELS, levelFor } from '../arcade/dungeon/levels'
import type { Move } from '../arcade/dungeon/combat'
import {
  combine,
  keyAt,
  padHeight,
  padLayout,
  type Button,
  type Key,
} from '../arcade/dungeon/controls'
import {
  INK,
  drawChevrons,
  drawPad,
  drawGuard,
  drawPrince,
  drawRoom,
  type View,
} from '../arcade/dungeon/draw'
import { createPacer } from '../arcade/pacing'
import { fill } from '../config/profile'
import { Btn } from '../ui/bits'
import { say, silence } from '../voice'
import { useStore } from '../store'

/**
 * The dungeon.
 *
 * Fifteen frames a second, which is what the animation tables are written in
 * and what gives this kind of game its weight — every pose is held long enough
 * to be read. So the simulation steps at fifteen and the screen draws whatever
 * the latest state is: there is nothing to interpolate, because between two
 * frames of a rotoscoped run there is no in-between.
 */
const FIXED = 1 / FPS
const MAX_CATCHUP = 0.4

export function Prince() {
  const go = useStore((s) => s.go)
  const openShop = useStore((s) => s.openShop)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const touches = useRef(new Map<number, Button | null>())
  const padRef = useRef<Key[]>([])
  const clock = useRef(0)
  const wasStrike = useRef(false)
  const wasParry = useRef(false)

  const [hud, setHud] = useState({
    level: 1,
    health: 3,
    maxHealth: 3,
    minutes: 60,
    status: 'playing' as Run['status'],
    message: null as string | null,
  })

  useEffect(() => {
    runRef.current = newRun(levelFor(1), 1)
    clock.current = 0
    say(fill('Down you go. You have got an hour, and I have got all the guards.'), { as: 'papa' })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let last = performance.now()
    const pacer = createPacer<Run>(FIXED, MAX_CATCHUP)
    let shown = { ...hud }

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      canvas.height = Math.max(1, Math.floor(rect.height * ratio))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.imageSmoothingEnabled = false
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    // Deterministic enough to replay, varied enough that a guard is not a
    // metronome.
    let seed = 1
    const roll = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }

    const loop = () => {
      const now = performance.now()
      const elapsed = (now - last) / 1000
      last = now

      const run = runRef.current
      if (run) {
        const held = combine([...touches.current.values()])
        const duel = fightingGuard(run) !== null && run.hasSword

        const input: Input = {
          ...NO_INPUT,
          left: held.left,
          right: held.right,
          up: held.up,
          down: held.down,
          shift: held.care,
        }
        // Strike and parry are presses, not holds: a held button would just
        // swing for ever and there would be nothing to time.
        const move: Move =
          held.strike && !wasStrike.current
            ? 'strike'
            : held.parry && !wasParry.current
              ? 'parry'
              : held.right
                ? 'advance'
                : held.left
                  ? 'retreat'
                  : 'none'
        wasStrike.current = held.strike
        wasParry.current = held.parry

        const { next } = pacer.advance(run, elapsed, (s) => {
          clock.current += FIXED
          return step(s, input, duel ? move : 'none', roll)
        })
        runRef.current = next

        if (
          next.number !== shown.level ||
          next.prince.health !== shown.health ||
          next.maxHealth !== shown.maxHealth ||
          next.status !== shown.status ||
          next.message !== shown.message ||
          minutesLeft(next) !== shown.minutes
        ) {
          shown = {
            level: next.number,
            health: next.prince.health,
            maxHealth: next.maxHealth,
            minutes: minutesLeft(next),
            status: next.status,
            message: next.message,
          }
          setHud({ ...shown })
        }

        // --- draw -----------------------------------------------------------
        const w = canvas.width
        const h = canvas.height
        const padH = padHeight(w, h)
        const capH = Math.max(h * 0.07, 26)
        // A strip under the room for the chevrons. Drawn over the room they
        // land on whatever masonry happens to be in the corner and vanish.
        const statusH = Math.max(h * 0.055, 20)
        const middle = Math.max(60, h - padH - capH - statusH)

        // A room is ten tiles by three floors, letterboxed into what is left.
        const size = Math.min(w / ROOM_COLS, (middle / ROOM_ROWS) * 0.78)
        const floorHeight = middle / ROOM_ROWS
        const boardW = size * ROOM_COLS
        const boardH = floorHeight * ROOM_ROWS

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = INK.black
        ctx.fillRect(0, 0, w, h)

        const room = roomAt(next.prince.col, next.prince.row)
        const view: View = {
          col: room.col,
          row: room.row,
          size,
          floorHeight,
          clock: clock.current,
        }

        ctx.save()
        ctx.translate(Math.round((w - boardW) / 2), Math.round(capH))
        ctx.beginPath()
        ctx.rect(0, 0, boardW, boardH)
        ctx.clip()
        drawRoom(ctx, next.level, view, boardW, boardH, gatesOpen(next), next.prince.collapsed)
        for (const guard of next.guards) {
          if (guard.row < room.row || guard.row >= room.row + ROOM_ROWS) continue
          if (guard.col < room.col || guard.col >= room.col + ROOM_COLS) continue
          drawGuard(ctx, guard, view)
        }
        drawPrince(ctx, next.prince, view, duel)
        ctx.restore()

        // --- the furniture around it ----------------------------------------
        const text = Math.max(13, Math.min(size * 0.34, capH * 0.6))
        ctx.font = `bold ${text}px ui-monospace, Menlo, Consolas, monospace`
        ctx.textBaseline = 'middle'
        ctx.fillStyle = INK.caption
        ctx.textAlign = 'left'
        ctx.fillText(`LEVEL ${next.number}`, size * 0.4, capH / 2)
        ctx.textAlign = 'right'
        ctx.fillText(`${minutesLeft(next)} MIN`, w - size * 0.4, capH / 2)

        const chevronY = capH + boardH + statusH / 2
        drawChevrons(ctx, size * 0.4, chevronY, statusH * 0.7, next.prince.health, next.maxHealth)
        const enemy = fightingGuard(next)
        if (enemy && enemy.health > 0) {
          const width = enemy.maxHealth * statusH * 0.7 * 0.9
          drawChevrons(ctx, w - size * 0.4 - width, chevronY, statusH * 0.7, enemy.health, enemy.maxHealth)
        }

        if (next.message) {
          ctx.textAlign = 'center'
          ctx.fillStyle = INK.caption
          ctx.fillText(next.message, w / 2, capH + boardH - text)
        }

        padRef.current = padLayout(w, h, duel)
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>)
      }

      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- the glass ------------------------------------------------------------
  const readTouch = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width > 0 ? (canvasRef.current?.width ?? rect.width) / rect.width : 1
    return keyAt((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale, padRef.current)
  }
  const onDown = (e: React.PointerEvent) => {
    touches.current.set(e.pointerId, readTouch(e))
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, readTouch(e))
  }
  const onUp = (e: React.PointerEvent) => touches.current.delete(e.pointerId)

  useEffect(() => {
    const keys: Record<string, Button> = {
      ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
      ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
      Shift: 'care', ' ': 'strike', Control: 'parry',
    }
    const slot = (key: string) => -1 - Object.keys(keys).indexOf(key)
    const onKeyDown = (e: KeyboardEvent) => {
      const which = keys[e.key]
      if (!which) return
      e.preventDefault()
      touches.current.set(slot(e.key), which)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!keys[e.key]) return
      touches.current.delete(slot(e.key))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const restartLevel = () => {
    const run = runRef.current
    if (!run) return
    // The clock does not go back. That is the whole point of it.
    runRef.current = newRun(run.level, run.number, run.framesLeft, run.hasSword, run.maxHealth)
    setHud((h) => ({ ...h, status: 'playing', message: null }))
  }

  const nextLevel = () => {
    const run = runRef.current
    if (!run) return
    silence()
    const number = run.number + 1
    if (number > LEVELS.length) {
      runRef.current = { ...run, status: 'won' }
      setHud((h) => ({ ...h, status: 'won' }))
      return
    }
    runRef.current = newRun(levelFor(number), number, run.framesLeft, run.hasSword, run.maxHealth)
    setHud((h) => ({ ...h, status: 'playing', level: number, message: null }))
  }

  const startOver = () => {
    runRef.current = newRun(levelFor(1), 1)
    clock.current = 0
    setHud({ level: 1, health: 3, maxHealth: 3, minutes: 60, status: 'playing', message: null })
  }

  const overlay = hud.status !== 'playing'

  return (
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <header className="sr-only" aria-live="polite">
        LEVEL {hud.level} HEALTH {hud.health} OF {hud.maxHealth} MINUTES {hud.minutes}
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      </div>

      <button
        type="button"
        onClick={() => go('arcade')}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        className="absolute bottom-1 right-2 z-20 px-2 font-mono text-[0.7rem] uppercase tracking-widest text-dim/40"
      >
        back
      </button>

      {overlay && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="block-panel w-full max-w-md p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-rust">{fill('{papa}')}</p>
            <p className="mt-2 text-xl leading-snug">
              {hud.status === 'outOfTime'
                ? 'The hour is up! I win by simply WAITING! My favourite way!'
                : hud.status === 'won'
                  ? 'You got all the way to the top! I am going to need a bigger tower!'
                  : hud.status === 'levelDone'
                    ? 'Fine! There are twelve more doors and I like ALL of them!'
                    : 'Ooh. That looked like it smarted.'}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {hud.status === 'dead' && (
                <Btn tone="go" onClick={restartLevel} className="py-4 text-lg">
                  Again ({hud.minutes} min left)
                </Btn>
              )}
              {hud.status === 'levelDone' && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">Down to level {hud.level + 1}</Btn>
              )}
              {(hud.status === 'outOfTime' || hud.status === 'won') && (
                <Btn tone="go" onClick={startOver} className="py-4 text-lg">Start again</Btn>
              )}
              <Btn onClick={openShop}>Shop</Btn>
              <Btn onClick={() => go('arcade')}>Back to the maze</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
