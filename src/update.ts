/**
 * Keeping the app up to date on a phone that never closes it.
 *
 * This is a progressive web app, which means the browser installs it and then
 * quite reasonably keeps serving the copy it installed. On a phone that copy
 * can be weeks old: the icon opens the version from the day it was added, a
 * new one is fetched quietly in the background, and it only appears the *next*
 * time the app is opened — by which time there is a newer one again. The
 * effect from the sofa is that nothing you were told about is ever there.
 *
 * So three things happen here. The app asks the server whether there is a new
 * version every time it comes back to the foreground, rather than only when it
 * starts cold. When there is one, it says so where you can see it. And if you
 * are sitting on the front screen — not halfway down a level, not mid-race —
 * it takes it, because an update you have to agree to is an update that sits
 * there unread.
 *
 * Nothing here ever reloads out from under a game in progress. Losing a race
 * to a software update is a worse experience than running last week's build.
 */
import { registerSW } from 'virtual:pwa-register'

/** Stamped in at build time by vite.config.ts. */
declare const __BUILD__: string
export const BUILD_ID: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'

type Listener = (ready: boolean) => void

let ready = false
const listeners = new Set<Listener>()
let apply: ((reload?: boolean) => Promise<void>) | null = null

/** How often to ask, while the app is open and in front of you. */
const ASK_EVERY = 15 * 60 * 1000

function announce(): void {
  for (const listener of listeners) listener(ready)
}

export function onUpdate(listener: Listener): () => void {
  listeners.add(listener)
  listener(ready)
  return () => listeners.delete(listener)
}

export const updateReady = (): boolean => ready

/**
 * Take the new version.
 *
 * Reloads the page, which is the only way the running code can be replaced.
 * Safe wherever it is called from — the caller decides whether now is a good
 * moment, and only the front screen thinks it is.
 */
export async function takeUpdate(): Promise<void> {
  /*
   * With nothing waiting, this is just a reload — and it has to be, because
   * `updateSW` with no new worker to activate resolves quietly and does
   * nothing at all. The settings offer this as "reload if something looks
   * stuck", and a button labelled reload that does not reload is worse than
   * no button.
   */
  if (!apply || !ready) {
    window.location.reload()
    return
  }
  await apply(true)
}

/** Ask the server whether there is anything newer, right now. */
let askNow: (() => void) | null = null
export const checkForUpdate = (): void => askNow?.()

export function watchForUpdates(): void {
  apply = registerSW({
    onNeedRefresh() {
      ready = true
      announce()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      askNow = () => {
        void registration.update().catch(() => {
          // Offline, or the server is down. Nothing to do and nothing worth
          // saying: the app works perfectly well on the copy it has.
        })
      }
      askNow()
      /*
       * Asked again when the app comes back to the front, which on a phone is
       * the moment that matters. A home-screen app is not reloaded between
       * uses — it is suspended and resumed — so a check that only runs at
       * startup runs approximately never.
       */
      const wake = () => {
        if (document.visibilityState === 'visible') askNow?.()
      }
      document.addEventListener('visibilitychange', wake)
      window.addEventListener('focus', wake)
      window.setInterval(wake, ASK_EVERY)
    },
  })
}
