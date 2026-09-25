/**
 * A run through the dungeon: the prince, the guards, the gates, and the clock.
 *
 * The clock is the thing that makes this game what it is. Sixty minutes for
 * the whole descent, running across every level, not reset between them — so a
 * level is not a thing you survive, it is a thing you *spend*. Dying costs you
 * nothing but the time you have already used, which is exactly why it hurts.
 *
 * Pure, like everything else here: the same state and the same roll always
 * give the same result, so a whole level can be played out inside a test.
 */
import {
  GATE_OPEN_FRAMES,
  TILE,
  findTiles,
  tileAt,
  type Level,
} from './level'
import { FPS } from './sequences'
import {
  MAX_HEALTH,
  newPrince,
  tick,
  type Input,
  type Prince,
} from './prince'
import {
  FULL_HEALTH,
  NOTICE,
  canAct,
  guardChoice,
  newFighter,
  order,
  stepFighter,
  type Exchange,
  type Fighter,
  type Move,
} from './combat'

/** The whole game, in seconds. */
/** How close an unarmed prince may get to a guard before being turned back. */
const BARRED = 1

export const RUN_SECONDS = 60 * 60

export type Status = 'playing' | 'dead' | 'levelDone' | 'won' | 'outOfTime'

export interface Guard extends Fighter {
  row: number
  colour: string
  /** Awake and coming for you. */
  roused: boolean
}

export interface Run {
  level: Level
  /** Which level this is, counting from one. */
  number: number
  prince: Prince
  guards: Guard[]
  /** Frames left on the run's own clock, shared across every level. */
  framesLeft: number
  /** Frames the gates stay open for, counting down. */
  gateFrames: number
  hasSword: boolean
  /** Extra chevrons earned from the big potions. */
  maxHealth: number
  status: Status
  /** What just happened, for a noise or a flash. */
  event: Exchange['event'] | 'none'
  /** A line across the bottom of the screen, as the original does. */
  message: string | null
  messageFrames: number
}

export function newRun(level: Level, number = 1, framesLeft = RUN_SECONDS * FPS, hasSword = false, maxHealth = MAX_HEALTH): Run {
  const prince = newPrince(level)

  /*
   * Nobody reaches a guard unarmed except on the first floor.
   *
   * The sword is lying on floor one and nowhere else, and it is off the
   * shortest way to the door — so it was quite possible to walk past it, take
   * the stairs down, and meet every guard in the game with nothing to fight
   * them with. Worse, a guard you cannot fight does nothing at all, so what
   * you actually met was a statue, on a floor you could no longer leave.
   *
   * Finding it on floor one is the moment it is meant to be. After that, a
   * guarded floor hands one over rather than being unplayable.
   */
  const armed = hasSword || (number > 1 && (level.guards?.length ?? 0) > 0)

  return {
    level,
    number,
    prince: { ...prince, facing: level.start.facing, health: maxHealth },
    guards: (level.guards ?? []).map((spec) => ({
      ...newFighter(spec.col, spec.facing, spec.skill, spec.skill >= 3 ? FULL_HEALTH + 1 : FULL_HEALTH),
      row: spec.row,
      colour: spec.colour,
      roused: false,
    })),
    framesLeft,
    gateFrames: 0,
    hasSword: armed,
    maxHealth,
    status: 'playing',
    event: 'none',
    message: armed && !hasSword ? 'YOU STILL HAVE A SWORD' : `LEVEL ${number}`,
    messageFrames: FPS * 3,
  }
}

/** Whether a guard is close enough along the same floor to be fighting. */
function engaged(run: Run, guard: Guard): boolean {
  if (guard.health <= 0) return false
  if (guard.row !== run.prince.row) return false
  return Math.abs(guard.col - run.prince.col) <= NOTICE
}

export function fightingGuard(run: Run): Guard | null {
  return run.guards.find((g) => engaged(run, g)) ?? null
}

/** The prince as a fighter, for the frames a duel is running. */
function princeFighter(run: Run): Fighter {
  return {
    col: run.prince.col,
    facing: run.prince.facing,
    health: run.prince.health,
    maxHealth: run.maxHealth,
    stance: run.prince.stance ?? 'ready',
    frame: run.prince.stanceFrame ?? 0,
    think: 0,
    skill: 4,
  }
}

function say(run: Run, message: string, seconds = 2): Run {
  return { ...run, message, messageFrames: Math.round(FPS * seconds) }
}

/**
 * Advances the whole level by one animation frame.
 *
 * @param move what the player is asking for in a fight; ignored otherwise
 * @param roll 0 to 1, for the guards' choices
 */
