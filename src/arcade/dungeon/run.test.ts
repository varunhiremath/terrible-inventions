import { describe, expect, it } from 'vitest'
import type { Level } from './level'
import { NO_INPUT, type Input } from './prince'
import { FPS } from './sequences'
import { LEVELS, levelFor } from './levels'
import { RUN_SECONDS, fightingGuard, gatesOpen, minutesLeft, newRun, step, type Run } from './run'
import { REACH, TIMING, guardChoice, newFighter, order, stepFighter } from './combat'

const roll = () => 0.5
const held = (over: Partial<Input>): Input => ({ ...NO_INPUT, ...over })

function play(run: Run, frames: number, input: Input = NO_INPUT, move: Parameters<typeof step>[2] = 'none') {
  let out = run
  for (let i = 0; i < frames && out.status === 'playing'; i++) out = step(out, input, move, roll)
  return out
}

describe('the clock', () => {
  it('starts with the whole hour', () => {
    expect(minutesLeft(newRun(levelFor(1)))).toBe(60)
    expect(newRun(levelFor(1)).framesLeft).toBe(RUN_SECONDS * FPS)
  })

  it('runs down while you play', () => {
    const later = play(newRun(levelFor(1)), FPS * 10)
    expect(later.framesLeft).toBeLessThan(RUN_SECONDS * FPS)
  })

  it('does not go back when you die and try again', () => {
    /*
     * The whole point of it. A level is not a thing you survive, it is a thing
     * you spend, and dying costs you nothing except the time already gone --
     * which is exactly why it hurts.
     */
    const run = play(newRun(levelFor(1)), FPS * 30)
    const again = newRun(run.level, run.number, run.framesLeft, run.hasSword, run.maxHealth)
    expect(again.framesLeft).toBe(run.framesLeft)
    expect(again.framesLeft).toBeLessThan(RUN_SECONDS * FPS)
  })

  it('carries across levels rather than resetting', () => {
    const first = play(newRun(levelFor(1)), FPS * 60)
    const second = newRun(levelFor(2), 2, first.framesLeft, first.hasSword, first.maxHealth)
    expect(minutesLeft(second)).toBeLessThan(60)
  })

  it('ends the run when it runs out', () => {
    const nearly = newRun(levelFor(1), 1, 3)
    expect(play(nearly, 10).status).toBe('outOfTime')
  })

  it('warns at the marks the original warns at', () => {
    const marks = [15, 10, 5, 1]
    for (const mark of marks) {
      const run = newRun(levelFor(1), 1, mark * 60 * FPS + 2)
      const after = play(run, 4)
      expect(after.message).toMatch(new RegExp(`${mark} MINUTES? LEFT`))
    }
  })
})

describe('the sword', () => {
  it('is not his to begin with', () => {
    expect(newRun(levelFor(1)).hasSword).toBe(false)
  })

  it('is picked up by standing on it', () => {
    const level = levelFor(1)
    const sword = level.rows.flatMap((row, r) => [...row].map((t, c) => ({ t, c, r }))).find((x) => x.t === 's')!
    const run = newRun(level)
    const on = { ...run, prince: { ...run.prince, col: sword.c, row: sword.r } }
    const after = step(on, NO_INPUT, 'none', roll)
    expect(after.hasSword).toBe(true)
    expect(after.message).toBe('A SWORD')
  })

  it('cannot be picked up twice, because it is gone once taken', () => {
    const level = levelFor(1)
    const sword = level.rows.flatMap((row, r) => [...row].map((t, c) => ({ t, c, r }))).find((x) => x.t === 's')!
    const run = newRun(level)
    const taken = step({ ...run, prince: { ...run.prince, col: sword.c, row: sword.r } }, NO_INPUT, 'none', roll)
    expect(taken.level.rows[sword.r][sword.c]).not.toBe('s')
  })
})

/** One floor, a plate on it, and a gate further along. */
function plated(): Level {
  return {
    name: 'plate',
    start: { col: 2, row: 1, facing: 1 },
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X###.####|###################X',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    ],
  }
}

