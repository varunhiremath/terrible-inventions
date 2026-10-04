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
  ALIEN_PACE, ALIEN_RELOAD, ALIEN_SWEEP,
  BOLT_SPEED, COOL_RATE, COOL_TO, costOf, FLYABLE, HEAT_PER_BOLT, MAGNET_PULL, MAGNET_REACH,
  MERCY, MOST_OF, MOST_SHIELDS, NEW_KIT,
  SPLIT_EASE, SPLIT_PUSH, SPLIT_REACH, SPLITS_INTO,
  RUSH_OF, SCRAP_OF, SCRAP_WIDE, SEND_RATE, SHIP_SPEED, SHIP_TALL, SHIP_WIDE, SHOT_SPEED, SHOT_WIDE,
  SIZE_OF, STARTING_SHIELDS, TOUGHNESS, WORTH, reloadFor, worldFor,
  type Hazard, type Kit, type Upgrade, type World,
} from './level'

export const FIXED = 1 / 60

export type SpaceEvent =
  | 'shot' | 'hit' | 'broke' | 'knock' | 'arrive' | 'warn' | 'scrap' | 'incoming' | 'jam'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * It lives here rather than next to the sound it maps to, because which of
 * these matters most is a fact about the game and not about the speaker — and
 * because a list in a screen is a list no test can reach. That is not a
 * hypothetical: adding an event and forgetting this took the whole app down
 * with a thrown error on load, twice in one afternoon, in two different games,
 * and the unit suite was green both times. `events.test.ts` reads this now.
 */
export const LOUDEST: readonly SpaceEvent[] = [
  // Something fired at you comes above your own gun and below everything that
  // has already happened: it is the only one of these that is a warning.
  // The gun shutting is a thing that happened *to* you, so it sits with the
  // other warnings rather than with your own gun.
  'arrive', 'knock', 'warn', 'jam', 'broke', 'scrap', 'incoming', 'hit', 'shot',
]

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
  /**
   * How far it has already been thrown sideways, which is also its leash.
   *
   * The drift dies away, and the sum of a dying drift is a number you can
   * work out on paper — but only in the continuous case. Stepping it sixty
   * times a second overshoots that sum by about four per cent, and the sum is
   * what the spawner measured its gaps against. Four per cent is small and
   * the promise is not the kind of thing that is kept to within four per cent.
   *
   * So the distance is counted and stopped at `SPLIT_REACH`, which makes the
   * bound exact whatever the frame rate and whatever anybody later does to
   * the arithmetic.
   */
  thrown: number
  health: number
  /** Counts down after a hit, so a knock reads. */
  flash: number
  /**
   * Where an alien patrols: the middle of its beat, and how far either side.
   *
   * Nought for everything else, which is everything that falls straight. See
   * `ALIEN_SWEEP` — the width is declared when the thing is sent and the
   * fairness check counts all of it from that moment, so a thing that wanders
   * cannot wander into the gap it was measured against.
   */
  home: number
  sweep: number
  /** How far through its beat it is, 0 to 1, and when it next fires. */
  beat: number
  reload: number
}

/**
 * Something an alien has fired.
 *
 * Deliberately a different list from your own bolts rather than a flag on
 * them: every rule in here is about one or the other and never both, and a
 * `mine: boolean` on a bolt would mean remembering to check it in nine places.
 */
export interface Shot {
  id: number
  x: number
  y: number
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
  /** What has been fired at you. */
  shots: Shot[]
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
  /**
   * How hot the gun is, 0 to 1, and whether it has shut itself.
   *
   * It stays shut until the heat is back down to `COOL_TO`, rather than
   * reopening the instant it drops below one — otherwise it stutters on and
   * off a frame at a time at the top, which reads as a fault rather than as a
   * gun that needs a moment.
   */
  heat: number
  jammed: boolean
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
    shots: [],
    scrap: [],
    purse,
    kit,
    score,
    broken: 0,
    shields,
    status: 'flying',
    mercy: 0,
    reload: 0,
    heat: 0,
    jammed: false,
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
    // And nothing already in the air with your name on it.
    shots: [],
    // The scrap that was in the air stays there. Losing a shield already
    // costs enough without also emptying your pockets onto the floor.
    scrap: run.scrap.filter((c) => c.y < 0.45),
  }
}

