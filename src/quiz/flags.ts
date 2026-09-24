/**
 * Flags, drawn rather than downloaded.
 *
 * Every picture in this app is made of rectangles and arcs, and a flag is
 * mostly rectangles and arcs, so there is no reason to break the rule for
 * these. It also means a flag costs about one line of text instead of a file,
 * works with the wifi off, and is sharp at any size on any screen.
 *
 * Each flag is a list of shapes in unit coordinates: 0 to 1 across, 0 to 1
 * down, whatever size it is actually drawn at. The list is painted in order,
 * so later shapes sit on top of earlier ones — a field first, then whatever
 * goes on the field.
 *
 * Flags that need a coat of arms or a written inscription are left out rather
 * than drawn wrong. A quiz that shows you an almost-right flag and then tells
 * you that you were wrong is teaching you something false.
 */

export type Shape =
  /** Equal stripes across the whole field. */
  | { kind: 'bands'; dir: 'h' | 'v'; colors: readonly string[] }
  /** x, y, width, height. */
  | { kind: 'rect'; at: readonly [number, number, number, number]; color: string }
  /** Centre x, centre y, radius — radius is a fraction of the flag's height. */
  | { kind: 'disc'; at: readonly [number, number, number]; color: string }
  /** Centre x, centre y, radius, and how many points. */
  | { kind: 'star'; at: readonly [number, number, number]; color: string; points?: number; turn?: number }
  /** An off-centre cross: how far across the upright sits, and how thick both arms are. */
  | { kind: 'cross'; at: readonly [number, number]; color: string }
  /** Any straight-sided shape, as a list of corners. */
  | { kind: 'poly'; at: readonly (readonly [number, number])[]; color: string }
  /** Centre x, centre y, outer radius, line thickness. */
  | { kind: 'ring'; at: readonly [number, number, number, number]; color: string }
  /** A crescent: centre, radius, and how far the bite is offset. */
  | { kind: 'moon'; at: readonly [number, number, number, number]; color: string; bite: string }

export interface Flag {
  /** The country, spelled as the quiz spells it. */
  country: string
  shapes: readonly Shape[]
}

const WHITE = '#ffffff'
const BLACK = '#111111'

/**
 * The flags themselves.
 *
 * Kept in one place and keyed by a short name so a question can name a flag
 * without repeating its geometry, and so two questions can point at the same
 * one from different directions — here is a flag, whose is it, and: here is a
 * country, which of these four is its flag.
 */
