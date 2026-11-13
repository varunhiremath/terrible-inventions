import { describe, expect, it } from 'vitest'
import {
  DEEPEST, LIVES, TALL, WIDE,
  THINNEST,
  acrossFor, answers, areaOf, cubesOf, downFor, edgeOf, fills, jobsFor, newOrder, offBy,
  ordersFor, sidesFor,
  type Cut, type Dice, type Order,
} from './level'
import {
  FIXED, between, measures, newRun, ready, step, type Move, type Run,
} from './run'

/** The same dice the game uses, so a test seed is a game seed. */
function dice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)) }
}

function drive(run: Run, seconds: number, move: Move | null = null) {
  const heard: string[] = []
  for (let t = 0; t < seconds; t += FIXED) {
    run = step(run, t === 0 ? move : null, FIXED)
    heard.push(...run.events)
    if (run.status !== 'playing') break
  }
  return { run, heard }
}

/*
 * The geometry, first and on its own.
 *
 * This is a game for somebody who has just been taught what area and
 * perimeter are, so the one unforgivable bug would be for the yard to disagree
 * with the textbook. These work it out the long way round — counting squares
 * and counting edges — and check the game agrees.
 */
describe('the geometry', () => {
  it('counts the squares in a rectangle', () => {
    for (let wide = 1; wide <= WIDE; wide++) {
      for (let tall = 1; tall <= TALL; tall++) {
        // Counted one square at a time, which is what area means before it is
        // a multiplication.
        let counted = 0
        for (let x = 0; x < wide; x++) for (let y = 0; y < tall; y++) counted++
        expect(areaOf({ x: 0, y: 0, wide, tall }), `${wide} by ${tall}`).toBe(counted)
      }
    }
  })

  it('counts the edge all the way round', () => {
    for (let wide = 1; wide <= WIDE; wide++) {
      for (let tall = 1; tall <= TALL; tall++) {
        // Walked round the outside a square at a time.
        const walked = wide + tall + wide + tall
        expect(edgeOf({ x: 0, y: 0, wide, tall }), `${wide} by ${tall}`).toBe(walked)
      }
    }
  })

  it('stacks the squares up into cubes', () => {
    for (const [wide, tall, deep] of [[3, 4, 2], [5, 5, 1], [2, 6, 7]] as const) {
      expect(cubesOf({ x: 0, y: 0, wide, tall }, deep)).toBe(wide * tall * deep)
    }
  })

  it('knows a long thin panel from a square one of the same area', () => {
    // The thing the edging orders exist to teach: same squares, different edge.
    const thin = { x: 0, y: 0, wide: 12, tall: 2 }
    const squat = { x: 0, y: 0, wide: 6, tall: 4 }
    expect(areaOf(thin)).toBe(areaOf(squat))
    expect(edgeOf(thin)).toBeGreaterThan(edgeOf(squat))
  })
})

describe('chalking a rectangle', () => {
  it('works whichever corner you start from', () => {
    const one = between(2, 3, 6, 7)
    const other = between(6, 7, 2, 3)
    expect(one).toEqual(other)
    expect(one).toEqual({ x: 2, y: 3, wide: 5, tall: 5 })
  })

  it('stays on the sheet', () => {
    const cut = between(-4, -9, 99, 99)
    expect(cut.x).toBe(0)
    expect(cut.y).toBe(0)
    expect(cut.wide).toBe(WIDE)
    expect(cut.tall).toBe(TALL)
  })

  it('is one square across at the smallest', () => {
    expect(between(5, 5, 5, 5)).toEqual({ x: 5, y: 5, wide: 1, tall: 1 })
  })
})

