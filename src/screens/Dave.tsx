import { useEffect, useRef, useState } from 'react'
import { LEVEL_TILES_X, VIEW_TILES_X, VIEW_TILES_Y } from '../dave/level'
import { JET_SECONDS, NO_INPUT, cameraFor, type Input } from '../dave/physics'
import { STARTING_LIVES, newGame, respawn, shoot, step, type CaveEvent, type Game } from '../dave/game'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { LEVELS, levelFor } from '../dave/levels'
import { createPacer } from '../arcade/pacing'
import { blendDave, blendMonster } from '../dave/blend'
import { combine, keyAt, padHeight, padLayout, type Button, type Key } from '../dave/controls'
import {
  drawBullet,
  drawDave,
  drawFrame,
  drawLevel,
  drawLifeIcon,
  drawMonster,
  drawPad,
  drawSky,
  EGA,
  type View,
} from '../dave/draw'
import { fill } from '../config/profile'
import { BackButton, Btn } from '../ui/bits'
import { useAfterABeat } from '../ui/afterABeat'
import { say, silence } from '../voice'
import { LABELS, hintAlpha } from '../ui/padHints'
import { OPENERS } from '../lines'
import { useStore } from '../store'
import { jetScale, spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The caves.
 *
 * The simulation is pure and lives in `dave/`; this is the loop that drives
 * it, the canvas it is drawn on, and the glass it is played through.
 */

const FIXED = 1 / 120
const MAX_CATCHUP = 0.25

/**
 * Which sound answers which event.
 *
 * The caves had one loop and nothing else, whatever was happening in them.
 */
const NOISE: Record<CaveEvent, CueName> = {
  gem: 'gem',
  trophy: 'trophy',
  exit: 'exit',
  leap: 'leap',
  kit: 'jetpack',
  lost: 'lost',
}

/**
 * One sound a frame, most important first.
 *
 * A frame can hold several steps, and playing every one of them at once is a
 * noise rather than a cue. Dying while taking a diamond should be heard as a
 * death.
 */
const LOUDEST: CaveEvent[] = ['lost', 'exit', 'trophy', 'kit', 'gem', 'leap']
// Every event needs a place in the order or it can never be the loudest thing
// in a frame, and so is never heard at all.
if (LOUDEST.length !== Object.keys(NOISE).length) {
  throw new Error('a cave event with no place in the order')
}

/**
 * Which cave to open on.
 *
 * `?cave=5` in the address, and nothing else. There is no way to it from the
 * app and nothing in the app writes it: it exists so a probe can stand in a
 * late cave without playing four of them first, which is how the gun being
 * broken went unnoticed for as long as it did. A child on a phone will never
 * see it; I need it every time something is reported about cave five.
 */
function openingCave(): number {
  const asked = Number(new URLSearchParams(window.location.search).get('cave'))
  if (!Number.isFinite(asked)) return 1
  return Math.min(LEVELS.length, Math.max(1, Math.floor(asked)))
}

/**
 * Whether to start holding the gun. `?armed=1`, and the same rules apply.
 *
 * The probe that checks the FIRE button needs a gun in hand, and getting one
 * honestly means jumping onto a particular ledge in cave five. That is a test
 * of the platforms, which the solver already covers; this one is about whether
 * pressing the button makes a bullet.
 */
function openingArms(): boolean {
  return new URLSearchParams(window.location.search).get('armed') === '1'
}

export function Dave() {
  const go = useStore((s) => s.go)
  const earn = useStore((s) => s.earn)
  const kit = useStore((s) => s.save.workshop)
  /** The workshop's stock, read once when a run starts. */
  const stock = useRef({ lives: 0, jets: 1 })

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const touches = useRef(new Map<number, Button | null>())
  /** Where the buttons are this frame, so a touch can be matched to one. */
  const padRef = useRef<Key[]>([])
  /** Jump is the frame the up-band is first touched, not every frame it is held. */
  const wasUp = useRef(false)
  const wasFire = useRef(false)
  /** A tap that began since the last frame, held until a frame has read it. */
  const firePending = useRef(false)
  const clock = useRef(0)
  /** The pad as it was last frame, so a change of buttons re-announces them. */
  const padShape = useRef('')
  /** When the labels last started, for the fade. */
  const hintsFrom = useRef(0)

  const [hud, setHud] = useState({
    score: 0, lives: 3, level: 1, fuel: 0, gun: false, trophy: false, shots: 0,
    status: 'playing' as Game['status'], message: null as string | null,
  })

  useEffect(() => {
    const plain = newGame(
      levelFor(openingCave()),
      openingCave(),
      STARTING_LIVES + stock.current.lives,
    )
    const opening = { ...plain, jetTank: plain.jetTank * stock.current.jets }
    gameRef.current = openingArms()
      ? { ...opening, dave: { ...opening.dave, hasGun: true } }
      : opening
    clock.current = 0
    say(fill(OPENERS.caves), { as: 'papa', raw: OPENERS.caves })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let last = performance.now()
    const pacer = createPacer<Game>(FIXED, MAX_CATCHUP)

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
      const elapsed = (now - last) / 1000
      last = now

      let game = gameRef.current
      if (game) {
        const held = combine([...touches.current.values()])
        const jump = held.up && !wasUp.current
        wasUp.current = held.up
        const input: Input = { ...NO_INPUT, left: held.left, right: held.right, up: held.up, down: held.down, jump }

        /*
         * The shot goes into the game this frame is about to advance.
         *
         * It used to be written to `gameRef.current` while the frame carried
         * on simulating the copy it had taken a line earlier, and then
         * overwrote the reference with the result — so the bullet was created
         * and thrown away sixty times a second. The gun had never worked from
         * the button in any cave. It worked from the space bar, because that
         * happens between frames and the next frame picks the bullet up, which
         * is exactly why every check I had ran clean: they all used the
         * keyboard.
         *
         * `firePending` is the other half of it. A tap can start and end
         * between two frames, and this screen reads its buttons straight off
         * the map of live touches, so a quick tap on FIRE was never seen at
         * all. The other four games latch their buttons for this reason; this
         * one did not.
         */
        if ((held.fire || firePending.current) && !wasFire.current) game = shoot(game)
        wasFire.current = held.fire
        firePending.current = false
        gameRef.current = game

        // Drawn between the last two states, not at the latest one. Without
        // it everything moves by however many slices happened to fit in the
        // frame — one, two or three — which is a fine stutter that gets worse
        // the faster the screen refreshes.
        let first = true
        /*
         * The noises are read inside the step, not off the state the frame
         * ends on. A frame can hold several steps, each clearing `events` for
         * the next, so reading the last one drops the rest — and taking three
         * diamonds in one frame made one sound. Found and fixed once already
         * in the pipes; no reason to find it a third time.
         */
        const heard: CaveEvent[] = []
        const { previous, next, alpha } = pacer.advance(game, elapsed, (s) => {
          const out = step(s, { ...input, jump: jump && first }, FIXED)
          first = false
          clock.current += FIXED
          if (out.events.length > 0) heard.push(...out.events)
          return out
        })

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          if (loudest) playCue(NOISE[loudest])
        }
        gameRef.current = next

        /*
         * How tense the music is.
         *
         * Being deep in the caves, being down to your last Dave, and carrying
         * the trophy — the last one because once you have it the only thing
         * left to do is get out, and getting out is the part that kills you.
         * The caves have no drum track until this passes halfway, which is
         * the loudest thing the heat does anywhere in the app.
         */
        const deep = (next.number - 1) / Math.max(1, LEVELS.length - 1)
        const thin = 1 - (next.lives - 1) / 2
        setHeat(Math.max(deep * 0.5 + (next.dave.hasTrophy ? 0.35 : 0), thin * 0.85))

        if (
          // The level number is in here because it can change on its own —
          // the cave hook opens somewhere other than the first one, and the
          // readout happily went on saying LEVEL 01 while cave five was being
          // played, since nothing else about the state had moved yet.
          next.number !== shown.level ||
          next.score !== shown.score || next.lives !== shown.lives ||
          next.status !== shown.status || next.message !== shown.message ||
          Math.ceil(next.dave.fuel) !== Math.ceil(shown.fuel) ||
          next.dave.hasGun !== shown.gun || next.dave.hasTrophy !== shown.trophy ||
          next.shots !== shown.shots
        ) {
          shown = {
            score: next.score, lives: next.lives, level: next.number,
            fuel: next.dave.fuel, gun: next.dave.hasGun, trophy: next.dave.hasTrophy,
            status: next.status, message: next.message, shots: next.shots,
          }
          setHud({ ...shown })
        }

        // --- draw -----------------------------------------------------------
        const w = canvas.width
        const h = canvas.height
        /*
         * Three bands down the screen: the score along the top, the room in
         * the middle, and the buttons along the bottom. The buttons get their
         * own room rather than sitting over the board — Dave starts in the
         * bottom left corner, exactly under the walk-left button.
         *
         * The room is exactly twenty tiles across and ten down, letterboxed
         * into whatever is left. Cropping it would hide the jump you are about
         * to make.
         */
        const headerH = Math.max(h * 0.085, 30)
        const padH = padHeight(w, h)
        const middle = Math.max(40, h - headerH - padH)
        const size = Math.min(w / VIEW_TILES_X, middle / VIEW_TILES_Y)
        const boardW = size * VIEW_TILES_X
        const boardH = size * VIEW_TILES_Y

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = EGA.black
        ctx.fillRect(0, 0, w, h)
        // Saved, because the clip below has to be undone before the score bar
        // is drawn — resetting the transform does not clear a clip, and the
        // score was being quietly cut away at the top of the board.
        ctx.save()
        ctx.translate(
          Math.round((w - boardW) / 2),
          Math.round(headerH + (middle - boardH) / 2),
        )
        ctx.beginPath()
        ctx.rect(0, 0, boardW, boardH)
        ctx.clip()

        const drawn = blendDave(previous.dave, next.dave, alpha)
        const view: View = {
          camera: cameraFor(drawn, VIEW_TILES_X, LEVEL_TILES_X),
          size,
          clock: clock.current,
        }
        drawSky(ctx, view, boardW, boardH)
        drawLevel(ctx, next.level, view, next.taken, next.dave.hasTrophy, boardW)
        next.monsters.forEach((monster, i) =>
          drawMonster(ctx, blendMonster(previous.monsters[i], monster, alpha), view),
        )
        for (const bullet of next.bullets) drawBullet(ctx, bullet, view)
        if (next.dave.alive) drawDave(ctx, drawn, view)
        drawFrame(ctx, next.level, view, boardW, boardH)

        // The score bar and the fuel gauge belong to the picture, not to the
        // page around it: same pixels, same font, same colours as the game.
        ctx.restore()
        const bar = Math.max(14, Math.min(size * 0.52, headerH * 0.52))
        ctx.font = `bold ${bar}px ui-monospace, Menlo, Consolas, monospace`
        ctx.textBaseline = 'middle'
        const midline = headerH / 2

        ctx.fillStyle = EGA.brightGreen
        ctx.textAlign = 'left'
        const pad = size * 0.6
        /*
         * Room for the way out, which sits in this corner.
         *
         * Measured from the button's real size in screen pixels rather than
         * guessed as a multiple of the header height: the header scales with
         * the board and the button does not, so on a short wide screen the
         * guess left "BACK" and the first reading touching each other.
         */
        const backRoom = 70 * (canvas.width / Math.max(1, canvas.clientWidth))
        ctx.fillText(`SCORE: ${String(next.score).padStart(5, '0')}`, backRoom, midline)
        ctx.textAlign = 'center'
        ctx.fillText(`LEVEL ${String(next.number).padStart(2, '0')}`, w / 2, midline)

        ctx.textAlign = 'right'
        const livesLabel = 'DAVES:'
        const icon = bar * 1.1
        const livesRight = w - pad - Math.max(0, next.lives) * (icon + 4)
        ctx.fillText(livesLabel, livesRight, midline)
        for (let i = 0; i < Math.max(0, next.lives); i++) {
          drawLifeIcon(ctx, livesRight + 6 + i * (icon + 4), midline - icon / 2, icon)
        }

        padRef.current = padLayout(w, h, {
          gun: next.dave.hasGun,
          jetpack: next.dave.hasJetpack && next.dave.fuel > 0,
        })
        /*
         * Whenever the buttons change, say what they are again.
         *
         * That covers the start of a level and, in the dungeon, a duel
         * swapping the pad for a sword and a shield — which is the pair
         * nobody could find, because they only appear once a fight starts.
         */
        const shape = padRef.current.map((k) => k.id).join(',')
        if (shape !== padShape.current) {
          padShape.current = shape
          hintsFrom.current = clock.current
        }
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>, {
          alpha: hintAlpha(clock.current - hintsFrom.current),
          labels: LABELS.dave,
        })

        if (next.dave.hasJetpack && next.dave.fuel > 0) {
          // Just under the room, above the buttons.
          const gaugeY = headerH + middle - bar * 1.2
          ctx.fillStyle = EGA.brightGreen
          ctx.textAlign = 'left'
          ctx.fillText('JETPACK', pad, gaugeY + bar * 0.5)
          const gx = pad + bar * 5.2
          const gw = w - gx - pad
          ctx.strokeStyle = EGA.yellow
          ctx.lineWidth = Math.max(2, bar * 0.14)
          ctx.strokeRect(gx, gaugeY, gw, bar)
          ctx.fillStyle = EGA.red
          ctx.fillRect(gx + 3, gaugeY + 3, (gw - 6) * (next.dave.fuel / JET_SECONDS), bar - 6)
        }
      }

      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      setHeat(0)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    stock.current = {
      lives: spareLives({ workshop: kit }),
      jets: jetScale({ workshop: kit }),
    }
  }, [kit])

  /** Coins for the trip underground, paid once, when it ends. */
  const banked = useRef('')
  useEffect(() => {
    const game = gameRef.current
    if (!game || game.status === 'playing') return
    const mark = `${game.number}:${game.status}:${game.score}`
    if (banked.current === mark) return
    banked.current = mark
    earn(game.score)
  }, [hud.status, earn])

  // --- the glass ------------------------------------------------------------
  const readTouch = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // The buttons are laid out in canvas pixels, which may be denser than CSS
    // pixels on a good screen; the touch arrives in CSS pixels.
    const scale = rect.width > 0 ? (canvasRef.current?.width ?? rect.width) / rect.width : 1
    return keyAt((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale, padRef.current)
  }
  const onDown = (e: React.PointerEvent) => {
    const key = readTouch(e)
    touches.current.set(e.pointerId, key)
    // Remembered, so a tap short enough to begin and end inside one frame
    // still fires. Steering does not need this — nobody taps left for four
    // milliseconds — but a shot is a stab at a button by definition.
    if (key === 'fire') firePending.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, readTouch(e))
  }
  const onUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId)
  }

  useEffect(() => {
    const keys: Record<string, Button> = {
      ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
      ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
    }
    // Each key held gets its own slot, so several at once work like several
    // fingers do.
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
      touches.current.set(-1 - Object.keys(keys).indexOf(e.key), which)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const which = keys[e.key]
      if (!which) return
      touches.current.delete(-1 - Object.keys(keys).indexOf(e.key))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  /** A right answer buys back the life you just lost, up to what you started with. */
  const again = (right: boolean) => {
    const game = gameRef.current
    if (!game) return
    const back = respawn(game)
    gameRef.current = right ? { ...back, lives: Math.min(STARTING_LIVES, back.lives + 1) } : back
    clock.current = 0
    setHud((h) => ({ ...h, status: 'playing', message: null, lives: gameRef.current!.lives }))
  }

  const nextLevel = () => {
    const game = gameRef.current
    if (!game) return
    silence()
    const number = game.number + 1
    gameRef.current = {
      ...newGame(levelFor(number), number, game.lives, game.score),
      jetTank: game.jetTank,
    }
    clock.current = 0
    setHud((h) => ({ ...h, status: 'playing', level: number, message: null }))
  }

  const lastLevel = hud.level >= 10
  // Losing a life asks you something and puts you straight back in. A panel
  // saying "you died, press again" in front of it is a tap of nothing.
  const question = useAfterABeat(hud.status === 'died')
  /** The card itself, once the pause after a death has run. */
  const asking = question.now
  const overlay = hud.status !== 'playing' && !asking && !question.soon

  return (
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/*
        * The score is drawn in the picture, which leaves nothing for a screen
        * reader — or for the smoke test — to read. This says the same thing in
        * text, out of sight.
        */}
      <header className="sr-only" aria-live="polite">
        SCORE: {String(hud.score).padStart(5, '0')} LEVEL {String(hud.level).padStart(2, '0')} DAVES: {Math.max(0, hud.lives)}
        {hud.trophy ? ' TROPHY' : ''}
        {hud.gun ? ` GUN SHOTS ${hud.shots}` : ''}
        {hud.fuel > 0 ? ` JETPACK ${Math.ceil(hud.fuel)}` : ''}
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
        {hud.message && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-sm uppercase tracking-widest text-yellow-300">
            {hud.message}
          </p>
        )}
      </div>

      <BackButton onClick={() => go('home')} />

      {asking && <Interlude onDone={again} reward="the life back" />}

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
                ? 'That hideout is a nightmare, is it not? I got lost in it myself. Again?'
                : hud.status === 'levelComplete'
                  ? lastLevel
                    ? 'You got through the whole thing! I am going to have a sit down!'
                    : 'Fine! FINE! There are more rooms. I have got LOADS of rooms!'
                  : 'Ooh! Are you all right? Right, off you go.'}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {hud.status === 'levelComplete' && !lastLevel && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">Next room</Btn>
              )}
              <Btn onClick={() => go('home')}>Back to the menu</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
