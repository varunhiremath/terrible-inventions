import { makeRng } from '../engine/rng'
import type { Generator, Problem } from '../engine/types'
import { tier } from './util'
import { MACHINE_NAMES } from './names'

/**
 * Some of {papa}'s machines report honestly. Some lie about everything.
 *
 * Pure deduction with no arithmetic at all, which makes it the cleanest test of
 * reasoning in the set — and a useful counterweight to the idea that being good
 * at maths means being fast at sums. Every puzzle is brute-force verified to
 * have exactly one consistent solution before it is served.
 */

const BOUNDS = [600, 1000, 1500, 2000] as const


type Stmt =
  | { kind: 'selfTruthful' }
  | { kind: 'otherLies'; target: number }
  | { kind: 'otherTruthful'; target: number }
  | { kind: 'same'; target: number }
  | { kind: 'different'; target: number }
  | { kind: 'atLeastOneLies' }
  | { kind: 'allTruthful' }

export const knightsKnaves: Generator = {
  id: 'knights-knaves',
  name: 'Faulty Wiring',
  blurb: 'Some machines report honestly. Some never do.',
  minRating: 600,
  maxRating: 3000,

  generate(rating: number, seed: number): Problem {
    const t = tier(rating, BOUNDS)
    const count = [2, 3, 3, 4][t]
    const allowHard = t >= 2

    // Retry until the generated statements admit exactly one consistent world.
    let puzzle = tryBuild(count, allowHard, seed)
    for (let attempt = 1; puzzle === null && attempt < 200; attempt++) {
      puzzle = tryBuild(count, allowHard, seed + attempt * 7919)
    }
    puzzle ??= fallback(count)

    const { names, statements, truth } = puzzle
    const truthful = names.filter((_, i) => truth[i])

    return {
      id: `knights-knaves:${seed}`,
      kind: 'knights-knaves',
      rating,
      seed,
      prompt: `{papa} built these machines. Each one either always reports truthfully or always lies — never both. Tap every machine that is telling the truth.`,
      answer: { type: 'set', values: truthful },
      hints: [
        'Pick a machine. Assume it is truthful, follow what that forces, and see whether anything contradicts.',
        'If assuming it is truthful leads to a contradiction, it must be lying — and that is real information.',
        'A machine saying "I tell the truth" tells you nothing at all. Both kinds would say it.',
      ],
      explain:
        truthful.length === 0
          ? `Every one of them is lying. Check it: take any claim, assume the speaker is truthful, and the claims contradict each other.`
          : `Only ${truthful.join(' and ')} ${truthful.length === 1 ? 'is' : 'are'} truthful. There is exactly one way to label them all that makes every statement consistent with who said it.`,
      data: {
        names,
        lines: statements.map((s, i) => ({ name: names[i], text: render(s, names) })),
      },
    }
  },
}

interface Puzzle {
  names: string[]
  statements: Stmt[]
  truth: boolean[]
}

function tryBuild(count: number, allowHard: boolean, seed: number): Puzzle | null {
  const rng = makeRng(seed)
  const names = rng.shuffle(MACHINE_NAMES).slice(0, count)
  const truth = Array.from({ length: count }, () => rng.next() < 0.5)

  const statements: Stmt[] = []
  for (let i = 0; i < count; i++) {
    // Only statements whose truth value matches the speaker's nature can be said.
    const usable = candidates(i, count, allowHard).filter(
      (s) => truthOf(s, i, truth) === truth[i],
    )
    if (usable.length === 0) return null
    statements.push(rng.pick(usable))
  }

  return solutions(statements, count).length === 1 ? { names, statements, truth } : null
}

function candidates(speaker: number, count: number, allowHard: boolean): Stmt[] {
  const out: Stmt[] = [{ kind: 'selfTruthful' }]

  for (let j = 0; j < count; j++) {
    if (j === speaker) continue
    out.push({ kind: 'otherLies', target: j }, { kind: 'otherTruthful', target: j })
    if (allowHard) out.push({ kind: 'same', target: j }, { kind: 'different', target: j })
  }

  if (allowHard) out.push({ kind: 'atLeastOneLies' }, { kind: 'allTruthful' })
  return out
}

/**
 * Whether a statement is true in a given world. The speaker matters for the
 * self-referential and relative forms, so every caller goes through here.
 */
function truthOf(stmt: Stmt, speaker: number, truth: readonly boolean[]): boolean {
  switch (stmt.kind) {
    case 'selfTruthful':
      // "I tell the truth" is consistent for both kinds, so it is always
      // sayable and never informative on its own. That is the trap.
      return truth[speaker]
    case 'otherLies':
      return !truth[stmt.target]
    case 'otherTruthful':
      return truth[stmt.target]
    case 'same':
      return truth[speaker] === truth[stmt.target]
    case 'different':
      return truth[speaker] !== truth[stmt.target]
    case 'atLeastOneLies':
      return truth.some((t) => !t)
    case 'allTruthful':
      return truth.every((t) => t)
  }
}

/** Brute force over every labelling. Used to guarantee the answer is unique. */
function solutions(statements: readonly Stmt[], count: number): boolean[][] {
  const found: boolean[][] = []

  for (let mask = 0; mask < 1 << count; mask++) {
    const truth = Array.from({ length: count }, (_, i) => (mask & (1 << i)) !== 0)
    const consistent = statements.every((s, i) => truthOf(s, i, truth) === truth[i])
    if (consistent) found.push(truth)
  }

  return found
}

function render(stmt: Stmt, names: readonly string[]): string {
  switch (stmt.kind) {
    case 'selfTruthful':
      return 'I always tell the truth.'
    case 'otherLies':
      return `${names[stmt.target]} is lying to you.`
    case 'otherTruthful':
      return `${names[stmt.target]} always tells the truth.`
    case 'same':
      return `${names[stmt.target]} and I are the same kind.`
    case 'different':
      return `${names[stmt.target]} and I are not the same kind.`
    case 'atLeastOneLies':
      return 'At least one of us is lying.'
    case 'allTruthful':
      return 'Every one of us tells the truth.'
  }
}

/** A hand-checked puzzle, in case generation somehow exhausts its retries. */
function fallback(count: number): Puzzle {
  const names = MACHINE_NAMES.slice(0, count) as unknown as string[]
  const statements: Stmt[] = [{ kind: 'otherLies', target: 1 }, { kind: 'selfTruthful' }]
  for (let i = 2; i < count; i++) statements.push({ kind: 'otherTruthful', target: 0 })
  const truth = [true, false, ...Array.from({ length: Math.max(0, count - 2) }, () => true)]
  return { names, statements, truth }
}

export const __test = { solutions, truthOf }
