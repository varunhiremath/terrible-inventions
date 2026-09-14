export type GeneratorId =
  | 'rectangle-hunt'
  | 'fraction-duel'
  | 'path-count'
  | 'papas-mistake'
  | 'knights-knaves'

/** How an answer is collected and checked. */
export type Answer =
  | { type: 'number'; value: number }
  | { type: 'choice'; options: string[]; correctIndex: number }
  | { type: 'set'; values: string[] }

export interface Problem {
  /** Stable within a session; `${kind}:${seed}`. */
  id: string
  kind: GeneratorId
  /** Elo-scale difficulty this instance was actually built at. */
  rating: number
  seed: number
  /** Supports `{kid}` / `{papa}` placeholders — render through `fill()`. */
  prompt: string
  answer: Answer
  /** Revealed one at a time, on request, free of charge, forever. */
  hints: string[]
  /** Shown after every attempt, right or wrong. The point is the idea, not the verdict. */
  explain: string
  /** Generator-specific payload for custom rendering (grids, shapes, ...). */
  data?: unknown
}

export interface Generator {
  id: GeneratorId
  name: string
  /** One line, shown on the Lab tile. */
  blurb: string
  /** Below this the generator has nothing sensible to produce. */
  minRating: number
  /**
   * Above this the generator is out of road and selection will skip it. This is
   * what keeps the ceiling honest: a generator that cannot get harder bows out
   * rather than serving the same problem forever.
   */
  maxRating: number
  generate(rating: number, seed: number): Problem
}

export interface Attempt {
  problemId: string
  kind: GeneratorId
  problemRating: number
  ratingBefore: number
  ratingAfter: number
  correct: boolean
  /** Hints opened before answering. Never penalised — recorded to spot rough patches. */
  hintsUsed: number
  elapsedMs: number
  stretch: boolean
  at: number
}