export const FLAGS: Record<string, Flag> = {
  japan: {
    country: 'Japan',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: WHITE },
      { kind: 'disc', at: [0.5, 0.5, 0.3], color: '#bc002d' },
    ],
  },
  bangladesh: {
    country: 'Bangladesh',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#006a4e' },
      { kind: 'disc', at: [0.45, 0.5, 0.3], color: '#f42a41' },
    ],
  },
  france: {
    country: 'France',
    shapes: [{ kind: 'bands', dir: 'v', colors: ['#002395', WHITE, '#ed2939'] }],
  },
  italy: {
    country: 'Italy',
    shapes: [{ kind: 'bands', dir: 'v', colors: ['#008c45', WHITE, '#cd212a'] }],
  },
  ireland: {
    country: 'Ireland',
    shapes: [{ kind: 'bands', dir: 'v', colors: ['#169b62', WHITE, '#ff883e'] }],
  },
  belgium: {
    country: 'Belgium',
    shapes: [{ kind: 'bands', dir: 'v', colors: [BLACK, '#fdda24', '#ef3340'] }],
  },
  nigeria: {
    country: 'Nigeria',
    shapes: [{ kind: 'bands', dir: 'v', colors: ['#008751', WHITE, '#008751'] }],
  },
  peru: {
    country: 'Peru',
    shapes: [{ kind: 'bands', dir: 'v', colors: ['#d91023', WHITE, '#d91023'] }],
  },
  germany: {
    country: 'Germany',
    shapes: [{ kind: 'bands', dir: 'h', colors: [BLACK, '#dd0000', '#ffce00'] }],
  },
  netherlands: {
    country: 'Netherlands',
    shapes: [{ kind: 'bands', dir: 'h', colors: ['#ae1c28', WHITE, '#21468b'] }],
  },
  russia: {
    country: 'Russia',
    shapes: [{ kind: 'bands', dir: 'h', colors: [WHITE, '#0039a6', '#d52b1e'] }],
  },
  ukraine: {
    country: 'Ukraine',
    shapes: [{ kind: 'bands', dir: 'h', colors: ['#0057b7', '#ffd700'] }],
  },
  poland: {
    country: 'Poland',
    shapes: [{ kind: 'bands', dir: 'h', colors: [WHITE, '#dc143c'] }],
  },
  indonesia: {
    country: 'Indonesia',
    shapes: [{ kind: 'bands', dir: 'h', colors: ['#ce1126', WHITE] }],
  },
  austria: {
    country: 'Austria',
    shapes: [{ kind: 'bands', dir: 'h', colors: ['#ed2939', WHITE, '#ed2939'] }],
  },
  india: {
    country: 'India',
    shapes: [
      { kind: 'bands', dir: 'h', colors: ['#ff9933', WHITE, '#138808'] },
      { kind: 'ring', at: [0.5, 0.5, 0.14, 0.022], color: '#000080' },
      { kind: 'disc', at: [0.5, 0.5, 0.03], color: '#000080' },
    ],
  },
  argentina: {
    country: 'Argentina',
    shapes: [
      { kind: 'bands', dir: 'h', colors: ['#74acdf', WHITE, '#74acdf'] },
      { kind: 'disc', at: [0.5, 0.5, 0.11], color: '#f6b40e' },
      { kind: 'ring', at: [0.5, 0.5, 0.115, 0.018], color: '#85340a' },
    ],
  },
  sweden: {
    country: 'Sweden',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#006aa7' },
      { kind: 'cross', at: [0.34, 0.16], color: '#fecc00' },
    ],
  },
  denmark: {
    country: 'Denmark',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#c8102e' },
      { kind: 'cross', at: [0.34, 0.16], color: WHITE },
    ],
  },
  finland: {
    country: 'Finland',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: WHITE },
      { kind: 'cross', at: [0.34, 0.18], color: '#003580' },
    ],
  },
  norway: {
    country: 'Norway',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#ba0c2f' },
      { kind: 'cross', at: [0.34, 0.24], color: WHITE },
      { kind: 'cross', at: [0.34, 0.12], color: '#00205b' },
    ],
  },
  iceland: {
    country: 'Iceland',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#02529c' },
      { kind: 'cross', at: [0.34, 0.24], color: WHITE },
      { kind: 'cross', at: [0.34, 0.12], color: '#dc1e35' },
    ],
  },
  switzerland: {
    country: 'Switzerland',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#d52b1e' },
      { kind: 'rect', at: [0.42, 0.18, 0.16, 0.64], color: WHITE },
      { kind: 'rect', at: [0.26, 0.42, 0.48, 0.16], color: WHITE },
    ],
  },
  greece: {
    country: 'Greece',
    shapes: [
      {
        kind: 'bands',
        dir: 'h',
        colors: ['#0d5eaf', WHITE, '#0d5eaf', WHITE, '#0d5eaf', WHITE, '#0d5eaf', WHITE, '#0d5eaf'],
      },
      /*
       * The canton is square, and square means five stripes tall AND five
       * stripes wide — but x is a fraction of the width and y a fraction of
       * the height, and the flag is wider than it is tall. Written as 0.56 in
       * both at first, which drew it half as wide again as it should be.
       */
      { kind: 'rect', at: [0, 0, 0.37, 0.556], color: '#0d5eaf' },
      { kind: 'rect', at: [0.148, 0, 0.074, 0.556], color: WHITE },
      { kind: 'rect', at: [0, 0.222, 0.37, 0.111], color: WHITE },
    ],
  },
  vietnam: {
    country: 'Vietnam',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#da251d' },
      { kind: 'star', at: [0.5, 0.5, 0.3], color: '#ffff00' },
    ],
  },
  turkey: {
    country: 'Turkey',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#e30a17' },
      { kind: 'moon', at: [0.36, 0.5, 0.25, 0.09], color: WHITE, bite: '#e30a17' },
      { kind: 'star', at: [0.56, 0.5, 0.12], color: WHITE },
    ],
  },
  china: {
    country: 'China',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#de2910' },
      { kind: 'star', at: [0.17, 0.27, 0.16], color: '#ffde00' },
      { kind: 'star', at: [0.33, 0.12, 0.06], color: '#ffde00' },
      { kind: 'star', at: [0.4, 0.24, 0.06], color: '#ffde00' },
      { kind: 'star', at: [0.4, 0.4, 0.06], color: '#ffde00' },
      { kind: 'star', at: [0.33, 0.47, 0.06], color: '#ffde00' },
    ],
  },
  brazil: {
    country: 'Brazil',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#009c3b' },
      {
        kind: 'poly',
        at: [[0.5, 0.09], [0.93, 0.5], [0.5, 0.91], [0.07, 0.5]],
        color: '#ffdf00',
      },
      { kind: 'disc', at: [0.5, 0.5, 0.21], color: '#002776' },
    ],
  },
  portugal: {
    country: 'Portugal',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#da291c' },
      { kind: 'rect', at: [0, 0, 0.4, 1], color: '#046a38' },
      { kind: 'disc', at: [0.4, 0.5, 0.2], color: '#ffe900' },
      { kind: 'disc', at: [0.4, 0.5, 0.15], color: '#da291c' },
      { kind: 'disc', at: [0.4, 0.5, 0.1], color: WHITE },
    ],
  },
  canada: {
    country: 'Canada',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: WHITE },
      { kind: 'rect', at: [0, 0, 0.25, 1], color: '#d80621' },
      { kind: 'rect', at: [0.75, 0, 0.25, 1], color: '#d80621' },
      {
        // Eleven points, the way the real one has eleven points.
        kind: 'poly',
        at: [
          [0.5, 0.12], [0.535, 0.31], [0.61, 0.27], [0.59, 0.37], [0.68, 0.42],
          [0.63, 0.47], [0.66, 0.54], [0.55, 0.52], [0.53, 0.58], [0.5, 0.55],
          [0.47, 0.58], [0.45, 0.52], [0.34, 0.54], [0.37, 0.47], [0.32, 0.42],
          [0.41, 0.37], [0.39, 0.27], [0.465, 0.31],
        ],
        color: '#d80621',
      },
      { kind: 'rect', at: [0.487, 0.55, 0.026, 0.24], color: '#d80621' },
    ],
  },
  czechia: {
    country: 'Czechia',
    shapes: [
      { kind: 'bands', dir: 'h', colors: [WHITE, '#d7141a'] },
      { kind: 'poly', at: [[0, 0], [0.45, 0.5], [0, 1]], color: '#11457e' },
    ],
  },
  cuba: {
    country: 'Cuba',
    shapes: [
      {
        kind: 'bands',
        dir: 'h',
        colors: ['#002a8f', WHITE, '#002a8f', WHITE, '#002a8f'],
      },
      { kind: 'poly', at: [[0, 0], [0.42, 0.5], [0, 1]], color: '#cf142b' },
      { kind: 'star', at: [0.14, 0.5, 0.16], color: WHITE },
    ],
  },
  jamaica: {
    country: 'Jamaica',
    shapes: [
      // Green top and bottom, black at the hoist and the fly. Drawn the other
      // way round at first, which every test passed and no test could see.
      { kind: 'rect', at: [0, 0, 1, 1], color: '#009b3a' },
      { kind: 'poly', at: [[0, 0], [0.5, 0.5], [0, 1]], color: BLACK },
      { kind: 'poly', at: [[1, 0], [0.5, 0.5], [1, 1]], color: BLACK },
      { kind: 'poly', at: [[0, 0], [0.08, 0], [0.92, 1], [1, 1], [1, 0.92], [0.08, 0]], color: '#fed100' },
      { kind: 'poly', at: [[1, 0], [0.92, 0], [0.08, 1], [0, 1], [0, 0.92], [0.92, 0]], color: '#fed100' },
    ],
  },
  chile: {
    country: 'Chile',
    shapes: [
      { kind: 'bands', dir: 'h', colors: [WHITE, '#d52b1e'] },
      { kind: 'rect', at: [0, 0, 0.34, 0.5], color: '#0039a6' },
      { kind: 'star', at: [0.17, 0.25, 0.17], color: WHITE },
    ],
  },
  usa: {
    country: 'United States',
    shapes: [
      {
        kind: 'bands',
        dir: 'h',
        colors: [
          '#b31942', WHITE, '#b31942', WHITE, '#b31942', WHITE, '#b31942',
          WHITE, '#b31942', WHITE, '#b31942', WHITE, '#b31942',
        ],
      },
      { kind: 'rect', at: [0, 0, 0.4, 0.538], color: '#0a3161' },
      ...Array.from({ length: 20 }, (_, i) => {
        const row = Math.floor(i / 5)
        const col = i % 5
        return {
          kind: 'star' as const,
          at: [0.05 + col * 0.077 + (row % 2) * 0.038, 0.08 + row * 0.125, 0.045] as const,
          color: WHITE,
        }
      }),
    ],
  },
  uk: {
    country: 'United Kingdom',
    shapes: [
      { kind: 'rect', at: [0, 0, 1, 1], color: '#012169' },
      { kind: 'poly', at: [[0, 0], [0.16, 0], [1, 0.84], [1, 1], [0.84, 1], [0, 0.16]], color: WHITE },
      { kind: 'poly', at: [[1, 0], [0.84, 0], [0, 0.84], [0, 1], [0.16, 1], [1, 0.16]], color: WHITE },
      { kind: 'poly', at: [[0, 0], [0.09, 0], [1, 0.91], [1, 1], [0.91, 1], [0, 0.09]], color: '#c8102e' },
      { kind: 'poly', at: [[1, 0], [0.91, 0], [0, 0.91], [0, 1], [0.09, 1], [1, 0.09]], color: '#c8102e' },
      { kind: 'rect', at: [0.38, 0, 0.24, 1], color: WHITE },
      { kind: 'rect', at: [0, 0.35, 1, 0.3], color: WHITE },
      { kind: 'rect', at: [0.42, 0, 0.16, 1], color: '#c8102e' },
      { kind: 'rect', at: [0, 0.4, 1, 0.2], color: '#c8102e' },
    ],
  },
}

export type FlagName = keyof typeof FLAGS

/**
 * Country name to flag, for questions that name a country and want its flag.
 *
 * Built from the flags themselves rather than written out again, so a name can
 * only ever be spelled one way.
 */
export const FLAG_OF: Record<string, string> = Object.fromEntries(
  Object.entries(FLAGS).map(([key, flag]) => [flag.country, key]),
)
