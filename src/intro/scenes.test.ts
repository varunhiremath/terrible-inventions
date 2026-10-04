import { describe, expect, it } from 'vitest'
import { DEEP_FOOTAGE, DUNGEON_PATH, gardenFootage as gardenFilm, floorUnder, SCENES } from './scenes'
import { isSolid as dungeonSolid } from '../arcade/dungeon/level'
import { levelFor as dungeonLevel } from '../arcade/dungeon/levels'

/**
 * These are for the two ways a cutscene goes wrong without anything failing.
 *
 * A canvas handed a NaN draws nothing and says nothing, so a scene can be
 * quietly blank for a whole beat. And a character can be drawn perfectly at a
 * position that has no floor under it, which is how the dungeon scene spent a
 * pan striding through mid-air — every number involved was finite and
 * reasonable and the picture was still wrong.
 *
 * What these cannot check is whether it looks like anything. That still needs
 * rendering it and looking, which is how every real fault in this file was
 * found.
 */

/*
 * The figure code builds `Path2D` objects, which node has no idea about. A
 * stub that records nothing is enough: what is being checked here is the
 * numbers going in, and those are checked as they are passed.
 */
class StubPath {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  arc() {}
  ellipse() {}
  rect() {}
  closePath() {}
}
;(globalThis as unknown as { Path2D: unknown }).Path2D ??= StubPath

/** A canvas that records what it was asked to do and complains about NaN. */
function recorder() {
  const drawn: string[] = []
  const bad: string[] = []
  const check = (name: string, args: unknown[]) => {
    for (const arg of args) {
      if (typeof arg === 'number' && !Number.isFinite(arg)) bad.push(`${name}(${args.join(', ')})`)
    }
  }
  const noop = () => {}
  const target = {
    canvas: { width: 0, height: 0 },
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
    drawn,
    bad,
  } as unknown as CanvasRenderingContext2D & { drawn: string[]; bad: string[] }

  return new Proxy(target, {
    get(base, key: string) {
      if (key in base) return (base as unknown as Record<string, unknown>)[key]
      return (...args: unknown[]) => {
        check(key, args)
        if (key === 'fill' || key === 'fillRect' || key === 'stroke' || key === 'fillText') {
          drawn.push(key)
        }
        return undefined
      }
    },
    set() {
      return true
    },
  }) as CanvasRenderingContext2D & { drawn: string[]; bad: string[] }
}

const SHAPES = [
  { w: 420, h: 720, name: 'upright' },
  { w: 720, h: 420, name: 'on its side' },
  { w: 300, h: 300, name: 'square' },
]

describe('every scene', () => {
  for (const name of Object.keys(SCENES)) {
    for (const shape of SHAPES) {
      it(`${name} draws something, ${shape.name}, all the way through`, () => {
        for (const clock of [0, 0.5, 3, 9, 17, 26, 40]) {
          const ctx = recorder()
          SCENES[name]({ ctx, w: shape.w, h: shape.h, t: (clock % 6) / 6, clock })
          expect(ctx.bad, `${name} at ${clock}s`).toEqual([])
          expect(ctx.drawn.length, `${name} at ${clock}s drew nothing`).toBeGreaterThan(0)
        }
      })
    }
  }
})

describe('the dungeon walk', () => {
  const level = dungeonLevel(1)

  it('only ever stands him on something solid', () => {
    /*
     * The bug this replaced: he was drawn at the row he starts on for the
     * whole pan, and that row is empty air for most of the level, so the
     * trailer showed him striding along on nothing — the one complaint the
     * game itself had already had.
     */
    for (const { col, row } of DUNGEON_PATH) {
      const line = level.rows[row]
      expect(line, `column ${col} sends him to row ${row}, which is off the level`).toBeDefined()
      expect(
        dungeonSolid(line[col] ?? ' '),
        `column ${col}: row ${row} is '${line?.[col]}', which is not something to stand on`,
      ).toBe(true)
    }
  })

  it('leaves the holes out instead of floating him over them', () => {
    /*
     * The bug after that one: every column got an answer, and the columns with
     * no floor were spanned on an arc — which over a level that is mostly hole
     * is a man bouncing through the air, and was reported as exactly that.
     * A hole has no entry now, so a jump is one step wide.
     */
    const width = Math.max(...level.rows.map((r) => r.length))
    expect(DUNGEON_PATH.length).toBeGreaterThan(4)
    expect(DUNGEON_PATH.length, 'every column has a floor, so nothing is being skipped').toBeLessThan(width)
  })

  it('goes forwards, one column at a time', () => {
    for (let i = 1; i < DUNGEON_PATH.length; i++) {
      expect(DUNGEON_PATH[i].col).toBeGreaterThan(DUNGEON_PATH[i - 1].col)
    }
  })
})

describe('finding the floor', () => {
  const rows = ['####', '  # ', '#  #', '####']

  it('searches downwards, so a ceiling is never mistaken for a floor', () => {
    // Starting at row 1 and looking down, column 0's floor is the bottom row —
    // not the border along the top, which is what searching from zero finds.
    expect(floorUnder(rows, 0, 1, (t) => t === '#')).toBe(2)
  })

  it('gives up rather than guessing when there is nothing below', () => {
    expect(floorUnder(['   ', '   '], 1, 0, (t) => t === '#')).toBe(null)
  })

  it('has no answer off the end of a row', () => {
    expect(floorUnder(rows, 9, 0, (t) => t === '#')).toBe(null)
  })
})

describe('the deep-space recording', () => {
  /*
   * The story says something lives out here over this footage, and the first
   * seed tried had no alien on screen for that beat or the two after it. A
   * line about aliens over an empty sky is the kind of thing that is obvious
   * in a photograph and invisible in a diff, so it is counted here.
   *
   * The window is the five beats that use this scene: 21.4s to 42.9s into the
   * cutscene, read back at ten frames a second.
   */
  const window = DEEP_FOOTAGE().slice(214, 430)

  it('has an alien on screen for nearly all of it', () => {
    const seen = window.filter((f) => f.rubble.some((r) => r.kind === 'alien')).length
    expect(seen / window.length).toBeGreaterThan(0.85)
  })

  it('has them shooting back', () => {
    const firing = window.filter((f) => f.shots.length > 0).length
    expect(firing).toBeGreaterThan(0)
  })

  it('is long enough to still be moving at the last beat', () => {
    expect(DEEP_FOOTAGE().length / 10).toBeGreaterThanOrEqual(43)
  })
})

describe('the garden recording', () => {
  /*
   * The beats that run over this stretch are the ones about looping round onto
   * your own tail, which is the one move in that game nobody will find on
   * their own. The first cut played them over a snake going in a straight line
   * eating — true of the game, useless as an explanation.
   *
   * The window is beats five and six: 21.4s to 31.6s into the cutscene, read
   * back at ten frames a second.
   */
  it('closes a ring while the beats about rings are playing', () => {
    const window = gardenFilm().slice(214, 317)
    const curled = window.some((f) => f.ring !== null && f.ring.length > 5)
    expect(curled, 'the snake never loops while the line about looping is said').toBe(true)
  })

  it('is long enough to still be moving at the last beat', () => {
    expect(gardenFilm().length / 10).toBeGreaterThanOrEqual(42)
  })
})
