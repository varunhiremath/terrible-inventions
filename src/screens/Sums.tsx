import { useEffect, useRef, useState } from 'react'
import { COLS, LIVES, ROWS, TO_CLEAR } from '../sums/level'
import {
  FIXED, LOUDEST, newRun, nextLevel, step, tap, tryAgain,
  type FloodEvent, type Run, type Status,
} from '../sums/run'
import { cellAt, drawRun, type Cursor, type View } from '../sums/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The flood.
 *
 * Forty blocks, each with a sum on it, and only the true ones can be broken.
 * Above them somebody is standing in a chamber the water is coming up in: every
 * right answer takes some of it away and every wrong one puts some back, so the
 * clock is a person and the way to stop it is to be right.
 *
 * One control: tap a block. There is nothing to hold down, nothing to aim, and
 * no way to lose by being slow with your fingers — which is the point, because
 * this is the one game in here where the thinking is the game.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<FloodEvent, CueName> = {
  crush: 'crunch',
  combo: 'chain',
  wrong: 'clunk',
  drain: 'gurgle',
  saved: 'rescued',
  soaked: 'under',
  over: 'allOut',
  settle: 'clack',
}

interface Hud {
  level: number
  score: number
  lives: number
  left: number
  water: number
  status: Status
  soul: string
}

