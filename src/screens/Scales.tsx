import { useEffect, useRef, useState } from 'react'
import { LIVES, WEIGHTS, asks, bitsFor, cratesFor, saysOn, type Job } from '../scales/level'
import {
  FIXED, LOUDEST, newRun, nextLevel, nudge, serve, step,
  type Move, type Run, type ScalesEvent, type Status,
} from '../scales/run'
import { drawRun } from '../scales/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { Keypad } from '../ui/Keypad'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The Scales.
 *
 * A weighing machine with a rack of brass weights marked with the powers of
 * two, and crates coming along a belt to be balanced. Which weights are on
 * the pan is a binary number; making 45 out of them *is* converting it.
 *
 * The machine is drawn on a canvas and the rack is a row of real buttons
 * underneath it. That split is deliberate: the beam, the crate and the
 * readout want to be a picture, and the things you press want to be buttons —
 * big, labelled, and the same ones every time, so a thumb learns where 32 is.
 *
 * The rules live in `src/scales/run.ts`, which knows nothing about screens,
 * and the picture in `src/scales/draw.ts`, which knows nothing about the
 * rules.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<ScalesEvent, CueName> = {
  place: 'clink',
  lift: 'offPan',
  carried: 'swapUp',
  split: 'swapDown',
  balanced: 'level',
  wrong: 'notQuite',
  arrive: 'belt',
  dropped: 'overEnd',
  cleared: 'weighed',
  over: 'shutDown',
}

/** The line under the rack: what to do with it, in the fewest words. */
const HOW: Record<Job, string> = {
  weigh: 'tap weights until the beam is level',
  name: 'read the weights and type the number',
  power: 'one weight, and it is a power of two',
  exponent: 'two to the what? type the power',
  double: 'twice as much — every weight moves up one',
  halve: 'half as much — every weight moves down one',
  carry: 'two of a kind make the next one up',
  borrow: 'take weights off — break one in two when it will not come off whole',
}

/** The exponent, written small, for under each weight on the rack. */
const POWERS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '¹⁰', '¹¹', '¹²']

interface Hud {
  level: number
  score: number
  lives: number
  left: number
  job: Run['crate']['job']
  pan: number[]
  typed: string
  status: Status
  /** Which weight to reach for, once the clock is nearly out. */
  hint: number | null
  /** What is chalked on the crate, and what to do with it, in words. */
  says: string
  asks: string
  /** What the pan has to come to, which a borrow job reads to mark the rack. */
  load: number
}

