import { useEffect, useRef, useState } from 'react'
import { ARENA, POWER_SAYS, POWERS, type Power } from '../snake/level'
import {
  FIXED, LOUDEST, newRun, respawn, step,
  type Input, type Run, type SnakeEvent, type Status,
} from '../snake/run'
import { STILL, aimOf, aimOfKeys, knobOf, stickReach, type Aim, type Stick } from '../snake/controls'
import { INK, drawHeld, drawRun, type View } from '../snake/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The garden.
 *
 * One stick, eat to grow, do not run into anybody. The move the whole thing is
 * built around is the encircle: come back round onto your own body and
 * everything inside the loop is yours, at the cost of the length you looped
 * over. See the note at the top of `snake/level.ts` for why running into
 * yourself is the one collision in here that does not kill you — in short,
 * because a game where it does is a game with no encircle in it.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<SnakeEvent, CueName> = {
  eat: 'nibble',
  grow: 'swell',
  power: 'charm',
  ring: 'loop',
  trap: 'snare',
  died: 'bitten',
  kill: 'fade',
  close: 'slip',
}

interface Hud {
  length: number
  score: number
  lives: number
  lived: number
  /** The longest this snake has got, across the lives spent so far. */
  best: number
  caught: number
  status: Status
  held: Partial<Record<Power, number>>
}

