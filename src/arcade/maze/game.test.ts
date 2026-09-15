import { describe, expect, it } from 'vitest'
import { PLAYER_START, isWall, key, neighbours, wrapCell } from './maze'
import {
  FRIGHTENED_SECONDS,
  READY_SECONDS,
  STARTING_LIVES,
  dotsRemaining,
  emptyPowerUps,
  newGame,
  positionOf,
  respawn,
  step,
  turn,
  useFreeze,
} from './game'

/** Deterministic wandering, so a frightened chase is reproducible. */
const roll = () => 0.5

/**
 * A game with the opening pause already spent.
 *
 * Most tests are about what happens once play has started, and would otherwise
 * spend their first two seconds watching nothing move. The pause itself is
 * tested separately, on a real `newGame`.
 */
function fresh(...args: Parameters<typeof newGame>) {
  return { ...newGame(...args), readyFor: 0 }
}

function run(game: ReturnType<typeof newGame>, seconds: number, dt = 1 / 60) {
  let current = game
  for (let t = 0; t < seconds; t += dt) current = step(current, dt, roll)
  return current
}

describe('setup', () => {
  it('starts with dots, lives and everyone in place', () => {
    const game = newGame()
    expect(game.lives).toBe(STARTING_LIVES)
    expect(dotsRemaining(game)).toBeGreaterThan(80)
    expect(game.ghosts).toHaveLength(4)
    expect(game.status).toBe('playing')
    expect(isWall(game.player.cell)).toBe(false)
  })

  it('adds shop-bought lives on top', () => {
    expect(newGame(1, { ...emptyPowerUps(), spareLives: 2 }).lives).toBe(STARTING_LIVES + 2)
  })
})

describe('moving', () => {
  it('never walks through a wall, however long it runs', () => {
    let game = fresh()
    for (let i = 0; i < 600; i++) {
      game = step(game, 1 / 60, roll)
      expect(isWall(game.player.cell)).toBe(false)
      for (const ghost of game.ghosts) expect(isWall(ghost.cell)).toBe(false)
      if (game.status !== 'playing') break
    }
  })

  // The single most important control detail: a turn pressed slightly early
  // must be remembered, or the game feels broken rather than hard.
  it('remembers a turn pressed before the corner', () => {
    let game = fresh()
    game = turn(game, 'up')
    game = run(game, 0.6)
    expect(game.player.dir).toBe('up')
  })

  it('ignores a turn into a wall and carries straight on', () => {
    let game = fresh()
    const before = game.player.dir
    // PLAYER_START sits in a horizontal corridor, so down is blocked.
    const blocked = isWall(wrapCell({ x: PLAYER_START.x, y: PLAYER_START.y + 1 }))
    if (blocked) {
      game = turn(game, 'down')
      game = run(game, 0.3)
      expect(game.player.dir).toBe(before)
    }
  })

  it('stops dead at a wall rather than jittering', () => {
    let game = fresh()
    game = run(game, 6)
    expect(game.player.progress).toBeGreaterThanOrEqual(0)
    expect(game.player.progress).toBeLessThanOrEqual(1)
  })

  it('draws actors between tiles, not snapped to them', () => {
    const game = run(fresh(), 0.1)
    const at = positionOf(game.player)
    expect(Number.isFinite(at.x)).toBe(true)
    expect(Number.isFinite(at.y)).toBe(true)
  })
})

describe('eating', () => {
  it('clears dots and scores as it goes', () => {
    const start = fresh()
    const after = run(start, 2)
    expect(dotsRemaining(after)).toBeLessThan(dotsRemaining(start))
    expect(after.score).toBeGreaterThan(0)
  })

  it('turns the tables when a power pellet is taken', () => {
    let game = fresh()
    // Drop the player straight onto a pellet.
    const pellet = [...game.power][0].split(',').map(Number)
    game = { ...game, player: { ...game.player, cell: { x: pellet[0], y: pellet[1] }, progress: 0 } }
    game = step(game, 1 / 60, roll)

    expect(game.frightenedFor).toBeCloseTo(FRIGHTENED_SECONDS, 1)
    expect(game.ghosts.every((g) => g.frightened)).toBe(true)
  })

  it('lets the fright wear off', () => {
    let game = fresh()
    const pellet = [...game.power][0].split(',').map(Number)
    game = { ...game, player: { ...game.player, cell: { x: pellet[0], y: pellet[1] }, progress: 0 } }
    game = step(game, 1 / 60, roll)
    game = step(game, FRIGHTENED_SECONDS + 0.1, roll)

    expect(game.frightenedFor).toBe(0)
    expect(game.ghosts.some((g) => g.frightened)).toBe(false)
  })

  it('finishes the level when the maze is clear', () => {
    let game = fresh()
    game = { ...game, dots: new Set(), power: new Set([key({ x: 1, y: 2 })]) }
    game = { ...game, player: { ...game.player, cell: { x: 1, y: 2 }, progress: 0 } }
    expect(step(game, 1 / 60, roll).status).toBe('levelComplete')
  })
})

