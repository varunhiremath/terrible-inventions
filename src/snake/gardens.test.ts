import { describe, expect, it } from 'vitest'
import { GARDENS, GOAL_SAYS, HEDGE_GIRTH, gardenFor } from './level'
import { FIXED, headOf, newRun, nextGarden, respawn, step, type Run } from './run'

/**
 * The gardens.
 *
 * The game had none of this — one endless round with a score — and the verdict
 * was "it's no fun without any clear objectives". These are the tests for the
 * thing that answers that: twelve gardens, each asking for one thing, each
 * with less room and worse company than the last.
 */

const still = { x: 0, y: 0, dash: false }

describe('the ladder', () => {
  it('asks for something in every garden, and says so in words', () => {
    for (let level = 1; level <= 40; level++) {
      const garden = gardenFor(level)
      expect(garden.want, `garden ${level}`).toBeGreaterThan(0)
      expect(garden.rivals, `garden ${level}`).toBeGreaterThan(0)
      const said = GOAL_SAYS[garden.goal](garden.want)
      expect(said.length, `garden ${level} says nothing`).toBeGreaterThan(4)
    }
  })

  it('does not ask the same thing twice in a row', () => {
    // Turning the page should be something else, not more of it.
    for (let i = 1; i < GARDENS.length; i++) {
      expect(GARDENS[i].goal, `gardens ${i} and ${i + 1}`).not.toBe(GARDENS[i - 1].goal)
    }
  })

  it('teaches all four kinds of goal before it starts repeating', () => {
    const early = new Set(GARDENS.slice(0, 4).map((g) => g.goal))
    expect(early.size, 'the first four gardens repeat themselves').toBe(4)
  })

  it('gets tighter and busier as it goes, and then stops', () => {
    const first = GARDENS[0]
    const last = GARDENS[GARDENS.length - 1]
    expect(last.arena, 'the last garden is no smaller').toBeLessThan(first.arena)
    expect(last.rivals, 'the last garden is no busier').toBeGreaterThan(first.rivals)
    expect(last.mean, 'the last garden is no meaner').toBeGreaterThan(first.mean)
    expect(last.hedges, 'the last garden has no thorns').toBeGreaterThan(first.hedges)

    // Past the twelfth it hardens for ever without running away with itself.
    const far = gardenFor(200)
    expect(far.mean).toBeLessThanOrEqual(2.2)
    expect(far.hedges).toBeLessThanOrEqual(12)
    expect(far.want).toBeGreaterThan(last.want)
  })

  it('opens gently: the first garden has room and nobody much in it', () => {
    const first = GARDENS[0]
    expect(first.hedges, 'there are thorns in the first garden').toBe(0)
    expect(first.rivals).toBeLessThanOrEqual(2)
    expect(first.mean).toBeLessThan(1)
  })
})

