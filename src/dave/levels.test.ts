import { describe, expect, it } from 'vitest'
import { LEVEL_TILES_X, LEVEL_TILES_Y, TILE, normalise, tileAt } from './level'
import { floorIsHonest } from './physics'
import { LEVELS, levelFor } from './levels'
import { reachableTiles, solve } from './solve'

const all = LEVELS.map((lv) => normalise(lv))

describe('the ten levels', () => {
  it('there are ten of them', () => {
    expect(LEVELS).toHaveLength(10)
  })

  it('picks the right one, and does not fall off either end', () => {
    expect(levelFor(1)).toBe(LEVELS[0])
    expect(levelFor(10)).toBe(LEVELS[9])
    expect(levelFor(0)).toBe(LEVELS[0])
    expect(levelFor(99)).toBe(LEVELS[9])
  })

  all.forEach((level, i) => {
    describe(`${i + 1}. ${level.name}`, () => {
      it('is the size the game expects', () => {
        expect(level.rows).toHaveLength(LEVEL_TILES_Y)
        for (const row of level.rows) expect(row).toHaveLength(LEVEL_TILES_X)
      })

      it('has exactly one trophy and one door', () => {
        const all = level.rows.join('')
        expect([...all].filter((t) => t === TILE.TROPHY)).toHaveLength(1)
        expect([...all].filter((t) => t === TILE.DOOR)).toHaveLength(1)
      })

      it('has a floor you can see', () => {
        // Everything past the edge of the map counts as solid, so a gap in the
        // bottom row is an invisible floor. Four of these were in the first
        // draft and none of them looked wrong.
        expect(floorIsHonest(level)).toEqual([])
      })

      it('starts him somewhere he can stand', () => {
        const { x, y } = level.start
        expect(tileAt(level, x, y)).toBe(TILE.EMPTY)
        expect(tileAt(level, x, y + 1)).toBe(TILE.BRICK)
      })

      it('does not bury anything in a wall', () => {
        const buried: string[] = []
        level.rows.forEach((row, y) =>
          [...row].forEach((tile, x) => {
            if (tile === TILE.EMPTY || tile === TILE.BRICK) return
            if (tile === TILE.FIRE || tile === TILE.WATER || tile === TILE.TENTACLE) return
            // A pickup with brick on every side can never be taken.
            const walled =
              tileAt(level, x - 1, y) === TILE.BRICK &&
              tileAt(level, x + 1, y) === TILE.BRICK &&
              tileAt(level, x, y - 1) === TILE.BRICK &&
              tileAt(level, x, y + 1) === TILE.BRICK
            if (walled) buried.push(`${tile} at ${x},${y}`)
          }),
        )
        expect(buried).toEqual([])
      })

      it('puts every creature somewhere open', () => {
        for (const m of level.monsters ?? []) {
          expect(tileAt(level, m.at.x, m.at.y)).toBe(TILE.EMPTY)
        }
      })

      it('has no treasure nobody can get to', () => {
        /*
         * `solve` only ever asked whether the trophy and the door could be
         * reached, so a diamond walled into a gap too narrow to enter was
         * invisible to it. Ninety of them across these ten levels were exactly
         * that, and it took somebody playing level three to notice.
         */
        const loot = new Set<string>([
          TILE.SPHERE, TILE.GEM, TILE.DIAMOND, TILE.RING, TILE.RUBY, TILE.CROWN,
        ])
        const reach = reachableTiles(level)
        const stranded: string[] = []
        level.rows.forEach((row, y) =>
          [...row].forEach((tile, x) => {
            if (loot.has(tile) && !reach.has(`${x},${y}`)) stranded.push(`${tile} at ${x},${y}`)
          }),
        )
        expect(stranded).toEqual([])
      }, 120_000)

      it('can be finished', () => {
        /*
         * The one that matters, and the slow one. It searches the level with
         * the real physics rather than trusting the drawing — the platformer
         * version of flood-filling the maze.
         */
        const result = solve(level)
        expect({ level: level.name, ...result, explored: undefined }).toMatchObject({
          solvable: true,
          trophy: true,
          gaveUp: false,
        })
      }, 60000)
    })
  })
})
