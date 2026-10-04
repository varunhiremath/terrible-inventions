import { useEffect, useRef, useState } from 'react'
import { LIVES, POWERS, TALL, WIDE, type Power } from '../bricks/level'
import {
  FIXED, LOUDEST, newRun, nextLevel, serve, standing, step,
  type BrickEvent, type Input, type Run, type Status,
} from '../bricks/run'
import { drawHeld, drawRun, fieldOf, type View } from '../bricks/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The wall.
 *
 * A bat, a ball, and a wall that starts as four rows of blue and ends as a
 * fortress. Some bricks take three goes, some cannot be broken at all and are
 * only there to be in the way, and some drop something when they go.
 *
 * One control: put a finger on the field and the bat goes to it. Tapping lets
 * a held ball go and fires the gun, so there is nothing else to press.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<BrickEvent, CueName> = {
  tap: 'tink',
  crack: 'chip',
  break: 'smash',
  solid: 'clank',
  bat: 'tink',
  wall: 'tink',
  drop: 'falling',
  power: 'prize',
  shoot: 'pew',
  lost: 'missed',
  cleared: 'wallDown',
  launch: 'serve',
  blast: 'blast',
  saved: 'saved',
  nasty: 'nasty',
}

interface Hud {
  level: number
  score: number
  lives: number
  left: number
  status: Status
  held: Partial<Record<Power, number>>
}

