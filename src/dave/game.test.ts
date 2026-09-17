import { describe, expect, it } from 'vitest'
import { LEVEL_TILES_X, TILE, normalise, onPath, pathLength, type Level } from './level'
import { NO_INPUT, type Input } from './physics'
import {
  BULLET_SPEED,
  MONSTER_WORTH,
  STARTING_LIVES,
  newGame,
  respawn,
  shoot,
  step,
  type Game,
} from './game'

const FIXED = 1 / 120
const held = (over: Partial<Input>): Input => ({ ...NO_INPUT, ...over })

/** A flat level with things written into it at given columns of row 8. */
function level(row8: Record<number, string> = {}, extra: Partial<Level> = {}): Level {
  const floor = '#'.repeat(LEVEL_TILES_X)
  const sky = ' '.repeat(LEVEL_TILES_X)
  const eight = Array.from({ length: LEVEL_TILES_X }, (_, x) => row8[x] ?? ' ').join('')
  return normalise({
    name: 'test',
    start: { x: 2, y: 8 },
    rows: [sky, sky, sky, sky, sky, sky, sky, sky, eight, floor],
    ...extra,
  })
}

function run(game: Game, input: Input, seconds: number): Game {
  let out = game
  for (let t = 0; t < seconds; t += FIXED) out = step(out, input, FIXED)
  return out
}

describe('picking things up', () => {
  it('scores each pickup at its own worth, once', () => {
    const lv = level({ 5: TILE.GUMBALL, 7: TILE.CROWN })
    const after = run(newGame(lv), held({ right: true }), 1.5)
    expect(after.score).toBe(15 + 500)
    // Walking back over them is worth nothing.
    const back = run(after, held({ left: true }), 1.5)
    expect(back.score).toBe(15 + 500)
  })

  it('takes the trophy and says so', () => {
    const lv = level({ 6: TILE.TROPHY })
    const after = run(newGame(lv), held({ right: true }), 1)
    expect(after.dave.hasTrophy).toBe(true)
    expect(after.score).toBe(1000)
    expect(after.message).toBe('GO THRU THE DOOR')
  })

  it('stops saying so after a moment', () => {
    const lv = level({ 6: TILE.TROPHY })
    const after = run(newGame(lv), held({ right: true }), 5)
    expect(after.message).toBeNull()
  })

  it('fills the tank from a jetpack', () => {
    const lv = level({ 6: TILE.JETPACK })
    const after = run(newGame(lv), held({ right: true }), 1)
    expect(after.dave.hasJetpack).toBe(true)
    expect(after.dave.fuel).toBeGreaterThan(10)
  })

  it('picks up the gun', () => {
    const lv = level({ 6: TILE.GUN })
    const after = run(newGame(lv), held({ right: true }), 1)
    expect(after.dave.hasGun).toBe(true)
  })
})

describe('the door', () => {
  it('will not open without the trophy', () => {
    const lv = level({ 6: TILE.DOOR })
    const after = run(newGame(lv), held({ right: true }), 1.5)
    expect(after.status).toBe('playing')
  })

  it('finishes the level once the trophy is taken', () => {
    const lv = level({ 5: TILE.TROPHY, 8: TILE.DOOR })
    const after = run(newGame(lv), held({ right: true }), 2)
    expect(after.status).toBe('levelComplete')
    expect(after.score).toBe(1000 + 2000)
  })
})

describe('dying', () => {
  it('costs a life and can end the run', () => {
    const lv = level({ 6: TILE.FIRE })
    const died = run(newGame(lv), held({ right: true }), 1.5)
    expect(died.status).toBe('died')
    expect(died.lives).toBe(STARTING_LIVES - 1)
  })

  it('ends the game when the last life goes', () => {
    const lv = level({ 6: TILE.FIRE })
    const died = run(newGame(lv, 1, 1), held({ right: true }), 1.5)
    expect(died.status).toBe('gameOver')
  })

  it('puts him back at the start of the same level, with his score', () => {
    const lv = level({ 4: TILE.CROWN, 6: TILE.FIRE })
    const died = run(newGame(lv), held({ right: true }), 1.5)
    const again = respawn(died)
    expect(again.status).toBe('playing')
    expect(again.score).toBe(died.score)
    expect(again.dave.x).toBeCloseTo(lv.start.x + 0.5, 6)
    // The level is laid out fresh, so what he collected is back.
    expect(again.taken.size).toBe(0)
  })

  it('stops the world once it is over', () => {
    const lv = level({ 6: TILE.FIRE })
    const died = run(newGame(lv), held({ right: true }), 1.5)
    expect(run(died, held({ right: true }), 1)).toEqual(died)
  })
})

describe('the gun', () => {
  const armed = () => {
    const lv = level({ 4: TILE.GUN })
    return run(newGame(lv), held({ right: true }), 0.6)
  }

  it('does nothing until he has one', () => {
    const plain = run(newGame(level()), NO_INPUT, 0.5)
    expect(shoot(plain).bullets).toHaveLength(0)
  })

  it('fires the way he is facing', () => {
    const game = shoot(armed())
    expect(game.bullets).toHaveLength(1)
    expect(game.bullets[0].vx).toBeCloseTo(BULLET_SPEED, 6)
  })

  it('allows only one bullet on screen at a time', () => {
    // The rule that stops the gun trivialising the game.
    let game = shoot(armed())
    game = shoot(game)
    game = shoot(game)
    expect(game.bullets.filter((b) => b.mine)).toHaveLength(1)
  })

  it('lets him fire again once the last one has left the screen', () => {
    // Off the screen, not off the level: a shot that visibly missed must not
    // keep the gun locked while it travels on out of sight.
    let game = shoot(armed())
    game = run(game, NO_INPUT, 1)
    expect(game.bullets.filter((b) => b.mine)).toHaveLength(0)
    expect(shoot(game).bullets.filter((b) => b.mine)).toHaveLength(1)
  })

  it('stops at a wall rather than shooting through it', () => {
    const lv = level({ 4: TILE.GUN, 9: TILE.BRICK })
    let game = run(newGame(lv), held({ right: true }), 0.6)
    game = shoot(game)
    game = run(game, NO_INPUT, 1)
    expect(game.bullets).toHaveLength(0)
  })
})