describe('being caught', () => {
  it('costs a life and can end the game', () => {
    let game = fresh(1, emptyPowerUps(), 1)
    // Put a chaser right on top of the player.
    game = {
      ...game,
      ghosts: game.ghosts.map((g, i) =>
        i === 0 ? { ...g, cell: { ...game.player.cell }, progress: 0 } : g,
      ),
    }
    const after = step(game, 1 / 60, roll)
    expect(after.lives).toBe(0)
    expect(after.status).toBe('gameOver')
  })

  it('keeps the dots already eaten when a life is lost', () => {
    let game = fresh()
    game = run(game, 2)
    const eaten = dotsRemaining(game)
    const back = respawn({ ...game, status: 'died' })

    expect(dotsRemaining(back)).toBe(eaten)
    expect(back.status).toBe('playing')
    expect(back.player.cell).toEqual(PLAYER_START)
  })

  it('eats a frightened chaser instead of dying, for a rising score', () => {
    let game = fresh()
    game = {
      ...game,
      frightenedFor: 5,
      ghosts: game.ghosts.map((g, i) =>
        i === 0 ? { ...g, frightened: true, cell: { ...game.player.cell }, progress: 0 } : g,
      ),
    }
    const after = step(game, 1 / 60, roll)

    expect(after.status).toBe('playing')
    expect(after.lives).toBe(STARTING_LIVES)
    expect(after.score).toBeGreaterThanOrEqual(200)
    expect(after.ghosts[0].eatenFor).toBeGreaterThan(0)
  })

  it('brings an eaten chaser back after a pause', () => {
    let game = fresh()
    game = { ...game, ghosts: game.ghosts.map((g, i) => (i === 0 ? { ...g, eatenFor: 1 } : g)) }
    game = step(game, 1.1, roll)
    expect(game.ghosts[0].eatenFor).toBe(0)
    expect(isWall(game.ghosts[0].cell)).toBe(false)
  })

  it('catches the player across the tunnel seam', () => {
    // Half a tile apart, but on opposite sides of the wrap. A plain subtraction
    // would read them as eighteen tiles apart and miss the catch entirely.
    let game = fresh()
    game = {
      ...game,
      player: { ...game.player, cell: { x: 18, y: 10 }, progress: 0.5, dir: 'right' },
      ghosts: game.ghosts.map((g, i) =>
        i === 0 ? { ...g, cell: { x: 0, y: 10 }, progress: 0, dir: 'right' } : g,
      ),
    }
    expect(step(game, 1 / 60, roll).status).not.toBe('playing')
  })

  it('does not catch the player merely for being near the seam', () => {
    let game = fresh()
    game = {
      ...game,
      player: { ...game.player, cell: { x: 0, y: 10 }, progress: 0, dir: 'left' },
      ghosts: game.ghosts.map((g, i) =>
        i === 0 ? { ...g, cell: { x: 17, y: 10 }, progress: 0, dir: 'right' } : g,
      ),
    }
    expect(step(game, 1 / 60, roll).status).toBe('playing')
  })
})

