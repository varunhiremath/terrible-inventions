import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BELT, LIVES, middleOf } from '../outpost/level'
import {
  FIXED, LOUDEST, newRun, nextMission, serve, standing, step, stillNeeds,
  type Input, type OutpostEvent, type Run, type Status,
} from '../outpost/run'
import { buildOutpost, type Outpost as World } from '../outpost/scene'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { BackButton, Btn } from '../ui/bits'
import { useStore } from '../store'
import { spareLives } from '../workshop/kit'
import { Interlude } from './Interlude'
import { fill } from '../config/profile'

/**
 * The outpost.
 *
 * The second game here you are inside of, and the first you can walk around
 * in — which is the whole of the difficulty, because walking around needs two
 * thumbs and a phone only has so much screen.
 *
 * So: a stick under your left thumb that is wherever you put your thumb down,
 * the whole right-hand side of the picture to look with, and a trigger at the
 * bottom right. All three are drawn on the screen, because the rule in this
 * project is that a control nobody can see is a control nobody has — swipe
 * and arrow keys both worked in a build of the maze that was unplayable for
 * exactly that reason.
 *
 * And an arrow at the top pointing at whatever you are supposed to be doing.
 * A dark compound with eleven ways out of every yard is atmospheric for about
 * ninety seconds and then it is just lost, and being lost is not the game.
 */

const MAX_CATCHUP = 0.25

const NOISE: Record<OutpostEvent, CueName> = {
  fire: 'rifle',
  hit: 'spang',
  down: 'toppled',
  bolt: 'sizzle',
  hurt: 'winded',
  spotted: 'seen',
  pick: 'fuse',
  refused: 'locked',
  open: 'unlocked',
  done: 'liftOff',
  over: 'missionOver',
}

/** Pixels of wander before a touch on the view counts as looking. */
const WANDER = 5
/** How far a drag turns you: a full screen width is most of the way round. */
const TURN = 2.9
/** How far the stick has to go for full tilt, as a share of the screen's width. */
const STICK = 0.17

interface Hud {
  mission: number
  score: number
  lives: number
  left: number
  wants: number
  short: number
  belt: number[]
  open: boolean
  status: Status
  /** Which way to go, in radians off where you are looking. */
  bearing: number
  away: number
}

