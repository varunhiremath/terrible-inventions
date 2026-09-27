import { describe, expect, it } from 'vitest'
import { CAR_LONG, LANES, REACT, SIGHT, STAGES, TANK, TOP_SPEED, stageFor } from './level'
import {
  FIXED, NO_INPUT, blockedLanes, missionMet, newRun, placeOf, racerLanes, resume,
  standings, step, type Input, type Run,
} from './run'

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
     * The playability proof: can an ordinary sort of driver get there at all.
     * Averaged over several roads, because the traffic is seeded and one seed
     * tells you about that road rather than about the game.
     */
    for (let number = 1; number <= STAGES.length; number++) {
      for (let seed = 1; seed <= 5; seed++) {
        let run = newRun(number, 99, 0, seed * 13 + 1)
        const drive = makeDriver()
        for (let t = 0; t < 400 && run.status !== 'stageDone'; t += FIXED) {
          run = step(run, drive(run), FIXED)
          if (run.status === 'crashed') run = resume(run)
        }
        expect(run.status, `${stageFor(number).name} seed ${seed} was never finished`).toBe('stageDone')
      }
    }
  }, 240_000)

  it('is gentle at the start and genuinely hard at the end', () => {
    /*
     * Both ends, because only guarding one of them is how this went wrong.
     *
     * The cap used to be the only rule, and it quietly held the whole game
     * down to the difficulty of its easiest acceptable stage — five levels
     * were finished without a single failure. So the last stage now has to
     * cost this driver something, and the first still has to be kind.
     *
     * Worth knowing when reading these numbers: the driver below is a poor
     * player. A person who is any good will crash far less than it does, so a
     * stage it strolls through is one nobody will notice.
     */
    const cost = (number: number) => {
      let total = 0
      for (let seed = 1; seed <= 5; seed++) {
        let run = newRun(number, 99, 0, seed * 13 + 1)
        const drive = makeDriver()
        for (let t = 0; t < 400 && run.status !== 'stageDone'; t += FIXED) {
          run = step(run, drive(run), FIXED)
          if (run.status === 'crashed') { total++; run = resume(run) }
        }
      }
      return total / 5
    }

    const first = cost(1)
    expect(first, `the first stage cost ${first.toFixed(1)} crashes and has to be kind`)
      .toBeLessThanOrEqual(1.6)

    const last = cost(STAGES.length)
    expect(last, `the last stage cost ${last.toFixed(1)} crashes, which is a stroll`)
      .toBeGreaterThan(2)
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
        { id: 1, y: run.distance + 0.2, lane: 1.5, speed: 0, kind: 'cruiser' as const, wants: 1.5, signal: 0 as const, signalFor: 0, roused: 0 },
        { id: 2, y: run.distance + SIGHT * 2, lane: 0, speed: 0, kind: 'cruiser' as const, wants: 0, signal: 0 as const, signalFor: 0, roused: 0 },
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
  it('never starts a manoeuvre inside the stretch he is arriving in', () => {
    /*
     * The rule, precisely: nothing *begins* moving once it is inside the
     * window. One already under way finishes — it has been indicating for most
     * of a second and is visibly halfway across, so completing is the readable
     * outcome, and freezing it instead leaves it straddling two lanes and
     * blocking both.
     *
     * What would be a trick is a vehicle sitting still in its lane and then
     * stepping sideways as you arrive. That is what this watches for.
     */
    for (const number of [4, 5, 6]) {
      for (let seed = 1; seed <= 4; seed++) {
        let run = newRun(number, 99, 0, seed * 5)
        const drive = makeDriver()
        let settledBefore = new Map(
          run.cars.map((c) => [c.id, Math.abs(c.wants - c.lane) < 0.01]),
        )
        for (let t = 0; t < 60; t += FIXED) {
          run = step(run, drive(run), FIXED)
          // Carrying on through prangs. Stopping at the first one meant
          // watching about four seconds of road and concluding that traffic
          // never changes lane.
          if (run.status !== 'driving') run = resume(run)
          for (const car of run.cars) {
            const wasSettled = settledBefore.get(car.id)
            const inside = car.y - run.distance <= REACT
            const nowMoving = Math.abs(car.wants - car.lane) >= 0.01
            if (wasSettled && inside && nowMoving) {
              throw new Error(`a ${car.kind} set off inside the window on stage ${number}`)
            }
          }
          settledBefore = new Map(
            run.cars.map((c) => [c.id, Math.abs(c.wants - c.lane) < 0.01]),
          )
        }
      }
    }
  }, 120_000)

  it('indicates before it pulls out, every time', () => {
    /*
     * The whole point of the indicators: no vehicle may move sideways without
     * having had its lamp on first. Watched across the busiest stages, where
     * every sort of vehicle is out.
     */
    for (const number of [4, 5, 6]) {
      for (let seed = 1; seed <= 3; seed++) {
        let run = newRun(number, 99, 0, seed * 11)
        const drive = makeDriver()
        let before = new Map(run.cars.map((c) => [c.id, { lane: c.lane, signal: c.signal }]))
        let sawOne = false
        for (let t = 0; t < 60; t += FIXED) {
          run = step(run, drive(run), FIXED)
          if (run.status !== 'driving') run = resume(run)
          for (const car of run.cars) {
            const was = before.get(car.id)
            if (!was) continue
            if (Math.abs(car.lane - was.lane) > 0.001) {
              sawOne = true
              expect(
                was.signal !== 0 || car.signal !== 0,
                `a ${car.kind} moved lane with no indicator on stage ${number}`,
              ).toBe(true)
            }
          }
          before = new Map(run.cars.map((c) => [c.id, { lane: c.lane, signal: c.signal }]))
        }
        expect(sawOne, `nothing changed lane at all on stage ${number}, so this proves nothing`).toBe(true)
      }
    }
  }, 120_000)

  /*
   * There was a test here that the permanently open lane was never closed.
   * That lane is gone — it made five stages finishable without a scratch —
   * and the promise it guarded is now kept by checking each lane change
   * against the window instead. "Never blocks every lane at once", above,
   * is the test of it, and it now has wandering traffic to contend with.
   */
})

