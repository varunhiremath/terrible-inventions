import { describe, expect, it } from 'vitest'
import { LANES, REACT, SIGHT, STAGES, TANK, TOP_SPEED, stageFor } from './level'
import { FIXED, NO_INPUT, blockedLanes, missionMet, newRun, resume, step, type Input, type Run } from './run'

/**
 * The road.
 *
 * Two of these matter more than the rest. One says the road is never fully
 * blocked — a wall of traffic across every lane is not difficulty, it is a
 * coin toss. The other says a stage can actually be finished by something no
 * cleverer than a person: look ahead, pick a free lane, hold the pedal down.
 *
 * Every other game in here shipped without the second kind and was found out
 * by somebody playing it.
 */

const drive = (run: Run, input: Input, seconds: number) => {
  let at = run
  for (let t = 0; t < seconds; t += FIXED) at = step(at, input, FIXED)
  return at
}

/**
 * Somebody driving, badly but sensibly.
 *
 * Judged in seconds rather than car lengths: what matters is not whether there
 * is a car ahead but whether you are about to arrive at it. Measured in
 * distance, the first version of this braked for traffic twenty-five lengths
 * away and never got anywhere at all.
 *
 * And it commits. The version before this picked the roomiest lane afresh
 * every sixtieth of a second, changed its mind halfway across, and sat
 * dithering on a white line until something hit it. A person decides to move
 * and then moves.
 *
 * Deliberately not clever. If this cannot get down the road, nor can a child.
 */
function makeDriver() {
  let target: number | null = null

  return (run: Run): Input => {
    /** Seconds until he would reach the next car in a lane, or forever. */
    const secondsTo = (lane: number): number => {
      let soonest = Infinity
      for (const car of run.cars) {
        if (Math.abs(car.lane - lane) >= 0.9) continue
        const gap = car.y - run.distance
        if (gap < 0) continue
        const closing = run.speed - car.speed
        if (closing <= 0.5) continue
        soonest = Math.min(soonest, gap / closing)
      }
      return soonest
    }

    // Still on the way somewhere: keep going, and do not re-open the question.
    if (target !== null) {
      if (Math.abs(run.lane - target) < 0.12) target = null
      else {
        return { ...NO_INPUT, go: secondsTo(Math.round(run.lane)) > 1.8,
                 left: target < run.lane, right: target > run.lane }
      }
    }

    const here = Math.round(run.lane)
    if (secondsTo(here) > 3.2) return { ...NO_INPUT, go: true }

    // Time to move. The roomiest lane he can get to, counting outwards so he
    // does not cross the whole road when the next one over will do.
    let best = here
    let bestRoom = secondsTo(here)
    for (let reach = 1; reach < LANES; reach++) {
      for (const lane of [here - reach, here + reach]) {
        if (lane < 0 || lane > LANES - 1) continue
        const low = Math.min(lane, here)
        const high = Math.max(lane, here)
        let through = true
        for (let c = low; c <= high; c++) if (c !== here && secondsTo(c) < 1.5) through = false
        if (!through) continue
        if (secondsTo(lane) > bestRoom) { best = lane; bestRoom = secondsTo(lane) }
      }
      if (best !== here) break
    }

    if (best !== here) {
      target = best
      return { ...NO_INPUT, go: bestRoom > 2.5, left: best < run.lane, right: best > run.lane }
    }
    return secondsTo(here) < 2 ? { ...NO_INPUT, brake: true } : { ...NO_INPUT, go: true }
  }
}

