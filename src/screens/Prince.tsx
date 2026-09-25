import { useEffect, useRef, useState } from 'react'
import { ROOM_COLS, ROOM_ROWS, viewAt } from '../arcade/dungeon/level'
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
  createLatch,
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
  FLOOR_DEPTH,
  drawGuard,
  drawPrince,
  drawRoom,
  type View,
} from '../arcade/dungeon/draw'
import { playCue } from '../music/player'
import { createPacer } from '../arcade/pacing'
import { tweenRun } from '../arcade/dungeon/smooth'
import { fill } from '../config/profile'
import { BackButton, Btn } from '../ui/bits'
import { say, silence } from '../voice'
import { LABELS, hintAlpha } from '../ui/padHints'
import { useStore } from '../store'
import { Interlude } from './Interlude'

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

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const buttons = useRef(createLatch())
  const wasDuel = useRef(false)
  /** Whether the gates were open last frame, so a change can be heard. */
  const wasOpen = useRef(false)
  const padRef = useRef<Key[]>([])
  const clock = useRef(0)
  /** The pad as it was last frame, so a change of buttons re-announces them. */
  const padShape = useRef('')
  /** When the labels last started, for the fade. */
  const hintsFrom = useRef(0)
  /** Where the view sat last frame; the band only works if it can stay put. */
  const camera = useRef(0)
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
        const held = buttons.current.read()
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

        let stepped = false
        const { previous, next, alpha } = pacer.advance(run, elapsed, (s) => {
          clock.current += FIXED
          stepped = true
          return step(s, input, duel ? move : 'none', roll)
        })
        // Only now is it safe to forget a tap: on a frame where the clock did
        // not advance far enough to take a step, nothing has read it yet.
        if (stepped) buttons.current.consumed()
        runRef.current = next
        // A window on the run, for driving the game from a browser test. Dev
        // only: the point of it is being able to read what the prince is
        // actually doing while a button is held, rather than guessing from a
        // screenshot.
        if (import.meta.env.DEV) {
          ;(window as unknown as { dungeon?: unknown }).dungeon = {
            action: next.prince.action,
            col: next.prince.col,
            row: next.prince.row,
            facing: next.prince.facing,
            held,
          }
        }

        /**
         * The cues.
         *
         * Fired off changes in the run rather than from inside the simulation,
         * which stays pure and testable and knows nothing about a speaker.
         * Nothing loops: the dungeon is silent except for these, the way the
         * original was, and the silence is most of why they land.
         */
        if (next.number !== shown.level && next.status === 'playing') playCue('dungeon')
        if (next.status !== shown.status) {
          if (next.status === 'dead' || next.status === 'outOfTime') playCue('tragic')
          if (next.status === 'levelDone') playCue('victory')
        }
        if (duel && !wasDuel.current) playCue('danger')
        wasDuel.current = duel

        // A gate moving somewhere off screen is still worth knowing about:
        // standing on the plate is the whole puzzle, and until now the only
        // way to tell it had worked was to walk back and look.
        const open = gatesOpen(next)
        if (open !== wasOpen.current) playCue('gate')
        wasOpen.current = open
        if (next.prince.health < shown.health && next.status === 'playing') playCue('blade')
        if (next.prince.health > shown.health) playCue('potion')
        // Only the minute warnings, which are the only messages that arrive
        // without anything else on screen changing to explain them.
        if (next.message !== shown.message && next.message && /MINUTE/i.test(next.message)) {
          playCue('timer')
        }

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

        // A room is ten tiles by three floors, letterboxed into what is left,
        // plus the depth of the floor hanging below the lowest one — without
        // that the bottom slab is drawn past the edge of the board and anyone
        // standing on it floats over nothing.
        const rows = ROOM_ROWS + FLOOR_DEPTH
        /**
         * A room has a shape, and it keeps it.
         *
         * The tile width used to be worked out from whatever was left over,
         * and the floor height from whatever was left over vertically, which
         * meant the two had nothing to do with each other. On a phone held
         * upright that gave floors four times taller than a tile is wide: the
         * rooms came out stretched into caverns, the prince was a speck, and
         * almost none of the level fitted on the screen. So the tile decides
         * the floor, and what is left over becomes a margin.
         */
        const size = Math.min(w / ROOM_COLS, (middle / rows) * 0.78)
        const floorHeight = size / 0.78

        /*
         * How many floors to show.
         *
         * Three was baked in, because three floors is what a room is. But a
         * phone held upright has the height for eight or nine of them and was
         * spending the rest on black, which meant the only way to find out
         * what was under a ledge was to jump off it and see — reported as
         * "I basically had to jump into the darkness hoping I'll land on
         * something". Never fewer than a room, never more than the level has.
         */
        const fits = Math.floor(middle / floorHeight - FLOOR_DEPTH)
        const floors = Math.max(ROOM_ROWS, Math.min(fits, next.level.rows.length))
        const boardW = size * ROOM_COLS
        const boardH = floorHeight * (floors + FLOOR_DEPTH)

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = INK.black
        ctx.fillRect(0, 0, w, h)

        /*
         * Where everyone is drawn, part way between the last two steps.
         *
         * The simulation stays on its fifteen — the animation tables depend on
         * those steps landing exactly — but the drawing does not have to, and
         * drawing the newest state outright meant the same picture four times
         * and then a jump. Reported as the game looking "so choppy", which is
         * precisely what it was. The pacer has kept this pair all along.
         */
        const drawn = tweenRun(previous, next, alpha)

        /*
         * The drawn position, for a browser test to sample. Dev only. The
         * window above carries what the simulation thinks, which is on its
         * fifteen by design — the only way to tell whether the picture is
         * smooth is to look at what actually reaches the canvas.
         */
        if (import.meta.env.DEV) {
          const dev = window as unknown as { dungeonDrawn?: unknown }
          dev.dungeonDrawn = { col: drawn.prince.col, row: drawn.prince.row }
        }

        // The camera follows the drawn position, not the simulated one, or the
        // room scrolls in fifteen lurches under a figure moving smoothly.
        const room = viewAt(next.level, camera.current, drawn.prince.col, drawn.prince.row, floors)
        camera.current = room.col
        const view: View = {
          col: room.col,
          row: room.row,
          rows: floors,
          size,
          floorHeight,
          clock: clock.current,
        }

        ctx.save()
        ctx.translate(Math.round((w - boardW) / 2), Math.round(capH + (middle - boardH) / 2))
        ctx.beginPath()
        ctx.rect(0, 0, boardW, boardH)
        ctx.clip()
        drawRoom(ctx, next.level, view, boardW, boardH, gatesOpen(next), next.prince.collapsed)
        for (const guard of drawn.guards) {
          if (guard.row < room.row || guard.row >= room.row + floors) continue
          if (guard.col < room.col - 1 || guard.col > room.col + ROOM_COLS) continue
          drawGuard(ctx, guard, view)
        }
        drawPrince(ctx, drawn.prince, view, duel)
        ctx.restore()

        // --- the furniture around it ----------------------------------------
        const text = Math.max(13, Math.min(size * 0.34, capH * 0.6))
        ctx.font = `bold ${text}px ui-monospace, Menlo, Consolas, monospace`
        ctx.textBaseline = 'middle'
        ctx.fillStyle = INK.caption
        ctx.textAlign = 'left'
        /*
         * Room for the way out, which sits in this corner.
         *
         * Measured from the button's real size in screen pixels rather than
         * guessed as a multiple of the header height: the header scales with
         * the board and the button does not, so on a short wide screen the
         * guess left "BACK" and the first reading touching each other.
         */
        const backRoom = 70 * (canvas.width / Math.max(1, canvas.clientWidth))
        ctx.fillText(`LEVEL ${next.number}`, backRoom, capH / 2)
        ctx.textAlign = 'right'
        ctx.fillText(`${minutesLeft(next)} MIN`, w - size * 0.4, capH / 2)

        const boardTop = capH + (middle - boardH) / 2
        const chevronY = boardTop + boardH + statusH / 2
        drawChevrons(ctx, size * 0.4, chevronY, statusH * 0.7, next.prince.health, next.maxHealth)
        const enemy = fightingGuard(next)
        if (enemy && enemy.health > 0) {
          const width = enemy.maxHealth * statusH * 0.7 * 0.9
          drawChevrons(ctx, w - size * 0.4 - width, chevronY, statusH * 0.7, enemy.health, enemy.maxHealth)
        }

        if (next.message) {
          // On a plate of its own. Laid straight over the room it collided
          // with whatever happened to be standing in the middle of it.
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const my = boardTop + boardH - text * 1.2
          const mw = ctx.measureText(next.message).width + text * 1.6
          ctx.fillStyle = 'rgba(8,10,14,0.82)'
          ctx.fillRect(w / 2 - mw / 2, my - text * 0.95, mw, text * 1.9)
          ctx.fillStyle = INK.caption
          ctx.fillText(next.message, w / 2, my)
        }

        padRef.current = padLayout(w, h, duel)
        /*
         * Whenever the buttons change, say what they are again.
         *
         * That covers the start of a level and, in the dungeon, a duel
         * swapping the pad for a sword and a shield — which is the pair
         * nobody could find, because they only appear once a fight starts.
         */
        const shape = padRef.current.map((k) => k.id).join(',')
        if (shape !== padShape.current) {
          padShape.current = shape
          hintsFrom.current = clock.current
        }
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>, {
          alpha: hintAlpha(clock.current - hintsFrom.current),
          labels: LABELS.dungeon,
        })
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
    buttons.current.press(e.pointerId, readTouch(e))
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!buttons.current.has(e.pointerId)) return
    buttons.current.press(e.pointerId, readTouch(e))
  }
  const onUp = (e: React.PointerEvent) => buttons.current.release(e.pointerId)

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
      buttons.current.press(slot(e.key), which)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!keys[e.key]) return
      buttons.current.release(slot(e.key))
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

  // Losing a life asks you something and puts you straight back in, on the
  // same clock — the hour does not stop for a question any more than it stops
  // for anything else.
  const asking = hud.status === 'dead'
  const overlay = hud.status !== 'playing' && !asking

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

      <BackButton onClick={() => go('home')} />

      {asking && <Interlude onDone={restartLevel} />}

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
              {hud.status === 'levelDone' && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">Down to level {hud.level + 1}</Btn>
              )}
              {(hud.status === 'outOfTime' || hud.status === 'won') && (
                <Btn tone="go" onClick={startOver} className="py-4 text-lg">Start again</Btn>
              )}
              <Btn onClick={() => go('home')}>Back to the menu</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
