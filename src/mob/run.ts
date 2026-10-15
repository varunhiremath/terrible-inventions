/**
 * The swarm, simulated.
 *
 * Pure and fixed-step like the rest of the games here: `step(run, input, dt)`
 * returns the next run and never touches the outside world, so the whole of it
 * can be played by a test at whatever speed a test likes.
 *
 * Two things in here are worth more care than they look.
 *
 * The first is the trade. A squad meeting a block does not simply break it or
 * bounce off it — they cancel out one for one, and whichever is bigger carries
 * on with what is left. A squad of fourteen into a block of nine leaves five
 * flying at whatever is behind it, which is the moment this game is about and
 * also subtraction, out loud, several times a second.
 *
 * The second is where a gate is read. A gate is a line across part of the lane,
 * and a squad crosses it in the middle of a step rather than landing on it — so
 * what is tested is whether the squad was below it before the step and above it
 * after, not whether it is near it now. Testing nearness would let a slow frame
 * carry a squad clean over a gate without it firing, which is the kind of fault
 * that only shows up on the cheapest device anybody owns.
 */
import {
  CART_SPEED, CART_W, GATE_Y, LANE, LEAST, LINE_Y, LIVES, MOB_H, MOB_W, MOST, SQUAD_SPEED, SQUAD_W,
  TALL, apply, gateEvery, gateRow, mobSpeed, waveFor, weaponFor,
  type Block, type Dice, type Gate, type Op, type Weapon,
} from './level'

export const FIXED = 1 / 120

export type MobEvent =
  | 'fire' | 'grow' | 'shrink' | 'hit' | 'broke' | 'gates'
  | 'through' | 'lost' | 'cleared' | 'armed' | 'over'

/**
 * Loudest first, for the screen to pick one noise a frame from.
 *
 * Beside the game rather than in the screen, like every other game in here:
 * `events.test.ts` reads this list and the event union together, because an
 * event missing from the list is never the loudest thing in any frame and so
 * is silent for ever with nothing to notice.
 */
export const LOUDEST: readonly MobEvent[] = [
  'over', 'cleared', 'lost', 'through', 'armed', 'broke', 'grow', 'shrink', 'gates', 'hit', 'fire',
]

export type Status = 'playing' | 'lost' | 'cleared' | 'over'

/** A squad in flight. The number is the squad. */
export interface Squad {
  id: number
  x: number
  y: number
  n: number
  /** Counts down after a gate or a trade, so the drawing can flash it. */
  flash: number
}

/**
 * A line of arithmetic floating where it happened.
 *
 * Not decoration. A gate that silently turns four into twelve teaches nothing;
 * `4 × 3 = 12` written where the squad went through is the entire educational
 * content of the game, and it is also the thing that makes a good gate choice
 * feel like a good gate choice.
 */
export interface Said {
  id: number
  /** The gate it came out of. One label per gate, replaced as shots go through. */
  from: number
  x: number
  y: number
  text: string
  tint: string
  life: number
}

export interface Input {
  /** Where the cart is being asked to go, in lane units. Null means stay. */
  to: number | null
  left: boolean
  right: boolean
}

export const NO_INPUT: Input = { to: null, left: false, right: false }

