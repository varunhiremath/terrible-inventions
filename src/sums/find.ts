/**
 * What counts as a find.
 *
 * The board is not blocks with sums written on them any more — it is one
 * number or one sign per block, and the game is dragging along a line that
 * reads as something true. `2 + 3 = 5` is five blocks. `1 1 2 3 5 8` is six.
 *
 * That change is what makes "the bigger the thing you find, the more you get"
 * mean anything at all: a four-long run of square numbers and a seven-long one
 * are different finds, and the longer one should be worth hunting for.
 *
 * Everything in here is about reading a line of tokens and answering one
 * question: is this true, and if so, what *kind* of true is it? The kind
 * matters because the game says it out loud — "triangle numbers", "each one is
 * the two before it added up" — and a game that names the pattern is teaching
 * rather than testing.
 */

export type Op = '+' | '-' | '×' | '÷' | '^'
export const OPS: readonly Op[] = ['+', '-', '×', '÷', '^']

export type Token =
  | { kind: 'num'; n: number }
  | { kind: 'op'; op: Op }
  | { kind: 'eq' }

export const num = (n: number): Token => ({ kind: 'num', n })
export const op = (o: Op): Token => ({ kind: 'op', op: o })
export const EQ: Token = { kind: 'eq' }

export const sayToken = (t: Token): string =>
  t.kind === 'num' ? String(t.n) : t.kind === 'op' ? t.op : '='

/** The shortest thing that can be a find: the shortest sequence. */
export const LEAST_FIND = 4

/** Nothing on a board, or inside a sum on one, goes past this. */
const BIG = 100000

// --- working a line out ------------------------------------------------------

interface Reader {
  tokens: readonly Token[]
  at: number
}

const sane = (v: number | null): number | null =>
  v === null || !Number.isFinite(v) || Math.abs(v) > BIG ? null : v

function atom(r: Reader): number | null {
  const t = r.tokens[r.at]
  if (!t || t.kind !== 'num') return null
  r.at += 1
  return t.n
}

/** Right associative, like everybody writes it: 2^3^2 is 2^9, not 8^2. */
function power(r: Reader): number | null {
  const base = atom(r)
  if (base === null) return null
  const t = r.tokens[r.at]
  if (!t || t.kind !== 'op' || t.op !== '^') return base
  r.at += 1
  const exponent = power(r)
  if (exponent === null) return null
  // Guarded hard: a board is allowed to hold 9 and 9, and nothing good comes
  // of working out what nine to the ninth is.
  if (exponent < 0 || exponent > 12 || Math.abs(base) > 60) return null
  return sane(Math.pow(base, exponent))
}

function term(r: Reader): number | null {
  let value = power(r)
  if (value === null) return null
  for (;;) {
    const t = r.tokens[r.at]
    if (!t || t.kind !== 'op' || (t.op !== '×' && t.op !== '÷')) return value
    r.at += 1
    const next = power(r)
    if (next === null) return null
    if (t.op === '÷' && next === 0) return null
    value = t.op === '×' ? value * next : value / next
    if (sane(value) === null) return null
  }
}

function sum(r: Reader): number | null {
  let value = term(r)
  if (value === null) return null
  for (;;) {
    const t = r.tokens[r.at]
    if (!t || t.kind !== 'op' || (t.op !== '+' && t.op !== '-')) return value
    r.at += 1
    const next = term(r)
    if (next === null) return null
    value = t.op === '+' ? value + next : value - next
    if (sane(value) === null) return null
  }
}

/**
 * What a run of tokens comes to, or null if it is not a sum at all.
 *
 * Proper precedence — powers, then times and divide, then plus and minus —
 * because that is what the notation means and he is going to meet it anyway.
 * The generator decides how much of it to put in front of him; this decides
 * what is true.
 */
export function worksOut(tokens: readonly Token[]): number | null {
  if (tokens.length === 0) return null
  const r: Reader = { tokens, at: 0 }
  const value = sum(r)
  return r.at === tokens.length ? sane(value) : null
}

// --- the kinds of find -------------------------------------------------------

export type FindKind =
  | 'sum' | 'power'
  | 'step' | 'times' | 'fib' | 'square' | 'triangle' | 'prime' | 'cube' | 'doubleAdd'

export interface Find {
  kind: FindKind
  /** What the game calls it, in words a nine-year-old uses. */
  says: string
  /** How many blocks it is. */
  length: number
}

export const IS_SEQUENCE: Record<FindKind, boolean> = {
  sum: false, power: false,
  step: true, times: true, fib: true, square: true,
  triangle: true, prime: true, cube: true, doubleAdd: true,
}

