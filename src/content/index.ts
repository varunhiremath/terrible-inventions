import type { Generator, GeneratorId } from '../engine/types'
import { rectangleHunt } from './rectangleHunt'
import { fractionDuel } from './fractionDuel'
import { pathCount } from './pathCount'
import { papasMistake } from './papasMistake'
import { knightsKnaves } from './knightsKnaves'
import { mixUp } from './mixUp'
import { offThePrice } from './offThePrice'
import { cogs } from './cogs'
import { crateWeight } from './crateWeight'

/**
 * Every generator, in no particular order — the selector picks by rating and
 * by what it served last, not by position.
 *
 * The first five are the original set and are about reasoning that happens to
 * use numbers. The last four were added when the module changed: ratio,
 * percentage, factors and the unknown are the four things a grade five or six
 * syllabus is actually made of, and none of them had any road here at all.
 */
export const GENERATORS: readonly Generator[] = [
  rectangleHunt,
  fractionDuel,
  pathCount,
  papasMistake,
  knightsKnaves,
  mixUp,
  offThePrice,
  cogs,
  crateWeight,
]

const BY_ID = new Map<GeneratorId, Generator>(GENERATORS.map((g) => [g.id, g]))

export function generatorFor(id: GeneratorId): Generator {
  const g = BY_ID.get(id)
  if (!g) throw new Error(`unknown generator: ${id}`)
  return g
}