export function Sums() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const clock = useRef(0)
  /** Taps waiting to be read inside the simulation, not at frame time. */
  const taps = useRef<Cursor[]>([])
  const cursor = useRef<Cursor | null>(null)
  const spare = useRef(0)
  const best = useRef(0)
  const go = useStore((s) => s.go)
  const rating = useStore((s) => s.save.rating)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    level: 1, score: 0, lives: LIVES, left: TO_CLEAR, water: 0, status: 'playing', soul: '',
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

    if (!runRef.current) runRef.current = newRun(1, rating, LIVES + spare.current)

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
        const heard: FloodEvent[] = []
        const { next } = pacer.advance(run, elapsed, (s) => {
          /*
           * The taps are read in here rather than at frame time, because this
           * is the only place that runs exactly once per step. Read outside,
           * a tap at the wrong moment is either dropped or counted twice —
           * which this project has now learnt in three separate games.
           */
          let on = s
          while (taps.current.length > 0 && on.status === 'playing') {
            const where = taps.current.shift()
            if (!where) break
            on = tap(on, where.col, where.row)
            if (on.events.length > 0) heard.push(...on.events)
          }
          const after = step(on, FIXED)
          if (after.events.length > 0) heard.push(...after.events)
          return after
        })
        // Anything left over belongs to a finished run, and is not a queue to
        // be played back into the next one.
        if (next.status !== 'playing') taps.current.length = 0
        runRef.current = next

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          if (loudest) playCue(NOISE[loudest])
        }

        // The tune's heat is simply how high the water is, which is the one
        // number this whole game is about.
        setHeat(Math.min(1, next.water))

        best.current = Math.max(best.current, next.score)
        if (
          next.status !== hud.status || next.level !== hud.level ||
          next.score !== hud.score || next.lives !== hud.lives ||
          next.left !== hud.left || Math.round(next.water * 20) !== Math.round(hud.water * 20)
        ) {
          setHud({
            level: next.level,
            score: next.score,
            lives: next.lives,
            left: next.left,
            water: next.water,
            status: next.status,
            soul: next.soul.name,
          })
        }

        const view: View = { w, h, clock: clock.current }
        drawRun(ctx, next, view, cursor.current)
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

  /**
   * A tap is taken on the way down, not the way up.
   *
   * Tapping on pointerup would be the careful choice — it lets somebody change
   * their mind — but it also means every tap waits for a finger to leave the
   * glass, and on a board you are hurrying across that reads as the game
   * ignoring you. There is nothing to drag here, so down is right.
   */
  const down = (e: React.PointerEvent) => {
    if (asking) return
    const run = runRef.current
    if (!run || run.status !== 'playing') return
    const canvas = canvasRef.current
    const box = wrapRef.current?.getBoundingClientRect()
    if (!canvas || !box) return
    const dpr = canvas.width / Math.max(1, box.width)
    const where = cellAt(
      { w: canvas.width, h: canvas.height, clock: 0 },
      (e.clientX - box.left) * dpr,
      (e.clientY - box.top) * dpr,
    )
    if (!where) return
    cursor.current = where
    taps.current.push(where)
  }

  useEffect(() => {
    const press = (e: KeyboardEvent) => {
      const run = runRef.current
      if (!run || run.status !== 'playing') return
      const at = cursor.current ?? { col: Math.floor(COLS / 2), row: ROWS - 1 }
      if (e.key === 'ArrowLeft') cursor.current = { ...at, col: Math.max(0, at.col - 1) }
      else if (e.key === 'ArrowRight') cursor.current = { ...at, col: Math.min(COLS - 1, at.col + 1) }
      else if (e.key === 'ArrowUp') cursor.current = { ...at, row: Math.max(0, at.row - 1) }
      else if (e.key === 'ArrowDown') cursor.current = { ...at, row: Math.min(ROWS - 1, at.row + 1) }
      else if (e.key === ' ' || e.key === 'Enter') taps.current.push(at)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [])

  // --- between goes ----------------------------------------------------------

  const carryOn = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = tryAgain(run, rating)
    setAsking(false)
    setHud((it) => ({ ...it, status: 'playing', water: 0, left: TO_CLEAR }))
  }

  const spendLife = () => {
    const run = runRef.current
    if (!run) return
    if (run.lives > 0) carryOn()
    else {
      runRef.current = { ...run, status: 'over' }
      setAsking(false)
      setHud((it) => ({ ...it, status: 'over' }))
    }
  }

  const onwards = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = nextLevel(run, rating)
    setHud((it) => ({ ...it, status: 'playing', level: it.level + 1, water: 0, left: TO_CLEAR }))
  }

  const again = () => {
    runRef.current = newRun(1, rating, LIVES + spare.current)
    setAsking(false)
    setHud({
      level: 1, score: 0, lives: LIVES + spare.current, left: TO_CLEAR,
      water: 0, status: 'playing', soul: '',
    })
  }

  const soaked = hud.status === 'soaked'
  const saved = hud.status === 'saved'
  const over = hud.status === 'over'

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-ink">
      <BackButton onClick={() => go('home')} />
      <div className="flex shrink-0 items-center gap-2 py-2 pl-20 pr-3">
        <p className="font-mono text-xs font-bold tabular-nums tracking-widest text-chalk">
          {String(hud.score).padStart(6, '0')}
        </p>
        <p className="ml-auto font-mono text-[0.68rem] tabular-nums text-dim">
          chamber {hud.level} · {hud.left} to go · best {String(best.current).padStart(5, '0')}
        </p>
        <p className="font-mono text-xs tabular-nums text-bolt">{'●'.repeat(Math.max(0, hud.lives))}</p>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1"
        onPointerDown={down}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

        {asking && (
          <Interlude
            reward="another go"
            lastChance={hud.lives <= 0}
            onDone={(right) => { if (right) carryOn(); else spendLife() }}
          />
        )}

        {(soaked || saved || over) && !asking && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="block-panel w-full max-w-sm p-5 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
                {saved ? 'Out, and dry' : over ? 'That is the lot' : 'Up to the ceiling'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {saved
                  ? `${hud.soul} is out. The next chamber fills faster.`
                  : over
                    ? `You got to chamber ${hud.level}, and ${hud.score} points.`
                    : `${hud.lives} ${hud.lives === 1 ? 'go' : 'goes'} left.`}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {saved && <Btn onClick={onwards} tone="go">On to chamber {hud.level + 1}</Btn>}
                {soaked && <Btn onClick={carryOn} tone="go">Try again</Btn>}
                {soaked && <Btn onClick={() => setAsking(true)}>Answer one for a spare</Btn>}
                {over && <Btn onClick={again} tone="go">Start again</Btn>}
                <Btn onClick={() => go('home')} tone="plain">Back</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1">
        <p className="text-center font-mono text-[0.65rem] uppercase tracking-widest text-dim/60">
          tap the ones that are right · a wrong one only costs you water
        </p>
      </div>
    </div>
  )
}
