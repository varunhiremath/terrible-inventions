/**
 * The question that pops up between lives.
 *
 * This replaced a shop where maths bought power-ups. The shop had a shape to
 * it — choose a prize, earn it, spend it — and all of that shape was reasons
 * to be somewhere other than the game. What was wanted was much smaller: you
 * lose a life, something asks you a question, you answer it, you carry on.
 *
 * So there is no currency, no inventory and no menu. A right answer is worth
 * a small nod and a wrong one costs nothing, because a nine-year-old who has
 * just lost a life is not in the mood to be fined.
 *
 * Kept pure and away from React so the choosing can be tested: which question
 * comes up, and whether it repeats, is the whole of what this does.
 */
import { GENERATORS } from '../content'
import type { Problem } from '../engine/types'
import { historyAt, type HistoryQuestion } from './history'

export type Question =
  | { kind: 'maths'; problem: Problem }
  | { kind: 'history'; item: HistoryQuestion; options: string[]; answer: string }

/** How many of the last questions are remembered, so nothing comes round fast. */
export const RECENT = 8

/** A maths problem at a difficulty, from whichever generator can reach it. */
export function mathsAt(rating: number, roll: number, seed: number): Problem {
  const able = GENERATORS.filter((g) => rating >= g.minRating && rating <= g.maxRating)
  const pool = able.length > 0 ? able : GENERATORS
  const generator = pool[Math.floor(roll * pool.length) % pool.length]
  const clamped = Math.min(generator.maxRating, Math.max(generator.minRating, rating))
  return generator.generate(Math.round(clamped), seed)
}

/**
 * Shuffles the options, deterministically.
 *
 * The right answer is written first in the bank so the questions are readable
 * as source, which means it has to be moved before anyone sees it — otherwise
 * the top button is always correct and the whole thing is solved in one go.
 */
export function shuffle<T>(items: readonly T[], roll: number): T[] {
  const out = [...items]
  let r = roll
  for (let i = out.length - 1; i > 0; i--) {
    r = (r * 9301 + 0.49297) % 1
    const j = Math.floor(r * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * What to ask next.
 *
 * Maths and history roughly half and half. Not strictly alternating: a child
 * who knows the next one is always a sum starts working out the sum while the
 * last life is still running out.
 */
export function pickQuestion(
  rating: number,
  roll: number,
  seed: number,
  recent: readonly string[] = [],
): Question {
  const wantsHistory = roll < 0.5
  if (wantsHistory) {
    const item = historyAt(rating, (roll * 7.3) % 1, recent)
    return {
      kind: 'history',
      item,
      options: shuffle(item.options, (roll * 3.7) % 1),
      answer: item.options[0],
    }
  }
  return { kind: 'maths', problem: mathsAt(rating, (roll * 5.1) % 1, seed) }
}

/** What to remember a question by, so it is not asked again straight away. */
export function idOf(question: Question): string {
  return question.kind === 'history' ? question.item.id : question.problem.kind
}
