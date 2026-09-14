/**
 * How the thing in the house moves.
 *
 * The maths here is not a gate in front of the chase — it *is* the chase. The
 * player sees where it has been, works out the rule, and predicts where it will
 * be. Pattern, hypothesis, prediction, test.
 *
 * Everything is modular over the number of rooms, so the house wraps: past the
 * last door you are back at the first. That is modular arithmetic without ever
 * needing the word.
 */

export type Rule =
  /** Same jump every time. Skip counting. */
  | { kind: 'step'; d: number }
  /** Doubling, tripling. */
  | { kind: 'multiply'; r: number }
  /** Jumps that grow: +2, +3, +4, ... */
  | { kind: 'growStep'; start: number; grow: number }
  /** Two jumps taking turns: +5, -2, +5, -2. */
  | { kind: 'alternate'; a: number; b: number }
  /** Each jump is the sum of the previous two. */
  | { kind: 'fibStep'; first: number; second: number }

export interface Hunt {
  /** Doors in the house, numbered 1..rooms. */
  rooms: number
  rule: Rule
  /** Where it has been, oldest first. Always at least two entries. */
  trail: number[]
}

/** Rooms are 1-based, so the wrap has to come back to 1 rather than 0. */
export function wrap(value: number, rooms: number): number {
  return ((value - 1) % rooms + rooms) % rooms + 1
}

/** Where the thing goes after this trail, under this rule. */
export function nextRoom(rule: Rule, trail: readonly number[], rooms: number): number {
  const last = trail[trail.length - 1]
  const index = trail.length - 1

  switch (rule.kind) {
    case 'step':
      return wrap(last + rule.d, rooms)
    case 'multiply':
      return wrap((last - 1) * rule.r + 1, rooms)
    case 'growStep':
      return wrap(last + rule.start + rule.grow * index, rooms)
    case 'alternate':
      return wrap(last + (index % 2 === 0 ? rule.a : rule.b), rooms)
    case 'fibStep': {
      // The first two jumps are the seeds; only from the third onward is a jump
      // the sum of the two before it.
      const jumps = jumpsOf(trail, rooms)
      if (jumps.length === 0) return wrap(last + rule.first, rooms)
      if (jumps.length === 1) return wrap(last + rule.second, rooms)
      return wrap(last + jumps[jumps.length - 2] + jumps[jumps.length - 1], rooms)
    }
  }
}

/** The gaps between consecutive rooms, taken the short way round the wrap. */
function jumpsOf(trail: readonly number[], rooms: number): number[] {
  const out: number[] = []
  for (let i = 1; i < trail.length; i++) {
    let d = trail[i] - trail[i - 1]
    // Keep the jump in a range a person would describe, so wraps do not turn a
    // "+2" into a "+11" halfway along the trail.
    while (d > rooms / 2) d -= rooms
    while (d < -rooms / 2) d += rooms
    out.push(d)
  }
  return out
}

/** Rolls the rule forward from a starting room to produce a whole trail. */
export function runRule(rule: Rule, start: number, rooms: number, length: number): number[] {
  const trail = [start]
  while (trail.length < length) trail.push(nextRoom(rule, trail, rooms))
  return trail
}

export function fits(rule: Rule, trail: readonly number[], rooms: number): boolean {
  for (let i = 1; i < trail.length; i++) {
    if (nextRoom(rule, trail.slice(0, i), rooms) !== trail[i]) return false
  }
  return true
}

/**
 * Every rule the engine knows, within sane parameters. Bounded on purpose: the
 * fairness check has to enumerate these on every trail, and an unbounded space
 * would make "do they all agree?" unanswerable.
 */
export function allRules(rooms: number): Rule[] {
  const out: Rule[] = []
  const span = Math.max(3, Math.min(9, rooms - 1))

  for (let d = -span; d <= span; d++) if (d !== 0) out.push({ kind: 'step', d })
  for (let r = 2; r <= 4; r++) out.push({ kind: 'multiply', r })

  for (let start = 1; start <= 4; start++) {
    for (let grow = 1; grow <= 3; grow++) out.push({ kind: 'growStep', start, grow })
  }

  for (let a = -span; a <= span; a++) {
    for (let b = -span; b <= span; b++) {
      if (a !== 0 && b !== 0 && a !== b) out.push({ kind: 'alternate', a, b })
    }
  }

  for (let first = 1; first <= 3; first++) {
    for (let second = 1; second <= 3; second++) out.push({ kind: 'fibStep', first, second })
  }

  return out
}

export interface Fairness {
  /** Rules consistent with everything revealed so far. */
  fitting: Rule[]
  /** Distinct next rooms those rules point at. */
  predictions: number[]
  /** True when every surviving rule agrees, so there is one defensible answer. */
  forced: boolean
}

/**
 * Whether the evidence pins down an answer.
 *
 * Deliberately weaker than "the rule is unique". Two different rules that both
 * fit the trail and both point at room 9 leave the player nothing to get wrong,
 * so ambiguity about the rule is fine — ambiguity about the *answer* is not.
 * Testing the weaker condition means far shorter trails, which keeps the hunt
 * feeling like tracking rather than like a worksheet.
 */
export function fairness(trail: readonly number[], rooms: number): Fairness {
  const fitting = allRules(rooms).filter((r) => fits(r, trail, rooms))
  const predictions = [...new Set(fitting.map((r) => nextRoom(r, trail, rooms)))]
  return { fitting, predictions, forced: fitting.length > 0 && predictions.length === 1 }
}

/**
 * Extends the trail until the next room is forced.
 *
 * This is why a wrong guess is never punishing: the creature moving on hands the
 * player another term, and the answer gets more determined, not less.
 */
export function revealUntilFair(
  rule: Rule,
  start: number,
  rooms: number,
  minLength = 3,
  maxLength = 8,
): number[] {
  let trail = runRule(rule, start, rooms, minLength)
  while (trail.length < maxLength && !fairness(trail, rooms).forced) {
    trail = runRule(rule, start, rooms, trail.length + 1)
  }
  return trail
}
