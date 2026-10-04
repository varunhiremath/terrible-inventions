import { describe, expect, it } from 'vitest'
import { KINDS, kindFor, sizeFor } from './level'
import {
  FIXED, LOUDEST, drag, howFar, isDone, lift, newRun, nextPuzzle, showMe, step, strokeLines,
  touch, wipe, type PuzzleEvent, type Run,
} from './run'

/** The level of the next puzzle of a given kind, from level 1. */
const levelOf = (kind: string, round = 0): number =>
  KINDS.indexOf(kind as never) + 1 + round * KINDS.length

/**
 * Draw a stroke until it can be asked to go over a line it has already drawn.
 *
 * Which needs a loop in the figure: going straight back the way you came is
 * rubbing out, not crossing, so the only way to be refused is to come round to
 * a corner by another route and try a line that is already there.
 */
function untilCrossing(run: Run): Run | null {
  const board = run.board
  if (board.kind !== 'stroke') return null
  const answer = board.figure.answer
  const joins = (a: number, b: number) =>
    board.figure.lines.some((l) => (l.a === a && l.b === b) || (l.b === a && l.a === b))
  let on = touch(run, answer[0])
  for (let i = 1; i < answer.length; i++) {
    on = drag(on, answer[i])
    const trail = on.trails[0]
    const head = trail[trail.length - 1]
    const back = trail.length > 1 ? trail[trail.length - 2] : -1
    const drawn = strokeLines(trail)
    for (let dot = 0; dot < board.figure.dots.length; dot++) {
      if (dot === head || dot === back) continue
      if (!joins(head, dot)) continue
      if (!drawn.has(head < dot ? `${head}:${dot}` : `${dot}:${head}`)) continue
      return drag(on, dot)
    }
  }
  return null
}

/**
 * Lay one colour down, then deliberately run another across it.
 *
 * It has to be deliberate. Two colours are two arcs of what was one loop a
 * moment ago, so drawing each along its own answer never puts one on top of
 * the other — the first cut of this test drew both answers and concluded that
 * cutting never happens. So: find a square of the second colour that the first
 * can actually reach, and go there on purpose.
 */
function untilCut(run: Run): Run | null {
  const board = run.board
  if (board.kind !== 'flow') return null
  const [first, second] = board.flow.answer
  if (!first || !second || second.length < 4) return null
  const { across } = board.flow
  const near = (a: number, b: number) =>
    Math.abs((a % across) - (b % across)) + Math.abs(Math.floor(a / across) - Math.floor(b / across)) === 1

  // Somewhere along the first colour that touches the middle of the second —
  // the middle, because its two ends are dots and those are refused outright.
  const middle = second.slice(1, -1)
  for (let i = 0; i < first.length; i++) {
    const target = middle.find((cell) => near(first[i], cell))
    if (target === undefined) continue
    let on = touch(run, second[0])
    for (let j = 1; j < second.length; j++) on = drag(on, second[j])
    on = lift(on)
    on = touch(on, first[0])
    for (let j = 1; j <= i; j++) on = drag(on, first[j])
    const was = on.trails[1].length
    on = drag(on, target)
    return on.trails[1].length < was ? on : null
  }
  return null
}

/** Play a whole answer through the real finger, one step at a time. */
function playAnswer(run: Run): Run {
  const board = run.board
  const answer =
    board.kind === 'stroke' ? [board.figure.answer]
    : board.kind === 'maze' ? [board.maze.answer]
    : board.flow.answer
  let on = run
  for (const path of answer) {
    if (path.length === 0) continue
    on = touch(on, path[0])
    for (let i = 1; i < path.length; i++) on = drag(on, path[i])
    on = lift(on)
  }
  return on
}

