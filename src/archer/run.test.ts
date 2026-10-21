import { describe, expect, it } from 'vitest'
import {
  DRAW_TIME, ESCAPE_Y, EYE, FAR, GRAVITY, NEAR,
  arrowSpeed, biggest, fits, needFor, newBalloon, reachFor, ruleFor, ruleSays,
  type Balloon, type Dice, type Rule,
} from './level'
import {
  FIXED, NO_INPUT, aimFor, crosses, facing, newRun, step, type Input, type Run,
} from './run'

/**
 * The meadow.
 *
 * The thing worth pinning here is that the shooting is honest. An arrow that
 * quietly steers towards a balloon, or a hit test that only notices when the
 * arrow happens to stop inside one, would both look exactly like this game and
 * would both be teaching a nine-year-old that aiming does not work. So: the
 * flight is checked against the arithmetic of a thrown object, the hit test is
 * checked at full speed where the gaps between frames are biggest, and a bot
 * aims with the schoolbook answer and has to land its shots.
 */

function dice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return { next, int, pick: (items) => items[int(0, items.length - 1)] }
}

const drive = (run: Run, seconds: number, input: Input = NO_INPUT): Run => {
  let now = run
  for (let i = 0; i < Math.round(seconds / FIXED); i++) {
    if (now.status !== 'playing') break
    now = step(now, input, FIXED)
  }
  return now
}

/**
 * Everything that happened along the way, because `run.events` is only ever the
 * last step's — a noise that fired two seconds ago is not in it.
 */
function heard(run: Run, seconds: number, input: Input = NO_INPUT): string[] {
  const all: string[] = []
  let now = run
  for (let i = 0; i < Math.round(seconds / FIXED); i++) {
    if (now.status !== 'playing') break
    now = step(now, input, FIXED)
    all.push(...now.events)
  }
  return all
}

/** A run with an empty sky and nothing arriving, so a test owns what is up there. */
const empty = (set: Partial<Run> = {}): Run => ({
  ...newRun(1),
  balloons: [],
  arrows: [],
  bursts: [],
  nextIn: 9999,
  ...set,
})

const balloon = (set: Partial<Balloon> = {}): Balloon => ({
  id: 1, x: 0, y: 6, z: -18, rise: 0, driftX: 0, driftZ: 0,
  number: 4, wanted: true, tint: '#ff5f7a', sway: 0, ...set,
})

/** Hold the string for `seconds`, then let go, looking this way. */
function shoot(run: Run, yaw: number, pitch: number, seconds = DRAW_TIME): Run {
  const pulled = drive(run, seconds, { yaw, pitch, pulling: true })
  return step(pulled, { yaw, pitch, pulling: false }, FIXED)
}

describe('the bow', () => {
  it('pulls over about half a second and looses when you let go', () => {
    const half = drive(empty(), DRAW_TIME / 2, { ...NO_INPUT, pulling: true })
    expect(half.draw).toBeGreaterThan(0.4)
    expect(half.draw).toBeLessThan(0.6)
    expect(half.arrows).toHaveLength(0)

    const loosed = step(half, NO_INPUT, FIXED)
    expect(loosed.arrows).toHaveLength(1)
    expect(loosed.draw).toBe(0)
    expect(loosed.events).toContain('loose')
  })

  it('sends a harder arrow for a longer pull', () => {
    const quick = shoot(empty(), 0, 0, 0.1).arrows[0]
    const full = shoot(empty(), 0, 0, DRAW_TIME).arrows[0]
    const speedOf = (a: typeof quick) => Math.hypot(a.vx, a.vy, a.vz)
    expect(speedOf(full)).toBeGreaterThan(speedOf(quick) * 1.3)
    expect(speedOf(full)).toBeCloseTo(arrowSpeed(1), 1)
  })

  it('sends it where you are looking, not where you were', () => {
    const north = shoot(empty(), 0, 0).arrows[0]
    const east = shoot(empty(), Math.PI / 2, 0).arrows[0]
    expect(north.vz).toBeLessThan(-20)
    expect(Math.abs(north.vx)).toBeLessThan(0.001)
    expect(east.vx).toBeGreaterThan(20)
    expect(Math.abs(east.vz)).toBeLessThan(0.001)
  })

  it('leaves from where your eyes are', () => {
    const arrow = shoot(empty(), 0, 0).arrows[0]
    expect(arrow.y).toBeGreaterThan(EYE - 0.5)
    expect(arrow.y).toBeLessThan(EYE + 0.5)
  })
})

