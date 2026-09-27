/**
 * The whole bank, and how a question is chosen from it.
 *
 * Choosing is more delicate than it looks. Three things are wanted at once:
 * the question should be near the right difficulty, it should not be one of
 * the last several, and it should not be the same topic three times running.
 * Take any of those too seriously and you get the other two wrong — a strict
 * difficulty match means the same handful of questions forever, and strict
 * rotation between topics means you always know what is coming.
 *
 * So each one is a preference rather than a rule, and the whole thing is a
 * pure function of a roll, which is what makes it testable.
 */
import { GEOGRAPHY } from './bank/geography'
import { HISTORY } from './bank/history'
import { MATHS } from './bank/maths'
import { TRIVIA } from './bank/trivia'
import type { Ask, Topic } from './types'

export const BANK: readonly Ask[] = [...MATHS, ...HISTORY, ...GEOGRAPHY, ...TRIVIA]

export const BY_TOPIC: Record<Topic, readonly Ask[]> = {
  maths: MATHS,
  history: HISTORY,
  geography: GEOGRAPHY,
  trivia: TRIVIA,
}

/** How many of the last questions are remembered, so nothing comes round fast. */
export const RECENT = 20

/**
 * How near the right difficulty to stay.
 *
 * Wide enough that there is always a real choice even in a thin topic, narrow
 * enough that a nine-year-old is not handed something written for an adult.
 */
const WINDOW = 12

/**
 * Picks one question from a list.
 *
 * Questions already asked are dropped first. If that empties the list, the
 * memory is ignored rather than returning nothing: running out of new
 * questions should feel like repetition, not like a broken screen.
 */
export function askFrom(
  pool: readonly Ask[],
  rating: number,
  roll: number,
  recent: readonly string[] = [],
  solved: readonly string[] = [],
): Ask {
  /*
   * A question he has already got right is never asked again.
   *
   * `recent` is a short memory that stops the same thing twice in a sitting.
   * `solved` is permanent and is the point of the bank: there is no value in
   * asking somebody the capital of Australia for the fourth time, and there is
   * a good deal of value in the fourth question being one he has not met.
   *
   * When a topic is exhausted — every question in it answered — the door does
   * not close. Everything comes back on the table, oldest first, because a
   * game that stops asking is worse than one that repeats itself.
   */
  const unseen = pool.filter((ask) => !solved.includes(ask.id) && !recent.includes(ask.id))
  const unsolved = pool.filter((ask) => !solved.includes(ask.id))
  const fresh = unseen.length > 0 ? unseen : unsolved
  const usable = fresh.length > 0 ? fresh : pool

  const near = [...usable].sort(
    (a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating),
  )
  const window = near.slice(0, Math.min(WINDOW, near.length))
  return window[Math.floor(roll * window.length) % window.length]
}

/**
 * Which topic to ask about next.
 *
 * Even odds across the four, except that the topic of the last question is
 * dropped from the draw. Two in a row of the same thing is what makes a set of
 * questions feel like a worksheet.
 */
export function topicFor(
  roll: number,
  lastTopic?: Topic,
  from: readonly Topic[] = ['maths', 'history', 'geography', 'trivia'],
): Topic {
  const dropped = lastTopic ? from.filter((t) => t !== lastTopic) : from
  // Unless dropping it would leave nothing, which it does when a caller has
  // asked for one topic only.
  const choices = dropped.length > 0 ? dropped : from
  return choices[Math.floor(roll * choices.length) % choices.length]
}

/** Everything in the bank, by id, for looking one up again. */
export const BY_ID: Record<string, Ask> = Object.fromEntries(BANK.map((ask) => [ask.id, ask]))
