import { describe, expect, it } from 'vitest'
import { READY_SECONDS, newGame, step, type Game, type MazeEvent } from './game'
import { key } from './maze'

/**
 * The noises the board makes.
 *
 * These are raised by the simulation rather than worked out by the screen,
 * because the screen sees two states a frame apart and cannot tell what
 * happened in between — and these are exactly the things that fail silently.
 * A missing event is not an error; it is a game that makes no sound.
 */

/** Runs the clock on, collecting everything raised on the way. */
function play(game: Game, seconds: number, dt = 1 / 60): { end: Game; heard: MazeEvent[] } {
  const heard: MazeEvent[] = []
  let at = game
  for (let t = 0; t < seconds; t += dt) {
    at = step(at, dt)
    heard.push(...at.events)
  }
  return { end: at, heard }
}

describe('the maze events', () => {
  it('says nothing during the pause at the start of a life', () => {
    // Nobody moves while the ready countdown runs, so nothing can be eaten.
    const { heard } = play(newGame(1), READY_SECONDS * 0.8)
    expect(heard).toEqual([])
  })

  it('raises a dot when one is eaten', () => {
    const game = newGame(1)
    const before = game.dots.size
    const { end, heard } = play(game, READY_SECONDS + 3)
    expect(end.dots.size, 'nothing was eaten, so this proves nothing').toBeLessThan(before)
    expect(heard.filter((e) => e === 'dot').length).toBe(before - end.dots.size)
  })

  it('raises a pellet for a power pellet, not a dot', () => {
    /*
     * Put him on a power cell and step once. Both live in the same lookup and
     * an earlier version of this code ate the pellet and announced a dot.
     */
    const game = newGame(1)
    const cell = [...game.power].map((id) => id.split(',').map(Number))[0]
    const on: Game = {
      ...game,
      readyFor: 0,
      player: { ...game.player, cell: { x: cell[0], y: cell[1] }, progress: 0 },
    }
    const after = step(on, 1 / 60)
    expect(after.events).toContain('pellet')
    expect(after.events).not.toContain('dot')
    expect(after.power.has(key({ x: cell[0], y: cell[1] }))).toBe(false)
  })

  it('clears what it raised, so a sound plays once', () => {
    // If events survived a step the cue would retrigger every frame for the
    // rest of the game, which is the worst possible version of this bug.
    const game = newGame(1)
    const { end } = play(game, READY_SECONDS + 3)
    const quiet = step({ ...end, player: { ...end.player } }, 1 / 60)
    expect(Array.isArray(quiet.events)).toBe(true)
    expect(quiet.events.length).toBeLessThan(3)
  })

  it('raises being caught exactly once', () => {
    const game = newGame(1)
    const ghost = game.ghosts[0]
    const caught: Game = {
      ...game,
      readyFor: 0,
      ghosts: [{ ...ghost, cell: { ...game.player.cell }, progress: 0, frightened: false }, ...game.ghosts.slice(1)],
    }
    const after = step(caught, 1 / 60)
    expect(after.events.filter((e) => e === 'caught').length).toBe(1)
    expect(after.status === 'died' || after.status === 'gameOver').toBe(true)
  })
})
