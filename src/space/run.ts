/**
 * A run out to a world, being played.
 *
 * Fixed step and pure, like everything else in here. The invariant worth
 * stating up front, because it is the one every other game in this project got
 * wrong first: **there is always a gap wide enough to fly through**. A screen
 * full of rock with no way past it is not difficulty, it is a coin toss, and
 * the spawner will not build one. There is a test that plays every world
 * looking for one anyway.
 */
import { makeRng, type Rng } from '../engine/rng'
import {
  BOLT_SPEED, COSTS, FLYABLE, MAGNET_PULL, MERCY, MOST_OF, MOST_SHIELDS, NEW_KIT,
  SCRAP_OF, SCRAP_WIDE, SHIP_SPEED, SHIP_TALL, SHIP_WIDE, SIZE_OF, STARTING_SHIELDS,
  TOUGHNESS, WORTH, reloadFor, worldFor,
  type Hazard, type Kit, type Upgrade, type World,
} from './level'

export const FIXED = 1 / 60

export type SpaceEvent = 'shot' | 'hit' | 'broke' | 'knock' | 'arrive' | 'warn' | 'scrap'

export interface Input {
  left: boolean
  right: boolean
  fire: boolean
}

export const NO_INPUT: Input = { left: false, right: false, fire: false }

export interface Rubble {
  id: number
  kind: Hazard
  /** Across the screen, 0 to 1. */
  x: number
  /** Down the screen, 0 at the top and 1 at the ship's line. */
  y: number
  /** Sideways drift, in screens a second. */
  drift: number
  health: number
  /** Counts down after a hit, so a knock reads. */
  flash: number
}

export interface Bolt {
  id: number
  x: number
  y: number
  /** Whether this one carries on through what it breaks. */
  pierces: boolean
}

/**
 * A cell of scrap, falling.
 *
 * It falls at the same pace as everything else and, without a magnet, in a
 * straight line — same reason as the rubble. With one it leans towards the
 * ship, which is safe to allow because scrap is not a hazard: nothing about
 * the promise that there is a way through is measured against it.
 */
export interface Scrap {
  id: number
  x: number
  y: number
  worth: number
}

export type Status = 'flying' | 'knocked' | 'arrived' | 'lost'

export interface Run {
  world: World
  number: number
  /** Where the ship is across the screen. */
  x: number
  /** How much of the run is done, 0 to 1. */
  progress: number
  rubble: Rubble[]
  bolts: Bolt[]
  scrap: Scrap[]
  /** Cells collected and not yet spent. Carried from world to world. */
  purse: number
  /** What has been fitted. Carried too. */
  kit: Kit
  score: number
  broken: number
  shields: number
  status: Status
  /** Shield time left after a knock: you cannot be hit twice in a moment. */
  mercy: number
  reload: number
  events: SpaceEvent[]
  seed: number
  nextId: number
  warned: boolean
}

export function newRun(
  number = 1,
  shields = STARTING_SHIELDS,
  score = 0,
  seed = 1,
  purse = 0,
  kit: Kit = NEW_KIT,
): Run {
  return {
    world: worldFor(number),
    number,
    x: 0.5,
    progress: 0,
    rubble: [],
    bolts: [],
    scrap: [],
    purse,
    kit,
    score,
    broken: 0,
    shields,
    status: 'flying',
    mercy: 0,
    reload: 0,
    events: [],
    seed,
    nextId: 1,
    warned: false,
  }
}

/** Back in after a knock, with whatever was about to hit you cleared away. */
export function resume(run: Run): Run {
  return {
    ...run,
    status: 'flying',
    mercy: MERCY,
    events: [],
    x: 0.5,
    // Nothing left close enough to hit again the moment you reappear.
    rubble: run.rubble.filter((r) => r.y < 0.45),
    // The scrap that was in the air stays there. Losing a shield already
    // costs enough without also emptying your pockets onto the floor.
    scrap: run.scrap.filter((c) => c.y < 0.45),
  }
}

const spread = (r: Rubble): [number, number] => {
  const half = SIZE_OF[r.kind] / 2
  return [r.x - half, r.x + half]
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1]

/**
 * The widest clear run across the screen, among everything in a band.
 *
 * This is the measure the whole fairness promise is made in: if it ever drops
 * below what a ship can fly through, the screen has become a wall.
 */
