import { describe, expect, it } from 'vitest'
import { LOUDEST as MAZE, type MazeEvent } from './arcade/maze/game'
import { EVENTS as PIPE_EVENTS, LOUDEST as PIPES } from './pipes/run'
import { LOUDEST as SPACE, type SpaceEvent } from './space/run'
import { newGame, step as stepMaze } from './arcade/maze/game'
import { newGame as newDave, step as stepDave } from './dave/game'
import { NO_INPUT as NO_DAVE } from './dave/physics'
import { LEVELS as DAVE_LEVELS } from './dave/levels'
import { newRun as newPipeRun, stepRun as stepPipes } from './pipes/run'
import { LEVELS as PIPE_LEVELS } from './pipes/levels'
import { newRun as newKeep, step as stepKeep } from './arcade/dungeon/run'
import { NO_INPUT as NO_KEEP } from './arcade/dungeon/prince'
import { levelFor as keepLevel } from './arcade/dungeon/levels'
import { newRun as newFlight, step as stepFlight, NO_INPUT as NO_FLY } from './space/run'
import { newRun as newDrive, step as stepDrive, NO_INPUT as NO_DRIVE } from './road/run'

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


/**
 * A run that is over says so once.
 *
 * Every one of these games has a screen that reads the events off each step
 * and plays a noise for the loudest. A step taken on a finished run used to
 * hand back the finished run *untouched* — events and all — so the noise that
 * ended it was re-announced on every frame for as long as the card was up.
 * Sixty copies a second of the same cue, landing on top of each other and
 * summing past full scale.
 *
 * That is a buzz, and it is the one that was reported twice as "plenty of
 * cracking and static noise when a question pops". Measured through a tap on
 * the real audio graph: a peak of 1.17 with a hundred and fifty clipped
 * samples, where the game itself runs at 0.06. Two of the six had already
 * found it separately and fixed only themselves.
 */
describe('a run that is over', () => {
  const quiet = (name: string, once: () => unknown, again: (s: unknown) => unknown,
                 count: (s: unknown) => number) => {
    it(`stops saying so, in ${name}`, () => {
      const over = once()
      // However many times the screen asks after that, there is nothing left
      // to play.
      let at = over
      for (let n = 0; n < 5; n++) {
        at = again(at)
        expect(count(at), `${name} re-announced itself on step ${n + 1}`).toBe(0)
      }
    })
  }

  quiet(
    'the maze',
    () => ({ ...newGame(1), status: 'gameOver' as const, events: ['caught' as MazeEvent] }),
    (s) => stepMaze(s as never, 1 / 60),
    (s) => (s as { events: unknown[] }).events.length,
  )

  quiet(
    'the caves',
    () => ({ ...newDave(DAVE_LEVELS[0], 1), status: 'dead' as const, events: ['die'] }),
    (s) => stepDave(s as never, NO_DAVE, 1 / 60),
    (s) => (s as { events: unknown[] }).events.length,
  )

  quiet(
    'the pipes',
    () => ({ ...newPipeRun(PIPE_LEVELS[0], 1), status: 'dead' as const, events: ['die' as const] }),
    (s) => stepPipes(s as never, { left: false, right: false, jump: false, run: false, down: false }, 1 / 120),
    (s) => (s as { events: unknown[] }).events.length,
  )

  quiet(
    'the dungeon',
    () => ({ ...newKeep(keepLevel(1), 1), status: 'dead' as const, event: 'hurt' as const }),
    (s) => stepKeep(s as never, NO_KEEP, 'none', () => 0.5),
    (s) => ((s as { event: string }).event === 'none' ? 0 : 1),
  )

  quiet(
    'the flight',
    () => ({ ...newFlight(1), status: 'lost' as const, events: ['knock' as SpaceEvent] }),
    (s) => stepFlight(s as never, NO_FLY, 1 / 60),
    (s) => (s as { events: unknown[] }).events.length,
  )

  quiet(
    'the road',
    () => ({ ...newDrive(1), status: 'gameOver' as const, events: ['crash' as const] }),
    (s) => stepDrive(s as never, NO_DRIVE, 1 / 60),
    (s) => (s as { events: unknown[] }).events.length,
  )
})