export function Scales() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const queue = useRef<Move[]>([])
  const spare = useRef(0)
  const shown = useRef<Hud | null>(null)
  const go = useStore((s) => s.go)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    level: 1, score: 0, lives: LIVES, left: cratesFor(1) - 1, job: 'weigh',
    pan: WEIGHTS.map(() => 0), typed: '', status: 'playing', hint: null,
    says: '', asks: '', load: 0,
  })
  const [asking, setAsking] = useState(false)
  /*
   * Which of the borrow job's two moves the rack is sending.
   *
   * Sticky, because borrowing comes in runs: working out 104 - 17 means
   * breaking the 8 down three times in a row and then lifting once, and a
   * mode that sprang back after every tap would cost four presses to do one
   * thing. It is reset whenever the job changes, so a crate never arrives
   * with the rack set to something the last crate wanted.
   */
  const [breaking, setBreaking] = useState(false)

  useEffect(() => { spare.current = spareLives({ workshop: kit }) }, [kit])

  // A crate never arrives with the rack set to what the last one wanted.
  useEffect(() => { setBreaking(false) }, [hud.job])

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
        const heard: ScalesEvent[] = []
        const { next } = pacer.advance(run, elapsed, (s) => {
          // One move a step, in the order they were pressed: two taps in the
          // same frame are two taps, not one.
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

        // How tense: the clock on this crate, and how near the end of the run.
        const pressing = 1 - next.clock / Math.max(1, next.crate.seconds)
        const hurt = 1 - (next.lives - 1) / Math.max(1, LIVES - 1)
        setHeat(Math.min(1, Math.max(hurt * 0.6, pressing * 0.8)))

        drawRun(ctx, next, { w: canvas.width, h: canvas.height, clock })

        const fresh: Hud = {
          level: next.level,
          score: next.score,
          lives: next.lives,
          left: next.left,
          job: next.crate.job,
          pan: next.pan,
          typed: next.typed,
          status: next.status,
          // Only once the clock is nearly out, and only ever one weight.
          hint: next.clock < 6 ? nudge(next) : null,
          says: saysOn(next.crate),
          asks: asks(next.crate),
          load: next.crate.load,
        }
        const was = shown.current
        if (
          was === null || was.status !== fresh.status || was.score !== fresh.score ||
          was.lives !== fresh.lives || was.left !== fresh.left || was.job !== fresh.job ||
          was.typed !== fresh.typed || was.hint !== fresh.hint || was.says !== fresh.says ||
          was.pan.some((many, bit) => many !== fresh.pan[bit])
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
      job: after.crate.job, pan: after.pan, typed: '',
      says: saysOn(after.crate), asks: asks(after.crate), load: after.crate.load,
    }))
  }

  const again = () => {
    const fresh = newRun(1, LIVES + spare.current)
    runRef.current = fresh
    setAsking(false)
    setHud(keep({
      level: 1, score: 0, lives: fresh.lives, left: fresh.left, job: fresh.crate.job,
      pan: fresh.pan, typed: '', status: 'playing', hint: null,
      says: saysOn(fresh.crate), asks: asks(fresh.crate), load: fresh.crate.load,
    }))
  }

  const cleared = hud.status === 'cleared'
  const over = hud.status === 'over'
  const bits = bitsFor(hud.level)
  // The two jobs answered on the pad rather than on the rack.
  const naming = hud.job === 'name' || hud.job === 'exponent'
  /*
   * And the two whose pan belongs to the machine, which send a different move
   * from the same button. A carry crate only ever tidies; a borrow crate
   * works out for itself whether the weight under the thumb is coming off,
   * breaking in two, or carrying up, because which of the three it is can be
   * read off the button before it is pressed.
   */
  const carrying = hud.job === 'carry'
  const borrowing = hud.job === 'borrow'
  const splitting = borrowing && breaking

  /* Biggest first, the way a number is written. */
  const rack = Array.from({ length: bits }, (_, i) => bits - 1 - i)
  const onThePan = hud.pan.reduce((sum, many, bit) => sum + many * WEIGHTS[bit], 0)

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

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full" />
        {/*
          * What is on the crate, in words as well as chalk.
          *
          * The crate is drawn on a canvas, which to anything that is not a
          * pair of eyes is a blank rectangle — a screen reader, or the script
          * that plays this game in a browser to check the rack is wired to
          * the pan. It costs a line and it is the only part of the machine
          * that is otherwise unreadable.
          */}
        <p className="sr-only" aria-live="polite">
          Crate {hud.says}. {hud.asks}.
          {' '}On the pan: {hud.pan.some((many) => many > 0)
            ? hud.pan
              .map((many, bit) => ({ many, weight: WEIGHTS[bit] }))
              .filter(({ many }) => many > 0)
              .reverse()
              .map(({ many, weight }) => (many > 1 ? `${weight} times ${many}` : `${weight}`))
              .join(', ')
            : 'nothing'}.
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
                {cleared ? `Level ${hud.level} weighed` : 'The belt beat you'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {cleared
                  ? `Next lot go up to ${Math.pow(2, bitsFor(hud.level + 1)) - 1}.`
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

      {/*
        * The rack, or the pad.
        *
        * The same strip of screen either way, so nothing jumps about when the
        * job changes: weights to press for three of the four jobs, and a
        * number pad for the one that asks you to read the machine instead.
        */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        {naming ? (
          <Keypad
            value={hud.typed}
            onChange={(next) => {
              if (next.length < hud.typed.length) send({ kind: 'rub' })
              else send({ kind: 'type', digit: next.slice(-1) })
            }}
            onSubmit={() => send({ kind: 'say' })}
            disabled={hud.status !== 'playing'}
          />
        ) : (
          /*
           * Four weights to a row while the rack is small, six once it has
           * grown past eight: twelve buttons in fours is four rows, which is
           * a third of a phone and leaves the machine looking through a
           * letterbox.
           */
          <>
            {borrowing && (
              /*
               * The borrow job's two moves, named, on the screen, and lit so
               * that which one the rack is sending is never a thing you have
               * to remember. Both of them are real words for what they do:
               * you take a weight off, or you break one in two.
               */
              <div className="mb-1.5 grid grid-cols-2 gap-2">
                {([false, true] as const).map((mode) => (
                  <button
                    key={String(mode)}
                    type="button"
                    aria-pressed={breaking === mode}
                    onPointerDown={() => setBreaking(mode)}
                    className={[
                      'rounded-xl border-2 py-2 font-mono text-[0.7rem] font-bold',
                      'uppercase tracking-widest transition-transform',
                      'active:translate-y-[2px]',
                      breaking === mode
                        ? 'border-rust bg-rust/25 text-rust'
                        : 'border-ink-line bg-ink-soft text-dim',
                    ].join(' ')}
                  >
                    {mode ? 'break in two' : 'take off'}
                  </button>
                ))}
              </div>
            )}
          <div className={bits > 8 ? 'grid grid-cols-6 gap-1.5' : 'grid grid-cols-4 gap-2'}>
            {rack.map((bit) => {
              const many = hud.pan[bit] ?? 0
              const on = many > 0
              const pile = many > 1
              /*
               * On a borrow job the button says, before it is pressed,
               * whether the pan can spare this weight. One it cannot spare is
               * exactly the one that has to be broken open, and that is the
               * whole insight the job exists for — leaving a child to find it
               * by pressing things is a worse game, not a harder one.
               */
              const weight = WEIGHTS[bit]
              const breaks =
                borrowing && many >= 1 && onThePan - weight < hud.load
              return (
                <button
                  key={bit}
                  type="button"
                  aria-label={
                    `${weight}${pile ? `, ${many} of them` : ''}` +
                    (breaks ? ', will not come off' : '')
                  }
                  onPointerDown={() => send(
                    carrying
                      ? { kind: 'carry', bit }
                      : splitting
                        ? { kind: 'split', bit }
                        : { kind: 'tap', bit },
                  )}
                  className={[
                    'relative rounded-xl border-2 font-mono font-bold tabular-nums',
                    bits > 8 ? 'py-2 text-sm' : 'py-3 text-lg',
                    'transition-transform active:translate-y-[2px]',
                    on
                      ? 'border-bolt bg-bolt/25 text-bolt'
                      : 'border-ink-line bg-ink-soft text-dim',
                    hud.hint === bit ? 'ring-2 ring-moss/70' : '',
                    breaks ? 'border-dashed' : '',
                  ].join(' ')}
                >
                  {weight}
                  {pile && (
                    <span className="absolute right-1.5 top-1 font-mono text-[0.6rem] text-rust">
                      ×{many}
                    </span>
                  )}
                  <span className="mt-0.5 block font-mono text-[0.55rem] font-normal text-dim">
                    2{POWERS[bit]}
                  </span>
                </button>
              )
            })}
          </div>
          </>
        )}
        <p className="mt-1.5 text-center font-mono text-[0.62rem] uppercase tracking-widest text-dim/60">
          {HOW[hud.job]}
        </p>
      </div>
    </div>
  )
}
