/**
 * The prince and the guards, drawn a pixel at a time.
 *
 * Every other character in this project is built from shapes — circles, arcs,
 * rectangles — and scaled to whatever size the screen gives it. That works for
 * a ghost and it does not work here, because what this game looks like is
 * inseparable from how it was made: a photographed figure traced onto a grid
 * about twenty-five pixels tall, where every pixel was placed by somebody
 * deciding where it went. Shapes drawn small and blown up give you a
 * downscaled drawing, which is a different thing and reads as one.
 *
 * So these are grids. One character per pixel, one letter per colour, and the
 * palette is swapped per character — which is exactly the trick the originals
 * used to get a room full of different guards out of one set of frames.
 */

/**
 * The letters, and what each one is for.
 *
 * Kept deliberately short: these tables are read as pictures, and a sprite you
 * cannot see the shape of while editing is a sprite you cannot draw.
 *
 *   .  nothing        k  the darkest line: boots, the eye, an outline
 *   h  hair           H  hair, lit
 *   s  skin           S  skin in shadow
 *   t  tunic          T  tunic in shadow
 *   r  sash           R  sash in shadow
 *   l  legs           L  legs in shadow
 *   m  blade          g  hilt
 */
export interface Palette {
  k: string
  h: string
  H: string
  s: string
  S: string
  t: string
  T: string
  r: string
  R: string
  l: string
  L: string
  m: string
  g: string
}

export const PRINCE: Palette = {
  k: '#1c1712',
  h: '#3a2a20',
  H: '#543c2c',
  s: '#e8b98f',
  S: '#bd8f68',
  t: '#f2ece0',
  T: '#c3bba7',
  r: '#c8452f',
  R: '#8e2e20',
  l: '#ded7c6',
  L: '#aaa288',
  m: '#d8dee8',
  g: '#c8a24a',
}

/** A guard is the same frames in different clothes. That is the whole trick. */
export function robed(robe: string, shade: string, trim: string, trimShade: string, skin: string, hair: string): Palette {
  return {
    ...PRINCE,
    h: hair,
    H: hair,
    s: skin,
    S: skin,
    t: robe,
    T: shade,
    r: trim,
    R: trimShade,
    l: shade,
    L: trimShade,
  }
}

export interface Sprite {
  rows: readonly string[]
  /** The column that stands over the middle of his tile. */
  anchorX: number
}

const sprite = (anchorX: number, rows: readonly string[]): Sprite => ({ rows, anchorX })

/**
 * Standing.
 *
 * The one everything else is measured against: twenty-six pixels from the
 * crown to the sole, with the head taking seven of them. A head any smaller
 * and the face has nowhere to put a nose; any bigger and he reads as a child.
 */
export const STAND = sprite(6, [
  '.....hhh........',
  '....hhhhh.......',
  '....hhssss......',
  '....hhskss......',
  '....hhsssss.....',
  '....hhsssS......',
  '.....hssS.......',
  '......Ss........',
  '....TTtttt......',
  '...TTttttt......',
  '...TTttttt......',
  '...TTttttt......',
  '...TTttttt......',
  '...TRrrrrr......',
  '...TRrrrrr......',
  '...LLllll.......',
  '...LLllll.......',
  '....LL.ll.......',
  '....LL.ll.......',
  '....LL.ll.......',
  '....LL.ll.......',
  '....LL.ll.......',
  '....LL.ll.......',
  '....LL.ll.......',
  '...kkk.kkk......',
  '...kkk.kkk......',
])

/**
 * Running: four frames, and they are the four the eye actually needs.
 *
 * Two of them are passing positions, where the legs cross under the body, and
 * two are the reaches. What makes it read as a run rather than a bounce is
 * that the two passing frames are not the same drawing — on one the near knee
 * is the one folded up, on the other it is the far one — and that the body
 * leans into it the whole way through.
 */
/**
 * Running: four frames, and they are the four the eye actually needs.
 *
 * Two are passing positions, where one leg is planted under him and the other
 * is folded up behind, and two are the reaches, where a foot lands out in
 * front and the back leg trails. The second half of the stride is the first
 * half on the other leg, so its frames are the same drawings with the near and
 * far shades swapped — which is exactly how a sprite sheet of this size was
 * ever made, and is why a run of four frames reads as a run and not a shuffle.
 *
 * The first attempt had both legs splaying out symmetrically from the hips and
 * neither foot on the ground; it read as a frog squatting.
 */
/**
 * Running: four frames, and they are the four the eye actually needs.
 *
 * Two are passing positions, where one leg is planted under him and the other
 * is folded up behind, and two are the reaches, where a foot lands out in
 * front and the back leg trails through the air. The second half of a stride
 * is the first half on the other leg, so its frames are the same drawings with
 * the near and far shades swapped — which is how a sprite sheet this small was
 * ever made, and is why four frames read as a run rather than a shuffle.
 *
 * The first attempt splayed both legs symmetrically from the hips with neither
 * foot on the ground, and read as a frog squatting.
 */
