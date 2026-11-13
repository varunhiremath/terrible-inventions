/**
 * The Yard: what gets ordered, and what the sheet will take.
 *
 * "Shapes, area, perimeter, volume — that's his new maths module."
 *
 * So: Papa's builder's yard, a sheet of ply marked out in squares, and a
 * cutting press. Orders come in and you drag out a rectangle to fill them.
 *
 * The whole design turns on one choice: you are not asked what the area of a
 * shape *is*, you are asked to *make* one. Being told "4 by 6, what is the
 * area" is a sum with a shape drawn next to it. Being told "cut me 24 squares"
 * and left to find 4 by 6 — or 3 by 8, or 2 by 12 — is the same arithmetic
 * from the other end, and it is a better end: it is where factors live, and it
 * cannot be done by multiplying the two numbers you were given.
 *
 * Four kinds of order, between them the whole module:
 *
 *  - PANEL: so many squares. Area, and the factor pairs that make it.
 *  - EDGING: so much edge. Perimeter, which is the one everybody confuses
 *    with area until they have had to make both.
 *  - EXACT: so many squares AND so much edge. Both at once, which has one
 *    answer and is a proper puzzle — the quadratic a nine-year-old solves by
 *    knowing his factor pairs and checking their edges.
 *  - TANK: so many cubes. Volume, built as a base you drag and a depth you
 *    count up, so that length times width times height is three things you
 *    did rather than three letters in a formula.
 */

/** The dice, as little of them as this file needs. */
export interface Dice {
  next(): number
  int(min: number, max: number): number
}

/** The sheet, in squares. Big enough for a twelve by eight and no bigger. */
export const WIDE = 14
export const TALL = 10

/** How many goes you get, before anything the workshop adds. */
export const LIVES = 3

/** How deep a tank can be built. */
export const DEEPEST = 8

export type Job = 'panel' | 'edging' | 'exact' | 'half' | 'tank' | 'skin'

export interface Order {
  id: number
  job: Job
  /** Squares wanted, where the job wants squares. */
  area: number
  /** Edge wanted, where the job wants edge. */
  edge: number
  /** Cubes wanted, for a tank. */
  cubes: number
  /** Ply wanted for the outside of a tank, for a skin order. */
  skin: number
  /** A depth the order insists on, if it does. */
  deep: number | null
  /** Seconds it is on the board before the lorry goes without it. */
  seconds: number
}

/** A rectangle drawn on the sheet, in squares. */
export interface Cut {
  x: number
  y: number
  wide: number
  tall: number
}

export const areaOf = (cut: Cut): number => cut.wide * cut.tall
export const edgeOf = (cut: Cut): number => 2 * (cut.wide + cut.tall)
export const cubesOf = (cut: Cut, deep: number): number => areaOf(cut) * deep

/**
 * The slant: half a rectangle, cut corner to corner.
 *
 * This is the only piece in the yard that is not a rectangle, and it is here
 * because half base times height is the one area formula that has to be
 * *seen* to stop being a letter. A triangle of twelve squares is a rectangle
 * of twenty-four with a line through it, and the only way to find the
 * rectangle is to double the order and then factor it — so the job is the
 * panel job with one extra step, and the extra step is the lesson.
 */
export const slantOf = (cut: Cut): number => areaOf(cut) / 2

/**
 * The skin of a tank: all six faces of it.
 *
 * Two the size of the floor, and a band right round the sides as deep as the
 * tank is. Written the way it is worth saying out loud — two faces and a band
 * — rather than as 2(lw + lh + wh), because the second one is four letters
 * and the first one is a thing you can see.
 */
export const skinOf = (cut: Cut, deep: number): number =>
  2 * areaOf(cut) + 2 * deep * (cut.wide + cut.tall)

/**
 * The thinnest piece the press will take.
 *
 * Two squares each way, and this is the rule that makes the game about
 * factors rather than about counting. Without it an order for sixteen squares
 * is filled by dragging a strip one square wide and sixteen long: correct,
 * instant, and it teaches nothing, because 1 by 16 is the factor pair nobody
 * has to think about. A probe playing the yard found that shortcut on its
 * first order and took it every time after.
 *
 * It is also a true thing about a builder's yard. Nobody wants a plank one
 * square wide.
 */
export const THINNEST = 2

