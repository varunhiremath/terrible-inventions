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

const BOUNDS = [500, 900, 1400, 2000] as const

/** Rough upper bound on the numbers in play, per tier. */
const CEILINGS = [40, 90, 150, 400] as const

type Op = '+' | '-' | 'x' | '/'

interface Step {
  left: number
  op: Op
  right: number
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

    const lines = steps.map((s, i) => `Step ${i + 1}:  ${s.left} ${s.op} ${s.right} = ${s.shown}`)

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
        `Look hard at the step that uses ${bad.op === 'x' ? 'multiplying' : bad.op === '/' ? 'dividing' : bad.op === '+' ? 'adding' : 'subtracting'}.`,
      ],
      explain: `Step ${badIndex + 1} should be ${bad.left} ${bad.op} ${bad.right} = ${bad.correct}, not ${bad.shown}. Every later line is done correctly, which is exactly what makes the mistake hard to spot — the working stays tidy all the way to a wrong answer.`,
      data: { lines, badIndex },
    }
  },
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