export function Snake() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const clock = useRef(0)
  const stick = useRef<Stick | null>(null)
  const keys = useRef<Set<string>>(new Set())
  const spare = useRef(0)
  const lives = useRef(3)
  const go = useStore((s) => s.go)
  const kit = useStore((s) => s.save.workshop)

  const best = useRef(0)
  const [hud, setHud] = useState<Hud>({
    length: 0, score: 0, lives: 3, lived: 0, best: 0, caught: 0, status: 'playing', held: {},
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

    if (!runRef.current) {
      runRef.current = newRun(Math.floor(Math.random() * 10000) + 1)
      lives.current = 3 + spare.current
    }

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
      const dpr = w / Math.max(1, wrap.getBoundingClientRect().width)

      if (run) {
        /*
         * The stick is in CSS pixels and the canvas is in device ones, which
         * does not matter here because only the *direction* is read — but it
         * is written down because it has bitten this project before, in a game
         * where the distance mattered.
         */
        const reach = stickReach(w / dpr, h / dpr)
        const aim: Aim = stick.current
          ? aimOf(stick.current, reach)
          : keys.current.size > 0 ? aimOfKeys(keys.current) : STILL
        const input: Input = { x: aim.x, y: aim.y, dash: aim.dash }

        // Events are read inside the step, not off the state the frame ends
        // on: a frame holds several steps and each clears the last one's.
        const heard: SnakeEvent[] = []
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

        /*
         * How tense: how big you are.
         *
         * Which is the right number in this game and not an obvious one. There
         * is no clock to run down and no level to be near the end of — what
         * makes a run tense is having something to lose, and the rivals start
         * hunting you at about the same length the music starts to.
         */
        const you = next.snakes[0]
        if (you) best.current = Math.max(best.current, you.length)
        setHeat(Math.min(1, Math.max(0, ((you?.length ?? 0) - 4) / 14)))

        const held = you?.held ?? {}
        if (
          next.status !== hud.status || next.caught !== hud.caught ||
          Math.round(next.lived) !== Math.round(hud.lived) ||
          Math.round((you?.length ?? 0) * 2) !== Math.round(hud.length * 2) ||
          (you?.score ?? 0) !== hud.score ||
          POWERS.some((p) => (held[p] === undefined) !== (hud.held[p] === undefined))
        ) {
          setHud({
            length: you?.length ?? 0,
            score: you?.score ?? 0,
            lives: lives.current,
            lived: next.lived,
            best: best.current,
            caught: next.caught,
            status: next.status,
            held: { ...held },
          })
        }

        const view: View = { w, h, clock: clock.current }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        drawRun(ctx, next, view)

        // The stick, where the thumb put it.
        if (stick.current) {
          const knob = knobOf(stick.current, reach)
          ctx.save()
          ctx.globalAlpha = 0.3
          ctx.strokeStyle = INK.chalk
          ctx.lineWidth = 2 * dpr
          ctx.beginPath()
          ctx.arc(stick.current.fromX * dpr, stick.current.fromY * dpr, reach * dpr, 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 0.6
          ctx.fillStyle = aim.dash ? '#ffc84a' : INK.chalk
          ctx.beginPath()
          ctx.arc(knob.x * dpr, knob.y * dpr, reach * dpr * 0.38, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        drawHeld(ctx, next, w * 0.06, h * 0.93, Math.max(10, Math.min(w, h) * 0.028))
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

  // --- the thumb -------------------------------------------------------------

  const wrapAt = (e: React.PointerEvent) => {
    const box = wrapRef.current?.getBoundingClientRect()
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) }
  }

  const down = (e: React.PointerEvent) => {
    if (asking || hud.status !== 'playing') return
    const at = wrapAt(e)
    stick.current = { fromX: at.x, fromY: at.y, x: at.x, y: at.y, id: e.pointerId }
    // Captured, so a thumb that slides off the edge keeps steering. The matching
    // release is handled below for the same reason.
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    if (!stick.current || stick.current.id !== e.pointerId) return
    const at = wrapAt(e)
    stick.current = { ...stick.current, x: at.x, y: at.y }
  }

  const up = (e: React.PointerEvent) => {
    if (stick.current?.id !== e.pointerId) return
    stick.current = null
  }

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

  // --- lives -----------------------------------------------------------------

  const carryOn = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = respawn(run)
    setAsking(false)
    setHud((h) => ({ ...h, status: 'playing' }))
  }

  const spendLife = () => {
    lives.current -= 1
    if (lives.current > 0) carryOn()
  }

  const again = () => {
    runRef.current = newRun(Math.floor(Math.random() * 10000) + 1)
    lives.current = 3 + spare.current
    setAsking(false)
    best.current = 0
    setHud({
      length: 0, score: 0, lives: lives.current, lived: 0, best: 0,
      caught: 0, status: 'playing', held: {},
    })
  }

  const lost = hud.status === 'lost'
  const out = lost && lives.current <= 1

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-ink">
      {/*
        * The back button is positioned absolutely, which every other screen in
        * here knows and this one did not: the score sat underneath it and the
        * two drew on top of each other. The left padding is the room it needs.
        */}
      <BackButton onClick={() => go('home')} />
      <div className="flex shrink-0 items-center gap-2 py-2 pl-20 pr-3">
        <p className="font-mono text-xs font-bold tabular-nums tracking-widest text-chalk">
          {String(hud.score).padStart(6, '0')}
        </p>
        <p className="ml-auto font-mono text-[0.68rem] tabular-nums text-dim">
          {hud.length.toFixed(1)} long · {hud.caught} caught · best {hud.best.toFixed(1)}
        </p>
        <p className="font-mono text-xs tabular-nums text-bolt">{'●'.repeat(Math.max(0, lives.current))}</p>
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
            lastChance={lives.current <= 1}
            onDone={(right) => { if (right) carryOn(); else spendLife() }}
          />
        )}

        {lost && !asking && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="block-panel w-full max-w-sm p-5 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
                {out ? 'That is the lot' : 'Caught'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {out
                  ? `You got to ${hud.best.toFixed(1)} long and caught ${hud.caught}.`
                  : 'Somebody got you.'}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {!out && <Btn onClick={() => setAsking(true)}>Answer one and carry on</Btn>}
                <Btn onClick={again} tone={out ? 'go' : 'plain'}>Start again</Btn>
                <Btn onClick={() => go('home')} tone="plain">Back</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1">
        <p className="text-center font-mono text-[0.65rem] uppercase tracking-widest text-dim/60">
          hold anywhere to steer · push right over to dash
        </p>
      </div>
    </div>
  )
}

/** Exported for the front door's tile, which draws the real thing. */
export const GARDEN_EDGE = ARENA
void POWER_SAYS
