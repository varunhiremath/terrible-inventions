import { useEffect, useRef, useState } from 'react'
import {
  CAR_LONG, CAR_WIDE, LANES, MISSION_BONUS, SIGHT, STAGES, TANK, kmh, missionSays, stageFor,
} from '../road/level'
import {
  FIXED, STARTING_LIVES, missionMet, newRun, resume, step,
  type Input, type RoadEvent, type Run, type Status,
} from '../road/run'
import { createLatch, keyAt, padHeight, padLayout, type Button, type Key } from '../road/controls'
import { drawPad, drawRun, type View } from '../road/draw'
import { playCue } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { fill } from '../config/profile'
import { BackButton, Btn } from '../ui/bits'
import { LABELS, hintAlpha } from '../ui/padHints'
import { useStore } from '../store'
import { Interlude } from './Interlude'

/**
 * The road.
 *
 * The simplest machine of the five, on purpose. There are no animation tables,
 * no committed moves, nothing that has to be proved reachable: you are a
 * rectangle that slides sideways, and everything else is a rectangle coming
 * towards you. What makes it a game is where the gaps are.
 *
 * The one promise it makes is that there is always a gap. That is enforced in
 * the model and tested on every stage, because a wall of traffic across all
 * four lanes is not difficulty, it is a coin toss you lose.
 */
const MAX_CATCHUP = 0.25

/** What each thing that happens sounds like. */
const NOISE: Record<RoadEvent, CueName> = {
  pass: 'overtake',
  can: 'refuel',
  crash: 'prang',
  dry: 'prang',
  stageDone: 'arrive',
  skid: 'overtake',
  warn: 'warn',
  siren: 'siren',
}

/** Loudest thing first: one sound a frame, and never the overtake. */
const LOUDEST: RoadEvent[] = ['stageDone', 'crash', 'dry', 'warn', 'can', 'siren', 'pass', 'skid']
if (LOUDEST.length !== Object.keys(NOISE).length) {
  throw new Error('a road event with no place in the order')
}

interface Hud {
  stage: number
  score: number
  speed: number
  fuel: number
  lives: number
  status: Status
  gone: number
  missionDone: boolean
}

