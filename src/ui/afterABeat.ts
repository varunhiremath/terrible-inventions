import { useEffect, useState } from 'react'

/**
 * How long to leave between losing a life and asking a question about it.
 *
 * Long enough for the sound of what just happened to finish and be heard as
 * the end of something, and short enough that nobody taps the screen wondering
 * whether the game has frozen. Roughly the pause a person leaves before saying
 * "right, never mind".
 */
export const A_BEAT = 1.6

/**
 * A thing that becomes true a moment after it is asked to, not immediately.
 *
 * The question card used to appear in the same frame as the death: you were
 * caught, and before the noise of being caught had finished the screen was
 * covered by a maths question. There is no time in that to notice what
 * happened, and being asked something the instant you lose reads as being
 * marched off rather than being given another go.
 *
 * Two values come back, and the second one matters as much as the first.
 * `soon` is true for the length of the pause, and every screen in here needs
 * it: they all decide whether to show their big panel with "and no question is
 * up", so without it the pause would be filled by the panel flashing on and
 * straight back off again — which is worse than no pause at all.
 *
 * Both go false the moment the input does, with no delay. Coming *back* is not
 * something anybody should have to wait for.
 */
export function useAfterABeat(
  active: boolean,
  seconds = A_BEAT,
): { now: boolean; soon: boolean } {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!active) {
      setReady(false)
      return
    }
    const timer = window.setTimeout(() => setReady(true), seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [active, seconds])

  return { now: active && ready, soon: active && !ready }
}
