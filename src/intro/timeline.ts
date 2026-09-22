/**
 * The shape of a cutscene.
 *
 * A story is a list of beats. Each one holds the screen for a few seconds,
 * says a line, and names a scene to draw. The player asks this module what
 * should be on screen at a given moment and gets back the beat and how far
 * through it we are — so the drawing knows nothing about time and the timing
 * knows nothing about drawing, and the whole of the timing can be tested
 * without a canvas.
 *
 * Kept out of the render loop on purpose: cutscene timing is exactly the kind
 * of thing that drifts a little, looks fine, and turns out to have been
 * skipping the last line of every story for a month.
 */

export interface Beat {
  /** How long this beat holds the screen, in seconds. */
  seconds: number
  /** What is said aloud and printed along the bottom. */
  line: string
  /** Who is speaking, which decides the voice it is said in. */
  voice: 'papa' | 'narrator'
  /** Which scene to draw under it. */
  scene: string
}

export interface Story {
  /** The game this belongs to, which is also how it is remembered as seen. */
  id: string
  title: string
  beats: Beat[]
}

export interface Playing {
  index: number
  beat: Beat
  /** How far through this beat, from 0 to 1. */
  t: number
  /** Seconds since this beat started, for animations that want real time. */
  elapsed: number
  done: boolean
}

export function totalSeconds(story: Story): number {
  return story.beats.reduce((sum, b) => sum + b.seconds, 0)
}

/**
 * What is on screen at a moment.
 *
 * Past the end it holds the last beat rather than running off the end of the
 * list, and says so — the player needs a frame to draw while it fades out, and
 * an index out of range is a blank screen with no error to explain it.
 */
export function beatAt(story: Story, elapsed: number): Playing {
  let at = Math.max(0, elapsed)
  for (const [index, beat] of story.beats.entries()) {
    if (at < beat.seconds || index === story.beats.length - 1) {
      const capped = Math.min(at, beat.seconds)
      return {
        index,
        beat,
        t: beat.seconds > 0 ? Math.min(1, capped / beat.seconds) : 1,
        elapsed: capped,
        done: elapsed >= totalSeconds(story),
      }
    }
    at -= beat.seconds
  }
  // Only reachable for a story with no beats at all, which is a mistake worth
  // failing loudly on rather than drawing nothing for ever.
  throw new Error(`${story.id} has no beats`)
}

/** Where a beat starts, for skipping forward to the next one. */
export function beatStart(story: Story, index: number): number {
  return story.beats.slice(0, index).reduce((sum, b) => sum + b.seconds, 0)
}
