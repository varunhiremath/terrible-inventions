/**
 * Who is playing.
 *
 * This repository is public, so no real name is allowed to live in it. The
 * shipped defaults are deliberately generic, and every real value is supplied at
 * runtime from the device:
 *
 *   1. `setProfileOverride()` — names typed into Lab > Settings, persisted in
 *      that device's IndexedDB. This is the intended route.
 *   2. `VITE_*` env vars from a gitignored `.env.local`, for dev convenience.
 *   3. The generic defaults below.
 *
 * Nothing here is ever written back to disk by the build, so a clone of this
 * repo knows nothing about the family using it.
 */

export interface Profile {
  /** The player. Addressed directly, so this is used a lot. */
  kidName: string
  /** The sidekick. The one who builds the terrible machines. */
  papaName: string
}

const DEFAULTS: Profile = {
  kidName: 'Chief',
  papaName: 'Papa',
}

function fromEnv(): Partial<Profile> {
  const env = import.meta.env ?? {}
  const out: Partial<Profile> = {}
  if (env.VITE_KID_NAME) out.kidName = env.VITE_KID_NAME
  if (env.VITE_PAPA_NAME) out.papaName = env.VITE_PAPA_NAME
  return out
}

let override: Partial<Profile> = {}

/** Applied at boot from IndexedDB, and again whenever Settings is saved. */
export function setProfileOverride(next: Partial<Profile>): void {
  override = { ...next }
}

export function getProfile(): Profile {
  return { ...DEFAULTS, ...fromEnv(), ...override }
}

/**
 * Fills `{kid}` and `{papa}` in authored strings. Generators and voice lines are
 * written with the placeholders so that no screen has to know the real names.
 */
export function fill(text: string): string {
  const p = getProfile()
  return text.replace(/\{kid\}/g, p.kidName).replace(/\{papa\}/g, p.papaName)
}
