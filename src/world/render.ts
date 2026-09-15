import type { Point } from './map'
import type { Palette } from './sprites'

/**
 * What a screen hands the renderer.
 *
 * Deliberately knows nothing about three.js, workshops or houses: rows of tiles
 * and a list of who is standing where. A second location costs a data file, and
 * swapping the renderer underneath costs nothing at all — which is exactly what
 * happened when the flat version was replaced.
 */

export interface Actor {
  key: string
  at: Point
  seed: number
  palette?: Palette
  label?: string
  /** Bobbing marker overhead: something to do here. */
  marker?: string
  /** Shudders, for anything that is not right. */
  agitated?: boolean
}

export interface Scene {
  rows: readonly string[]
  actors: readonly Actor[]
  player: { x: number; y: number }
  facingTile: Point | null
  /** Numerals painted on the floor, for rooms that have numbers. */
  floorLabels?: readonly { at: Point; text: string; dim?: boolean }[]
  /** Per-tile floor colour, so each room can have its own. */
  floorTint?: (x: number, y: number) => string | undefined
}

export const PLAYER_SEED = 31337
export const PLAYER_PALETTE: Palette = {
  body: 'hsl(35, 90%, 58%)',
  shade: 'hsl(28, 80%, 42%)',
  accent: 'hsl(200, 85%, 62%)',
  outline: 'hsl(30, 60%, 14%)',
}

export const PAPA_SEED = 90210
export const PAPA_PALETTE: Palette = {
  body: 'hsl(280, 35%, 55%)',
  shade: 'hsl(280, 35%, 36%)',
  accent: 'hsl(45, 85%, 60%)',
  outline: 'hsl(280, 40%, 12%)',
}