describe('the road', () => {
  it('never blocks every lane at once', () => {
    /*
     * The reaction window: the stretch a driver is about to arrive in. If every
     * lane in it is occupied there is nothing to be done and the crash was
     * decided by the spawner rather than by the player.
     */
    for (const stage of STAGES) {
      const number = STAGES.indexOf(stage) + 1
      for (let seed = 1; seed <= 12; seed++) {
        let run = newRun(number, 3, 0, seed)
        const drive = makeDriver()
        for (let t = 0; t < 90 && run.status === 'driving'; t += FIXED) {
          run = step(run, drive(run), FIXED)
          const window = blockedLanes(run.cars, run.distance, run.distance + SIGHT * 0.55)
          expect(
            window.size,
            `${stage.name} seed ${seed}: every lane blocked at ${run.distance.toFixed(0)}`,
          ).toBeLessThan(LANES)
        }
      }
    }
  }, 120_000)

  it('can be driven to the end of every stage', () => {
    /*
     * The playability proof. Not "is there a route" — can an ordinary sort of
     * driver actually get there, and without it costing a silly number of
     * cars.
     *
     * Averaged over several roads rather than judged on one. The traffic is
     * seeded, and a single seed swings between one crash and four on the same
     * stage — so one road tells you about that road and nothing about the
     * game.
     */
    for (let number = 1; number <= STAGES.length; number++) {
      let total = 0
      const seeds = 5
      for (let seed = 1; seed <= seeds; seed++) {
        let run = newRun(number, 99, 0, seed * 13 + 1)
        const drive = makeDriver()
        for (let t = 0; t < 400 && run.status !== 'stageDone'; t += FIXED) {
          run = step(run, drive(run), FIXED)
          if (run.status === 'crashed') { total++; run = resume(run) }
        }
        expect(run.status, `${stageFor(number).name} seed ${seed} was never finished`).toBe('stageDone')
      }
      /*
       * What this can honestly claim.
       *
       * Not a smooth ramp: measured with a crude autopilot over five seeds,
       * the stage-to-stage numbers bounce around by more than the trend, so a
       * monotonic assertion would be reading noise. What it can say is that no
       * stage is a wall, and that the first one is gentle — which is what the
       * numbers are actually for.
       */
      const average = total / seeds
      expect(
        average,
        `${stageFor(number).name} averaged ${average.toFixed(1)} crashes, which is a wall`,
      ).toBeLessThanOrEqual(3)
      if (number === 1) {
        expect(average, 'the first stage has to be gentle').toBeLessThanOrEqual(1.5)
      }
    }
  }, 240_000)

  it('keeps him on the tarmac rather than crashing him off the edge', () => {
    /*
     * Steering is clamped. Losing a life to a kerb you drifted into teaches
     * nothing at all, and the traffic is quite enough to be going on with.
     *
     * On an empty road, so that what is being measured is the edge and not
     * whatever happened to be in the outside lane.
     */
    for (const [name, input] of [
      ['left', { ...NO_INPUT, left: true }],
      ['right', { ...NO_INPUT, right: true }],
    ] as const) {
      let run: Run = { ...newRun(1), stage: { ...stageFor(1), traffic: 0 } }
      for (let t = 0; t < 6; t += FIXED) {
        run = step({ ...run, cars: [] }, input, FIXED)
      }
      expect(run.lane, name).toBe(name === 'left' ? 0 : LANES - 1)
      expect(run.status, name).toBe('driving')
    }
  })

  it('burns fuel while moving and none while stopped', () => {
    const moving = drive(newRun(1), { ...NO_INPUT, go: true }, 5)
    expect(moving.fuel).toBeLessThan(TANK)
    const parked = drive(newRun(1), NO_INPUT, 5)
    expect(parked.fuel).toBe(TANK)
  })

  it('will not pull away on an empty tank', () => {
    const dry = drive({ ...newRun(1), fuel: 0 }, { ...NO_INPUT, go: true }, 3)
    expect(dry.speed).toBe(0)
    expect(dry.distance).toBe(0)
  })

  it('says so, once, the moment the tank runs out', () => {
    let run = { ...newRun(1), fuel: 0.05, speed: TOP_SPEED / 2 }
    const heard: string[] = []
    for (let t = 0; t < 3; t += FIXED) {
      run = step(run, { ...NO_INPUT, go: true }, FIXED)
      heard.push(...run.events)
    }
    expect(heard.filter((e) => e === 'dry').length).toBe(1)
  })

  it('does not drop him back in front of the car he just hit', () => {
    const run = newRun(1)
    const hit = {
      ...run,
      cars: [
        { id: 1, y: run.distance + 0.2, lane: 1.5, speed: 0, kind: 'cruiser' as const, wants: 1.5, roused: 0 },
        { id: 2, y: run.distance + SIGHT * 2, lane: 0, speed: 0, kind: 'cruiser' as const, wants: 0, roused: 0 },
      ],
    }
    const back = resume(hit)
    expect(back.cars.map((c) => c.id)).toEqual([2])
    expect(back.status).toBe('driving')
  })

  it('plays out the same way twice', () => {
    const once = drive(newRun(2, 3, 0, 99), { ...NO_INPUT, go: true, right: true }, 20)
    const again = drive(newRun(2, 3, 0, 99), { ...NO_INPUT, go: true, right: true }, 20)
    expect(once.distance).toBeCloseTo(again.distance, 9)
    expect(once.cars.length).toBe(again.cars.length)
    expect(once.score).toBe(again.score)
  })

  it('scores for getting past people', () => {
    const run = drive(newRun(1, 3, 0, 5), { ...NO_INPUT, go: true }, 30)
    expect(run.passed + (run.status === 'crashed' ? 1 : 0)).toBeGreaterThan(0)
  })
})

