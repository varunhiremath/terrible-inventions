import { describe, expect, it } from 'vitest'
import { CAR_LONG, CAR_WIDE, LENGTH_OF, WIDTH_OF, levelFor } from './level'
import { FIXED, newRun, step, type Run } from './run'
import { makeDriver } from './run.test'

/**
 * Nothing on this road may be inside anything else on it.
 *
 * Reported as "sometimes they are overlapping or crashing into each other but
 * they still continue", which is exactly what you see when every body on the
 * road avoids every other body by *steering* and nothing enforces it
 * afterwards. Steering is a plan made from where things are now, and the road
 * is full of things that are moving relative to each other, so a plan is not a
 * guarantee — that lesson has now arrived five times in this game alone.
 *
 * So this walks whole races and looks at the picture on every single slice,
 * which is the only place the fault was ever visible.
 */

/** A body on the road: where it is, and how much room it takes up. */
interface Body {
  what: string
  y: number
  lane: number
  wide: number
  long: number
}

function bodies(run: Run): Body[] {
  const all: Body[] = [
    { what: 'you', y: run.distance, lane: run.lane, wide: CAR_WIDE, long: CAR_LONG },
  ]
  for (const car of run.cars) {
    all.push({
      what: `a ${car.kind}`,
      y: car.y,
      lane: car.lane,
      wide: WIDTH_OF[car.kind],
      long: CAR_LONG * LENGTH_OF[car.kind],
    })
  }
  for (const racer of run.racers) {
    if (racer.finished !== null) continue
    all.push({ what: racer.who.name, y: racer.y, lane: racer.lane, wide: CAR_WIDE, long: CAR_LONG })
  }
  return all
}

/** How far two bodies are inside each other, in car lengths. Zero is clear. */
function inside(a: Body, b: Body): number {
  const apart = Math.abs(a.lane - b.lane)
  const sides = (a.wide + b.wide) / 2
  if (apart >= sides) return 0
  const along = Math.abs(a.y - b.y)
  const ends = (a.long + b.long) / 2
  if (along >= ends) return 0
  return (ends - along) / CAR_LONG
}

describe('two cars in the same place', () => {
  it('never happens, on any level, to anybody', () => {
    const worst: { level: number; at: number; deep: number; who: string }[] = []

    for (let number = 1; number <= 8; number++) {
      const drive = makeDriver()
      let run = newRun(number, 3, 0, number * 31 + 7)
      const level = levelFor(number)
      for (let t = 0; t < 90 && run.status === 'driving'; t += FIXED) {
        run = step(run, drive(run), FIXED)
        if (run.distance >= level.distance) break
        /*
         * Hitting something is the game, so the frame you hit it on is not a
         * fault. The traffic is cleared out around you on the next step; what
         * this is looking for is the pairs that stay inside each other.
         */
        if (run.status !== 'driving') break
        const all = bodies(run)
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const deep = inside(all[i], all[j])
            // A touch is a touch; anything a tenth of a length in is two cars
            // drawn on top of each other.
            if (deep > 0.1) {
              worst.push({ level: number, at: t, deep, who: `${all[i].what} / ${all[j].what}` })
            }
          }
        }
      }
    }

    worst.sort((a, b) => b.deep - a.deep)
    const kinds = new Map<string, number>()
    for (const w of worst) kinds.set(w.who, (kinds.get(w.who) ?? 0) + 1)
    console.log([...kinds].sort((a, b) => b[1] - a[1]).slice(0, 15).map((k) => `${k[0]}: ${k[1]}`).join('\n'))
    const said = worst
      .slice(0, 6)
      .map((w) => `level ${w.level} at ${w.at.toFixed(1)}s: ${w.who}, ${w.deep.toFixed(2)} lengths in`)
      .join('\n')
    expect(`${worst.length} overlaps\n${said}`).toBe('0 overlaps\n')
  })
})
