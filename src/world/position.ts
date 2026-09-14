import { SPAWN, type Point } from './map'

/**
 * Where the player was standing.
 *
 * Held outside React because the world screen unmounts whenever a mission or a
 * conversation takes over, and coming back to find yourself teleported to the
 * entrance destroys the feeling of being somewhere. Not persisted across app
 * restarts on purpose — arriving at the workshop entrance is a fine way to
 * start a session.
 */
let last: Point = { ...SPAWN }

export function lastPosition(): Point {
  return { ...last }
}

export function rememberPosition(point: Point): void {
  last = { ...point }
}

export function forgetPosition(): void {
  last = { ...SPAWN }
}
