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
import { COINS_PER, spareLives } from './workshop/kit'
import type { Trail } from './road/run'
import type { Attempt, Problem } from './engine/types'

export type Screen =
  | 'home' | 'arcade' | 'dave' | 'prince' | 'pipes' | 'road' | 'space'
  | 'workshop' | 'coop' | 'note' | 'settings'

/** How far above his solo level a two-player puzzle is pitched. */
export const COOP_BONUS = 200

/** Which screens have a story to tell before you get there. */
const INTRO_FOR: Partial<Record<Screen, string>> = {
  arcade: 'arcade',
  dave: 'dave',
  prince: 'prince',
  pipes: 'pipes',
  road: 'road',
  space: 'space',
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
  /**
   * Records a lap of the road, keeping it only if it is quicker than the last.
   *
   * Returns whether it was: the screen wants to say so, and nobody wants to be
   * told they have set a personal best when they have not.
   */
  recordLap: (level: number, seconds: number, trail?: Trail) => boolean
  /** Which car he drives on the road, by name. */
  pickCar: (name: string) => void
  /** Where he finished, so the next grid can be built out of it. */
  recordPlace: (place: number) => void
  /** Whether a second person is driving one of the field. */
  setTwoPlayer: (on: boolean) => void
  /**
   * Coins earned by playing, paid at the end of a run.
   *
   * Every game pays in the same currency, because the workshop that spends it
   * upgrades all of them. Rounded down from the score, so a good run in any
   * game is worth a little of whatever you are saving for.
   */
  earn: (score: number) => number
  /** Coins paid directly, for things that are not a score. */
  addCoins: (coins: number) => void
  /** Solving a sum in the workshop. Records it for the rating and pays out. */
  solveForCoins: (problem: Problem, correct: boolean, coins: number) => void
  /** Buys a workshop upgrade if it can be afforded, and says whether it did. */
  buyUpgrade: (id: string, cost: number, most: number) => boolean
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

  beginRun: () => {
    const { save } = get()
    // The workshop's spare lives stack on top of whatever the arcade's own
    // shop has sold him. Both are "one more go"; there is no sense in the two
    // fighting over the same field.
    const powerUps = {
      ...save.arcade.powerUps,
      spareLives: save.arcade.powerUps.spareLives + spareLives(save),
    }
    set({ run: { level: save.arcade.level, powerUps }, screen: 'arcade' })
  },

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
      // The maze pays into the same purse as everything else.
      coins: save.coins + Math.max(0, Math.floor(score / COINS_PER)),
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

    /*
     * A question answered correctly is never asked again.
     *
     * Only the written ones: a generated sum's id is its kind, and striking
     * off "addition" the first time he gets one right would end the maths.
     */
    if (correct && !problem && !save.solved.includes(id)) {
      const marked: SaveState = { ...save, solved: [...save.solved, id] }
      set({ save: marked })
      void persistSave(marked)
    }
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

  earn: (score) => {
    const coins = Math.max(0, Math.floor(score / COINS_PER))
    if (coins === 0) return 0
    const next: SaveState = { ...get().save, coins: get().save.coins + coins }
    set({ save: next })
    void persistSave(next)
    return coins
  },

  addCoins: (coins) => {
    if (coins <= 0) return
    const next: SaveState = { ...get().save, coins: get().save.coins + coins }
    set({ save: next })
    void persistSave(next)
  },

  solveForCoins: (problem, correct, coins) => {
    const { save } = get()
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
      coins: save.coins + (correct ? coins : 0),
    }
    set({ save: next })
    void persistSave(next)
  },

  buyUpgrade: (id, cost, most) => {
    const { save } = get()
    const owned = save.workshop[id] ?? 0
    if (owned >= most || save.coins < cost) return false
    const next: SaveState = {
      ...save,
      coins: save.coins - cost,
      workshop: { ...save.workshop, [id]: owned + 1 },
    }
    set({ save: next })
    void persistSave(next)
    return true
  },

  recordLap: (level, seconds, trail) => {
    const best = get().save.roadBest ?? {}
    const before = best[level]
    if (before !== undefined && before <= seconds) return false
    const next: SaveState = {
      ...get().save,
      roadBest: { ...best, [level]: seconds },
      // The quickest drive is the one worth keeping to race against.
      roadGhost: trail
        ? { ...(get().save.roadGhost ?? {}), [level]: trail }
        : (get().save.roadGhost ?? {}),
    }
    set({ save: next })
    void persistSave(next)
    return true
  },

  pickCar: (name) => {
    const next: SaveState = { ...get().save, roadCar: name }
    set({ save: next })
    void persistSave(next)
  },

  recordPlace: (place) => {
    const next: SaveState = { ...get().save, roadPlace: place }
    set({ save: next })
    void persistSave(next)
  },

  setTwoPlayer: (on) => {
    const next: SaveState = { ...get().save, roadTwoPlayer: on }
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
