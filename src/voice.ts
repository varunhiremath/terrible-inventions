import { play, type Cue } from './audio'
import { duckMusic, speakingSeconds } from './music/player'
import { NARRATOR, PAPA, profileFor, speak, stopSpeaking, type VoiceProfile } from './speech'

/**
 * One way in for everything the app says out loud.
 *
 * Two sources: {papa}'s own recordings, and the browser's synthesiser. The
 * synthesiser is the default because it can voice every line rather than the
 * thirty-seven that were recorded — but the recordings stay supported, because
 * somebody sat down and made them.
 */

export type VoiceMode = 'computer' | 'papa' | 'off'

let mode: VoiceMode = 'computer'

export function setVoiceMode(next: VoiceMode): void {
  mode = next
  if (next !== 'computer') stopSpeaking()
}

export function getVoiceMode(): VoiceMode {
  return mode
}

/**
 * Says a line of dialogue.
 *
 * `cue` is only a hint for which recording to reach for; the text is what gets
 * spoken. A line with no matching recording still gets a voice.
 */
export function say(
  text: string,
  options: { cue?: Cue; seed?: number; as?: 'papa' } = {},
): void {
  if (mode === 'off') return

  // Under the bass, a joke is just noise.
  duckMusic(speakingSeconds(text))

  if (mode === 'papa') {
    if (options.cue) play(options.cue)
    return
  }

  const profile =
    options.as === 'papa' ? PAPA : options.seed === undefined ? NARRATOR : profileFor(options.seed)
  speak(text, profile)
}

/** Wordless punctuation — a right answer, a nudge. Never spoken aloud. */
export function sting(cue: Cue): void {
  if (mode === 'papa') play(cue)
}

export function silence(): void {
  stopSpeaking()
}

export type { VoiceProfile }
