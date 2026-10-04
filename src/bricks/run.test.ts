import { describe, expect, it } from 'vitest'
import {
  BALL_R, BALL_FASTEST, COLS, LIVES, PADDLE_Y, POWERS, POWER_LASTS, ROWS, STEEPEST,
  TALL, WALLS, WIDE, wallFor,
} from './level'
import {
  FIXED, LOUDEST, NO_INPUT, batBox, boxOf, newRun, readWall, serve, speedFor, standing, step,
  type Input, type Run,
} from './run'

/**
 * The wall.
 *
 * Two things go wrong in a game of this shape and neither is visible in a
 * screenshot. The ball steps over a brick at speed and sails through a solid
 * wall; and a wall turns out to have a brick in it nothing can ever reach, so
 * the level cannot be finished and the only way out is the back button.
 */

/**
 * A brick in the top corner, out of everybody's way.
 *
 * A level with nothing breakable left in it is a level that has been cleared,
 * and a cleared run stops stepping — so every test below that sets up its own
 * handful of bricks needs one spare somewhere, or the thing it is about never
 * gets a chance to happen. Four tests here were quietly measuring a run that
 * had finished on its first frame.
 */
const SPARE = readWall(['a'])

const play = (run: Run, input: Input, seconds: number): Run => {
  let now = run
  for (let t = 0; t < seconds; t += FIXED) now = step(now, input, FIXED)
  return now
}