describe('the order book', () => {
  it('only takes work the yard has been taught', () => {
    expect(jobsFor(1)).toEqual(['panel'])
    expect(jobsFor(2)).toContain('edging')
    expect(jobsFor(3)).toContain('exact')
    expect(jobsFor(4)).toContain('tank')
  })

  it('never puts up an order that cannot be filled', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const level of [1, 2, 3, 4, 6, 9]) {
        const order = newOrder(1, level, dice(seed))
        const fits = answers(order)
        const where = `level ${level} seed ${seed} ${order.job}`
        expect(fits.length, `${where}: nothing fills it`).toBeGreaterThan(0)
        for (const cut of fits) {
          expect(cut.wide, where).toBeLessThanOrEqual(WIDE)
          expect(cut.tall, where).toBeLessThanOrEqual(TALL)
        }
      }
    }
  })

  it('will not take a strip one square wide', () => {
    /*
     * The shortcut this closes: an order for sixteen squares filled by
     * dragging 1 by 16, which is correct, instant, and the one factor pair
     * nobody has to think about.
     */
    const order: Order = {
      id: 1, job: 'panel', area: 12, edge: 0, cubes: 0, deep: null, seconds: 30,
    }
    expect(fills(order, { x: 0, y: 0, wide: 12, tall: 1 }, 1)).toBe(false)
    expect(fills(order, { x: 0, y: 0, wide: 6, tall: 2 }, 1)).toBe(true)
    expect(offBy(order, { x: 0, y: 0, wide: 12, tall: 1 }, 1))
      .toBe(`too thin — ${THINNEST} squares each way at least`)
  })

  it('never puts up one whose only answer is a strip one square wide', () => {
    /*
     * The degenerate answer: 24 squares as 1 by 24. A nine-year-old finds it
     * in two seconds and learns nothing, so every order is built backwards
     * from a rectangle with both sides at least two, and this is what says so.
     */
    for (let seed = 1; seed <= 60; seed++) {
      for (const level of [1, 2, 3, 5]) {
        const order = newOrder(1, level, dice(seed))
        const fat = answers(order).filter((cut) => cut.wide > 1 && cut.tall > 1)
        expect(fat.length, `level ${level} seed ${seed} ${order.job}`).toBeGreaterThan(0)
      }
    }
  })

  it('gives an exact order exactly one answer, give or take turning it round', () => {
    /*
     * Area and edge together pin a rectangle down — they are the product and
     * the sum of its sides, so the sides are the roots of a quadratic and
     * there is one pair. That is what makes it a puzzle rather than a search,
     * and it is worth knowing it stays true.
     */
    for (let seed = 1; seed <= 40; seed++) {
      const order = { ...newOrder(1, 5, dice(seed)), job: 'exact' as const }
      if (order.area === 0 || order.edge === 0) continue
      const fits = answers(order)
      const shapes = new Set(fits.map((cut) =>
        [cut.wide, cut.tall].sort((a, b) => a - b).join('x')))
      expect(shapes.size, `seed ${seed}: ${order.area} squares, ${order.edge} edge`).toBe(1)
    }
  })

  it('gives a panel order its factor pairs', () => {
    const order: Order = {
      id: 1, job: 'panel', area: 24, edge: 0, cubes: 0, deep: null, seconds: 30,
    }
    const shapes = answers(order).map((cut) => `${cut.wide}x${cut.tall}`).sort()
    // Every way of making 24 that fits on a fourteen by ten sheet.
    expect(shapes).toEqual(['12x2', '3x8', '4x6', '6x4', '8x3'])
  })

  it('leaves the depth open on some tanks and insists on it for others', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const order = newOrder(1, 6, dice(seed))
      if (order.job === 'tank') seen.add(order.deep === null ? 'free' : 'stated')
    }
    expect([...seen].sort()).toEqual(['free', 'stated'])
  })

  it('gives you longer on the early ones', () => {
    const early = newOrder(1, 1, dice(3)).seconds
    const late = newOrder(1, 8, dice(3)).seconds
    expect(early).toBeGreaterThan(late)
    expect(late).toBeGreaterThanOrEqual(18)
  })

  it('asks for bigger shapes as the levels go on, each inside its own axis', () => {
    expect(sidesFor(1)).toBeLessThan(sidesFor(6))
    expect(acrossFor(99)).toBeLessThanOrEqual(WIDE)
    expect(downFor(99)).toBeLessThanOrEqual(TALL)
  })
})

