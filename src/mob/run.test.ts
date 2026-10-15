import { describe, expect, it } from 'vitest'
import {
  GATE_Y, LANE, LEAST, LINE_Y, MOB_H, MOST, WEAPONS,
  apply, betterGate, blockWorth, gateRow, mobSpeed, waveFor, waveSize, weaponFor,
  type Dice, type Gate,
} from './level'
import { FIXED, NO_INPUT, newRun, serve, standing, step, type Input, type Run } from './run'

/**
 * The swarm.
 *
 * The rules worth pinning here are the ones a player would notice and a glance
 * at the screen would not: what a gate does to a squad, what happens when a
 * squad is bigger than the block it runs into, and whether a gate can be flown
 * straight through without firing.
 */

const drive = (run: Run, seconds: number, input: Input = NO_INPUT): Run => {
  let now = run
  for (let i = 0; i < Math.round(seconds / FIXED); i++) {
    if (now.status !== 'playing') break
    now = step(now, input, FIXED)
  }
  return now
}

/**
 * A run with nothing in the lane but what the test puts there.
 *
 * With one exception, which is worth knowing about: there is a keeper block a
 * long way above the lane. An empty lane is a cleared wave, so without it the
 * run ends on the first step and every test that drives for a second measures
 * one step instead. (Found the hard way: four tests failing with a squad that
 * had travelled one step's worth and a gate that had not fired.) It never
 * arrives and nothing ever reaches it.
 */
const KEEPER = { id: 9000, x: LANE / 2, y: -60, count: 9999, flash: 0 }

const empty = (set: Partial<Run> = {}): Run => ({
  ...newRun(1),
  blocks: [KEEPER],
  gates: [],
  squads: [],
  says: [],
  cool: 999,
  gateIn: 999,
  ...set,
})

const oneGate = (op: Gate['op'], by: number, side: 'left' | 'right' = 'left'): Gate => ({
  id: 900,
  op,
  by,
  from: side === 'left' ? 0 : LANE / 2,
  to: side === 'left' ? LANE / 2 : LANE,
  y: GATE_Y,
  flash: 0,
  born: 0,
})

describe('what a gate does', () => {
  it('multiplies, adds and takes away', () => {
    expect(apply(4, 'times', 3)).toBe(12)
    expect(apply(4, 'plus', 3)).toBe(7)
    expect(apply(4, 'minus', 3)).toBe(1)
  })

  it('never leaves a squad with nobody in it, and never overflows the cluster', () => {
    expect(apply(2, 'minus', 9)).toBe(LEAST)
    expect(apply(60, 'times', 4)).toBe(MOST)
  })

  it('fires when a squad crosses it', () => {
    const run = empty({ gates: [oneGate('times', 3)], cart: 2 })
    const after = drive({ ...run, cool: 0 }, 1.2)
    // One shot, one gate: the squad is three times what the gun fires.
    const squad = after.squads[0]
    expect(squad, 'the shot went somewhere').toBeTruthy()
    expect(squad.n).toBe(WEAPONS[0].squad * 3)
  })

  it('fires even when one step carries a squad right over it', () => {
    /*
     * The fault this is here for: asking "is the squad near the gate" instead
     * of "did it cross the gate" means a long frame — a cheap phone, a tab
     * coming back to life — carries a squad past the line and the gate never
     * fires. Nothing errors; the maths simply does not happen.
     */
    const run = empty({ gates: [oneGate('times', 3)], cart: 2, cool: 0 })
    // One step that covers the gap to the gate and then some, so a check for
    // being near the line would miss it entirely.
    const after = step(step(run, NO_INPUT, FIXED), NO_INPUT, 0.6)
    const squad = after.squads[0]
    expect(squad.y, 'past the gate in one step').toBeLessThan(GATE_Y - 1)
    expect(squad.n).toBe(WEAPONS[0].squad * 3)
  })

  it('does not let a squad jump clean over a block', () => {
    /*
     * The other half of the same problem, and the one the slices are for: a
     * block is a unit and a quarter tall, so a step that moves a squad further
     * than that can put it above a block it never touched.
     */
    const run = empty({
      squads: [{ id: 1, x: 5, y: 9.4, n: 6, flash: 0 }],
      blocks: [{ id: 2, x: 5, y: 7, count: 20, flash: 0 }],
    })
    const after = step(run, NO_INPUT, 0.4)
    expect(after.squads[0]?.y ?? -99, 'it is above where the block was').toBeLessThan(7)
    expect(after.blocks[0].count, 'and it took six of them with it').toBe(14)
  })

  it('only fires on the half of the lane it covers', () => {
    const left = drive(empty({ gates: [oneGate('times', 3)], cart: 2, cool: 0 }), 1.2)
    const right = drive(empty({ gates: [oneGate('times', 3)], cart: 8, cool: 0 }), 1.2)
    expect(left.squads[0].n).toBe(3)
    expect(right.squads[0].n).toBe(1)
  })

  it('says the sum out loud where it happened', () => {
    const after = drive(empty({ gates: [oneGate('times', 3)], cart: 2, cool: 0 }), 1.2)
    expect(after.says.map((s) => s.text)).toContain('1 × 3 = 3')
  })

  it('says it once per gate rather than stacking the same sum up', () => {
    /*
     * Shots go through a gate twice a second, and the sum does not change, so
     * three copies of it used to pile up on top of each other and on top of
     * the gate's own number.
     */
    const after = drive(empty({ gates: [oneGate('times', 3)], cart: 2, cool: 0 }), 2.5)
    expect(after.says.filter((s) => s.text === '1 × 3 = 3').length).toBe(1)
  })
})

