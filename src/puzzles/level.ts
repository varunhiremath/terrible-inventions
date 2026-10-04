/**
 * The notebook.
 *
 * Not one game but three, which is the point: the puzzles on the back of a
 * cereal packet are never all the same puzzle. Draw this without lifting your
 * pen. Find the way out. Join the dots up and fill the page.
 *
 * What makes them one game rather than three is the control. All three are
 * played by putting a finger down and dragging a line, and nothing else — no
 * buttons, no modes, nothing to learn twice. The rest is what the line is
 * allowed to do.
 */
export const KINDS = ['stroke', 'maze', 'flow'] as const
export type Kind = (typeof KINDS)[number]

export const KIND_SAYS: Record<Kind, string> = {
  stroke: 'Draw it without lifting your finger, and no line twice.',
  maze: 'Find the way from the top corner to the bottom one.',
  flow: 'Join each pair up. Fill every square. No crossing.',
}

export const KIND_TITLE: Record<Kind, string> = {
  stroke: 'One line',
  maze: 'The way out',
  flow: 'Join them up',
}

/**
 * Which puzzle comes next.
 *
 * Round the three in order rather than at random. A random one can hand
 * somebody three mazes in a row, and the whole promise of a notebook is that
 * you turn the page and it is something else.
 */
export const kindFor = (level: number): Kind => KINDS[(level - 1) % KINDS.length]

/** Which time round the three this is, counting from nought. */
export const roundOf = (level: number): number => Math.floor((level - 1) / KINDS.length)

/**
 * How big each kind gets.
 *
 * Gently, and with a ceiling on all three. A maze that takes four minutes to
 * trace is not harder than one that takes one, it is the same maze with more
 * of it, and the finger holding the line down is the thing that gets tired.
 */
export function sizeFor(kind: Kind, level: number): {
  across: number; down: number; want: number
} {
  const round = roundOf(level)
  if (kind === 'stroke') {
    return {
      across: Math.min(6, 4 + Math.floor(round / 3)),
      down: Math.min(6, 4 + Math.floor(round / 3)),
      want: Math.min(26, 11 + round * 2),
    }
  }
  if (kind === 'maze') {
    return {
      across: Math.min(13, 7 + round * 2),
      down: Math.min(17, 9 + round * 2),
      want: 0,
    }
  }
  // Both sides have to be even: the loop the board is cut out of is traced
  // round a tree on a grid of half the size, and half of seven is not a grid.
  return {
    across: Math.min(10, 6 + Math.floor(round / 2) * 2),
    down: Math.min(10, 6 + Math.floor(round / 2) * 2),
    want: Math.min(7, 3 + Math.floor(round / 2)),
  }
}

/** The colours the dots come in, which is all the colour this game has. */
export const INKS = [
  '#e0453a', '#2f7fd6', '#3fb57a', '#e0a52f', '#d64fb7', '#45c7d6', '#f08a3c',
] as const