describe('the press', () => {
  const ordering = (order: Partial<Order>): Run => {
    const base = newRun(4, LIVES, 0, 5)
    return {
      ...base,
      order: {
        id: 1, job: 'panel', area: 24, edge: 0, cubes: 0, deep: null, seconds: 40,
        ...order,
      },
      clock: 40,
      // Whatever the run happened to start on, these set-pieces start two
      // deep: the helper is replacing the order, not the whole yard.
      deep: 2,
      cut: { x: 1, y: 1, wide: 2, tall: 2 },
    }
  }

  const chalk = (run: Run, wide: number, tall: number): Run =>
    step(run, { kind: 'drag', fromX: 1, fromY: 1, toX: wide, toY: tall }, FIXED)

  it('takes any rectangle of the right area', () => {
    for (const [wide, tall] of [[4, 6], [6, 4], [3, 8], [8, 3]] as const) {
      let run = ordering({ job: 'panel', area: 24 })
      run = chalk(run, wide, tall)
      expect(measures(run).area, `${wide} by ${tall}`).toBe(24)
      expect(ready(run)).toBe(true)
      run = step(run, { kind: 'cut' }, FIXED)
      expect(run.events, `${wide} by ${tall}`).toContain('cut')
    }
  })

  it('says what is wrong rather than just no', () => {
    let run = ordering({ job: 'panel', area: 24 })
    run = chalk(run, 5, 4)
    run = step(run, { kind: 'cut' }, FIXED)
    expect(run.events).toContain('offcut')
    expect(run.grumble).toBe('20 squares, not 24')
  })

  it('costs time and nothing else for a bad cut', () => {
    let run = ordering({ job: 'panel', area: 24 })
    const had = run.clock
    run = chalk(run, 5, 4)
    run = step(run, { kind: 'cut' }, FIXED)
    expect(run.lives, 'a bad cut must never cost a life').toBe(LIVES)
    expect(run.clock).toBeLessThan(had - 2)
  })

  it('knows edging from squares', () => {
    // Twenty of edge: six by four. Twenty-four squares is also six by four,
    // and the two orders are different questions with the same answer, which
    // is exactly the confusion the game is for.
    let run = ordering({ job: 'edging', edge: 20, area: 0 })
    run = chalk(run, 6, 4)
    expect(measures(run).edge).toBe(20)
    expect(ready(run)).toBe(true)

    let wrong = ordering({ job: 'edging', edge: 20, area: 0 })
    wrong = chalk(wrong, 5, 4)
    expect(ready(wrong), '18 of edge should not fill an order for 20').toBe(false)
  })

  it('wants both at once for an exact order', () => {
    let run = ordering({ job: 'exact', area: 24, edge: 20 })
    run = chalk(run, 12, 2)
    expect(measures(run).area, 'the area is right').toBe(24)
    expect(ready(run), 'but the edge is not').toBe(false)
    run = step(run, { kind: 'cut' }, FIXED)
    expect(run.grumble).toBe('edge is 28, not 20')
    run = chalk(run, 6, 4)
    expect(ready(run)).toBe(true)
  })

  it('builds a tank out of a floor and a depth', () => {
    let run = ordering({ job: 'tank', cubes: 36, deep: null, area: 0 })
    run = chalk(run, 3, 4)
    expect(measures(run).cubes, 'three by four, two deep').toBe(24)
    run = step(run, { kind: 'deep', by: 1 }, FIXED)
    expect(run.deep).toBe(3)
    expect(measures(run).cubes).toBe(36)
    expect(ready(run)).toBe(true)
  })

  it('insists on the depth when the order states one', () => {
    let run = ordering({ job: 'tank', cubes: 36, deep: 3, area: 0 })
    run = { ...run, deep: 2 }
    run = chalk(run, 3, 6)
    expect(measures(run).cubes, 'thirty-six cubes, but two deep').toBe(36)
    expect(ready(run), 'the order said three deep').toBe(false)
    run = step(run, { kind: 'cut' }, FIXED)
    expect(run.grumble).toBe('2 deep, not 3')
  })

  it('will not go deeper than the yard stacks', () => {
    let run = ordering({ job: 'tank', cubes: 36, deep: null, area: 0 })
    for (let i = 0; i < 20; i++) run = step(run, { kind: 'deep', by: 1 }, FIXED)
    expect(run.deep).toBe(DEEPEST)
    for (let i = 0; i < 20; i++) run = step(run, { kind: 'deep', by: -1 }, FIXED)
    expect(run.deep).toBe(1)
  })

  it('ignores the depth on a flat order', () => {
    const run = step(ordering({ job: 'panel', area: 24 }), { kind: 'deep', by: 3 }, FIXED)
    expect(run.deep).toBe(2)
  })
})