describe('a squad meeting a block', () => {
  it('trades one for one and carries the rest on into the next block', () => {
    const run = empty({
      squads: [{ id: 1, x: 5, y: 8, n: 14, flash: 0 }],
      blocks: [
        { id: 2, x: 5, y: 7, count: 9, flash: 0 },
        { id: 3, x: 5, y: 5.4, count: 20, flash: 0 },
      ],
    })
    const after = drive(run, 0.6)
    // Nine taken off the front block, which is gone; five off the one behind.
    expect(after.blocks.find((b) => b.id === 2)).toBeUndefined()
    expect(after.blocks.find((b) => b.id === 3)?.count).toBe(15)
    expect(after.hits).toBe(14)
    expect(after.squads).toHaveLength(0)
  })

  it('leaves a block standing when the squad is too small, and the squad is spent', () => {
    const run = empty({
      squads: [{ id: 1, x: 5, y: 8, n: 4, flash: 0 }],
      blocks: [{ id: 2, x: 5, y: 7, count: 9, flash: 0 }],
    })
    const after = drive(run, 0.4)
    expect(after.blocks[0].count).toBe(5)
    expect(after.squads).toHaveLength(0)
    expect(after.hits).toBe(4)
  })

  it('counts a cleared block as one thing happening, not two', () => {
    const run = empty({
      squads: [{ id: 1, x: 5, y: 8, n: 9, flash: 0 }],
      blocks: [{ id: 2, x: 5, y: 7, count: 9, flash: 0 }],
    })
    const after = step(run, NO_INPUT, 0.2)
    expect(after.events.filter((e) => e === 'broke')).toHaveLength(1)
    expect(after.events).not.toContain('hit')
  })
})

