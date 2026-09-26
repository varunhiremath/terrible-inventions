/**
 * Can this level be finished at all?
 *
 * Hand-drawn platform levels go wrong quietly. A ledge a few pixels too high,
 * a trophy walled in, a door across a gap nothing can cross — none of it looks
 * wrong on the page, and all of it is discovered by a child who gets stuck and
 * decides the game is broken.
 *
 * So the same trick the maze uses: search the level rather than trust the
 * drawing. The difference is that a maze is a graph and a platformer is not —
 * where Dave can get to depends on how fast he is falling and which way he is
 * already going. So the search runs the real physics, over a coarsened version
 * of the real state, and reports whether the trophy and then the door can be
 * reached.
 *
 * Coarsened, so this proves less than it looks like it proves: finding a route
 * means one exists, but failing to find one means only that none was found at
 * this resolution. It is a smoke alarm, not a guarantee.
 */
import { TILE, tileAt, type Level } from './level'
import { JET_SECONDS, NO_INPUT, bodyTiles, newDave, step, type Dave, type Input } from './physics'

/**
 * How long each decision lasts. A player is not deciding every frame either.
 *
 * It has to be long enough that one decision moves Dave further than the
 * search's own resolution, or the whole thing seizes up: at a twentieth of a
 * second he travels a third of a tile, positions round to halves, and every
 * other state collapses onto the one before it. The chain of states that leads
 * anywhere gets thrown away as a duplicate and the search stops dead four
 * inches from where it started. It reported all ten levels unsolvable in three
 * milliseconds, which is the tell: a real search into a real level is not
 * cheap.
 */
const DECISION = 1 / 10
/** Physics ticks inside one decision. */
const TICK = 1 / 60

/** Every combination worth trying at a decision point. */
const MOVES: Input[] = [
  { ...NO_INPUT },
  { ...NO_INPUT, left: true },
  { ...NO_INPUT, right: true },
  { ...NO_INPUT, jump: true },
  { ...NO_INPUT, jump: true, left: true },
  { ...NO_INPUT, jump: true, right: true },
  { ...NO_INPUT, up: true },
  { ...NO_INPUT, up: true, left: true },
  { ...NO_INPUT, up: true, right: true },
  { ...NO_INPUT, down: true },
]

/**
 * Two states that round to the same key are treated as the same.
 *
 * Two resolutions, because the two searches want different things.
 *
 * `solve` only has to find one route to the door, so it can be coarse and
 * quick: half a tile, and horizontal speed ignored entirely.
 *
 * `reachableTiles` has to be believed when it says a diamond cannot be got,
 * and at that resolution it could not be. Merging a standing Dave with a
 * sprinting one made its answers move around: adding a single platform in one
 * corner of level three changed the reported reachability of three diamonds
 * fifteen tiles away, in both directions. A check whose answer depends on what
 * you edited somewhere else is not a check. So it gets a third of a tile and
 * real speeds, and costs a few seconds a level for it.
 */
function keyOf(dave: Dave, trophy: boolean, fine = false): string {
  return [
    Math.round(dave.x * (fine ? 3 : 2)),
    Math.round(dave.y * (fine ? 3 : 2)),
    fine ? Math.round(dave.vx) : 0,
    Math.round(dave.vy / (fine ? 1 : 2)),
    dave.onGround ? 1 : 0,
    dave.hasJetpack ? Math.round(dave.fuel / 2) : -1,
    trophy ? 1 : 0,
  ].join(',')
}

function tilesUnder(level: Level, dave: Dave): string[] {
  return bodyTiles(dave).map((t) => tileAt(level, t.x, t.y))
}

export interface Solution {
  /** Whether a route from the start, through the trophy, to the door was found. */
  solvable: boolean
  /** Whether the trophy alone could be reached. */
  trophy: boolean
  /** How many distinct states were looked at. */
  explored: boolean | number
  /** True if the search gave up rather than finished. */
  gaveUp: boolean
}

/**
 * @param budget how many states to look at before giving up
 */
export function solve(level: Level, budget = 400000): Solution {
  const start = newDave(level.start)
  const seen = new Set<string>([keyOf(start, false)])
  let frontier: { dave: Dave; trophy: boolean }[] = [{ dave: start, trophy: false }]
  let explored = 0
  let reachedTrophy = false

  while (frontier.length > 0 && explored < budget) {
    const next: { dave: Dave; trophy: boolean }[] = []

    for (const node of frontier) {
      for (const move of MOVES) {
        let dave = node.dave
        for (let t = 0; t < DECISION - 1e-9; t += TICK) {
          dave = step(level, dave, move, TICK)
          if (!dave.alive) break
        }
        if (!dave.alive) continue

        let trophy = node.trophy
        const under = tilesUnder(level, dave)
        // The jetpack is part of the route on some levels, so the search has
        // to be allowed to pick one up.
        if (under.includes(TILE.JETPACK)) {
          dave = { ...dave, hasJetpack: true, fuel: JET_SECONDS }
        }
        if (under.includes(TILE.TROPHY)) {
          trophy = true
          reachedTrophy = true
        }
        if (trophy && under.includes(TILE.DOOR)) {
          return { solvable: true, trophy: true, explored, gaveUp: false }
        }

        const id = keyOf(dave, trophy)
        if (seen.has(id)) continue
        seen.add(id)
        explored++
        next.push({ dave, trophy })
      }
    }
    frontier = next
  }

  return {
    solvable: false,
    trophy: reachedTrophy,
    explored,
    gaveUp: explored >= budget,
  }
}

/**
 * Every tile Dave's body can occupy, playing the level for real.
 *
 * `solve` answers one question — can the trophy and then the door be reached —
 * and says nothing about anything else in the level. So ninety of the pickups
 * across the ten levels sat where nobody could ever touch them, and the only
 * way anyone found out was by trying: "some diamonds are unreachable. That gap
 * is too small for him to enter?"
 *
 * Same caveat as `solve`: the search is coarsened, so a tile turning up here
 * means it can be reached, and a tile missing means only that this search did
 * not find a way at this resolution.
 */
export function reachableTiles(
  level: Level,
  budget = 500_000,
  decision = DECISION,
): Set<string> {
  const start = newDave(level.start)
  const seen = new Set<string>([keyOf(start, false, true)])
  let frontier: Dave[] = [start]
  const tiles = new Set<string>()
  let explored = 0

  while (frontier.length > 0 && explored < budget) {
    const next: Dave[] = []
    for (const node of frontier) {
      for (const move of MOVES) {
        let dave = node
        for (let t = 0; t < decision - 1e-9; t += TICK) {
          dave = step(level, dave, move, TICK)
          if (!dave.alive) break
        }
        if (!dave.alive) continue
        for (const tile of bodyTiles(dave)) tiles.add(`${tile.x},${tile.y}`)

        const key = keyOf(dave, false, true)
        if (seen.has(key)) continue
        seen.add(key)
        explored += 1
        next.push(dave)
      }
    }
    frontier = next
  }
  return tiles
}