describe('the lorry', () => {
  it('costs a go when one goes unfilled, and puts the next order up', () => {
    const run = newRun(1, LIVES, 0, 3)
    const { run: after, heard } = drive({ ...run, clock: 0.2 }, 1)
    expect(heard).toContain('scrapped')
    expect(heard).toContain('order')
    expect(after.lives).toBe(LIVES - 1)
    expect(after.clock).toBeGreaterThan(1)
  })

  it('is over when the last go goes', () => {
    const run = newRun(1, 1, 0, 3)
    const { run: after, heard } = drive({ ...run, clock: 0.2 }, 1)
    expect(heard).toContain('over')
    expect(after.status).toBe('over')
  })

  it('says nothing more once it is over', () => {
    const run = newRun(1, 1, 0, 3)
    const { run: after } = drive({ ...run, clock: 0.2 }, 1)
    expect(step(after, { kind: 'cut' }, FIXED).events).toEqual([])
  })
})

/*
 * And a day's orders, filled by somebody who can do the geometry.
 *
 * The bot works the shapes out itself — it searches for a rectangle whose
 * squares, edge or cubes come to what was asked, rather than asking the game
 * what would fit — so what this says is that a player who knows what area,
 * perimeter and volume are can clear a level without running out of time.
 */
function work(run: Run): Move | null {
  const order = run.order
  const want = find(order)
  if (!want) return { kind: 'cut' }
  if (order.job === 'tank' && run.deep !== want.deep) {
    return { kind: 'deep', by: run.deep < want.deep ? 1 : -1 }
  }
  if (run.cut.wide !== want.wide || run.cut.tall !== want.tall) {
    // From the corner of the sheet, so the whole of it is reachable.
    return {
      kind: 'drag',
      fromX: 0, fromY: 0, toX: want.wide - 1, toY: want.tall - 1,
    }
  }
  return { kind: 'cut' }
}

/** A rectangle that fills this order, worked out from scratch. */
function find(order: Order): { wide: number; tall: number; deep: number } | null {
  // Two each way at least, because the press will not take a strip.
  for (let wide = THINNEST; wide <= WIDE; wide++) {
    for (let tall = THINNEST; tall <= TALL; tall++) {
      const cut: Cut = { x: 1, y: 1, wide, tall }
      if (order.job === 'panel' && wide * tall === order.area) return { wide, tall, deep: 2 }
      if (order.job === 'edging' && 2 * (wide + tall) === order.edge) {
        return { wide, tall, deep: 2 }
      }
      if (order.job === 'exact' && wide * tall === order.area &&
        2 * (wide + tall) === order.edge) return { wide, tall, deep: 2 }
      if (order.job === 'tank') {
        for (let deep = 1; deep <= DEEPEST; deep++) {
          if (order.deep !== null && deep !== order.deep) continue
          if (wide * tall * deep === order.cubes) return { wide, tall, deep }
        }
      }
      void cut
    }
  }
  return null
}