describe('the line at the bottom', () => {
  it('costs a go when a block crosses it, and the block is still there', () => {
    /*
     * Still there on purpose. Taking it off the board meant a wave could be
     * cleared by letting the whole mob walk through you — every block over the
     * line, nothing left on the board, wave complete. `serve` pushes them back
     * up instead.
     */
    const run = empty({
      lives: 3,
      blocks: [
        { id: 2, x: 5, y: LINE_Y - MOB_H / 2 - 0.02, count: 4, flash: 0 },
        { id: 3, x: 2, y: 4, count: 4, flash: 0 },
      ],
    })
    const after = drive(run, 0.5)
    expect(after.status).toBe('lost')
    expect(after.lives).toBe(2)
    expect(after.blocks.map((b) => b.id).sort()).toEqual([2, 3])
    expect(after.events).toContain('through')
  })

  it('is never cleared by letting the mob through', () => {
    let run = empty({
      lives: 99,
      blocks: [{ id: 2, x: 5, y: 10, count: 9, flash: 0 }],
    })
    for (let i = 0; i < 8; i++) {
      run = drive(run, 12)
      expect(run.status, 'it costs a life, it does not finish the wave').not.toBe('cleared')
      // `serve` restarts the gun, which is right in the game and would destroy
      // the block this test is about.
      run = { ...serve(run), cool: 999 }
    }
  })

  it('is the end of the run when the last go goes', () => {
    const run = empty({
      lives: 1,
      blocks: [{ id: 2, x: 5, y: LINE_Y - MOB_H / 2 - 0.02, count: 4, flash: 0 }],
    })
    const after = drive(run, 0.5)
    expect(after.status).toBe('over')
    expect(after.events).toContain('over')
  })

  it('pushes what is left back up the lane before the next go', () => {
    const run = empty({
      lives: 3,
      blocks: [
        { id: 2, x: 5, y: LINE_Y - MOB_H / 2 - 0.02, count: 4, flash: 0 },
        { id: 3, x: 2, y: 12, count: 4, flash: 0 },
      ],
    })
    const after = serve(drive(run, 0.5))
    expect(after.status).toBe('playing')
    expect(after.blocks[0].y).toBeLessThan(12)
    expect(after.squads).toHaveLength(0)
  })

  it('says the wave is cleared when the last block goes', () => {
    const run = empty({
      squads: [{ id: 1, x: 5, y: 8, n: 9, flash: 0 }],
      blocks: [{ id: 2, x: 5, y: 7, count: 9, flash: 0 }],
    })
    const after = drive(run, 0.4)
    expect(after.status).toBe('cleared')
    expect(standing(after)).toBe(0)
  })
})

describe('the guns', () => {
  it('arrive on hits, in order, and each one is better than the last', () => {
    expect(weaponFor(0).id).toBe('popper')
    for (let i = 1; i < WEAPONS.length; i++) {
      expect(WEAPONS[i].at).toBeGreaterThan(WEAPONS[i - 1].at)
      expect(WEAPONS[i].squad).toBeGreaterThan(WEAPONS[i - 1].squad)
      expect(WEAPONS[i].every).toBeLessThan(WEAPONS[i - 1].every)
      expect(weaponFor(WEAPONS[i].at).id).toBe(WEAPONS[i].id)
      expect(weaponFor(WEAPONS[i].at - 1).id).toBe(WEAPONS[i - 1].id)
    }
  })

  it('is announced once when it changes, and not again', () => {
    const twins = WEAPONS[1]
    const run = empty({
      hits: twins.at - 9,
      squads: [{ id: 1, x: 5, y: 8, n: 9, flash: 0 }],
      blocks: [
        { id: 2, x: 5, y: 7, count: 9, flash: 0 },
        { id: 3, x: 2, y: 2, count: 50, flash: 0 },
      ],
    })
    const first = step(run, NO_INPUT, 0.2)
    expect(first.weapon).toBe(twins.id)
    expect(first.events).toContain('armed')
    const second = step(first, NO_INPUT, 0.2)
    expect(second.events).not.toContain('armed')
  })

  it('fires more often, and sends more up, once it is better', () => {
    // Two seconds: short enough that nothing has flown off the top yet, so
    // what is in the lane is everything that was fired.
    const sent = (run: Run) => run.squads.reduce((all, s) => all + s.n, 0)
    const popper = drive({ ...empty({ cart: 5 }), cool: 0, hits: 0 }, 2)
    const cascade = drive({ ...empty({ cart: 5 }), cool: 0, hits: WEAPONS[3].at }, 2)
    expect(cascade.squads.length).toBeGreaterThan(popper.squads.length)
    expect(sent(cascade)).toBeGreaterThan(sent(popper) * 3)
  })
})

