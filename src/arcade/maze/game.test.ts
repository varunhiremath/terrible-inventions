import { describe, expect, it } from 'vitest'
import { BOARDS, boardFor, isWall, key, neighbours, wrapCell } from './maze'

/**
 * The board a plain `newGame()` is played on.
 *
 * Not the full maze: the first levels are played on a smaller one now, and
 * these tests walk the player into real walls at real coordinates, so they
 * have to be asking about the same grid the game just built.
 */
const board = boardFor(1)
import type { Dir } from './ghosts'
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
  playerSpeed,
  TURN_BUFFER_TILES,
} from './game'

/** One tile in each direction, and each direction's opposite. */
const STEP: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPPOSITE_OF: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

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
    expect(isWall(board, game.player.cell)).toBe(false)
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
      expect(isWall(board, game.player.cell)).toBe(false)
      for (const ghost of game.ghosts) expect(isWall(board, ghost.cell)).toBe(false)
      if (game.status !== 'playing') break
    }
  })

  // The single most important control detail: a turn pressed slightly early
  // must be remembered, or the game feels broken rather than hard.
  /**
   * Puts the player some way short of a corner, facing it, with the turn he
   * wants blocked the whole way until he gets there. Worked out from the maze
   * rather than assumed: pinning this to fixed cells is what broke it the last
   * time the maze changed.
   *
   * @param runUp how many tiles of approach must be blocked
   */
  const beforeACorner = (runUp: number) => {
    for (let y = 1; y < board.height - 1; y++) {
      for (let x = 1; x < board.width - 1; x++) {
        for (const facing of ['up', 'down', 'left', 'right'] as const) {
          for (const wanted of ['up', 'down', 'left', 'right'] as const) {
            if (wanted === facing || wanted === OPPOSITE_OF[facing]) continue

            // Walk back from the corner, checking the corridor runs straight
            // and the wanted turn is a wall at every step of the way.
            const corner = { x, y }
            const openAtCorner = !isWall(board, 
              wrapCell(board, { x: x + STEP[wanted].x, y: y + STEP[wanted].y }),
            )
            if (isWall(board, corner) || !openAtCorner) continue

            let ok = true
            for (let back = 1; back <= runUp && ok; back++) {
              const cell = wrapCell(board, {
                x: x - STEP[facing].x * back,
                y: y - STEP[facing].y * back,
              })
              const blocked = isWall(board, wrapCell(board, { x: cell.x + STEP[wanted].x, y: cell.y + STEP[wanted].y }))
              if (isWall(board, cell) || !blocked) ok = false
            }
            if (!ok) continue

            const start = wrapCell(board, {
              x: x - STEP[facing].x * runUp,
              y: y - STEP[facing].y * runUp,
            })
            return { start, facing, wanted, tiles: runUp }
          }
        }
      }
    }
    throw new Error(`the maze has no corner with ${runUp} tiles of approach`)
  }

  const placed = (at: { x: number; y: number }, dir: Dir, progress = 0) => {
    const game = fresh()
    return { ...game, player: { ...game.player, cell: { ...at }, dir, progress } }
  }

  // The single most important control detail: a turn pressed slightly early
  // must be remembered, or the game feels broken rather than hard.
  it('remembers a turn pressed before the corner', () => {
    const { start, facing, wanted, tiles } = beforeACorner(1)
    let game = turn(placed(start, facing), wanted)
    game = run(game, (tiles + 0.4) / playerSpeed(game.level))
    expect(game.player.dir).toBe(wanted)
  })

  it('forgets a turn pressed far too early', () => {
    /*
     * The other half of the same idea. A turn held for ever means the first
     * opening half a board away takes it, and the game appears to steer
     * itself. Two tiles of grace, then it is dropped.
     */
    const runUp = TURN_BUFFER_TILES + 2
    const { start, facing, wanted, tiles } = beforeACorner(runUp)
    let game = turn(placed(start, facing), wanted)
    game = run(game, (tiles + 0.4) / playerSpeed(game.level))
    expect(game.player.dir).not.toBe(wanted)
  })

  it('turns back the way it came on the spot, not at the next tile', () => {
    /*
     * Reversing is always legal — you have just come from there — and making
     * it wait up to a whole tile is the most obvious way this game can feel
     * unresponsive. The position must not jump when it happens.
     */
    const { start, facing } = beforeACorner(1)
    const game = placed(start, facing, 0.4)
    const before = positionOf(game.player)

    const turned = turn(game, OPPOSITE_OF[facing])
    expect(turned.player.dir).toBe(OPPOSITE_OF[facing])
    const after = positionOf(turned.player)
    expect(after.x).toBeCloseTo(before.x, 9)
    expect(after.y).toBeCloseTo(before.y, 9)
  })

  it('does not shuffle the player when it reverses at a tile centre', () => {
    const { start, facing } = beforeACorner(1)
    const game = placed(start, facing, 0)
    const turned = turn(game, OPPOSITE_OF[facing])
    // Standing exactly on a tile, the ordinary queued turn does the job.
    expect(positionOf(turned.player)).toEqual(positionOf(game.player))
  })

  it('ignores a turn into a wall and carries straight on', () => {
    let game = fresh()
    const before = game.player.dir
    // board.playerStart sits in a horizontal corridor, so down is blocked.
    const blocked = isWall(board, wrapCell(board, { x: board.playerStart.x, y: board.playerStart.y + 1 }))
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
    expect(back.player.cell).toEqual(board.playerStart)
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
    expect(isWall(board, game.ghosts[0].cell)).toBe(false)
  })

  it('catches the player across the tunnel seam', () => {
    // Half a tile apart, but on opposite sides of the wrap. A plain subtraction
    // would read them as eighteen tiles apart and miss the catch entirely.
    let game = fresh()
    game = {
      ...game,
      player: { ...game.player, cell: { x: board.width - 1, y: board.tunnelRow }, progress: 0.5, dir: 'right' },
      ghosts: game.ghosts.map((g, i) =>
        i === 0 ? { ...g, cell: { x: 0, y: board.tunnelRow }, progress: 0, dir: 'right' } : g,
      ),
    }
    expect(step(game, 1 / 60, roll).status).not.toBe('playing')
  })

  it('does not catch the player merely for being near the seam', () => {
    let game = fresh()
    game = {
      ...game,
      player: { ...game.player, cell: { x: 0, y: board.tunnelRow }, progress: 0, dir: 'left' },
      ghosts: game.ghosts.map((g, i) =>
        i === 0 ? { ...g, cell: { x: board.width - 2, y: board.tunnelRow }, progress: 0, dir: 'right' } : g,
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
    // Generous: the maze is twenty-seven by thirty-one and the chasers open
    // slowly, so crossing it takes a while. The claim is that standing still
    // is fatal eventually, not that it is fatal quickly.
    const game = run(fresh(), 120)
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
    // Turning back the way he came is legal from anywhere in a corridor, so
    // this asks the question without depending on where the start happens to be.
    const opening = newGame()
    const back = OPPOSITE_OF[opening.player.dir]
    let game = turn(opening, back)
    game = run(game, READY_SECONDS + 0.4)
    expect(game.player.dir).toBe(back)
  })

  // The bug this exists to prevent: the player started four steps from a
  // chaser and died before eating a single dot.
  it('starts the player well clear of every chaser', () => {
    /*
     * Measured in walking distance, not a straight line: a chaser ten tiles
     * away through a wall is not ten tiles away.
     *
     * A third of the board's height, rather than a fixed number of tiles. The
     * fixed ten was written when there was one maze, and on the small board it
     * would be most of the way from top to bottom — the same rule has to mean
     * the same thing on a board half the size.
     */
    for (const board of BOARDS) {
      const want = board.height / 3
      const dist = new Map<string, number>([[key(board.playerStart), 0]])
      const queue = [board.playerStart]
      while (queue.length > 0) {
        const cell = queue.shift()!
        for (const n of neighbours(board, cell)) {
          if (dist.has(key(n))) continue
          dist.set(key(n), dist.get(key(cell))! + 1)
          queue.push(n)
        }
      }
      for (const start of board.ghostStarts) {
        expect(dist.get(key(start))!, `${board.name} from ${key(start)}`).toBeGreaterThanOrEqual(want)
      }
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
