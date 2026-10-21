import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { LIVES, ruleSays } from '../archer/level'
import {
  FIXED, LOUDEST, inTheAir, newRun, nextRound, serve, step,
  type ArcherEvent, type Input, type Run, type Status,
} from '../archer/run'
import { buildMeadow } from '../archer/scene'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'

/**
 * The meadow.
 *
 * The first thing in this app that is properly three-dimensional and seen from
 * inside: you stand in one place, turn to look, and shoot at balloons coming up
 * all around you.
 *
 * Two controls on one finger, which took some thinking. Dragging looks around
 * and holding still draws the bow — so the same touch does both, and which one
 * it is is decided by whether it moved. A finger that has wandered more than a
 * few pixels is looking; one that has stayed put is pulling; letting go of a
 * pulled string looses the arrow. There is no fire button anywhere, because a
 * fire button on a phone means a second thumb over the picture you are aiming
 * at.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<ArcherEvent, CueName> = {
  draw: 'creak',
  loose: 'twang',
  pop: 'popped',
  wrong: 'dud',
  thud: 'thump',
  escape: 'away',
  lost: 'away',
  cleared: 'quiverDone',
  over: 'outOfArrows',
}

/** Pixels of wander before a touch counts as looking rather than pulling. */
const WANDER = 7
/** How far a drag turns you: a full screen width is most of the way round. */
const TURN = 2.6

interface Hud {
  round: number
  score: number
  lives: number
  got: number
  need: number
  air: number
  status: Status
  rule: string
}

