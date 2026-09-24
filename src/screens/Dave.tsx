import { useEffect, useRef, useState } from 'react'
import { LEVEL_TILES_X, VIEW_TILES_X, VIEW_TILES_Y } from '../dave/level'
import { JET_SECONDS, NO_INPUT, cameraFor, type Input } from '../dave/physics'
import { newGame, respawn, shoot, step, type Game } from '../dave/game'
import { levelFor } from '../dave/levels'
import { createPacer } from '../arcade/pacing'
import { blendDave, blendMonster } from '../dave/blend'
import { combine, keyAt, padHeight, padLayout, type Button, type Key } from '../dave/controls'
import {
  drawBullet,
  drawDave,
  drawFrame,
  drawLevel,
  drawLifeIcon,
  drawMonster,
  drawPad,
  drawSky,
  EGA,
  type View,
} from '../dave/draw'
import { fill } from '../config/profile'
import { Btn } from '../ui/bits'
import { say, silence } from '../voice'
import { useStore } from '../store'
import { Interlude } from './Interlude'

/**
 * Dangerous Dave.
 *
 * The simulation is pure and lives in `dave/`; this is the loop that drives
 * it, the canvas it is drawn on, and the glass it is played through.
 */

const FIXED = 1 / 120
const MAX_CATCHUP = 0.25

