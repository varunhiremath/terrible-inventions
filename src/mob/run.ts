/**
 * The swarm, simulated.
 *
 * Pure and fixed-step like the rest of the games here: `step(run, input, dt)`
 * returns the next run and never touches the outside world, so the whole of it
 * can be played by a test at whatever speed a test likes.
 *
 * Two things in here are worth more care than they look.
 *
 * The first is that a shot is spent on exactly one thing. It damages a monster
 * or it chips a crate, never both and never two monsters — which is what makes
 * the decision in this game a real cost rather than a free bonus. Every hit
 * that goes into a crate is a hit that did not go into something walking at
 * you, and the whole game is whether that trade pays off before they arrive.
 *
 * The second is `arriveIn`, the number at the top of the screen. It is the
 * other half of the sum, so it has to be honest: it reads the real position and
 * the real pace of the monster that is actually nearest, including the breed
 * that walks faster than the rest. A countdown that is approximately right
 * teaches arithmetic that is approximately wrong.
 */
import {
  CRATE_H, CRATE_W, GUN_SPEED, GUN_W, LANE, LINE_Y, LIVES, MON_H, SHOT_SPEED, SHOT_W, TALL,
  MON_W, TOP_RUNG, cratePair, crateSpeed, gunAt, waveFor, walkSpeed,
  type Crate, type Dice, type Gun, type Monster,
} from './level'

export const FIXED = 1 / 120

export type MobEvent =
  | 'fire' | 'hit' | 'killed' | 'chip' | 'opened' | 'crates' | 'lost' | 'missed'
  | 'through' | 'cleared' | 'over'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, like every other game in here:
 * `events.test.ts` reads this list and the event union together, because an
 * event missing from the list is never the loudest thing in any frame and so is
 * silent for ever with nothing to notice.
 */
export const LOUDEST: readonly MobEvent[] = [
  'over', 'cleared', 'through', 'lost', 'opened', 'missed', 'killed', 'crates', 'chip', 'hit',
  'fire',
]

export type Status = 'playing' | 'lost' | 'cleared' | 'over'

export interface Shot {
  id: number
  x: number
  y: number
}

/**
 * A number floating where something happened.
 *
 * Not decoration. The damage coming off a monster is how a player learns what
 * their gun is worth, and the line a crate says when it opens is the only place
 * the new gun is explained. Both are arithmetic, said out loud, in the place
 * where it happened.
 */
export interface Said {
  id: number
  /** What it came out of, so one thing never stacks two labels. */
  from: number
  x: number
  y: number
  text: string
  tint: string
  life: number
  big: boolean
}

export interface Input {
  /** Where you are being asked to go, in lane units. Null means stay. */
  to: number | null
  left: boolean
  right: boolean
}

export const NO_INPUT: Input = { to: null, left: false, right: false }

export interface Run {
  level: number
  status: Status
  score: number
  /** Monsters seen off, for the whole run. */
  killed: number
  lives: number
  /** Where you are along the lane. */
  gun: number
  /** Which rung of the gun ladder you are on. */
  rung: number
  shots: Shot[]
  crowd: Monster[]
  crates: Crate[]
  says: Said[]
  /** Seconds until the next shot. */
  cool: number
  clock: number
  events: MobEvent[]
  seed: number
  nextId: number
}

// --- the dice ---------------------------------------------------------------

function makeDice(seed: number): Dice {
  let state = (seed * 2654435761) >>> 0 || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return { next, int, pick: (items) => items[int(0, items.length - 1)] }
}

const stir = (seed: number): number => (seed * 1103515245 + 12345) >>> 0

// --- starting ---------------------------------------------------------------

/** The gun in hand. Derived, so there is one ladder and nowhere to drift from it. */
export const weaponOf = (run: Run): Gun => gunAt(run.rung)

export function newRun(
  level = 1, lives = LIVES, score = 0, rung = 0, seed = 1, killed = 0,
): Run {
  const dice = makeDice(seed)
  let id = 1
  const nextId = () => id++
  const crowd = waveFor(level, dice, nextId)

  return {
    level,
    status: 'playing',
    score,
    killed,
    lives,
    gun: LANE / 2,
    rung,
    shots: [],
    crowd,
    // The first pair is already on its way down when a wave opens: the decision
    // should be in front of the player before the shooting settles into a
    // rhythm, not thirty seconds later.
    crates: cratePair(level, rung, dice, nextId),
    says: [],
    cool: 0.2,
    clock: 0,
    events: [],
    seed: stir(seed),
    nextId: id,
  }
}

/** The next wave, keeping the score, the gun, the tally and what is left of the lives. */
export const nextLevel = (run: Run): Run =>
  newRun(run.level + 1, run.lives, run.score, run.rung, run.seed + 1, run.killed)