/**
 * One piece of whatever is out there.
 *
 * A constructor rather than an object literal at each call site, because a
 * literal goes stale the first time a field is added to the type — which is
 * exactly what happened when the aliens arrived and four places had to be
 * taught about a patrol they do not have.
 */
export function newRubble(kind: Hazard, x: number, y: number, sweep = 0): Rubble {
  return {
    id: 0,
    kind,
    x,
    y,
    drift: 0,
    thrown: 0,
    health: TOUGHNESS[kind],
    flash: 0,
    home: x,
    sweep,
    beat: 0,
    reload: ALIEN_RELOAD,
  }
}

/**
 * Where something is, right now.
 *
 * For hitting things with: a bolt meets an alien where the alien actually is.
 */
const spread = (r: Rubble): [number, number] => {
  const half = SIZE_OF[r.kind] / 2
  return [r.x - half, r.x + half]
}

/**
 * Everywhere something will ever be, for as long as it is on the screen.
 *
 * This is the one the fairness check uses, and the difference between the two
 * is the whole reason an alien is allowed to move at all. A gap measured
 * against where a thing is now stops being true the moment it goes anywhere;
 * a gap measured against where it can *get to* is true for ever. The same
 * answer the road reached after breaking it three times.
 */
export const claim = (r: Rubble): [number, number] => {
  const half = SIZE_OF[r.kind] / 2
  /*
   * And everywhere its pieces will ever be.
   *
   * A rock that comes apart is not one thing that stays put, it is three
   * things that end up spread across a band wider than the rock. The gap
   * measured against the rock alone would be true right up until somebody
   * shot it, which is to say true until it mattered.
   *
   * The shards are thrown a bounded distance on purpose (see SPLIT_PUSH), so
   * this is a real number and not an argument for giving up.
   */
  const split = SPLITS_INTO[r.kind]
  const burst = split ? SPLIT_REACH + SIZE_OF[split.kind] / 2 : 0
  return [r.home - r.sweep - half - burst, r.home + r.sweep + half + burst]
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1]

/**
 * The widest clear run across the screen, among everything in a band.
 *
 * This is the measure the whole fairness promise is made in: if it ever drops
 * below what a ship can fly through, the screen has become a wall.
 */
/**
 * The widest clear run across the screen, among everything *where it actually
 * is* right now.
 *
 * The difference between this and `widestGap` is the difference between the
 * promise and the fact. `widestGap` measures against `claim`, so a test built
 * on it cannot catch `claim` being wrong — if the claim under-reports, the gap
 * over-reports, and the check passes while the sky quietly closes. This one
 * reads positions, and a run watched with it the whole way down is the only
 * thing that can tell you the promise was kept.
 */
