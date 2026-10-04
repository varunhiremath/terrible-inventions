import { useEffect, useRef, useState } from 'react'
import { KIND_SAYS, KIND_TITLE, type Kind } from '../puzzles/level'
import {
  LOUDEST, drag, howFar, lift, newRun, nextPuzzle, showMe, step, touch, wipe,
  type PuzzleEvent, type Run,
} from '../puzzles/run'
import { drawRun, placeAt, placesBetween, sheetOf } from '../puzzles/draw'
import { playCue } from '../music/player'
import type { CueName } from '../music/score'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'

/**
 * The notebook.
 *
 * Three kinds of puzzle on one sheet of paper, played with one finger and
 * nothing else. The only thing this screen does that the other nine do not is
 * take the finger seriously: a puzzle is drawn by dragging, and a drag is a
 * line rather than a place.
 */

const NOISE: Record<PuzzleEvent, CueName> = {
  line: 'scratch',
  back: 'rub',
  join: 'click',
  cut: 'snip',
  solved: 'wellDone',
  no: 'nope',
  wipe: 'rub',
  shown: 'reveal',
}

export function Puzzles() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const clock = useRef(0)
  /** Where the finger was last seen, in canvas pixels, for joining up. */
  const was = useRef<{ x: number; y: number } | null>(null)
  const go = useStore((s) => s.go)

  const [hud, setHud] = useState<{ level: number; kind: Kind; far: number; solved: boolean; shown: boolean }>(
    { level: 1, kind: 'stroke', far: 0, solved: false, shown: false },
  )
  const [done, setDone] = useState(0)

  const show = (run: Run) => {
    setHud({
      level: run.level,
      kind: run.board.kind,
      far: howFar(run),
      solved: run.solved,
      shown: run.shown,
    })
  }

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
      runRef.current = newRun(1, Math.floor(Math.random() * 100000) + 1)
      show(runRef.current)
    }

    let frame = 0
    let last = performance.now()
    const loop = () => {
      const now = performance.now()
      const elapsed = Math.min(0.25, (now - last) / 1000)
      last = now
      clock.current += elapsed

      const run = runRef.current
      if (run) {
        runRef.current = step(run, elapsed)
        drawRun(ctx, runRef.current, { w: canvas.width, h: canvas.height, clock: clock.current })
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

  // --- the finger ------------------------------------------------------------

  /** A pointer event, in canvas pixels. */
  const spotOfEvent = (e: React.PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    const box = wrapRef.current?.getBoundingClientRect()
    if (!canvas || !box) return null
    const dpr = canvas.width / Math.max(1, box.width)
    return { x: (e.clientX - box.left) * dpr, y: (e.clientY - box.top) * dpr }
  }

  const heard = (before: Run, after: Run) => {
    if (after === before || after.events.length === 0) return
    const loudest = LOUDEST.find((name) => after.events.includes(name))
    if (loudest) playCue(NOISE[loudest])
  }

  const down = (e: React.PointerEvent) => {
    const run = runRef.current
    const at = spotOfEvent(e)
    const canvas = canvasRef.current
    if (!run || !at || !canvas) return
    const sheet = sheetOf({ w: canvas.width, h: canvas.height, clock: 0 }, run.board)
    const place = placeAt(run.board, sheet, at.x, at.y)
    was.current = at
    if (place === null) return
    const next = touch(run, place)
    heard(run, next)
    runRef.current = next
    show(next)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    const run = runRef.current
    const at = spotOfEvent(e)
    const canvas = canvasRef.current
    if (!run || !at || !canvas || run.drawing === null) { was.current = at; return }
    const sheet = sheetOf({ w: canvas.width, h: canvas.height, clock: 0 }, run.board)

    // Every square the finger passed through, in turn, because the rules are
    // written about one step at a time. `placesBetween` is next to the
    // drawing, where a test can reach it.
    let on = run
    for (const place of placesBetween(run.board, sheet, was.current ?? at, at)) {
      const next = drag(on, place)
      heard(on, next)
      on = next
    }
    was.current = at
    if (on !== run) {
      runRef.current = on
      show(on)
    }
  }

  const up = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = lift(run)
    was.current = null
  }

  // --- the buttons -----------------------------------------------------------

  const act = (make: (run: Run) => Run) => {
    const run = runRef.current
    if (!run) return
    const next = make(run)
    heard(run, next)
    runRef.current = next
    show(next)
  }

  const onwards = () => {
    const run = runRef.current
    if (!run) return
    if (run.solved && !run.shown) setDone((n) => n + 1)
    const next = nextPuzzle(run)
    runRef.current = next
    show(next)
  }

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-ink">
      <BackButton onClick={() => go('home')} />
      <div className="flex shrink-0 items-center gap-2 py-2 pl-20 pr-3">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-chalk">
          {KIND_TITLE[hud.kind]}
        </p>
        <p className="ml-auto font-mono text-[0.68rem] tabular-nums text-dim">
          puzzle {hud.level} · {done} done
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

        {hud.solved && (
          <div
            className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="block-panel w-full max-w-sm p-4 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
                {hud.shown ? 'That is how it goes' : 'That is it'}
              </p>
              <p className="mt-1 text-base font-bold text-chalk">
                {hud.shown ? 'Have a look, then try the next one.' : 'Turn the page.'}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Btn onClick={onwards} tone="go">Next puzzle</Btn>
                <Btn onClick={() => go('home')} tone="plain">Back</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1">
        <p className="text-center font-mono text-[0.65rem] uppercase tracking-widest text-dim/60">
          {KIND_SAYS[hud.kind]}
        </p>
        {!hud.solved && (
          <div className="mt-2 flex justify-center gap-2">
            <Btn onClick={() => act(wipe)} tone="plain">Start again</Btn>
            <Btn onClick={() => act(showMe)} tone="plain">Show me</Btn>
          </div>
        )}
      </div>
    </div>
  )
}