export function Archer() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const runRef = useRef<Run | null>(null)
  const aim = useRef({ yaw: 0, pitch: 0.12 })
  const touch = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null)
  const pulling = useRef(false)
  const keys = useRef<Set<string>>(new Set())
  const spare = useRef(0)
  const best = useRef(0)
  /*
   * What the bar is showing, kept beside the state as well as in it.
   *
   * The loop runs once and closes over the first `hud` for ever, so comparing
   * against the state would be comparing against round one with no score until
   * the screen is left — which sets state on every single frame and re-renders
   * React sixty times a second behind a WebGL canvas. The ref is what the loop
   * reads.
   */
  const shown = useRef<Hud | null>(null)
  const go = useStore((s) => s.go)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    round: 1, score: 0, lives: LIVES, got: 0, need: 8, air: 0, status: 'playing',
    rule: ruleSays({ kind: 'even' }),
  })
  const [asking, setAsking] = useState(false)

  useEffect(() => { spare.current = spareLives({ workshop: kit }) }, [kit])

  useEffect(() => {
    const mount = wrapRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    /*
     * Tone mapping and the right colour space, which is most of the difference
     * between "3D scene" and "picture of somewhere". Without them a sunlit sky
     * clips to flat white and the greens go muddy.
     */
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none'
    mount.appendChild(renderer.domElement)

    const meadow = buildMeadow(mount.clientWidth || 1, mount.clientHeight || 1)

    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      meadow.resize(w, h)
    }
    resize()
    const watching = new ResizeObserver(resize)
    watching.observe(mount)

    if (!runRef.current) runRef.current = newRun(1, LIVES + spare.current)

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
        const down = keys.current
        if (down.has('ArrowLeft')) aim.current.yaw -= elapsed * 1.6
        if (down.has('ArrowRight')) aim.current.yaw += elapsed * 1.6
        if (down.has('ArrowUp')) aim.current.pitch = Math.min(1.3, aim.current.pitch + elapsed)
        if (down.has('ArrowDown')) aim.current.pitch = Math.max(-0.5, aim.current.pitch - elapsed)

        const input: Input = {
          yaw: aim.current.yaw,
          pitch: aim.current.pitch,
          pulling: pulling.current || down.has(' '),
        }

        const heard: ArcherEvent[] = []
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

        // How tense: how close the run is to being over, and how much of the
        // round is still to do.
        const hurt = 1 - (next.lives - 1) / Math.max(1, LIVES - 1)
        setHeat(Math.min(1, Math.max(hurt * 0.8, (next.got / next.need) * 0.4)))

        best.current = Math.max(best.current, next.score)
        const air = inTheAir(next)
        const was = shown.current
        if (
          was === null || next.status !== was.status || next.round !== was.round ||
          next.score !== was.score || next.lives !== was.lives || next.got !== was.got ||
          air !== was.air
        ) {
          const fresh: Hud = {
            round: next.round,
            score: next.score,
            lives: next.lives,
            got: next.got,
            need: next.need,
            air,
            status: next.status,
            rule: ruleSays(next.rule),
          }
          shown.current = fresh
          setHud(fresh)
        }

        meadow.update(next, 0, clock)
        renderer.render(meadow.scene, meadow.camera)
      }

      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      watching.disconnect()
      setHeat(0)
      meadow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- the finger ------------------------------------------------------------

  const down = (e: React.PointerEvent) => {
    if (asking || hud.status !== 'playing') return
    touch.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }
    pulling.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    const from = touch.current
    if (!from) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (!from.moved && Math.hypot(dx, dy) > WANDER) {
      // It is a look, not a pull. Put the string back without firing.
      from.moved = true
      pulling.current = false
    }
    if (from.moved) {
      const wide = wrapRef.current?.clientWidth ?? 1
      aim.current.yaw += (dx / wide) * TURN
      aim.current.pitch = Math.max(-0.5, Math.min(1.3, aim.current.pitch - (dy / wide) * TURN))
    }
    from.x = e.clientX
    from.y = e.clientY
  }

  const up = () => {
    touch.current = null
    pulling.current = false
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

  // --- between rounds --------------------------------------------------------

  /** Writes the bar's state down where the loop can see it, and returns it. */
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
    if (run.lives > 0) carryOn()
    else {
      runRef.current = { ...run, status: 'over' }
      setAsking(false)
      setHud((h) => keep({ ...h, status: 'over' }))
    }
  }

  const onwards = () => {
    const run = runRef.current
    if (!run) return
    const after = nextRound(run)
    runRef.current = after
    setHud((h) => keep({
      ...h, status: 'playing', round: after.round, got: 0, need: after.need,
      rule: ruleSays(after.rule),
    }))
  }

  const again = () => {
    const fresh = newRun(1, LIVES + spare.current)
    runRef.current = fresh
    setAsking(false)
    setHud(keep({
      round: 1, score: 0, lives: fresh.lives, got: 0, need: fresh.need, air: 0,
      status: 'playing', rule: ruleSays(fresh.rule),
    }))
  }

  const cleared = hud.status === 'cleared'
  const over = hud.status === 'over'

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-ink">
      <BackButton onClick={() => go('home')} />
      <div className="flex shrink-0 items-center gap-2 py-2 pl-20 pr-3">
        <p className="font-mono text-xs font-bold tabular-nums tracking-widest text-chalk">
          {String(hud.score).padStart(6, '0')}
        </p>
        <p className="ml-auto font-mono text-[0.68rem] tabular-nums text-dim">
          round {hud.round} · {hud.got}/{hud.need} · {hud.air} up there
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
        {/*
          * The rule, over the sky rather than in the bar: it is the one thing
          * you have to keep in mind while you are looking around, and a thing
          * you have to look away from the game to read is a thing you forget.
          */}
        <p className="pointer-events-none absolute inset-x-0 top-2 z-10 text-center font-mono text-sm font-bold tracking-[0.18em] text-chalk drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          {hud.rule}
        </p>

        {/* The sight. Small, and only a cross, because the aiming is the game. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="h-5 w-[2px] bg-white/70" />
          <div className="absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-white/70" />
        </div>

        {asking && (
          <Interlude
            reward="another arrow"
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
                {cleared ? `Round ${hud.round} done` : 'They got away'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {cleared
                  ? 'Next lot are higher and quicker.'
                  : `You got to round ${hud.round}, and scored ${hud.score}.`}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {cleared && <Btn onClick={onwards} tone="go">On to round {hud.round + 1}</Btn>}
                {over && <Btn onClick={again} tone="go">Start again</Btn>}
                {over && <Btn onClick={() => setAsking(true)}>Answer one for another go</Btn>}
                <Btn onClick={() => go('home')} tone="plain">Back</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1">
        <p className="text-center font-mono text-[0.65rem] uppercase tracking-widest text-dim/60">
          drag to look round · hold still to draw · let go to shoot
        </p>
      </div>
    </div>
  )
}