export function gapNow(rubble: readonly Rubble[], from: number, to: number): number {
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

export function widestGap(rubble: readonly Rubble[], from: number, to: number): number {
  const shut = rubble
    .filter((r) => r.y + SIZE_OF[r.kind] / 2 >= from && r.y - SIZE_OF[r.kind] / 2 <= to)
    // Everywhere it could get to, not where it happens to be this frame.
    .map(claim)
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

  /*
   * Ten attempts at something that fits, re-rolling what it is each time.
   *
   * It used to choose the kind once and then try ten places for it, which is
   * fine while every kind is as easy to place as every other. A comet is not:
   * it comes down quicker than everything else, so it needs a clear run all
   * the way down rather than a gap in one band, and most of the time there
   * is not one. So one roll in six picked a comet, failed ten times, and sent
   * *nothing at all* — and the sky out past Neptune came out emptier than
   * Neptune's, which is how a world with more traffic and a gravity well in it
   * measured as the easiest in the game.
   *
   * Re-rolling makes `traffic` mean what it says again: when the comet will
   * not fit, something else goes instead.
   */
  for (let tries = 0; tries < 10; tries++) {
    const kind = kinds[rng.int(0, kinds.length - 1)]
    const half = SIZE_OF[kind] / 2
    /*
     * An alien needs room for its whole beat, not just for itself, so it is
     * put down somewhere its patrol fits on the screen — and `claim` below
     * counts all of it against the gap from this moment on.
     */
    const sweep = kind === 'alien' ? ALIEN_SWEEP : 0
    const edge = half + sweep
    const x = edge + rng.next() * Math.max(0, 1 - edge * 2)
    const would: Rubble = {
      ...newRubble(kind, x, -half, sweep),
      id: run.nextId,
      // Started part way along, so two of them sent together do not sweep in
      // lockstep like a chorus line.
      beat: rng.next(),
      // And not firing the instant it appears: something that shoots before
      // you have seen it is not a fight, it is a trap.
      reload: ALIEN_RELOAD * (0.6 + rng.next() * 0.6),
    }
    /*
     * Judged over every band this could ever share with something.
     *
     * The promise is about any band the ship meets, and a band is half the
     * screen tall — so two pieces sent a few seconds apart can be perfectly
     * legal on their own and still end up in the same band together. Checking
     * only the top third let exactly that through on Jupiter.
     *
     * Everything that falls at the same pace keeps its distance from
     * everything else for ever, so for those the band it is in now is the only
     * band it will ever be in, and checking that one is enough.
     *
     * A comet is not one of those. It comes down two and a half times quicker,
     * so it will pass through every band below it before it is done — which
     * means the honest question is whether the gap holds against *everything
     * on the screen*, not against its neighbours. The same lesson for the
     * fifth time: a measurement only stays true where nothing moves relative
     * to anything else, so where something does, measure the whole of what it
     * will meet.
     */
    const faster = RUSH_OF[kind] > 1
    const band = faster ? run.rubble : run.rubble.filter((r) => r.y < 0.65)
    if (widestGap([...band, would], -0.2, faster ? 1.1 : 0.65) < FLYABLE) continue

    run.rubble.push({ ...would, id: run.nextId++, drift: 0 })
    return
  }
}

/**
 * Whether a thing can be bought right now, and why not if it cannot.
 *
 * Kept next to `buy` and used by the shop to grey a row out, so the reason a
 * button does nothing is the same reason it looks like it will do nothing.
 */
/** How many of a thing is already aboard, which is what sets the next price. */
export function owned(run: Run, what: Upgrade): number {
  if (what === 'shield') return 0
  if (what === 'rapid') return run.kit.rapid
  if (what === 'twin') return run.kit.twin ? 1 : 0
  if (what === 'pierce') return run.kit.pierce ? 1 : 0
  return run.kit.magnet
}

/** What the next one would cost, which the shop also prints. */
export function priceOf(run: Run, what: Upgrade): number {
  return costOf(what, owned(run, what))
}

export function canBuy(run: Run, what: Upgrade): boolean {
  if (run.purse < priceOf(run, what)) return false
  if (what === 'shield') return run.shields < MOST_SHIELDS
  return owned(run, what) < MOST_OF[what]
}

/** Spends the scrap. Does nothing at all if it cannot be afforded. */
export function buy(run: Run, what: Upgrade): Run {
  if (!canBuy(run, what)) return run
  const paid = { ...run, purse: run.purse - priceOf(run, what) }
  if (what === 'shield') return { ...paid, shields: paid.shields + 1 }
  if (what === 'rapid') return { ...paid, kit: { ...paid.kit, rapid: paid.kit.rapid + 1 } }
  if (what === 'twin') return { ...paid, kit: { ...paid.kit, twin: true } }
  if (what === 'pierce') return { ...paid, kit: { ...paid.kit, pierce: true } }
  return { ...paid, kit: { ...paid.kit, magnet: paid.kit.magnet + 1 } }
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
    shots: run.shots.map((s) => ({ ...s })),
    scrap: run.scrap.map((c) => ({ ...c })),
    seed: (run.seed * 1664525 + 1013904223) >>> 0,
  }

  // --- flying ---------------------------------------------------------------
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  /*
   * And whatever the place out there is doing to you.
   *
   * "Once you have all the upgrades the game becomes easy" — and it does,
   * because every upgrade in this game makes your gun better. By Neptune the
   * gun has stopped being the question, so the far half of the trip asks a
   * different one.
   *
   * A gravity well drags you away from the middle, harder the further out you
   * drift, the way a real one does. You can still go anywhere; you just cannot
   * let go of the stick, and no amount of firepower helps. Near a black hole
   * the edges of the screen are a place you fall into rather than a wall you
   * rest against.
   */
  /*
   * A current, not a slope.
   *
   * The first go pulled you away from the middle, harder the further out you
   * drifted, the way a real well does. Measured, that made the black hole the
   * *easiest* world in the game — because it pins the ship against an edge,
   * and a ship pinned at an edge stops crossing the screen and therefore stops
   * meeting most of what is on it. Five and a half shields lost where Neptune
   * cost thirteen and a half. A difficulty that works by taking the player out
   * of the game is not a difficulty.
   *
   * So it is a crosswind that turns instead: it pushes one way, eases, and
   * pushes back the other, a few times on the way out. You cannot be parked by
   * it and you cannot ignore it — every gap costs more to reach one way and
   * arrives early the other, and no upgrade in this game has anything to say
   * about that, which is the whole point.
   */
  const pull = next.world.pull ?? 0
  /*
   * Held below what the ship can do, which is the difference between hard and
   * unfair. Sagittarius A* asks for 0.95 and the ship steers at 0.85; at six
   * tenths of its speed you can always make headway against the current, just
   * slowly, and slowly is what makes it cost something.
   */
  const MOST_PULL = SHIP_SPEED * 0.6
  /** Turns on the way out. Slow enough to lean into, often enough to matter. */
  const TURNS = 2.5
  const lean =
    pull === 0 ? 0 : Math.sin(next.progress * Math.PI * 2 * TURNS) * Math.min(MOST_PULL, pull)
  next.x = Math.min(
    1 - SHIP_WIDE / 2,
    Math.max(SHIP_WIDE / 2, next.x + (steer * SHIP_SPEED + lean) * dt),
  )
  next.mercy = Math.max(0, next.mercy - dt)
  next.reload = Math.max(0, next.reload - dt)
  next.progress = Math.min(1, next.progress + dt / next.world.seconds)

  // --- shooting -------------------------------------------------------------
  /*
   * Cooling first, so that letting go for a frame is worth something and the
   * heat added below is this frame's firing rather than last frame's.
   */
  if (!input.fire || next.jammed) {
    next.heat = Math.max(0, next.heat - COOL_RATE * dt)
    if (next.jammed && next.heat <= COOL_TO) next.jammed = false
  }

  if (input.fire && !next.jammed && next.reload === 0) {
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
    next.heat += HEAT_PER_BOLT * barrels.length
    if (next.heat >= 1) {
      next.heat = 1
      next.jammed = true
      next.events.push('jam')
    }
  }
  for (const bolt of next.bolts) bolt.y -= BOLT_SPEED * dt
  next.bolts = next.bolts.filter((b) => b.y > -0.05)

  // --- everything falling ----------------------------------------------------
  for (const rock of next.rubble) {
    rock.y += next.world.fall * RUSH_OF[rock.kind] * dt
    if (rock.flash > 0) rock.flash = Math.max(0, rock.flash - dt)

    /*
     * A piece thrown clear of something still carries the throw.
     *
     * It dies away rather than stopping, so the burst opens out and settles
     * instead of turning a corner, and the whole distance it covers is
     * SPLIT_PUSH * SPLIT_EASE — which is what the claim above is told to
     * expect and is the only reason this is allowed to move at all.
     */
    if (rock.drift !== 0) {
      const want = rock.drift * dt
      const room = Math.max(0, SPLIT_REACH - rock.thrown)
      const move = Math.sign(want) * Math.min(Math.abs(want), room)
      rock.x = Math.min(1, Math.max(0, rock.x + move))
      rock.thrown += Math.abs(move)
      rock.drift *= Math.exp(-dt / SPLIT_EASE)
      if (room === 0 || Math.abs(rock.drift) < 0.001) rock.drift = 0
    }

    if (rock.kind !== 'alien') continue
    /*
     * An alien flies its beat and shoots down it.
     *
     * A cosine rather than a bounce between two ends, because a thing that
     * slows at the turn and speeds through the middle reads as something
     * flying and a thing at constant speed reads as something on a rail. It
     * never leaves the stretch `claim` reserved for it when it was sent.
     */
    rock.beat = (rock.beat + ALIEN_PACE * dt) % 1
    rock.x = rock.home + Math.sin(rock.beat * Math.PI * 2) * rock.sweep

    /*
     * And it fires only once it is on the screen and above you, which is the
     * difference between a fight and an ambush: whatever is coming, you can
     * see where it came from.
     */
    rock.reload = Math.max(0, rock.reload - dt)
    if (rock.reload === 0 && rock.y > 0.08 && rock.y < 0.74) {
      rock.reload = ALIEN_RELOAD
      next.shots.push({ id: next.nextId++, x: rock.x, y: rock.y + SIZE_OF.alien / 2 })
      next.events.push('incoming')
    }
  }
  next.rubble = next.rubble.filter((r) => r.y < 1.25)

  // --- and what they have fired -----------------------------------------------
  for (const shot of next.shots) shot.y += SHOT_SPEED * dt
  next.shots = next.shots.filter((s) => s.y < 1.25)

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
        /*
         * And what it came apart into, thrown clear.
         *
         * Born where their parent died, which means the pieces of the thing
         * directly above you arrive directly above you. That is the point of
         * them: the gun stops being an answer to everything and becomes a
         * question about where you are standing.
         */
        const split = SPLITS_INTO[rock.kind]
        if (split) {
          for (let i = 0; i < split.count; i++) {
            const away = split.count === 1 ? 0 : (i / (split.count - 1)) * 2 - 1
            next.rubble.push({
              ...newRubble(split.kind, rock.x, rock.y),
              id: next.nextId++,
              drift: away * SPLIT_PUSH,
              // Its claim was its parent's claim, and the parent's covered
              // this. Keeping the parent's home keeps the sum honest.
              home: rock.home,
            })
          }
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

  /*
   * Shooting down what has been shot at you.
   *
   * Worth having for its own sake — it is the most satisfying thing in any
   * game of this shape — and it is also what keeps the promise honest. An
   * alien's shot is small and slow enough to go round, and if you would rather
   * meet it head on, you can.
   */
  for (const bolt of next.bolts) {
    for (const shot of next.shots) {
      if (shot.y < -1) continue
      if (Math.abs(bolt.x - shot.x) > SHOT_WIDE) continue
      if (Math.abs(bolt.y - shot.y) > SHOT_WIDE) continue
      shot.y = -2
      next.score += 15
      next.events.push('hit')
      if (!bolt.pierces) { bolt.y = -1; break }
    }
  }
  next.bolts = next.bolts.filter((b) => b.y > -0.05)
  next.shots = next.shots.filter((s) => s.y > -1)

  // --- scrap ------------------------------------------------------------------
  for (const cell of next.scrap) {
    cell.y += next.world.fall * dt
    /*
     * A magnet leans it towards you. Safe to let this one move sideways, for
     * the reason nothing else is allowed to: scrap is not a hazard, so no
     * promise about there being a way through is measured against where it is.
     */
    const reach = MAGNET_REACH[Math.min(MAGNET_REACH.length - 1, next.kit.magnet)]
    if (reach > 0 && Math.abs(next.x - cell.x) <= reach) {
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
    for (const shot of next.shots) {
      if (Math.abs(shot.y - (1 - SHIP_TALL / 2)) > SHOT_WIDE / 2 + SHIP_TALL / 2) continue
      if (!overlaps(mine, [shot.x - SHOT_WIDE / 2, shot.x + SHOT_WIDE / 2])) continue
      next.shields -= 1
      next.status = next.shields > 0 ? 'knocked' : 'lost'
      next.events.push('knock')
      return next
    }
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
  if (next.rubble.length < next.world.traffic && rng.next() < (next.world.rate ?? SEND_RATE)) {
    send(next, rng)
  }

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