describe('a row of gates', () => {
  /*
   * The rule the game is built on: the better gate depends on how many are in
   * the squad, so the answer changes as the guns do. A row where one side
   * simply wins is a row with a correct button on it.
   */
  it('comes in three kinds, in roughly the mix the game wants', () => {
    /*
     * Classified by the only thing a player can see: the two numbers. A row
     * with a `minus` on it is a trap. Otherwise the two gates cross over at
     * `plus / (times - 1)` — if that lands between two and four it is a close
     * call, inside the squad sizes the guns fire, and if it does not then one
     * side is plainly better and the row is there to be cashed in.
     *
     * The sizes probed are the ones the guns actually fire and no others. An
     * earlier version of this asked which gate wins at eight and at twelve,
     * which a squad is only ever at *after* a gate — and failed a row that was
     * working correctly, because the answer did change at a size that never
     * reaches a gate.
     *
     * The mix matters in both directions. All close calls and choosing well is
     * worth almost nothing (measured: fifteen per cent over a minute, because
     * numbers that cross over near your squad are nearly equal near your
     * squad). All wide ones and there is nothing to work out.
     */
    let close = 0
    let wide = 0
    let traps = 0

    for (let seed = 1; seed <= 600; seed++) {
      const row = gateRow(5, dice(seed), GATE_Y, idFrom(1))
      expect(row).toHaveLength(2)
      if (row.some((gate) => gate.op === 'minus')) {
        traps++
        continue
      }
      const times = row.find((gate) => gate.op === 'times')
      const plus = row.find((gate) => gate.op === 'plus')
      expect(times && plus, 'a row is a times gate and something else').toBeTruthy()
      if (!times || !plus) continue

      const crossover = plus.by / (times.by - 1)
      /*
       * Strictly better, with ties ignored. `betterGate` has to answer
       * *something* when the two gates come out equal, and counting that answer
       * as a win failed a row that was behaving perfectly: `×3` against `+2`
       * ties at a squad of one and then the times gate wins for ever after.
       */
      const winners = new Set<string>()
      for (const weapon of WEAPONS) {
        const byTimes = apply(weapon.squad, times.op, times.by)
        const byPlus = apply(weapon.squad, plus.op, plus.by)
        if (byTimes > byPlus) winners.add('times')
        else if (byPlus > byTimes) winners.add('plus')
      }

      if (crossover >= 2 && crossover <= 4) {
        close++
        // The point of a close call: which side is better depends on the squad.
        expect(
          winners.size,
          `×${times.by} vs +${plus.by} crosses at ${crossover} but has one winner everywhere`,
        ).toBe(2)
      } else {
        wide++
        expect(
          winners.size,
          `×${times.by} vs +${plus.by} is meant to be a walkover`,
        ).toBe(1)
      }
    }

    const all = close + wide + traps
    expect(close / all, `${close} close of ${all}`).toBeGreaterThan(0.45)
    expect(wide / all, `${wide} wide of ${all}`).toBeGreaterThan(0.12)
    expect(traps / all, `${traps} traps of ${all}`).toBeGreaterThan(0.1)
    expect(traps / all).toBeLessThan(0.3)
  })

  it('knows which of the two is better, by the same arithmetic the gates do', () => {
    /*
     * The bot in `balance.test.ts` plays by `betterGate`, so if it worked some
     * other way than `apply` the balance measurements would be a bot proving
     * its own arithmetic rather than the game's.
     */
    for (let seed = 1; seed <= 300; seed++) {
      const row = gateRow(6, dice(seed), GATE_Y, idFrom(1))
      for (const squad of [1, 2, 3, 5]) {
        const best = betterGate(row, squad)
        const mine = apply(squad, best.op, best.by)
        for (const gate of row) {
          expect(mine).toBeGreaterThanOrEqual(apply(squad, gate.op, gate.by))
        }
      }
    }
  })

  it('never opens with a trap: wave one is all gates worth taking', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const row = gateRow(1, dice(seed), GATE_Y, idFrom(1))
      expect(row.some((gate) => gate.op === 'minus'), `seed ${seed}`).toBe(false)
    }
  })

  it('covers the whole lane between the two of them, with no gap in the middle', () => {
    const row = gateRow(3, dice(7), GATE_Y, idFrom(1))
    const [left, right] = row[0].from < row[1].from ? row : [row[1], row[0]]
    expect(left.from).toBe(0)
    expect(left.to).toBe(right.from)
    expect(right.to).toBe(LANE)
  })

  it('is swapped for a different row while you play', () => {
    const run = newRun(1)
    const before = run.gates.map((g) => g.id)
    const after = drive(run, 4.5)
    expect(after.gates.map((g) => g.id)).not.toEqual(before)
    expect(after.gates).toHaveLength(2)
  })

  it('has no stray rows hanging about: one row, always', () => {
    let run = newRun(3)
    for (let i = 0; i < 12; i++) {
      run = drive(run, 2.5, { to: 5, left: false, right: false })
      if (run.status !== 'playing') run = serve({ ...run, lives: 3 })
      expect(run.gates).toHaveLength(2)
    }
  })
})

