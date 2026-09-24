import { useEffect, useRef, useState } from 'react'
import { VIEW_ROWS } from '../pipes/level'
import { NO_INPUT, type Input } from '../pipes/physics'
import { EVENTS, FIXED, newRun, stepRun, type PipeEvent, type Run, type Status } from '../pipes/run'
import { playCue } from '../music/player'
import type { CueName } from '../music/score'
import { LEVELS, levelFor } from '../pipes/levels'
import {
  createLatch, keyAt, padHeight, padLayout, type Button, type Key,
} from '../pipes/controls'
import {
  drawBackdrop, drawEnemies, drawFlag, drawHero, drawItems, drawLevel, drawPad, drawSky,
  type View,
} from '../pipes/draw'
import { scrollTo } from '../camera'
import { createPacer } from '../arcade/pacing'
import { fill } from '../config/profile'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { Interlude } from './Interlude'

/**
 * The pipes.
 *
 * A hundred and twenty steps a second, which is more than the screen will ever
 * draw. It is not for smoothness — the drawing interpolates for that — it is
 * because the collisions are resolved one axis at a time against a tile grid,
 * and at nine tiles a second a coarser step lets a body travel a good part of
 * a tile between tests. Small steps are what stop a run at full speed clipping
 * the corner of a block.
 */
const MAX_CATCHUP = 0.25


/**
 * What each thing that happens sounds like.
 *
 * The run has been putting these in a list since the day it was written and
 * nothing has ever read it, so the game has been silent from the start. Two
 * things map onto one noise in a couple of places — a shell kicked and a
 * goomba flattened are the same small thud — because it is the kind of noise
 * it is that tells you what happened, not which of two similar things it was.
 */
const NOISE: Record<PipeEvent, CueName> = {
  coin: 'coin',
  jump: 'hop',
  stomp: 'stomp',
  kick: 'stomp',
  break: 'stomp',
  knock: 'stomp',
  grow: 'grow',
  sprout: 'grow',
  die: 'fall',
  shrink: 'fall',
  win: 'flag',
}

/**
 * Loudest thing first.
 *
 * A step can easily produce three of these at once — land on a goomba, break
 * the block above, take the coin out of it — and firing all three turns a good
 * moment into a mess. One noise per step, and it is the one that matters most.
 */
const LOUDEST: PipeEvent[] = [
  'win', 'die', 'shrink', 'grow', 'sprout', 'stomp', 'kick', 'break', 'knock', 'coin', 'jump',
]
// Every event has to be in there somewhere, or it can never be the loudest
// thing in a step and simply never gets heard.
if (LOUDEST.length !== EVENTS.length) throw new Error('an event with no place in the order')

interface Hud {
  level: number
  lives: number
  coins: number
  score: number
  seconds: number
  status: Status
}

