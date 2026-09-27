/**
 * The spoken lines, rendered in advance.
 *
 * The browser's own synthesiser voices anything ever written, costs nothing
 * and sends nothing anywhere — which is why it was the first answer. The
 * trouble was how it sounded, reported three times, and the last report
 * explained it: "even if I loop over all the available countries they all
 * sound the same". On Android they are the same engine wearing different
 * accents, and no amount of choosing helps.
 *
 * So the lines that are known in advance — the six stories, the taunts, the
 * one-liners each game opens with — are rendered here at build time by a
 * neural voice that runs on the machine doing the building, and shipped as
 * small Opus clips. Two speakers: a narrator and a villain, so a story is not
 * one person reading both parts.
 *
 * Anything *not* in the set still goes to the synthesiser. Nothing ever goes
 * silent because a line was written after the clips were made, which is the
 * property that matters: the recordings are an improvement layered on top,
 * not a thing the app now depends on.
 *
 * The clips say "Papa", because a clip cannot know the name set on a
 * particular device. The text on screen still uses the real one.
 */

/** The same key the renderer writes: the line as written, before filling. */
async function keyOf(voice: string, line: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${voice}|${line}`)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

const BASE = `${import.meta.env.BASE_URL}spoken/`

let index: Record<string, number> | null = null
let loading: Promise<void> | null = null

/** Which clips exist, fetched once. A failure here simply means no clips. */
function ready(): Promise<void> {
  loading ??= fetch(`${BASE}index.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((found: Record<string, number>) => {
      index = found
    })
    .catch(() => {
      index = {}
    })
  return loading
}

let playing: HTMLAudioElement | null = null

export function stopClip(): void {
  if (!playing) return
  playing.pause()
  playing = null
}

/**
 * Plays the clip for a line, if there is one.
 *
 * Returns how long it will take, or null when there is nothing to play and the
 * caller should fall back to the synthesiser. Asking the question is async —
 * hashing is — so callers hand in what to do either way rather than awaiting.
 */
export async function playClip(voice: 'narrator' | 'papa', line: string): Promise<number | null> {
  await ready()
  if (!index) return null
  const key = await keyOf(voice, line)
  const seconds = index[key]
  if (seconds === undefined) return null

  stopClip()
  const audio = new Audio(`${BASE}${key}.opus`)
  playing = audio
  // A clip that will not play — codec unsupported, autoplay blocked — must not
  // swallow the line. The caller has already been told how long it would take,
  // so the worst case is a silence of that length rather than a crash.
  void audio.play().catch(() => {})
  return seconds
}

/** Whether a line has a clip, without playing it. Used by the tests. */
export async function hasClip(voice: 'narrator' | 'papa', line: string): Promise<boolean> {
  await ready()
  if (!index) return false
  return index[await keyOf(voice, line)] !== undefined
}
