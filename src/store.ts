import { create } from 'zustand'
import { GENERATORS, generatorFor } from './content'
import { coopGeneratorFor } from './content/coop'
import { MACHINES } from './world/characters'
import { roomsUnlocked, setTrap, springTrap, startHunt, type HuntState } from './hunt/hunt'
import type { CoopProblem } from './content/coop'
import { updateRating } from './engine/elo'
import { initialSelectorState, selectNext, type ProblemSpec, type SelectorState } from './engine/session'
import { makeRng, randomSeed } from './engine/rng'
import { emptySave, loadSave, persistSave, type SaveState } from './engine/storage'
import { loadVoice } from './audio'
import { setVoiceMode, type VoiceMode } from './voice'
import { setProfileOverride } from './config/profile'
import type { Attempt, Problem } from './engine/types'

/** Problems in a mission. Short enough that fixing a machine feels like one sitting. */
export const MISSION_LENGTH = 4

/**
 * How far above his solo level a two-player puzzle is pitched. Two people
 * reason better than one, and the co-op problems are the place to be ambitious
 * — nothing here feeds the rating, so there is no cost to aiming high.
 */
export const COOP_BONUS = 200

export type Screen = 'world' | 'hunt' | 'mission' | 'note' | 'settings' | 'studio' | 'coop'

interface Served {
  problem: Problem
  spec: ProblemSpec
  servedAt: number
}

interface State {
  ready: boolean
  screen: Screen
  save: SaveState
  selector: SelectorState

  current: Served | null
  /** The machine being repaired, if a mission is under way. */
  mission: { machineId: string; total: number } | null
  /**
   * Set the instant a machine is repaired, so the world can play its reaction.
   * This is the payoff the whole mission structure exists for — the thing that
   * was broken visibly stops being broken, and says so.
   */
  justFixed: { machineId: string; praise: string } | null
  /** The chase in progress, if any. */
  hunt: HuntState | null
  /** Shown after springing a trap, until dismissed. */
  huntResult: { caught: boolean; reward: string | null } | null
  coop: CoopProblem | null
  /** Which hand is on screen. Only one at a time, so the other stays private. */
  coopShowing: 'a' | 'b' | null
  coopSolved: boolean | null
  hintsOpen: number
  /** Null while he is still working; set once he has committed to an answer. */
  verdict: { correct: boolean; given: string } | null

  /** Attempts from this sitting only, for the end-of-session summary. */
  sessionLog: Attempt[]

  boot: () => Promise<void>
  go: (screen: Screen) => void
  startMission: (machineId: string) => void
  abandonMission: () => void
  clearJustFixed: () => void
  beginHunt: () => void
  placeTrap: (room: number) => void
  springIt: () => void
  dismissHuntResult: () => void
  setPrototype: (which: 'hunt' | 'workshop') => void
  setRewards: (rewards: string[]) => void
  setVoice: (voice: VoiceMode) => void
  startCoop: () => void
  showHand: (who: 'a' | 'b' | null) => void
  finishCoop: (solved: boolean) => void
  openHint: () => void
  answer: (given: string, correct: boolean) => void
  next: () => void
  saveNote: (text: string) => void
  markNoteSeen: () => void
  saveNames: (names: { kidName?: string; papaName?: string }) => void
  replaceSave: (save: SaveState) => void
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  screen: 'world',
  save: emptySave(),
  selector: initialSelectorState(emptySave().rating),
  current: null,
  mission: null,
  justFixed: null,
  hunt: null,
  huntResult: null,
  coop: null,
  coopShowing: null,
  coopSolved: null,
  hintsOpen: 0,
  verdict: null,
  sessionLog: [],

  boot: async () => {
    const save = await loadSave()
    setProfileOverride(save.names)
    setVoiceMode(save.voice)
    await loadVoice()
    set({
      save,
      selector: initialSelectorState(save.rating, save.attempts),
      screen: save.prototype === 'workshop' ? 'world' : 'hunt',
      ready: true,
    })
  },

  go: (screen) => set({ screen }),

