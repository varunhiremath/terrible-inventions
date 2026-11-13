import { useEffect, useRef, useState } from 'react'
import { LIVES, howTo, ordersFor, wants, type Job } from '../yard/level'
import {
  FIXED, LOUDEST, measures, newRun, nextLevel, ready, serve, step,
  type Move, type Run, type Status, type YardEvent,
} from '../yard/run'
import { boardOf, drawRun, squareAt } from '../yard/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The Yard.
 *
 * A sheet of ply marked out in squares, a cutting press, and orders on the
 * board: so many squares, so much edging, so many cubes. You drag a rectangle
 * out on the sheet and press the press.
 *
 * The drag and the press are two separate acts on purpose. A game that cut on
 * the lift of a finger would be a game of flinching; here you chalk it out,
 * read what it comes to off the board — the sides, the squares, the edge —
 * and then decide. The reading is where the learning is, which is why the
 * board shows all of the numbers and not just the one the order asked about.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<YardEvent, CueName> = {
  chalk: 'chalk',
  cut: 'cutClean',
  offcut: 'offcut',
  order: 'nextOrder',
  scrapped: 'scrapped',
  cleared: 'yardDone',
  over: 'knockOff',
}

interface Hud {
  level: number
  score: number
  lives: number
  left: number
  job: Job
  wants: string
  deep: number
  ready: boolean
  status: Status
  /**
   * What is chalked on the sheet at the moment.
   *
   * In the state rather than read off the run when the component renders,
   * which is what it was: the spoken line below is built from these, and read
   * off a ref it only ever changed when something *else* changed. It said two
   * by two for the whole of a game. A screen reader would have been told the
   * rectangle never moved, and the probe that plays this was.
   */
  wide: number
  tall: number
  area: number
  edge: number
  half: number
  cubes: number
  skin: number
}

