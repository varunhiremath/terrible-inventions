import { create } from 'zustand'
import { GENERATORS, generatorFor } from './content'
import { coopGeneratorFor } from './content/coop'
import type { CoopProblem } from './content/coop'
import { updateRating } from './engine/elo'
import { initialSelectorState, selectNext, type ProblemSpec, type SelectorState } from './engine/session'
import { makeRng, randomSeed } from './engine/rng'
import { emptySave, loadSave, persistSave, type SaveState } from './engine/storage'
import { loadVoice } from './audio'
import { setProfileOverride } from './config/profile'
import type { Attempt, Problem } from './engine/types'

export const SESSION_LENGTH = 8

/**
 * How far above his solo level a two-player puzzle is pitched. Two people
 * reason better than one, and the co-op problems are the place to be ambitious
 * — nothing here feeds the rating, so there is no cost to aiming high.
 */
export const COOP_BONUS = 200

export type Screen = 'lab' | 'gauntlet' | 'note' | 'settings' | 'summary' | 'studio' | 'coop'

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
  startSession: () => void
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
  screen: 'lab',
  save: emptySave(),
  selector: initialSelectorState(emptySave().rating),
  current: null,
  coop: null,
  coopShowing: null,
  coopSolved: null,
  hintsOpen: 0,
  verdict: null,
  sessionLog: [],

  boot: async () => {
    const save = await loadSave()
    setProfileOverride(save.names)
    await loadVoice()
    set({ save, selector: initialSelectorState(save.rating, save.attempts), ready: true })
  },

  go: (screen) => set({ screen }),

  startSession: () => {
    set({ sessionLog: [], selector: initialSelectorState(get().save.rating, get().save.attempts) })
    serve(set, get)
    set({ screen: 'gauntlet' })
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
    if (get().sessionLog.length >= SESSION_LENGTH) {
      set({ screen: 'summary', current: null, verdict: null, hintsOpen: 0 })
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
    set({ save, selector: initialSelectorState(save.rating, save.attempts), screen: 'lab' })
    void persistSave(save)
  },
}))

/** Picks and builds the next problem, and clears the per-problem UI state. */
function serve(set: (partial: Partial<State>) => void, get: () => State): void {
  const { selector } = get()
  const spec = selectNext(selector, GENERATORS, makeRng(randomSeed()))
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
