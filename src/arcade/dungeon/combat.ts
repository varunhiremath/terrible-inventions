/**
 * Sword fighting.
 *
 * A duel here is not a scramble of button presses. It is a conversation of
 * four moves — advance, retreat, strike, parry — where each one takes a fixed
 * number of frames you are committed to, exactly as movement does. That is
 * what makes a guard a puzzle rather than an obstacle: you are not trying to
 * out-click him, you are trying to make him swing at the wrong moment.
 *
 * A strike lands on one particular frame. If the other man is parrying on that
 * frame it is turned aside; if he is not, it costs him a chevron. So the whole
 * game is timing, and a better guard is one who guesses right more often and
 * recovers sooner — not one who does more damage.
 *
 * Pure, and driven by a roll passed in from outside, so a fight replays
 * identically in a test.
 */

export type Stance = 'ready' | 'strike' | 'parry' | 'advance' | 'retreat' | 'hurt' | 'dead'

export interface Fighter {
  col: number
  facing: 1 | -1
  health: number
  maxHealth: number
  stance: Stance
  frame: number
  /** Frames until a guard chooses again. The prince's is always zero. */
  think: number
  /** 0 is a doorman, 4 is the vizier's best. */
  skill: number
}

/** How long each move takes, and when a strike actually connects. */
export const TIMING = {
  strike: 7,
  /** The frame of a strike on which the blade arrives. */
  strikeLands: 4,
  parry: 9,
  advance: 5,
  retreat: 5,
  hurt: 8,
} as const

/** How far apart two fighters have to be for a blade to reach. */
export const REACH = 1.6
/** Closer than this and neither can swing properly, so they step apart. */
export const TOO_CLOSE = 0.9
/** A guard notices you from this far along the same floor. */
export const NOTICE = 5

export const FULL_HEALTH = 3

export function newFighter(col: number, facing: 1 | -1, skill: number, health = FULL_HEALTH): Fighter {
  return {
    col,
    facing,
    health,
    maxHealth: health,
    stance: 'ready',
    frame: 0,
    think: 0,
    skill,
  }
}

export type Move = 'strike' | 'parry' | 'advance' | 'retreat' | 'none'

/** Whether a fighter can be given a new order this frame. */
export function canAct(fighter: Fighter): boolean {
  return fighter.stance === 'ready' && fighter.health > 0
}

function begin(fighter: Fighter, stance: Stance): Fighter {
  return { ...fighter, stance, frame: 0 }
}

/**
 * How a guard of this skill plays.
 *
 * The numbers are a personality rather than a difficulty dial: a poor guard
 * swings wildly and leaves himself open, a good one waits, parries most of
 * what comes at him, and punishes a missed swing. Raising skill makes him
 * harder by making him *better*, which is the only kind of harder worth having.
 *
 * @param roll 0 to 1
 */
export function guardChoice(
  guard: Fighter,
  distance: number,
  opponentStriking: boolean,
  roll: number,
): Move {
  if (!canAct(guard)) return 'none'

  // Someone swinging at him: parry if he is good enough to see it coming.
  if (opponentStriking && distance <= REACH) {
    const blocks = 0.25 + guard.skill * 0.17
    return roll < blocks ? 'parry' : roll < blocks + 0.15 ? 'retreat' : 'strike'
  }

  if (distance > REACH) return roll < 0.8 ? 'advance' : 'none'
  if (distance < TOO_CLOSE) return 'retreat'

  // In range and nothing incoming. Better guards wait to be come at.
  const patience = 0.2 + guard.skill * 0.1
  if (roll < patience) return 'parry'
  if (roll < patience + 0.55) return 'strike'
  return roll < patience + 0.75 ? 'retreat' : 'none'
}

export interface Exchange {
  attacker: Fighter
  defender: Fighter
  /** What happened, for the noise and the flash. */
  event: 'none' | 'hit' | 'parried' | 'miss'
}

/**
 * Advances one fighter a frame, and resolves a blade if this is the frame it
 * arrives on.
 *
 * Both fighters are handed in because a strike is not a thing that happens to
 * one person. Resolving it inside whoever moved first would let the winner be
 * decided by array order.
 */
export function stepFighter(
  attacker: Fighter,
  defender: Fighter,
  gap: number,
): Exchange {
  if (attacker.health <= 0) {
    return { attacker: { ...attacker, stance: 'dead' }, defender, event: 'none' }
  }

  const next = { ...attacker, frame: attacker.frame + 1 }
  let hurt = defender
  let event: Exchange['event'] = 'none'

  if (next.stance === 'strike' && next.frame === TIMING.strikeLands) {
    if (gap > REACH) {
      event = 'miss'
    } else if (defender.stance === 'parry') {
      event = 'parried'
    } else if (defender.health > 0) {
      const health = defender.health - 1
      hurt = health <= 0
        ? { ...defender, health: 0, stance: 'dead', frame: 0 }
        : { ...defender, health, stance: 'hurt', frame: 0 }
      event = 'hit'
    }
  }

  const length = next.stance === 'ready' || next.stance === 'dead' ? Infinity : TIMING[next.stance as keyof typeof TIMING] ?? 1
  if (next.frame >= length) {
    next.frame = 0
    next.stance = 'ready'
  }

  if (next.think > 0) next.think -= 1

  return { attacker: next, defender: hurt, event }
}

/** Starts a move, if the fighter is in any state to start one. */
export function order(fighter: Fighter, move: Move): Fighter {
  if (move === 'none' || !canAct(fighter)) return fighter
  if (move === 'advance') return { ...begin(fighter, 'advance'), col: fighter.col + fighter.facing * 0.5 }
  if (move === 'retreat') return { ...begin(fighter, 'retreat'), col: fighter.col - fighter.facing * 0.5 }
  return begin(fighter, move)
}
