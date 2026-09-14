import { allClips } from './engine/voiceStore'
import { linesFor, type Cue } from './voiceLines'

/**
 * Playback of {papa}'s recordings.
 *
 * Clips are read once at boot from IndexedDB (recorded in Settings > Record
 * your voice) and held as object URLs. Anything not yet recorded falls back to
 * `public/voice/<line id>.m4a` for hand-placed files, and if neither exists the
 * cue is simply silent — every screen works with no audio at all.
 *
 * iOS refuses to play anything that was not started by a user gesture, and stays
 * refusing until one unlocks it, so `unlock()` runs on the first tap.
 */

export type { Cue }

let unlocked = false
const urls = new Map<string, string>()
const elements = new Map<string, HTMLAudioElement>()

export function unlock(): void {
  if (unlocked) return
  unlocked = true
  const silent = new Audio(
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  )
  silent.volume = 0
  void silent.play().catch(() => {})
}

/** Called at boot, and again after recording, so new takes are heard at once. */
export async function loadVoice(): Promise<void> {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
  elements.clear()

  for (const [lineId, clip] of await allClips()) {
    urls.set(lineId, URL.createObjectURL(clip.blob))
  }
}

export function hasVoice(): boolean {
  return urls.size > 0
}

export function play(cue: Cue): void {
  if (!unlocked) return

  const lines = linesFor(cue)
  if (lines.length === 0) return

  // Prefer cues actually recorded, so a half-finished session of recording
  // still sounds deliberate rather than patchy.
  const recorded = lines.filter((l) => urls.has(l.id))
  const pool = recorded.length > 0 ? recorded : lines
  const line = pool[Math.floor(Math.random() * pool.length)]

  let audio = elements.get(line.id)
  if (!audio) {
    audio = new Audio(urls.get(line.id) ?? `./voice/${line.id}.m4a`)
    audio.preload = 'auto'
    elements.set(line.id, audio)
  }

  audio.currentTime = 0
  void audio.play().catch(() => {})
}
