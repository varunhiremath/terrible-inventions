import { describe, expect, it } from 'vitest'
import { LOUDEST as MAZE, type MazeEvent } from './arcade/maze/game'
import { EVENTS as PIPE_EVENTS, LOUDEST as PIPES } from './pipes/run'
import { LOUDEST as SPACE, type SpaceEvent } from './space/run'

/**
 * Every event a game can raise has a place in the order of importance.
 *
 * Each of these games can produce several events in one frame — land on a
 * goomba, break the block above it, take the coin out of it — and playing all
 * of them at once is a noise rather than a cue. So the screen picks the most
 * important one, from a list.
 *
 * An event missing from that list is never the most important thing in any
 * frame, so it is never heard at all: a sound wired up correctly, pointed at
 * the right cue, and silent for ever with nothing to notice. That used to be
 * guarded by a `throw` at module load, which turned a missing line into the
 * whole app failing to start — and which no unit test could reach, because the
 * lists lived inside screens that pull in React and three.js.
 *
 * They live beside their games now, and this reads them. Both halves of that
 * matter: it caught nothing for months and then caught the same mistake twice
 * in one afternoon, in two different games, with the rest of the suite green.
 */

const sameSet = (order: readonly string[], all: readonly string[]) => {
  expect([...order].sort(), `order: ${order.join(', ')}`).toEqual([...all].sort())
}

describe('the order things are heard in', () => {
  it('covers every event the maze can raise, exactly once', () => {
    const all: MazeEvent[] = ['dot', 'pellet', 'catch', 'caught', 'cleared']
    sameSet(MAZE, all)
  })

  it('covers every event the pipes can raise, exactly once', () => {
    sameSet(PIPES, PIPE_EVENTS)
  })

  it('covers every event the space run can raise, exactly once', () => {
    const all: SpaceEvent[] =
      ['shot', 'hit', 'broke', 'knock', 'arrive', 'warn', 'scrap', 'incoming']
    sameSet(SPACE, all)
  })
})