  startMission: (machineId) => {
    const machine = MACHINES.find((m) => m.id === machineId)
    if (!machine) return

    set({
      mission: { machineId, total: machine.length },
      sessionLog: [],
      selector: initialSelectorState(get().save.rating, get().save.attempts),
    })
    serve(set, get)
    set({ screen: 'mission' })
  },

  abandonMission: () => set({ mission: null, current: null, verdict: null, screen: 'world' }),

  clearJustFixed: () => set({ justFixed: null }),

  beginHunt: () => {
    const { save } = get()
    set({
      hunt: startHunt(save.rating, roomsUnlocked(save.hunt.catches), randomSeed()),
      huntResult: null,
      screen: 'hunt',
    })
  },

  placeTrap: (room) => {
    const { hunt } = get()
    if (hunt) set({ hunt: setTrap(hunt, room) })
  },

  springIt: () => {
    const { hunt, save } = get()
    if (!hunt || hunt.trapRoom === null) return

    const after = springTrap(hunt)
    if (!after.caught) {
      set({ hunt: after, huntResult: { caught: false, reward: null } })
      return
    }

    // A catch is the only thing a promised reward hangs on — and since a miss
    // only ever adds evidence, catching is a matter of persistence rather than
    // of being clever. That is the distinction the whole design rests on.
    const catches = save.hunt.catches + 1
    const next: SaveState = { ...save, hunt: { catches } }
    const reward = save.rewards.length > 0 ? save.rewards[(catches - 1) % save.rewards.length] : null

    set({ hunt: after, huntResult: { caught: true, reward }, save: next })
    void persistSave(next)
  },

  dismissHuntResult: () => set({ huntResult: null }),

  setPrototype: (which) => {
    const next: SaveState = { ...get().save, prototype: which }
    set({ save: next, screen: which === 'hunt' ? 'hunt' : 'world', hunt: null, huntResult: null })
    void persistSave(next)
  },

  setVoice: (voice) => {
    const next: SaveState = { ...get().save, voice }
    setVoiceMode(voice)
    set({ save: next })
    void persistSave(next)
  },

  setRewards: (rewards) => {
    const next: SaveState = { ...get().save, rewards }
    set({ save: next })
    void persistSave(next)
  },

  startCoop: () => {
    const gen = coopGeneratorFor('split-clues')
    const rating = Math.min(gen.maxRating, Math.max(gen.minRating, get().save.rating + COOP_BONUS))
    set({
      coop: gen.generate(rating, randomSeed()),
      coopShowing: null,
      coopSolved: null,
      screen: 'coop',
    })
  },

  showHand: (who) => set({ coopShowing: who }),

  finishCoop: (solved) => {
    const { coop, save } = get()
    if (!coop || get().coopSolved !== null) return

    // Recorded, but deliberately not rated: the rating is an estimate of what
    // he can do on his own, and this was not done on his own.
    const next: SaveState = {
      ...save,
      coopLog: [...save.coopLog, { id: coop.id, rating: coop.rating, solved, at: Date.now() }],
    }
    set({ coopSolved: solved, save: next })
    void persistSave(next)
  },

  openHint: () => {
    const { current, hintsOpen } = get()
    if (!current) return
    set({ hintsOpen: Math.min(hintsOpen + 1, current.problem.hints.length) })
  },

  answer: (given, correct) => {
    const { current, save, selector, hintsOpen, sessionLog } = get()
    if (!current || get().verdict) return

    const ratingAfter = updateRating(save.rating, current.problem.rating, correct, save.attempts)

    const attempt: Attempt = {
      problemId: current.problem.id,
      kind: current.problem.kind,
      problemRating: current.problem.rating,
      ratingBefore: save.rating,
      ratingAfter,
      correct,
      hintsUsed: hintsOpen,
      elapsedMs: Date.now() - current.servedAt,
      stretch: current.spec.stretch,
      at: Date.now(),
    }

    const nextSave: SaveState = {
      ...save,
      rating: ratingAfter,
      attempts: save.attempts + 1,
      machinesWorked: save.machinesWorked + 1,
      log: [...save.log, attempt],
    }

    set({
      verdict: { correct, given },
      save: nextSave,
      sessionLog: [...sessionLog, attempt],
      selector: {
        ...selector,
        rating: ratingAfter,
        attempts: selector.attempts + 1,
        consecutiveMisses: correct ? 0 : selector.consecutiveMisses + 1,
      },
    })

    void persistSave(nextSave)
  },

