import { type Cue } from './audio'
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

export type VoiceMode = 'computer' | 'off'

/**
 * Anything saved from before, read forwards.
 *
 * There used to be a third mode that played recordings made in a booth inside
 * the app. The booth is gone, so a device still set to it would have gone
 * silent — which is a bug that looks exactly like the speech being broken.
 */
function known(mode: string): VoiceMode {
  return mode === 'off' ? 'off' : 'computer'
}

let mode: VoiceMode = 'computer'

export function setVoiceMode(next: VoiceMode | string): void {
  mode = known(next)
  if (mode === 'off') stopSpeaking()
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

  const profile =
    options.as === 'papa' ? PAPA : options.seed === undefined ? NARRATOR : profileFor(options.seed)
  speak(text, profile)
}

/**
 * Wordless punctuation — a right answer, a nudge.
 *
 * Silent now that the recordings are gone. Kept as a call so the places that
 * punctuate a moment still say where they do it, and so putting a sound back
 * is one function rather than a hunt through four games.
 */
export function sting(_cue: Cue): void {}

export function silence(): void {
  stopSpeaking()
}

export type { VoiceProfile }
