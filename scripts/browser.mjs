/**
 * Where the browser is.
 *
 * Every probe in here drives a real Chromium, and the path to it used to be
 * written out in each of them: `/opt/pw-browsers/chromium-1194/...`. That
 * number is Playwright's build of the day. The machine these run on was
 * rebuilt, the build became 1243, the directory under it changed shape as
 * well, and all forty-eight scripts stopped working at once — every one of
 * them with the same unhelpful "executable doesn't exist".
 *
 * So it is worked out once, here, and in the order that keeps working: what
 * the environment says, then the stable symlink the image provides, then
 * whichever build happens to be installed, then nothing at all — which lets
 * Playwright fall back to its own idea of where its browsers live.
 */
import { existsSync, readdirSync } from 'node:fs'

const PLACES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium',
]

function hunt() {
  const root = '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
    for (const under of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const path = `${root}/${dir}/${under}`
      if (existsSync(path)) return path
    }
  }
  return undefined
}

/**
 * The browser, as Playwright's launch options. Empty if it can find its own.
 *
 * Named for what it returns rather than what it is, because nearly every
 * probe in here already has a `browser` of its own — the one it launched.
 */
export function chromiumAt() {
  for (const place of PLACES) {
    if (place && existsSync(place)) return { executablePath: place }
  }
  const found = hunt()
  return found ? { executablePath: found } : {}
}

/** The same, with whatever else a probe wants to pass. */
export const launchWith = (args = []) => ({ ...chromiumAt(), ...(args.length ? { args } : {}) })