export const RUN: readonly Sprite[] = [
  // Passing: near leg planted, far leg folded up behind.
  sprite(6, [
    '......hhh.......',
    '.....hhhhh......',
    '.....hhssss.....',
    '.....hhskss.....',
    '.....hhsssss....',
    '.....hhsssS.....',
    '......hssS......',
    '......Ss........',
    '....TTtttt......',
    '...TTtttttts....',
    '...TTttttt.ss...',
    '...TTttttt......',
    '...TRrrrrr......',
    '...TRrrrrr......',
    '...LLllll.......',
    '..LLl..ll.......',
    '.LLl...ll.......',
    'LLl....ll.......',
    'LL.....ll.......',
    'LLl....ll.......',
    '.LLl...ll.......',
    '.kkk...ll.......',
    '.......ll.......',
    '.......ll.......',
    '......kkkk......',
    '......kkkk......',
  ]),
  // Reaching: near foot landing ahead, far leg trailing off the ground.
  sprite(6, [
    '......hhh.......',
    '.....hhhhh......',
    '.....hhssss.....',
    '.....hhskss.....',
    '.....hhsssss....',
    '.....hhsssS.....',
    '......hssS......',
    '......Ss........',
    '....TTtttt......',
    '..sTTtttttt.....',
    '.sssTttttt......',
    '...TTttttt......',
    '...TRrrrrr......',
    '...TRrrrrr......',
    '...LLllll.......',
    '..LLl..ll.......',
    '.LLl....ll......',
    'LLl......ll.....',
    'Ll........ll....',
    'kk........ll....',
    '...........ll...',
    '...........ll...',
    '...........ll...',
    '...........ll...',
    '..........kkkk..',
    '..........kkkk..',
  ]),
  // Passing again, and the far leg is the planted one now.
  sprite(6, [
    '......hhh.......',
    '.....hhhhh......',
    '.....hhssss.....',
    '.....hhskss.....',
    '.....hhsssss....',
    '.....hhsssS.....',
    '......hssS......',
    '......Ss........',
    '....TTtttt......',
    '..sTTtttttt.....',
    '.sssTttttt......',
    '...TTttttt......',
    '...TRrrrrr......',
    '...TRrrrrr......',
    '...llLLLL.......',
    '..llL..LL.......',
    '.llL...LL.......',
    'llL....LL.......',
    'll.....LL.......',
    'llL....LL.......',
    '.llL...LL.......',
    '.kkk...LL.......',
    '.......LL.......',
    '.......LL.......',
    '......kkkk......',
    '......kkkk......',
  ]),
  // Reaching on the other leg: the second half of the same stride.
  sprite(6, [
    '......hhh.......',
    '.....hhhhh......',
    '.....hhssss.....',
    '.....hhskss.....',
    '.....hhsssss....',
    '.....hhsssS.....',
    '......hssS......',
    '......Ss........',
    '....TTtttt......',
    '...TTtttttts....',
    '...TTttttt.ss...',
    '...TTttttt......',
    '...TRrrrrr......',
    '...TRrrrrr......',
    '...llLLLL.......',
    '..llL..LL.......',
    '.llL....LL......',
    'llL......LL.....',
    'lL........LL....',
    'kk........LL....',
    '...........LL...',
    '...........LL...',
    '...........LL...',
    '...........LL...',
    '..........kkkk..',
    '..........kkkk..',
  ]),
]

const CACHE = new Map<string, HTMLCanvasElement>()

/**
 * The sprite as a little image, built once and kept.
 *
 * Three hundred `fillRect` calls per figure per frame is a waste when the
 * answer never changes: the grid becomes a canvas one pixel per cell, and the
 * screen gets one `drawImage` with the smoothing turned off.
 */
function imageFor(key: string, s: Sprite, palette: Palette): HTMLCanvasElement {
  const had = CACHE.get(key)
  if (had) return had

  const w = Math.max(...s.rows.map((r) => r.length))
  const h = s.rows.length
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  s.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ink = row[x]
      if (ink === '.' || ink === ' ') continue
      const colour = palette[ink as keyof Palette]
      if (!colour) continue
      ctx.fillStyle = colour
      ctx.fillRect(x, y, 1, 1)
    }
  })
  CACHE.set(key, cv)
  return cv
}

/**
 * Put a sprite on the screen with his feet on `footY` and his middle on `x`.
 *
 * `tall` is how many screen pixels one sprite pixel gets, and it is rounded to
 * a whole number — a sprite drawn at two-and-a-bit pixels per pixel has rows
 * of different thicknesses, which is visible immediately and looks like a
 * mistake, because it is one.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  s: Sprite,
  palette: Palette,
  x: number,
  footY: number,
  height: number,
  facing: 1 | -1,
): void {
  const img = imageFor(key, s, palette)
  const cell = Math.max(1, Math.round(height / img.height))
  const smoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.translate(Math.round(x), Math.round(footY))
  ctx.scale(facing, 1)
  ctx.drawImage(img, -s.anchorX * cell, -img.height * cell, img.width * cell, img.height * cell)
  ctx.restore()
  ctx.imageSmoothingEnabled = smoothing
}
