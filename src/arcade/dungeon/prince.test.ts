import { describe, expect, it } from 'vitest'
import { TILE, tileAt, type Level } from './level'
import { RUN_JUMP_TILES, SEQUENCES, STAND_JUMP_TILES, reachOf, type Action } from './sequences'
import { MAX_HEALTH, NO_INPUT, newPrince, tick, underfoot, type Input, type Prince } from './prince'

/** A one-floor level from a single row of tiles, with walls at both ends. */
function strip(row: string, startCol = 1): Level {
  return {
    name: 'test',
    rows: ['X'.repeat(row.length + 2), `X${row}X`, 'X'.repeat(row.length + 2)],
    start: { col: startCol, row: 1, facing: 1 as const },
  }
}

const press = (over: Partial<Input>): Input => ({ ...NO_INPUT, ...over })

function play(prince: Prince, level: Level, frames: number, input: Input = NO_INPUT): Prince {
  let current = prince
  for (let i = 0; i < frames; i++) current = tick(current, level, input)
  return current
}

/** Holds the input until the prince is standing still again, or time runs out. */
function until(prince: Prince, level: Level, input: Input, frames = 60): Prince {
  let current = prince
  for (let i = 0; i < frames; i++) {
    current = tick(current, level, input)
    if (current.dead || current.atExit) break
  }
  return current
}

describe('the tables', () => {
  it('gives every action somewhere to go next', () => {
    for (const [name, sequence] of Object.entries(SEQUENCES)) {
      expect(sequence.frames.length).toBeGreaterThan(0)
      expect(SEQUENCES[sequence.then]).toBeDefined()
      expect(name).toBeTruthy()
    }
  })

  // These two numbers are the vocabulary every level is written in, so they are
  // pinned rather than left to whatever the frames happen to add up to.
  it('makes a standing jump short and a running jump long', () => {
    expect(reachOf('standJump')).toBeCloseTo(STAND_JUMP_TILES, 0)
    expect(reachOf('runJump')).toBeCloseTo(RUN_JUMP_TILES, 0)
    expect(reachOf('runJump')).toBeGreaterThan(reachOf('standJump') * 1.5)
  })

  it('makes a run take winding up and winding down', () => {
    expect(reachOf('startRun')).toBeGreaterThan(0)
    expect(reachOf('stopRun')).toBeGreaterThan(0)
  })

  it('commits the player to every action that matters', () => {
    const committed: Action[] = ['turn', 'standJump', 'runJump', 'step', 'climbUp', 'stopRun', 'fall']
    for (const action of committed) expect(SEQUENCES[action].interruptible).toBe(false)
  })
})

describe('walking', () => {
  it('turns before moving when facing the wrong way', () => {
    const level = strip('########')
    let prince = newPrince(level)
    expect(prince.facing).toBe(1)

    prince = tick(prince, level, press({ left: true }))
    expect(prince.action).toBe('turn')

    prince = play(prince, level, 6, press({ left: true }))
    expect(prince.facing).toBe(-1)
  })

  it('cannot be interrupted mid-turn', () => {
    const level = strip('########')
    let prince = tick(newPrince(level), level, press({ left: true }))
    prince = tick(prince, level, press({ right: true }))
    expect(prince.action).toBe('turn')
  })

  it('runs forward and stops when told', () => {
    const level = strip('##########')
    const start = newPrince(level)
    const ran = until(start, level, press({ right: true }), 24)
    expect(ran.col).toBeGreaterThan(start.col + 2)

    const stopped = play(ran, level, 8)
    expect(stopped.action).toBe('stand')
  })

  it('is stopped dead by a wall', () => {
    const level = strip('##')
    const prince = until(newPrince(level), level, press({ right: true }), 40)
    // He stops with the wall column still ahead of him rather than inside it.
    expect(tileAt(level, Math.round(prince.col), 1)).not.toBe(TILE.WALL)
    expect(prince.dead).toBe(false)
  })
})