describe('a goal', () => {
  it('is reached by doing the thing it asks for, and ends the garden', () => {
    // Asked for two seconds of staying alive, and given four of nothing.
    let run = newRun(1, 4, { goal: 'last', want: 2, rivals: 1, hedges: 0 })
    for (let t = 0; t < 4 && run.status === 'playing'; t += FIXED) run = step(run, still, FIXED)
    expect(run.status).toBe('won')
    expect(run.got).toBeGreaterThanOrEqual(2)
  })

  it('counts growing by the longest you have been, not the length you are', () => {
    /*
     * Because closing a ring — the move the whole game is named for — cuts
     * away what it looped over. Measured on the length you are now, the right
     * way to play a growing garden would be to never ring anybody, which is to
     * say to never play it.
     */
    let run = newRun(1, 5, { goal: 'grow', want: 99, rivals: 1, food: 0, charms: 0, hedges: 0 })
    run.snakes[0].length = 8
    run = step(run, still, FIXED)
    expect(run.got).toBeCloseTo(8, 1)
    run.snakes[0].length = 3
    run = step(run, still, FIXED)
    expect(run.got, 'shrinking undid the progress').toBeCloseTo(8, 1)
  })

  it('keeps what he has earned when a life is lost', () => {
    // Dying on the last pellet of "eat forty" and being sent back to nought is
    // how somebody puts a game down.
    let run = newRun(1, 6, { goal: 'graze', want: 99, rivals: 1, hedges: 0 })
    for (let t = 0; t < 3; t += FIXED) run = step(run, { x: 1, y: 0.2, dash: false }, FIXED)
    const ate = run.ate
    expect(ate, 'nothing was eaten, so there is nothing to keep').toBeGreaterThan(0)
    const back = respawn({ ...run, status: 'lost' })
    expect(back.ate).toBe(ate)
  })

  it('does start the clock again in a garden about lasting', () => {
    // The one exception, and it has to be: the whole task is staying alive.
    const run = newRun(1, 6, { goal: 'last', want: 99 })
    const back = respawn({ ...run, lived: 30, status: 'lost' })
    expect(back.lived).toBe(0)
  })

  it('carries the score on to the next garden and nothing else', () => {
    let run = newRun(1, 7, { goal: 'last', want: 1, food: 0, charms: 0 })
    run.snakes[0].score = 1234
    for (let t = 0; t < 2 && run.status === 'playing'; t += FIXED) run = step(run, still, FIXED)
    expect(run.status).toBe('won')
    const on = nextGarden(run)
    expect(on.level).toBe(2)
    expect(on.snakes[0].score).toBe(1234)
    expect(on.got).toBe(0)
    expect(on.caught).toBe(0)
  })
})

describe('the hedges', () => {
  it('are laid where somebody can come back to life', () => {
    // A hedge across the middle is a garden nobody can be put into.
    for (let seed = 1; seed <= 40; seed++) {
      const run = newRun(12, seed)
      expect(run.hedges.length, `seed ${seed}`).toBeGreaterThan(0)
      for (const hedge of run.hedges) {
        for (const p of hedge) {
          expect(Math.hypot(p.x, p.y), `seed ${seed}: a hedge in the middle`).toBeGreaterThan(2)
        }
      }
    }
  })

  it('are inside the garden they belong to', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = newRun(12, seed)
      for (const hedge of run.hedges) {
        for (const p of hedge) {
          expect(Math.hypot(p.x, p.y), `seed ${seed}`).toBeLessThan(run.arena)
        }
      }
    }
  })

  it('end anybody who touches one', () => {
    const run = newRun(5, 3, { rivals: 0, food: 0, charms: 0 })
    expect(run.hedges.length).toBeGreaterThan(0)
    const thorn = run.hedges[0][4]
    // Put the head right on it.
    const you = run.snakes[0]
    you.body = you.body.map(() => ({ x: thorn.x, y: thorn.y }))
    const after = step(run, still, FIXED)
    expect(after.status).toBe('lost')
    expect(after.events).toContain('died')
  })

  it('do not kill somebody standing a clear distance off one', () => {
    // The control: if the check were simply "there is a hedge in this garden",
    // every test above would pass and the game would be unplayable.
    const run = newRun(5, 3, { rivals: 0, food: 0, charms: 0 })
    const thorn = run.hedges[0][4]
    const you = run.snakes[0]
    // Somewhere genuinely clear of every thorn, not merely off one of them:
    // a hedge is nine points long, so "two units from this one" is quite
    // happily right on top of the next.
    let off = { x: 0, y: 0 }
    for (let r = 0.5; r < run.arena; r += 0.3) {
      const spot = { x: thorn.x + r, y: thorn.y }
      const clear = run.hedges.every((h) => h.every(
        (p) => Math.hypot(p.x - spot.x, p.y - spot.y) > HEDGE_GIRTH * 4,
      ))
      if (clear && Math.hypot(spot.x, spot.y) < run.arena * 0.9) { off = spot; break }
    }
    you.body = you.body.map(() => off)
    const after = step(run, still, FIXED)
    expect(after.status).toBe('playing')
  })

  it('are something the rivals steer around rather than drive into', () => {
    /*
     * They go into the same grid the bodies do, so every brain that already
     * avoids a body avoids a hedge for nothing. Without that they drive into
     * the new scenery at full speed and the garden empties in a few seconds.
     */
    let run: Run = newRun(12, 9, { food: 0, charms: 0 })
    const were = run.snakes.filter((s) => s.who).length
    for (let t = 0; t < 12; t += FIXED) {
      run = step(run, still, FIXED)
      if (run.status === 'lost') run = respawn(run)
    }
    const left = run.snakes.filter((s) => s.who && s.alive).length
    expect(left, `${were - left} of ${were} rivals died in twelve seconds`)
      .toBeGreaterThanOrEqual(Math.ceil(were / 2))
  })
})

