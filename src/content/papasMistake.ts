import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { tier } from './util'

/**
 * {papa} shows his working. One line of it is wrong.
 *
 * Finding someone else's error is harder than producing your own answer: you
 * cannot recognise a broken step without knowing what the correct one looks
 * like. It is also endlessly scalable, because difficulty lives in how *subtle*
 * the error is rather than how big the numbers are.
 *
 * Everything after the bad line is arithmetically correct — {papa} carries his
 * mistake forward faithfully, exactly as a real person does — so the question is
 * always "where does it FIRST go wrong", not "which line looks odd".
 */

/*
 * Re-pitched for a child two years further on. The bounds are compressed and
 * the numbers at each rung are two or three times what they were: the old
 * bottom rung was three steps on numbers under forty, which is where this
 * belonged when it was written and is now a rung spent proving nothing.
 */
const BOUNDS = [500, 750, 1100, 1600] as const

/** Rough upper bound on the numbers in play, per tier. */
const CEILINGS = [60, 150, 400, 1200] as const

type Op = '+' | '-' | 'x' | '/'

interface Step {
  left: number
  op: Op
  right: number
  /**
   * A second operation on the same line, for the lines that have one.
   *
   * This is where the order of operations lives. `12 + 4 x 5` is 32, and a
   * person working left to right gets 80 — which is the single most common
   * wrong line in a grade five book and could not be written down at all
   * while every line here had one operation on it. Nothing announces that
   * the rule is in play; it is simply one of the ways a line can be wrong,
   * sitting among the dropped carries and the transposed digits.
   */
  then?: { op: Op; right: number }
  shown: number
  correct: number
}

export const papasMistake: Generator = {
  id: 'papas-mistake',
  name: "{papa}'s Mistake",
  blurb: 'He showed his working. It is wrong somewhere.',
  minRating: 500,
  maxRating: 2800,

  generate(rating: number, seed: number): Problem {
    const rng = makeRng(seed)
    const t = tier(rating, BOUNDS)
    const stepCount = [3, 4, 4, 5][t] + (t >= 2 && rng.next() < 0.4 ? 1 : 0)

    const steps = buildChain(stepCount, t, rng)

    /*
     * One line in three carries a second operation, from the middle rung up.
     * Only one of them, and never the last: a line with two operations is
     * harder to check than a line with one, and a page made entirely of them
     * stops being about finding the error and starts being about stamina.
     */
    if (t >= 1 && rng.next() < 0.6) {
      /*
       * Tried a few times over. A second operation cannot be hung on every
       * line — a divide needs the number before it to have a factor, and a
       * pair that reads the same either way is thrown away — so one attempt
       * lands about half the time, and a line with two things on it would
       * turn up once in four problems instead of once in two.
       */
      const where = rng.int(0, steps.length - 2)
      for (let go = 0; go < 8 && !steps[where].then; go++) {
        lengthen(steps[where], CEILINGS[t], rng)
      }
      for (let i = where + 1; i < steps.length; i++) {
        steps[i] = nextStep(steps[i - 1].correct, CEILINGS[t], rng)
      }
    }

    const badIndex = rng.int(t === 0 ? 0 : 1, steps.length - 1)
    const bad = steps[badIndex]
    bad.shown = corrupt(bad.correct, bad, t, rng)

    // Everything downstream carries the wrong number forward, and is itself
    // worked out correctly. The operand has to be re-picked rather than reused:
    // a divisor chosen for the original value may not divide the corrupted one,
    // and {papa} is careless, not incapable of division.
    for (let i = badIndex + 1; i < steps.length; i++) {
      steps[i] = nextStep(steps[i - 1].shown, CEILINGS[t], rng)
    }

    const lines = steps.map((s, i) => `Step ${i + 1}:  ${written(s)} = ${s.shown}`)

    return {
      id: `papas-mistake:${seed}`,
      kind: 'papas-mistake',
      rating,
      seed,
      prompt: `{papa} worked this out and got ${steps[steps.length - 1].shown}. Which step goes wrong FIRST?`,
      answer: {
        type: 'choice',
        options: steps.map((_, i) => `Step ${i + 1}`),
        correctIndex: badIndex,
      },
      hints: [
        'Check each line on its own. Ignore whether the final answer looks right.',
        'Every line after the broken one is worked out correctly — from a wrong starting number.',
        bad.then
          ? 'One of these lines has two things to do on it. Which one did he do first?'
          : `Look hard at the step that uses ${bad.op === 'x' ? 'multiplying' : bad.op === '/' ? 'dividing' : bad.op === '+' ? 'adding' : 'subtracting'}.`,
      ],
      explain:
        `Step ${badIndex + 1} should be ${written(bad)} = ${bad.correct}, not ` +
        `${bad.shown}.` +
        (bad.then && leftToRight(bad) === bad.shown
          ? ` He worked it straight across the page: ${bad.left} ${bad.op} ` +
            `${bad.right} first and then ${bad.then.op} ${bad.then.right}. ` +
            `Multiplying and dividing happen before adding and subtracting, ` +
            `wherever on the line they are written.`
          : ' Every later line is done correctly, which is exactly what makes ' +
            'the mistake hard to spot — the working stays tidy all the way to ' +
            'a wrong answer.'),
      data: { lines, badIndex },
    }
  },
}

