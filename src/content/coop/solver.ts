import type { Assignment, Clue } from './types'

/**
 * Counts how many assignments satisfy a set of clues, stopping early once
 * `limit` have been found.
 *
 * Counting rather than solving is the point. The generator needs three
 * different answers from this:
 *
 *   - exactly 1 for the full clue set, or the puzzle is unfair
 *   - more than 1 for each half alone, or one player could solve it without
 *     the other and the co-op mode is pointless
 *   - more than 1 when any single clue is removed, which is what makes the
 *     clue set minimal
 *
 * That last one is the load-bearing check: in a minimal set, every proper
 * subset is ambiguous, so *any* way of splitting the clues between two people
 * is guaranteed to need both halves. The split does not have to be searched
 * for — minimality already proved it.
 */
export function countSolutions(
  subjectCount: number,
  categoryCount: number,
  clues: readonly Clue[],
  limit = 2,
): number {
  const perms = permutations(subjectCount)

  // Single-category clues constrain one row each, so filtering per category
  // first collapses the search space before the expensive part begins.
  const byCategory: number[][][] = []
  for (let cat = 0; cat < categoryCount; cat++) {
    const local = clues.filter(
      (c): c is Extract<Clue, { kind: 'is' | 'isNot' }> =>
        (c.kind === 'is' || c.kind === 'isNot') && c.cat === cat,
    )
    byCategory.push(
      perms.filter((row) =>
        local.every((c) => (c.kind === 'is' ? row[c.subject] === c.value : row[c.subject] !== c.value)),
      ),
    )
    // A category with nothing left cannot be completed, so neither can anything.
    if (byCategory[cat].length === 0) return 0
  }

  const links = clues.filter(
    (c): c is Extract<Clue, { kind: 'link' | 'notLink' }> =>
      c.kind === 'link' || c.kind === 'notLink',
  )

  let found = 0
  const current: Assignment = []

  const walk = (cat: number): void => {
    if (found >= limit) return

    if (cat === categoryCount) {
      if (links.every((c) => satisfiesLink(c, current))) found++
      return
    }

    for (const row of byCategory[cat]) {
      current[cat] = row
      // Check every link whose two categories are both placed, as soon as they
      // are, rather than waiting for a complete assignment.
      const ready = links.filter((c) => c.catA <= cat && c.catB <= cat)
      if (ready.every((c) => satisfiesLink(c, current))) walk(cat + 1)
      if (found >= limit) return
    }
  }

  walk(0)
  return found
}

export function satisfies(clue: Clue, assignment: Assignment): boolean {
  switch (clue.kind) {
    case 'is':
      return assignment[clue.cat][clue.subject] === clue.value
    case 'isNot':
      return assignment[clue.cat][clue.subject] !== clue.value
    default:
      return satisfiesLink(clue, assignment)
  }
}

function satisfiesLink(
  clue: Extract<Clue, { kind: 'link' | 'notLink' }>,
  assignment: Assignment,
): boolean {
  const subject = assignment[clue.catA].indexOf(clue.valA)
  // The referenced machine is not placed yet, so nothing is violated.
  if (subject === -1) return true

  const matches = assignment[clue.catB][subject] === clue.valB
  return clue.kind === 'link' ? matches : !matches
}

const permCache = new Map<number, number[][]>()

export function permutations(n: number): number[][] {
  const cached = permCache.get(n)
  if (cached) return cached

  const out: number[][] = []
  const current: number[] = []
  const used = new Array<boolean>(n).fill(false)

  const walk = (): void => {
    if (current.length === n) {
      out.push(current.slice())
      return
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue
      used[i] = true
      current.push(i)
      walk()
      current.pop()
      used[i] = false
    }
  }

  walk()
  permCache.set(n, out)
  return out
}
