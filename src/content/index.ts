import type { Generator, GeneratorId } from '../engine/types'
import { rectangleHunt } from './rectangleHunt'
import { fractionDuel } from './fractionDuel'
import { pathCount } from './pathCount'
import { papasMistake } from './papasMistake'
import { knightsKnaves } from './knightsKnaves'

export const GENERATORS: readonly Generator[] = [
  rectangleHunt,
  fractionDuel,
  pathCount,
  papasMistake,
  knightsKnaves,
]

const BY_ID = new Map<GeneratorId, Generator>(GENERATORS.map((g) => [g.id, g]))

export function generatorFor(id: GeneratorId): Generator {
  const g = BY_ID.get(id)
  if (!g) throw new Error(`unknown generator: ${id}`)
  return g
}