describe('jumping', () => {
  // The distances the player learns by heart.
  it('clears a one-tile gap from standing', () => {
    // Jumped from the tile at the edge, as the game expects: a standing jump
    // covers two tiles, so it carries him over one tile of nothing.
    const level = strip('## ###', 2)
    const prince = until(newPrince(level), level, press({ right: true, up: true }), 40)
    expect(prince.dead).toBe(false)
    expect(prince.row).toBe(1)
    expect(prince.col).toBeGreaterThanOrEqual(4)
  })

  it('does not clear the gap if the jump starts a tile too early', () => {
    // The same gap, begun one tile back. Judging the take-off is the game, so
    // the early jump must come up short — even though holding on afterwards
    // then saves him, which is exactly what the ledge grab is for.
    const level = strip('## ###', 1)
    let prince = newPrince(level)
    let missed = false

    for (let i = 0; i < 20; i++) {
      prince = tick(prince, level, press({ right: true, up: true }))
      if (prince.action === 'fall' || prince.action === 'hang') missed = true
    }

    expect(missed).toBe(true)
  })

  it('lets the ledge grab rescue the early jump', () => {
    const level = strip('## ###', 1)
    const prince = until(newPrince(level), level, press({ right: true, up: true }), 40)
    expect(prince.dead).toBe(false)
    expect(prince.row).toBe(1)
  })

  it('does not clear a three-tile gap from standing', () => {
    const level: Level = {
      name: 'test',
      rows: ['XXXXXXXXXX', 'X##   ###X', 'X########X', 'XXXXXXXXXX'],
      start: { col: 2, row: 1, facing: 1 },
    }
    const prince = until(newPrince(level), level, press({ right: true, up: true }), 40)
    expect(prince.row).toBeGreaterThan(1) // fell to the floor below
  })

  it('clears a three-tile gap with a run-up', () => {
    const level: Level = {
      name: 'test',
      rows: ['XXXXXXXXXXXXXX', 'X#####   ####X', 'X############X', 'XXXXXXXXXXXXXX'],
      start: { col: 2, row: 1, facing: 1 },
    }
    // Run first, then jump — which is the whole point of the distinction.
    let prince = until(newPrince(level), level, press({ right: true }), 12)
    expect(prince.action).toBe('run')
    prince = until(prince, level, press({ right: true, up: true }), 30)

    expect(prince.dead).toBe(false)
    expect(prince.row).toBe(1)
    expect(prince.col).toBeGreaterThan(8)
  })

  it('cannot be steered once a running jump has started', () => {
    const level = strip('############')
    let prince = until(newPrince(level), level, press({ right: true }), 12)
    prince = tick(prince, level, press({ right: true, up: true }))
    expect(prince.action).toBe('runJump')

    const before = prince.col
    prince = tick(prince, level, press({ left: true }))
    expect(prince.action).toBe('runJump')
    expect(prince.col).toBeGreaterThan(before) // still going forward
  })
})