export function Dave() {
  const go = useStore((s) => s.go)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const touches = useRef(new Map<number, Button | null>())
  /** Where the buttons are this frame, so a touch can be matched to one. */
  const padRef = useRef<Key[]>([])
  /** Jump is the frame the up-band is first touched, not every frame it is held. */
  const wasUp = useRef(false)
  const wasFire = useRef(false)
  const clock = useRef(0)

  const [hud, setHud] = useState({
    score: 0, lives: 3, level: 1, fuel: 0, gun: false, trophy: false,
    status: 'playing' as Game['status'], message: null as string | null,
  })

  useEffect(() => {
    gameRef.current = newGame(levelFor(1), 1)
    clock.current = 0
    say(fill('Into the hideout, then. Do try not to touch anything hot.'), { as: 'papa' })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let last = performance.now()
    const pacer = createPacer<Game>(FIXED, MAX_CATCHUP)

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

    let shown = { ...hud }

    const loop = () => {
      const now = performance.now()
      const elapsed = (now - last) / 1000
      last = now

      const game = gameRef.current
      if (game) {
        const held = combine([...touches.current.values()])
        const jump = held.up && !wasUp.current
        wasUp.current = held.up
        const input: Input = { ...NO_INPUT, left: held.left, right: held.right, up: held.up, down: held.down, jump }
        if (held.fire && !wasFire.current) {
          const armed = shoot(gameRef.current!)
          gameRef.current = armed
        }
        wasFire.current = held.fire

        // Drawn between the last two states, not at the latest one. Without
        // it everything moves by however many slices happened to fit in the
        // frame — one, two or three — which is a fine stutter that gets worse
        // the faster the screen refreshes.
        let first = true
        const { previous, next, alpha } = pacer.advance(game, elapsed, (s) => {
          const out = step(s, { ...input, jump: jump && first }, FIXED)
          first = false
          clock.current += FIXED
          return out
        })
        gameRef.current = next

        if (
          next.score !== shown.score || next.lives !== shown.lives ||
          next.status !== shown.status || next.message !== shown.message ||
          Math.ceil(next.dave.fuel) !== Math.ceil(shown.fuel) ||
          next.dave.hasGun !== shown.gun || next.dave.hasTrophy !== shown.trophy
        ) {
          shown = {
            score: next.score, lives: next.lives, level: next.number,
            fuel: next.dave.fuel, gun: next.dave.hasGun, trophy: next.dave.hasTrophy,
            status: next.status, message: next.message,
          }
          setHud({ ...shown })
        }

        // --- draw -----------------------------------------------------------
        const w = canvas.width
        const h = canvas.height
        /*
         * Three bands down the screen: the score along the top, the room in
         * the middle, and the buttons along the bottom. The buttons get their
         * own room rather than sitting over the board — Dave starts in the
         * bottom left corner, exactly under the walk-left button.
         *
         * The room is exactly twenty tiles across and ten down, letterboxed
         * into whatever is left. Cropping it would hide the jump you are about
         * to make.
         */
        const headerH = Math.max(h * 0.085, 30)
        const padH = padHeight(w, h)
        const middle = Math.max(40, h - headerH - padH)
        const size = Math.min(w / VIEW_TILES_X, middle / VIEW_TILES_Y)
        const boardW = size * VIEW_TILES_X
        const boardH = size * VIEW_TILES_Y

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = EGA.black
        ctx.fillRect(0, 0, w, h)
        // Saved, because the clip below has to be undone before the score bar
        // is drawn — resetting the transform does not clear a clip, and the
        // score was being quietly cut away at the top of the board.
        ctx.save()
        ctx.translate(
          Math.round((w - boardW) / 2),
          Math.round(headerH + (middle - boardH) / 2),
        )
        ctx.beginPath()
        ctx.rect(0, 0, boardW, boardH)
        ctx.clip()

        const drawn = blendDave(previous.dave, next.dave, alpha)
        const view: View = {
          camera: cameraFor(drawn, VIEW_TILES_X, LEVEL_TILES_X),
          size,
          clock: clock.current,
        }
        drawSky(ctx, view, boardW, boardH)
        drawLevel(ctx, next.level, view, next.taken, next.dave.hasTrophy, boardW)
        next.monsters.forEach((monster, i) =>
          drawMonster(ctx, blendMonster(previous.monsters[i], monster, alpha), view),
        )
        for (const bullet of next.bullets) drawBullet(ctx, bullet, view)
        if (next.dave.alive) drawDave(ctx, drawn, view)
        drawFrame(ctx, next.level, view, boardW, boardH)

        // The score bar and the fuel gauge belong to the picture, not to the
        // page around it: same pixels, same font, same colours as the game.
        ctx.restore()
        const bar = Math.max(14, Math.min(size * 0.52, headerH * 0.52))
        ctx.font = `bold ${bar}px ui-monospace, Menlo, Consolas, monospace`
        ctx.textBaseline = 'middle'
        const midline = headerH / 2

        ctx.fillStyle = EGA.brightGreen
        ctx.textAlign = 'left'
        const pad = size * 0.6
        ctx.fillText(`SCORE: ${String(next.score).padStart(5, '0')}`, pad, midline)
        ctx.textAlign = 'center'
        ctx.fillText(`LEVEL ${String(next.number).padStart(2, '0')}`, w / 2, midline)

        ctx.textAlign = 'right'
        const livesLabel = 'DAVES:'
        const icon = bar * 1.1
        const livesRight = w - pad - Math.max(0, next.lives) * (icon + 4)
        ctx.fillText(livesLabel, livesRight, midline)
        for (let i = 0; i < Math.max(0, next.lives); i++) {
          drawLifeIcon(ctx, livesRight + 6 + i * (icon + 4), midline - icon / 2, icon)
        }

        padRef.current = padLayout(w, h, {
          gun: next.dave.hasGun,
          jetpack: next.dave.hasJetpack && next.dave.fuel > 0,
        })
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>)

        if (next.dave.hasJetpack && next.dave.fuel > 0) {
          // Just under the room, above the buttons.
          const gaugeY = headerH + middle - bar * 1.2
          ctx.fillStyle = EGA.brightGreen
          ctx.textAlign = 'left'
          ctx.fillText('JETPACK', pad, gaugeY + bar * 0.5)
          const gx = pad + bar * 5.2
          const gw = w - gx - pad
          ctx.strokeStyle = EGA.yellow
          ctx.lineWidth = Math.max(2, bar * 0.14)
          ctx.strokeRect(gx, gaugeY, gw, bar)
          ctx.fillStyle = EGA.red
          ctx.fillRect(gx + 3, gaugeY + 3, (gw - 6) * (next.dave.fuel / JET_SECONDS), bar - 6)
        }
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
    // The buttons are laid out in canvas pixels, which may be denser than CSS
    // pixels on a good screen; the touch arrives in CSS pixels.
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
  const onUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId)
  }

  useEffect(() => {
    const keys: Record<string, Button> = {
      ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
      ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
    }
    // Each key held gets its own slot, so several at once work like several
    // fingers do.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        const game = gameRef.current
        if (game) gameRef.current = shoot(game)
        return
      }
      const which = keys[e.key]
      if (!which) return
      e.preventDefault()
      touches.current.set(-1 - Object.keys(keys).indexOf(e.key), which)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const which = keys[e.key]
      if (!which) return
      touches.current.delete(-1 - Object.keys(keys).indexOf(e.key))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const again = () => {
    const game = gameRef.current
    if (!game) return
    gameRef.current = respawn(game)
    clock.current = 0
    setHud((h) => ({ ...h, status: 'playing', message: null }))
  }

  const nextLevel = () => {
    const game = gameRef.current
    if (!game) return
    silence()
    const number = game.number + 1
    gameRef.current = newGame(levelFor(number), number, game.lives, game.score)
    clock.current = 0
    setHud((h) => ({ ...h, status: 'playing', level: number, message: null }))
  }

  const lastLevel = hud.level >= 10
  // Losing a life asks you something and puts you straight back in. A panel
  // saying "you died, press again" in front of it is a tap of nothing.
  const asking = hud.status === 'died'
  const overlay = hud.status !== 'playing' && !asking

  return (
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/*
        * The score is drawn in the picture, which leaves nothing for a screen
        * reader — or for the smoke test — to read. This says the same thing in
        * text, out of sight.
        */}
      <header className="sr-only" aria-live="polite">
        SCORE: {String(hud.score).padStart(5, '0')} LEVEL {String(hud.level).padStart(2, '0')} DAVES: {Math.max(0, hud.lives)}
        {hud.trophy ? ' TROPHY' : ''}
        {hud.gun ? ' GUN' : ''}
        {hud.fuel > 0 ? ` JETPACK ${Math.ceil(hud.fuel)}` : ''}
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
        {hud.message && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-sm uppercase tracking-widest text-yellow-300">
            {hud.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => go('home')}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        className="absolute bottom-1 right-2 z-20 px-2 font-mono text-[0.7rem] uppercase tracking-widest text-dim/50"
      >
        back
      </button>

      {asking && <Interlude onDone={again} />}

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
              {hud.status === 'gameOver'
                ? 'And that is the end of that! My hideout remains un-raided!'
                : hud.status === 'levelComplete'
                  ? lastLevel
                    ? 'You got through the whole thing! I am going to have a sit down!'
                    : 'Fine! FINE! There are more rooms. I have got LOADS of rooms!'
                  : 'Ooh! That looked like it hurt!'}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {hud.status === 'levelComplete' && !lastLevel && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">Next room</Btn>
              )}
              <Btn onClick={() => go('home')}>Back to the menu</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
