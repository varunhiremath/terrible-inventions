/**
 * What the two devices actually say to each other.
 *
 * The host runs the race and the guest drives one car in it. That split is not
 * arbitrary: the road's simulation is already a pure function of its inputs,
 * and it would be perfectly possible to run it on both devices and exchange
 * only the button presses — which is how this sort of thing is usually done
 * and costs almost no bandwidth at all.
 *
 * It is not done that way here, and the reason is worth writing down. Lockstep
 * needs both machines to compute bit-for-bit identical results forever, and
 * the road's racers use `Math.sin` to put a wobble on their pace. The IEEE
 * standard pins down addition, multiplication and square root across every
 * platform; it does not pin down sine. An iPhone and an Android phone can
 * disagree in the last bit, once, and from that moment the two people are
 * watching different races on the same screen with no way to tell.
 *
 * So one machine is right by definition and says what happened. The guest
 * sends buttons and draws what it is told. It costs a few kilobytes a second,
 * which on the network this runs over is nothing, and it cannot drift.
 */
import type { Run } from '../road/run'
import type { Input } from '../road/run'

/** Buttons, guest to host, as often as they change. */
export interface Buttons {
  t: 'in'
  in: Input
}

/** The world, host to guest. */
export interface Frame {
  t: 'st'
  /** The run, minus the parts the guest has no use for. */
  run: Shared
}

/** The guest has closed the race down. */
export interface Bye {
  t: 'bye'
}

export type Message = Buttons | Frame | Bye

/**
 * The run as it goes down the wire.
 *
 * Two things are left out and both of them matter. `trail` is a few hundred
 * numbers that grow all race and exist only so a drive can be replayed later,
 * which is the host's business. `events` is the list of things that happened
 * in one step — a crash, a horn, a can taken — and it is consumed by whoever
 * steps the simulation; sending it would have the guest replay the host's
 * sound effects a frame late and out of order.
 */
export type Shared = Omit<Run, 'trail' | 'events'>

export function shareable(run: Run): Shared {
  const { trail: _trail, events: _events, ...rest } = run
  return rest
}

/**
 * How often the host says where everything is.
 *
 * Twenty a second, with the guest drawing the positions between. The road is
 * drawn at sixty and interpolates between simulation steps already, so this is
 * the same trick one layer out. Sending sixty would be three times the traffic
 * to hide a difference nobody can see.
 */
export const FRAMES_PER_SECOND = 20

/**
 * Where something was between two frames.
 *
 * Straight lines. A car on a road is going one way at a fairly constant speed
 * and fifty milliseconds is not long enough for anything cleverer to pay off.
 */
export function between(a: number, b: number, part: number): number {
  return a + (b - a) * part
}

/**
 * Two frames of the world, blended.
 *
 * The guest holds the last two and draws somewhere between them, which is a
 * frame behind what the host knows. That lag is the price of not drifting, and
 * at fifty milliseconds it is under the threshold of anybody noticing on a
 * road where the cars are the size of a thumbnail.
 */
export function blend(older: Shared, newer: Shared, part: number): Shared {
  const p = Math.max(0, Math.min(1, part))
  const wasById = new Map(older.racers.map((r) => [r.id, r]))
  const carById = new Map(older.cars.map((c) => [c.id, c]))
  return {
    ...newer,
    distance: between(older.distance, newer.distance, p),
    lane: between(older.lane, newer.lane, p),
    clock: between(older.clock, newer.clock, p),
    racers: newer.racers.map((racer) => {
      const was = wasById.get(racer.id)
      // A car that was not in the last frame has only just appeared, so there
      // is nothing to blend from and its own position is the best there is.
      if (!was) return racer
      return { ...racer, y: between(was.y, racer.y, p), lane: between(was.lane, racer.lane, p) }
    }),
    cars: newer.cars.map((car) => {
      const was = carById.get(car.id)
      if (!was) return car
      return { ...car, y: between(was.y, car.y, p), lane: between(was.lane, car.lane, p) }
    }),
  }
}