describe('gates and plates', () => {
  it('opens every gate for a while when a plate is stood on', () => {
    // Its own level rather than whichever shipped one happens to have a plate
    // in it. This is a test of the mechanism, and it should not start failing
    // because a level was redrawn.
    const level = plated()
    const run = newRun(level, 2)
    expect(gatesOpen(run)).toBe(false)
    const pressed = step({ ...run, prince: { ...run.prince, col: 4, row: 1 } }, NO_INPUT, 'none', roll)
    expect(gatesOpen(pressed)).toBe(true)
  })

  it('lets them shut again, so a plate is not a permanent key', () => {
    const level = LEVELS[1]
    const run = newRun(level, 2)
    const open = { ...run, gateFrames: 3 }
    expect(gatesOpen(play(open, 10))).toBe(false)
  })
})

describe('a duel', () => {
  it('starts when a guard is on your floor and you have a blade', () => {
    const level = LEVELS[1]
    const guard = level.guards![0]
    const run = { ...newRun(level, 2), hasSword: true }
    const near = { ...run, prince: { ...run.prince, col: guard.col - 1.2, row: guard.row } }
    expect(fightingGuard(near)).not.toBeNull()
  })

  it('does not start on another floor', () => {
    const level = LEVELS[1]
    const guard = level.guards![0]
    const run = { ...newRun(level, 2), hasSword: true }
    const above = { ...run, prince: { ...run.prince, col: guard.col, row: guard.row - 1 } }
    expect(fightingGuard(above)).toBeNull()
  })

  it('lands a blade on the frame it is meant to, and not before', () => {
    let me = order(newFighter(0, 1, 4), 'strike')
    let him = newFighter(1, -1, 0)
    for (let i = 1; i < TIMING.strikeLands; i++) {
      const bout = stepFighter(me, him, 1)
      me = bout.attacker
      him = bout.defender
      expect(bout.event).toBe('none')
    }
    const landing = stepFighter(me, him, 1)
    expect(landing.event).toBe('hit')
    expect(landing.defender.health).toBe(him.health - 1)
  })

  it('turns a blade aside when the other man is parrying', () => {
    let me = order(newFighter(0, 1, 4), 'strike')
    const him = order(newFighter(1, -1, 3), 'parry')
    for (let i = 1; i < TIMING.strikeLands; i++) me = stepFighter(me, him, 1).attacker
    const bout = stepFighter(me, him, 1)
    expect(bout.event).toBe('parried')
    expect(bout.defender.health).toBe(him.health)
  })

  it('misses from out of reach', () => {
    let me = order(newFighter(0, 1, 4), 'strike')
    const him = newFighter(9, -1, 0)
    for (let i = 1; i < TIMING.strikeLands; i++) me = stepFighter(me, him, 9).attacker
    expect(stepFighter(me, him, 9).event).toBe('miss')
  })

  it('makes a better guard parry more of what comes at him', () => {
    const tries = 100
    const parries = (skill: number) => {
      let count = 0
      for (let i = 0; i < tries; i++) {
        if (guardChoice(newFighter(1, -1, skill), REACH * 0.8, true, i / tries) === 'parry') count++
      }
      return count
    }
    // Harder by being *better*, which is the only kind of harder worth having.
    expect(parries(4)).toBeGreaterThan(parries(0))
  })

  it('closes the distance when it is out of reach', () => {
    expect(guardChoice(newFighter(9, -1, 2), 6, false, 0.1)).toBe('advance')
  })

  it('backs off when it is far too close to swing', () => {
    expect(guardChoice(newFighter(1, -1, 2), 0.4, false, 0.9)).toBe('retreat')
  })
})

describe('being reproducible', () => {
  it('plays out identically from identical input', () => {
    const a = play(newRun(levelFor(3), 3), 200, held({ right: true }))
    const b = play(newRun(levelFor(3), 3), 200, held({ right: true }))
    expect(a.prince.col).toBeCloseTo(b.prince.col, 9)
    expect(a.framesLeft).toBe(b.framesLeft)
    expect(a.guards.map((g) => g.health)).toEqual(b.guards.map((g) => g.health))
  })
})

