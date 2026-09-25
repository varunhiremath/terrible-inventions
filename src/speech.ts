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

/**
 * The narrator, who tells the stories before each game.
 *
 * Was pitch 1 — dead neutral — which on a device that hands back a woman's
 * voice by default sounded like exactly that, and was asked to be "a bit more
 * heavier in a male voice". Dropping the pitch weights any voice downwards,
 * which is the half of this that works whatever the device has installed.
 */
export const NARRATOR: VoiceProfile = { pitch: 0.7, rate: 0.92 }

/**
 * {papa}'s delivery. Low, because he is a large man doing a villain voice, and
 * brisk, because the lines are jokes and a joke read slowly is not one.
 */
export const PAPA: VoiceProfile = { pitch: 0.62, rate: 1.02 }

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
  // Android's own voices are named after their speaker code rather than a
  // person, and the code is the only thing that says who it is. These are the
  // male English ones Google ships; a phone that has none of the named voices
  // above almost certainly has one of these.
  'en-gb-x-gbb-network',
  'en-gb-x-gbb-local',
  'en-gb-x-gbd-network',
  'en-gb-x-gbd-local',
  'en-us-x-iom-network',
  'en-us-x-iom-local',
  'en-us-x-iog-network',
  'en-us-x-iog-local',
  'en-in-x-ene-network',
  'en-in-x-ene-local',
]

/** Names that turn up on some platform or other and are not male. */
const NOT_MALE = /samantha|karen|moira|tessa|fiona|victoria|serena|martha|susan|catherine|zira|hazel|female|amy|joanna|salli|kimberly|ivy|kendra|nicole|emma|olivia|ava/i

/**
 * Every name a voice goes by.
 *
 * Android names its voices for the person reading them — "English (United
 * Kingdom)" for four different people — and hides the only thing that says who
 * it is in the URI. Matching on the name alone therefore misses every Android
 * male voice, which is most of the phones this runs on, and the first pass at
 * this did exactly that.
 */
function labels(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI ?? ''}`
}

export function pickVoice(all: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (all.length === 0) return undefined

  const asked = preferred()
  if (asked) {
    const hit = all.find((v) => v.name === asked || v.voiceURI === asked)
    if (hit) return hit
  }

  for (const name of MALE_VOICES) {
    const hit = all.find((v) => v.name === name || v.voiceURI === name)
    if (hit) return hit
  }

  const english = all.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  const pool = english.length > 0 ? english : all

  // Some platforms say so outright in the name.
  const declared = pool.find((v) => /male/i.test(labels(v)) && !/female/i.test(labels(v)))
  if (declared) return declared

  const notFemale = pool.find((v) => !NOT_MALE.test(labels(v)))
  if (notFemale) return notFemale

  return pool.find((v) => v.lang?.startsWith('en-GB')) ?? pool[0]
}

function bestVoice(): SpeechSynthesisVoice | undefined {
  return pickVoice(voices())
}

/*
 * Which voice this device should use, if somebody has said.
 *
 * Kept out of the save file on purpose. A save is carried between devices and
 * a voice is not: the name that sounds right on a phone may not exist on the
 * tablet, and restoring a backup should not leave the app silent or shrill.
 */
const CHOSEN = 'terrible-inventions:voice'

function preferred(): string | null {
  try {
    return localStorage.getItem(CHOSEN)
  } catch {
    return null
  }
}

/** Every voice the device actually has, English first. */
export function availableVoices(): SpeechSynthesisVoice[] {
  const all = [...voices()]
  return all.sort((a, b) => {
    const english = (v: SpeechSynthesisVoice) => (v.lang?.toLowerCase().startsWith('en') ? 0 : 1)
    return english(a) - english(b) || a.name.localeCompare(b.name)
  })
}

/** The one being used right now, whether chosen or worked out. */
export function currentVoiceName(): string {
  return bestVoice()?.name ?? 'the device default'
}

export function chosenVoice(): string | null {
  return preferred()
}

/** Pick one by name, or pass null to go back to working it out. */
export function chooseVoice(name: string | null): void {
  try {
    if (name === null) localStorage.removeItem(CHOSEN)
    else localStorage.setItem(CHOSEN, name)
  } catch {
    // Private browsing, or storage full. The auto-pick still works.
  }
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