/**
 * Carrying on after one got through.
 *
 * The crowd is pushed back up the lane rather than rebuilt: a wave that starts
 * again from the top after every life would make a late wave unloseable by
 * attrition, and one that carries on from where it was would put the next
 * monster over the line half a second after you pressed the button.
 */
export function serve(run: Run): Run {
  return {
    ...run,
    status: 'playing',
    shots: [],
    says: [],
    cool: 0.2,
    crowd: run.crowd.map((m) => ({ ...m, y: m.y - PUSH_BACK })),
    events: [],
  }
}

/**
 * How far the crowd is pushed back when one gets through.
 *
 * Measured rather than guessed on the game this replaced: at three units a
 * monster that crossed the line was back over it four seconds later, and a good
 * player was losing ten lives a minute — not difficulty, a death spiral.
 */
const PUSH_BACK = 6

/** How many monsters are still standing, for the top of the screen. */
export const standing = (run: Run): number => run.crowd.length

/**
 * Seconds until the nearest monster reaches the line.
 *
 * The other half of every decision in this game, so it is computed from the
 * real thing rather than estimated: whichever monster is nearest, at its own
 * breed's pace. Infinity when the lane is clear, which the screen draws as a
 * dash rather than a number.
 */
export function arriveIn(run: Run): number {
  let soonest = Infinity
  for (const mon of run.crowd) {
    const togo = LINE_Y - (mon.y + MON_H / 2)
    const pace = walkSpeed(run.level) * mon.pace
    soonest = Math.min(soonest, Math.max(0, togo) / pace)
  }
  return soonest
}

/** What a crate still costs, in seconds at the gun you are holding now. */
export const costOf = (crate: Crate, weapon: Gun): number =>
  (crate.need - crate.got) * weapon.every

// --- the lane ---------------------------------------------------------------

const clampGun = (x: number): number => Math.max(GUN_W / 2, Math.min(LANE - GUN_W / 2, x))

const monBox = (mon: Monster): [number, number, number, number] => [
  mon.x - MON_W / 2, mon.y - MON_H / 2, mon.x + MON_W / 2, mon.y + MON_H / 2,
]

const crateBox = (crate: Crate): [number, number, number, number] => [
  crate.x - CRATE_W / 2, crate.y - CRATE_H / 2, crate.x + CRATE_W / 2, crate.y + CRATE_H / 2,
]

const inBox = (box: [number, number, number, number], x: number, y: number): boolean =>
  x + SHOT_W / 2 > box[0] && x - SHOT_W / 2 < box[2] && y <= box[3] && y >= box[1]

// --- a step -----------------------------------------------------------------