describe('an arrow in flight', () => {
  it('falls the whole way, like anything else thrown', () => {
    const run = shoot(empty(), 0, 0)
    const after = drive(run, 0.5)
    const arrow = after.arrows[0]
    expect(arrow, 'still flying').toBeTruthy()
    // Down by about half g t², allowing for the step it was fired on.
    const fell = EYE - arrow.y
    expect(fell).toBeGreaterThan(0.5 * GRAVITY * 0.45 * 0.45)
    expect(fell).toBeLessThan(0.5 * GRAVITY * 0.55 * 0.55)
  })

  it('sticks in the grass when it comes down, and is cleared away after', () => {
    const run = shoot(empty(), 0, -0.2)
    const landed = drive(run, 1.2)
    expect(landed.arrows[0]?.stuck).toBe(true)
    expect(landed.arrows[0]?.y).toBeLessThan(0.2)
    const later = drive(landed, 3)
    expect(later.arrows).toHaveLength(0)
  })

  it('is never steered towards anything', () => {
    /*
     * The one thing that would quietly ruin this game. A balloon put exactly
     * where a deliberately bad shot is going must not move the arrow, and the
     * arrow must miss.
     */
    const aside = empty({ balloons: [balloon({ x: 14, y: 8, z: -2 })] })
    const shot = shoot(aside, 0, 0)
    const after = drive(shot, 1.2)
    expect(after.balloons, 'the balloon is untouched').toHaveLength(1)
    const arrow = after.arrows[0]
    if (arrow) expect(Math.abs(arrow.x)).toBeLessThan(0.5)
  })
})

describe('hitting a balloon', () => {
  it('pops one that the arrow passes through', () => {
    const run = empty({ balloons: [balloon({ x: 0, y: EYE, z: -12 })] })
    const after = drive(shoot(run, 0, 0.05), 1)
    expect(after.balloons).toHaveLength(0)
    expect(after.bursts.length).toBeGreaterThan(0)
    expect(after.got).toBe(1)
  })

  it('notices a hit that happens between two frames', () => {
    /*
     * At full draw an arrow moves about forty centimetres in a frame, and a
     * balloon is a metre and a quarter across — so asking "is the arrow inside
     * one now" drops shots whenever the frames land either side of it. What is
     * asked is whether the line it travelled went through, which this checks
     * with a step long enough to jump a balloon entirely.
     */
    const far = { x: 0, y: 2, z: -20 }
    const run = empty({
      balloons: [balloon({ ...far })],
      arrows: [{ id: 99, x: 0, y: 2, z: -14, vx: 0, vy: 0, vz: -60, age: 0, stuck: false }],
    })
    const after = step(run, NO_INPUT, 0.2)
    expect(after.balloons, 'the arrow went through it in one step').toHaveLength(0)
  })

  it('knows a near miss from a hit', () => {
    const at = { x: 0, y: 2, z: -20 }
    // How near counts, at this balloon's range: the forgiveness is an angle,
    // so it is not the same number for a near one and a far one.
    const reach = reachFor(Math.hypot(at.x, at.y - EYE, at.z))
    expect(crosses(0, 2, -14, 0, 2, -26, at), 'straight through').toBe(true)
    expect(crosses(reach * 0.8, 2, -14, reach * 0.8, 2, -26, at), 'clipped it').toBe(true)
    expect(crosses(reach * 1.4, 2, -14, reach * 1.4, 2, -26, at), 'past it').toBe(false)
    expect(crosses(0, 2, -14, 0, 2, -18, at), 'stopped short').toBe(false)
  })

  it('spends the arrow on the first thing it meets, never two', () => {
    const run = empty({
      balloons: [
        balloon({ id: 1, x: 0, y: 2, z: -14 }),
        balloon({ id: 2, x: 0, y: 2, z: -18 }),
      ],
      arrows: [{ id: 99, x: 0, y: 2, z: -10, vx: 0, vy: 0, vz: -60, age: 0, stuck: false }],
    })
    const after = step(run, NO_INPUT, 0.2)
    expect(after.balloons).toHaveLength(1)
    expect(after.balloons[0].id, 'the near one went').toBe(2)
  })
})

