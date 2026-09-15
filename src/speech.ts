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

/**
 * {papa}'s delivery. Low, because he is a large man doing a villain voice, and
 * brisk, because the lines are jokes and a joke read slowly is not one.
 */
export const PAPA: VoiceProfile = { pitch: 0.72, rate: 1.08 }

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

/**
 * {papa} is a man, so {papa} gets a man's voice.
 *
 * The first pass listed a few nice-sounding voices and took whichever turned
 * up first, which meant the voice depended on the device: a male voice on
 * Chrome, a coin toss on an iPad, and a female one on anything that had
 * neither. Named male voices are tried first, then anything the platform
 * labels male, then any English voice at all — a wrong-sounding voice beats
 * silence, but it should be the last resort rather than the luck of the draw.
 */
const MALE_VOICES = [
  'Google UK English Male',
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Microsoft George - English (United Kingdom)',
  'Microsoft Guy Online (Natural) - English (United States)',
  'Daniel',
  'Arthur',
  'Oliver',
  'Alex',
  'Aaron',
  'Fred',
  'Rishi',
  'en-gb-x-gbb-network',
]

/** Names that turn up on some platform or other and are not male. */
const NOT_MALE = /samantha|karen|moira|tessa|fiona|victoria|serena|martha|susan|catherine|zira|hazel|female|amy|joanna/i

export function pickVoice(all: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (all.length === 0) return undefined

  for (const name of MALE_VOICES) {
    const hit = all.find((v) => v.name === name)
    if (hit) return hit
  }

  const english = all.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  const pool = english.length > 0 ? english : all

  // Some platforms say so outright in the name.
  const declared = pool.find((v) => /male/i.test(v.name) && !/female/i.test(v.name))
  if (declared) return declared

  const notFemale = pool.find((v) => !NOT_MALE.test(v.name))
  if (notFemale) return notFemale

  return pool.find((v) => v.lang?.startsWith('en-GB')) ?? pool[0]
}

function bestVoice(): SpeechSynthesisVoice | undefined {
  return pickVoice(voices())
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
