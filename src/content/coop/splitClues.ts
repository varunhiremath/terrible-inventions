import { makeRng } from '../../engine/rng'
import { MACHINE_NAMES } from '../names'
import { tier } from '../util'
import { countSolutions } from './solver'
import type { Assignment, Category, Clue, CoopGenerator, CoopProblem } from './types'

/**
 * A logic grid, with the clues dealt out between two people.
 *
 * The mode only works if neither half is solvable alone, and that is not left
 * to chance: the clue set is pruned until it is *minimal*, meaning removing any
 * single clue destroys the unique answer. Every proper subset of a minimal set
 * is therefore ambiguous, so however the clues are dealt, both hands are needed.
 *
 * The point is not the deduction. It is that the only channel between the two
 * halves is one of them saying out loud what they are holding — and explaining
 * your reasoning to somebody else is one of the strongest things there is for
 * understanding it yourself.
 */

const BOUNDS = [600, 1000, 1400, 1800, 2200] as const

const COLOUR: Category = {
  name: 'Colour',
  values: ['red', 'blue', 'green', 'yellow', 'orange'],
  pred: (v) => v,
  ref: (v) => `the ${v} one`,
}

const ROOM: Category = {
  name: 'Room',
  values: ['kitchen', 'garage', 'attic', 'shed', 'hallway'],
  pred: (v) => `in the ${v}`,
  ref: (v) => `the one in the ${v}`,
}

const FAULT: Category = {
  name: 'Fault',
  values: ['smoking', 'beeping', 'leaking', 'rattling', 'sparking'],
  pred: (v) => v,
  ref: (v) => `the ${v} one`,
}

const ALL_CATEGORIES = [COLOUR, ROOM, FAULT]

/** Subjects, categories, and how much each clue form is favoured, per tier. */
const SHAPES = [
  { subjects: 3, categories: 2, bias: { is: 0, link: 0.3, isNot: 0.6, notLink: 0.9 } },
  { subjects: 4, categories: 2, bias: { is: 0, link: 0.2, isNot: 0.4, notLink: 0.7 } },
  { subjects: 4, categories: 2, bias: { is: 0.8, link: 0.2, isNot: 0.1, notLink: 0 } },
  { subjects: 4, categories: 3, bias: { is: 0.6, link: 0.1, isNot: 0.2, notLink: 0 } },
  { subjects: 5, categories: 2, bias: { is: 0.9, link: 0.2, isNot: 0.1, notLink: 0 } },
] as const

export const splitClues: CoopGenerator = {
  id: 'split-clues',
  name: 'Split Clues',
  blurb: 'Half the clues each. Neither half is enough.',
  minRating: 600,
  // Beyond five machines the solver's search space stops being instant, and a
  // puzzle that takes a second to generate is not worth the extra machine.
  maxRating: 2600,

  generate(rating: number, seed: number): CoopProblem {
    // Prefer a puzzle containing at least one clue that names a machine
    // outright. A grid of nothing but "is not" clues is solvable but has no
    // foothold — there is nowhere to put the first mark, and the pair stall
    // before they have started talking.
    //
    // The anchor cannot simply be added afterwards: that would break the
    // minimality the fair split depends on. So instead, generate until one
    // turns up naturally, and keep the first anchorless puzzle as a fallback
    // rather than failing.
    let fallback: CoopProblem | null = null

    for (let attempt = 0; attempt < 60; attempt++) {
      const built = tryBuild(rating, seed + attempt * 7717)
      if (built === null) continue
      if (hasAnchor(built)) return built
      fallback ??= built
    }

    return fallback ?? tryBuild(600, 1) ?? fail()
  },
}

/** Does either hand contain a clue that names a machine directly? */
function hasAnchor(problem: CoopProblem): boolean {
  return [...problem.cluesA, ...problem.cluesB].some((c) => c.kind === 'is')
}

function fail(): never {
  throw new Error('split-clues: could not build a puzzle')
}

