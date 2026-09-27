import { openDB, type IDBPDatabase } from 'idb'
import type { Attempt } from './types'
import { emptyPowerUps, type PowerUps } from '../arcade/maze/game'
import { START_RATING } from './elo'

/**
 * Everything lives on the device. There is no server, no account and no
 * telemetry, so this file is the entire persistence story.
 *
 * iOS will evict IndexedDB for sites it thinks are abandoned — far less likely
 * once the PWA is installed to the home screen, but not impossible — so
 * `exportSave` exists to let a real backup be taken before that can ever matter.
 */

const DB_NAME = 'terrible-inventions'
const STORE = 'state'
/** Recorded voice clips, keyed by line id. Blobs, never leaving this device. */
export const VOICE_STORE = 'voice'
const KEY = 'main'
const MAX_LOG = 2000

export interface SaveState {
  version: 1
  /** What he can do on his own. Only solo problems move it. */
  rating: number
  attempts: number
  /** A short message from {papa}, shown once on the next visit. */
  note: { text: string; at: number; seen: boolean } | null
  /** Real names, entered on the device. Deliberately never in the repo. */
  names: { kidName?: string; papaName?: string }
  /** Computer speech, {papa}'s recordings, or nothing. */
  voice: 'computer' | 'papa' | 'off'
  /** Background music. Some days it is the last thing anyone wants. */
  music: boolean
  /** What {papa} has promised. Written on the device, never shipped. */
  rewards: string[]
  log: Attempt[]
  /**
   * Two-player puzzles, kept apart from `log` on purpose. A co-op result says
   * nothing about what the child can do alone, so it must never touch the
   * rating or the solo history.
   */
  coopLog: { id: string; rating: number; solved: boolean; at: number }[]
  /** Power-ups carry between runs, which is what makes shopping worth doing. */
  arcade: { level: number; highScore: number; powerUps: PowerUps }
  /**
   * Which games have had their intro watched.
   *
   * Only so it plays once by itself. Every one of them can be watched again
   * from the settings whenever you like — an intro you cannot get back to is
   * one you dare not skip.
   */
  seenIntro: Record<string, boolean>
  /**
   * The quickest anybody has got round each level of the road, in seconds.
   *
   * Keyed by level number. Kept on the device with everything else, so the
   * time to beat is his own from yesterday rather than a number somebody
   * decided was good — which is the only kind of target worth chasing when
   * you are the only person who plays.
   */
  roadBest: Record<number, number>
  /**
   * The drive that set each best time, so it can be raced against.
   *
   * This is as close to playing together as anything gets without a server:
   * one of you sets a time, and the other races the car that set it. Stored
   * as three flat arrays of a few hundred numbers per level.
   */
  roadGhost: Record<number, { at: number[]; gone: number[]; lane: number[] }>
  /**
   * Which car out of the garage he drives, by name.
   *
   * A name rather than an index, so reordering the roster or slipping a new
   * car into the middle of it does not quietly hand him somebody else's car.
   */
  roadCar?: string
  /**
   * Where he finished the last race, which is where he starts the next one.
   *
   * The whole reason the grid is worth painting: win and you line up on pole
   * next time with nothing in front of you, come last and you have the lot of
   * them to get past again.
   */
  roadPlace?: number
  /**
   * Every question he has ever got right, by id. Never asked again.
   *
   * Kept apart from `log`, which is the record of attempts and drives the
   * rating. This is the one that decides what he sees next: there is nothing
   * to be learned from being asked the capital of Australia a fourth time, and
   * a good deal to be gained from the fourth question being a new one.
   */
  solved: string[]
  /**
   * Coins, and what they have bought.
   *
   * One purse for all six games. Playing earns them, maths in the workshop
   * earns them faster, and they buy the same few permanent upgrades whichever
   * game you spend them on — which is what makes maths worth doing when it is
   * not being forced on you mid-game.
   */
  coins: number
  workshop: Record<string, number>
}

export function emptySave(): SaveState {
  return {
    version: 1,
    rating: START_RATING,
    attempts: 0,
    note: null,
    names: {},
    voice: 'computer',
    music: true,
    rewards: [],
    log: [],
    coopLog: [],
    arcade: { level: 1, highScore: 0, powerUps: emptyPowerUps() },
    seenIntro: {},
    roadBest: {},
    roadGhost: {},
    solved: [],
    coins: 0,
    workshop: {},
  }
}

let dbPromise: Promise<IDBPDatabase> | null = null

export function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
      if (!database.objectStoreNames.contains(VOICE_STORE)) database.createObjectStore(VOICE_STORE)
    },
  })
  return dbPromise
}

export async function loadSave(): Promise<SaveState> {
  try {
    const stored = (await (await db()).get(STORE, KEY)) as SaveState | undefined
    return stored ? { ...emptySave(), ...stored } : emptySave()
  } catch {
    // A private window, or storage blocked entirely. The app still works; it
    // just will not remember. Never let this take the whole screen down.
    return emptySave()
  }
}

export async function persistSave(state: SaveState): Promise<void> {
  try {
    const trimmed: SaveState = {
      ...state,
      log: state.log.slice(-MAX_LOG),
      coopLog: state.coopLog.slice(-MAX_LOG),
    }
    await (await db()).put(STORE, trimmed, KEY)
  } catch {
    /* see loadSave */
  }
}

export function exportSave(state: SaveState): string {
  return JSON.stringify(state, null, 2)
}

export function importSave(json: string): SaveState {
  const parsed = JSON.parse(json) as Partial<SaveState>
  if (typeof parsed.rating !== 'number') throw new Error('not a save file')
  return { ...emptySave(), ...parsed }
}