/** A step written out, with its second operation if it has one. */
function written(s: Step): string {
  const first = `${s.left} ${s.op} ${s.right}`
  return s.then ? `${first} ${s.then.op} ${s.then.right}` : first
}

/** What a line comes to when it is worked properly. */
function valueOf(s: Step): number {
  if (!s.then) return apply(s.left, s.op, s.right)
  const { op, right } = s.then
  // Times and divide bind tighter, wherever on the line they are written.
  const firstBinds = s.op === 'x' || s.op === '/'
  const secondBinds = op === 'x' || op === '/'
  if (secondBinds && !firstBinds) {
    return apply(s.left, s.op, apply(s.right, op, right))
  }
  return apply(apply(s.left, s.op, s.right), op, right)
}

/** And what it comes to worked straight across the page, which is the trap. */
const leftToRight = (s: Step): number =>
  s.then ? apply(apply(s.left, s.op, s.right), s.then.op, s.then.right) : valueOf(s)

/**
 * Hangs a second operation on a line.
 *
 * Only ever one that makes the order of operations matter — so a times or a
 * divide after a plus or a minus, which is the case where working across the
 * page gives a different answer. Two pluses in a row would be a longer line
 * and not a harder one, and a line whose two readings agree teaches nothing
 * about which reading is right.
 */
function lengthen(s: Step, ceiling: number, rng: ReturnType<typeof makeRng>): void {
  /*
   * Built as a candidate and only written back if it is worth having. The
   * first go at this edited the step in place and then bailed out halfway
   * when the divisor did not divide, which left a line reading "5 - 2" with
   * fifteen still written after the equals sign — a step that was wrong
   * without being the wrong one, and a test that could not say which.
   */
  const first: Op = s.op === 'x' || s.op === '/'
    ? (rng.next() < 0.5 ? '+' : '-')
    : s.op
  const firstRight = first === s.op
    ? s.right
    : first === '-'
      ? rng.int(1, Math.max(1, s.left - 2))
      : rng.int(2, Math.max(3, Math.floor(ceiling / 4)))

  const op: Op = rng.next() < 0.7 ? 'x' : '/'
  const factors = smallFactors(firstRight)
  if (op === '/' && factors.length === 0) return
  const right = op === 'x'
    ? rng.int(2, Math.max(2, Math.min(9, Math.floor(ceiling / Math.max(1, firstRight)))))
    : rng.pick(factors)
  if (right < 2) return

  const made: Step = {
    left: s.left, op: first, right: firstRight,
    then: { op, right }, shown: 0, correct: 0,
  }
  made.correct = valueOf(made)
  made.shown = made.correct

  // A line that reads the same both ways is a longer line and not a harder
  // one, and a line that comes out negative or fractional is neither.
  if (leftToRight(made) === made.correct) return
  if (made.correct <= 0 || !Number.isInteger(made.correct)) return

  s.op = made.op
  s.right = made.right
  s.then = made.then
  s.correct = made.correct
  s.shown = made.shown
}

