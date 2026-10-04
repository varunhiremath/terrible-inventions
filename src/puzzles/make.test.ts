import { describe, expect, it } from 'vitest'
import { makeRng } from '../engine/rng'
import { degrees, newFigure, oneStroke } from './stroke'
import { newMaze, wayThrough, ways } from './maze'
import { newFlow, touching } from './flow'

/**
 * The three generators.
 *
 * Every one of these puzzles is made backwards, from an answer that exists
 * before the puzzle does, and every one of these tests checks the forwards
 * direction instead — the puzzle as it will be handed over, with the
 * construction forgotten. A test that trusts how a thing was built cannot
 * catch the thing being built wrong.
 */

describe('a one-stroke figure', () => {
  it('can always actually be drawn in one stroke', () => {
    /*
     * The whole point. A figure with four odd corners looks exactly like a
     * figure with two, and the only way to find out is to hand it to somebody
     * and watch them fail for ten minutes at something impossible.
     */
    for (let seed = 1; seed <= 300; seed++) {
      const figure = newFigure(5, 5, 16, makeRng(seed))
      const { can, starts } = oneStroke(figure)
      expect(can, `seed ${seed}: ${figure.lines.length} lines`).toBe(true)
      expect(starts.length, `seed ${seed}`).toBeGreaterThan(0)
    }
  })

  it('has an answer that is a real stroke: joined up, and no line twice', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const figure = newFigure(5, 5, 16, makeRng(seed))
      const drawn = new Set<string>()
      const has = new Set(figure.lines.map((l) => `${l.a}:${l.b}`))
      for (let i = 1; i < figure.answer.length; i++) {
        const a = figure.answer[i - 1]
        const b = figure.answer[i]
        const name = a < b ? `${a}:${b}` : `${b}:${a}`
        expect(has.has(name), `seed ${seed}: ${name} is not a line of the figure`).toBe(true)
        expect(drawn.has(name), `seed ${seed}: ${name} drawn twice`).toBe(false)
        drawn.add(name)
      }
      expect(drawn.size, `seed ${seed}`).toBe(figure.lines.length)
    }
  })

  it('starts where it has to start', () => {
    // Two odd corners means you must begin at one of them; a figure that says
    // otherwise is a figure that cannot be finished from where it offers.
    for (let seed = 1; seed <= 200; seed++) {
      const figure = newFigure(5, 5, 16, makeRng(seed))
      const { starts } = oneStroke(figure)
      expect(starts, `seed ${seed}`).toContain(figure.answer[0])
    }
  })

  it('is big enough to be worth doing', () => {
    let total = 0
    for (let seed = 1; seed <= 100; seed++) {
      total += newFigure(5, 5, 16, makeRng(seed)).lines.length
    }
    expect(total / 100, 'lines on an average figure').toBeGreaterThan(10)
  })

  it('never draws two diagonals across the same square', () => {
    /*
     * They cross in the middle, where there is no corner — so the figure shows
     * a junction you cannot draw through, and anybody solving it by eye is
     * being lied to by the picture.
     */
    for (let seed = 1; seed <= 200; seed++) {
      const f = newFigure(5, 5, 16, makeRng(seed))
      const diagonals = f.lines.filter((l) => {
        const a = f.dots[l.a]
        const b = f.dots[l.b]
        return a.x !== b.x && a.y !== b.y
      })
      for (let i = 0; i < diagonals.length; i++) {
        for (let j = i + 1; j < diagonals.length; j++) {
          const p = f.dots[diagonals[i].a]
          const q = f.dots[diagonals[i].b]
          const r = f.dots[diagonals[j].a]
          const s = f.dots[diagonals[j].b]
          const sameSquare =
            Math.min(p.x, q.x) === Math.min(r.x, s.x) && Math.min(p.y, q.y) === Math.min(r.y, s.y)
          expect(sameSquare, `seed ${seed}: two diagonals in one square`).toBe(false)
        }
      }
    }
  })

  it('knows an impossible figure when it sees one', () => {
    /*
     * The control. Four corners all joined to each other has four odd corners
     * and cannot be done — if `oneStroke` said yes to this, every test above
     * would pass while meaning nothing.
     */
    const dots = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
    const all = { dots, lines: [
      { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 },
      { a: 1, b: 2 }, { a: 1, b: 3 }, { a: 2, b: 3 },
    ], answer: [], across: 2, down: 2 }
    expect(degrees(all)).toEqual([3, 3, 3, 3])
    expect(oneStroke(all).can).toBe(false)

    // And two separate lines, which are each drawable and not together.
    const apart = { dots: [...dots, { x: 3, y: 0 }, { x: 4, y: 0 }], lines: [
      { a: 0, b: 1 }, { a: 4, b: 5 },
    ], answer: [], across: 6, down: 2 }
    expect(oneStroke(apart).can).toBe(false)
  })
})