export function widestGap(rubble: readonly Rubble[], from: number, to: number): number {
  const shut = rubble
    .filter((r) => r.y + SIZE_OF[r.kind] / 2 >= from && r.y - SIZE_OF[r.kind] / 2 <= to)
    .map(spread)
    .sort((a, b) => a[0] - b[0])

  let widest = 0
  let edge = 0
  for (const [left, right] of shut) {
    widest = Math.max(widest, left - edge)
    edge = Math.max(edge, right)
  }
  return Math.max(widest, 1 - edge)
}

/** Put something new at the top, but only where it leaves a way past. */
function send(run: Run, rng: Rng): void {
  const kinds = run.world.sends
  const kind = kinds[rng.int(0, kinds.length - 1)]
  const half = SIZE_OF[kind] / 2

  // Ten attempts at a spot that keeps a flyable gap. If none of them works the
  // band is busy enough already and nothing is sent, which is the right answer.
  for (let tries = 0; tries < 10; tries++) {
    const x = half + rng.next() * (1 - half * 2)
    const would: Rubble = {
      id: run.nextId, kind, x, y: -half, drift: 0, health: TOUGHNESS[kind], flash: 0,
    }
    /*
     * Judged over every band this could ever share with something.
     *
     * The promise is about any band the ship meets, and a band is half the
     * screen tall — so two pieces sent a few seconds apart can be perfectly
     * legal on their own and still end up in the same band together. Checking
     * only the top third let exactly that through on Jupiter.
     *
     * Nothing drifts, so relative positions never change: a gap that is
     * flyable across this range is flyable all the way down.
     */
    const band = run.rubble.filter((r) => r.y < 0.65)
    if (widestGap([...band, would], -0.2, 0.65) < FLYABLE) continue

    run.rubble.push({
      ...would,
      id: run.nextId++,
      // A shard skitters sideways; the rest come more or less straight down.
      // Straight down, always. See the note on FLYABLE: anything moving
      // sideways eats into a gap that was measured when it was sent.
      drift: 0,
    })
    return
  }
}

/**
 * Whether a thing can be bought right now, and why not if it cannot.
 *
 * Kept next to `buy` and used by the shop to grey a row out, so the reason a
 * button does nothing is the same reason it looks like it will do nothing.
 */
export function canBuy(run: Run, what: Upgrade): boolean {
  if (run.purse < COSTS[what]) return false
  if (what === 'shield') return run.shields < MOST_SHIELDS
  if (what === 'rapid') return run.kit.rapid < MOST_OF.rapid
  if (what === 'twin') return !run.kit.twin
  if (what === 'pierce') return !run.kit.pierce
  return !run.kit.magnet
}

/** Spends the scrap. Does nothing at all if it cannot be afforded. */
export function buy(run: Run, what: Upgrade): Run {
  if (!canBuy(run, what)) return run
  const paid = { ...run, purse: run.purse - COSTS[what] }
  if (what === 'shield') return { ...paid, shields: paid.shields + 1 }
  if (what === 'rapid') return { ...paid, kit: { ...paid.kit, rapid: paid.kit.rapid + 1 } }
  if (what === 'twin') return { ...paid, kit: { ...paid.kit, twin: true } }
  if (what === 'pierce') return { ...paid, kit: { ...paid.kit, pierce: true } }
  return { ...paid, kit: { ...paid.kit, magnet: true } }
}

