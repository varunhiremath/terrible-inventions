import { create } from 'zustand'
import { coopGeneratorFor, type CoopProblem } from './content/coop'
import { updateRating } from './engine/elo'
import { randomSeed } from './engine/rng'
import { RECENT } from './quiz/interlude'
import type { Topic } from './quiz/types'
import { emptySave, loadSave, persistSave, type SaveState } from './engine/storage'
import { setProfileOverride } from './config/profile'
import { loadVoice } from './audio'
import { setVoiceMode, type VoiceMode } from './voice'
import { setMusicEnabled } from './music/player'
import { emptyPowerUps, type PowerUps } from './arcade/maze/game'
import type { Attempt, Problem } from './engine/types'

export type Screen = 'home' | 'arcade' | 'dave' | 'prince' | 'pipes' | 'road' | 'coop' | 'note' | 'settings'

/** How far above his solo level a two-player puzzle is pitched. */
export const COOP_BONUS = 200

/** Which screens have a story to tell before you get there. */
const INTRO_FOR: Partial<Record<Screen, string>> = {
  arcade: 'arcade',
  dave: 'dave',
  prince: 'prince',
  pipes: 'pipes',
  road: 'road',
}


interface State {
  ready: boolean
  screen: Screen
  save: SaveState

  /** The run's configuration. The live game itself lives in the arcade screen. */
  run: { level: number; powerUps: PowerUps } | null
  /**
   * The last few questions asked between lives, so none comes round quickly.
   * Not saved: it only has to hold for a sitting.
   */
  recentQuestions: string[]
  /** So the next question is not the same subject again. */
  lastTopic?: Topic
  coop: CoopProblem | null
  coopShowing: 'a' | 'b' | null
  coopSolved: boolean | null

  boot: () => Promise<void>
  go: (screen: Screen) => void
  /** The game whose intro is playing, if one is. */
  intro: string | null
  /** Plays a game's intro now, whether or not it has been seen. */
  watchIntro: (id: string) => void
  /** Marks it watched and goes on to the game it belongs to. */
  introDone: () => void

  beginRun: () => void
  advanceLevel: (score: number) => void
  finishRun: (score: number) => void

  /** Records an answer from the moment between lives. */
  answerInterlude: (
    problem: Problem | null,
    correct: boolean,
    id: string,
    topic: Topic,
  ) => void

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

export const useStore = create<State>((set, get) => ({
  ready: false,
  screen: 'home',
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

  /**
   * Going to a game plays its intro first, every time.
   *
   * It used to play once and never again, on the reasoning that half a minute
   * of story before every single go is how a good intro becomes a thing people
   * tap past without looking. Asked for the other way round: the story before
   * each game, with a way out of it. So the skip sits at the bottom of the
   * screen from the first frame, and one press is the whole of getting past it.
   */
  go: (screen) => {
    const story = INTRO_FOR[screen]
    set({ screen, intro: story ?? null })
  },

  intro: null,
  watchIntro: (id) => set({ intro: id }),
  introDone: () => {
    const id = get().intro
    set({ intro: null })
    if (!id) return
    const save = { ...get().save, seenIntro: { ...get().save.seenIntro, [id]: true } }
    set({ save })
    void persistSave(save)
  },

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

  recentQuestions: [],
  lastTopic: undefined,

  /**
   * An answer from between lives.
   *
   * Maths moves the rating and goes in the log, because that is what the
   * rating is for. The bank questions do not: knowing which flag is Portugal's
   * says nothing about what sums somebody can do, and letting it move a number
   * that decides how hard the sums are would quietly wreck both.
   */
  answerInterlude: (problem, correct, id, topic) => {
    const { save, recentQuestions } = get()
    set({ recentQuestions: [id, ...recentQuestions].slice(0, RECENT), lastTopic: topic })
    if (!problem) return

    const ratingAfter = updateRating(save.rating, problem.rating, correct, save.attempts)
    const attempt: Attempt = {
      problemId: problem.id,
      kind: problem.kind,
      problemRating: problem.rating,
      ratingBefore: save.rating,
      ratingAfter,
      correct,
      hintsUsed: 0,
      elapsedMs: 0,
      stretch: false,
      at: Date.now(),
    }
    const next: SaveState = {
      ...save,
      rating: ratingAfter,
      attempts: save.attempts + 1,
      log: [...save.log, attempt],
    }
    set({ save: next })
    void persistSave(next)
  },

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