describe('creatures', () => {
  const walker: Partial<Level> = {
    monsters: [{ at: { x: 10, y: 7 }, kind: 'orb', phase: 0 }],
    path: { points: [{ x: 0, y: 0 }, { x: 3, y: 0 }], speed: 4 },
  }

  it('walks its loop and comes back to where it started', () => {
    const lv = level({}, walker)
    const game = newGame(lv)
    const started = { x: game.monsters[0].x, y: game.monsters[0].y }
    const round = pathLength(lv.path!) / lv.path!.speed
    const later = run(game, NO_INPUT, round)
    expect(later.monsters[0].x).toBeCloseTo(started.x, 1)
    expect(later.monsters[0].y).toBeCloseTo(started.y, 1)
  })

  it('actually moves along the way', () => {
    const lv = level({}, walker)
    const game = newGame(lv)
    const later = run(game, NO_INPUT, 0.4)
    expect(Math.abs(later.monsters[0].x - game.monsters[0].x)).toBeGreaterThan(0.5)
  })

  it('kills him on touch', () => {
    const lv = level({}, {
      monsters: [{ at: { x: 6, y: 8 }, kind: 'spider', phase: 0 }],
      path: { points: [{ x: 0, y: 0 }], speed: 0 },
    })
    const after = run(newGame(lv), held({ right: true }), 1.5)
    expect(after.dave.alive).toBe(false)
  })

  it('can be shot, and is worth something', () => {
    const lv = level({ 4: TILE.GUN }, {
      // A late phase, so it does not shoot him before he can shoot it.
      monsters: [{ at: { x: 14, y: 8 }, kind: 'spider', phase: 1 }],
      path: { points: [{ x: 0, y: 0 }], speed: 0 },
    })
    let game = run(newGame(lv), held({ right: true }), 0.6)
    const before = game.score
    game = shoot(game)
    game = run(game, NO_INPUT, 1)
    expect(game.monsters[0].alive).toBe(false)
    expect(game.score).toBe(before + MONSTER_WORTH)
  })

  it('gives him a moment before anything shoots at him', () => {
    const lv = level({}, {
      monsters: [{ at: { x: 9, y: 8 }, kind: 'saucer', phase: 0 }],
      path: { points: [{ x: 0, y: 0 }], speed: 0 },
    })
    const opening = run(newGame(lv), NO_INPUT, 1)
    expect(opening.bullets).toHaveLength(0)
    expect(opening.dave.alive).toBe(true)
  })

  it('shoots back, and its bullets kill', () => {
    const lv = level({}, {
      monsters: [{ at: { x: 9, y: 8 }, kind: 'saucer', phase: 0 }],
      path: { points: [{ x: 0, y: 0 }], speed: 0 },
    })
    const after = run(newGame(lv), NO_INPUT, 6)
    expect(after.dave.alive).toBe(false)
  })

  it('does not fire at someone it cannot see', () => {
    const lv = level({}, {
      monsters: [{ at: { x: 80, y: 8 }, kind: 'saucer', phase: 0 }],
      path: { points: [{ x: 0, y: 0 }], speed: 0 },
    })
    const after = run(newGame(lv), NO_INPUT, 6)
    expect(after.dave.alive).toBe(true)
  })
})

describe('being reproducible', () => {
  it('plays out identically from identical input', () => {
    const lv = level({ 5: TILE.CROWN }, {
      monsters: [{ at: { x: 12, y: 7 }, kind: 'orb', phase: 0.3 }],
      path: { points: [{ x: 0, y: 0 }, { x: 2, y: -2 }], speed: 3 },
    })
    const a = run(newGame(lv), held({ right: true }), 2)
    const b = run(newGame(lv), held({ right: true }), 2)
    expect(a.score).toBe(b.score)
    expect(a.dave).toEqual(b.dave)
    expect(a.monsters.map((m) => m.x)).toEqual(b.monsters.map((m) => m.x))
  })
})

describe('the path itself', () => {
  const path = { points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], speed: 1 }

  it('starts and ends in the same place, because it is a loop', () => {
    expect(onPath(path, 0)).toEqual(onPath(path, 1))
    expect(onPath(path, 0)).toEqual(onPath(path, 3))
  })

  it('moves smoothly between its corners', () => {
    const quarter = onPath(path, 1 / 6)
    expect(quarter.x).toBeGreaterThan(0)
    expect(quarter.x).toBeLessThan(2)
  })

  it('measures its own length, so speed can mean tiles per second', () => {
    // 2 across, 2 down, then the diagonal back: 2 + 2 + sqrt(8).
    expect(pathLength(path)).toBeCloseTo(4 + Math.sqrt(8), 6)
  })

  it('copes with a creature that does not move at all', () => {
    expect(onPath({ points: [{ x: 1, y: 1 }], speed: 0 }, 0.7)).toEqual({ x: 1, y: 1 })
    expect(pathLength({ points: [{ x: 1, y: 1 }], speed: 0 })).toBe(0)
  })
})
