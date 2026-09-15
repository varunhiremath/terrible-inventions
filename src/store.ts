import { create } from 'zustand'
import { GENERATORS } from './content'
import { coopGeneratorFor, type CoopProblem } from './content/coop'
import { updateRating } from './engine/elo'
import { randomSeed } from './engine/rng'
import { emptySave, loadSave, persistSave, type SaveState } from './engine/storage'
import { setProfileOverride } from './config/profile'
import { loadVoice } from './audio'
import { setVoiceMode, type VoiceMode } from './voice'
import { setMusicEnabled } from './music/player'
import { emptyPowerUps, type PowerUps } from './arcade/maze/game'
import { CONTINUE_DELTA, SHOP, ratingFor, type ShopItem } from './arcade/shop'
import type { Attempt, Problem } from './engine/types'

export type Screen = 'arcade' | 'shop' | 'coop' | 'note' | 'settings' | 'studio'

/** How far above his solo level a two-player puzzle is pitched. */
export const COOP_BONUS = 200

interface Shopping {
  /** Null for the compulsory continue after a game over. */
  item: ShopItem | null
  problem: Problem
  verdict: { correct: boolean; given: string } | null
  hintsOpen: number
  startedAt: number
}

interface State {
  ready: boolean
  screen: Screen
  save: SaveState

  /** The run's configuration. The live game itself lives in the arcade screen. */
  run: { level: number; powerUps: PowerUps } | null
  shopping: Shopping | null
  coop: CoopProblem | null
  coopShowing: 'a' | 'b' | null
  coopSolved: boolean | null

  boot: () => Promise<void>
  go: (screen: Screen) => void

  beginRun: () => void
  advanceLevel: (score: number) => void
  finishRun: (score: number) => void

  openShop: () => void
  attempt: (itemId: string) => void
  attemptContinue: () => void
  answerShop: (given: string, correct: boolean) => void
  openShopHint: () => void
  closeShopping: () => void

  startCoop: () => void
  showHand: (who: 'a' | 'b' | null) => void
  finishCoop: (solved: boolean) => void

  saveNote: (text: string) => void
  markNoteSeen: () => void
  saveNames: (names: { kidName?: string; papaName?: string }) => void
  setVoice: (voice: VoiceMode) => void
  setMusic: (music: boolean) => void
  setRewards: (rewards: string[]) => void
  replaceSave: (save: SaveState) => void
}

