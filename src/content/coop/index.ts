import type { CoopGenerator, CoopGeneratorId } from './types'
import { splitClues } from './splitClues'

export const COOP_GENERATORS: readonly CoopGenerator[] = [splitClues]

export function coopGeneratorFor(id: CoopGeneratorId): CoopGenerator {
  const g = COOP_GENERATORS.find((x) => x.id === id)
  if (!g) throw new Error(`unknown co-op generator: ${id}`)
  return g
}

export { renderClue } from './splitClues'
export * from './types'
