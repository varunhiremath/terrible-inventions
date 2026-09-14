/**
 * Seeded RNG. Every problem is generated from an explicit seed so that a
 * generator is reproducible in tests and a problem can be replayed exactly
 * (which is what lets the same puzzle appear on two devices in co-op later).
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))

  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}
