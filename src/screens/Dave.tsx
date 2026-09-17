import { useEffect, useRef, useState } from 'react'
import { LEVEL_TILES_X, VIEW_TILES_X, VIEW_TILES_Y } from '../dave/level'
import { NO_INPUT, cameraFor, type Input } from '../dave/physics'
import { newGame, respawn, shoot, step, type Game } from '../dave/game'
import { levelFor } from '../dave/levels'
import { combine, zoneFor, type Zones } from '../dave/controls'
import { drawBullet, drawDave, drawLevel, drawMonster, drawSky, EGA, type View } from '../dave/draw'
import { fill } from '../config/profile'
import { Btn } from '../ui/bits'
import { say, silence } from '../voice'
import { useStore } from '../store'

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
  const openShop = useStore((s) => s.openShop)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const touches = useRef(new Map<number, Zones>())
  /** Jump is the frame the up-band is first touched, not every frame it is held. */
  const wasUp = useRef(false)
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
    let carry = 0

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
      carry = Math.min(MAX_CATCHUP, carry + (now - last) / 1000)
      last = now

      const game = gameRef.current
      if (game) {
        const held = combine([...touches.current.values()])
        const jump = held.up && !wasUp.current
        wasUp.current = held.up
        const input: Input = { ...NO_INPUT, left: held.left, right: held.right, up: held.up, down: held.down, jump }

        let next = game
        while (carry >= FIXED) {
          next = step(next, { ...input, jump: jump && next === game }, FIXED)
          carry -= FIXED
          clock.current += FIXED
        }
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
        // The board is exactly twenty tiles across and ten down, letterboxed
        // into whatever shape the screen is. Cropping it would hide the jump
        // you are about to make.
        const size = Math.min(w / VIEW_TILES_X, h / VIEW_TILES_Y)
        const boardW = size * VIEW_TILES_X
        const boardH = size * VIEW_TILES_Y

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = EGA.black
        ctx.fillRect(0, 0, w, h)
        ctx.translate(Math.round((w - boardW) / 2), Math.round((h - boardH) / 2))
        ctx.beginPath()
        ctx.rect(0, 0, boardW, boardH)
        ctx.clip()

        const view: View = {
          camera: cameraFor(next.dave, VIEW_TILES_X, LEVEL_TILES_X),
          size,
          clock: clock.current,
        }
        drawSky(ctx, view, boardW, boardH)
        drawLevel(ctx, next.level, view, next.taken, next.dave.hasTrophy, boardW)
        for (const monster of next.monsters) drawMonster(ctx, monster, view)
        for (const bullet of next.bullets) drawBullet(ctx, bullet, view)
        if (next.dave.alive) drawDave(ctx, next.dave, view)
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
    return zoneFor(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height)
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
    const keys: Record<string, keyof Zones> = {
      ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
      ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
    }
    const held: Zones = { left: false, right: false, up: false, down: false }
    const KEYBOARD = -1
    const sync = () => touches.current.set(KEYBOARD, { ...held })

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
      held[which] = true
      sync()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const which = keys[e.key]
      if (!which) return
      held[which] = false
      sync()
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

  const overlay = hud.status !== 'playing'
  const lastLevel = hud.level >= 10

  return (
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <header className="pointer-events-none relative z-10 flex items-start justify-between px-4 pt-2 font-mono text-sm uppercase tracking-widest text-chalk">
        <div>
          <p className="text-[0.65rem] text-dim">score</p>
          <p className="text-base leading-none">{hud.score}</p>
        </div>
        <div className="text-center">
          <p className="text-[0.65rem] text-dim">level</p>
          <p className="text-base leading-none">{hud.level}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] text-dim">daves</p>
          <p className="text-base leading-none">{Math.max(0, hud.lives)}</p>
        </div>
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
        {hud.message && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-sm uppercase tracking-widest text-yellow-300">
            {hud.message}
          </p>
        )}
      </div>

      <footer className="pointer-events-none relative z-10 flex items-center justify-between gap-3 px-4 pb-2 font-mono text-[0.7rem] uppercase tracking-widest text-dim">
        <div className="flex items-center gap-3">
          {hud.trophy && <span className="text-yellow-300">trophy</span>}
          {hud.gun && <span className="text-slate-300">gun</span>}
          {hud.fuel > 0 && (
            <span className="flex items-center gap-1 text-cyan-300">
              jet
              <span className="inline-block h-2 w-16 border border-cyan-400/60">
                <span
                  className="block h-full bg-cyan-400"
                  style={{ width: `${Math.min(100, (hud.fuel / 12.8) * 100)}%` }}
                />
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => go('arcade')}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="pointer-events-auto px-2 text-dim/60"
        >
          back
        </button>
      </footer>

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
              {hud.status === 'died' && (
                <Btn tone="go" onClick={again} className="py-4 text-lg">Again</Btn>
              )}
              {hud.status === 'levelComplete' && !lastLevel && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">Next room</Btn>
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
