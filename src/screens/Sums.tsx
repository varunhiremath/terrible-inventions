import { useEffect, useRef, useState } from 'react'
import { LIVES, TO_CLEAR, gotOut } from '../sums/level'
import {
  FIXED, LOUDEST, grab, newRun, nextLevel, reach, release, step, tryAgain,
  type FloodEvent, type Run, type Status,
} from '../sums/run'
import { cellAt, drawRun, type View } from '../sums/draw'
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
 * A board of numbers and signs, and somebody in a tank above it with the water
 * coming up. Drag along a line that reads as something true — `2 + 3 = 5`, or
 * a run of square numbers — and it goes, taking that much water with it.
 *
 * One control: put a finger on a block and drag along a row or down a column.
 * The blocks under the finger light up green the moment the line reads as
 * something, which turns a guess into a search you can feel your way through.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<FloodEvent, CueName> = {
  grab: 'clack',
  stretch: 'clack',
  crush: 'crunch',
  big: 'haul',
  combo: 'chain',
  miss: 'clunk',
  drain: 'gurgle',
  planted: 'fresh',
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
  band: string
}

export function Sums() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const clock = useRef(0)
  /**
   * What the finger did, waiting to be read inside the simulation.
   *
   * Queued rather than applied at frame time, because this is the only place
   * that runs exactly once per step — a touch read outside it is either
   * dropped or counted twice, which this project has now learnt in four games.
   */
  const doing = useRef<{ what: 'down' | 'move' | 'up'; cell: number }[]>([])
  const spare = useRef(0)
  const best = useRef(0)
  const go = useStore((s) => s.go)
  const rating = useStore((s) => s.save.rating)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    level: 1, score: 0, lives: LIVES, left: TO_CLEAR, water: 0,
    status: 'playing', soul: '', band: '',
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
      if (run) {
        const heard: FloodEvent[] = []
        const { next } = pacer.advance(run, elapsed, (s) => {
          let on = s
          while (doing.current.length > 0 && on.status === 'playing') {
            const act = doing.current.shift()
            if (!act) break
            on =
              act.what === 'down' ? grab(on, act.cell)
              : act.what === 'move' ? reach(on, act.cell)
              : release(on)
            if (on.events.length > 0) heard.push(...on.events)
          }
          const after = step(on, FIXED)
          if (after.events.length > 0) heard.push(...after.events)
          return after
        })
        if (next.status !== 'playing') doing.current.length = 0
        runRef.current = next

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          // The noise a finger makes while it is only looking is not a noise.
          if (loudest && loudest !== 'stretch' && loudest !== 'grab') playCue(NOISE[loudest])
        }

        setHeat(Math.min(1, next.water))

        best.current = Math.max(best.current, next.score)
        if (
          next.status !== hud.status || next.level !== hud.level ||
          next.score !== hud.score || next.lives !== hud.lives ||
          next.left !== hud.left || Math.round(next.water * 20) !== Math.round(hud.water * 20)
        ) {
          setHud({
            level: next.level, score: next.score, lives: next.lives, left: next.left,
            water: next.water, status: next.status, soul: next.soul.name, band: next.band.name,
          })
        }

        const view: View = { w: canvas.width, h: canvas.height, clock: clock.current }
        drawRun(ctx, next, view)
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

  const cellOfEvent = (e: React.PointerEvent): number | null => {
    const canvas = canvasRef.current
    const box = wrapRef.current?.getBoundingClientRect()
    if (!canvas || !box) return null
    const dpr = canvas.width / Math.max(1, box.width)
    return cellAt(
      { w: canvas.width, h: canvas.height, clock: 0 },
      (e.clientX - box.left) * dpr,
      (e.clientY - box.top) * dpr,
    )
  }

  const down = (e: React.PointerEvent) => {
    if (asking) return
    const run = runRef.current
    if (!run || run.status !== 'playing') return
    const cell = cellOfEvent(e)
    if (cell === null) return
    doing.current.push({ what: 'down', cell })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    const run = runRef.current
    if (!run || run.anchor === null) return
    const cell = cellOfEvent(e)
    if (cell === null) return
    doing.current.push({ what: 'move', cell })
  }

  /*
   * Pointer capture retargets the release to the element the drag began on, so
   * the end of a drag has to be taken from the window as well — "works by
   * keyboard, fails by finger" has cost this project three evenings, and this
   * is the same lesson wearing a different hat.
   */
  const up = () => {
    const run = runRef.current
    if (!run || run.anchor === null) return
    doing.current.push({ what: 'up', cell: -1 })
  }

  useEffect(() => {
    const lift = () => up()
    window.addEventListener('pointerup', lift)
    window.addEventListener('pointercancel', lift)
    return () => {
      window.removeEventListener('pointerup', lift)
      window.removeEventListener('pointercancel', lift)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      water: 0, status: 'playing', soul: '', band: '',
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
        onPointerMove={move}
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
                {saved ? 'Out, and dry' : over ? 'That is the lot' : 'Over his head'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {saved
                  ? `${gotOut(hud.level)} The next chamber fills faster.`
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
          drag along a line that is true · longer takes more of the wall
        </p>
      </div>
    </div>
  )
}