describe('every puzzle', () => {
  it('can be solved by drawing the answer it came with', () => {
    /*
     * The one test this game is for.
     *
     * Each of the three is generated backwards from an answer, and each of the
     * three has a separate set of rules about what a finger may do. It would
     * be entirely possible to generate a perfectly good answer and then write
     * rules that refuse to let anybody draw it — and the only way to find that
     * out is to play the answer through the same `touch` and `drag` the screen
     * uses, which is what this does.
     */
    for (const kind of KINDS) {
      for (let round = 0; round < 6; round++) {
        for (let seed = 1; seed <= 12; seed++) {
          const run = newRun(levelOf(kind, round), seed)
          const after = playAnswer(run)
          expect(after.solved, `${kind} round ${round} seed ${seed}`).toBe(true)
          expect(isDone(after), `${kind} round ${round} seed ${seed}`).toBe(true)
          expect(after.shown, 'drawing it yourself is not being shown it').toBe(false)
        }
      }
    }
  })

  it('is not solved before anybody has touched it', () => {
    for (const kind of KINDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const run = newRun(levelOf(kind), seed)
        expect(isDone(run), `${kind} seed ${seed}`).toBe(false)
        expect(run.solved).toBe(false)
        expect(howFar(run)).toBeLessThan(1)
      }
    }
  })

  it('says how far along it is, and gets further as the answer goes in', () => {
    for (const kind of KINDS) {
      const run = newRun(levelOf(kind, 2), 5)
      const board = run.board
      const answer =
        board.kind === 'stroke' ? board.figure.answer
        : board.kind === 'maze' ? board.maze.answer
        : board.flow.answer[0]
      let on = touch(run, answer[0])
      const seen = [howFar(on)]
      for (let i = 1; i < answer.length; i++) {
        on = drag(on, answer[i])
        seen.push(howFar(on))
      }
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i], `${kind} went backwards at ${i}`).toBeGreaterThanOrEqual(seen[i - 1])
      }
      expect(seen[seen.length - 1]).toBeGreaterThan(seen[0])
    }
  })

  it('raises no events once it is finished, ever again', () => {
    for (const kind of KINDS) {
      let run = playAnswer(newRun(levelOf(kind), 4))
      // The flag, not the last event: the finger coming up is the last thing
      // that happens and it quite correctly raises nothing.
      expect(run.solved, kind).toBe(true)
      for (let i = 0; i < 300; i++) {
        run = step(run, FIXED)
        expect(run.events, kind).toEqual([])
      }
      // And a finger on a finished puzzle does nothing at all.
      expect(touch(run, 0)).toBe(run)
      expect(drag(run, 1)).toBe(run)
    }
  })

  it('has a place in the order for every event it can raise', () => {
    const raised = new Set<PuzzleEvent>()
    const watch = (run: Run) => { for (const e of run.events) raised.add(e) }
    for (const kind of KINDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const fresh = newRun(levelOf(kind, 1), seed)
        // Played properly...
        let on = fresh
        const board = on.board
        const answer =
          board.kind === 'stroke' ? [board.figure.answer]
          : board.kind === 'maze' ? [board.maze.answer]
          : board.flow.answer
        for (const path of answer) {
          if (path.length === 0) continue
          on = touch(on, path[0]); watch(on)
          for (let i = 1; i < path.length; i++) { on = drag(on, path[i]); watch(on) }
          // ...and badly: back along the line, and over it again.
          if (path.length > 2) {
            on = drag(on, path[path.length - 2]); watch(on)
            on = drag(on, path[path.length - 1]); watch(on)
            on = drag(on, path[path.length - 2]); watch(on)
            on = drag(on, path[path.length - 1]); watch(on)
          }
          on = lift(on); watch(on)
        }
        watch(wipe(fresh))
        watch(showMe(fresh))
        // And the two that only happen when somebody plays badly: crossing a
        // line already drawn, and cutting another colour in half.
        const crossed = untilCrossing(fresh)
        if (crossed) watch(crossed)
        const cut = untilCut(fresh)
        if (cut) watch(cut)
      }
    }
    for (const e of raised) expect(LOUDEST, `${e} is not in the order`).toContain(e)
    expect([...raised].sort()).toEqual([...LOUDEST].sort())
  })
})