/** Whether a cut fills an order. */
export function fills(order: Order, cut: Cut, deep: number): boolean {
  if (cut.wide < THINNEST || cut.tall < THINNEST) return false
  switch (order.job) {
    case 'panel': return areaOf(cut) === order.area
    case 'edging': return edgeOf(cut) === order.edge
    case 'exact': return areaOf(cut) === order.area && edgeOf(cut) === order.edge
    /*
     * The slant wants a rectangle of twice the order, because the press takes
     * the corner-to-corner line out of whatever is chalked. An odd number of
     * squares has no rectangle at all — 2 x 12.5 is not a thing a yard cuts —
     * and the orders are built from real rectangles so one never goes up.
     */
    case 'half': return areaOf(cut) === order.area * 2
    case 'tank':
      if (order.deep !== null && deep !== order.deep) return false
      return cubesOf(cut, deep) === order.cubes
    case 'skin':
      if (order.deep !== null && deep !== order.deep) return false
      return skinOf(cut, deep) === order.skin
  }
}

/** What is wrong with a cut, in the fewest words, for the board to say. */
export function offBy(order: Order, cut: Cut, deep: number): string {
  if (cut.wide < THINNEST || cut.tall < THINNEST) {
    return `too thin — ${THINNEST} squares each way at least`
  }
  switch (order.job) {
    case 'panel': {
      const got = areaOf(cut)
      return got === order.area ? '' : `${got} squares, not ${order.area}`
    }
    case 'edging': {
      const got = edgeOf(cut)
      return got === order.edge ? '' : `${got} of edge, not ${order.edge}`
    }
    case 'exact': {
      const area = areaOf(cut)
      const edge = edgeOf(cut)
      if (area !== order.area) return `${area} squares, not ${order.area}`
      if (edge !== order.edge) return `edge is ${edge}, not ${order.edge}`
      return ''
    }
    case 'half': {
      const got = slantOf(cut)
      if (got === order.area) return ''
      // Said in halves when it lands on one, because "11.5 squares, not 12"
      // is the whole point of the job and rounding it away would hide it.
      const said = Number.isInteger(got) ? String(got) : got.toFixed(1)
      return `${said} squares on the slant, not ${order.area}`
    }
    case 'tank': {
      if (order.deep !== null && deep !== order.deep) {
        return `${deep} deep, not ${order.deep}`
      }
      const got = cubesOf(cut, deep)
      return got === order.cubes ? '' : `${got} cubes, not ${order.cubes}`
    }
    case 'skin': {
      if (order.deep !== null && deep !== order.deep) {
        return `${deep} deep, not ${order.deep}`
      }
      const got = skinOf(cut, deep)
      return got === order.skin ? '' : `${got} of skin, not ${order.skin}`
    }
  }
}

// --- how hard, and how fast ---------------------------------------------------

/**
 * Which orders the yard is taking on this level.
 *
 * Area and perimeter together from the first level rather than one at a time,
 * because confusing the two is the mistake the game exists to fix and you
 * cannot confuse them if you have only met one. Then the puzzle that needs
 * both, the slant, the tanks, and the skin of a tank last.
 */
export function jobsFor(level: number): Job[] {
  const jobs: Job[] = ['panel', 'edging']
  if (level >= 2) jobs.push('exact')
  if (level >= 3) jobs.push('half')
  if (level >= 4) jobs.push('tank')
  if (level >= 5) jobs.push('skin')
  return jobs
}

export const ordersFor = (level: number): number => 5 + level
export const secondsFor = (level: number): number => Math.max(14, 36 - level * 3)

/**
 * The biggest side the orders will ask for on this level.
 *
 * Capped per axis, not once for both. Capped once, level nine started asking
 * for twelve by eleven — which fits on a fourteen-wide sheet one way round
 * and on a ten-deep one neither way, so the order went up on the board with
 * no answer at all. An exact order is the worst place for that to happen,
 * because it has only the one answer to lose.
 */
export const sidesFor = (level: number): number => Math.min(WIDE, 4 + level * 2)
export const acrossFor = (level: number): number => Math.min(WIDE, sidesFor(level))
export const downFor = (level: number): number => Math.min(TALL, sidesFor(level))

// --- the order book -------------------------------------------------------------

/**
 * One order.
 *
 * Every one of them is built backwards from a rectangle that fits on the
 * sheet, so there is never an order that cannot be filled — and for the ones
 * with more than one answer, never one whose only answer is a strip one
 * square wide, which is the degenerate case a nine-year-old finds in two
 * seconds and learns nothing from.
 */