function tryBuild(rating: number, seed: number): CoopProblem | null {
  const rng = makeRng(seed)
  const shape = SHAPES[tier(rating, BOUNDS)]
  const { subjects: n, categories: m, bias } = shape

  const subjects = rng.shuffle(MACHINE_NAMES).slice(0, n)
  const categories = rng.shuffle(ALL_CATEGORIES).slice(0, m)

  // Each category is a permutation, so no two machines share a value.
  const solution: Assignment = categories.map(() =>
    rng.shuffle(Array.from({ length: n }, (_, i) => i)),
  )

  const pool = truePool(n, m, solution)

  // Ordering the pool decides the puzzle's character: favouring "X is red"
  // makes an easy chain, favouring "the red one is not leaking" forces real
  // elimination.
  const ordered = pool
    .map((clue) => ({ clue, key: rng.next() + bias[clue.kind] }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.clue)

  // Offer one direct clue first. If it turns out to be redundant, pruning drops
  // it like any other, so this biases the outcome without weakening it.
  const anchors = ordered.filter((c) => c.kind === 'is')
  if (anchors.length > 0) {
    const anchor = rng.pick(anchors)
    ordered.splice(ordered.indexOf(anchor), 1)
    ordered.unshift(anchor)
  }

  const chosen: Clue[] = []
  for (const clue of ordered) {
    chosen.push(clue)
    if (countSolutions(n, m, chosen, 2) === 1) break
  }
  if (countSolutions(n, m, chosen, 2) !== 1) return null

  const minimal = pruneToMinimal(n, m, chosen)
  if (minimal.length < 2) return null

  // Any split of a minimal set leaves both halves ambiguous, so dealing them
  // alternately after a shuffle is enough — no search required.
  const dealt = rng.shuffle(minimal)
  const cluesA = dealt.filter((_, i) => i % 2 === 0)
  const cluesB = dealt.filter((_, i) => i % 2 === 1)

  // Stated in the explanation, because it is the most convincing possible
  // answer to "could I have just done this myself?"
  const aloneA = countSolutions(n, m, cluesA, 50)
  const aloneB = countSolutions(n, m, cluesB, 50)

  return {
    id: `split-clues:${seed}`,
    kind: 'split-clues',
    rating,
    seed,
    brief: `${n} of {papa}'s machines broke at once. Work out which is which — but you have been given different clues, so you will have to talk.`,
    subjects,
    categories,
    cluesA,
    cluesB,
    solution,
    hints: [
      'Read your clues out loud to each other, exactly as written. Summarising is where things go wrong.',
      'Start with anything that names a machine directly, then use the "not" clues to cross possibilities off.',
      'Stuck? One of you is holding a clue you have not used yet. Work out which one.',
    ],
    explain: `With only {kid}'s clues there ${aloneA === 1 ? 'is 1 possible answer' : `are ${aloneA >= 50 ? '50 or more' : aloneA} possible answers`}, and with only {papa}'s there ${aloneB === 1 ? 'is 1' : `are ${aloneB >= 50 ? '50 or more' : aloneB}`}. Together there is exactly one. Neither of you could have got there alone.`,
  }
}

/** Every clue that is true of this solution. The generator only ever tells the truth. */
function truePool(n: number, m: number, solution: Assignment): Clue[] {
  const pool: Clue[] = []

  for (let cat = 0; cat < m; cat++) {
    for (let subject = 0; subject < n; subject++) {
      const value = solution[cat][subject]
      pool.push({ kind: 'is', subject, cat, value })
      for (let other = 0; other < n; other++) {
        if (other !== value) pool.push({ kind: 'isNot', subject, cat, value: other })
      }
    }
  }

  for (let catA = 0; catA < m; catA++) {
    for (let catB = 0; catB < m; catB++) {
      if (catA === catB) continue
      for (let subject = 0; subject < n; subject++) {
        const valA = solution[catA][subject]
        const valB = solution[catB][subject]
        pool.push({ kind: 'link', catA, valA, catB, valB })
        for (let other = 0; other < n; other++) {
          if (other !== valB) pool.push({ kind: 'notLink', catA, valA, catB, valB: other })
        }
      }
    }
  }

  return pool
}

/**
 * Drops clues until none can be dropped. Run to a fixpoint rather than in one
 * pass: removing a late clue can make an earlier one redundant too, and a set
 * that is only *nearly* minimal would let one half solve the puzzle alone.
 */
function pruneToMinimal(n: number, m: number, clues: readonly Clue[]): Clue[] {
  let current = clues.slice()
  let changed = true

  while (changed) {
    changed = false
    for (let i = current.length - 1; i >= 0; i--) {
      const without = current.filter((_, j) => j !== i)
      if (countSolutions(n, m, without, 2) === 1) {
        current = without
        changed = true
      }
    }
  }

  return current
}

export function renderClue(clue: Clue, subjects: readonly string[], categories: readonly Category[]): string {
  switch (clue.kind) {
    case 'is':
      return `${subjects[clue.subject]} is ${categories[clue.cat].pred(categories[clue.cat].values[clue.value])}.`
    case 'isNot':
      return `${subjects[clue.subject]} is not ${categories[clue.cat].pred(categories[clue.cat].values[clue.value])}.`
    case 'link': {
      const ref = categories[clue.catA].ref(categories[clue.catA].values[clue.valA])
      return `${capitalise(ref)} is ${categories[clue.catB].pred(categories[clue.catB].values[clue.valB])}.`
    }
    case 'notLink': {
      const ref = categories[clue.catA].ref(categories[clue.catA].values[clue.valA])
      return `${capitalise(ref)} is not ${categories[clue.catB].pred(categories[clue.catB].values[clue.valB])}.`
    }
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
