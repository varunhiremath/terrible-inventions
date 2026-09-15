import { makeRng } from './engine/rng'

/**
 * Computer speech, via the browser's own synthesiser.
 *
 * No API key, no network, no cost, and nothing leaves the device — which keeps
 * the privacy position intact. It also speaks *any* line rather than a fixed
 * set of recordings, so dialogue written later is voiced automatically.
 *
 * Pitch and rate are derived from a character's seed, so Kettle and Trundle do
 * not sound like the same narrator reading both parts.
 */

export interface VoiceProfile {
  pitch: number
  rate: number
}

export const NARRATOR: VoiceProfile = { pitch: 1, rate: 0.98 }

/** Same character, same voice, every time. */
export function profileFor(seed: number): VoiceProfile {
  const rng = makeRng(seed ^ 0x5bf03635)
  return {
    pitch: 0.7 + rng.next() * 0.9,
    // Kept in a narrow band: too fast is unintelligible to a child, too slow is
    // unbearable to anyone.
    rate: 0.88 + rng.next() * 0.24,
  }
}

let cached: SpeechSynthesisVoice[] = []

function voices(): SpeechSynthesisVoice[] {
  if (cached.length === 0 && typeof speechSynthesis !== 'undefined') {
    cached = speechSynthesis.getVoices()
  }
  return cached
}

if (typeof speechSynthesis !== 'undefined') {
  // Safari populates the voice list asynchronously, and returns an empty array
  // until it has. Without this the first few lines fall back to the default.
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cached = speechSynthesis.getVoices()
  })
}

/** Prefers a natural English voice, and settles for whatever exists. */
function bestVoice(): SpeechSynthesisVoice | undefined {
  const all = voices()
  if (all.length === 0) return undefined

  const preferred = [
    'Google UK English Male',
    'Google UK English Female',
    'Daniel',
    'Samantha',
    'Karen',
    'Arthur',
  ]
  for (const name of preferred) {
    const hit = all.find((v) => v.name === name)
    if (hit) return hit
  }
  return all.find((v) => v.lang?.startsWith('en-GB')) ?? all.find((v) => v.lang?.startsWith('en'))
}

export function speechAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function stopSpeaking(): void {
  if (speechAvailable()) speechSynthesis.cancel()
}

export function speak(text: string, profile: VoiceProfile = NARRATOR): void {
  if (!speechAvailable() || !text.trim()) return

  // One voice at a time. Lines otherwise pile up and talk over each other when
  // a player taps through dialogue quickly.
  speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  const voice = bestVoice()
  if (voice) utterance.voice = voice
  utterance.pitch = profile.pitch
  utterance.rate = profile.rate
  utterance.volume = 1

  try {
    speechSynthesis.speak(utterance)
  } catch {
    // Blocked, or no synthesiser. Silence is an acceptable outcome.
  }
}
