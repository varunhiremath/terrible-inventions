/**
 * The workshop, and what is for sale in it.
 *
 * Two things changed at once and they belong together. The maths came out of
 * the games — being handed a sum at the moment you lose a life is a punishment
 * wearing a reward's coat — and it went in here, where going in is a choice.
 * And everything you do now pays in the same coin, so a good run at the caves
 * and a good run at the road both count towards the same thing.
 *
 * That gives maths a job it did not have before. It is not the toll you pay to
 * carry on playing; it is the quick way to afford the thing you want. Playing
 * earns coins slowly and reliably. Sums earn them fast. Nobody is ever made to
 * do one.
 *
 * Every upgrade here is a single number read once, when a run starts. That is
 * a deliberate limit: an upgrade that has to be threaded through a simulation
 * is an upgrade that will get one game subtly wrong, and this way each game
 * asks one question at the start and is otherwise untouched.
 */
import type { SaveState } from '../engine/storage'

/** Score per coin. A decent run at anything is worth a handful. */
export const COINS_PER = 400

/**
 * What a right answer in the workshop is worth.
 *
 * Scaled by how hard the question was, so there is nothing to be gained by
 * grinding easy ones — and enough that five or six sums buy the first thing on
 * the shelf, which is the point of the whole arrangement.
 */
export function worthOf(rating: number): number {
  return Math.max(3, Math.round(4 + rating / 220))
}

export interface Upgrade {
  id: string
  name: string
  says: string
  /** What it costs, per step. The list is also how many steps there are. */
  costs: readonly number[]
  /** Which games notice. Shown on the card so nothing is bought blind. */
  where: string
}

export const UPGRADES: readonly Upgrade[] = [
  {
    id: 'spare',
    name: 'Spare life',
    says: 'Start every run with one more go.',
    costs: [40, 100],
    where: 'Maze, caves, pipes, road',
  },
  {
    id: 'shield',
    name: 'Spare shield',
    says: 'Set off with one more between you and the rocks.',
    costs: [40, 100],
    where: 'The Long Way Out',
  },
  {
    id: 'tank',
    name: 'Bigger tank',
    says: 'A quarter more fuel before you have to think about it.',
    costs: [50, 120],
    where: 'The Road',
  },
  {
    id: 'clock',
    name: 'More on the clock',
    says: 'Forty-five seconds, every level.',
    costs: [45, 110],
    where: 'The Pipes',
  },
  {
    id: 'jets',
    name: 'Deeper jetpack',
    says: 'Half as much again in the tank when you find one.',
    costs: [45, 110],
    where: 'The Caves',
  },
]

export const BY_ID: Record<string, Upgrade> =
  Object.fromEntries(UPGRADES.map((u) => [u.id, u]))

/** How many of a thing has been bought. */
export function owned(save: Pick<SaveState, 'workshop'>, id: string): number {
  return save.workshop?.[id] ?? 0
}

/** What the next one costs, or null when there is no next one. */
export function nextCost(save: Pick<SaveState, 'workshop'>, id: string): number | null {
  const upgrade = BY_ID[id]
  const have = owned(save, id)
  return have < upgrade.costs.length ? upgrade.costs[have] : null
}

// --- what the games ask at the start of a run --------------------------------

/** Extra lives, for every game that counts them. */
export const spareLives = (save: Pick<SaveState, 'workshop'>) => owned(save, 'spare')

/** Extra shields, for the one game that counts those instead. */
export const spareShields = (save: Pick<SaveState, 'workshop'>) => owned(save, 'shield')

/** How much bigger the road's tank is, as a multiplier. */
export const tankScale = (save: Pick<SaveState, 'workshop'>) => 1 + owned(save, 'tank') * 0.25

/** Seconds added to each level of the pipes. */
export const extraSeconds = (save: Pick<SaveState, 'workshop'>) => owned(save, 'clock') * 45

/** How much longer a jetpack lasts, as a multiplier. */
export const jetScale = (save: Pick<SaveState, 'workshop'>) => 1 + owned(save, 'jets') * 0.5