export function Outpost() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const runRef = useRef<Run | null>(null)
  const worldRef = useRef<World | null>(null)
  const builtFor = useRef(0)
  const aim = useRef({ yaw: 0, pitch: 0 })
  const stick = useRef({ id: -1, fromX: 0, fromY: 0, x: 0, y: 0, live: false })
  const eyes = useRef({ id: -1, x: 0, y: 0, moved: false })
  const trigger = useRef(false)
  const keys = useRef<Set<string>>(new Set())
  const spare = useRef(0)
  const shown = useRef<Hud | null>(null)
  const go = useStore((s) => s.go)
  const kit = useStore((s) => s.save.workshop)

  const [hud, setHud] = useState<Hud>({
    mission: 1, score: 0, lives: LIVES, left: 0, wants: 0, short: 0, belt: [],
    open: false, status: 'playing', bearing: 0, away: 0,
  })
  const [asking, setAsking] = useState(false)
  const [stickAt, setStickAt] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null)

  useEffect(() => { spare.current = spareLives({ workshop: kit }) }, [kit])

  useEffect(() => {
    const mount = wrapRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    /*
     * Tone mapping and the right colour space, which at night is the whole
     * difference between a compound and a dark grey rectangle: without them
     * every lamp clips to white and everything else is mud.
     */
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.3
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none'
    mount.appendChild(renderer.domElement)

    if (!runRef.current) runRef.current = newRun(1, LIVES + spare.current)
    aim.current.yaw = runRef.current.yaw

    /** The compound is built from the map, so a new mission is a new world. */
    const build = () => {
      const run = runRef.current
      if (!run) return
      worldRef.current?.dispose()
      const world = buildOutpost(run, mount.clientWidth || 1, mount.clientHeight || 1)
      worldRef.current = world
      builtFor.current = run.mission
      world.resize(mount.clientWidth || 1, mount.clientHeight || 1)
    }
    build()

    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      worldRef.current?.resize(w, h)
    }
    resize()
    const watching = new ResizeObserver(resize)
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
      const world = worldRef.current
      if (run && world) {
        if (builtFor.current !== run.mission) build()

        const down = keys.current
        const keyWalk = (down.has('w') || down.has('ArrowUp') ? 1 : 0) +
          (down.has('s') || down.has('ArrowDown') ? -1 : 0)
        const keySide = (down.has('d') ? 1 : 0) + (down.has('a') ? -1 : 0)
        if (down.has('ArrowLeft')) aim.current.yaw -= elapsed * 1.8
        if (down.has('ArrowRight')) aim.current.yaw += elapsed * 1.8

        const input: Input = {
          yaw: aim.current.yaw,
          pitch: aim.current.pitch,
          walk: stick.current.live ? stick.current.y : keyWalk,
          side: stick.current.live ? stick.current.x : keySide,
          firing: trigger.current || down.has(' '),
        }

        const heard: OutpostEvent[] = []
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

        // How tense: how close you are to being finished, and how awake the
        // compound is.
        const awake = next.machines.some((m) => !m.down && m.alert > 0.3)
        const hurt = 1 - (next.lives - 1) / Math.max(1, LIVES - 1)
        setHeat(Math.min(1, Math.max(hurt * 0.7, awake ? 0.7 : 0.25)))

        // Which way to whatever is next.
        const goal = next.friend ? middleOf(next.map.pad) : middleOf(next.map.cage)
        const toward = Math.atan2(goal.x - next.x, -(goal.z - next.z))
        let bearing = toward - next.yaw
        while (bearing > Math.PI) bearing -= Math.PI * 2
        while (bearing < -Math.PI) bearing += Math.PI * 2

        const fresh: Hud = {
          mission: next.mission,
          score: next.score,
          lives: next.lives,
          left: standing(next),
          wants: next.wants,
          short: stillNeeds(next),
          belt: next.belt,
          open: next.open,
          status: next.status,
          bearing,
          away: Math.hypot(goal.x - next.x, goal.z - next.z),
        }
        const was = shown.current
        if (
          was === null || was.status !== fresh.status || was.score !== fresh.score ||
          was.lives !== fresh.lives || was.left !== fresh.left || was.open !== fresh.open ||
          was.short !== fresh.short || was.belt.length !== fresh.belt.length ||
          Math.abs(was.bearing - fresh.bearing) > 0.05 || Math.abs(was.away - fresh.away) > 0.5
        ) {
          shown.current = fresh
          setHud(fresh)
        }

        world.update(next, clock)
        renderer.render(world.scene, world.camera)
      }

      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      watching.disconnect()
      setHeat(0)
      worldRef.current?.dispose()
      worldRef.current = null
      renderer.dispose()
      renderer.domElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- thumbs ---------------------------------------------------------------

  const down = (e: React.PointerEvent) => {
    if (asking || hud.status !== 'playing') return
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    /*
     * The left-hand bottom corner is the stick and everything else is looking.
     * The stick appears where the thumb lands rather than sitting in one spot:
     * a fixed stick means finding it without looking, and nobody looks.
     */
    if (x < box.width * 0.45 && y > box.height * 0.42 && !stick.current.live) {
      stick.current = { id: e.pointerId, fromX: x, fromY: y, x: 0, y: 0, live: true }
      setStickAt({ x, y, dx: 0, dy: 0 })
      return
    }
    eyes.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
  }

  const move = (e: React.PointerEvent) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return

    if (stick.current.live && e.pointerId === stick.current.id) {
      const span = box.width * STICK
      const dx = (e.clientX - box.left) - stick.current.fromX
      const dy = (e.clientY - box.top) - stick.current.fromY
      const far = Math.hypot(dx, dy)
      const pull = far > span ? span / far : 1
      stick.current.x = (dx * pull) / span
      stick.current.y = (-dy * pull) / span
      setStickAt({ x: stick.current.fromX, y: stick.current.fromY, dx: dx * pull, dy: dy * pull })
      return
    }

    if (e.pointerId !== eyes.current.id) return
    const dx = e.clientX - eyes.current.x
    const dy = e.clientY - eyes.current.y
    if (!eyes.current.moved && Math.hypot(dx, dy) > WANDER) eyes.current.moved = true
    if (eyes.current.moved) {
      const wide = box.width || 1
      aim.current.yaw += (dx / wide) * TURN
      aim.current.pitch = Math.max(-0.7, Math.min(0.7, aim.current.pitch - (dy / wide) * TURN))
    }
    eyes.current.x = e.clientX
    eyes.current.y = e.clientY
  }

  const up = (e: React.PointerEvent) => {
    if (e.pointerId === stick.current.id) {
      stick.current = { id: -1, fromX: 0, fromY: 0, x: 0, y: 0, live: false }
      setStickAt(null)
    }
    if (e.pointerId === eyes.current.id) eyes.current = { id: -1, x: 0, y: 0, moved: false }
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

  // --- between missions ------------------------------------------------------

  const keep = (next: Hud): Hud => {
    shown.current = next
    return next
  }

  const carryOn = () => {
    const run = runRef.current
    if (!run) return
    runRef.current = serve(run)
    setAsking(false)
    setHud((h) => keep({ ...h, status: 'playing', lives: Math.max(1, h.lives) }))
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
    const after = nextMission(run)
    runRef.current = after
    aim.current.yaw = after.yaw
    aim.current.pitch = 0
    setHud((h) => keep({
      ...h, status: 'playing', mission: after.mission, wants: after.wants,
      belt: [], open: false, left: standing(after), short: after.wants,
    }))
  }

  const again = () => {
    const fresh = newRun(1, LIVES + spare.current)
    runRef.current = fresh
    aim.current.yaw = fresh.yaw
    aim.current.pitch = 0
    setAsking(false)
    setHud(keep({
      mission: 1, score: 0, lives: fresh.lives, left: standing(fresh), wants: fresh.wants,
      short: fresh.wants, belt: [], open: false, status: 'playing', bearing: 0, away: 0,
    }))
  }

  const done = hud.status === 'done'
  const over = hud.status === 'over'
  const chevron = `rotate(${(hud.bearing * 180) / Math.PI}deg)`

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-ink">
      <BackButton onClick={() => go('home')} />
      <div className="flex shrink-0 items-center gap-2 py-2 pl-20 pr-3">
        <p className="font-mono text-xs font-bold tabular-nums tracking-widest text-chalk">
          {String(hud.score).padStart(6, '0')}
        </p>
        <p className="ml-auto font-mono text-[0.68rem] tabular-nums text-dim">
          mission {hud.mission} · {hud.left} up
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
          * The lock, over the picture.
          *
          * The whole of the arithmetic is in this line: what the door wants,
          * what is on your belt, and — the part that does the teaching — the
          * number you are still short. A door that only says "no" teaches
          * nothing; one that says "you have nine, find six" sends a
          * nine-year-old back out into the dark looking for a six.
          */}
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex flex-col items-center gap-1">
          {!hud.open ? (
            <>
              <p className="font-mono text-sm font-bold tracking-[0.18em] text-chalk drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                CAGE NEEDS {hud.wants}
              </p>
              <div className="flex items-center gap-1.5">
                {hud.belt.length === 0 && (
                  <span className="font-mono text-[0.65rem] uppercase tracking-widest text-dim">
                    no fuses yet
                  </span>
                )}
                {hud.belt.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="rounded-md border border-moss/60 bg-moss/15 px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-moss"
                  >
                    {n}
                  </span>
                ))}
                {hud.short > 0 && hud.belt.length > 0 && (
                  <span className="ml-1 font-mono text-xs font-bold text-bolt">
                    find {hud.short}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="font-mono text-sm font-bold tracking-[0.18em] text-moss drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              GET HER TO THE CHOPPER
            </p>
          )}
          {/* Which way, and how far. */}
          <div className="mt-0.5 flex items-center gap-1.5 opacity-80">
            <span
              className="inline-block font-mono text-sm text-bolt"
              style={{ transform: chevron }}
            >
              ▲
            </span>
            <span className="font-mono text-[0.65rem] tabular-nums text-dim">
              {Math.round(hud.away)}m
            </span>
          </div>
        </div>

        {/* The sight. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-[2px] bg-white/70" />
          <div className="absolute left-1/2 top-1/2 h-[2px] w-4 -translate-x-1/2 -translate-y-1/2 bg-white/70" />
        </div>

        {/* The stick, where your thumb put it. */}
        {stickAt && (
          <div
            className="pointer-events-none absolute z-10 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-chalk/25 bg-ink/30"
            style={{ left: stickAt.x, top: stickAt.y }}
          >
            <div
              className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-chalk/60 bg-chalk/25"
              style={{ transform: `translate(calc(-50% + ${stickAt.dx}px), calc(-50% + ${stickAt.dy}px))` }}
            />
          </div>
        )}

        {/* And the trigger, which is a button because a button is a thing you
            can see. */}
        <button
          type="button"
          aria-label="Fire"
          className="absolute bottom-4 right-4 z-20 h-20 w-20 rounded-full border-2 border-rust/70 bg-rust/25 font-mono text-xs font-bold uppercase tracking-widest text-chalk active:bg-rust/50"
          onPointerDown={(e) => { e.stopPropagation(); trigger.current = true }}
          onPointerUp={(e) => { e.stopPropagation(); trigger.current = false }}
          onPointerLeave={() => { trigger.current = false }}
          onPointerCancel={() => { trigger.current = false }}
        >
          Fire
        </button>

        {asking && (
          <Interlude
            reward="another go"
            lastChance={hud.lives <= 0}
            onDone={(right) => { if (right) carryOn(); else spendLife() }}
          />
        )}

        {(done || over) && !asking && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="block-panel w-full max-w-sm p-5 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
                {done ? `Mission ${hud.mission} done` : 'They got you'}
              </p>
              <p className="mt-2 text-lg font-bold text-chalk">
                {done
                  ? 'She is on the chopper. Next one is bigger.'
                  : `You got to mission ${hud.mission}, and scored ${hud.score}.`}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {done && <Btn onClick={onwards} tone="go">On to mission {hud.mission + 1}</Btn>}
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
          left thumb to walk · drag to look · fire to shoot ·{' '}
          {hud.open ? `follow ${fill('{kid}')} home` : `${BELT} fuses on the belt`}
        </p>
      </div>
    </div>
  )
}