describe('reading a wall off the page', () => {
  it('turns letters into bricks', () => {
    const bricks = readWall(['a.b', '#.C'])
    expect(bricks).toHaveLength(4)
    expect(bricks[0]).toMatchObject({ col: 0, row: 0, life: 1, solid: false, carries: false })
    expect(bricks[1]).toMatchObject({ col: 2, row: 0, life: 2 })
    expect(bricks[2]).toMatchObject({ col: 0, row: 1, solid: true })
    expect(bricks[3]).toMatchObject({ col: 2, row: 1, life: 3, carries: true })
  })

  it('fits every wall inside the field', () => {
    for (let level = 1; level <= WALLS.length + 6; level++) {
      const picture = wallFor(level)
      expect(picture.length, `wall ${level} is ${picture.length} rows`).toBeLessThanOrEqual(ROWS)
      for (const row of picture) {
        expect(row.length, `wall ${level} has a row ${row.length} wide`).toBe(COLS)
        expect(/^[.#abcABC]+$/.test(row), `wall ${level}: "${row}"`).toBe(true)
      }
    }
  })

  it('leaves room under every wall to play in', () => {
    // A wall that reaches the bat is a wall with no game under it.
    for (let level = 1; level <= WALLS.length + 6; level++) {
      const bricks = readWall(wallFor(level))
      const lowest = Math.max(...bricks.map((b) => boxOf(b)[3]))
      expect(lowest, `wall ${level} comes down to ${lowest.toFixed(1)}`).toBeLessThan(PADDLE_Y - 6)
    }
  })

  it('gives every wall something to break and something to catch', () => {
    for (let level = 1; level <= WALLS.length + 6; level++) {
      const bricks = readWall(wallFor(level))
      expect(bricks.some((b) => !b.solid), `wall ${level} is all solid`).toBe(true)
      expect(bricks.some((b) => b.carries), `wall ${level} drops nothing`).toBe(true)
    }
  })

  it('gets harder rather than longer once the drawn ones run out', () => {
    // Past the last picture it comes round again with every brick a grade
    // harder, rather than starting over at the easy one.
    const first = readWall(wallFor(1))
    const again = readWall(wallFor(WALLS.length + 1))
    const sum = (bs: ReturnType<typeof readWall>) =>
      bs.filter((b) => !b.solid).reduce((n, b) => n + b.life, 0)
    expect(sum(again)).toBeGreaterThan(sum(first))
  })
})

describe('the ball', () => {
  it('waits on the bat until it is let go', () => {
    const run = newRun(1)
    expect(run.balls[0].stuck).toBe(true)
    const after = play(run, NO_INPUT, 1)
    expect(after.balls[0].stuck).toBe(true)
    expect(after.balls[0].y).toBeCloseTo(PADDLE_Y - BALL_R, 5)
  })

  it('goes when it is told to', () => {
    const run = step(newRun(1), { ...NO_INPUT, act: true }, FIXED)
    expect(run.balls[0].stuck).toBe(false)
    expect(run.events).toContain('launch')
  })

  it('never ends up travelling nearly flat', () => {
    /*
     * A ball shallower than this takes an age to cross the screen and cannot
     * be reached by a bat that only goes sideways. The oldest fault in the
     * genre and the oldest fix.
     */
    let run = step(newRun(1), { ...NO_INPUT, act: true }, FIXED)
    for (let t = 0; t < 25; t += FIXED) {
      run = step(run, { ...NO_INPUT, to: run.balls[0]?.x ?? null }, FIXED)
      for (const ball of run.balls) {
        if (ball.stuck) continue
        const off = Math.abs(Math.atan2(ball.dx, -ball.dy))
        const flat = Math.min(off, Math.PI - off)
        expect(flat, `the ball went flat: ${flat.toFixed(2)}`).toBeLessThanOrEqual(STEEPEST + 1e-6)
      }
      if (run.status !== 'playing') break
    }
  })

  it('comes off the bat at the angle the bat was hit at', () => {
    // The only steering in the game, and the whole reason one control is
    // enough: the middle sends it back, the ends send it away.
    const aim = (where: number) => {
      let run = newRun(1)
      run = {
        ...run,
        bricks: SPARE,
        balls: [{ id: 1, x: run.bat + where, y: PADDLE_Y - BALL_R - 0.3, dx: 0, dy: 1, speed: 6, stuck: false, along: 0 }],
      }
      const after = play(run, NO_INPUT, 0.1)
      return after.balls[0].dx
    }
    expect(aim(-0.9)).toBeLessThan(-0.2)
    expect(aim(0.9)).toBeGreaterThan(0.2)
    // The middle sends it nearly back, but never exactly: a bounce that is
    // exactly vertical is a ball that bores one hole and lives in it.
    expect(Math.abs(aim(0))).toBeLessThan(0.3)
    expect(Math.abs(aim(0))).toBeGreaterThan(0)
  })

  it('does not step through a brick, however fast it is going', () => {
    /*
     * The one that would make the game look broken rather than hard. At the
     * quickest the ball ever travels it covers more than a brick's height
     * between one frame and the next, so a ball that is simply moved and then
     * asked what it is touching sails straight through a solid wall.
     *
     * A line of solid bricks, and a ball fired at it at the top speed from
     * directly underneath: it has to still be below them afterwards.
     */
    const bricks = readWall(['#############'])
    const under = boxOf(bricks[0])[3]
    let run: Run = {
      ...newRun(9),
      bricks,
      balls: [{
        id: 1, x: WIDE / 2, y: under + 3, dx: 0.1, dy: -1,
        speed: BALL_FASTEST, stuck: false, along: 0,
      }],
    }
    for (let t = 0; t < 2; t += FIXED) {
      run = step(run, NO_INPUT, FIXED)
      const ball = run.balls[0]
      if (!ball) break
      expect(ball.y, 'the ball got above a solid wall').toBeGreaterThan(under - BALL_R - 0.01)
    }
    expect(run.bricks.every((b) => b.solid)).toBe(true)
  })

  it('takes a hit off a brick and pays for it', () => {
    const bricks = readWall(['..a..'])
    const [left, , right, bottom] = boxOf(bricks[0])
    let run: Run = {
      ...newRun(1),
      bricks,
      balls: [{
        id: 1, x: (left + right) / 2, y: bottom + 0.4, dx: 0, dy: -1,
        speed: 6, stuck: false, along: 0,
      }],
    }
    run = play(run, NO_INPUT, 0.5)
    expect(run.score).toBeGreaterThan(0)
    expect(run.bricks.filter((b) => !b.solid)).toHaveLength(0)
  })

  it('needs three goes at a three-hit brick', () => {
    /*
     * The ball is put back under the brick after each hit rather than chased
     * around with a bat. The claim is that a three-hit brick takes three hits,
     * not that a bot can land three in a row — and it cannot, because a bounce
     * is deliberately never quite vertical, so the second one comes back at an
     * angle and misses.
     */
    const bricks = readWall(['..c..'])
    const [left, , right, bottom] = boxOf(bricks[0])
    const middle = (left + right) / 2
    let run: Run = { ...newRun(1), bricks: [...bricks, ...SPARE] }
    let hits = 0
    for (let go = 0; go < 4; go++) {
      run = {
        ...run,
        balls: [{ id: go + 1, x: middle, y: bottom + 0.3, dx: 0, dy: -1, speed: 6, stuck: false, along: 0 }],
      }
      for (let t = 0; t < 0.4; t += FIXED) {
        run = step(run, NO_INPUT, FIXED)
        if (run.events.includes('crack') || run.events.includes('break')) hits += 1
      }
      if (run.bricks.length <= 1) break
    }
    expect(hits).toBe(3)
    expect(run.bricks.filter((b) => !b.solid && b.life > 0)).toHaveLength(1)
  })

  it('never breaks a solid one', () => {
    const bricks = readWall(['..#..'])
    const [left, , right, bottom] = boxOf(bricks[0])
    let run: Run = {
      ...newRun(1),
      bricks,
      balls: [{
        id: 1, x: (left + right) / 2, y: bottom + 0.3, dx: 0, dy: -1,
        speed: 7, stuck: false, along: 0,
      }],
    }
    run = play(run, { ...NO_INPUT, to: (left + right) / 2 }, 4)
    expect(run.bricks).toHaveLength(1)
  })
})

describe('what the bricks drop', () => {
  it('falls out of a carrying brick and can be caught', () => {
    const bricks = readWall(['..A..'])
    const [left, , right, bottom] = boxOf(bricks[0])
    const middle = (left + right) / 2
    let run: Run = {
      ...newRun(1),
      bricks: [...bricks, ...SPARE],
      bat: middle,
      balls: [{ id: 1, x: middle, y: bottom + 0.3, dx: 0, dy: -1, speed: 6, stuck: false, along: 0 }],
    }
    run = play(run, { ...NO_INPUT, to: middle }, 0.4)
    expect(run.drops.length, 'a carrying brick dropped nothing').toBe(1)
    /*
     * The ball is parked on the bat for the fall.
     *
     * A drop takes six seconds to come down the screen, and a loose ball in an
     * almost empty room goes past the bat long before that — which ends the go,
     * and a finished run does not step, so the drop hung in the air for ever
     * and this test reported that catching one does nothing.
     */
    run = {
      ...run,
      balls: [{ id: 99, x: middle, y: 0, dx: 0, dy: -1, speed: 6, stuck: true, along: 0 }],
    }
    run = play(run, { ...NO_INPUT, to: middle }, 9)
    const got = POWERS.some((p) => run.held[p] !== undefined) || run.lives > LIVES || run.balls.length > 1
    expect(got, 'the drop was caught and nothing happened').toBe(true)
  })

  it('wears off, for the ones that are meant to', () => {
    let run: Run = { ...newRun(1), bricks: [], held: { wide: 0.2 } }
    const was = batBox(run)[2] - batBox(run)[0]
    run = { ...run, bricks: readWall(['..a..']) }
    run = play(run, NO_INPUT, 0.5)
    expect(run.held.wide).toBeUndefined()
    expect(batBox(run)[2] - batBox(run)[0]).toBeLessThan(was)
  })

  it('makes the bat wider while it lasts', () => {
    const plain = batBox(newRun(1))
    const wide = batBox({ ...newRun(1), held: { wide: POWER_LASTS.wide } })
    expect(wide[2] - wide[0]).toBeGreaterThan(plain[2] - plain[0])
  })

  it('slows the ball down while it lasts', () => {
    const run = { ...newRun(5), bricks: readWall(['..a..']), held: { slow: 5 } }
    const after = step({ ...run, balls: run.balls.map((b) => ({ ...b, stuck: false })) }, NO_INPUT, FIXED)
    expect(after.balls[0].speed).toBeLessThan(speedFor(5))
  })

  it('fires the gun, and the gun breaks bricks', () => {
    /*
     * A row wide enough for a barrel to line up with.
     *
     * The two barrels sit at the ends of the bat, not down its middle, which
     * is the point of them — so a test aiming the middle of the bat at a
     * single brick one unit wide fires either side of it and reports that the
     * gun does not work.
     */
    const bricks = readWall(['..aaaaa..'])
    const middle = (boxOf(bricks[0])[0] + boxOf(bricks[4])[2]) / 2
    let run: Run = {
      ...newRun(1),
      bricks,
      bat: middle,
      // Held on the bat: this is about the gun, and a ball loose in an empty
      // room would be knocking bricks down the whole time.
      balls: [{ id: 9, x: middle, y: PADDLE_Y - BALL_R, dx: 0, dy: -1, speed: 4, stuck: true, along: 0 }],
      held: { gun: 10 },
    }
    const before = run.bricks.length
    run = play(run, { ...NO_INPUT, act: false, to: middle }, 0.2)
    run = play(run, { ...NO_INPUT, act: true, to: middle }, 2)
    expect(run.bricks.length, 'the gun never got a brick').toBeLessThan(before)
  })
})

describe('how a go ends', () => {
  it('loses a life when the last ball goes past the bat', () => {
    let run: Run = {
      ...newRun(1),
      bat: 0.5,
      balls: [{ id: 1, x: WIDE - 0.5, y: TALL - 1, dx: 0, dy: 1, speed: 8, stuck: false, along: 0 }],
    }
    run = play(run, NO_INPUT, 1)
    expect(run.status).toBe('lost')
    expect(run.lives).toBe(LIVES - 1)
  })

  it('is over when the lives are', () => {
    let run: Run = {
      ...newRun(1, 1),
      bat: 0.5,
      balls: [{ id: 1, x: WIDE - 0.5, y: TALL - 1, dx: 0, dy: 1, speed: 8, stuck: false, along: 0 }],
    }
    run = play(run, NO_INPUT, 1)
    expect(run.status).toBe('over')
  })

  it('does not lose a life while another ball is still up', () => {
    let run: Run = {
      ...newRun(1),
      bricks: SPARE,
      balls: [
        { id: 1, x: WIDE - 0.5, y: TALL - 0.6, dx: 0, dy: 1, speed: 8, stuck: false, along: 0 },
        // The second one well clear of the spare brick, so this test is about
        // losing a ball and not about clearing a level.
        { id: 2, x: WIDE / 2, y: 12, dx: 0, dy: 1, speed: 1, stuck: false, along: 0 },
      ],
    }
    run = play(run, NO_INPUT, 0.3)
    expect(run.status).toBe('playing')
    expect(run.lives).toBe(LIVES)
  })

  it('is cleared when the last breakable brick goes', () => {
    const bricks = readWall(['..a..'])
    const [left, , right, bottom] = boxOf(bricks[0])
    let run: Run = {
      ...newRun(1),
      bricks: [...bricks, ...readWall(['#....'])],
      balls: [{ id: 1, x: (left + right) / 2, y: bottom + 0.3, dx: 0, dy: -1, speed: 6, stuck: false, along: 0 }],
    }
    run = play(run, NO_INPUT, 0.5)
    expect(run.status, 'a wall of solid bricks is not a wall you have to break').toBe('cleared')
  })

  it('puts a fresh ball on the bat and takes your powers away', () => {
    const run = serve({ ...newRun(1), held: { gun: 5, wide: 5 }, balls: [], status: 'lost' })
    expect(run.balls).toHaveLength(1)
    expect(run.balls[0].stuck).toBe(true)
    expect(Object.keys(run.held)).toHaveLength(0)
    expect(run.status).toBe('playing')
  })

  it('says nothing more once a go is over', () => {
    // The crackle, which cost an afternoon in four other games.
    let run: Run = { ...newRun(1), status: 'lost', events: ['lost'] }
    for (let i = 0; i < 5; i++) {
      run = step(run, NO_INPUT, FIXED)
      expect(run.events).toHaveLength(0)
    }
  })

  it('has a place in the order for everything that can happen', () => {
    const all = [
      'tap', 'crack', 'break', 'solid', 'bat', 'wall', 'drop', 'power',
      'shoot', 'lost', 'cleared', 'launch',
    ]
    expect([...LOUDEST].sort()).toEqual([...all].sort())
  })
})

describe('every wall can actually be finished', () => {
  /*
   * The fault that cannot be seen and cannot be worked around: one brick
   * walled in behind solid ones, and the level never ends. The player has no
   * way of knowing which brick it is or that it is the game's fault, so they
   * sit there until they run out of lives.
   *
   * Reachability, by flooding the field from the bat's end — and the flood
   * goes *through* breakable bricks, because they will not be there for long.
   * The first version treated every brick as a wall and declared the middle of
   * an ordinary nine-by-three block unreachable, which is the shape of the
   * very first level. Only the solid ones stop it, which is the whole of what
   * makes them solid.
   */
  const reachable = (picture: readonly string[]) => {
    const grid: string[][] = []
    for (let r = 0; r < ROWS; r++) {
      grid.push(new Array(COLS).fill('.'))
    }
    picture.forEach((row, r) => [...row].forEach((cell, c) => { grid[r][c] = cell }))

    const open = (r: number, c: number) =>
      r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] !== '#'
    const seen = new Set<number>()
    const queue: [number, number][] = []
    // Everything below the wall is where the ball lives.
    for (let c = 0; c < COLS; c++) {
      const r = picture.length
      if (open(r, c)) { queue.push([r, c]); seen.add(r * COLS + c) }
    }
    // And the sides and the top, which the ball reaches by bouncing.
    for (let r = 0; r < picture.length; r++) {
      for (const c of [0, COLS - 1]) {
        if (open(r, c) && !seen.has(r * COLS + c)) { queue.push([r, c]); seen.add(r * COLS + c) }
      }
    }
    while (queue.length > 0) {
      const [r, c] = queue.pop()!
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr
        const nc = c + dc
        if (!open(nr, nc) || seen.has(nr * COLS + nc)) continue
        seen.add(nr * COLS + nc)
        queue.push([nr, nc])
      }
    }

    const stuck: string[] = []
    picture.forEach((row, r) => [...row].forEach((cell, c) => {
      if (cell === '.' || cell === '#') return
      if (!seen.has(r * COLS + c)) stuck.push(`${cell} at row ${r}, column ${c}`)
    }))
    return stuck
  }

  for (let level = 1; level <= WALLS.length; level++) {
    it(`wall ${level} has no brick the ball can never touch`, () => {
      const stuck = reachable(wallFor(level))
      expect(stuck, `walled in: ${stuck.join('; ')}`).toEqual([])
    })
  }
})