describe('a maze', () => {
  it('always has a way through', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const maze = newMaze(9, 11, makeRng(seed))
      expect(maze.answer.length, `seed ${seed}`).toBeGreaterThan(0)
      expect(maze.answer[0]).toBe(maze.from)
      expect(maze.answer[maze.answer.length - 1]).toBe(maze.to)
    }
  })

  it('has a way through made only of steps you are allowed to take', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const maze = newMaze(9, 11, makeRng(seed))
      for (let i = 1; i < maze.answer.length; i++) {
        expect(ways(maze, maze.answer[i - 1]), `seed ${seed} step ${i}`)
          .toContain(maze.answer[i])
      }
    }
  })

  it('has every square reachable and exactly one route between any two', () => {
    /*
     * What "perfect" means, and why it matters: one route means the way out
     * can be shown rather than guessed at, and every square reachable means no
     * part of the picture is a lie.
     *
     * A grid with every square reachable and no loops has exactly one fewer
     * opening than it has squares — so counting the openings proves both at
     * once.
     */
    for (let seed = 1; seed <= 100; seed++) {
      const maze = newMaze(9, 11, makeRng(seed))
      const cells = maze.across * maze.down
      const found = new Set([0])
      const todo = [0]
      let openings = 0
      while (todo.length > 0) {
        const here = todo.pop()
        if (here === undefined) break
        for (const there of ways(maze, here)) {
          if (!found.has(there)) { found.add(there); todo.push(there) }
        }
      }
      for (let c = 0; c < cells; c++) openings += ways(maze, c).length
      expect(found.size, `seed ${seed}: reachable`).toBe(cells)
      expect(openings / 2, `seed ${seed}: openings`).toBe(cells - 1)
    }
  })

  it('is long enough to be a maze rather than a corridor', () => {
    let total = 0
    for (let seed = 1; seed <= 50; seed++) total += newMaze(9, 11, makeRng(seed)).answer.length
    // The shortest possible route across a 9x11 is 19 squares. Anything near
    // that is a straight line with decorations.
    expect(total / 50, 'squares on an average route').toBeGreaterThan(30)
  })

  it('says so when there is no way through', () => {
    // The control: wall every square off and the finder has to come back
    // empty rather than confidently wrong.
    const maze = newMaze(5, 5, makeRng(3))
    const sealed = {
      ...maze,
      right: maze.right.map(() => true),
      below: maze.below.map(() => true),
    }
    expect(wayThrough(sealed, 0, 24)).toEqual([])
  })
})

describe('joining the dots', () => {
  const SIZES: [number, number, number][] = [[6, 6, 4], [8, 8, 5], [6, 8, 3], [10, 10, 6]]

  it('covers every square exactly once, between all the colours', () => {
    // Which is the rule of the game: full board, or it is not finished.
    for (const [across, down, colours] of SIZES) {
      for (let seed = 1; seed <= 60; seed++) {
        const flow = newFlow(across, down, colours, makeRng(seed))
        const seen = new Set<number>()
        let count = 0
        for (const arc of flow.answer) {
          for (const cell of arc) { seen.add(cell); count += 1 }
        }
        expect(count, `${across}x${down} seed ${seed}`).toBe(across * down)
        expect(seen.size, `${across}x${down} seed ${seed}: a square used twice`)
          .toBe(across * down)
      }
    }
  })

  it('gives every colour a path of squares that are actually next to each other', () => {
    for (const [across, down, colours] of SIZES) {
      for (let seed = 1; seed <= 60; seed++) {
        const flow = newFlow(across, down, colours, makeRng(seed))
        for (const [i, arc] of flow.answer.entries()) {
          for (let j = 1; j < arc.length; j++) {
            expect(touching(flow, arc[j - 1], arc[j]), `seed ${seed} colour ${i} step ${j}`)
              .toBe(true)
          }
        }
      }
    }
  })

  it('shows the two ends of each path and nothing else', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const flow = newFlow(8, 8, 5, makeRng(seed))
      expect(flow.ends.length).toBe(flow.answer.length)
      for (const [i, arc] of flow.answer.entries()) {
        expect(flow.ends[i][0]).toBe(arc[0])
        expect(flow.ends[i][1]).toBe(arc[arc.length - 1])
      }
      // And no two dots on the same square, which would be two colours asked
      // to fill one hole.
      const dots = flow.ends.flat()
      expect(new Set(dots).size, `seed ${seed}`).toBe(dots.length)
    }
  })

  it('gives every colour something to do', () => {
    /*
     * A colour whose two dots are already side by side is a colour that is
     * solved before anybody looks at it. One or two of those is fine and is
     * how the real game opens its boards; four out of five is a board that
     * solves itself.
     */
    for (const [across, down, colours] of SIZES) {
      let gifts = 0
      let all = 0
      for (let seed = 1; seed <= 60; seed++) {
        const flow = newFlow(across, down, colours, makeRng(seed))
        for (const arc of flow.answer) {
          all += 1
          if (arc.length <= 2) gifts += 1
        }
      }
      expect(gifts / all, `${across}x${down}: ${((gifts / all) * 100).toFixed(0)}% free`)
        .toBeLessThan(0.25)
    }
  })

  it('asks for as many colours as it was asked for', () => {
    for (const [across, down, colours] of SIZES) {
      for (let seed = 1; seed <= 40; seed++) {
        expect(newFlow(across, down, colours, makeRng(seed)).ends.length, `seed ${seed}`)
          .toBe(colours)
      }
    }
  })
})
