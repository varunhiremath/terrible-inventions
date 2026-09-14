import { openDB, type IDBPDatabase } from 'idb'
import type { Attempt } from './types'
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
  rating: number
  attempts: number
  /** Problems taken on, right or wrong. Deliberately not a score. */
  machinesWorked: number
  /** A short message from {papa}, shown once on the next visit. */
  note: { text: string; at: number; seen: boolean } | null
  /** Real names, entered on the device. Deliberately never in the repo. */
  names: { kidName?: string; papaName?: string }
  log: Attempt[]
  /**
   * Two-player puzzles, kept apart from `log` on purpose. A co-op result says
   * nothing about what the child can do alone, so it must never touch the
   * rating or the solo history.
   */
  coopLog: { id: string; rating: number; solved: boolean; at: number }[]
  /** Which machines are working again. The world's only persistent state. */
  world: { fixed: string[] }
  /** Catches so far, which is what opens the house up. */
  hunt: { catches: number }
  /** What {papa} has promised, one per catch. Written on the device, never shipped. */
  rewards: string[]
  /** Which prototype is being tried. Here so the two can be compared honestly. */
  prototype: 'hunt' | 'workshop'
}

export function emptySave(): SaveState {
  return {
    version: 1,
    rating: START_RATING,
    attempts: 0,
    machinesWorked: 0,
    note: null,
    names: {},
    log: [],
    coopLog: [],
    world: { fixed: [] },
    hunt: { catches: 0 },
    rewards: [],
    prototype: 'hunt',
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