export interface Run {
  level: number
  status: Status
  score: number
  /** Machines seen off, for the whole run. This is what buys the guns. */
  hits: number
  lives: number
  /** Where the cart is along the lane. */
  cart: number
  weapon: Weapon['id']
  squads: Squad[]
  gates: Gate[]
  blocks: Block[]
  says: Said[]
  /** Seconds until the next shot, and until the next row of gates. */
  cool: number
  gateIn: number
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

export function newRun(level = 1, lives = LIVES, score = 0, hits = 0, seed = 1): Run {
  const dice = makeDice(seed)
  let id = 1
  const nextId = () => id++
  const blocks = waveFor(level, dice, nextId)

  return {
    level,
    status: 'playing',
    score,
    hits,
    lives,
    cart: LANE / 2,
    weapon: weaponFor(hits).id,
    squads: [],
    // The row is there from the first shot. Every shot goes through it.
    gates: gateRow(level, dice, GATE_Y, nextId),
    blocks,
    says: [],
    cool: 0.35,
    gateIn: gateEvery(level),
    clock: 0,
    events: [],
    seed: stir(seed),
    nextId: id,
  }
}

/** The next wave, keeping the score, the guns and what is left of the lives. */
export const nextLevel = (run: Run): Run =>
  newRun(run.level + 1, run.lives, run.score, run.hits, run.seed + 1)

/**
 * Carrying on after one got through.
 *
 * The mob is pushed back up the lane rather than rebuilt: a wave that starts
 * again from the top after every life would make a late wave unloseable by
 * attrition, and one that carries on from where it was would put the next block
 * over the line half a second after you pressed the button.
 */
export function serve(run: Run): Run {
  return {
    ...run,
    status: 'playing',
    squads: [],
    says: [],
    cool: 0.35,
    blocks: run.blocks.map((b) => ({ ...b, y: b.y - PUSH_BACK })),
    events: [],
  }
}

/**
 * How far the whole mob is pushed back up the lane when one gets through.
 *
 * Measured rather than guessed: at three units a block that crossed the line
 * was back over it four seconds later, and a good player was losing ten lives a
 * minute from wave ten on — not difficulty, a death spiral. Six units is about
 * six seconds of grace at the pace the mob walks deep in.
 */
const PUSH_BACK = 6

/** How many machines are still standing, for the top of the screen. */
export const standing = (run: Run): number =>
  run.blocks.reduce((sum, block) => sum + block.count, 0)

// --- the lane ---------------------------------------------------------------

const clampCart = (x: number): number =>
  Math.max(CART_W / 2, Math.min(LANE - CART_W / 2, x))

/** Whether a squad at this x is inside a gate's slice of the lane. */
const under = (gate: Gate, x: number): boolean => x >= gate.from && x < gate.to

const boxOf = (block: Block): [number, number, number, number] => [
  block.x - MOB_W / 2,
  block.y - MOB_H / 2,
  block.x + MOB_W / 2,
  block.y + MOB_H / 2,
]

const sum = (op: Op, squad: number, by: number, after: number): string =>
  `${squad} ${op === 'times' ? '×' : op === 'plus' ? '+' : '−'} ${by} = ${after}`

// --- a step -----------------------------------------------------------------

export function step(run: Run, input: Input, dt: number): Run {
  if (run.status !== 'playing') return { ...run, events: [] }

  const next: Run = {
    ...run,
    squads: run.squads.map((s) => ({ ...s })),
    gates: run.gates.map((g) => ({ ...g })),
    blocks: run.blocks.map((b) => ({ ...b })),
    says: run.says.map((s) => ({ ...s })),
    events: [],
  }
  const dice = makeDice(next.seed)
  next.seed = stir(next.seed)
  next.clock += dt

  const weapon = weaponFor(next.hits)

  // --- the cart ---
  if (input.to !== null) {
    const want = clampCart(input.to)
    const most = CART_SPEED * dt
    const gap = want - next.cart
    next.cart = Math.abs(gap) <= most ? want : next.cart + Math.sign(gap) * most
  } else if (input.left !== input.right) {
    next.cart = clampCart(next.cart + (input.right ? 1 : -1) * CART_SPEED * dt)
  }

  // --- firing ---
  next.cool -= dt
  if (next.cool <= 0) {
    next.cool += weapon.every
    next.squads.push({
      id: next.nextId++,
      x: next.cart,
      y: TALL - 1.6,
      n: weapon.squad,
      flash: 0,
    })
    next.events.push('fire')
  }

  // --- the row of gates, swapped for another every few seconds ---
  for (const gate of next.gates) gate.flash = Math.max(0, gate.flash - dt)

  next.gateIn -= dt
  if (next.gateIn <= 0) {
    next.gateIn += gateEvery(next.level)
    next.gates = gateRow(next.level, dice, GATE_Y, () => next.nextId++, next.clock)
    next.events.push('gates')
  }

  // --- the squads go up, through whatever is in the way ---
  /*
   * Walked along their path in slices, not teleported to the end of it.
   *
   * A squad covers two thirds of a unit in a sixtieth of a second and a block
   * is a unit and a quarter tall, so at any step much longer than a frame a
   * whole block fits between where a squad was and where it is next, and the
   * squad sails straight through the mob without touching it. The wall's ball
   * has the same problem and the same answer: never move further in one go
   * than half the smallest thing you could hit.
   */
  const rise = SQUAD_SPEED * dt
  const dead = new Set<number>()
  const slice = Math.min(MOB_H, MOB_W) * 0.5

  for (const squad of next.squads) {
    squad.flash = Math.max(0, squad.flash - dt)
    let togo = rise

    while (togo > 0 && !dead.has(squad.id)) {
      const move = Math.min(togo, slice)
      togo -= move
      const was = squad.y
      squad.y -= move

      // Gates first: a squad that passes a gate and a block in the same slice
      // went through the gate on the way, so it arrives at its new size.
      for (const gate of next.gates) {
        if (!under(gate, squad.x)) continue
        // Crossed it during this slice, rather than being near it now.
        if (!(was > gate.y && squad.y <= gate.y)) continue
        const before = squad.n
        const after = apply(before, gate.op, gate.by)
        if (after !== before) {
          squad.n = after
          squad.flash = 0.3
          gate.flash = 0.3
          next.events.push(after > before ? 'grow' : 'shrink')
          /*
           * One label per gate, replacing whatever that gate said last.
           *
           * Shots go through a gate twice a second and the sum is the same
           * sum every time, so letting them pile up stacked three copies of
           * `1 × 2 = 2` on top of each other and on top of the gate's own
           * number, which became unreadable — the one number on the screen
           * the whole game is about. Seen in a screenshot, not in a test.
           */
          next.says = next.says.filter((said) => said.from !== gate.id)
          next.says.push({
            id: next.nextId++,
            from: gate.id,
            x: squad.x,
            // Above the gate rather than on it, so the frame stays legible.
            y: gate.y - 0.95,
            text: sum(gate.op, before, gate.by, after),
            tint: after > before ? '#9af5c0' : '#ff8c8c',
            life: 1.2,
          })
        } else if (before === MOST || before === LEAST) {
          // Pinned at the ceiling or the floor. Say nothing and make no noise:
          // a gate that did nothing is not news, and a cue for it would fire on
          // every shot once a squad is capped.
          gate.flash = 0.15
        }
      }

      // Then whatever it has flown into. Nearest first, so a squad with enough
      // in it takes the front block and carries on into the one behind.
      const ahead = next.blocks
        .filter((block) => !dead.has(block.id) && block.count > 0)
        .sort((a, b) => b.y - a.y)

      for (const block of ahead) {
        if (squad.n <= 0) break
        const [left, top, right, bottom] = boxOf(block)
        const hitX = squad.x + SQUAD_W / 2 > left && squad.x - SQUAD_W / 2 < right
        const hitY = squad.y <= bottom && squad.y >= top
        if (!hitX || !hitY) continue

        const take = Math.min(squad.n, block.count)
        block.count -= take
        squad.n -= take
        block.flash = 0.25
        next.hits += take
        next.score += take

        if (block.count <= 0) {
          dead.add(block.id)
          next.events.push('broke')
          next.score += 5
        } else {
          next.events.push('hit')
        }
      }

      if (squad.n <= 0 || squad.y < -0.6) dead.add(squad.id)
    }
  }

  next.squads = next.squads.filter((squad) => !dead.has(squad.id))
  next.blocks = next.blocks.filter((block) => !dead.has(block.id) && block.count > 0)

  // --- the mob walks down ---
  const walk = mobSpeed(next.level) * dt
  let through = false
  for (const block of next.blocks) {
    block.y += walk
    block.flash = Math.max(0, block.flash - dt)
    if (block.y + MOB_H / 2 >= LINE_Y) through = true
  }

  // --- the labels fade ---
  for (const said of next.says) {
    said.life -= dt
    said.y -= dt * 0.9
  }
  next.says = next.says.filter((said) => said.life > 0)

  // --- a new gun, if this run has earned one ---
  const now = weaponFor(next.hits)
  if (now.id !== next.weapon) {
    next.weapon = now.id
    next.events.push('armed')
  }

  // --- how it ends ---
  if (through) {
    /*
     * The block stays. It cost a life and it is still there, pushed back up the
     * lane by `serve` along with everything behind it.
     *
     * It used to be taken off the board, which quietly meant a wave could be
     * "cleared" by standing still and letting the whole mob walk through you:
     * the last block over the line left nothing on the board, and nothing on
     * the board is a cleared wave. The bot that never moves cleared one that
     * way. A wave is cleared by shooting it, or not at all.
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
  } else if (next.blocks.length === 0) {
    next.status = 'cleared'
    next.events.push('cleared')
  }

  return next
}