export function newOrder(id: number, level: number, rng: Dice): Order {
  const jobs = jobsFor(level)
  const job = jobs[rng.int(0, jobs.length - 1)]
  const seconds = secondsFor(level)
  const blank: Order = { id, job, area: 0, edge: 0, cubes: 0, skin: 0, deep: null, seconds }

  if (job === 'half') {
    /*
     * Built from the rectangle the press will take, so the order is always a
     * whole number of squares and always has a rectangle behind it. Both
     * sides at least two as everywhere else, and at least one of them even,
     * because a slant off an odd-by-odd rectangle is a half square.
     */
    const wide = rng.int(2, acrossFor(level))
    let tall = rng.int(2, downFor(level))
    // Odd by odd is the only pair whose half lands between two squares, and
    // a side knocked down by one is always still at least two, because two is
    // even and so is never the side that gets knocked down.
    if ((wide * tall) % 2 !== 0) tall -= 1
    return { ...blank, area: (wide * tall) / 2 }
  }

  if (job === 'skin') {
    /*
     * The outside of a tank, built from a tank. Floors are kept small here on
     * purpose: the skin of a six by six four deep is 264, and a number that
     * size stops being something anybody works out and starts being something
     * they stab at.
     */
    const deep = rng.int(2, Math.min(DEEPEST, 2 + Math.floor(level / 2)))
    const wide = rng.int(2, Math.min(acrossFor(level), 5))
    const tall = rng.int(2, Math.min(downFor(level), 5))
    const stated = rng.next() < 0.6
    return {
      ...blank,
      skin: 2 * wide * tall + 2 * deep * (wide + tall),
      deep: stated ? deep : null,
      area: wide * tall,
      cubes: wide * tall * deep,
    }
  }

  if (job === 'tank') {
    const deep = rng.int(2, Math.min(DEEPEST, 2 + Math.floor(level / 2)))
    const wide = rng.int(2, Math.min(acrossFor(level), 6))
    const tall = rng.int(2, Math.min(downFor(level), 6))
    /*
     * Half of them name the depth and half leave it to you. Naming it turns
     * the order into "that many cubes, three deep", which is a division and a
     * rectangle; leaving it free is three numbers you get to choose, which is
     * the same volume arrived at a dozen different ways.
     */
    const stated = rng.next() < 0.5
    return {
      ...blank,
      cubes: wide * tall * deep,
      deep: stated ? deep : null,
      area: wide * tall,
    }
  }

  // Both sides at least two, so no order is filled by a one-square strip, and
  // each side inside its own side of the sheet.
  const wide = rng.int(2, acrossFor(level))
  const tall = rng.int(2, downFor(level))
  const area = wide * tall
  const edge = 2 * (wide + tall)

  if (job === 'panel') return { ...blank, area }
  if (job === 'edging') return { ...blank, edge }
  return { ...blank, area, edge }
}

/** Every rectangle on the sheet that would fill this order. */
export function answers(order: Order): Cut[] {
  const out: Cut[] = []
  const deepens = order.job === 'tank' || order.job === 'skin'
  for (let tall = 1; tall <= TALL; tall++) {
    for (let wide = 1; wide <= WIDE; wide++) {
      const cut = { x: 0, y: 0, wide, tall }
      if (deepens) {
        for (let deep = 1; deep <= DEEPEST; deep++) {
          if (fills(order, cut, deep)) { out.push(cut); break }
        }
      } else if (fills(order, cut, 1)) out.push(cut)
    }
  }
  return out
}

/** What the board says is wanted. */
export function wants(order: Order): string {
  switch (order.job) {
    case 'panel': return `${order.area} SQUARES`
    case 'edging': return `${order.edge} OF EDGING`
    case 'exact': return `${order.area} SQUARES, ${order.edge} OF EDGE`
    case 'half': return `${order.area} SQUARES ON THE SLANT`
    case 'tank':
      return order.deep === null
        ? `${order.cubes} CUBES`
        : `${order.cubes} CUBES, ${order.deep} DEEP`
    case 'skin':
      return order.deep === null
        ? `${order.skin} OF SKIN`
        : `${order.skin} OF SKIN, ${order.deep} DEEP`
  }
}

/** And how to fill it, in the fewest words. */
export function howTo(job: Job): string {
  switch (job) {
    case 'panel': return 'drag out that many squares — two each way at least'
    case 'edging': return 'the edge all the way round has to come to that'
    case 'exact': return 'both at once — there is only one way'
    case 'half': return 'the press cuts corner to corner, so chalk twice as much'
    case 'tank': return 'drag the floor, then count the depth up'
    case 'skin': return 'all six sides — two the size of the floor and a band right round'
  }
}