describe('the ring, explained', () => {
  it('says so when a ring catches nothing, and what it cost', () => {
    /*
     * The thing nobody could work out: the head meeting its own body does not
     * kill you here, it closes a loop and cuts away what it looped over. A
     * careless nick takes a chunk off and gives nothing back, which from the
     * outside is a snake that shrank for no reason.
     */
    let run = newRun(1, 3, { rivals: 0, food: 0, charms: 0, hedges: 0, goal: 'last', want: 1e6 })
    run.snakes[0].length = 9
    let said: string | null = null
    for (let t = 0; t < 8 && !said; t += FIXED) {
      run = step(run, { x: Math.cos(t * 2.6), y: Math.sin(t * 2.6), dash: false }, FIXED)
      if (run.said) said = run.said.words
    }
    expect(said, 'a ring closed and the game said nothing').not.toBe(null)
    expect(said).toContain('NOTHING')
  })

  it('stops saying it after a couple of seconds', () => {
    let run = newRun(1, 3, { rivals: 0, food: 0, hedges: 0, goal: 'last', want: 1e6 })
    run = { ...run, said: { words: 'RINGED ONE!', tint: '#8ad48a', life: 2.2 } }
    for (let t = 0; t < 1; t += FIXED) run = step(run, still, FIXED)
    expect(run.said, 'gone before it could be read').not.toBe(null)
    for (let t = 0; t < 2; t += FIXED) run = step(run, still, FIXED)
    expect(run.said, 'still sitting there').toBe(null)
  })
})

describe('the garden it is played in', () => {
  it('is the size the garden says, and the edge agrees', () => {
    for (const level of [1, 6, 12]) {
      const run = newRun(level, 2)
      expect(run.arena).toBe(gardenFor(level).arena)
      // Everything scattered in it is inside it.
      for (const p of run.prey) expect(Math.hypot(p.x, p.y)).toBeLessThan(run.arena)
      for (const d of run.drops) expect(Math.hypot(d.x, d.y)).toBeLessThan(run.arena)
      for (const s of run.snakes) {
        expect(Math.hypot(headOf(s).x, headOf(s).y)).toBeLessThan(run.arena)
      }
    }
  })

  it('keeps the garden as full as that garden asks for, life after life', () => {
    /*
     * It topped up to a constant five, which was right when there was one
     * garden and wrong the moment there were twelve. The opening garden asks
     * for two, and after the first death it quietly refilled itself to five
     * and stayed there — so the gentlest garden in the game became the busiest
     * one the second time you played it.
     */
    for (const level of [1, 6, 12]) {
      const want = gardenFor(level).rivals
      let run = newRun(level, 4, { goal: 'last', want: 1e6 })
      for (let life = 0; life < 4; life++) {
        for (let t = 0; t < 6; t += FIXED) {
          run = step(run, { x: 1, y: 0.3, dash: false }, FIXED)
          if (run.status === 'lost') break
        }
        run = respawn({ ...run, status: 'lost' })
      }
      const living = run.snakes.filter((s) => s.who && s.alive).length
      expect(living, `garden ${level} drifted to ${living} rivals, not ${want}`)
        .toBeLessThanOrEqual(want)
    }
  }, 30_000)

  it('has as many rivals and charms as the garden asks for', () => {
    for (const level of [1, 6, 12]) {
      const garden = gardenFor(level)
      const run = newRun(level, 2)
      expect(run.snakes.filter((s) => s.who)).toHaveLength(garden.rivals)
      expect(run.drops.length).toBe(garden.charms)
    }
  })
})