export function Yard() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const queue = useRef<Move[]>([])
  const from = useRef<{ x: number; y: number } | null>(null)
  const spare = useRef(0)
  const shown = useRef<Hud | null>(null)
  const go = useStore((s) => s.go)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    level: 1, score: 0, lives: LIVES, left: ordersFor(1) - 1, job: 'panel',
    wants: '', deep: 2, ready: false, status: 'playing',
    wide: 2, tall: 2, area: 4, edge: 8, half: 2, cubes: 8, skin: 24,
  })
  const [asking, setAsking] = useState(false)

  useEffect(() => { spare.current = spareLives({ workshop: kit }) }, [kit])

  useEffect(() => {
    const canvas = canvasRef.current
    const mount = wrapRef.current
    if (!canvas || !mount) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!runRef.current) runRef.current = newRun(1, LIVES + spare.current)

    const size = () => {
      const rect = mount.getBoundingClientRect()
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    size()
    const watching = new ResizeObserver(size)
    watching.observe(mount)

    const pacer = createPacer<Run>(FIXED, MAX_CATCHUP)
    let frame = 0
    let last = performance.now()
    let clock = 0

    const loop = () => {
      const now = performance.now()
      const elapsed = Math.min(0.25, (now - last) / 1000)
      last = now
      clock += elapsed

      const run = runRef.current
      if (run) {
        const heard: YardEvent[] = []
        const { next } = pacer.advance(run, elapsed, (s) => {
          const move = queue.current.shift() ?? null
          const after = step(s, move, FIXED)
          if (after.events.length > 0) heard.push(...after.events)
          return after
        })
        runRef.current = next

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          if (loudest) playCue(NOISE[loudest])
        }

        const pressing = 1 - next.clock / Math.max(1, next.order.seconds)
        const hurt = 1 - (next.lives - 1) / Math.max(1, LIVES - 1)
        setHeat(Math.min(1, Math.max(hurt * 0.6, pressing * 0.8)))

        drawRun(ctx, next, { w: canvas.width, h: canvas.height, clock })

        const said = measures(next)
        const fresh: Hud = {
          level: next.level,
          score: next.score,
          lives: next.lives,
          left: next.left,
          job: next.order.job,
          wants: wants(next.order),
          deep: next.deep,
          ready: ready(next),
          status: next.status,
          ...said,
        }
        const was = shown.current
        if (
          was === null || was.status !== fresh.status || was.score !== fresh.score ||
          was.lives !== fresh.lives || was.left !== fresh.left || was.job !== fresh.job ||
          was.wants !== fresh.wants || was.deep !== fresh.deep || was.ready !== fresh.ready ||
          was.wide !== fresh.wide || was.tall !== fresh.tall
        ) {
          shown.current = fresh
          setHud(fresh)
        }
      }

      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      watching.disconnect()
      setHeat(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = (move: Move) => {
    if (asking || hud.status !== 'playing') return
    queue.current.push(move)
  }

  /** Which square of the sheet a touch landed on. */
  const squareUnder = (e: React.PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const box = canvas.getBoundingClientRect()
    const dpr = canvas.width / Math.max(1, box.width)
    const board = boardOf({ w: canvas.width, h: canvas.height, clock: 0 })
    return squareAt(board, (e.clientX - box.left) * dpr, (e.clientY - box.top) * dpr)
  }

  const down = (e: React.PointerEvent) => {
    if (asking || hud.status !== 'playing') return
    const at = squareUnder(e)
    if (!at) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    from.current = at
    send({ kind: 'drag', fromX: at.x, fromY: at.y, toX: at.x, toY: at.y })
  }

  const move = (e: React.PointerEvent) => {
    const corner = from.current
    if (!corner) return
    const at = squareUnder(e)
    if (!at) return
    send({ kind: 'drag', fromX: corner.x, fromY: corner.y, toX: at.x, toY: at.y })
  }

  const up = () => { from.current = null }

  // --- between levels --------------------------------------------------------

  const keep = (next: Hud): Hud => {
    shown.current = next
    return next
  }

  const carryOn = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = serve(run)
    setAsking(false)
    setHud((h) => keep({ ...h, status: 'playing' }))
  }

  const spendLife = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = { ...run, status: 'over' }
    setAsking(false)
    setHud((h) => keep({ ...h, status: 'over' }))
  }

  const onwards = () => {
    const run = runRef.current
    if (!run) return
    const after = nextLevel(run)
    runRef.current = after
    setHud((h) => keep({
      ...h, status: 'playing', level: after.level, left: after.left,
      job: after.order.job, wants: wants(after.order), deep: after.deep, ready: false,
      ...measures(after),
    }))
  }

  const again = () => {
    const fresh = newRun(1, LIVES + spare.current)
    runRef.current = fresh
    setAsking(false)
    setHud(keep({
      level: 1, score: 0, lives: fresh.lives, left: fresh.left, job: fresh.order.job,
      wants: wants(fresh.order), deep: fresh.deep, ready: false, status: 'playing',
      ...measures(fresh),
    }))
  }

  const cleared = hud.status === 'cleared'
  const over = hud.status === 'over'
  /*
   * The two orders built rather than cut: a tank, and the ply that wraps one.
   * Both of them want the depth steppers on screen, and both of them say
   * "build it" on the press rather than "cut it", because what comes off the
   * sheet is a box and not a panel.
   */
  const tank = hud.job === 'tank'
  const skin = hud.job === 'skin'
  const solid = tank || skin

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-ink">
      <BackButton onClick={() => go('home')} />
      <div className="flex shrink-0 items-center gap-2 py-2 pl-20 pr-3">
        <p className="font-mono text-xs font-bold tabular-nums tracking-widest text-chalk">
          {String(hud.score).padStart(6, '0')}
        </p>
        <p className="ml-auto font-mono text-[0.68rem] tabular-nums text-dim">
          level {hud.level} · {hud.left} to go
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
        <canvas ref={canvasRef} className="block h-full w-full" />

        {/*
          * The order and the chalk, in words.
          *
          * The sheet is a canvas, which to anything that is not a pair of eyes
          * is a blank rectangle — a screen reader, or the script that plays
          * this in a browser to check the press is wired to the sheet.
          */}
        <p className="sr-only" aria-live="polite">
          Order: {hud.wants}. Chalked: {hud.wide} by {hud.tall},
          {' '}{hud.area} squares, {hud.edge} of edge
          {solid ? `, ${hud.cubes} cubes, ${hud.deep} deep` : ''}
          {skin ? `, ${hud.skin} of skin` : ''}
          {hud.job === 'half' ? `, ${hud.half} on the slant` : ''}.
        </p>

        {asking && (
          <Interlude
            reward="another go"
            lastChance={hud.lives <= 0}
            onDone={(right) => { if (right) carryOn(); else spendLife() }}
          />
        )}

        {(cleared || over) && !asking && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="block-panel w-full max-w-sm p-5 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
                {cleared ? `Level ${hud.level} delivered` : 'The lorry went without you'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {cleared
                  ? 'Next lot are bigger, and some want depth.'
                  : `You got to level ${hud.level}, and scored ${hud.score}.`}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {cleared && <Btn onClick={onwards} tone="go">On to level {hud.level + 1}</Btn>}
                {over && <Btn onClick={again} tone="go">Start again</Btn>}
                {over && <Btn onClick={() => setAsking(true)}>Answer one for another go</Btn>}
                <Btn onClick={() => go('home')} tone="plain">Back</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="flex items-stretch gap-2">
          {solid && (
            <div className="flex shrink-0 items-stretch gap-1.5">
              <button
                type="button"
                aria-label="Shallower"
                onPointerDown={() => send({ kind: 'deep', by: -1 })}
                className="w-12 rounded-xl border-2 border-ink-line bg-ink-soft font-mono text-xl font-bold text-chalk active:translate-y-[2px]"
              >
                −
              </button>
              <div className="flex w-16 flex-col items-center justify-center rounded-xl border-2 border-ink-line bg-ink-soft">
                <span className="font-mono text-lg font-bold tabular-nums text-chalk">
                  {hud.deep}
                </span>
                <span className="font-mono text-[0.55rem] uppercase tracking-widest text-dim">
                  deep
                </span>
              </div>
              <button
                type="button"
                aria-label="Deeper"
                onPointerDown={() => send({ kind: 'deep', by: 1 })}
                className="w-12 rounded-xl border-2 border-ink-line bg-ink-soft font-mono text-xl font-bold text-chalk active:translate-y-[2px]"
              >
                +
              </button>
            </div>
          )}
          <button
            type="button"
            onPointerDown={() => send({ kind: 'cut' })}
            className={[
              'flex-1 rounded-xl border-2 py-4 font-mono text-base font-bold uppercase tracking-widest',
              'transition-transform active:translate-y-[2px]',
              hud.ready
                ? 'border-moss bg-moss/25 text-moss'
                : 'border-ink-line bg-ink-soft text-chalk',
            ].join(' ')}
          >
            {solid ? 'Build it' : 'Cut it'}
          </button>
        </div>
        <p className="mt-1.5 text-center font-mono text-[0.62rem] uppercase tracking-widest text-dim/60">
          {howTo(hud.job)}
        </p>
      </div>
    </div>
  )
}
