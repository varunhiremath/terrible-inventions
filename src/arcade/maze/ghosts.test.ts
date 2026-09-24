import { describe, expect, it } from 'vitest'
import { FULL, isWall, reachableFrom, key, wrapCell } from './maze'
import {
  DIRS,
  ghostsFor,
  OPPOSITE,
  PHASE_SCHEDULE,
  SHY_DISTANCE,
  STEP,
  ahead,
  chooseDirection,
  distanceSquared,
  legalDirections,
  phaseAt,
  randomDirection,
  targetFor,
  targetForAt,
  type Dir,
} from './ghosts'

/** The tests below are about behaviour, so they run on the full board. */
const board = FULL
const GHOSTS = ghostsFor(board)
const [papa, bolt, cog, rivet] = GHOSTS

describe('the cast', () => {
  it('is four distinct chasers with four personalities', () => {
    expect(GHOSTS).toHaveLength(4)
    expect(new Set(GHOSTS.map((g) => g.personality)).size).toBe(4)
    expect(new Set(GHOSTS.map((g) => g.seed)).size).toBe(4)
    expect(new Set(GHOSTS.map((g) => g.colour)).size).toBe(4)
  })

  it('sends each one to a different corner when scattering', () => {
    const corners = GHOSTS.map((g) => targetFor(g, 'scatter', board.playerStart, 'up', papa.start))
    expect(new Set(corners.map((c) => key(c))).size).toBe(4)
  })

  it('starts everyone on open floor', () => {
    for (const ghost of GHOSTS) expect(isWall(board, ghost.start)).toBe(false)
  })
})

describe('targeting', () => {
  const player = { x: 9, y: 13 }

  it('sends the relentless one straight at the player', () => {
    expect(targetFor(papa, 'chase', player, 'up', papa.start)).toEqual(player)
  })

  it('sends the ambusher to where the player is going, not where he is', () => {
    expect(targetFor(bolt, 'chase', player, 'up', papa.start)).toEqual({ x: 9, y: 9 })
    expect(targetFor(bolt, 'chase', player, 'right', papa.start)).toEqual({ x: 13, y: 13 })
  })

  it('swings the flanker round the far side', () => {
    // Two ahead of the player, doubled away from the relentless one.
    const papaAt = { x: 5, y: 13 }
    const pivot = ahead(player, 'right', 2)
    expect(targetFor(cog, 'chase', player, 'right', papaAt)).toEqual({
      x: 2 * pivot.x - papaAt.x,
      y: 2 * pivot.y - papaAt.y,
    })
  })

  it('makes the shy one bold far away and timid up close', () => {
    const far = { x: player.x + SHY_DISTANCE + 2, y: player.y }
    const near = { x: player.x + 1, y: player.y }
    expect(targetForAt(rivet, 'chase', far, player, 'up', papa.start)).toEqual(player)
    expect(targetForAt(rivet, 'chase', near, player, 'up', papa.start)).toEqual(rivet.corner)
  })

  it('allows targets outside the maze, which is what makes ambushing work', () => {
    const edge = { x: 1, y: 1 }
    const target = targetFor(bolt, 'chase', edge, 'up', papa.start)
    expect(target.y).toBeLessThan(0)
  })
})

