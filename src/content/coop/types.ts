export type CoopGeneratorId = 'split-clues'

/**
 * A clue about the machines.
 *
 * Every form is renderable as a sentence and evaluable against a candidate
 * assignment, because the generator has to check its own work: a puzzle is only
 * served once the solver has proved it has exactly one answer.
 */
export type Clue =
  /** "Bolt is red." */
  | { kind: 'is'; subject: number; cat: number; value: number }
  /** "Bolt is not in the kitchen." */
  | { kind: 'isNot'; subject: number; cat: number; value: number }
  /** "The one in the kitchen is red." */
  | { kind: 'link'; catA: number; valA: number; catB: number; valB: number }
  /** "The red one is not leaking." */
  | { kind: 'notLink'; catA: number; valA: number; catB: number; valB: number }

export interface Category {
  name: string
  values: string[]
  /** Reads after a name: "Bolt is <red / in the kitchen / leaking>." */
  pred: (value: string) => string
  /** Reads as a noun phrase: "<the red one / the one in the kitchen> is ...". */
  ref: (value: string) => string
}

/**
 * `assignment[category][subject]` is the index of that subject's value in that
 * category. Each category's row is a permutation, so no two machines share a
 * value — that is what makes the grid solvable by elimination.
 */
export type Assignment = number[][]

export interface CoopProblem {
  id: string
  kind: CoopGeneratorId
  rating: number
  seed: number
  /** Shown to both players, all the time. */
  brief: string
  subjects: string[]
  categories: Category[]
  /** Held by the child. */
  cluesA: Clue[]
  /** Held by the grown-up. */
  cluesB: Clue[]
  solution: Assignment
  /** Deliberately about *how to work together*, not about the answer. */
  hints: string[]
  explain: string
}

export interface CoopGenerator {
  id: CoopGeneratorId
  name: string
  blurb: string
  minRating: number
  maxRating: number
  generate(rating: number, seed: number): CoopProblem
}