describe('the one-line puzzle', () => {
  const run = () => newRun(levelOf('stroke', 2), 7)

  it('lets the pen go back the way it came, which is rubbing out', () => {
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'stroke') throw new Error('wrong kind')
    let on = touch(fresh, board.figure.answer[0])
    on = drag(on, board.figure.answer[1])
    const drawn = strokeLines(on.trails[0]).size
    on = drag(on, board.figure.answer[0])
    expect(strokeLines(on.trails[0]).size).toBe(drawn - 1)
    expect(on.events).toContain('back')
  })

  it('will not let the same line be drawn twice', () => {
    /*
     * The entire rule of the puzzle, and it needs a loop in the figure to
     * test: going straight back the way you came is rubbing out, not crossing.
     * So the pen is walked along its answer until it stands at a corner with
     * an already-drawn line leading off it that is not the one it came in on.
     */
    let found = 0
    for (let seed = 1; seed <= 30; seed++) {
      const refused = untilCrossing(newRun(levelOf('stroke', 2), seed))
      if (!refused) continue
      found += 1
      expect(refused.events, `seed ${seed}`).toContain('no')
    }
    expect(found, 'no figure in thirty had a loop in it to test with')
      .toBeGreaterThan(20)
  })

  it('will not jump to a corner there is no line to', () => {
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'stroke') throw new Error('wrong kind')
    const from = board.figure.answer[0]
    const joined = new Set(
      board.figure.lines
        .filter((l) => l.a === from || l.b === from)
        .map((l) => (l.a === from ? l.b : l.a)),
    )
    const stranger = board.figure.dots.findIndex((_, i) => i !== from && !joined.has(i))
    if (stranger < 0) return
    const on = drag(touch(fresh, from), stranger)
    expect(on.trails[0]).toEqual([from])
  })

  it('starts again from wherever the finger goes down', () => {
    // There is only ever one stroke, so putting the pen down somewhere else is
    // starting again — said plainly rather than left to be discovered.
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'stroke') throw new Error('wrong kind')
    let on = touch(fresh, board.figure.answer[0])
    on = drag(on, board.figure.answer[1])
    on = drag(on, board.figure.answer[2])
    expect(on.trails[0].length).toBe(3)
    const restarted = touch(on, board.figure.answer[5])
    expect(restarted.trails[0]).toEqual([board.figure.answer[5]])
    expect(restarted.events).toContain('wipe')
  })
})

describe('the maze', () => {
  const run = () => newRun(levelOf('maze', 2), 7)

  it('begins with the finger already in the doorway', () => {
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'maze') throw new Error('wrong kind')
    expect(fresh.trails[0]).toEqual([board.maze.from])
  })

  it('will not go through a wall', () => {
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'maze') throw new Error('wrong kind')
    const open = new Set<number>()
    for (const cell of [board.maze.from]) {
      for (const way of [cell - 1, cell + 1, cell - board.maze.across, cell + board.maze.across]) {
        open.add(way)
      }
    }
    let walled = -1
    for (const near of open) {
      if (near < 0 || near >= board.maze.across * board.maze.down) continue
      if (!board.maze.answer.includes(near)) { walled = near; break }
    }
    const on = drag(touch(fresh, board.maze.from), walled)
    // Either it is a legal step or nothing happened; it is never a trail that
    // went through a wall.
    expect(on.trails[0].length).toBeLessThanOrEqual(2)
  })

  it('rubs out the loop when the trail crosses itself', () => {
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'maze') throw new Error('wrong kind')
    const route = board.maze.answer
    // The finger has to go down before it can be dragged, which is the whole
    // reason `drawing` exists and which this test forgot the first time.
    let on = touch(fresh, route[0])
    for (let i = 1; i < 6 && i < route.length; i++) on = drag(on, route[i])
    const was = on.trails[0].length
    on = touch(on, route[2])
    expect(on.trails[0].length).toBe(3)
    expect(was).toBeGreaterThan(3)
  })
})