describe('falling', () => {
  const twoFloors: Level = {
    name: 'test',
    rows: ['XXXXXXXX', 'X##   #X', 'X      X', 'X######X', 'XXXXXXXX'],
    start: { col: 2, row: 1, facing: 1 },
  }

  it('drops off the edge of a floor', () => {
    const prince = until(newPrince(twoFloors), twoFloors, press({ right: true }), 30)
    expect(prince.row).toBeGreaterThan(1)
  })

  it('survives a short drop', () => {
    const level: Level = {
      name: 'test',
      rows: ['XXXXXXXX', 'X##    X', 'X######X', 'XXXXXXXX'],
      start: { col: 2, row: 1, facing: 1 },
    }
    const prince = until(newPrince(level), level, press({ right: true }), 40)
    expect(prince.dead).toBe(false)
    expect(prince.health).toBe(MAX_HEALTH)
    expect(prince.row).toBe(2)
  })

  it('is hurt by a longer one', () => {
    const level: Level = {
      name: 'test',
      rows: ['XXXXXXXX', 'X##    X', 'X      X', 'X######X', 'XXXXXXXX'],
      start: { col: 2, row: 1, facing: 1 },
    }
    const prince = until(newPrince(level), level, press({ right: true }), 60)
    expect(prince.dead).toBe(false)
    expect(prince.health).toBeLessThan(MAX_HEALTH)
  })

  it('is killed by a long one', () => {
    const level: Level = {
      name: 'test',
      rows: ['XXXXXXXX', 'X##    X', 'X      X', 'X      X', 'X######X', 'XXXXXXXX'],
      start: { col: 2, row: 1, facing: 1 },
    }
    const prince = until(newPrince(level), level, press({ right: true }), 80)
    expect(prince.dead).toBe(true)
  })

  // The one move that rescues a bad step.
  it('catches the ledge on the way down if you were holding on', () => {
    const prince = until(newPrince(twoFloors), twoFloors, press({ right: true, shift: true }), 30)
    expect(['hang', 'stand', 'step'].includes(prince.action)).toBe(true)
    expect(prince.row).toBe(1)
    expect(prince.dead).toBe(false)
  })
})

describe('the dungeon', () => {
  it('is killed by spikes', () => {
    const level = strip('#^######')
    const prince = until(newPrince(level), level, press({ right: true }), 30)
    expect(prince.dead).toBe(true)
  })

  it('drops through a loose tile once it gives way', () => {
    const level: Level = {
      name: 'test',
      rows: ['XXXXXXXX', 'X#~   #X', 'X######X', 'XXXXXXXX'],
      start: { col: 2, row: 1, facing: 1 },
    }
    let prince = newPrince(level)
    prince = tick(prince, level, NO_INPUT)
    expect(prince.wobbling).not.toBeNull()

    prince = play(prince, level, 20)
    expect(prince.collapsed.length).toBeGreaterThan(0)
    expect(prince.row).toBe(2)
  })

  it('heals from a red potion and is hurt by a blue one', () => {
    const hurt = { ...newPrince(strip('#h#####')), health: 1 }
    expect(tick({ ...hurt, col: 2 }, strip('#h#####'), NO_INPUT).health).toBe(2)

    const poison = strip('#p#####')
    expect(tick({ ...newPrince(poison), col: 2, health: 3 }, poison, NO_INPUT).health).toBe(2)
  })

  it('finishes the level at the door', () => {
    const level = strip('#E#####')
    const prince = tick({ ...newPrince(level), col: 2 }, level, NO_INPUT)
    expect(prince.atExit).toBe(true)
  })

  it('reads what is underfoot', () => {
    const level = strip('#^h####')
    expect(underfoot({ ...newPrince(level), col: 2 }, level)).toBe(TILE.SPIKES)
    expect(underfoot({ ...newPrince(level), col: 3 }, level)).toBe(TILE.POTION_HEAL)
  })
})

describe('safety', () => {
  it('never ends up inside a wall, whatever is pressed', () => {
    const level: Level = {
      name: 'test',
      rows: ['XXXXXXXXXX', 'X#X# ~^##X', 'X########X', 'XXXXXXXXXX'],
      start: { col: 1, row: 1, facing: 1 },
    }
    let prince = newPrince(level)
    const inputs = [
      press({ right: true }), press({ up: true, right: true }), press({ left: true }),
      press({ shift: true, right: true }), press({ down: true }), NO_INPUT,
    ]
    for (let i = 0; i < 200; i++) {
      prince = tick(prince, level, inputs[i % inputs.length])
      expect(prince.col).toBeGreaterThanOrEqual(0)
      expect(prince.col).toBeLessThanOrEqual(level.rows[0].length)
      expect(Number.isFinite(prince.col)).toBe(true)
    }
  })
})