function buildChain(count: number, t: number, rng: ReturnType<typeof makeRng>): Step[] {
  let value = rng.int(3, 12)
  const steps: Step[] = []

  for (let i = 0; i < count; i++) {
    const step = nextStep(value, CEILINGS[t], rng)
    steps.push(step)
    value = step.correct
  }

  return steps
}

/** One correctly worked step starting from `left`, guaranteed whole and positive. */
function nextStep(left: number, ceiling: number, rng: ReturnType<typeof makeRng>): Step {
  const op = chooseOp(left, ceiling, rng)
  const right = chooseRight(left, op, ceiling, rng)
  const correct = apply(left, op, right)
  return { left, op, right, shown: correct, correct }
}

function chooseOp(value: number, ceiling: number, rng: ReturnType<typeof makeRng>): Op {
  // Addition always works. The rest have to earn their place, so that every
  // line stays a whole positive number no matter what came before it.
  const pool: Op[] = ['+']
  if (value >= 4) pool.push('-')
  if (value * 2 <= ceiling) pool.push('x')
  if (value > 6 && hasSmallFactor(value)) pool.push('/')
  return rng.pick(pool)
}

function chooseRight(
  value: number,
  op: Op,
  ceiling: number,
  rng: ReturnType<typeof makeRng>,
): number {
  switch (op) {
    case 'x':
      return rng.int(2, Math.max(2, Math.min(9, Math.floor(ceiling / Math.max(1, value)))))
    case '/': {
      const factors = smallFactors(value)
      return rng.pick(factors)
    }
    case '-':
      return rng.int(1, Math.max(1, value - 2))
    default:
      return rng.int(2, Math.max(3, Math.floor(ceiling / 3)))
  }
}

function apply(a: number, op: Op, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case 'x':
      return a * b
    case '/':
      return a / b
  }
}

function hasSmallFactor(n: number): boolean {
  return smallFactors(n).length > 0
}

function smallFactors(n: number): number[] {
  const out: number[] = []
  for (let d = 2; d <= 9; d++) if (n % d === 0 && n / d >= 2) out.push(d)
  return out
}

/**
 * The kinds of wrong that a person is actually capable of. Higher tiers use
 * errors that leave the line looking entirely reasonable.
 */
function corrupt(
  correct: number,
  step: Step,
  t: number,
  rng: ReturnType<typeof makeRng>,
): number {
  const candidates: number[] = []

  if (t === 0) {
    candidates.push(correct + rng.int(9, 25), Math.max(1, correct - rng.int(9, 25)))
  }

  /*
   * The order-of-operations slip, which only exists on a line that has two
   * operations on it — and which is put first and weighted heavily, because
   * it is the whole reason those lines are here.
   */
  if (step.then) {
    const across = leftToRight(step)
    if (across > 0 && across !== correct && Number.isInteger(across)) {
      candidates.push(across, across, across)
    }
  }

  if (t >= 1) {
    candidates.push(correct + 1, correct - 1)
    // The answer to a different, plausible operation.
    for (const alt of ['+', '-', 'x'] as Op[]) {
      if (alt === step.op) continue
      const v = apply(step.left, alt, step.right)
      if (v > 0 && v !== correct) candidates.push(v)
    }
  }

  if (t >= 2) {
    const swapped = transpose(correct)
    if (swapped !== correct) candidates.push(swapped)
    // Dropped carry: the tens digit never got added.
    if (correct >= 10) candidates.push(correct - 10)
  }

  if (t >= 3) {
    // An off-by-one in the times table, which reads as entirely plausible working.
    if (step.op === 'x') {
      candidates.push(step.left * (step.right - 1), step.left * (step.right + 1))
    }
  }

  const valid = candidates.filter((c) => c > 0 && c !== correct && Number.isInteger(c))
  return valid.length > 0 ? rng.pick(valid) : correct + 1
}

function transpose(n: number): number {
  const s = String(n)
  if (s.length < 2) return n
  return Number(s[1] + s[0] + s.slice(2))
}