/** A problem at a chosen difficulty, from whichever generator can reach it. */
function problemAt(rating: number): Problem {
  const able = GENERATORS.filter((g) => rating >= g.minRating && rating <= g.maxRating)
  const pool = able.length > 0 ? able : GENERATORS
  const generator = pool[Math.floor(Math.random() * pool.length)]
  const clamped = Math.min(generator.maxRating, Math.max(generator.minRating, rating))
  return generator.generate(Math.round(clamped), randomSeed())
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  screen: 'arcade',
  save: emptySave(),
  run: null,
  shopping: null,
  coop: null,
  coopShowing: null,
  coopSolved: null,

  boot: async () => {
    const save = await loadSave()
    setProfileOverride(save.names)
    setVoiceMode(save.voice)
    setMusicEnabled(save.music)
    await loadVoice()
    set({ save, ready: true })
  },

  go: (screen) => set({ screen }),

  beginRun: () =>
    set({ run: { level: get().save.arcade.level, powerUps: get().save.arcade.powerUps }, screen: 'arcade' }),

  advanceLevel: (score) => {
    const { save, run } = get()
    const level = (run?.level ?? save.arcade.level) + 1
    // Power-ups are spent by playing, so what carries forward is whatever is
    // left plus anything bought since.
    const next: SaveState = {
      ...save,
      arcade: { ...save.arcade, level, highScore: Math.max(save.arcade.highScore, score) },
    }
    set({ save: next, run: { level, powerUps: next.arcade.powerUps } })
    void persistSave(next)
  },

  finishRun: (score) => {
    const { save } = get()
    const next: SaveState = {
      ...save,
      arcade: { level: 1, highScore: Math.max(save.arcade.highScore, score), powerUps: emptyPowerUps() },
    }
    set({ save: next, run: null })
    void persistSave(next)
  },

  openShop: () => set({ screen: 'shop', shopping: null }),

  attempt: (itemId) => {
    const item = SHOP.find((i) => i.id === itemId)
    if (!item) return
    set({
      shopping: {
        item,
        problem: problemAt(ratingFor(item, get().save.rating)),
        verdict: null,
        hintsOpen: 0,
        startedAt: Date.now(),
      },
    })
  },

  attemptContinue: () =>
    set({
      screen: 'shop',
      shopping: {
        item: null,
        problem: problemAt(get().save.rating + CONTINUE_DELTA),
        verdict: null,
        hintsOpen: 0,
        startedAt: Date.now(),
      },
    }),

  openShopHint: () => {
    const { shopping } = get()
    if (!shopping) return
    set({ shopping: { ...shopping, hintsOpen: Math.min(shopping.hintsOpen + 1, shopping.problem.hints.length) } })
  },

  answerShop: (given, correct) => {
    const { shopping, save } = get()
    if (!shopping || shopping.verdict) return

    const ratingAfter = updateRating(save.rating, shopping.problem.rating, correct, save.attempts)
    const attempt: Attempt = {
      problemId: shopping.problem.id,
      kind: shopping.problem.kind,
      problemRating: shopping.problem.rating,
      ratingBefore: save.rating,
      ratingAfter,
      correct,
      hintsUsed: shopping.hintsOpen,
      elapsedMs: Date.now() - shopping.startedAt,
      stretch: false,
      at: Date.now(),
    }

    // A wrong answer costs nothing but the prize. There is no penalty for
    // trying something above your level, which is the point of offering it.
    const powerUps = !correct
      ? save.arcade.powerUps
      : shopping.item
        ? shopping.item.apply(save.arcade.powerUps)
        : // The coin slot: no item, just another go.
          { ...save.arcade.powerUps, spareLives: save.arcade.powerUps.spareLives + 1 }

    const next: SaveState = {
      ...save,
      rating: ratingAfter,
      attempts: save.attempts + 1,
      log: [...save.log, attempt],
      arcade: { ...save.arcade, powerUps },
    }

    set({ save: next, shopping: { ...shopping, verdict: { correct, given } } })
    void persistSave(next)
  },

  closeShopping: () => set({ shopping: null }),

  startCoop: () => {
    const gen = coopGeneratorFor('split-clues')
    const rating = Math.min(gen.maxRating, Math.max(gen.minRating, get().save.rating + COOP_BONUS))
    set({ coop: gen.generate(rating, randomSeed()), coopShowing: null, coopSolved: null, screen: 'coop' })
  },

  showHand: (who) => set({ coopShowing: who }),

  finishCoop: (solved) => {
    const { coop, save } = get()
    if (!coop || get().coopSolved !== null) return

    // Recorded, never rated: the rating estimates what he can do alone, and
    // this was not done alone.
    const next: SaveState = {
      ...save,
      coopLog: [...save.coopLog, { id: coop.id, rating: coop.rating, solved, at: Date.now() }],
      // Solving one together is worth a real prize.
      arcade: solved
        ? { ...save.arcade, powerUps: { ...save.arcade.powerUps, freezes: save.arcade.powerUps.freezes + 1 } }
        : save.arcade,
    }
    set({ coopSolved: solved, save: next })
    void persistSave(next)
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

  setVoice: (voice) => {
    const next: SaveState = { ...get().save, voice }
    setVoiceMode(voice)
    set({ save: next })
    void persistSave(next)
  },

  setMusic: (music) => {
    const next: SaveState = { ...get().save, music }
    setMusicEnabled(music)
    set({ save: next })
    void persistSave(next)
  },

  setRewards: (rewards) => {
    const next: SaveState = { ...get().save, rewards }
    set({ save: next })
    void persistSave(next)
  },

  replaceSave: (save) => {
    setProfileOverride(save.names)
    setVoiceMode(save.voice)
    setMusicEnabled(save.music)
    set({ save, run: null, screen: 'arcade' })
    void persistSave(save)
  },
}))
