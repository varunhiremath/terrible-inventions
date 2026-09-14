/** Scales a knob with rating: below the first stop, above the last, or interpolated. */
export function band(rating: number, stops: readonly (readonly [number, number])[]): number {
  if (rating <= stops[0][0]) return stops[0][1]
  const last = stops[stops.length - 1]
  if (rating >= last[0]) return last[1]

  for (let i = 1; i < stops.length; i++) {
    const [r0, v0] = stops[i - 1]
    const [r1, v1] = stops[i]
    if (rating <= r1) return v0 + ((rating - r0) / (r1 - r0)) * (v1 - v0)
  }
  return last[1]
}

/** Which of `tiers` the rating falls into. Tiers are the lower bounds, ascending. */
export function tier(rating: number, bounds: readonly number[]): number {
  let t = 0
  for (let i = 0; i < bounds.length; i++) if (rating >= bounds[i]) t = i
  return t
}

export function divisors(n: number): number[] {
  const out: number[] = []
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue
    out.push(d)
    if (d !== n / d) out.push(n / d)
  }
  return out.sort((a, b) => a - b)
}

/** Distinct rectangles with whole-number sides and this many blocks (w x h and h x w are one). */
export function rectangleCount(n: number): number {
  let count = 0
  for (let d = 1; d * d <= n; d++) if (n % d === 0) count++
  return count
}

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