describe('the ladder of waves', () => {
  it('gets bigger, richer and faster, and never goes backwards', () => {
    for (let level = 2; level <= 25; level++) {
      expect(waveSize(level)).toBeGreaterThanOrEqual(waveSize(level - 1))
      expect(blockWorth(level)).toBeGreaterThan(blockWorth(level - 1))
      expect(mobSpeed(level)).toBeGreaterThanOrEqual(mobSpeed(level - 1))
    }
    expect(waveSize(12)).toBeGreaterThan(waveSize(1))
  })

  it('starts every wave with the mob above the lane and nothing on the line', () => {
    for (let level = 1; level <= 20; level++) {
      const blocks = waveFor(level, dice(level), idFrom(1))
      expect(blocks.length).toBe(waveSize(level))
      for (const block of blocks) {
        expect(block.y).toBeLessThan(0)
        expect(block.count).toBeGreaterThan(1)
        expect(block.x).toBeGreaterThan(0)
        expect(block.x).toBeLessThan(LANE)
      }
    }
  })
})

describe('the simulation itself', () => {
  it('plays the same way twice from the same seed', () => {
    const once = drive(newRun(2, 3, 0, 0, 1234), 6, { to: 3, left: false, right: false })
    const twice = drive(newRun(2, 3, 0, 0, 1234), 6, { to: 3, left: false, right: false })
    expect(twice.score).toBe(once.score)
    expect(twice.hits).toBe(once.hits)
    expect(twice.blocks.map((b) => b.count)).toEqual(once.blocks.map((b) => b.count))
  })

  it('does not depend on how finely it is stepped', () => {
    /*
     * The house rule: a slow device drops frames, it does not play the game in
     * slow motion. Coarse and fine stepping are not identical — the dice are
     * drawn once a step — but the mob has to be in nearly the same place.
     */
    const fine = drive(newRun(3, 3, 0, 0, 99), 5, { to: 4, left: false, right: false })
    let coarse = newRun(3, 3, 0, 0, 99)
    for (let i = 0; i < Math.round(5 / (FIXED * 8)); i++) {
      if (coarse.status !== 'playing') break
      coarse = step(coarse, { to: 4, left: false, right: false }, FIXED * 8)
    }
    expect(coarse.clock).toBeCloseTo(fine.clock, 1)
    const low = (run: Run) => Math.max(...run.blocks.map((b) => b.y), -99)
    expect(Math.abs(low(coarse) - low(fine))).toBeLessThan(0.3)
  })

  it('stops stepping once it is over', () => {
    const over = { ...empty({ lives: 0, status: 'over' as const }), score: 40 }
    const after = step(over, NO_INPUT, FIXED)
    expect(after.score).toBe(40)
    expect(after.clock).toBe(over.clock)
    expect(after.events).toHaveLength(0)
  })
})

// --- helpers ----------------------------------------------------------------

/** Real dice, seeded, matching what the game uses. */
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

const idFrom = (from: number) => {
  let id = from
  return () => id++
}
