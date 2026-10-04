import { describe, expect, it } from 'vitest'
import {
  COSTS, MOST_OF, SOLAR_SYSTEM, costOf, payoutOf, worldFor, type Upgrade,
} from './level'
import { FIXED, NO_INPUT, newRun, step, type Run } from './run'

/**
 * What the sky is worth, against what the shop charges.
 *
 * The report was that every upgrade was aboard before Mars, and after that the
 * game had nothing left to ask. The prices said in a comment that they were
 * set so everything could be owned "by Uranus if you have been greedy about
 * it", and that comment was out by a factor of three — nobody had ever added
 * up what a world actually sends.
 *
 * So this adds it up. It is the one number that decides whether the middle of
 * this game has anything in it, and it cannot be eyeballed off the costs: a
 * world's worth is its length times its traffic times what its particular mix
 * of things pays, and three of those move independently.
 */

/** Everything a world sends, totalled, whether or not anybody could shoot it. */
function worthOf(n: number): number {
  const seeds = [7, 23, 41, 59, 97]
  const totals = seeds.map((seed) => {
    // Nobody flying and nobody shooting: this is the supply, not a take.
    let run: Run = newRun(n, 99, 0, seed)
    const seen = new Set<number>()
    let worth = 0
    for (let t = 0; t < worldFor(n).seconds; t += FIXED) {
      run = step({ ...run, mercy: 1, shields: 99 }, NO_INPUT, FIXED)
      for (const r of run.rubble) {
        if (seen.has(r.id)) continue
        seen.add(r.id)
        // Pieces and all: a rock is worth what it and its shards come to.
        worth += payoutOf(r.kind)
      }
    }
    return worth
  })
  return totals.reduce((a, b) => a + b, 0) / totals.length
}

/** The gun, in full, not counting the shields bought along the way. */
const KIT: Upgrade[] = ['rapid', 'twin', 'pierce', 'magnet']
const priceOfAll = (upTo: (what: Upgrade) => number) =>
  KIT.reduce((sum, what) => {
    let cost = 0
    for (let have = 0; have < upTo(what); have++) cost += costOf(what, have)
    return sum + cost
  }, 0)

/** What everything but the extra magnets costs: the kit the trip is about. */
const CORE = priceOfAll((what) => (what === 'magnet' ? 1 : MOST_OF[what]))
const EVERYTHING = priceOfAll((what) => MOST_OF[what])

/**
 * How much of what passes somebody actually catches.
 *
 * Three quarters, because this has to be measured against the player the
 * complaint came from, and he is good at it. At a half the sums below have so
 * much slack that the prices which caused the complaint pass them — checked,
 * by putting the old ones back.
 */
const CAUGHT = 0.75

describe('the shop against the sky', () => {
  const upTo = (n: number) => {
    let sum = 0
    for (let i = 1; i <= n; i++) sum += worthOf(i)
    return sum * CAUGHT
  }

  it('cannot sell a single gun part out of the whole of the first world', () => {
    /*
     * The report, in its sharpest form: "he gets all the upgrades before
     * Venus". Which sounded impossible against a kit priced at 320 — until
     * the first world was added up.
     *
     * Mercury holds 40 cells. The magnet cost 40. One Mercury, exactly, bought
     * the upgrade he named as the one that makes the game trivial, and he had
     * it before the second world. Three on screen at a time, five seconds each
     * to cross, forty-five seconds of it: about twenty-seven things, mostly
     * rocks, which is the number — and nobody had ever worked it out.
     *
     * So this is measured against the *whole* of the first world rather than
     * against a share of it. Not "unlikely to afford": cannot, even having
     * caught every cell Mercury has in it.
     */
    const everything = worthOf(1)
    const cheapest = Math.min(...KIT.map((w) => costOf(w, 0)))
    expect(
      everything,
      `the whole of ${worldFor(1).name} is ${everything} cells and the cheapest gun part is ${cheapest}`,
    ).toBeLessThan(cheapest)
  })

  it('does sell a shield that early, so the first world is still worth something', () => {
    // The other way round is its own fault: a shop that can sell you nothing
    // at all for two worlds is a shop nobody opens a third time.
    expect(worthOf(1)).toBeGreaterThan(COSTS.shield)
  })

  it('hands over the first thing somewhere around Earth', () => {
    const cheapest = Math.min(...KIT.map((w) => costOf(w, 0)), COSTS.shield)
    expect(upTo(2)).toBeLessThan(CORE / 2)
    expect(upTo(3)).toBeGreaterThan(cheapest)
  })

  it('does not hand the whole gun over before the far planets', () => {
    /*
     * The fault, stated as a test. Mercury, Venus and Earth used to be worth
     * 258 cells against a kit priced at 320 — so a good run through three
     * worlds bought nearly all of it, and Mars onwards had nothing left to
     * offer. Nothing anywhere said so.
     */
    for (let n = 1; n <= 5; n++) {
      expect(upTo(n), `the whole gun is affordable by world ${n}`).toBeLessThan(CORE)
    }
  })

  it('does hand it over by the time the planets run out', () => {
    // And the other way: an upgrade nobody can ever afford is not an upgrade,
    // it is a taunt.
    expect(upTo(SOLAR_SYSTEM)).toBeGreaterThan(CORE)
  })

  it('still has something to spend on out past the planets', () => {
    // Shields are bought over and over out there, and the magnet has two more
    // sizes. A purse with nothing to buy is a score, and this game has one of
    // those already.
    expect(EVERYTHING).toBeGreaterThan(CORE)
    expect(MOST_OF.magnet).toBeGreaterThan(1)
  })
}, 120_000)
