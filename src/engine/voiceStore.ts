import { db, VOICE_STORE } from './storage'

/**
 * Recorded clips live here, and only here.
 *
 * {papa}'s voice is the single most personal thing in this project, so it never
 * goes near the repository, a server, or a backup that leaves the house. It sits
 * in this browser's IndexedDB, and the only way out is the ZIP the booth offers.
 */

export interface VoiceClip {
  blob: Blob
  /** The MIME the browser actually recorded — Safari gives mp4, Chrome webm. */
  mime: string
  at: number
}

export async function putClip(lineId: string, clip: VoiceClip): Promise<void> {
  await (await db()).put(VOICE_STORE, clip, lineId)
}

export async function removeClip(lineId: string): Promise<void> {
  await (await db()).delete(VOICE_STORE, lineId)
}

export async function allClips(): Promise<Map<string, VoiceClip>> {
  try {
    const database = await db()
    const keys = await database.getAllKeys(VOICE_STORE)
    const values = await database.getAll(VOICE_STORE)
    return new Map(keys.map((k, i) => [String(k), values[i] as VoiceClip]))
  } catch {
    return new Map()
  }
}

export function extensionFor(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'bin'
}

/**
 * Safari and Chrome disagree about recording formats. mp4 goes first because
 * the tablet is the device that matters, and a clip recorded on a laptop has to
 * play there.
 */
export function pickRecordingMime(): string {
  const candidates = [
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c
  }
  return ''
}
