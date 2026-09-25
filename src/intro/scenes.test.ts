import { describe, expect, it } from 'vitest'
import { DUNGEON_FLOORS, floorUnder, SCENES } from './scenes'
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
  it('only ever stands him on something solid', () => {
    /*
     * The bug: he was drawn at the row he starts on for the whole pan, and
     * that row is empty air for most of the level. The trailer showed him
     * walking along on nothing, which is the one complaint the game itself had
     * already had.
     */
    const level = dungeonLevel(1)
    DUNGEON_FLOORS.forEach((row, col) => {
      if (row === null) return
      const line = level.rows[row]
      expect(line, `column ${col} sends him to row ${row}, which is off the level`).toBeDefined()
      expect(
        dungeonSolid(line[col] ?? ' '),
        `column ${col}: row ${row} is '${line?.[col]}', which is not something to stand on`,
      ).toBe(true)
    })
  })

  it('covers every column of the level', () => {
    expect(DUNGEON_FLOORS.length).toBe(Math.max(...dungeonLevel(1).rows.map((r) => r.length)))
  })

  it('knows a hole when it sees one', () => {
    // If this ever comes back all-floors, the jump handling above is dead code
    // and something has quietly changed about how levels are written.
    expect(DUNGEON_FLOORS.some((row) => row === null)).toBe(true)
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