describe('the missions', () => {
  it('asks something different of every stage', () => {
    const asked = STAGES.map((s) => `${s.mission.kind}`)
    expect(new Set(asked).size).toBeGreaterThan(1)
  })

  it('counts what it says it counts', () => {
    const run = newRun(1)
    const passing = { ...run, stage: { ...run.stage, mission: { kind: 'pass' as const, count: 3 } } }
    expect(missionMet({ ...passing, passed: 2 })).toBe(false)
    expect(missionMet({ ...passing, passed: 3 })).toBe(true)

    const cans = { ...run, stage: { ...run.stage, mission: { kind: 'cans' as const, count: 2 } } }
    expect(missionMet({ ...cans, cansTaken: 1 })).toBe(false)
    expect(missionMet({ ...cans, cansTaken: 2 })).toBe(true)

    const clean = { ...run, stage: { ...run.stage, mission: { kind: 'clean' as const } } }
    expect(missionMet({ ...clean, pranged: 0 })).toBe(true)
    expect(missionMet({ ...clean, pranged: 1 })).toBe(false)
  })
})

describe('the vehicles', () => {
  it('never changes lane inside the stretch he is arriving in', () => {
    /*
     * The swervers are the whole point of this one. A car that moves after you
     * have committed to a gap is not a hazard, it is a trick — so everything
     * is locked once it is inside the reaction window, and this drives the
     * busiest stages watching for one that is not.
     */
    for (const number of [4, 5, 6]) {
      for (let seed = 1; seed <= 4; seed++) {
        let run = newRun(number, 99, 0, seed * 5)
        const drive = makeDriver()
        let before = new Map(run.cars.map((c) => [c.id, c.lane]))
        for (let t = 0; t < 60 && run.status === 'driving'; t += FIXED) {
          run = step(run, drive(run), FIXED)
          for (const car of run.cars) {
            const was = before.get(car.id)
            const close = car.y - run.distance <= REACT
            if (was !== undefined && close) {
              expect(
                Math.abs(car.lane - was),
                `a ${car.kind} moved lane ${car.y - run.distance} ahead, inside the window`,
              ).toBeLessThan(0.001)
            }
          }
          before = new Map(run.cars.map((c) => [c.id, c.lane]))
        }
      }
    }
  }, 120_000)

  it('keeps one lane open no matter what the traffic does', () => {
    for (const number of [4, 5, 6]) {
      for (let seed = 1; seed <= 4; seed++) {
        let run = newRun(number, 99, 0, seed * 7)
        const drive = makeDriver()
        for (let t = 0; t < 60 && run.status === 'driving'; t += FIXED) {
          run = step(run, drive(run), FIXED)
          const shut = blockedLanes(run.cars, run.distance, run.distance + REACT)
          expect(shut.has(run.openLane), `the open lane was closed on stage ${number}`).toBe(false)
        }
      }
    }
  }, 120_000)
})