describe('a wall can be got through', () => {
  /**
   * A bat that follows the lowest ball, which is roughly what anybody does.
   *
   * Not a good player — it has no reaction time and no plan — but good enough
   * to say whether a wall can be cleared at all, which a wall with a brick the
   * ball cannot reach cannot.
   */
  const chase = (run: Run, t: number): Input => {
    const lowest = [...run.balls].sort((a, b) => b.y - a.y)[0]
    /*
     * Aimed a little off the ball, and the offset wanders.
     *
     * A bat parked exactly under the ball is not what anybody plays like, and
     * it is the one thing that reliably sends the ball straight back up the
     * hole it came down. Nudging it is the difference between measuring the
     * game and measuring a degenerate case of the bot.
     */
    const lean = Math.sin(t * 0.7) * 0.6
    return { to: lowest ? lowest.x + lean : null, left: false, right: false, act: true }
  }

  it('clears the first wall, given long enough', () => {
    // Five minutes, which is not a claim about how long a person takes — this
    // bot has no reaction and no plan. It is a claim that the wall can be
    // finished at all, which is the thing that has no other way of being
    // checked.
    let run = newRun(1, 99)
    for (let t = 0; t < 300 && run.status !== 'cleared'; t += FIXED) {
      run = step(run, chase(run, t), FIXED)
      if (run.status === 'lost' || run.status === 'over') run = serve({ ...run, lives: 99 })
    }
    expect(run.status, `${standing(run)} bricks still standing`).toBe('cleared')
  }, 60_000)

  it('gets a real way into the hardest one', () => {
    /*
     * Not cleared, and not most of it. This bot has no reaction time, no plan
     * and no idea what a power is; asking it for a number a person would get
     * is asking the wrong thing. What it is good for is noticing a wall that
     * cannot be played at all — one sealed behind solids, or one where the
     * ball cannot reach the bricks — and a third of the wall down says that is
     * not the case.
     */
    let run = newRun(WALLS.length, 99)
    const was = standing(run)
    for (let t = 0; t < 120; t += FIXED) {
      run = step(run, chase(run, t), FIXED)
      if (run.status === 'lost' || run.status === 'over') run = serve({ ...run, lives: 99 })
      if (run.status === 'cleared') break
    }
    expect(standing(run), `broke ${was - standing(run)} of ${was}`).toBeLessThan(was * 0.7)
  }, 60_000)
})
