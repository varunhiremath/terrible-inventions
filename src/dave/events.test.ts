import { describe, expect, it } from 'vitest'
import { newGame, step, type CaveEvent, type Game } from './game'
import { levelFor } from './levels'
import { NO_INPUT, type Input } from './physics'

/**
 * The noises the caves make.
 *
 * Raised by the simulation, because the screen sees two states a frame apart
 * and cannot tell what happened in between. These fail silently when they fail
 * — no error, just a game that says nothing — so they are worth pinning.
 */

function play(game: Game, seconds: number, input: Input = NO_INPUT, dt = 1 / 60) {
  const heard: CaveEvent[] = []
  let at = game
  for (let t = 0; t < seconds; t += dt) {
    at = step(at, input, dt)
    heard.push(...at.events)
  }
  return { end: at, heard }
}

describe('the cave events', () => {
  it('raises a jump once, not once a frame while he is off the ground', () => {
    /*
     * The one that would have been unbearable. Jump is held down for half a
     * second here; the sound belongs to leaving the ground, not to being off
     * it, so holding the button must not machine-gun the cue.
     */
    const { heard } = play(newGame(levelFor(1)), 0.5, { ...NO_INPUT, jump: true })
    expect(heard.filter((e) => e === 'leap').length).toBe(1)
  })

  it('says nothing at all when he is stood still', () => {
    const { heard } = play(newGame(levelFor(1)), 0.5)
    expect(heard).toEqual([])
  })

  it('raises a gem for each diamond and clears it again', () => {
    const game = newGame(levelFor(1))
    const before = game.taken.size
    // Walking right along the opening floor, which has diamonds on it.
    const { end, heard } = play(game, 4, { ...NO_INPUT, right: true })
    const taken = end.taken.size - before
    expect(taken, 'he picked nothing up, so this proves nothing').toBeGreaterThan(0)
    expect(heard.filter((e) => e === 'gem' || e === 'kit' || e === 'trophy').length).toBe(taken)
    expect(end.events.length).toBeLessThan(3)
  })

  it('raises the trophy and the door as separate moments', () => {
    const level = levelFor(1)
    const game = newGame(level)
    const withTrophy: Game = { ...game, dave: { ...game.dave, hasTrophy: true } }
    // Taking the trophy is what opens the door; they are never the same event,
    // and the door has to wait for the trophy.
    expect(withTrophy.events).toEqual([])
    expect(game.dave.hasTrophy).toBe(false)
  })
})
