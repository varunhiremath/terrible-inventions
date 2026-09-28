/**
 * The colours Papa Panic is painted in.
 *
 * They lived inside the board's own screen until a second thing needed them.
 * The walk to the next level goes down a corridor of the same maze, drawn on
 * a flat canvas rather than in three dimensions — and a corridor in a
 * different pink from the board it joins is not the same maze. One list, two
 * renderers: three.js wants a number and a canvas wants a string, so both
 * forms are here rather than a conversion sitting in one of the callers.
 */
export const MAZE_INK = {
  /** The dark the board sits on. */
  back: '#05060a',
  /** The maze's own colour. Thin lines, so it can be bright without shouting. */
  wall: '#f24fd6',
  /** Peach, like the arcade's. */
  dot: '#ffc9a8',
  /** A chaser you can eat. */
  frightened: '#2632d6',
} as const

/** The same colour as a number, which is what three.js takes. */
export const hexOf = (css: string): number => Number.parseInt(css.slice(1), 16)
