import type { PowerUps } from './maze/game'

/**
 * Where maths buys power.
 *
 * Deliberately not a toll. Solving a problem does not buy permission to keep
 * playing — it buys an advantage, and a harder problem buys a better one. The
 * evidence on undermining intrinsic motivation turns on whether a reward is
 * contingent on *performance*, so tying the prize to difficulty rather than to
 * mere participation is the part that matters.
 *
 * Almost all of it is optional. A player who enjoys the problems gets to walk
 * into a level considerably stronger, which rewards exactly the behaviour worth
 * rewarding. Only a game over costs a compulsory one, and that is the coin slot.
 */

export interface ShopItem {
  id: string
  name: string
  blurb: string
  /** Difficulty shown to the player. More stars, better prize. */
  stars: 1 | 2 | 3
  /** Offset from the player's own rating. Negative is easier than usual. */
  ratingDelta: number
  apply: (powerUps: PowerUps) => PowerUps
}

export const SHOP: readonly ShopItem[] = [
  {
    id: 'life',
    name: 'Spare life',
    blurb: 'One more go before {papa} gets to gloat.',
    stars: 1,
    ratingDelta: -250,
    apply: (p) => ({ ...p, spareLives: p.spareLives + 1 }),
  },
  {
    id: 'freeze',
    name: 'Freeze',
    blurb: 'Stops all four of them dead for four seconds. Use it when cornered.',
    stars: 2,
    ratingDelta: 0,
    apply: (p) => ({ ...p, freezes: p.freezes + 1 }),
  },
  {
    id: 'pellet',
    name: 'Stronger pellets',
    blurb: 'Power pellets last half as long again, for the whole game.',
    stars: 2,
    ratingDelta: 60,
    apply: (p) => ({ ...p, pelletBoost: p.pelletBoost + 0.5 }),
  },
  {
    id: 'twoLives',
    name: 'Two spare lives',
    blurb: 'For when you mean it.',
    stars: 3,
    ratingDelta: 220,
    apply: (p) => ({ ...p, spareLives: p.spareLives + 2 }),
  },
]

export function itemById(id: string): ShopItem | undefined {
  return SHOP.find((item) => item.id === id)
}

/** What rating to generate a problem at, for a given shopper. */
export function ratingFor(item: ShopItem, playerRating: number): number {
  return playerRating + item.ratingDelta
}

/** The compulsory one, after a game over. Kept easy — it is a coin slot, not a test. */
export const CONTINUE_DELTA = -300