export function Pipes() {
  const go = useStore((s) => s.go)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const buttons = useRef(createLatch())
  const padRef = useRef<Key[]>([])
  const clock = useRef(0)
  /** Where the screen is looking, which lags the player and never goes back. */
  const camera = useRef(0)

  const [hud, setHud] = useState<Hud>({
    level: 1, lives: 3, coins: 0, score: 0, seconds: 300, status: 'playing',
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    runRef.current = newRun(levelFor(1), 1)
    camera.current = 0
    let shown: Hud = { level: 1, lives: 3, coins: 0, score: 0, seconds: 300, status: 'playing' }

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    const pacer = createPacer<Run>(FIXED, MAX_CATCHUP)
    let last = performance.now()
    let frame = 0

    const loop = () => {
      const now = performance.now()
      const elapsed = (now - last) / 1000
      last = now
      clock.current += elapsed

      const run = runRef.current
      if (run) {
        const held = buttons.current.read()
        const input: Input = {
          ...NO_INPUT,
          left: held.left,
          right: held.right,
          jump: held.jump,
          run: held.run,
        }

        let stepped = false
        /*
         * Gathered from every step, not read off the end of them.
         *
         * A frame can run several steps, and each step starts with an empty
         * event list, so the state the frame finishes on only knows about the
         * last one. Reading the noises off that drops most of them: jumping
         * four times on the spot made no sound at all, because the step that
         * held the jump was never the step the frame happened to end on.
         */
        const heard: PipeEvent[] = []
        const { next } = pacer.advance(run, elapsed, (s) => {
          stepped = true
          const after = stepRun(s, input)
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
          next.number !== shown.level || next.lives !== shown.lives ||
          next.coins !== shown.coins || next.score !== shown.score ||
          next.status !== shown.status || Math.ceil(next.seconds) !== shown.seconds
        ) {
          shown = {
            level: next.number, lives: next.lives, coins: next.coins,
            score: next.score, seconds: Math.ceil(next.seconds), status: next.status,
          }
          setHud({ ...shown })
        }

        // --- draw ------------------------------------------------------------
        const w = canvas.width
        const h = canvas.height
        const padH = padHeight(w, h)
        const capH = Math.max(h * 0.06, 22)
        const middle = Math.max(60, h - padH - capH)

        /*
         * How big a tile is.
         *
         * Taken from the height alone at first, so that every row with
         * anything in it is always on screen. On a phone held upright that
         * makes the tiles enormous and the view about six columns wide: most
         * of the screen is empty sky, the player is a speck at the bottom, and
         * you cannot see far enough ahead to react to anything.
         *
         * So there is a floor on how many columns are shown, and if honouring
         * it leaves the level shorter than the space available, the extra goes
         * above as sky rather than being spent on bigger tiles.
         */
        // Ten is the balance: at thirteen he is a speck on a narrow screen, at
        // six you cannot see far enough ahead to react to anything.
        const MIN_ACROSS = 10
        const size = Math.min(middle / VIEW_ROWS, w / MIN_ACROSS)
        const across = w / size
        const boardH = size * VIEW_ROWS

        /*
         * The camera.
         *
         * It used to ratchet forwards and never come back, on the reasoning
         * that he is nearly always running right. He is not: walking left took
         * him to the edge of the screen and then off it, with the view refusing
         * to follow. It keeps him inside a band with a fifth of the screen
         * clear either side now, and goes both ways.
         */
        camera.current = scrollTo(camera.current, next.body.x, across, next.level.rows[0].length)

        const view: View = { col: camera.current, size, clock: clock.current }

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        drawSky(ctx, w, h)
        ctx.save()
        // The ground sits at the bottom of the space, and any room left over
        // is sky above it.
        ctx.translate(0, capH + (middle - boardH))
        drawBackdrop(ctx, view, boardH)
        drawLevel(ctx, next, view, w)
        drawFlag(ctx, next.level, view, next.status === 'won', clock.current)
        drawItems(ctx, next, view)
        drawEnemies(ctx, next, view)
        drawHero(ctx, next.body, view, next.mercy, clock.current)
        ctx.restore()

        // Everything below the level is pad, and everything above is the score.
        ctx.fillStyle = '#0d1016'
        ctx.fillRect(0, 0, w, capH)
        ctx.fillRect(0, capH + middle, w, h - capH - middle)

        /*
         * Three readings across one bar.
         *
         * Sized from the tile before, which has nothing to do with how much
         * room the words need: on a phone held upright the tiles are large and
         * the screen is narrow, so "0 COINS" and "LEVEL 1" ran into each other
         * with no gap at all. Measured and shrunk to fit instead, with a proper
         * space kept between them.
         */
        const gap = size * 0.4
        /*
         * Room for the way out, which sits in this corner.
         *
         * Measured from the button's real size in screen pixels rather than
         * guessed as a multiple of the header height: the header scales with
         * the board and the button does not, so on a short wide screen the
         * guess left "BACK" and the first reading touching each other.
         */
        const backRoom = 70 * (canvas.width / Math.max(1, canvas.clientWidth))
        const coins = `${next.coins} COINS`
        const level = `LEVEL ${next.number}`
        const remaining = `${Math.ceil(next.seconds)}`
        let text = Math.min(size * 0.72, capH * 0.62)
        /*
         * The middle one is centred and the other two are pinned to the sides,
         * so what decides whether they collide is the widest side against half
         * the middle — not the three widths added up, which was the first
         * attempt and let "0 COINS" run straight into "LEVEL 1" with no gap.
         */
        const fits = () => {
          ctx.font = `bold ${text}px ui-monospace, monospace`
          const side = Math.max(ctx.measureText(coins).width, ctx.measureText(remaining).width)
          return side * 2 + ctx.measureText(level).width + gap * 2 + backRoom * 2 <= w
        }
        while (text > 9 && !fits()) text -= 1

        ctx.fillStyle = '#eef2f8'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText(coins, backRoom, capH / 2)
        ctx.textAlign = 'center'
        ctx.fillText(level, w / 2, capH / 2)
        ctx.textAlign = 'right'
        ctx.fillText(remaining, w - gap, capH / 2)

        padRef.current = padLayout(w, h)
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>)
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
      ArrowUp: 'jump', ' ': 'jump', w: 'jump',
      Shift: 'run', z: 'run',
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

  const restart = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = newRun(run.level, run.number, Math.max(1, run.lives))
    camera.current = 0
    setHud((h) => ({ ...h, status: 'playing', seconds: 300 }))
  }

  const nextLevel = () => {
    const run = runRef.current
    if (!run) return
    const number = run.number + 1
    if (number > LEVELS.length) {
      runRef.current = { ...run, status: 'won' }
      return
    }
    runRef.current = newRun(levelFor(number), number, run.lives)
    camera.current = 0
    setHud((h) => ({ ...h, status: 'playing', level: number, seconds: 300 }))
  }

  const startOver = () => {
    runRef.current = newRun(levelFor(1), 1)
    camera.current = 0
    setHud({ level: 1, lives: 3, coins: 0, score: 0, seconds: 300, status: 'playing' })
  }

  const lastLevel = hud.level >= LEVELS.length
  const outOfLives = hud.lives <= 0
  /**
   * Losing a life asks you something and then puts you straight back in.
   *
   * Not a menu: the question is the whole interruption. A panel saying "you
   * died, press again" in front of it would be one tap of nothing between the
   * player and the game.
   */
  const asking = hud.status === 'dead' && !outOfLives
  const overlay = hud.status !== 'playing' && !asking

  return (
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <header className="sr-only" aria-live="polite">
        LEVEL {hud.level} COINS {hud.coins} LIVES {hud.lives}
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      </div>

      <BackButton onClick={() => go('home')} />

      {asking && <Interlude onDone={restart} />}

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
              {hud.status === 'outOfTime'
                ? 'Time! I built that clock myself and it is my finest work.'
                : hud.status === 'won' && lastLevel
                  ? 'You have been through every pipe I own. I am going to need more pipes.'
                  : hud.status === 'won'
                    ? 'You got the flag. Do not get comfortable, there are more.'
                    : outOfLives
                      ? 'All out! Back to the beginning with you.'
                      : 'Down a pipe. That happens.'}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {hud.status === 'won' && !lastLevel && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">
                  On to level {hud.level + 1}
                </Btn>
              )}
              {(outOfLives || (hud.status === 'won' && lastLevel) || hud.status === 'outOfTime') && (
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