export function step(run: Run, input: Input, dt: number): Run {
  if (run.status !== 'playing') return { ...run, events: [] }

  const next: Run = {
    ...run,
    shots: run.shots.map((s) => ({ ...s })),
    crowd: run.crowd.map((m) => ({ ...m })),
    crates: run.crates.map((c) => ({ ...c })),
    says: run.says.map((s) => ({ ...s })),
    events: [],
  }
  next.seed = stir(next.seed)
  next.clock += dt

  // --- you ---
  if (input.to !== null) {
    const want = clampGun(input.to)
    const most = GUN_SPEED * dt
    const gap = want - next.gun
    next.gun = Math.abs(gap) <= most ? want : next.gun + Math.sign(gap) * most
  } else if (input.left !== input.right) {
    next.gun = clampGun(next.gun + (input.right ? 1 : -1) * GUN_SPEED * dt)
  }

  // --- firing ---
  const weapon = gunAt(next.rung)

  next.cool -= dt
  if (next.cool <= 0) {
    next.cool += weapon.every
    next.shots.push({ id: next.nextId++, x: next.gun, y: TALL - 1.7 })
    next.events.push('fire')
  }

  // --- the crates drift down, and a new pair arrives ---
  const drift = crateSpeed(next.level) * dt
  for (const crate of next.crates) {
    crate.y += drift
    crate.flash = Math.max(0, crate.flash - dt)
  }
  // Lost at the line, on the same rule as the crowd: once it is level with
  // you it is behind everything you could have shot it with.
  const missed = next.crates.filter((crate) => crate.y + CRATE_H / 2 >= LINE_Y)
  if (missed.length > 0) {
    next.crates = next.crates.filter((crate) => !missed.includes(crate))
    // Only worth a noise if some work went into it. A crate nobody touched
    // drifting past is not a loss, it is a decision that was made.
    if (missed.some((crate) => crate.got > 0)) next.events.push('missed')
  }

  /*
   * No crates arrive mid-wave: the pair that comes with the wave is the lot.
   *
   * They used to arrive on a timer, which meant a crate was in front of the
   * crowd most of the time and a run climbed two rungs a wave while the wave
   * got one rung harder — so by the fifth minute the gun was forty times
   * stronger than anything walking at it and nothing could go wrong. One pair a
   * wave means the choice is made once, properly, and it is the only way up.
   */

  // --- the shots go up, into the first thing they meet ---
  /*
   * Walked along their path in slices rather than teleported to the end of it.
   * A shot covers an eighth of a unit in a frame and a monster is a unit and a
   * half tall, so at any step much longer than a frame a whole monster fits
   * between where a shot was and where it is next, and the shot sails through
   * the crowd without touching anything.
   */
  const rise = SHOT_SPEED * dt
  const slice = Math.min(MON_H, CRATE_H) * 0.5
  const dead = new Set<number>()

  for (const shot of next.shots) {
    let togo = rise

    while (togo > 0 && !dead.has(shot.id)) {
      const move = Math.min(togo, slice)
      togo -= move
      shot.y -= move

      // Crates first: they hang lower than the crowd they came down through, so
      // a shot meets one on the way to the monsters behind it.
      let spent = false
      for (const crate of next.crates) {
        if (!inBox(crateBox(crate), shot.x, shot.y)) continue
        crate.got += 1
        crate.flash = 0.2
        spent = true
        if (crate.got >= crate.need) {
          next.rung = Math.min(TOP_RUNG, next.rung + crate.step)
          next.score += 25
          next.events.push('opened')
          // The other crate of the pair goes with it: the choice was made, and
          // leaving the dear one hanging there would turn "which" into "both".
          for (const other of next.crates) if (other.id !== crate.id) dead.add(other.id)
          next.says.push({
            id: next.nextId++,
            from: crate.id,
            x: crate.x,
            y: crate.y,
            text: gunAt(next.rung).name.toUpperCase(),
            tint: '#ffd166',
            life: 2,
            big: true,
          })
          dead.add(crate.id)
        } else {
          next.events.push('chip')
        }
        break
      }
      if (spent) {
        dead.add(shot.id)
        break
      }

      for (const mon of next.crowd) {
        if (dead.has(mon.id)) continue
        if (!inBox(monBox(mon), shot.x, shot.y)) continue

        const took = Math.min(mon.health, gunAt(next.rung).hit)
        mon.health -= took
        mon.flash = 0.18
        next.score += took
        // One number per monster, replaced as the hits land. Without this a
        // quick gun stacks four of them on the same monster in a tenth of a
        // second and the crowd disappears behind its own arithmetic.
        next.says = next.says.filter((said) => said.from !== mon.id)
        next.says.push({
          id: next.nextId++,
          from: mon.id,
          // Off to one side and above, so it does not sit on the number the
          // monster is wearing — which is the one a player is reading.
          x: mon.x + 0.85,
          y: mon.y - 0.85,
          text: `-${took}`,
          tint: '#ffe08a',
          life: 0.5,
          big: false,
        })
        if (mon.health <= 0) {
          dead.add(mon.id)
          next.killed += 1
          next.score += 10
          next.events.push('killed')
        } else {
          next.events.push('hit')
        }
        spent = true
        break
      }

      if (spent || shot.y < -0.6) dead.add(shot.id)
    }
  }

  next.shots = next.shots.filter((shot) => !dead.has(shot.id))
  next.crates = next.crates.filter((crate) => !dead.has(crate.id))
  next.crowd = next.crowd.filter((mon) => !dead.has(mon.id) && mon.health > 0)

  // --- the crowd walks down ---
  const walk = walkSpeed(next.level) * dt
  let through = false
  for (const mon of next.crowd) {
    mon.y += walk * mon.pace
    mon.flash = Math.max(0, mon.flash - dt)
    if (mon.y + MON_H / 2 >= LINE_Y) through = true
  }

  // --- the labels fade ---
  for (const said of next.says) {
    said.life -= dt
    said.y -= dt * (said.big ? 0.7 : 1.6)
  }
  next.says = next.says.filter((said) => said.life > 0)

  // --- how it ends ---
  if (through) {
    /*
     * The monster stays. It cost a life and it is still there, pushed back up
     * the lane by `serve` along with everything behind it.
     *
     * Taking it off the board instead would quietly mean a wave could be
     * "cleared" by standing still and letting the whole crowd walk through you:
     * the last one over the line leaves nothing on the board, and nothing on the
     * board is a cleared wave.
     */
    next.lives -= 1
    next.events.push('through')
    if (next.lives <= 0) {
      next.status = 'over'
      next.events.push('over')
    } else {
      next.status = 'lost'
      next.events.push('lost')
    }
  } else if (next.crowd.length === 0) {
    next.status = 'cleared'
    next.events.push('cleared')
  }

  return next
}