describe('shop power-ups', () => {
  it('makes a pellet last longer', () => {
    let game = fresh(1, { ...emptyPowerUps(), pelletBoost: 2 })
    const pellet = [...game.power][0].split(',').map(Number)
    game = { ...game, player: { ...game.player, cell: { x: pellet[0], y: pellet[1] }, progress: 0 } }
    game = step(game, 1 / 60, roll)
    expect(game.frightenedFor).toBeCloseTo(FRIGHTENED_SECONDS * 2, 1)
  })

  it('freezes every chaser where it stands, once per freeze bought', () => {
    let game = fresh(1, { ...emptyPowerUps(), freezes: 1 })
    game = useFreeze(game)
    expect(game.powerUps.freezes).toBe(0)

    const before = game.ghosts.map((g) => ({ ...g.cell, p: g.progress }))
    game = step(game, 0.5, roll)
    game.ghosts.forEach((g, i) => {
      expect(g.cell).toEqual({ x: before[i].x, y: before[i].y })
      expect(g.progress).toBe(before[i].p)
    })
  })

  it('does nothing when there is no freeze left', () => {
    const game = fresh()
    expect(useFreeze(game)).toBe(game)
  })
})

describe('the chase is real', () => {
  // The honest version of "can a ghost reach the player": play the actual game
  // with nobody at the controls and see whether they close in.
  it('catches a player who never moves', () => {
    const game = run(fresh(), 40)
    expect(game.lives).toBeLessThan(STARTING_LIVES)
  })

  it('does not catch him instantly either', () => {
    const early = run(fresh(), 3)
    expect(early.lives).toBe(STARTING_LIVES)
  })
})

describe('determinism', () => {
  it('plays out identically from identical input', () => {
    const a = run(fresh(), 5)
    const b = run(fresh(), 5)
    expect(a.score).toBe(b.score)
    expect(a.player.cell).toEqual(b.player.cell)
    expect(a.ghosts.map((g) => g.cell)).toEqual(b.ghosts.map((g) => g.cell))
  })

  it('does nothing once the game is over', () => {
    const over = { ...fresh(), status: 'gameOver' as const }
    expect(step(over, 1, roll)).toBe(over)
  })
})

describe('a fair start', () => {
  it('holds everyone still while the level begins', () => {
    let game = newGame()
    const before = { player: { ...game.player.cell }, ghosts: game.ghosts.map((g) => ({ ...g.cell })) }

    game = step(game, 1, roll)
    expect(game.readyFor).toBeGreaterThan(0)
    expect(game.player.cell).toEqual(before.player)
    expect(game.ghosts.map((g) => ({ ...g.cell }))).toEqual(before.ghosts)
  })

  it('lets everyone go once the pause is over', () => {
    const game = run(newGame(), READY_SECONDS + 1)
    expect(game.readyFor).toBe(0)
    expect(game.score).toBeGreaterThan(0)
  })

  it('accepts a turn queued during the pause', () => {
    let game = turn(newGame(), 'up')
    game = run(game, READY_SECONDS + 0.4)
    expect(game.player.dir).toBe('up')
  })

  // The bug this exists to prevent: the player started four steps from a
  // chaser and died before eating a single dot.
  it('starts the player well clear of every chaser', () => {
    const dist = new Map<string, number>([[key(PLAYER_START), 0]])
    const queue = [PLAYER_START]
    while (queue.length) {
      const cell = queue.shift()!
      for (const n of neighbours(cell)) {
        if (dist.has(key(n))) continue
        dist.set(key(n), dist.get(key(cell))! + 1)
        queue.push(n)
      }
    }

    for (const ghost of newGame().ghosts) {
      expect(dist.get(key(ghost.cell))!).toBeGreaterThanOrEqual(10)
    }
  })

  it('survives the opening without dying', () => {
    // No input at all: he should still last well past the first few seconds.
    const game = run(newGame(), 4)
    expect(game.status).toBe('playing')
    expect(game.lives).toBe(STARTING_LIVES)
  })
})

describe('frame-rate independence', () => {
  // A slow device must drop frames, not play the game in slow motion. Stepping
  // in fixed slices is what guarantees that, so the same elapsed time has to
  // produce the same world whatever size the slices arrive in.
  it('reaches the same place whether stepped coarsely or finely', () => {
    const coarse = run(fresh(), 6, 1 / 30)
    const fine = run(fresh(), 6, 1 / 120)

    expect(coarse.player.cell).toEqual(fine.player.cell)
    expect(coarse.score).toBe(fine.score)
    expect(coarse.elapsed).toBeCloseTo(fine.elapsed, 1)
  })

  it('advances the clock by exactly the time it is given', () => {
    const game = run(fresh(), 3, 1 / 120)
    expect(game.elapsed).toBeCloseTo(3, 1)
  })
})
