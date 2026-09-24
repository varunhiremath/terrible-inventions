/**
 * What a question is.
 *
 * One shape for every topic, which is what makes the rest of this easy: the
 * picker does not care whether it is handing back a prime number or a capital
 * city, and the screen that shows it only has to lay out one thing well
 * instead of four things adequately.
 *
 * Multiple choice throughout. An answer to a sum is a number and a number pad
 * is the right way in for that — the generated maths still uses one — but an
 * answer about the Abbasids is not a number, and asking a nine-year-old to
 * spell Samarkand on a phone keyboard with a game paused behind him is how you
 * turn a good question into a chore.
 */

export type Topic = 'maths' | 'history' | 'geography' | 'trivia'

export interface Ask {
  /** Unique across every topic, so one list of recent questions covers them all. */
  id: string
  topic: Topic
  /**
   * Elo-scale difficulty, the same scale the maths generators use, so a
   * question can be pitched at the person answering rather than handed out at
   * random. Roughly: 700 is a confident seven-year-old, 1400 is a curious
   * adult who reads.
   */
  rating: number
  /** Supports `{kid}` / `{papa}` placeholders — render through `fill()`. */
  prompt: string
  /**
   * The right answer is written first. They are shuffled before anyone sees
   * them; writing them this way means the source can be read and checked by
   * eye, which matters a great deal more than it sounds when there are
   * hundreds of them.
   */
  options: readonly string[]
  /** Runs whether the answer was right or wrong. The point is the idea. */
  explain: string
  /** A flag to draw above the question, by name from `FLAGS`. */
  flag?: string
  /**
   * Draw each option as a flag instead of printing its name.
   *
   * The options are still country names, and the button finds the flag from
   * the name — parallel arrays would have to survive being shuffled together,
   * and one day they would not.
   */
  showFlags?: boolean
}

/** The colour and label each topic wears, so a glance tells you what is coming. */
export const TOPICS: Record<Topic, { label: string; tint: string }> = {
  maths: { label: 'Numbers', tint: '#ffc84a' },
  history: { label: 'History', tint: '#ff6b53' },
  geography: { label: 'Geography', tint: '#58b9ff' },
  trivia: { label: 'Anything', tint: '#4ade80' },
}