export function Road() {
  const go = useStore((s) => s.go)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const padRef = useRef<Key[]>([])
  const padShape = useRef('')
  const hintsFrom = useRef(0)
  const clock = useRef(0)
  const buttons = useRef(createLatch())
  const [hud, setHud] = useState<Hud>({
    stage: 1, score: 0, speed: 0, fuel: TANK, lives: 3, status: 'driving', gone: 0,
    missionDone: false,
  })

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

    if (!runRef.current) runRef.current = newRun(1)
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
        const held = buttons.current.read()
        const input: Input = {
          left: held.left, right: held.right, go: held.go, brake: held.brake,
        }

        let stepped = false
        /*
         * Events are read inside the step, not off the state the frame ends
         * on: a frame holds several steps and each clears the last one's
         * events, so reading the end state drops most of them. Found the hard
         * way in the pipes, and again in the caves.
         */
        const heard: RoadEvent[] = []
        const { previous, next, alpha } = pacer.advance(run, elapsed, (s) => {
          stepped = true
          const after = step(s, input, FIXED)
          if (after.events.length > 0) heard.push(...after.events)
          return after
        })
        if (stepped) buttons.current.consumed()
        runRef.current = next

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          if (loudest) playCue(NOISE[loudest])
        }

        if (
          next.number !== hud.stage || next.status !== hud.status ||
          Math.round(next.score) !== hud.score || Math.round(next.fuel) !== Math.round(hud.fuel) ||
          kmh(next.speed) !== hud.speed || next.lives !== hud.lives
        ) {
          setHud({
            stage: next.number,
            score: next.score,
            speed: kmh(next.speed),
            fuel: next.fuel,
            lives: next.lives,
            status: next.status,
            gone: next.distance,
            missionDone: next.missionDone,
          })
        }

        const w = canvas.width
        const h = canvas.height
        const padH = padHeight(w, h)
        const capH = Math.max(h * 0.06, 22)
        const middle = Math.max(80, h - padH - capH)

        /*
         * How much road is on screen.
         *
         * The lane width comes from whichever is tighter — the road has to fit
         * across, and it has to be far enough down the screen to see traffic
         * coming. Sight is what makes this fair: a car you meet before you can
         * see it is not a hazard, it is a coin toss.
         */
        /*
         * Across and along are two different questions.
         *
         * The lane width comes from the width of the screen, so the road fills
         * it with a verge either side. How far down the road you can see comes
         * from the height. Taking both from the smaller of the two — which is
         * what this did first — gave a narrow ribbon of road down the middle of
         * a phone with a car on it the size of a stamp.
         */
        /*
         * Across and along are two different questions, and a car has to keep
         * its shape while both are answered.
         *
         * How far you can see comes from the height: the view always shows a
         * full sight line, because a car you meet before you can see it is not
         * a hazard, it is a coin toss. That fixes how many pixels a car length
         * is. The lane then has to be narrow enough that a car is longer than
         * it is wide — otherwise, on a phone held sideways, where there is very
         * little height and a great deal of width, you get a hundred-pixel-wide
         * car twenty pixels long, which is a pancake.
         *
         * So the road is as wide as it can be without that happening, and
         * whatever is left over at the sides becomes verge. Held sideways this
         * is a narrow road with a lot of grass either side, which is what a
         * road looks like from a long way up. This game wants to be held
         * upright.
         */
        const depth = middle / SIGHT
        const longEnough = (CAR_LONG * depth) / (1.45 * CAR_WIDE)
        const lane = Math.min(w / (LANES + 1.4), longEnough)
        const left = (w - lane * LANES) / 2

        // Drawn between steps, so the road does not advance in sixty jerks.
        const distance = previous.distance + (next.distance - previous.distance) * alpha
        const at = previous.lane + (next.lane - previous.lane) * alpha
        const view: View = {
          lane, depth, left,
          // He sits low, so almost all the screen is the road ahead of him.
          line: capH + middle * 0.82,
          distance,
          clock: clock.current,
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, capH, w, middle)
        ctx.clip()
        drawRun(ctx, next, at, view, w, capH + middle)
        ctx.restore()

        ctx.fillStyle = '#0d1016'
        ctx.fillRect(0, 0, w, capH)
        ctx.fillRect(0, capH + middle, w, h - capH - middle)

        // --- the readings ----------------------------------------------------
        const gap = lane * 0.4
        const backRoom = 70 * (canvas.width / Math.max(1, canvas.clientWidth))
        const score = `${next.score}`.padStart(6, '0')
        const stage = `STAGE ${next.number}`
        const speed = `${kmh(next.speed)} KM/H`
        let text = Math.min(lane * 0.42, capH * 0.6)
        const fits = () => {
          ctx.font = `bold ${text}px ui-monospace, monospace`
          const side = Math.max(ctx.measureText(score).width, ctx.measureText(speed).width)
          return side * 2 + ctx.measureText(stage).width + gap * 2 + backRoom * 2 <= w
        }
        while (text > 9 && !fits()) text -= 1

        ctx.fillStyle = '#eef2f8'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText(score, backRoom, capH / 2)
        ctx.textAlign = 'center'
        ctx.fillText(stage, w / 2, capH / 2)
        ctx.textAlign = 'right'
        ctx.fillText(speed, w - gap, capH / 2)

        /*
         * The job, and how it is going.
         *
         * A stage with only a distance to it is a treadmill. Saying what is
         * being asked, and counting it as you go, is what makes the last
         * stretch worth driving rather than just worth surviving.
         */
        const mission = next.stage.mission
        const progress =
          mission.kind === 'pass' ? `${Math.min(next.passed, mission.count)}/${mission.count} PASSED`
          : mission.kind === 'cans' ? `${Math.min(next.cansTaken, mission.count)}/${mission.count} CANS`
          : next.pranged === 0 ? 'NO SCRATCHES YET' : 'SCRATCHED'
        ctx.font = `bold ${Math.max(9, text * 0.62)}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = missionMet(next) ? '#4ade80' : '#8a91ab'
        ctx.fillText(progress, w / 2, capH + text * 0.9)

        // --- the fuel gauge, down the side of the road ------------------------
        const gaugeH = middle * 0.5
        const gaugeW = Math.max(6, lane * 0.16)
        const gaugeX = left + lane * LANES + lane * 0.24
        const gaugeY = capH + middle * 0.12
        /*
         * An instrument, not a stripe.
         *
         * It was a green bar at forty-five per cent black, sitting on the
         * grass verge — green on green, which is to say invisible, and the one
         * reading you cannot afford to miss. So it gets an opaque housing and
         * a pale surround, and the needle is amber rather than green: amber
         * reads against both the grass it sits on and the tarmac beside it.
         */
        ctx.fillStyle = '#14161c'
        ctx.fillRect(gaugeX - gaugeW * 0.25, gaugeY - gaugeW * 0.25, gaugeW * 1.5, gaugeH + gaugeW * 0.5)
        ctx.strokeStyle = '#eef2f8'
        ctx.lineWidth = Math.max(1, gaugeW * 0.12)
        ctx.strokeRect(gaugeX - gaugeW * 0.25, gaugeY - gaugeW * 0.25, gaugeW * 1.5, gaugeH + gaugeW * 0.5)

        const share = Math.max(0, Math.min(1, next.fuel / TANK))
        // Red when it is getting serious, which is the only warning there is
        // besides the sound.
        ctx.fillStyle = share < 0.25 ? '#ff6b53' : '#ffc84a'
        ctx.fillRect(gaugeX, gaugeY + gaugeH * (1 - share), gaugeW, gaugeH * share)

        // A halfway mark, so the bar is a reading rather than a mood.
        ctx.fillStyle = 'rgba(232,235,245,0.5)'
        ctx.fillRect(gaugeX, gaugeY + gaugeH * 0.5 - gaugeW * 0.06, gaugeW, gaugeW * 0.12)

        ctx.fillStyle = '#eef2f8'
        ctx.font = `bold ${Math.max(9, gaugeW * 1.1)}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText('F', gaugeX + gaugeW / 2, gaugeY - gaugeW * 0.6)
        ctx.textBaseline = 'middle'

        padRef.current = padLayout(w, h)
        const shape = padRef.current.map((k) => k.id).join(',')
        if (shape !== padShape.current) {
          padShape.current = shape
          hintsFrom.current = clock.current
        }
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>, {
          alpha: hintAlpha(clock.current - hintsFrom.current),
          labels: LABELS.road,
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
      ArrowUp: 'go', ' ': 'go', w: 'go',
      ArrowDown: 'brake', s: 'brake',
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

  /**
   * A right answer buys back the car you just lost, and fills the tank.
   *
   * Capped at what you started with, so answering well keeps you going without
   * ever making the road unloseable.
   */
  const carryOn = (right: boolean) => {
    const run = runRef.current
    if (!run) return
    const back = resume(run)
    runRef.current = right
      ? { ...back, fuel: TANK, warned: false, lives: Math.min(STARTING_LIVES, back.lives + 1) }
      : back
    setHud((h) => ({ ...h, status: 'driving', lives: runRef.current!.lives }))
  }

  const nextStage = () => {
    const run = runRef.current
    if (!run) return
    const number = run.number + 1
    if (number > STAGES.length) return
    runRef.current = newRun(number, run.lives, run.score, run.seed)
    setHud((h) => ({ ...h, status: 'driving', stage: number }))
  }

  const startOver = () => {
    runRef.current = newRun(1)
    setHud({
      stage: 1, score: 0, speed: 0, fuel: TANK, lives: 3, status: 'driving', gone: 0,
      missionDone: false,
    })
  }

  const lastStage = hud.stage >= STAGES.length
  const outOfLives = hud.lives <= 0
  /** A prang asks you something and puts you straight back on the road. */
  const asking = hud.status === 'crashed' && !outOfLives
  const overlay = hud.status !== 'driving' && !asking

  return (
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <header className="sr-only" aria-live="polite">
        STAGE {hud.stage} SCORE {hud.score} SPEED {hud.speed} LIVES {hud.lives} FUEL {Math.round(hud.fuel)}
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      </div>

      <BackButton onClick={() => go('home')} />

      {asking && <Interlude onDone={carryOn} reward="your car back, and a full tank" />}

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
              {hud.status === 'stageDone' && lastStage
                ? 'Every road I own, and you drove the lot of them. I am appalled.'
                : hud.status === 'stageDone'
                  ? 'Through already? There is more road. There is always more road.'
                  : outOfLives
                    ? 'Out of cars. Back to the start of the motorway with you.'
                    : 'A prang. I told you I built these myself.'}
            </p>

            {hud.status === 'stageDone' && (
              <p className={`mt-3 font-mono text-xs font-bold uppercase tracking-[0.2em] ${
                hud.missionDone ? 'text-moss' : 'text-dim'
              }`}>
                {hud.missionDone
                  ? `${missionSays(stageFor(hud.stage).mission)} — done. ${MISSION_BONUS} bonus.`
                  : `${missionSays(stageFor(hud.stage).mission)} — not this time.`}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2">
              {hud.status === 'stageDone' && !lastStage && (
                <Btn tone="go" onClick={nextStage} className="py-4 text-lg">
                  On to stage {hud.stage + 1}
                </Btn>
              )}
              {(outOfLives || (hud.status === 'stageDone' && lastStage)) && (
                <Btn tone="go" onClick={startOver} className="py-4 text-lg">
                  Start again
                </Btn>
              )}
              <Btn onClick={() => go('home')}>Back to the menu</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