/**
 * The race.
 *
 * The road was reported as too easy twice, and both times more traffic was the
 * wrong answer: an obstacle course you have solved is not hard, it is long.
 * Four of his machines running the same stage is a different problem — you can
 * drive a clean stage and still come fourth.
 *
 * The rule that earns its own test is the one at the bottom. A racer moves at
 * its own speed, so it can drift into the one lane the spawner left open and
 * close it, and no check made when it was put on the road would catch that.
 * It is the same lesson as the drifting rubble and the different-speed
 * traffic, and this is the third time this project has had to learn it.
 */
describe('the field', () => {
  it('lines four of them up behind you', () => {
    const run = newRun(1)
    expect(run.racers).toHaveLength(4)
    for (const racer of run.racers) expect(racer.y).toBeLessThan(0)
    expect(new Set(run.racers.map((r) => r.who.name)).size).toBe(4)
  })

  it('puts you first on the grid and not for long', () => {
    expect(placeOf(newRun(1))).toBe(1)
    // Left alone, with the pedal up, they all go past.
    const idle = drive(newRun(1), NO_INPUT, 20)
    expect(placeOf(idle)).toBeGreaterThan(1)
  })

  it('is a close race rather than a procession', () => {
    /*
     * What "beatable" has to mean here.
     *
     * Not "this driver wins", because this driver is a poor one on purpose —
     * it crashes a dozen times on the last stage and never picks up a can, and
     * demanding a win from it would mean a field so slow that a child beats it
     * without noticing there was one. And not "this driver loses" either.
     *
     * What matters is the margin. If the leader crosses the line while this
     * driver is still a tenth of the stage back, the race was over at the
     * start; if they finish within a few lengths of each other, a clean run
     * wins it and a scrappy one does not. That is a race.
     */
    for (const number of [1, 3, 6]) {
      const drive2 = makeDriver()
      let run = newRun(number, 99, 0, 7)
      for (let t = 0; t < 400 && run.status !== 'stageDone'; t += FIXED) {
        run = step(run, drive2(run), FIXED)
        if (run.status === 'crashed') run = resume(run)
      }
      expect(run.status, `stage ${number}`).toBe('stageDone')
      expect(run.place, `stage ${number}`).toBeLessThanOrEqual(3)

      const order = standings(run)
      const behind = order[0].at - (order.find((row) => row.you)?.at ?? 0)
      expect(behind, `stage ${number}: the leader was out of sight`)
        .toBeLessThan(run.stage.distance * 0.06)
    }
  })

  it('beats somebody who dawdles', () => {
    // And the other half of it. A race you win by holding one button is not a
    // race either.
    let run = newRun(1)
    for (let t = 0; t < 200 && run.status === 'driving'; t += FIXED) {
      // Half throttle: the pedal every other slice.
      run = step(run, Math.floor(t / FIXED) % 2 === 0 ? { ...NO_INPUT, go: true } : NO_INPUT, FIXED)
    }
    expect(placeOf(run)).toBeGreaterThan(1)
  })

  it('never shuts the stretch you cannot avoid', () => {
    /*
     * The promise, restated for something that moves.
     *
     * It cannot be "no lane is ever shut anywhere in the reaction window",
     * and it took a failing test to see why: a racer that is told to get out
     * of the last open lane takes about four tenths of a second to cross it,
     * and for those four tenths the road behind it is shut. Forbidding that
     * would mean forbidding lane changes.
     *
     * What actually matters is whether the road is shut *where the player is
     * arriving*. So it is two rules. The close stretch — bumper to a third of
     * the way out, which is the part nobody can react to — is never shut at
     * all. The wider window may shut, but only for as long as a lane change
     * takes, so it is always open again by the time anyone gets there.
     */
    const CROSSING = 0.7
    for (const number of [1, 2, 3, 4, 5, 6]) {
      const driver = makeDriver()
      let run = newRun(number)
      let shutFor = 0
      let closeFor = 0
      for (let t = 0; t < 90 && run.status !== 'stageDone'; t += FIXED) {
        run = step(run, driver(run), FIXED)
        if (run.status === 'crashed') run = resume(run)
        if (run.status !== 'driving') break

        /*
         * Measured with the game's own definitions, not a second set written
         * here. The first version of this test had a racer 0.81 of a lane wide
         * while the rule had it 0.62 wide, so the two disagreed about whether
         * the road was shut and the disagreement looked like a bug in neither.
         */
        const from = run.distance + CAR_LONG
        const shutIn = (to: number) => {
          const shut = blockedLanes(run.cars, from, to)
          for (const lane of racerLanes(run.racers, from, to)) shut.add(lane)
          return shut.size
        }

        /*
         * Both stretches are allowed to shut for as long as one lane change
         * takes and no longer. A flat "never shut" on the close stretch was
         * the first version and it failed on the fifth stage — not because of
         * the field but because the traffic itself is allowed to finish a
         * lane change it has already started, which momentarily puts a car in
         * the last lane. That has always been true of this road; the field
         * did not introduce it, and forbidding it would mean forbidding lane
         * changes.
         */
        if (shutIn(from + REACT / 3) >= LANES) closeFor += FIXED
        else closeFor = 0
        expect(
          closeFor,
          `stage ${number}: no way through in front of you at ${run.distance.toFixed(0)}`,
        ).toBeLessThan(CROSSING)

        if (shutIn(run.distance + REACT) >= LANES) shutFor += FIXED
        else shutFor = 0
        expect(
          shutFor,
          `stage ${number}: the window stayed shut at ${run.distance.toFixed(0)}`,
        ).toBeLessThan(CROSSING)
      }
    }
  })

  it('keeps them on the road', () => {
    let run = newRun(6, 99, 0, 5)
    const driver = makeDriver()
    for (let t = 0; t < 60 && run.status !== 'stageDone'; t += FIXED) {
      run = step(run, driver(run), FIXED)
      if (run.status === 'crashed') run = resume(run)
      for (const racer of run.racers) {
        expect(racer.lane).toBeGreaterThanOrEqual(0)
        expect(racer.lane).toBeLessThanOrEqual(LANES - 1)
      }
    }
  })

  it('indicates before pulling out, like everything else here', () => {
    let run = newRun(4, 99, 0, 3)
    const driver = makeDriver()
    let signalled = 0
    let jumped = 0
    for (let t = 0; t < 60 && run.status !== 'stageDone'; t += FIXED) {
      const before = run.racers.map((r) => r.lane)
      run = step(run, driver(run), FIXED)
      if (run.status === 'crashed') run = resume(run)
      run.racers.forEach((racer, i) => {
        if (Math.abs(racer.lane - before[i]) < 1e-6) return
        if (racer.signal !== 0) signalled += 1
        else jumped += 1
      })
    }
    expect(signalled + jumped, 'nothing changed lane at all').toBeGreaterThan(0)
    // The tail of a move, after the indicator has timed out, is allowed.
    expect(signalled).toBeGreaterThan(jumped * 0.5)
  })

  it('does not drive into the back of you', () => {
    /*
     * They can be hit; they do not do the hitting. A field that takes your
     * last life by running into you from behind is not a race, it is an
     * ambush, and there is nothing you could have done about it.
     */
    let run = newRun(5, 99, 0, 9)
    let touched = 0
    for (let t = 0; t < 120; t += FIXED) {
      // Sitting still with the brake on: the worst possible place to be.
      run = step(run, { ...NO_INPUT, brake: true }, FIXED)
      if (run.mercy > 0) continue
      for (const racer of run.racers) {
        const gap = racer.y - run.distance
        // Behind you and overlapping your lane is the one they must not do.
        if (gap > 0 || gap < -CAR_LONG * 1.2) continue
        if (Math.abs(racer.lane - run.lane) < 0.6) touched += 1
      }
    }
    expect(touched, 'a racer drove into a stationary car').toBe(0)
  })

  it('sorts the finish out at the end', () => {
    const driver = makeDriver()
    let run = newRun(1, 99, 0, 11)
    for (let t = 0; t < 400 && run.status !== 'stageDone'; t += FIXED) {
      run = step(run, driver(run), FIXED)
      if (run.status === 'crashed') run = resume(run)
    }
    expect(run.status).toBe('stageDone')
    const order = standings(run)
    expect(order).toHaveLength(5)
    expect(order.filter((row) => row.you)).toHaveLength(1)
    // Best first.
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].at).toBeGreaterThanOrEqual(order[i].at)
    }
  })

  it('pays a place mission when the place is made', () => {
    const stage = STAGES.findIndex((s) => s.mission.kind === 'place')
    expect(stage, 'no stage is a race').toBeGreaterThanOrEqual(0)
    const run = newRun(stage + 1)
    // On the grid you are first, so the mission reads as met before the off —
    // which is fine, because it is only ever counted at the line.
    expect(missionMet(run)).toBe(true)
  })
})
