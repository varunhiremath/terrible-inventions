import { useEffect, useRef, useState } from 'react'
import {
  CAR_LONG, CAR_WIDE, COUNTDOWN, LANES, LIGHTS, LIGHT_EVERY, MISSION_BONUS, SIGHT, LEVELS,
  DEFAULT_CAR, TANK, kmh, missionSays, levelFor,
} from '../road/level'
import {
  FIXED, STARTING_LIVES, ghostAt, missionMet, newRun, placeOf, resume, standings, step,
  type Entry,
  type Input, type RoadEvent, type Run, type Status, type Trail,
} from '../road/run'
import { createLatch, keyAt, padHeight, padLayout, type Button, type Key } from '../road/controls'
import { drawLights, drawPad, drawRun, type View } from '../road/draw'
import { playCue, setHeat } from '../music/player'
import type { CueName } from '../music/score'
import { createPacer } from '../arcade/pacing'
import { fill } from '../config/profile'
import { BackButton, Btn } from '../ui/bits'
import { LABELS, hintAlpha } from '../ui/padHints'
import { useStore } from '../store'
import { spareLives, tankScale } from '../workshop/kit'
import { Garage } from './Garage'
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
 * the model and tested on every level, because a wall of traffic across all
 * four lanes is not difficulty, it is a coin toss you lose.
 */
const MAX_CATCHUP = 0.25

/** What each thing that happens sounds like. */
const NOISE: Record<RoadEvent, CueName> = {
  pass: 'overtake',
  can: 'refuel',
  crash: 'prang',
  dry: 'prang',
  levelDone: 'arrive',
  skid: 'overtake',
  warn: 'warn',
  siren: 'siren',
  light: 'light',
  green: 'green',
}

/** Loudest thing first: one sound a frame, and never the overtake. */
const LOUDEST: RoadEvent[] =
  ['levelDone', 'crash', 'dry', 'green', 'light', 'warn', 'can', 'siren', 'pass', 'skid']
if (LOUDEST.length !== Object.keys(NOISE).length) {
  throw new Error('a road event with no place in the order')
}

interface Hud {
  level: number
  score: number
  speed: number
  fuel: number
  lives: number
  status: Status
  gone: number
  missionDone: boolean
  /** Where you are in the race, first being 1. */
  place: number
  /** Seconds since the lights, and the lights themselves. */
  clock: number
  countdown: number
}

/**
 * Probe hooks: `?level=4` starts there, `?sprint=1` makes the level 40 lengths.
 *
 * The finishing order only exists once somebody crosses the line, and crossing
 * the line takes a minute of driving that nothing but a person can do well.
 * A forty-length level takes six seconds, which is how the panel gets looked
 * at. Nothing in the app writes either of these and there is no way to them
 * from inside it.
 */
function opening(): { level: number; sprint: boolean } {
  const asked = new URLSearchParams(window.location.search)
  const level = Number(asked.get('level'))
  return {
    level: Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1,
    sprint: asked.get('sprint') === '1',
  }
}

function firstRun(stock: { lives: number; tank: number }, entry: Entry): Run {
  const from = opening()
  const run = withStock(newRun(from.level, STARTING_LIVES, 0, 1, entry), stock)
  return from.sprint ? { ...run, level: { ...run.level, distance: 40 } } : run
}

/** Whatever the workshop has sold him, applied to a fresh run. */
function withStock(run: Run, stock: { lives: number; tank: number }): Run {
  if (stock.lives === 0 && stock.tank === 1) return run
  return {
    ...run,
    lives: run.lives + stock.lives,
    tank: run.tank * stock.tank,
    fuel: run.fuel * stock.tank,
  }
}