/** An equation: one equals sign, a sum either side of it, and they agree. */
function readEquation(tokens: readonly Token[]): Find | null {
  const at = tokens.findIndex((t) => t.kind === 'eq')
  if (at < 0) return null
  if (tokens.some((t, i) => t.kind === 'eq' && i !== at)) return null

  const left = tokens.slice(0, at)
  const right = tokens.slice(at + 1)
  const a = worksOut(left)
  const b = worksOut(right)
  if (a === null || b === null || a !== b) return null
  // Whole numbers only. `7 ÷ 2 = 3.5` cannot be written on these blocks, so a
  // line that comes to three and a half is not a find, it is a near miss.
  if (!Number.isInteger(a)) return null
  // `5 = 5` is true and is not a find. There has to be something done.
  if (!tokens.some((t) => t.kind === 'op')) return null

  const powered = tokens.some((t) => t.kind === 'op' && t.op === '^')
  return {
    kind: powered ? 'power' : 'sum',
    says: powered ? 'a power' : 'a sum',
    length: tokens.length,
  }
}

const SQUARES = Array.from({ length: 40 }, (_, i) => (i + 1) * (i + 1))
const TRIANGLES = Array.from({ length: 40 }, (_, i) => ((i + 1) * (i + 2)) / 2)
const CUBES = Array.from({ length: 16 }, (_, i) => (i + 1) ** 3)
export const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
]

/** Whether these are consecutive entries of a known list, in order. */
function runsAlong(ns: readonly number[], list: readonly number[]): boolean {
  const at = list.indexOf(ns[0])
  if (at < 0 || at + ns.length > list.length) return false
  return ns.every((n, i) => n === list[at + i])
}

/**
 * A sequence.
 *
 * Checked in a deliberate order, because several of these overlap and the one
 * the game *names* should be the one a person would say. `1 4 9 16` is square
 * numbers and is also a run with a constant second difference; nobody says the
 * second thing.
 */
function readSequence(tokens: readonly Token[]): Find | null {
  if (tokens.length < LEAST_FIND) return null
  if (!tokens.every((t) => t.kind === 'num')) return null
  const ns = tokens.map((t) => (t as { n: number }).n)
  const size = ns.length

  /*
   * The same number over and over is not a pattern.
   *
   * It has to be said once here rather than left to each rule, because it slips
   * past more of them than you would think: 7 7 7 7 is not a step, and it is
   * not doubling, but it *is* "double it and take seven", which is true and is
   * not something anybody found.
   */
  if (ns.every((n) => n === ns[0])) return null

  // Named lists first: they are the ones with a name worth saying.
  if (runsAlong(ns, SQUARES)) return { kind: 'square', says: 'square numbers', length: size }
  if (runsAlong(ns, CUBES)) return { kind: 'cube', says: 'cube numbers', length: size }
  if (runsAlong(ns, TRIANGLES)) return { kind: 'triangle', says: 'triangle numbers', length: size }
  if (runsAlong(ns, PRIMES)) return { kind: 'prime', says: 'prime numbers', length: size }

  const gaps = ns.slice(1).map((n, i) => n - ns[i])

  // A step. Nought is not a step: four of the same number is not a pattern.
  if (gaps[0] !== 0 && gaps.every((g) => g === gaps[0])) {
    const by = Math.abs(gaps[0])
    return {
      kind: 'step',
      says: gaps[0] > 0 ? `up in ${by}s` : `down in ${by}s`,
      length: size,
    }
  }

  // Times something each time, including halving.
  if (ns.every((n) => n !== 0)) {
    const ratio = ns[1] / ns[0]
    if (Math.abs(ratio) !== 1 && ns.slice(1).every((n, i) => n === ns[i] * ratio)) {
      const says =
        ratio === 2 ? 'doubling'
        : ratio === 3 ? 'trebling'
        : ratio === 0.5 ? 'halving'
        : ratio > 1 ? `times ${ratio} each time`
        : `divided by ${1 / ratio} each time`
      return { kind: 'times', says, length: size }
    }
  }

  // Each one is the two before it added up.
  if (ns.slice(2).every((n, i) => n === ns[i] + ns[i + 1])) {
    return { kind: 'fib', says: 'each one is the two before it added up', length: size }
  }

  // Double it and add the same thing every time: 1, 3, 7, 15 adds one.
  if (ns.every((n) => Number.isFinite(n))) {
    const plus = ns[1] - ns[0] * 2
    if (ns.slice(1).every((n, i) => n === ns[i] * 2 + plus)) {
      return {
        kind: 'doubleAdd',
        says: plus === 0 ? 'doubling' : plus > 0 ? `double it and add ${plus}` : `double it and take ${-plus}`,
        length: size,
      }
    }
  }

  return null
}

/**
 * Read a line of blocks. Null means it is not a find — which is not the same
 * as being wrong, and the game is careful to say so.
 */
export function readLine(tokens: readonly Token[]): Find | null {
  if (tokens.length < LEAST_FIND) return null
  return readEquation(tokens) ?? readSequence(tokens)
}

/** The line written out, for the banner that says what was found. */
export const sayLine = (tokens: readonly Token[]): string =>
  tokens.map(sayToken).join(' ')