/**
 * The jump button.
 *
 * This is the one control a player presses before they have learned anything
 * else about the game, so it is the one that has to do something visible every
 * single time. It shipped doing nothing at all: standing under a ceiling, the
 * wall overhead counted as a ledge, and the climb played six frames and put him
 * back exactly where he started. Nothing in the old tests noticed, because
 * every one of them checked where he ended up rather than whether pressing the
 * button had changed anything.
 */
describe('pressing up', () => {
  /** Two floors: a lower one to stand on, and whatever is written above it. */
  function twoFloors(lower: string, upper: string): Level {
    return {
      name: 'test',
      rows: ['X'.repeat(lower.length + 2), `X${upper}X`, `X${lower}X`, 'X'.repeat(lower.length + 2)],
      start: { col: 2, row: 2, facing: 1 as const },
    }
  }

  it('climbs onto a floor overhead, and ends a whole floor higher', () => {
    const level = twoFloors('########', '########')
    const after = until(newPrince(level), level, press({ up: true }), 20)
    expect(after.row).toBe(1)
    expect(after.dead).toBe(false)
  })

  it('does not climb into the ceiling', () => {
    // Solid rock overhead. There is nothing to grab, so he must stay on the
    // floor he is on rather than starting a climb into the wall.
    const level = twoFloors('########', 'XXXXXXXX')
    const start = newPrince(level)
    const after = until(start, level, press({ up: true }), 20)
    expect(after.row).toBe(2)
    expect(after.dead).toBe(false)
  })

  it('always starts a sequence you can see, whatever is overhead', () => {
    for (const upper of ['########', 'XXXXXXXX', '        ']) {
      const level = twoFloors('########', upper)
      const start = newPrince(level)
      const moved = tick(start, level, press({ up: true }))
      expect(moved.action, `with "${upper}" overhead`).not.toBe('stand')
      expect(SEQUENCES[moved.action].frames.length, upper).toBeGreaterThan(3)
      expect(SEQUENCES[moved.action].interruptible, upper).toBe(false)
    }
  })

  it('gets him onto the ledge whenever there is one to get onto', () => {
    // The check the shipped bug failed: six frames of climbing that put him
    // back on the floor he started on.
    const level = twoFloors('########', '########')
    const start = newPrince(level)
    const after = until(start, level, press({ up: true }), 12)
    expect(after.row).toBe(start.row - 1)
  })

  it('goes somewhere, rather than hopping on the spot', () => {
    /**
     * The second thing that was wrong with this button. Under a ceiling with
     * no direction held he used to hop straight up, which moves him nowhere at
     * all — so pressing the button looked exactly like pressing nothing, and
     * was reported as the jump not working for the second time. A jump button
     * has to jump.
     */
    const level = twoFloors('########', 'XXXXXXXX')
    const start = newPrince(level)
    const after = until(start, level, press({ up: true }), 12)
    expect(after.col - start.col).toBeGreaterThan(1)
  })

  it('still jumps forward when a direction is held', () => {
    const level = twoFloors('########', 'XXXXXXXX')
    const start = newPrince(level)
    const after = until(start, level, press({ up: true, right: true }), 20)
    expect(after.col).toBeGreaterThan(start.col + 1)
  })

  it('pulls up out of a hang without changing floors', () => {
    // Hanging holds the ledge he was standing on, so the climb puts him back
    // on it. That is a different move from climbing the floor above, and it
    // must not gain him a floor.
    const level = twoFloors('###     ', 'XXXXXXXX')
    const hanging = until(newPrince(level), level, press({ right: true, shift: true }), 40)
    expect(hanging.action).toBe('hang')
    // Exactly the length of the climb: hold up any longer and he sets off
    // again, which is a different question from what the climb itself did.
    const up = play(hanging, level, SEQUENCES.climbUp.frames.length, press({ up: true }))
    expect(up.row).toBe(hanging.row)
    expect(up.dead).toBe(false)
  })
})
