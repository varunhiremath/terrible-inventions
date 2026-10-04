import { describe, expect, it } from 'vitest'
import { KINDS } from './level'
import { drag, lift, newRun, touch, type Run } from './run'
import { placeAt, placesBetween, sheetOf, spotOf } from './draw'

const VIEW = { w: 900, h: 1600, clock: 0 }
const levelOf = (kind: string, round = 0) => KINDS.indexOf(kind as never) + 1 + round * KINDS.length

describe('where a finger lands', () => {
  it('finds the place it is put on, for every place on every board', () => {
    for (const kind of KINDS) {
      const run = newRun(levelOf(kind, 3), 5)
      const sheet = sheetOf(VIEW, run.board)
      const places = run.board.kind === 'stroke'
        ? run.board.figure.dots.map((_, i) => i)
        : Array.from(
            { length: (run.board.kind === 'maze' ? run.board.maze : run.board.flow).across
              * (run.board.kind === 'maze' ? run.board.maze : run.board.flow).down },
            (_, i) => i,
          )
      for (const place of places) {
        const at = spotOf(run.board, sheet, place)
        expect(placeAt(run.board, sheet, at.x, at.y), `${kind}: place ${place}`).toBe(place)
      }
    }
  })

  it('finds nothing off the paper', () => {
    for (const kind of KINDS) {
      const run = newRun(levelOf(kind), 5)
      const sheet = sheetOf(VIEW, run.board)
      expect(placeAt(run.board, sheet, -50, -50)).toBe(null)
      expect(placeAt(run.board, sheet, VIEW.w + 50, VIEW.h + 50)).toBe(null)
    }
  })

  it('keeps the puzzle on the paper, whatever shape the screen is', () => {
    // A column going off the edge is invisible until it happens, and it
    // happens on exactly one phone.
    for (const view of [{ w: 400, h: 1800 }, { w: 1800, h: 400 }, { w: 700, h: 700 }]) {
      for (const kind of KINDS) {
        const run = newRun(levelOf(kind, 4), 2)
        const sheet = sheetOf({ ...view, clock: 0 }, run.board)
        const count = run.board.kind === 'stroke' ? run.board.figure.dots.length : 0
        const places = run.board.kind === 'stroke'
          ? Array.from({ length: count }, (_, i) => i)
          : [0, 1, 2]
        for (const place of places) {
          const at = spotOf(run.board, sheet, place)
          expect(at.x, `${kind} at ${view.w}x${view.h}`).toBeGreaterThanOrEqual(sheet.x - 1)
          expect(at.x, `${kind} at ${view.w}x${view.h}`).toBeLessThanOrEqual(sheet.x + sheet.w + 1)
          expect(at.y, `${kind} at ${view.w}x${view.h}`).toBeGreaterThanOrEqual(sheet.y - 1)
          expect(at.y, `${kind} at ${view.w}x${view.h}`).toBeLessThanOrEqual(sheet.y + sheet.h + 1)
        }
      }
    }
  })
})

describe('a finger moving quickly', () => {
  it('leaves out nothing it passed over', () => {
    /*
     * The whole reason this exists. A finger crossing a phone covers two or
     * three squares between one frame and the next, and the rules only ever
     * answer questions about one step — so a jump handed over whole is a jump
     * the game is right to refuse, and the trail stops dead.
     */
    const run = newRun(levelOf('maze', 2), 5)
    if (run.board.kind !== 'maze') throw new Error('wrong kind')
    const sheet = sheetOf(VIEW, run.board)
    const { across } = run.board.maze
    /*
     * The square it started in comes first, because the first sample is only a
     * third of a square along and has not left yet. That is right and it costs
     * nothing — dragging onto the place the trail is already on does nothing —
     * so the list is every square from where it was to where it is.
     */
    const from = spotOf(run.board, sheet, 0)
    const to = spotOf(run.board, sheet, 5)
    expect(placesBetween(run.board, sheet, from, to)).toEqual([0, 1, 2, 3, 4, 5])

    // And down a column.
    const down = spotOf(run.board, sheet, across * 4)
    expect(placesBetween(run.board, sheet, from, down))
      .toEqual([0, across, across * 2, across * 3, across * 4])
  })

  it('never hands the same place over twice in a row', () => {
    // A slow finger wandering inside one square would otherwise ask the same
    // question forty times a second.
    const run = newRun(levelOf('flow', 2), 5)
    const sheet = sheetOf(VIEW, run.board)
    const a = spotOf(run.board, sheet, 0)
    const b = { x: a.x + sheet.cell * 0.1, y: a.y + sheet.cell * 0.1 }
    const steps = placesBetween(run.board, sheet, a, b)
    expect(steps.length).toBeLessThanOrEqual(1)
  })

  it('actually gets a trail moving, where one long jump would not', () => {
    /*
     * The same thing said as the game sees it: the control experiment is the
     * jump handed over whole, which must go nowhere.
     */
    const fresh = newRun(levelOf('maze', 2), 5)
    if (fresh.board.kind !== 'maze') throw new Error('wrong kind')
    const sheet = sheetOf(VIEW, fresh.board)
    const route = fresh.board.maze.answer
    const far = route[Math.min(6, route.length - 1)]

    const jumped = drag(touch(fresh, route[0]), far)
    expect(jumped.trails[0].length, 'a jump went somewhere').toBe(1)

    let walked: Run = touch(fresh, route[0])
    let at = spotOf(fresh.board, sheet, route[0])
    for (const step of route.slice(1, 7)) {
      const next = spotOf(fresh.board, sheet, step)
      for (const place of placesBetween(fresh.board, sheet, at, next)) {
        walked = drag(walked, place)
      }
      at = next
    }
    walked = lift(walked)
    expect(walked.trails[0].length, 'walking it got nowhere').toBe(7)
  })
})