describe('what the round is asking for', () => {
  it('counts only the wanted ones towards the round', () => {
    const run = empty({
      balloons: [balloon({ number: 7, wanted: false, x: 0, y: EYE, z: -12 })],
    })
    const shot = shoot(run, 0, 0.05)
    const said = heard(shot, 1)
    const after = drive(shot, 1)
    expect(after.balloons).toHaveLength(0)
    expect(after.got, 'a decoy is not progress').toBe(0)
    expect(said).toContain('wrong')
    expect(after.score, 'but it is not a punishment either').toBeGreaterThan(0)
  })

  it('costs a life when a wanted one gets away, and nothing when a decoy does', () => {
    const wanted = empty({
      lives: 3,
      balloons: [balloon({ y: ESCAPE_Y - 0.05, rise: 1, wanted: true })],
    })
    const said = heard(wanted, 0.4)
    const after = drive(wanted, 0.4)
    expect(after.lives).toBe(2)
    expect(after.gone).toBe(1)
    expect(said).toContain('escape')

    const decoy = empty({
      lives: 3,
      balloons: [balloon({ y: ESCAPE_Y - 0.05, rise: 1, wanted: false })],
    })
    const quiet = drive(decoy, 0.4)
    expect(quiet.lives).toBe(3)
    expect(quiet.balloons, 'it still goes, it just costs nothing').toHaveLength(0)
  })

  it('reads a rule the same way it writes it', () => {
    const rules: Rule[] = [
      { kind: 'even' }, { kind: 'odd' }, { kind: 'over', n: 9 },
      { kind: 'under', n: 7 }, { kind: 'times', n: 4 },
    ]
    for (const rule of rules) expect(ruleSays(rule).length).toBeGreaterThan(8)
    expect(fits({ kind: 'even' }, 8)).toBe(true)
    expect(fits({ kind: 'even' }, 7)).toBe(false)
    expect(fits({ kind: 'odd' }, 7)).toBe(true)
    expect(fits({ kind: 'over', n: 9 }, 10)).toBe(true)
    expect(fits({ kind: 'over', n: 9 }, 9)).toBe(false)
    expect(fits({ kind: 'under', n: 7 }, 6)).toBe(true)
    expect(fits({ kind: 'times', n: 4 }, 12)).toBe(true)
    expect(fits({ kind: 'times', n: 4 }, 14)).toBe(false)
  })

  it('puts enough of what it asked for in the sky to be gettable', () => {
    /*
     * The trap in generating a number and seeing what it turns out to be: on
     * the sevens, one balloon in seven would be worth shooting and the round
     * would be unplayable. `newBalloon` decides whether it is wanted first.
     */
    for (const round of [1, 3, 6, 9, 14]) {
      const rng = dice(round * 31)
      const rule = ruleFor(round, rng)
      const sky = Array.from({ length: 300 }, (_, i) => newBalloon(i, round, rule, rng))
      const share = sky.filter((one) => one.wanted).length / sky.length
      expect(share, `${ruleSays(rule)} on round ${round}`).toBeGreaterThan(0.4)
      expect(share).toBeLessThan(0.7)
      for (const one of sky) {
        expect(one.wanted).toBe(fits(rule, one.number))
        expect(one.number).toBeGreaterThan(0)
        expect(one.number).toBeLessThanOrEqual(biggest(round))
        const away = Math.hypot(one.x, one.z)
        expect(away).toBeGreaterThanOrEqual(NEAR - 0.001)
        expect(away).toBeLessThanOrEqual(FAR + 0.001)
      }
    }
  })

  it('comes from every direction, which is what the looking is for', () => {
    const rng = dice(7)
    const rule = ruleFor(1, rng)
    const angles = Array.from({ length: 200 }, (_, i) => {
      const one = newBalloon(i, 1, rule, rng)
      return Math.atan2(one.z, one.x)
    })
    // Four quarters of the compass, all used.
    const quarters = new Set(angles.map((a) => Math.floor(((a + Math.PI) / (Math.PI * 2)) * 4)))
    expect(quarters.size).toBe(4)
  })
})

