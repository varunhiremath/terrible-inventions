import { useEffect, useRef, useState } from 'react'
import { NEW_KIT, STARTING_SHIELDS, WORLDS, worldFor, type Kit, type Upgrade } from '../space/level'
import {
  FIXED, buy, newRun, resume, step,
  type Input, type Run, type SpaceEvent, type Status,
} from '../space/run'
import { createLatch, keyAt, padHeight, padLayout, type Button, type Key } from '../space/controls'
import { drawPad, drawRun, type View } from '../space/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { fill } from '../config/profile'
import { BackButton, Btn } from '../ui/bits'
import { LABELS, hintAlpha } from '../ui/padHints'
import { useStore } from '../store'
import { spareShields } from '../workshop/kit'
import { pickFact, type Fact } from '../space/facts'
import { FactCard, Shop } from './SpaceShop'

/**
 * The long way out.
 *
 * Eight runs, one to each world, and the worlds are the real ones in the order
 * you would meet them. The game is a shooter; the reason it is in here is the
 * card you get when you arrive, and that card says something true.
 *
 * The one promise the model makes is that there is always a gap wide enough to
 * fly through. That is the same promise the road makes, for the same reason,
 * and both games learned it the same expensive way: a screen with no way past
 * it is not difficulty, it is a coin toss you lose.
 */
const MAX_CATCHUP = 0.25

const NOISE: Record<SpaceEvent, CueName> = {
  shot: 'laser',
  hit: 'ping',
  broke: 'burst',
  knock: 'struck',
  arrive: 'orbit',
  warn: 'closing',
  scrap: 'cell',
}

/** Loudest first: one sound a frame, and never the laser if anything else fired. */
const LOUDEST: SpaceEvent[] = ['arrive', 'knock', 'warn', 'broke', 'scrap', 'hit', 'shot']
if (LOUDEST.length !== Object.keys(NOISE).length) {
  throw new Error('a space event with no place in the order')
}

interface Hud {
  number: number
  score: number
  shields: number
  progress: number
  status: Status
  broken: number
  purse: number
  kit: Kit
}

/**
 * Where to set off from, and with what. `?world=6&scrap=120`, and nothing else.
 *
 * The same probe hook the caves have, for the same reason: the shop only opens
 * when you land, landing takes a minute of good flying, and a picture of the
 * shop is the only way to find out whether it fits on a phone. Nothing in the
 * app writes these and there is no way to them from inside it.
 */
function opening(): { world: number; scrap: number } {
  const asked = new URLSearchParams(window.location.search)
  const world = Number(asked.get('world'))
  const scrap = Number(asked.get('scrap'))
  return {
    world: Number.isFinite(world) ? Math.min(WORLDS.length, Math.max(1, Math.floor(world))) : 1,
    scrap: Number.isFinite(scrap) ? Math.max(0, Math.floor(scrap)) : 0,
  }
}

