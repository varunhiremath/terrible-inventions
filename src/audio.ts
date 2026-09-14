/**
 * Voice playback, waiting for real recordings.
 *
 * Drop files into `public/voice/<cue>.m4a` (gitignored — {papa}'s actual voice
 * does not belong in a public repo) and they play automatically. Until then
 * every call is a silent no-op, so nothing has to be wired up twice.
 *
 * iOS will not play audio that was not started by a user gesture, and it stays
 * blocked until one unlocks it, so `unlock()` runs on the first tap.
 */

export type Cue =
  | 'greeting'
  | 'struggle'
  | 'wrong'
  | 'right'
  | 'hint'
  | 'stretch'
  | 'ceiling'
  | 'goodbye'

let unlocked = false
const cache = new Map<Cue, HTMLAudioElement>()

export function unlock(): void {
  if (unlocked) return
  unlocked = true
  // A moment of silence, played inside the gesture, is enough to open the gate.
  const silent = new Audio(
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  )
  silent.volume = 0
  void silent.play().catch(() => {})
}

export function play(cue: Cue): void {
  if (!unlocked) return

  let audio = cache.get(cue)
  if (!audio) {
    audio = new Audio(`./voice/${cue}.m4a`)
    audio.preload = 'auto'
    cache.set(cue, audio)
  }

  audio.currentTime = 0
  // No recording for this cue yet, or the file is missing. Silence is correct.
  void audio.play().catch(() => {})
}