export function step(run: Run, input: Input, move: Move, roll: () => number): Run {
  if (run.status !== 'playing') return run

  let next: Run = { ...run, event: 'none' }

  // --- the clock ----------------------------------------------------------
  next.framesLeft -= 1
  if (next.framesLeft <= 0) {
    return { ...next, framesLeft: 0, status: 'outOfTime', message: 'OUT OF TIME' }
  }
  if (next.messageFrames > 0) {
    next.messageFrames -= 1
    if (next.messageFrames === 0) next.message = null
  }
  // The original tells you where you stand, and it is always bad news.
  const secondsLeft = Math.ceil(next.framesLeft / FPS)
  const wasSeconds = Math.ceil(run.framesLeft / FPS)
  for (const mark of [60 * 15, 60 * 10, 60 * 5, 60]) {
    if (wasSeconds > mark && secondsLeft <= mark) {
      next = say(next, mark === 60 ? '1 MINUTE LEFT' : `${mark / 60} MINUTES LEFT`, 3)
    }
  }

  if (next.gateFrames > 0) next.gateFrames -= 1

  // --- the duel, if there is one ------------------------------------------
  const facing = fightingGuard(next)
  const duel = facing !== null && next.hasSword

  if (duel && facing) {
    next = stepDuel(next, facing, move, roll)
    if (next.status !== 'playing') return next
  } else {
    // --- moving about ------------------------------------------------------
    const before = next.prince
    const moved = tick(before, next.level, input, next.gateFrames > 0)
    next.prince = { ...moved, stance: 'ready', stanceFrame: 0 }

    /*
     * A guard with no duel to fight is still in the way.
     *
     * Without a sword there is no duel, and without a duel the guard did
     * nothing whatsoever — you walked straight through him. Reported exactly
     * as it looked: "the soldier seemed frozen, he didn't attack me". He bars
     * the corridor now and says why, which turns a statue into the reason to
     * go and find the sword.
     */
    if (facing && !next.hasSword) {
      const side = facing.col >= before.col ? 1 : -1
      const limit = facing.col - side * BARRED
      const past = side > 0 ? next.prince.col > limit : next.prince.col < limit
      if (past) {
        next.prince = { ...next.prince, col: limit }
        next = say(next, 'NO SWORD — FIND ONE', 1.5)
      }
    }

    next = pickUp(next)
  }

  // Guards who are not in a duel still drift towards a noise.
  next.guards = next.guards.map((guard) =>
    guard === facing || guard.health <= 0 ? guard : { ...guard, roused: guard.roused || engaged(next, guard) },
  )

  if (next.prince.dead || next.prince.health <= 0) {
    return { ...next, status: 'dead', message: null }
  }
  if (next.prince.atExit) {
    return { ...next, status: 'levelDone', message: null }
  }
  return next
}

function stepDuel(run: Run, guard: Guard, move: Move, roll: () => number): Run {
  const gap = Math.abs(guard.col - run.prince.col)
  let me = princeFighter(run)
  let him: Fighter = { ...guard }

  // Both face each other, always: a fight you can be flanked in is a fight
  // about the camera rather than about timing.
  me = { ...me, facing: (guard.col > me.col ? 1 : -1) as 1 | -1 }
  him = { ...him, facing: (me.col > him.col ? 1 : -1) as 1 | -1 }

  if (canAct(me)) me = order(me, move)

  if (him.think <= 0 && canAct(him)) {
    const choice = guardChoice(him, gap, me.stance === 'strike', roll())
    him = order(him, choice)
    // Better guards get back to a decision sooner.
    him = { ...him, think: Math.max(2, 8 - him.skill * 2) }
  }

  // Resolve both blades against the state everyone was in when the frame
  // started, so neither wins by going first.
  const mine = stepFighter(me, him, gap)
  const his = stepFighter(him, me, gap)

  const myHealth = Math.min(me.health, his.defender.health)
  const hisHealth = Math.min(him.health, mine.defender.health)

  const event = mine.event !== 'none' ? mine.event : his.event

  const nextGuard: Guard = {
    ...guard,
    ...mine.defender,
    ...his.attacker,
    health: hisHealth,
    stance: hisHealth <= 0 ? 'dead' : his.attacker.stance,
    roused: true,
  }

  return {
    ...run,
    event,
    prince: {
      ...run.prince,
      facing: me.facing,
      col: mine.attacker.col,
      health: myHealth,
      stance: myHealth <= 0 ? 'dead' : mine.attacker.stance,
      stanceFrame: mine.attacker.frame,
    },
    guards: run.guards.map((g) => (g === guard ? nextGuard : g)),
  }
}

/** Whatever he is standing on that can be taken. */
function pickUp(run: Run): Run {
  const col = Math.round(run.prince.col)
  const row = run.prince.row
  const tile = tileAt(run.level, col, row)
  const clear = (): Level => ({
    ...run.level,
    rows: run.level.rows.map((line, y) =>
      y === row ? line.slice(0, col) + TILE.FLOOR + line.slice(col + 1) : line,
    ),
  })

  switch (tile) {
    case TILE.SWORD:
      return say({ ...run, hasSword: true, level: clear() }, 'A SWORD', 2)
    case TILE.POTION_LIFE:
      return say(
        {
          ...run,
          maxHealth: run.maxHealth + 1,
          prince: { ...run.prince, health: run.maxHealth + 1 },
          level: clear(),
        },
        'YOUR STRENGTH GROWS',
        2,
      )
    case TILE.BUTTON:
      return { ...run, gateFrames: GATE_OPEN_FRAMES }
    default:
      return run
  }
}

/** The clock, as the original shows it. */
export function minutesLeft(run: Run): number {
  return Math.max(0, Math.ceil(run.framesLeft / FPS / 60))
}

/** Whether every gate on this level is standing open. */
export function gatesOpen(run: Run): boolean {
  return run.gateFrames > 0
}

/** How many plates and gates a level has, for the tests to check it is wired. */
export function gateCount(level: Level): { gates: number; buttons: number } {
  return {
    gates: findTiles(level, TILE.GATE).length,
    buttons: findTiles(level, TILE.BUTTON).length,
  }
}
