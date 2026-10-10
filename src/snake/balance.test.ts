import { describe, expect, it } from 'vitest'
import { ARENA, CREATURES } from './level'
import { FIXED, bodyOf, headOf, newRun, respawn, step, type Input, type Run } from './run'

/** Keeps off the wall, keeps off everybody, otherwise eats. */
function careful(run: Run): Input {
  const you = run.snakes[0]
  const head = headOf(you)
  const bad = (angle: number): number => {
    const look = { x: head.x + Math.cos(angle) * 2, y: head.y + Math.sin(angle) * 2 }
    let worst = Math.max(0, Math.hypot(look.x, look.y) - ARENA * 0.9)
    for (const other of run.snakes) {
      if (!other.alive) continue
      const skip = other.id === you.id ? 10 : 0
      const beads = bodyOf(other)
      for (let i = skip; i < beads.length; i++) {
        const gap = Math.hypot(beads[i].x - look.x, beads[i].y - look.y)
        if (gap < 2) worst = Math.max(worst, (2 - gap) / 2)
      }
    }
    return worst
  }
  const good = (angle: number): number => {
    const look = { x: head.x + Math.cos(angle) * 2, y: head.y + Math.sin(angle) * 2 }
    let sum = 0
    for (const p of run.prey) {
      const gap = Math.hypot(p.x - look.x, p.y - look.y)
      // By what it feeds. It was `p.worth`, which the creatures do not have —
      // so every direction scored NaN, no direction ever beat another, and the
      // pilot stopped steering and drove into the wall. Fifty-two of its
      // sixty-two deaths were the edge of the garden.
      if (gap < 4) sum += (CREATURES[p.kind].feeds * (p.big ? 2 : 1) * (4 - gap)) / 4
    }
    return sum
  }
  let best = you.heading
  let score = -Infinity
  for (let i = 0; i < 13; i++) {
    const angle = you.heading + ((i / 12) * 2 - 1) * 2.2
    const value = good(angle) - bad(angle) * 30
    if (value > score) { score = value; best = angle }
  }
  return { x: Math.cos(best), y: Math.sin(best), dash: false }
}

/** Holds one direction for a while, then another: a thumb with no plan. */
function flailing(run: Run, t: number): Input {
  const a = Math.floor(t / 0.4) * 1.9
  void run
  return { x: Math.cos(a), y: Math.sin(a), dash: false }
}

/**
 * How long each life lasted, and what ended it.
 *
 * Deliberately small: three gardens of ninety seconds. The first version ran
 * six of a hundred and fifty, three times over — one call per test — and took
 * four hundred and sixty-nine seconds against thirty-five for the whole of the
 * rest of the suite, which is not a test anybody will keep running. Most of
 * that is the pilot below rather than the game: it weighs thirteen headings
 * against every bead of every snake, sixty times a second.
 */
function howLong(pilot: (run: Run, t: number) => Input, goes = 3, seconds = 90, level = 1) {
  const lived: number[] = []
  const why = { wall: 0, body: 0 }
  const quick: number[] = []
  for (let seed = 1; seed <= goes; seed++) {
    let run = newRun(level, seed * 13, { goal: 'last', want: 1e6 })
    let since = 0
    for (let t = 0; t < seconds; t += FIXED) {
      const before = run
      run = step(run, pilot(run, t), FIXED)
      since += FIXED
      if (run.status === 'lost') {
        // What got them, read off the frame they died on rather than guessed.
        const head = headOf(run.snakes[0])
        if (Math.hypot(head.x, head.y) > ARENA) why.wall += 1
        else why.body += 1
        lived.push(since)
        if (since < 2) quick.push(Math.round(since * 10) / 10)
        since = 0
        run = respawn(run)
        void before
      }
    }
    if (since > 0) lived.push(since)
  }
  return { lived, why, quick }
}

/**
 * How hard the garden is, against two kinds of player.
 *
 * Neither bot is a child with a thumb, and nothing here claims they are. What
 * they are good for is noticing that something has changed: this game is five
 * other snakes making decisions about a sixth, and a single number moved in
 * `brainOf` can turn it from a garden into a blender without failing anything.
 */
describe('how hard it is', () => {
  // Measured once. Three tests asking the same question of the same garden is
  // three times the wait for one answer.
  const trying = howLong(careful)

  it('gives somebody who is trying a life worth having', () => {
    const { lived } = trying
    const mean = lived.reduce((a, b) => a + b, 0) / lived.length
    console.log(`  careful: ${lived.length} lives, ${mean.toFixed(0)}s each, ${trying.quick.length} under 2s`)
    console.log(`  what got them: ${JSON.stringify(trying.why)}`)
    expect(mean, 'a careful snake is being eaten alive').toBeGreaterThan(12)
  })

  it('gets harder as the gardens go on', () => {
    /*
     * The first garden is deliberately gentle — two rivals, both grazers, and
     * all the room in the world — so the old assertion that "nothing in the
     * garden is dangerous" if a careful pilot survives ninety seconds is not
     * the right question any more. The right question is whether the ladder
     * does anything, which is this.
     */
    const early = howLong(careful, 2, 60, 1)
    const late = howLong(careful, 2, 60, 12)
    const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
    const first = early.lived.length === 0 ? 60 : meanOf(early.lived)
    const last = late.lived.length === 0 ? 60 : meanOf(late.lived)
    console.log(`  garden 1: ${first.toFixed(0)}s a life · garden 12: ${last.toFixed(0)}s a life`)
    expect(last, 'the twelfth garden is no harder than the first').toBeLessThan(first)
    /*
     * Three minutes, not one.
     *
     * It takes longer than it used to for the happiest of reasons: a careful
     * pilot now survives the whole sixty seconds of the first garden, so the
     * run plays out in full instead of ending early. A test that measures how
     * long somebody lives gets slower when they stop dying.
     */
  }, 180_000)

  it('does not kill anybody in the first second of a life', () => {
    /*
     * Appearing and dying in the same breath is the worst thing a game can do.
     * It used to happen four lives in forty-three, because coming back checked
     * the distance to everybody's *head* — and a head can be twenty units from
     * its own tail.
     */
    const { lived, quick } = trying
    expect(quick.length / lived.length, `${quick.length} of ${lived.length} lives lasted under 2s`)
      .toBeLessThan(0.16)
  })

  it('is survivable for a while even by a thumb with no plan', () => {
    const { lived } = howLong(flailing, 2, 60)
    const mean = lived.reduce((a, b) => a + b, 0) / lived.length
    console.log(`  flailing: ${lived.length} lives, ${mean.toFixed(0)}s each`)
    expect(mean).toBeGreaterThan(4)
  })
}, 600_000)