describe('meeting a guard with no sword', () => {
  /*
   * All of this came from one report: "I reached the part where I saw a
   * soldier. I didn't have the sword... the soldier seemed frozen. He didn't
   * attack me."
   *
   * Both halves were true. A duel only runs when the prince is armed, so an
   * unarmed encounter ran no duel at all — the guard stood still and the
   * prince walked through him. And the sword lies on floor one and nowhere
   * else, off the shortest way to the door, so walking past it once meant
   * meeting every guard in the game unarmed with no way back.
   */
  const corridor: Level = {
    name: 'corridor',
    rows: ['#'.repeat(30), '#'.repeat(30), '#'.repeat(30)],
    start: { col: 2, row: 1, facing: 1 },
    guards: [{ col: 12, row: 1, facing: -1, skill: 0, colour: 'guard' }],
  }

  it('bars the way rather than standing there', () => {
    const run = play(newRun(corridor, 1), 400, held({ right: true }))
    expect(run.prince.col).toBeLessThan(12)
  })

  it('says why, so it is a reason to go and look rather than a mystery', () => {
    const run = play(newRun(corridor, 1), 400, held({ right: true }))
    expect(run.message).toMatch(/sword/i)
  })

  it('lets him straight past once he is armed', () => {
    const run = play(newRun(corridor, 1, RUN_SECONDS * FPS, true), 400, held({ right: true }))
    expect(run.prince.col).toBeGreaterThan(2)
  })

  it('leaves the first floor as the place you find it', () => {
    // Handing one over on floor one would throw away the only moment the
    // pickup is meant to be.
    expect(newRun(levelFor(1), 1).hasSword).toBe(false)
  })

  it('never strands anyone on a later guarded floor', () => {
    for (const [i, level] of LEVELS.entries()) {
      const number = i + 1
      if (number === 1 || (level.guards?.length ?? 0) === 0) continue
      expect(newRun(level, number).hasSword, `${number}. ${level.name}`).toBe(true)
    }
  })

  it('keeps a sword you already had', () => {
    const run = newRun(levelFor(3), 3, RUN_SECONDS * FPS, true)
    expect(run.hasSword).toBe(true)
  })
})

describe('the sword itself', () => {
  it('is somewhere on the first floor', () => {
    const swords = levelFor(1).rows.reduce((n, row) => n + [...row].filter((t) => t === 's').length, 0)
    expect(swords).toBeGreaterThan(0)
  })
})

describe('fighting near an edge', () => {
  /*
   * "I'm standing in air, and even the soldier sometimes."
   *
   * A duel sets both fighters' columns straight from the combat code, which
   * knows about reach and timing and nothing whatsoever about the level — and
   * the movement code that handles falling is not run while a fight is on. So
   * giving ground during a fight walked either of them off the end of a ledge
   * and left them swinging over the gap.
   */
  const brink: Level = {
    name: 'brink',
    // Floor from 1 to 10, then nothing. Both of them start on it.
    rows: ['XXXXXXXXXXXXXXXX', 'X##########     ', 'X##############X'],
    start: { col: 9, row: 1, facing: 1 },
    guards: [{ col: 10, row: 1, facing: -1, skill: 0, colour: 'guard' }],
  }

  const solid = (run: Run, col: number) =>
    ['#', 'X'].includes(run.level.rows[1][Math.round(col)] ?? ' ')

  it('never leaves the prince over the gap while a fight is on', () => {
    // Only while fighting. Walking off a ledge under your own steam and
    // falling is the game working; it is being held up by nothing that is not.
    let run = newRun(brink, 1, RUN_SECONDS * FPS, true)
    for (let i = 0; i < 600; i++) {
      run = step(run, held({ right: true }), 'strike', roll)
      if (run.status !== 'playing') break
      if (!fightingGuard(run)) continue
      expect(solid(run, run.prince.col), `frame ${i} at col ${run.prince.col}`).toBe(true)
    }
  })

  it('never leaves a guard over the gap either', () => {
    let run = newRun(brink, 1, RUN_SECONDS * FPS, true)
    for (let i = 0; i < 600; i++) {
      run = step(run, held({ left: true }), 'parry', roll)
      if (run.status !== 'playing') break
      if (!fightingGuard(run)) continue
      for (const guard of run.guards) {
        if (guard.health <= 0) continue
        expect(solid(run, guard.col), `frame ${i} guard at ${guard.col}`).toBe(true)
      }
    }
  })
})