describe('a round', () => {
  it('is done when enough of the wanted ones are popped', () => {
    const run = { ...empty({ need: 2 }), got: 1 }
    const one = empty({
      ...run,
      balloons: [balloon({ x: 0, y: EYE, z: -12 })],
      need: 2,
      got: 1,
    })
    const after = drive(shoot(one, 0, 0.05), 1)
    expect(after.status).toBe('cleared')
    expect(after.events).toContain('cleared')
  })

  it('asks for more as the rounds go on, and names a harder rule', () => {
    for (let round = 2; round <= 20; round++) {
      expect(needFor(round)).toBeGreaterThan(needFor(round - 1))
      expect(biggest(round)).toBeGreaterThanOrEqual(biggest(round - 1))
    }
    expect(ruleFor(1, dice(1))).toEqual({ kind: 'even' })
    const late = Array.from({ length: 40 }, (_, i) => ruleFor(9, dice(i + 1)))
    expect(late.some((rule) => rule.kind === 'times'), 'tables turn up later on').toBe(true)
  })

  it('ends the run when the last life goes', () => {
    const run = empty({
      lives: 1,
      balloons: [balloon({ y: ESCAPE_Y - 0.05, rise: 1, wanted: true })],
    })
    const after = drive(run, 0.4)
    expect(after.status).toBe('over')
    expect(after.events).toContain('over')
  })
})

describe('the simulation itself', () => {
  it('plays the same way twice from the same seed', () => {
    const go = () => drive(newRun(3, 3, 0, 4242), 6, { yaw: 0.4, pitch: 0.2, pulling: true })
    const once = go()
    const twice = go()
    expect(twice.score).toBe(once.score)
    expect(twice.balloons.map((b) => b.number)).toEqual(once.balloons.map((b) => b.number))
  })

  it('keeps the sky full without filling it', () => {
    const after = drive(newRun(6), 40, { yaw: 0, pitch: 0.1, pulling: false })
    expect(after.balloons.length).toBeGreaterThan(2)
    expect(after.balloons.length).toBeLessThanOrEqual(12)
  })

  it('stops stepping once it is over', () => {
    const over = { ...empty({ lives: 0, status: 'over' as const }), score: 70 }
    const after = step(over, NO_INPUT, FIXED)
    expect(after.score).toBe(70)
    expect(after.clock).toBe(over.clock)
    expect(after.events).toHaveLength(0)
  })

  it('looks where it is told', () => {
    const north = facing(0, 0)
    expect(north.z).toBeCloseTo(-1, 6)
    const east = facing(Math.PI / 2, 0)
    expect(east.x).toBeCloseTo(1, 6)
    const up = facing(0, Math.PI / 2)
    expect(up.y).toBeCloseTo(1, 6)
  })
})

describe('aiming', () => {
  /*
   * The bot. It works out the angle the schoolbook gives for a thrown object
   * and shoots at it — and if the flight in `step` were not an honest
   * projectile, or the hit test were not honest either, none of these would
   * land. It is the test that proves the game is playable at all.
   */
  function snipe(at: { x: number; y: number; z: number }): boolean {
    const away = Math.hypot(at.x, at.z)
    const speed = arrowSpeed(1)
    const lift = aimFor(away, at.y - EYE, speed)
    if (lift === null) return false

    const yaw = Math.atan2(at.x, -at.z)
    let run = empty({ balloons: [balloon({ ...at, rise: 0 })] })
    run = shoot(run, yaw, lift)
    run = drive(run, 3)
    return run.balloons.length === 0
  }

  it('lands a shot at any range a balloon turns up at', () => {
    for (const away of [12, 16, 20, 24, 26]) {
      for (const high of [2, 6, 10]) {
        const yaw = (away % 7) * 0.7
        const at = { x: Math.sin(yaw) * away, y: high, z: -Math.cos(yaw) * away }
        expect(snipe(at), `${away}m away and ${high}m up`).toBe(true)
      }
    }
  })

  it('needs the arc: aiming flat at a far one falls short', () => {
    const at = { x: 0, y: EYE, z: -24 }
    const flat = drive(shoot(empty({ balloons: [balloon({ ...at, rise: 0 })] }), 0, 0), 3)
    expect(flat.balloons, 'a flat shot drops under it').toHaveLength(1)
    expect(snipe(at), 'and the same shot with the arc lands').toBe(true)
  })
})