describe('a day in the yard', () => {
  /** Works at a human sort of pace: a move every third of a second. */
  const play = (run: Run, pace = 0.34) => {
    let since = 0
    for (let t = 0; t < 500; t += FIXED) {
      since += FIXED
      let move: Move | null = null
      if (since >= pace) {
        move = work(run)
        since = 0
      }
      run = step(run, move, FIXED)
      if (run.status !== 'playing') break
    }
    return run
  }

  it('can be cleared by somebody who can do the geometry', () => {
    for (const level of [1, 2, 3, 4, 5, 7]) {
      for (const seed of [1, 2, 3]) {
        const run = play(newRun(level, LIVES, 0, seed))
        const said = `level ${level} seed ${seed}: ${run.status}, ` +
          `${run.done} filled, ${run.missed} missed`
        expect(run.status, said).toBe('cleared')
        expect(run.missed, said).toBe(0)
        expect(run.done, said).toBe(ordersFor(level))
      }
    }
  }, 90_000)

  it('cannot be cleared by standing about', () => {
    expect(play(newRun(1, LIVES, 0, 4), 999).status).toBe('over')
  })

  it('leaves time to think, and not much more', () => {
    /*
     * Half a second a move is a comfortable pace for somebody working it out,
     * and so is eight — an order is only a drag and a press once you have
     * seen it, and the thinking happens before the first move. Twenty
     * seconds a move is somebody who has gone to make a sandwich, and that is
     * where the clock is meant to bite.
     */
    expect(play(newRun(3, LIVES, 0, 2), 0.5).status).toBe('cleared')
    expect(play(newRun(3, LIVES, 0, 2), 8).status).toBe('cleared')
    expect(play(newRun(3, LIVES, 0, 2), 20).status).not.toBe('cleared')
  }, 60_000)

  it('pays more for a quick one', () => {
    const quick = play(newRun(2, LIVES, 0, 2), 0.2)
    const dawdled = play(newRun(2, LIVES, 0, 2), 1.1)
    expect(quick.score).toBeGreaterThan(dawdled.score)
  }, 60_000)

  it('works the same way twice', () => {
    const once = play(newRun(4, LIVES, 0, 9))
    const twice = play(newRun(4, LIVES, 0, 9))
    expect(twice.score).toBe(once.score)
    expect(twice.done).toBe(once.done)
  }, 60_000)
})

describe('what the board says', () => {
  it('reads the chalk back as all four numbers', () => {
    const base = newRun(4, LIVES, 0, 5)
    const run = step(base, { kind: 'drag', fromX: 2, fromY: 2, toX: 7, toY: 5 }, FIXED)
    const said = measures(run)
    expect(said.wide).toBe(6)
    expect(said.tall).toBe(4)
    expect(said.area).toBe(24)
    expect(said.edge).toBe(20)
    expect(said.cubes).toBe(24 * run.deep)
  })

  it('is quiet when nothing moved', () => {
    const base = newRun(1, LIVES, 0, 5)
    const same = step(base, {
      kind: 'drag', fromX: base.cut.x, fromY: base.cut.y,
      toX: base.cut.x + base.cut.wide - 1, toY: base.cut.y + base.cut.tall - 1,
    }, FIXED)
    expect(same.events).not.toContain('chalk')
  })

  it('tells a tank what it is short by', () => {
    const base = newRun(4, LIVES, 0, 5)
    const run: Run = {
      ...base,
      order: { id: 1, job: 'tank', area: 0, edge: 0, cubes: 60, deep: null, seconds: 40 },
      cut: { x: 1, y: 1, wide: 4, tall: 4 },
      deep: 3,
    }
    expect(offBy(run.order, run.cut, run.deep)).toBe('48 cubes, not 60')
    expect(fills(run.order, { x: 1, y: 1, wide: 5, tall: 4 }, 3)).toBe(true)
  })
})