describe('joining the dots', () => {
  const run = () => newRun(levelOf('flow', 2), 7)

  it('is not finished with every pair joined but the board half empty', () => {
    /*
     * The rule people forget, and the one that makes the puzzle a puzzle.
     *
     * Built here by joining each pair the short way where that is possible,
     * which leaves most of the board blank — and must not count.
     */
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'flow') throw new Error('wrong kind')
    let on = fresh
    let joined = 0
    for (const [i, arc] of board.flow.answer.entries()) {
      if (arc.length > 3) continue
      on = touch(on, arc[0])
      for (let j = 1; j < arc.length; j++) on = drag(on, arc[j])
      on = lift(on)
      if (on.trails[i].length === arc.length) joined += 1
    }
    if (joined === 0) return
    expect(isDone(on), 'a half-empty board counted as finished').toBe(false)
  })

  it('cuts the other line when one is drawn across it', () => {
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'flow') throw new Error('wrong kind')
    const [first, second] = board.flow.answer
    if (!first || !second || second.length < 4) return
    // Lay the second colour down, then run the first across it.
    let on = touch(fresh, second[0])
    for (let i = 1; i < second.length; i++) on = drag(on, second[i])
    on = lift(on)
    const laid = on.trails[1].length
    expect(laid).toBeGreaterThan(2)

    // Find a square of the second colour that the first can reach.
    on = touch(on, first[0])
    for (let i = 1; i < first.length; i++) {
      const was = on.trails[1].length
      on = drag(on, first[i])
      if (on.trails[1].length < was) {
        expect(on.events).toContain('cut')
        return
      }
    }
  })

  it('will not draw onto another colour\'s dot', () => {
    const fresh = run()
    const board = fresh.board
    if (board.kind !== 'flow') throw new Error('wrong kind')
    const mine = board.flow.ends[0][0]
    const theirs = board.flow.ends.slice(1).flat()
    let on = touch(fresh, mine)
    // Walk the first colour's answer until it is next to one of theirs.
    for (const cell of board.flow.answer[0].slice(1)) {
      on = drag(on, cell)
      const near = theirs.find((t) => {
        const ax = cell % board.flow.across
        const bx = t % board.flow.across
        const ay = Math.floor(cell / board.flow.across)
        const by = Math.floor(t / board.flow.across)
        return Math.abs(ax - bx) + Math.abs(ay - by) === 1
      })
      if (near === undefined) continue
      const before = on.trails[0].length
      on = drag(on, near)
      expect(on.trails[0].length, "drew onto another colour's dot").toBe(before)
      return
    }
  })
})

describe('the notebook', () => {
  it('turns the page to a different kind of puzzle each time', () => {
    let run = newRun(1, 1)
    const kinds: string[] = [run.board.kind]
    for (let i = 0; i < 5; i++) {
      run = nextPuzzle(run)
      kinds.push(run.board.kind)
    }
    expect(kinds).toEqual(['stroke', 'maze', 'flow', 'stroke', 'maze', 'flow'])
  })

  it('gives the same puzzle back when it is started again', () => {
    const fresh = newRun(5, 3)
    let on = touch(fresh, 0)
    on = wipe(on)
    expect(on.board).toEqual(fresh.board)
    expect(on.trails).toEqual(fresh.trails)
  })

  it('fills the answer in when it is asked to, and does not call it solved work', () => {
    for (const kind of KINDS) {
      const shown = showMe(newRun(levelOf(kind, 1), 9))
      expect(isDone(shown), kind).toBe(true)
      expect(shown.shown, kind).toBe(true)
      expect(howFar(shown), kind).toBeCloseTo(1)
    }
  })

  it('grows, and then stops growing', () => {
    // A maze that takes four minutes to trace is not harder than one that
    // takes one, and the finger holding the line down is what gets tired.
    for (const kind of KINDS) {
      const early = sizeFor(kind, levelOf(kind, 0))
      const late = sizeFor(kind, levelOf(kind, 8))
      const later = sizeFor(kind, levelOf(kind, 40))
      expect(late.across + late.down + late.want, kind)
        .toBeGreaterThan(early.across + early.down + early.want)
      expect(later, `${kind} grows for ever`).toEqual(late)
    }
  })

  it('only ever asks for an even-sided board to join dots on', () => {
    // The loop a board is cut out of is traced round a tree on a grid of half
    // the size, and half of seven is not a grid.
    for (let level = 1; level < 200; level++) {
      if (kindFor(level) !== 'flow') continue
      const size = sizeFor('flow', level)
      expect(size.across % 2, `level ${level}`).toBe(0)
      expect(size.down % 2, `level ${level}`).toBe(0)
    }
  })
})
