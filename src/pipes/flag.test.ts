import { describe, expect, it } from 'vitest'
import { VIEW_TOP, readLevel, type Level } from './level'
import { LEVELS } from './levels'
import { NO_INPUT, newBody, type Input } from './physics'
import {
  FLAG_BANDS, SLIDE_SPEED, WALK_OFF, flagWorth, newRun, stepRun, type Run,
} from './run'

/**
 * The end of a level.
 *
 * "There's real fun in reaching and pulling the flag down at the end, and the
 * higher you jump and pull the flag the more points you would get."
 *
 * So the thing being tested is that height is worth something, that it is worth
 * the *same* something every time at the same height, and that the two seconds
 * after catching it are safe: nothing moves, nothing can hurt him, and the
 * clock is not running. A player who caught the top of the pole and then died
 * to a goomba walking past would never try for it again.
 */

const DT = 1 / 120

/** Flat ground, sky above, and a pole of a known height near the end. */
function withPole(poleRows = 8): Level {
  const width = 40
  const rows: string[] = []
  for (let r = 0; r < 13; r++) {
    const line = [...' '.repeat(width)]
    // The pole hangs from `13 - poleRows` down to the ground.
    if (r >= 13 - poleRows) line[30] = '|'
    rows.push(line.join(''))
  }
  rows.push('#'.repeat(width), '#'.repeat(width))
  return readLevel('with a pole', rows)
}

const drive = (run: Run, seconds: number, input: Input = NO_INPUT): Run => {
  let now = run
  for (let i = 0; i < Math.round(seconds / DT); i++) now = stepRun(now, input, DT)
  return now
}

/**
 * A run with him already at the pole, at a given height.
 *
 * Placed a hair past the column rather than just short of it: the catch is
 * tested at the end of a step, and a body with no sideways speed parked just
 * short of the pole never arrives.
 */
function atHeight(level: Level, y: number): Run {
  const run = newRun(level, 1)
  return {
    ...run,
    body: { ...newBody(level.pole + 0.05, y), vx: 0, vy: 0 },
  }
}

/** One step, which is all it takes to catch it. */
const touch = (run: Run): Run => stepRun(run, NO_INPUT, DT)

describe('every level', () => {
  it('has its pole in sight, so the ball at the top can be aimed at', () => {
    /*
     * The one way this could look right in a bench and be wrong in the game:
     * if a pole reached higher than the camera ever shows, the top band would
     * be a thing you cannot see to aim at.
     */
    for (const level of LEVELS) {
      expect(level.poleTop, `${level.name} pole top`).toBeGreaterThanOrEqual(VIEW_TOP)
      expect(level.poleFoot - level.poleTop, `${level.name} pole height`).toBeGreaterThan(3)
    }
  })
})

describe('catching the pole', () => {
  it('knows where the pole starts and ends', () => {
    const level = withPole(8)
    expect(level.poleTop).toBe(5)
    expect(level.poleFoot).toBe(13)
    expect(level.pole).toBe(30)
  })

  it('is worth more the higher up it is caught', () => {
    const level = withPole(8)
    const worth = (y: number) => touch(atHeight(level, y)).score

    const top = worth(level.poleTop + 0.2)
    const middle = worth((level.poleTop + level.poleFoot) / 2)
    const bottom = worth(level.poleFoot - 0.5)

    expect(top, `top ${top} vs middle ${middle}`).toBeGreaterThan(middle)
    expect(middle, `middle ${middle} vs bottom ${bottom}`).toBeGreaterThan(bottom)
    expect(top).toBe(5000)
    expect(bottom).toBe(100)
  })

  it('pays the same for the same height every time', () => {
    // Bands, not a sliding scale: the point is that a player can aim at one.
    for (const band of FLAG_BANDS) {
      expect(flagWorth(band.at)).toBe(band.points)
      expect(flagWorth(Math.min(1, band.at + 0.01))).toBe(band.points)
    }
    expect(flagWorth(1)).toBe(5000)
    expect(flagWorth(0)).toBe(100)
  })

  it('needs the very top of the pole for the top band', () => {
    const level = withPole(8)
    const span = level.poleFoot - level.poleTop
    // Nine tenths of the way up is not enough; the ball is.
    expect(flagWorth(0.88)).toBeLessThan(5000)
    expect(touch(atHeight(level, level.poleFoot - span * 0.95)).score).toBe(5000)
  })

  it('stops the level and hands over to the flag', () => {
    const after = touch(atHeight(withPole(8), 6))
    expect(after.status).toBe('flag')
    expect(after.flag).toBeTruthy()
    expect(after.events).toContain('grab')
  })
})

describe('coming down the pole', () => {
  it('slides down, walks off, and only then is the level won', () => {
    const level = withPole(8)
    const caught = touch(atHeight(level, level.poleTop + 0.2))

    const span = level.poleFoot - level.poleTop
    const sliding = drive(caught, (span / SLIDE_SPEED) * 0.5)
    expect(sliding.status, 'still on his way down').toBe('flag')
    expect(sliding.flag && sliding.flag.down).toBeGreaterThan(0.2)
    expect(sliding.flag && sliding.flag.down).toBeLessThan(0.9)
    expect(sliding.body.y, 'and lower than he caught it').toBeGreaterThan(caught.body.y)

    const landed = drive(caught, span / SLIDE_SPEED + 0.2)
    expect(landed.flag && landed.flag.down).toBe(1)
    expect(landed.status, 'on the ground, walking off').toBe('flag')

    const done = drive(landed, WALK_OFF + 0.1)
    expect(done.status).toBe('won')
    expect(done.body.x, 'walked past the pole').toBeGreaterThan(level.pole)
  })

  it('pays the time bonus at the end, on top of what the catch was worth', () => {
    const level = withPole(8)
    const caught = touch(atHeight(level, level.poleTop + 0.2))
    const span = level.poleFoot - level.poleTop
    const done = drive(caught, span / SLIDE_SPEED + WALK_OFF + 0.3)
    expect(done.status).toBe('won')
    expect(done.score).toBe(caught.score + 2000 + Math.floor(caught.seconds) * 10)
  })

  it('stops the clock while it happens, so nobody runs out of time on the pole', () => {
    const level = withPole(8)
    const caught = touch(atHeight(level, level.poleTop + 0.2))
    const later = drive(caught, 1.5)
    expect(later.seconds).toBe(caught.seconds)
  })

  it('ignores everything the player does while it runs', () => {
    const level = withPole(8)
    const caught = touch(atHeight(level, level.poleTop + 0.2))
    const left = drive(caught, 0.4, { ...NO_INPUT, left: true, jump: true })
    const quiet = drive(caught, 0.4)
    expect(left.body.y).toBeCloseTo(quiet.body.y, 6)
    expect(left.body.x).toBeCloseTo(quiet.body.x, 6)
  })

  it('says it is won exactly once, however long the screen leaves it there', () => {
    /*
     * The fanfare is the longest cue in the app, and the screen plays a cue
     * every time it sees the event. Five hundred copies of it on top of each
     * other is the buzz this project has had to fix twice already.
     */
    const level = withPole(8)
    const caught = touch(atHeight(level, level.poleTop + 0.2))
    const span = level.poleFoot - level.poleTop

    let now = caught
    let wins = 0
    for (let i = 0; i < Math.round((span / SLIDE_SPEED + WALK_OFF + 3) / DT); i++) {
      now = stepRun(now, NO_INPUT, DT)
      wins += now.events.filter((e) => e === 'win').length
    }
    expect(wins).toBe(1)
  })
})