export function Space() {
  const go = useStore((s) => s.go)
  const earn = useStore((s) => s.earn)
  const kit = useStore((s) => s.save.workshop)
  /** What the workshop has sold him, read once when a run starts. */
  const stock = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const padRef = useRef<Key[]>([])
  const padShape = useRef('')
  const hintsFrom = useRef(0)
  const clock = useRef(0)
  const travelled = useRef(0)
  const buttons = useRef(createLatch())
  const [hud, setHud] = useState<Hud>({
    number: 1, score: 0, shields: STARTING_SHIELDS, progress: 0, status: 'flying', broken: 0,
    purse: 0, kit: NEW_KIT,
  })
  /*
   * The facts already read, so a run does not hand out the same one twice.
   * Kept for the sitting rather than saved: coming back tomorrow to a fresh
   * set of facts is a feature, not a bug.
   */
  const read = useRef<string[]>([])
  const [fact, setFact] = useState<Fact | null>(null)

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
      const from = opening()
      runRef.current = newRun(from.world, STARTING_SHIELDS + stock.current, 0, 1, from.scrap)
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
      if (run) {
        const held = buttons.current.read()
        const input: Input = { left: held.left, right: held.right, fire: held.fire }

        // Events are read inside the step, not off the state the frame ends
        // on: a frame holds several steps and each clears the last one's.
        const heard: SpaceEvent[] = []
        let stepped = false
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

        /*
         * How tense the music is.
         *
         * Two things make a run bad: being a long way out, and being nearly
         * out of shields. Taking the worse of the two means the last stretch
         * to Neptune sounds like the last stretch, and so does being on your
         * last shield at Venus.
         */
        const far = (next.number - 1) / Math.max(1, WORLDS.length - 1)
        const hurt = 1 - (next.shields - 1) / Math.max(1, STARTING_SHIELDS - 1)
        setHeat(Math.max(far * 0.55 + next.progress * 0.3, hurt * 0.8))

        if (
          next.number !== hud.number || next.status !== hud.status ||
          next.score !== hud.score || next.shields !== hud.shields ||
          next.purse !== hud.purse || next.kit !== hud.kit ||
          Math.round(next.progress * 50) !== Math.round(hud.progress * 50)
        ) {
          setHud({
            number: next.number,
            score: next.score,
            shields: next.shields,
            progress: next.progress,
            status: next.status,
            broken: next.broken,
            purse: next.purse,
            kit: next.kit,
          })
        }

        // The starfield scrolls at the speed this world's rubble falls, so the
        // sky and the hazards agree about how fast you are going.
        travelled.current += elapsed * next.world.fall

        const w = canvas.width
        const h = canvas.height
        const padH = padHeight(w, h)
        const capH = Math.max(h * 0.06, 22)
        const sky = Math.max(80, h - padH - capH)

        // Drawn between steps, so the ship does not move in sixty jerks.
        const x = previous.x + (next.x - previous.x) * alpha
        const view: View = { w, h: sky, clock: clock.current }

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.save()
        ctx.translate(0, capH)
        ctx.beginPath()
        ctx.rect(0, 0, w, sky)
        ctx.clip()
        drawRun(ctx, { ...next, x }, view, travelled.current)
        ctx.restore()

        ctx.fillStyle = '#0d1016'
        ctx.fillRect(0, 0, w, capH)
        ctx.fillRect(0, capH + sky, w, h - capH - sky)

        // --- the readings ----------------------------------------------------
        const backRoom = 70 * (canvas.width / Math.max(1, canvas.clientWidth))
        const score = `${next.score}`.padStart(6, '0')
        const heading = `TO ${next.world.name.toUpperCase()}`
        const shields = '◆'.repeat(Math.max(0, next.shields))
        let text = Math.min(w * 0.045, capH * 0.6)
        const fits = () => {
          ctx.font = `bold ${text}px ui-monospace, monospace`
          const side = Math.max(ctx.measureText(score).width, ctx.measureText(shields).width)
          return side * 2 + ctx.measureText(heading).width + backRoom * 2 + text * 2 <= w
        }
        while (text > 9 && !fits()) text -= 1

        ctx.fillStyle = '#eef2f8'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText(score, backRoom, capH / 2)
        ctx.textAlign = 'center'
        ctx.fillText(heading, w / 2, capH / 2)
        ctx.textAlign = 'right'
        ctx.fillStyle = next.shields <= 1 ? '#ff6b53' : '#58b9ff'
        ctx.fillText(shields, w - text, capH / 2)

        /*
         * How far there is to go.
         *
         * The planet growing at the top says it too, but a planet is a mood
         * and a bar is a number. Both, because one of them is readable at a
         * glance while you are busy not being hit.
         *
         * It sits along the bottom edge of the sky rather than the top, where
         * it was drawn straight across the planet it was measuring.
         */
        const barH = Math.max(3, capH * 0.12)
        const barY = capH + sky - barH
        ctx.fillStyle = 'rgba(232,235,245,0.18)'
        ctx.fillRect(0, barY, w, barH)
        ctx.fillStyle = next.progress > 0.85 ? '#ffe08a' : '#58b9ff'
        ctx.fillRect(0, barY, w * next.progress, barH)

        /*
         * What is in the pocket.
         *
         * Top left, under the score. It was along the bottom, which is where
         * the eye is while flying — and also exactly where the ship is, so at
         * the left-hand edge of the screen the number was printed across it.
         */
        ctx.font = `bold ${text * 0.9}px ui-monospace, monospace`
        ctx.textAlign = 'left'
        ctx.fillStyle = '#ffd23f'
        ctx.fillText(`◆ ${next.purse}`, backRoom, capH + text * 0.9)

        padRef.current = padLayout(w, h)
        const shape = padRef.current.map((k) => k.id).join(',')
        if (shape !== padShape.current) {
          padShape.current = shape
          hintsFrom.current = clock.current
        }
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>, {
          alpha: hintAlpha(clock.current - hintsFrom.current),
          labels: LABELS.space,
        })
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
      ' ': 'fire', ArrowUp: 'fire', w: 'fire',
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

  /*
   * The fact that goes with a knock.
   *
   * Chosen once, when the knock happens, and not on every render: a card that
   * changed its mind about what it was telling you while you read it would be
   * worse than no card.
   */
  useEffect(() => {
    stock.current = spareShields({ workshop: kit })
  }, [kit])

  /** Coins for the flight, paid once, when it ends one way or the other. */
  const banked = useRef('')
  useEffect(() => {
    const run = runRef.current
    if (!run || (hud.status !== 'arrived' && hud.status !== 'lost')) return
    const mark = `${run.number}:${hud.status}:${run.score}`
    if (banked.current === mark) return
    banked.current = mark
    earn(run.score)
  }, [hud.status, earn])

  useEffect(() => {
    if (hud.status !== 'knocked' || hud.shields <= 0) return
    setFact((already) => {
      if (already) return already
      const chosen = pickFact(read.current, Math.random())
      read.current = [...read.current, chosen.text]
      return chosen
    })
  }, [hud.status, hud.shields])

  /*
   * Back out there after a knock.
   *
   * No question, and nothing bought back. A shield is a thing you buy at a
   * world with scrap you went and earned, which is a better trade than a
   * question you might have been asked anyway — and it is the trade this game
   * was asked for.
   */
  const carryOn = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = resume(run)
    setFact(null)
    setHud((h) => ({ ...h, status: 'flying', shields: runRef.current!.shields }))
  }

  const spend = (what: Upgrade) => {
    const run = runRef.current
    if (!run) return
    const after = buy(run, what)
    runRef.current = after
    setHud((h) => ({ ...h, purse: after.purse, shields: after.shields, kit: after.kit }))
  }

  const onward = () => {
    const run = runRef.current
    if (!run) return
    const number = run.number + 1
    if (number > WORLDS.length) return
    // Scrap and kit carry. That is the whole reason to go back for a cell
    // rather than getting out of its way.
    runRef.current = newRun(number, run.shields, run.score, run.seed, run.purse, run.kit)
    setHud((h) => ({ ...h, status: 'flying', number, progress: 0 }))
  }

  const startOver = () => {
    runRef.current = newRun(1, STARTING_SHIELDS + stock.current)
    read.current = []
    setFact(null)
    setHud({
      number: 1, score: 0, shields: STARTING_SHIELDS, progress: 0, status: 'flying', broken: 0,
      purse: 0, kit: NEW_KIT,
    })
  }

  const world = worldFor(hud.number)
  const lastWorld = hud.number >= WORLDS.length
  const outOfShields = hud.shields <= 0
  /** A knock puts up a fact and puts you straight back out there. */
  const knocked = hud.status === 'knocked' && !outOfShields
  const overlay = hud.status !== 'flying' && !knocked

  return (
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <header className="sr-only" aria-live="polite">
        FLYING TO {world.name} SCORE {hud.score} SHIELDS {hud.shields}{' '}
        BROKEN {hud.broken} SCRAP {hud.purse} PROGRESS {Math.round(hud.progress * 100)}
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      </div>

      <BackButton onClick={() => go('home')} />

      {knocked && fact && <FactCard fact={fact} shields={hud.shields} onDone={carryOn} />}

      {overlay && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="block-panel max-h-full w-full max-w-md overflow-y-auto p-5 short:max-w-2xl short:p-3">
            <p className="text-sm font-bold uppercase tracking-wider text-rust">
              {hud.status === 'arrived' ? world.name.toUpperCase() : fill('{papa}')}
            </p>
            <p className="mt-2 text-xl leading-snug short:mt-1 short:text-base">
              {hud.status === 'arrived' && lastWorld
                ? 'Neptune. There is nothing past Neptune but my patience, and you have used that up too.'
                : hud.status === 'arrived'
                  ? `You made ${world.name}. It will not happen again.`
                  : 'Out of shields, and a very long way from anywhere.'}
            </p>

            {/*
              * The whole reason for the game.
              *
              * It goes up when you arrive, not on a loading screen, because
              * this is the one moment somebody is pleased with themselves and
              * therefore willing to read something.
              */}
            {hud.status === 'arrived' && (
              <>
                <p className="mt-3 text-base leading-snug text-parchment short:mt-1.5 short:text-sm">{world.fact}</p>
                {world.moons.length > 0 && (
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-dim short:mt-1 short:text-[0.65rem]">
                    Moons: {world.moons.map((m) => m.name).join(', ')}
                  </p>
                )}
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-moss short:mt-1 short:text-[0.65rem]">
                  {hud.broken} broken up on the way
                </p>
                {runRef.current && <Shop run={runRef.current} onBuy={spend} />}
              </>
            )}

            <div
              /*
               * Side by side on a short screen. Stacked, the second one hung
               * off the bottom edge of a phone held sideways — and this panel
               * has a whole shop in it now, which is where the height went.
               */
              className="mt-5 flex flex-col gap-2 short:mt-2 short:flex-row-reverse short:gap-2"
            >
              {hud.status === 'arrived' && !lastWorld && (
                <Btn tone="go" onClick={onward} className="py-4 text-lg short:min-h-0 short:flex-1 short:py-2 short:text-base">
                  On to {worldFor(hud.number + 1).name}
                </Btn>
              )}
              {(outOfShields || (hud.status === 'arrived' && lastWorld)) && (
                <Btn tone="go" onClick={startOver} className="py-4 text-lg short:min-h-0 short:flex-1 short:py-2 short:text-base">
                  Start again
                </Btn>
              )}
              <Btn onClick={() => go('home')} className="short:min-h-0 short:py-2 short:text-sm">Back to the menu</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