  next: () => {
    const { mission, sessionLog, save } = get()

    if (mission && sessionLog.length >= mission.total) {
      // The machine is repaired for good. This is the only thing the world
      // remembers, and it is what opens the door at the end of the wing.
      const fixed = save.world.fixed.includes(mission.machineId)
        ? save.world.fixed
        : [...save.world.fixed, mission.machineId]
      const next: SaveState = { ...save, world: { fixed } }

      set({
        save: next,
        mission: null,
        current: null,
        verdict: null,
        hintsOpen: 0,
        screen: 'world',
        justFixed: { machineId: mission.machineId, praise: praiseFor(sessionLog) },
      })
      void persistSave(next)
      return
    }

    serve(set, get)
  },

  saveNote: (text) => {
    const next: SaveState = {
      ...get().save,
      note: text.trim() ? { text: text.trim(), at: Date.now(), seen: false } : null,
    }
    set({ save: next })
    void persistSave(next)
  },

  markNoteSeen: () => {
    const { save } = get()
    if (!save.note || save.note.seen) return
    const next: SaveState = { ...save, note: { ...save.note, seen: true } }
    set({ save: next })
    void persistSave(next)
  },

  saveNames: (names) => {
    const next: SaveState = { ...get().save, names }
    setProfileOverride(names)
    set({ save: next })
    void persistSave(next)
  },

  replaceSave: (save) => {
    setProfileOverride(save.names)
    set({ save, selector: initialSelectorState(save.rating, save.attempts), screen: 'world' })
    void persistSave(save)
  },
}))

/**
 * A line about what he actually did.
 *
 * Never about being right, and never about being clever — the evidence on
 * children identified as gifted is that praising the result is what teaches
 * them to avoid hard things. So this only ever reports effort and strategy.
 */
function praiseFor(log: readonly Attempt[]): string {
  const withHints = log.filter((a) => a.hintsUsed > 0).length
  const stretches = log.filter((a) => a.stretch).length
  const longest = log.reduce((n, a) => Math.max(n, a.elapsedMs), 0)

  if (stretches > 0) return 'You took on one that was over your head. That is the only way the ceiling moves.'
  if (withHints > 0) return 'You asked for a nudge and carried on anyway. That is exactly how it is done.'
  if (longest > 45_000) return 'You sat with one of those for a long time without giving up on it.'
  return 'Straight through, no help needed.'
}

/** Picks and builds the next problem, and clears the per-problem UI state. */
function serve(set: (partial: Partial<State>) => void, get: () => State): void {
  const { selector, mission } = get()

  // A mission only serves the kinds of problem its machine is actually broken
  // in, so helping Kettle is always about sharing things out.
  const machine = mission ? MACHINES.find((m) => m.id === mission.machineId) : undefined
  const pool = machine
    ? GENERATORS.filter((g) => machine.kinds.includes(g.id))
    : GENERATORS

  const spec = selectNext(selector, pool.length > 0 ? pool : GENERATORS, makeRng(randomSeed()))
  const problem = generatorFor(spec.kind).generate(spec.rating, randomSeed())

  set({
    current: { problem, spec, servedAt: Date.now() },
    hintsOpen: 0,
    verdict: null,
    selector: {
      ...selector,
      recentKinds: [spec.kind, ...selector.recentKinds].slice(0, 3),
      sinceStretch: spec.stretch ? 0 : selector.sinceStretch + 1,
      // Serving the brake discharges it, so one bad patch does not lock him
      // into easy problems for the rest of the session.
      consecutiveMisses: spec.brake ? 0 : selector.consecutiveMisses,
    },
  })
}
