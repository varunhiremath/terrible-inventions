import { useEffect, useState } from 'react'
import { onUpdate, takeUpdate } from '../update'

/**
 * "There is a new one — tap here."
 *
 * Only ever shown on the front screen, and on the front screen it takes
 * itself: sitting on the menu is exactly the moment when losing the page
 * costs nothing, and an update that waits to be agreed to is an update that
 * waits forever. The button exists for the second or two before that happens,
 * and for the case where the reload is refused or slow.
 */
export function UpdatePill({ auto = false }: { auto?: boolean }) {
  const [ready, setReady] = useState(false)
  const [going, setGoing] = useState(false)

  useEffect(() => onUpdate(setReady), [])

  useEffect(() => {
    if (!ready || !auto || going) return
    setGoing(true)
    // A moment, so the badge is seen rather than the screen simply blinking:
    // an app that reloads itself with no explanation looks like a crash.
    const timer = window.setTimeout(() => void takeUpdate(), 1200)
    return () => window.clearTimeout(timer)
  }, [ready, auto, going])

  if (!ready) return null

  return (
    <button
      type="button"
      onClick={() => void takeUpdate()}
      className="flex items-center gap-2 rounded-full bg-moss/15 px-3 py-1.5 font-mono
                 text-[0.7rem] font-bold uppercase tracking-widest text-moss
                 ring-1 ring-moss/40 active:bg-moss/25"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-moss" />
      {going ? 'Updating…' : 'New version — tap to update'}
    </button>
  )
}
