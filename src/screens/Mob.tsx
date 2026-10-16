import { useEffect, useRef, useState } from 'react'
import { GUNS, LANE, LINE_Y, LIVES } from '../mob/level'
import {
  FIXED, LOUDEST, arriveIn, newRun, nextLevel, serve, standing, step, weaponOf,
  type Input, type MobEvent, type Run, type Status,
} from '../mob/run'
import { drawClock, drawHeld, drawRun, fieldOf, type View } from '../mob/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The swarm.
 *
 * A lane, you at the bottom of it, and a crowd of Papa's monsters walking down.
 * The gun fires on its own, so there is exactly one thing to do: slide it. That
 * is deliberate — a game where you hold one finger to fire and another to aim
 * is a game a nine-year-old plays with his nose on the glass, and this one
 * wants his attention on two numbers: what a crate costs, and how long he has.
 *
 * Everything else happens in `src/mob/run.ts`, which knows nothing about
 * screens, and `src/mob/draw.ts`, which knows nothing about the rules.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<MobEvent, CueName> = {
  fire: 'pop',
  hit: 'thud',
  killed: 'crumple',
  chip: 'bigger',
  opened: 'upgun',
  crates: 'swing',
  missed: 'smaller',
  through: 'breach',
  lost: 'breach',
  cleared: 'swarmDown',
  over: 'routed',
}

interface Hud {
  level: number
  score: number
  lives: number
  left: number
  status: Status
  gun: string
}

export function Mob() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const clock = useRef(0)
  const finger = useRef<number | null>(null)
  const keys = useRef<Set<string>>(new Set())
  const spare = useRef(0)
  const best = useRef(0)
  const go = useStore((s) => s.go)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    level: 1, score: 0, lives: LIVES, left: 0, status: 'playing', gun: GUNS[0].name,
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
        }

        // Read inside the pacer's callback, not after it: a frame can be two
        // steps or none, and events raised in a step that is thrown away are
        // events nobody hears.
        const heard: MobEvent[] = []
        const { next } = pacer.advance(run, elapsed, (s) => {
          const after = step(s, input, FIXED)
          if (after.events.length > 0) heard.push(...after.events)
          return after
        })
        runRef.current = next

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          if (loudest) playCue(NOISE[loudest])
        }

        // How tense: how little time is left on the clock, and how few lives.
        const soon = arriveIn(next)
        const close = Number.isFinite(soon) ? Math.min(1, Math.max(0, 1 - soon / 12)) : 0
        const hurt = 1 - (next.lives - 1) / Math.max(1, LIVES - 1)
        setHeat(Math.min(1, Math.max(close * 0.7, hurt * 0.8)))

        best.current = Math.max(best.current, next.score)
        const gun = weaponOf(next).name
        if (
          next.status !== hud.status || next.level !== hud.level ||
          next.score !== hud.score || next.lives !== hud.lives ||
          standing(next) !== hud.left || gun !== hud.gun
        ) {
          setHud({
            level: next.level,
            score: next.score,
            lives: next.lives,
            left: standing(next),
            status: next.status,
            gun,
          })
        }

        const view: View = { w, h, clock: clock.current }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        drawRun(ctx, next, view)

        /*
         * The two numbers the game is played with: how long until they reach
         * you, and what you are holding. Down at the bottom of the lane, either
         * side of the gun — on the lane rather than in the bar above it, so
         * they are in the same glance as the crate whose price they are being
         * compared against, and *below* the hazard line, which is the one strip
         * of the lane the crowd never walks through while you are still alive.
         */
        const field = fieldOf(view)
        const size = Math.max(10, field.scale * 0.4)
        const floor = field.y + (LINE_Y + 0.75) * field.scale
        drawClock(ctx, next, field.x + field.scale * 0.3, floor, size)
        drawHeld(ctx, next, field.x + (LANE - 0.3) * field.scale, floor, size)
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

  /** Where a touch lands, in lane units, so the cart and the finger agree. */
  const laneX = (e: React.PointerEvent): number => {
    const canvas = canvasRef.current
    const box = wrapRef.current?.getBoundingClientRect()
    if (!canvas || !box) return LANE / 2
    const dpr = canvas.width / Math.max(1, box.width)
    const field = fieldOf({ w: canvas.width, h: canvas.height, clock: 0 })
    return ((e.clientX - box.left) * dpr - field.x) / field.scale
  }

  const down = (e: React.PointerEvent) => {
    if (asking || hud.status !== 'playing') return
    finger.current = laneX(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (finger.current === null) return
    finger.current = laneX(e)
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
    else {
      runRef.current = { ...run, status: 'over' }
      setAsking(false)
      setHud((h) => ({ ...h, status: 'over' }))
    }
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
    setHud({
      level: 1, score: 0, lives: LIVES + spare.current, left: 0, status: 'playing',
      gun: GUNS[0].name,
    })
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
          wave {hud.level} · {hud.left} left · {hud.gun.toLowerCase()}
        </p>
        <p className="font-mono text-xs tabular-nums text-bolt">
          {'●'.repeat(Math.max(0, hud.lives))}
        </p>
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
                {cleared ? `Wave ${hud.level} held` : over ? 'They got through' : 'One got past'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {cleared
                  ? 'The next lot are tougher. Mind the crates.'
                  : over
                    ? `You held wave ${hud.level}, and scored ${hud.score}.`
                    : `${hud.lives} ${hud.lives === 1 ? 'go' : 'goes'} left. The rest are pushed back.`}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {cleared && <Btn onClick={onwards} tone="go">On to wave {hud.level + 1}</Btn>}
                {lost && <Btn onClick={carryOn} tone="go">Keep going</Btn>}
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
          slide to move · it fires by itself · a crate costs hits you are not firing at them
        </p>
      </div>
    </div>
  )
}