describe('steering', () => {
  it('never walks into a wall', () => {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const at = { x, y }
        if (isWall(board, at)) continue
        for (const facing of DIRS) {
          const dir = chooseDirection(board, at, facing, { x: 9, y: 13 })
          expect(isWall(board, wrapCell(board, { x: x + STEP[dir].x, y: y + STEP[dir].y }))).toBe(false)
        }
      }
    }
  })

  it('never turns back on itself unless there is nowhere else to go', () => {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const at = { x, y }
        if (isWall(board, at)) continue
        for (const facing of DIRS) {
          const exits = DIRS.filter(
            (d) => !isWall(board, wrapCell(board, { x: x + STEP[d].x, y: y + STEP[d].y })),
          )
          const isDeadEnd = exits.filter((d) => d !== OPPOSITE[facing]).length === 0
          const dir = chooseDirection(board, at, facing, { x: 1, y: 1 })
          if (!isDeadEnd) expect(dir).not.toBe(OPPOSITE[facing])
        }
      }
    }
  })

  it('always has somewhere to go', () => {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (isWall(board, { x, y })) continue
        for (const facing of DIRS) expect(legalDirections(board, { x, y }, facing).length).toBeGreaterThan(0)
      }
    }
  })

  it('moves closer to its target when it can', () => {
    // Out along the tunnel row, where the corridor runs clear both ways.
    const at = { x: 5, y: board.tunnelRow }
    expect(chooseDirection(board, at, 'left', { x: 1, y: board.tunnelRow })).toBe('left')
    expect(chooseDirection(board, at, 'right', { x: board.width - 2, y: board.tunnelRow })).toBe('right')
  })

  it('resolves ties the same way every time', () => {
    const at = { x: 5, y: board.tunnelRow }
    const first = chooseDirection(board, at, 'left', at)
    for (let i = 0; i < 20; i++) expect(chooseDirection(board, at, 'left', at)).toBe(first)
  })

  it('wanders legally when frightened', () => {
    for (let roll = 0; roll < 1; roll += 0.05) {
      for (const facing of DIRS) {
        const dir = randomDirection(board, { x: 5, y: board.tunnelRow }, facing, roll)
        expect(isWall(board, wrapCell(board, { x: 5 + STEP[dir].x, y: board.tunnelRow + STEP[dir].y }))).toBe(false)
      }
    }
  })

  /**
   * Greedy steering picks whichever legal turn gets closest, which can circle
   * a fixed target forever rather than reaching it. That is true of the
   * original too, and is precisely why scatter phases exist: the periodic
   * reversal breaks any loop. So what is asserted here is that steering is
   * always legal and never escapes the maze — whether the chasers actually
   * close in is tested against the real game, where the player moves and the
   * phases turn.
   */
  it('never steers out of the maze, however long it runs', () => {
    const reachable = reachableFrom(board, board.playerStart)
    for (const ghost of GHOSTS) {
      let at = { ...ghost.start }
      let facing: Dir = 'up'

      for (let tick = 0; tick < 500; tick++) {
        facing = chooseDirection(board, at, facing, board.playerStart)
        at = wrapCell(board, { x: at.x + STEP[facing].x, y: at.y + STEP[facing].y })
        expect(reachable.has(key(at))).toBe(true)
      }
    }
  })
})

describe('phases', () => {
  it('opens on scatter and settles into chase', () => {
    expect(phaseAt(0)).toBe('scatter')
    expect(phaseAt(6.9)).toBe('scatter')
    expect(phaseAt(7.1)).toBe('chase')
    expect(phaseAt(10_000)).toBe('chase')
  })

  it('gives less and less respite as the level goes on', () => {
    const scatters = PHASE_SCHEDULE.filter((p) => p.phase === 'scatter').map((p) => p.seconds)
    expect(scatters[scatters.length - 1]).toBeLessThan(scatters[0])
  })

  it('alternates rather than repeating itself', () => {
    for (let i = 1; i < PHASE_SCHEDULE.length; i++) {
      expect(PHASE_SCHEDULE[i].phase).not.toBe(PHASE_SCHEDULE[i - 1].phase)
    }
  })
})

describe('geometry', () => {
  it('measures distance without square roots', () => {
    expect(distanceSquared({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25)
  })

  it('looks ahead in the direction of travel', () => {
    expect(ahead({ x: 5, y: 5 }, 'up', 4)).toEqual({ x: 5, y: 1 })
    expect(ahead({ x: 5, y: 5 }, 'left', 2)).toEqual({ x: 3, y: 5 })
  })
})
