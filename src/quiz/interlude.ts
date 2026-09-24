/**
 * The question that pops up between lives.
 *
 * This replaced a shop where maths bought power-ups. The shop had a shape to
 * it — choose a prize, earn it, spend it — and all of that shape was reasons to
 * be somewhere other than the game. What was wanted was much smaller: you lose
 * a life, something asks you a question, you answer it, you carry on.
 *
 * So there is no currency, no inventory and no menu. A right answer is worth a
 * small nod and a wrong one costs nothing, because a nine-year-old who has just
 * lost a life is not in the mood to be fined.
 *
 * Kept pure and away from React so the choosing can be tested: which question
 * comes up, and whether it repeats, is the whole of what this does.
 */
import { GENERATORS } from '../content'
import type { Problem } from '../engine/types'
import { BY_TOPIC, askFrom, topicFor } from './bank'
import type { Ask, Topic } from './types'

export type Question =
  | { kind: 'maths'; problem: Problem }
  | { kind: 'ask'; item: Ask; options: string[]; answer: string }

export { RECENT } from './bank'

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
 * How often the question is a typed-in sum rather than one off the bank.
 *
 * The generated maths is the thing that actually moves his rating, so it has
 * to come round often enough to mean something. But it is also the only kind
 * that needs a number pad and real work, and a run of them at the moment a
 * life is lost is a punishment. One in four.
 */
const GENERATED = 0.25

/**
 * What to ask next.
 *
 * `lastTopic` keeps the same subject from coming round twice in a row. It is
 * the topic of the previous question, not a preference: nobody chooses this.
 */
export function pickQuestion(
  rating: number,
  roll: number,
  seed: number,
  recent: readonly string[] = [],
  lastTopic?: Topic,
): Question {
  if (roll < GENERATED) return { kind: 'maths', problem: mathsAt(rating, (roll * 5.1) % 1, seed) }

  const topic = topicFor((roll * 11.7) % 1, lastTopic)
  const item = askFrom(BY_TOPIC[topic], rating, (roll * 7.3) % 1, recent)
  return {
    kind: 'ask',
    item,
    options: shuffle(item.options, (roll * 3.7) % 1),
    answer: item.options[0],
  }
}

/** What to remember a question by, so it is not asked again straight away. */
export function idOf(question: Question): string {
  return question.kind === 'ask' ? question.item.id : question.problem.kind
}

/** Which topic a question belongs to, for keeping two of a kind apart. */
export function topicOf(question: Question): Topic {
  return question.kind === 'ask' ? question.item.topic : 'maths'
}