export function step(run: Run, input: Input, dt: number): Run {
  if (run.status !== 'flying') {
    return run.events.length === 0 ? run : { ...run, events: [] }
  }

  const rng = makeRng(run.seed)
  const next: Run = {
    ...run,
    events: [],
    rubble: run.rubble.map((r) => ({ ...r })),
    bolts: run.bolts.map((b) => ({ ...b })),
    scrap: run.scrap.map((c) => ({ ...c })),
    seed: (run.seed * 1664525 + 1013904223) >>> 0,
  }

  // --- flying ---------------------------------------------------------------
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  next.x = Math.min(1 - SHIP_WIDE / 2, Math.max(SHIP_WIDE / 2, next.x + steer * SHIP_SPEED * dt))
  next.mercy = Math.max(0, next.mercy - dt)
  next.reload = Math.max(0, next.reload - dt)
  next.progress = Math.min(1, next.progress + dt / next.world.seconds)

  // --- shooting -------------------------------------------------------------
  if (input.fire && next.reload === 0) {
    // A twin cannon puts one either side of the nose rather than two down the
    // middle, which is the point of it: it covers a wider lane, it does not
    // hit the same thing twice.
    const barrels = next.kit.twin ? [-SHIP_WIDE * 0.34, SHIP_WIDE * 0.34] : [0]
    for (const off of barrels) {
      next.bolts.push({
        id: next.nextId++,
        x: Math.min(1, Math.max(0, next.x + off)),
        y: 1 - SHIP_TALL,
        pierces: next.kit.pierce,
      })
    }
    next.reload = reloadFor(next.kit)
    next.events.push('shot')
  }
  for (const bolt of next.bolts) bolt.y -= BOLT_SPEED * dt
  next.bolts = next.bolts.filter((b) => b.y > -0.05)

  // --- everything falling ----------------------------------------------------
  for (const rock of next.rubble) {
    rock.y += next.world.fall * dt
    if (rock.flash > 0) rock.flash = Math.max(0, rock.flash - dt)
  }
  next.rubble = next.rubble.filter((r) => r.y < 1.25)

  // --- bolts meeting rubble --------------------------------------------------
  for (const bolt of next.bolts) {
    for (const rock of next.rubble) {
      if (TOUGHNESS[rock.kind] === 0) continue
      if (rock.health <= 0) continue
      const half = SIZE_OF[rock.kind] / 2
      if (Math.abs(bolt.x - rock.x) > half) continue
      if (Math.abs(bolt.y - rock.y) > half) continue
      rock.health -= 1
      rock.flash = 0.12
      if (rock.health <= 0) {
        next.score += WORTH[rock.kind]
        next.broken += 1
        next.events.push('broke')
        // What is left of it, for the pocket. It falls from where the thing
        // was, which means the good stuff is usually in the worst place.
        const worth = SCRAP_OF[rock.kind]
        if (worth > 0) {
          next.scrap.push({ id: next.nextId++, x: rock.x, y: rock.y, worth })
        }
      } else {
        next.events.push('hit')
      }
      // A piercing bolt carries on. Anything else has done its work — and it
      // stops here even when the thing it hit survived, or one bolt would saw
      // through a whole column in a single step.
      if (!bolt.pierces) {
        bolt.y = -1
        break
      }
    }
  }
  next.bolts = next.bolts.filter((b) => b.y > -0.05)
  next.rubble = next.rubble.filter((r) => r.health > 0 || TOUGHNESS[r.kind] === 0)

  // --- scrap ------------------------------------------------------------------
  for (const cell of next.scrap) {
    cell.y += next.world.fall * dt
    /*
     * A magnet leans it towards you. Safe to let this one move sideways, for
     * the reason nothing else is allowed to: scrap is not a hazard, so no
     * promise about there being a way through is measured against where it is.
     */
    if (next.kit.magnet) {
      const towards = Math.sign(next.x - cell.x)
      cell.x = Math.min(1, Math.max(0, cell.x + towards * MAGNET_PULL * dt))
    }
  }
  const pocket: [number, number] = [next.x - SHIP_WIDE / 2, next.x + SHIP_WIDE / 2]
  next.scrap = next.scrap.filter((cell) => {
    if (cell.y > 1.25) return false
    const near = Math.abs(cell.y - (1 - SHIP_TALL / 2)) <= SCRAP_WIDE / 2 + SHIP_TALL
    const across = overlaps(pocket, [cell.x - SCRAP_WIDE / 2, cell.x + SCRAP_WIDE / 2])
    if (near && across) {
      next.purse += cell.worth
      next.events.push('scrap')
      return false
    }
    return true
  })

  // --- rubble meeting you ----------------------------------------------------
  if (next.mercy === 0) {
    const mine: [number, number] = [next.x - SHIP_WIDE / 2, next.x + SHIP_WIDE / 2]
    for (const rock of next.rubble) {
      const half = SIZE_OF[rock.kind] / 2
      if (Math.abs(rock.y - (1 - SHIP_TALL / 2)) > half + SHIP_TALL / 2) continue
      if (!overlaps(mine, spread(rock))) continue
      next.shields -= 1
      next.status = next.shields > 0 ? 'knocked' : 'lost'
      next.events.push('knock')
      return next
    }
  }

  // --- keeping the sky busy ---------------------------------------------------
  if (next.rubble.length < next.world.traffic && rng.next() < 0.06) send(next, rng)

  // --- arriving ---------------------------------------------------------------
  if (!next.warned && next.progress > 0.85) {
    next.warned = true
    next.events.push('warn')
  }
  if (next.progress >= 1) {
    next.status = 'arrived'
    next.score += 400 + next.broken * 10
    next.events.push('arrive')
  }

  return next
}
