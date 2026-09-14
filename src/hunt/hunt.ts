import { makeRng, type Rng } from '../engine/rng'
import { fairness, nextRoom, revealUntilFair, type Rule } from './rules'

/**
 * One chase.
 *
 * The player reads the trail, works out the rule, and sets a trap on the room
 * it will move to next. A miss is not a punishment: the creature moves on and
 * the trail grows, so the evidence strengthens and the answer becomes more
 * determined. Persistence always ends in a catch, which is what makes it fair
 * to attach a real reward to catching.
 */

export interface HuntState {
  /** Rooms in play. Grows as the house opens up. */
  rooms: number
  rule: Rule
  /** Where it has been, oldest first. The player's only evidence. */
  trail: number[]
  trapRoom: number | null
  misses: number
  caught: boolean
}

export function ruleFor(rating: number, rooms: number, rng: Rng): Rule {
  // Jumps are bounded by the house. A step equal to the room count wraps to
  // nothing and the creature would sit still forever; a step larger than the
  // house is just a smaller step wearing a disguise.
  const top = Math.max(2, rooms - 1)
  const span = (lo: number, hi: number) => rng.int(Math.min(lo, top), Math.min(hi, top))

  if (rating < 900) return { kind: 'step', d: span(2, 3) }
  if (rating < 1150) return { kind: 'step', d: rng.next() < 0.5 ? span(3, 5) : -span(2, 4) }
  if (rating < 1400) return { kind: 'alternate', a: span(2, 5), b: -span(1, 3) }
  if (rating < 1700) return { kind: 'growStep', start: span(1, 3), grow: span(1, 2) }
  if (rating < 2000) return { kind: 'multiply', r: span(2, 3) }
  return { kind: 'fibStep', first: span(1, 2), second: span(1, 3) }
}

/**
 * A chase worth having visits a real spread of rooms.
 *
 * "Does it move at all?" is too weak a test. A step that shares a factor with
 * the room count gives a short cycle — three rooms and a step of three is
 * 6, 3, 6, 3 forever — which technically moves while offering nothing to work
 * out. Three distinct rooms is the floor for there being a pattern at all.
 */
function movesAround(trail: readonly number[], rooms: number): boolean {
  return new Set(trail).size >= Math.min(3, rooms)
}

export function startHunt(rating: number, rooms: number, seed: number): HuntState {
  // Re-roll rather than serve a degenerate chase. Cheap, and it means callers
  // never have to think about which rules collapse in a small house.
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = makeRng(seed + attempt * 6151)
    const rule = ruleFor(rating, rooms, rng)
    const start = rng.int(1, rooms)
    const trail = revealUntilFair(rule, start, rooms)

    if (movesAround(trail, rooms)) {
      return { rooms, rule, trail, trapRoom: null, misses: 0, caught: false }
    }
  }

  const fallback: Rule = { kind: 'step', d: 1 }
  return {
    rooms,
    rule: fallback,
    trail: revealUntilFair(fallback, 1, rooms),
    trapRoom: null,
    misses: 0,
    caught: false,
  }
}

export function setTrap(state: HuntState, room: number): HuntState {
  if (state.caught) return state
  return { ...state, trapRoom: room }
}

/** Where it is actually going. Only consulted once the trap is set. */
export function actualNext(state: HuntState): number {
  return nextRoom(state.rule, state.trail, state.rooms)
}

export function springTrap(state: HuntState): HuntState {
  if (state.caught || state.trapRoom === null) return state

  const moved = actualNext(state)
  if (moved === state.trapRoom) return { ...state, caught: true, trail: [...state.trail, moved] }

  // Missing hands the player one more term of the sequence.
  return { ...state, trail: [...state.trail, moved], trapRoom: null, misses: state.misses + 1 }
}

/** True when the evidence on the table points at exactly one room. */
export function answerIsForced(state: HuntState): boolean {
  return fairness(state.trail, state.rooms).forced
}

/** How many rooms are open at a given number of catches. Starts small, grows. */
export function roomsUnlocked(catches: number): number {
  // Six to start with. Four leaves so little room that most rules collapse into
  // "it moves along one", which is not worth anybody's time.
  return Math.min(10, 6 + catches)
}