export function Bricks() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const clock = useRef(0)
  const finger = useRef<number | null>(null)
  const tapped = useRef(false)
  const keys = useRef<Set<string>>(new Set())
  const spare = useRef(0)
  const best = useRef(0)
  const go = useStore((s) => s.go)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    level: 1, score: 0, lives: LIVES, left: 0, status: 'playing', held: {},
  })
  const [asking, setAsking] = useState(false)

  useEffect(() => { spare.current = spareLives({ workshop: kit }) }, [kit])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    if (!runRef.current) runRef.current = newRun(1, LIVES + spare.current)

    const pacer = createPacer<Run>(FIXED, MAX_CATCHUP)
    let frame = 0
    let last = performance.now()

    const loop = () => {
      const now = performance.now()
      const elapsed = Math.min(0.25, (now - last) / 1000)
      last = now
      clock.current += elapsed

      const run = runRef.current
      const w = canvas.width
      const h = canvas.height

      if (run) {
        const down = keys.current
        const input: Input = {
          to: finger.current,
          left: down.has('ArrowLeft') || down.has('a'),
          right: down.has('ArrowRight') || down.has('d'),
          act: tapped.current || down.has(' ') || down.has('ArrowUp'),
        }

        const heard: BrickEvent[] = []
        let stepped = false
        const { next } = pacer.advance(run, elapsed, (s) => {
          stepped = true
          const after = step(s, input, FIXED)
          if (after.events.length > 0) heard.push(...after.events)
          return after
        })
        // A tap is a moment, not a state: held past the step that read it, one
        // tap fires the gun every frame for as long as a finger is down.
        if (stepped) tapped.current = false
        runRef.current = next

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          if (loudest) playCue(NOISE[loudest])
        }

        // How tense: how little of the wall is left, and how few lives.
        const gone = 1 - standing(next) / Math.max(1, standing(newRun(next.level)))
        const hurt = 1 - (next.lives - 1) / Math.max(1, LIVES - 1)
        setHeat(Math.min(1, Math.max(gone * 0.5, hurt * 0.8)))

        best.current = Math.max(best.current, next.score)
        const held = next.held
        if (
          next.status !== hud.status || next.level !== hud.level ||
          next.score !== hud.score || next.lives !== hud.lives ||
          standing(next) !== hud.left ||
          POWERS.some((p) => (held[p] === undefined) !== (hud.held[p] === undefined))
        ) {
          setHud({
            level: next.level,
            score: next.score,
            lives: next.lives,
            left: standing(next),
            status: next.status,
            held: { ...held },
          })
        }

        const view: View = { w, h, clock: clock.current }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        drawRun(ctx, next, view)
        const field = fieldOf(view)
        drawHeld(
          ctx,
          next,
          field.x + field.scale * 0.6,
          field.y + field.scale * (TALL - 0.45),
          Math.max(7, field.scale * 0.28),
        )
      }

      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      setHeat(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- the finger ------------------------------------------------------------

  /** Where a touch lands, in field units, so the bat and the finger agree. */
  const fieldX = (e: React.PointerEvent): number => {
    const canvas = canvasRef.current
    const box = wrapRef.current?.getBoundingClientRect()
    if (!canvas || !box) return WIDE / 2
    const dpr = canvas.width / Math.max(1, box.width)
    const field = fieldOf({ w: canvas.width, h: canvas.height, clock: 0 })
    return ((e.clientX - box.left) * dpr - field.x) / field.scale
  }

  const down = (e: React.PointerEvent) => {
    if (asking || hud.status !== 'playing') return
    finger.current = fieldX(e)
    tapped.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (finger.current === null) return
    finger.current = fieldX(e)
  }
  const up = () => { finger.current = null }

  useEffect(() => {
    const press = (e: KeyboardEvent) => { keys.current.add(e.key) }
    const lift = (e: KeyboardEvent) => { keys.current.delete(e.key) }
    window.addEventListener('keydown', press)
    window.addEventListener('keyup', lift)
    return () => {
      window.removeEventListener('keydown', press)
      window.removeEventListener('keyup', lift)
    }
  }, [])

  // --- between goes ----------------------------------------------------------

  const carryOn = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = serve(run)
    setAsking(false)
    setHud((h) => ({ ...h, status: 'playing' }))
  }

  const spendLife = () => {
    const run = runRef.current
    if (!run) return
    if (run.lives > 0) carryOn()
    else { runRef.current = { ...run, status: 'over' }; setAsking(false); setHud((h) => ({ ...h, status: 'over' })) }
  }

  const onwards = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = nextLevel(run)
    setHud((h) => ({ ...h, status: 'playing', level: h.level + 1 }))
  }

  const again = () => {
    runRef.current = newRun(1, LIVES + spare.current)
    setAsking(false)
    setHud({ level: 1, score: 0, lives: LIVES + spare.current, left: 0, status: 'playing', held: {} })
  }

  const lost = hud.status === 'lost'
  const cleared = hud.status === 'cleared'
  const over = hud.status === 'over'

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-ink">
      <BackButton onClick={() => go('home')} />
      <div className="flex shrink-0 items-center gap-2 py-2 pl-20 pr-3">
        <p className="font-mono text-xs font-bold tabular-nums tracking-widest text-chalk">
          {String(hud.score).padStart(6, '0')}
        </p>
        <p className="ml-auto font-mono text-[0.68rem] tabular-nums text-dim">
          wall {hud.level} · {hud.left} left · best {String(best.current).padStart(5, '0')}
        </p>
        <p className="font-mono text-xs tabular-nums text-bolt">{'●'.repeat(Math.max(0, hud.lives))}</p>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

        {asking && (
          <Interlude
            reward="another go"
            lastChance={hud.lives <= 0}
            onDone={(right) => { if (right) carryOn(); else spendLife() }}
          />
        )}

        {(lost || cleared || over) && !asking && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="block-panel w-full max-w-sm p-5 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
                {cleared ? `Wall ${hud.level} down` : over ? 'That is the lot' : 'Missed it'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {cleared
                  ? 'Next one is harder.'
                  : over
                    ? `You got to wall ${hud.level}, and ${hud.score} points.`
                    : `${hud.lives} ${hud.lives === 1 ? 'go' : 'goes'} left.`}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {cleared && <Btn onClick={onwards} tone="go">On to wall {hud.level + 1}</Btn>}
                {lost && <Btn onClick={carryOn} tone="go">Next ball</Btn>}
                {lost && <Btn onClick={() => setAsking(true)}>Answer one for a spare</Btn>}
                {over && <Btn onClick={again} tone="go">Start again</Btn>}
                <Btn onClick={() => go('home')} tone="plain">Back</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1">
        <p className="text-center font-mono text-[0.65rem] uppercase tracking-widest text-dim/60">
          slide to move the bat · tap to let go and to fire
        </p>
      </div>
    </div>
  )
}