export function Road() {
  const go = useStore((s) => s.go)
  const recordLap = useStore((s) => s.recordLap)
  const recordPlace = useStore((s) => s.recordPlace)
  const earn = useStore((s) => s.earn)
  const savedCar = useStore((s) => s.save.roadCar)
  const savedPlace = useStore((s) => s.save.roadPlace)
  const savedTwo = useStore((s) => s.save.roadTwoPlayer)
  const setTwo = useStore((s) => s.setTwoPlayer)
  /*
   * The car and the grid slot, read once when the screen opens.
   *
   * In a ref for the same reason the workshop's stock is: the loop lives
   * outside React, and a car that changed mid-race because the garage was
   * open in another tab would make a replay disagree with the race it
   * replayed.
   */
  const entry = useRef({ car: savedCar, started: savedPlace, twoPlayer: savedTwo ?? false })
  const pickCar = useStore((s) => s.pickCar)
  /*
   * The garage, open on the first visit and on request after that.
   *
   * Opened by default when nothing has been picked, because a choice nobody
   * is offered is not a choice — and closed for good afterwards, since being
   * asked which car you want every single time you open the road would get
   * old by the third race.
   */
  const [garage, setGarage] = useState(savedCar === undefined)
  const [car, setCar] = useState(savedCar ?? DEFAULT_CAR)
  const [twoPlayer, setTwoPlayer] = useState(savedTwo ?? false)
  const kit = useStore((s) => s.save.workshop)
  /*
   * What the workshop has bought, read once when a run starts.
   *
   * In a ref because the loop lives outside React, and captured rather than
   * watched: buying something mid-run and having it appear in your hands would
   * be odd, and there is no way to buy anything mid-run anyway.
   */
  const stock = useRef({ lives: 0, tank: 1 })
  /*
   * The drive to race against, if there is one for this level.
   *
   * In a ref for the same reason as everything else the loop needs: the loop
   * runs outside React. Re-read whenever a new best is set, so beating your
   * own time immediately gives you a quicker thing to chase.
   */
  const ghostRef = useRef<Record<number, Trail>>({})
  const bestSoFar = useStore((s) => s.save.roadBest)
  const ghosts = useStore((s) => s.save.roadGhost)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runRef = useRef<Run | null>(null)
  const padRef = useRef<Key[]>([])
  const padShape = useRef('')
  const hintsFrom = useRef(0)
  const clock = useRef(0)
  const buttons = useRef(createLatch())
  /*
   * A second set of buttons, for the person at the other end of the tablet.
   *
   * Kept apart from the first rather than shared, because a latch is a map
   * from pointer id to button and two people pressing "go" at once would
   * otherwise be one press. Which latch a finger belongs to is decided by
   * which half of the screen it landed on — see `readTouch`.
   */
  const buttons2 = useRef(createLatch())
  const padRef2 = useRef<Key[]>([])
  const [hud, setHud] = useState<Hud>({
    level: 1, score: 0, speed: 0, fuel: TANK, lives: 3, status: 'driving', gone: 0,
    missionDone: false, place: 1, clock: 0, countdown: 0,
  })
  /** Whether the lap just finished was the quickest one yet. */
  const [beatIt, setBeatIt] = useState(false)
  /*
   * The times to beat, in a ref as well as in the save.
   *
   * The drawing loop runs outside React and cannot read a hook that changes;
   * this is the same trick the pad uses. Written whenever a lap is recorded.
   */
  const bestRef = useRef<Record<number, number>>({})

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

    if (!runRef.current) runRef.current = firstRun(stock.current, entry.current)
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
        const held2 = buttons2.current.read()
        const input2: Input = {
          left: held2.left, right: held2.right, go: held2.go, brake: held2.brake,
        }
        // Which way you are steering, for your car's eyes to follow.
        const steerNow = (held.right ? 1 : 0) - (held.left ? 1 : 0)

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
          const after = step(s, input, FIXED, input2)
          if (after.events.length > 0) heard.push(...after.events)
          return after
        })
        if (stepped) {
          buttons.current.consumed()
          buttons2.current.consumed()
        }
        runRef.current = next

        if (heard.length > 0) {
          const loudest = LOUDEST.find((name) => heard.includes(name))
          if (loudest) playCue(NOISE[loudest])
        }

        /*
         * How tense the music is.
         *
         * Three things make a drive bad: being deep into the levels, being
         * down to your last car, and being nearly out of fuel. The worst of
         * the three wins, so the tune answers whichever is actually happening
         * rather than averaging them into nothing.
         */
        const deep = Math.min(1, (next.number - 1) / Math.max(1, LEVELS.length - 1))
        const thin = 1 - (next.lives - 1) / Math.max(1, STARTING_LIVES - 1)
        const dry = Math.max(0, 1 - next.fuel / (next.tank * 0.35))
        setHeat(Math.max(deep * 0.5 + (next.distance / next.level.distance) * 0.25, thin * 0.8, dry))

        const standing = placeOf(next)
        if (
          next.number !== hud.level || next.status !== hud.status ||
          Math.round(next.score) !== hud.score || Math.round(next.fuel) !== Math.round(hud.fuel) ||
          kmh(next.speed) !== hud.speed || next.lives !== hud.lives || standing !== hud.place ||
          Math.round(next.clock * 10) !== Math.round(hud.clock * 10) ||
          Math.ceil(next.countdown) !== Math.ceil(hud.countdown)
        ) {
          setHud({
            level: next.number,
            score: next.score,
            speed: kmh(next.speed),
            fuel: next.fuel,
            lives: next.lives,
            status: next.status,
            gone: next.distance,
            missionDone: next.missionDone,
            place: standing,
            clock: next.clock,
            countdown: next.countdown,
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
        /*
         * One half of the screen each, when there are two of you.
         *
         * The world is one world — one road, one set of traffic, one race —
         * and only the camera is doubled. Player two is driving one of the
         * field, so from the model's point of view nothing here is a second
         * player at all: it is the same run drawn twice, once from each car.
         *
         * Split down the middle rather than across, because a tablet is held
         * sideways and two people sit at the two ends of it, not one above
         * the other.
         */
        const twoUp = next.human !== null
        const halves = twoUp
          ? [
              { x: 0, w: w / 2, mine: 'you' as const },
              { x: w / 2, w: w / 2, mine: next.human as number },
            ]
          : [{ x: 0, w, mine: 'you' as const }]

        const depth = middle / SIGHT
        const longEnough = (CAR_LONG * depth) / (1.45 * CAR_WIDE)
        /*
         * The readouts size off your own half of the road.
         *
         * The fuel gauge stands on the verge beside it and the text is sized
         * to the lane width, so with the screen split they both belong to the
         * left-hand picture — which is the right answer, because the fuel is
         * yours and the other driver has none.
         */
        const hudW = twoUp ? w / 2 : w
        const lane = Math.min(hudW / (LANES + 1.4), longEnough)
        const left = (hudW - lane * LANES) / 2

        // Drawn between steps, so the road does not advance in sixty jerks.
        const distance = previous.distance + (next.distance - previous.distance) * alpha
        const at = previous.lane + (next.lane - previous.lane) * alpha
        const trail = ghostRef.current[next.number]
        const ghost = trail && next.countdown === 0 ? ghostAt(trail, next.clock) : null

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        for (const half of halves) {
          const lane = Math.min(half.w / (LANES + 1.4), longEnough)
          const driver =
            half.mine === 'you' ? null : next.racers.find((r) => r.id === half.mine) ?? null
          const view: View = {
            lane,
            depth,
            left: half.x + (half.w - lane * LANES) / 2,
            // He sits low, so almost all the screen is the road ahead of him.
            line: capH + middle * 0.82,
            distance: driver ? driver.y : distance,
            clock: clock.current,
          }

          ctx.save()
          ctx.beginPath()
          ctx.rect(half.x, capH, half.w, middle)
          ctx.clip()
          // The last three are which way you are steering — for the eyes —
          // where the best drive on this level had got to by now, and whose
          // half of the screen this is.
          drawRun(
            ctx, next, at, view, w, capH + middle,
            half.mine === 'you' ? steerNow : 0,
            // Only your own half races the ghost. Two pale cars on two halves
            // of one screen is a busy picture for a small gain.
            half.mine === 'you' ? ghost : null,
            half.mine,
          )
          ctx.restore()
        }

        // A hairline down the join, so the two pictures do not read as one.
        if (twoUp) {
          ctx.fillStyle = '#0d1016'
          ctx.fillRect(w / 2 - 1, capH, 2, middle)
        }

        ctx.fillStyle = '#0d1016'
        ctx.fillRect(0, 0, w, capH)
        ctx.fillRect(0, capH + middle, w, h - capH - middle)

        // --- the readings ----------------------------------------------------
        const gap = lane * 0.4
        const backRoom = 70 * (canvas.width / Math.max(1, canvas.clientWidth))
        const score = `${next.score}`.padStart(6, '0')
        const level = `LEVEL ${next.number}`
        const speed = `${kmh(next.speed)} KM/H`
        let text = Math.min(lane * 0.42, capH * 0.6)
        const fits = () => {
          ctx.font = `bold ${text}px ui-monospace, monospace`
          const side = Math.max(ctx.measureText(score).width, ctx.measureText(speed).width)
          return side * 2 + ctx.measureText(level).width + gap * 2 + backRoom * 2 <= w
        }
        while (text > 9 && !fits()) text -= 1

        ctx.fillStyle = '#eef2f8'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText(score, backRoom, capH / 2)
        ctx.textAlign = 'center'
        ctx.fillText(level, w / 2, capH / 2)
        ctx.textAlign = 'right'
        ctx.fillText(speed, w - gap, capH / 2)

        /*
         * The job, and how it is going.
         *
         * A level with only a distance to it is a treadmill. Saying what is
         * being asked, and counting it as you go, is what makes the last
         * stretch worth driving rather than just worth surviving.
         */
        const mission = next.level.mission
        const progress =
          mission.kind === 'pass' ? `${Math.min(next.passed, mission.count)}/${mission.count} PASSED`
          : mission.kind === 'cans' ? `${Math.min(next.cansTaken, mission.count)}/${mission.count} CANS`
          : next.pranged === 0 ? 'NO SCRATCHES YET' : 'SCRATCHED'
        ctx.font = `bold ${Math.max(9, text * 0.62)}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = missionMet(next) ? '#4ade80' : '#8a91ab'
        ctx.fillText(progress, w / 2, capH + text * 0.9)

        /*
         * Where you are in the race.
         *
         * Big, and on its own, because in a race it is the only number that
         * matters and it changes while you are looking at the road rather than
         * at the readout. Green while you are winning it.
         */
        /*
         * On a plate, and big enough to read without looking for it.
         *
         * It was already here — small, pale orange, tucked under the score —
         * and it was asked for again, which is the clearest possible report
         * that it was not being seen. So it gets a dark plate of its own, a
         * label, and twice the size: in a race the position is not one of the
         * readouts, it is the readout, and everything else on this bar is
         * detail by comparison.
         */
        const field = next.racers.length + 1
        const plateH = text * 2.1
        const plateW = text * 4.2
        const plateX = gap
        const plateY = capH + text * 0.55
        ctx.fillStyle = 'rgba(10,12,17,0.72)'
        ctx.beginPath()
        ctx.roundRect(plateX, plateY, plateW, plateH, text * 0.35)
        ctx.fill()
        ctx.strokeStyle = standing === 1 ? '#4ade80' : 'rgba(238,242,248,0.28)'
        ctx.lineWidth = Math.max(1.5, text * 0.09)
        ctx.stroke()

        ctx.textAlign = 'center'
        ctx.fillStyle = '#8a91ab'
        ctx.font = `bold ${Math.max(8, text * 0.48)}px ui-monospace, monospace`
        ctx.fillText('POSITION', plateX + plateW / 2, plateY + text * 0.45)

        ctx.font = `bold ${text * 1.15}px ui-monospace, monospace`
        ctx.fillStyle = standing === 1 ? '#4ade80' : standing <= 2 ? '#eef2f8' : '#ff9d7a'
        ctx.fillText(`${standing}/${field}`, plateX + plateW / 2, plateY + text * 1.42)
        ctx.textAlign = 'left'

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

        const share = Math.max(0, Math.min(1, next.fuel / next.tank))
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

        /*
         * The clock, under the mission line.
         *
         * Tenths, because a race is decided in them and because a number that
         * only moves once a second does not look like it is running.
         */
        const best = bestRef.current[next.number]
        const tenths = (seconds: number) => seconds.toFixed(1)
        ctx.font = `bold ${text * 0.95}px ui-monospace, monospace`
        ctx.textAlign = 'right'
        ctx.fillStyle = best !== undefined && next.clock > best ? '#ff9d7a' : '#eef2f8'
        ctx.fillText(`${tenths(next.clock)}s`, w - backRoom * 0.5, capH + text * 2.1)
        if (best !== undefined) {
          ctx.font = `bold ${text * 0.6}px ui-monospace, monospace`
          ctx.fillStyle = '#8a91ab'
          ctx.fillText(`BEST ${tenths(best)}`, w - backRoom * 0.5, capH + text * 3.1)
        }
        ctx.textAlign = 'left'

        // The lights, over the road, while they are on and for a moment after.
        if (next.countdown > 0 || next.clock < 0.9) {
          // One gantry over each road, so it hangs over a road rather than
          // over the line between two of them.
          for (const half of halves) {
            drawLights(
              ctx, next.countdown, LIGHTS, LIGHT_EVERY, w, capH, middle,
              half.x + half.w / 2,
            )
          }
        }

        padRef.current = padLayout(w, h, 0, twoUp ? w / 2 : w)
        padRef2.current = twoUp ? padLayout(w, h, w / 2, w / 2) : []
        const shape = `${twoUp}:${padRef.current.map((k) => k.id).join(',')}`
        if (shape !== padShape.current) {
          padShape.current = shape
          hintsFrom.current = clock.current
        }
        const hints = hintAlpha(clock.current - hintsFrom.current)
        drawPad(ctx, padRef.current, held as unknown as Record<string, boolean>, {
          alpha: hints,
          labels: LABELS.road,
        })
        if (twoUp) {
          drawPad(ctx, padRef2.current, held2 as unknown as Record<string, boolean>, {
            alpha: hints,
            labels: LABELS.road,
          })
        }
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

  /*
   * The times to beat, brought in from the save once.
   *
   * Into a ref as well as being read here, because the drawing loop runs
   * outside React and has to be able to print the target while you are
   * chasing it.
   */
  useEffect(() => {
    bestRef.current = { ...(bestSoFar ?? {}) }
  }, [bestSoFar])

  useEffect(() => {
    ghostRef.current = { ...(ghosts ?? {}) }
  }, [ghosts])

  useEffect(() => {
    stock.current = { lives: spareLives({ workshop: kit }), tank: tankScale({ workshop: kit }) }
  }, [kit])

  /*
   * With two of you, a crash does not stop the race.
   *
   * On your own a prang puts up a card, asks you something and hands your car
   * back — which is a good trade when the only clock running is yours. In a
   * race against somebody sitting next to you it would freeze their car too,
   * so the wreck is cleared and the road carries on. The life is still gone;
   * that is what the crash cost.
   */
  useEffect(() => {
    if (!twoPlayer || hud.status !== 'crashed' || hud.lives <= 0) return
    const timer = window.setTimeout(() => carryOn(false), 900)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoPlayer, hud.status, hud.lives])

  /** Coins for the drive, paid once, when the level is done or the cars run out. */
  const banked = useRef('')
  useEffect(() => {
    const run = runRef.current
    if (!run || (hud.status !== 'levelDone' && hud.status !== 'gameOver')) return
    const mark = `${run.number}:${hud.status}:${run.score}`
    if (banked.current === mark) return
    banked.current = mark
    earn(run.score)
  }, [hud.status, earn])

  /**
   * A finished lap, offered to the record book.
   *
   * Only once per finish — the status stays on `levelDone` while the panel is
   * up, and offering the same lap sixty times a second would be harmless but
   * would also mean the "your best yet" line flickered off after the first.
   */
  const logged = useRef('')
  useEffect(() => {
    const run = runRef.current
    if (hud.status !== 'levelDone' || !run || run.yourTime === null) return
    const mark = `${run.number}:${run.yourTime.toFixed(3)}`
    if (logged.current === mark) return
    logged.current = mark
    setBeatIt(recordLap(run.number, run.yourTime, run.trail))
    /*
     * And where he came, which is where the next grid puts him.
     *
     * Saved at the flag rather than when the next level starts, because the
     * next level might be tomorrow — and a grid that forgot yesterday's result
     * overnight would be the one thing this is meant not to do.
     */
    recordPlace(run.place)
    entry.current = { ...entry.current, started: run.place }
  }, [hud.status, recordLap, recordPlace])

  // --- the glass ------------------------------------------------------------
  /**
   * Which pad a finger landed on, and which button of it.
   *
   * With two people playing there are two pads side by side and two latches
   * behind them, so a press has to be routed as well as read. The half of the
   * screen decides, which is also how the two of them work out where to sit.
   */
  const readTouch = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width > 0 ? (canvasRef.current?.width ?? rect.width) / rect.width : 1
    const x = (e.clientX - rect.left) * scale
    const y = (e.clientY - rect.top) * scale
    const mid = (canvasRef.current?.width ?? 0) / 2
    const second = padRef2.current.length > 0 && x >= mid
    return {
      latch: second ? buttons2.current : buttons.current,
      key: keyAt(x, y, second ? padRef2.current : padRef.current),
    }
  }
  const onDown = (e: React.PointerEvent) => {
    const { latch, key } = readTouch(e)
    latch.press(e.pointerId, key)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const { latch, key } = readTouch(e)
    // Only a finger that is already down on this pad — a drag that started on
    // the other player's side stays theirs.
    if (!latch.has(e.pointerId)) return
    latch.press(e.pointerId, key)
  }
  const onUp = (e: React.PointerEvent) => {
    buttons.current.release(e.pointerId)
    buttons2.current.release(e.pointerId)
  }

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
      // Half a tank, not a full one. A full one handed back the whole fuel
      // problem every time a question came up, and fuel is supposed to bite.
      ? {
          ...back,
          fuel: Math.max(back.fuel, back.tank * 0.5),
          warned: false,
          lives: Math.min(STARTING_LIVES, back.lives + 1),
        }
      : back
    setHud((h) => ({ ...h, status: 'driving', lives: runRef.current!.lives }))
  }

  const nextLevel = () => {
    const run = runRef.current
    if (!run) return
    const number = run.number + 1
    // A level is not a fresh run: the lives and the tank carry from the last
    // one, so the workshop's stock is not handed out again at every flag.
    runRef.current = newRun(number, run.lives, run.score, run.seed, entry.current)
    setBeatIt(false)
    setHud((h) => ({ ...h, status: 'driving', level: number, clock: 0, countdown: COUNTDOWN }))
  }

  /**
   * Taking a different car out.
   *
   * It takes effect at the next set of lights rather than immediately: the
   * car you are driving cannot change halfway down a straight, and the garage
   * is only reachable from the flag or from the first visit anyway.
   */
  /**
   * Turning the second seat on or off.
   *
   * Like the car, it takes effect at the next set of lights: whether somebody
   * else is driving decides which of the field is under human control, and
   * that is settled when the grid is built.
   */
  const takeSecond = (on: boolean) => {
    setTwoPlayer(on)
    setTwo(on)
    entry.current = { ...entry.current, twoPlayer: on }
    rebuild()
  }

  const takeCar = (name: string) => {
    setCar(name)
    pickCar(name)
    entry.current = { ...entry.current, car: name }
    rebuild()
  }

  /** Rebuild the un-started run, so a change made in the garage is visible. */
  const rebuild = () => {
    const run = runRef.current
    // Before the first race there is a run already built with the old car in
    // it, and nothing has happened in it yet, so it is safe to rebuild.
    if (run && run.clock === 0 && run.distance === 0) {
      runRef.current = withStock(
        newRun(run.number, run.lives, run.score, run.seed, entry.current),
        stock.current,
      )
    }
  }

  const startOver = () => {
    runRef.current = newRun(1, STARTING_LIVES, 0, 1, entry.current)
    setHud({
      level: 1, score: 0, speed: 0, fuel: TANK, lives: 3, status: 'driving', gone: 0,
      missionDone: false, place: 1, clock: 0, countdown: 0,
    })
    setBeatIt(false)
  }

  /**
   * Whether the six written levels are behind you.
   *
   * Not "the last level" any more — there isn't one. It only decides which
   * thing {papa} says at the flag: getting to the end of the road he actually
   * built is worth a line, and everything past it is the road he didn't.
   */
  const clearedTheWritten = hud.level === LEVELS.length
  const outOfLives = hud.lives <= 0
  /*
   * A prang asks you something and puts you straight back on the road.
   *
   * Except when somebody else is racing you, because the card stops the whole
   * screen — and stopping the other person's race to ask you the capital of
   * Australia is not a thing a race does. With two of you, a crash costs what
   * a crash costs and the road carries on.
   */
  const asking = hud.status === 'crashed' && !outOfLives && !twoPlayer
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
        LEVEL {hud.level} SCORE {hud.score} SPEED {hud.speed} LIVES {hud.lives}{' '}
        FUEL {Math.round(hud.fuel)} PLACE {hud.place}{' '}
        {hud.countdown > 0 ? `LIGHTS ${Math.ceil(hud.countdown)}` : `TIME ${hud.clock.toFixed(1)}`}
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      </div>

      {garage && (
        <Garage
          picked={car}
          onPick={takeCar}
          onClose={() => setGarage(false)}
          twoPlayer={twoPlayer}
          onTwoPlayer={takeSecond}
        />
      )}

      <BackButton onClick={() => go('home')} />

      {asking && <Interlude onDone={carryOn} reward="your car back, and half a tank" />}

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
              {hud.status === 'levelDone' && clearedTheWritten
                ? 'Every road I own, and you drove the lot of them. Fine. I will build more.'
                : hud.status === 'levelDone'
                  ? 'Through already? There is more road. There is always more road.'
                  : outOfLives
                    ? 'Out of cars. Back to the start of the motorway with you.'
                    : 'A prang. I told you I built these myself.'}
            </p>

            {hud.status === 'levelDone' && (
              <p className={`mt-3 font-mono text-xs font-bold uppercase tracking-[0.2em] ${
                hud.missionDone ? 'text-moss' : 'text-dim'
              }`}>
                {hud.missionDone
                  ? `${missionSays(levelFor(hud.level).mission)} — done. ${MISSION_BONUS} bonus.`
                  : `${missionSays(levelFor(hud.level).mission)} — not this time.`}
              </p>
            )}

            {/*
              * The finishing order.
              *
              * The whole reason the field is there. A level that ends with a
              * distance and a bonus is a level you survived; one that ends
              * with four names and yours somewhere among them is one you
              * either won or did not.
              */}
            {hud.status === 'levelDone' && runRef.current && (() => {
              const order = standings(runRef.current)
              const winner = order[0].at
              return (
                <>
                  <ol className="mt-3 flex flex-col gap-1 short:mt-2 short:gap-0.5">
                    {order.map((row, i) => (
                      <li
                        key={row.name}
                        className={`flex items-baseline justify-between rounded-lg px-2 py-1 font-mono text-xs
                                    uppercase tracking-[0.15em] short:py-0.5 ${
                          row.you ? 'bg-bolt/15 text-bolt' : row.friend ? 'bg-sky/15 text-sky' : 'text-dim'
                        }`}
                      >
                        <span>
                          <span className="mr-2 tabular-nums">{i + 1}</span>
                          {row.name}
                        </span>
                        {/*
                          * The winner's time, and everybody else's gap to it,
                          * which is how a result is read everywhere else in
                          * the world. A tilde on the ones still out on the
                          * road when you crossed: their time is worked out
                          * from where they had got to, because the level ends
                          * when you finish and they genuinely had not.
                          */}
                        <span className="tabular-nums">
                          {i === 0
                            ? `${row.at.toFixed(2)}s`
                            : `${row.estimated ? '~' : ''}+${(row.at - winner).toFixed(2)}s`}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <p className={`mt-2 font-mono text-xs font-bold uppercase tracking-[0.2em] short:mt-1 ${
                    beatIt ? 'text-moss' : 'text-dim'
                  }`}>
                    {beatIt
                      ? `Your best yet — ${(hud.clock).toFixed(2)}s. Race it next time.`
                      : bestRef.current[hud.level] !== undefined
                        ? `Best here: ${bestRef.current[hud.level].toFixed(2)}s — the pale car is it`
                        : 'No time to beat here yet'}
                  </p>
                </>
              )
            })()}

            <div className="mt-5 flex flex-col gap-2">
              {hud.status === 'levelDone' && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">
                  On to level {hud.level + 1}
                </Btn>
              )}
              {hud.status === 'levelDone' && (
                <Btn onClick={() => setGarage(true)}>Change car</Btn>
              )}
              {outOfLives && (
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
