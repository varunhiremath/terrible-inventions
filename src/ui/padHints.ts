/**
 * The little labels over the buttons when a level begins.
 *
 * Every game here draws its controls as plain circles with a glyph in them,
 * and a glyph is only obvious once you already know what it means. The
 * careful-step button in the dungeon is the proof: it is the most useful
 * control in that game and it was described, reasonably, as "the button next
 * to left and right" — because nothing anywhere said otherwise.
 *
 * So each button says what it is for a few seconds at the start of a level and
 * then gets out of the way. Long enough to read, short enough that nobody who
 * already knows has to look at it.
 */

/** Seconds at full strength before the labels start going. */
export const HOLD = 3.5
/** And how long they take to disappear once they start. */
export const FADE = 1.5

export function hintAlpha(seconds: number): number {
  if (seconds <= HOLD) return 1
  if (seconds >= HOLD + FADE) return 0
  return 1 - (seconds - HOLD) / FADE
}

/**
 * One label, in a dark pill, centred above a button.
 *
 * The pill matters: these sit over the game rather than beside it, and white
 * text alone on a bright sky or a lit wall is unreadable exactly when it is
 * most needed.
 */
export function drawHint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  size: number,
  alpha: number,
): void {
  if (alpha <= 0) return

  const was = ctx.globalAlpha
  ctx.globalAlpha = alpha
  ctx.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const padX = size * 0.6
  const padY = size * 0.42
  const wide = ctx.measureText(text).width + padX * 2
  const tall = size + padY * 2
  const round = tall / 2

  ctx.fillStyle = 'rgba(8,10,16,0.88)'
  ctx.beginPath()
  ctx.roundRect(cx - wide / 2, cy - tall / 2, wide, tall, round)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = Math.max(1, size * 0.07)
  ctx.stroke()

  ctx.fillStyle = '#eef2f8'
  ctx.fillText(text, cx, cy + size * 0.04)
  ctx.globalAlpha = was
}

/** What each button is called, per game. Keyed by the pad's own button ids. */
export const LABELS: Record<string, Record<string, string>> = {
  dungeon: {
    left: 'LEFT',
    right: 'RIGHT',
    care: 'CAREFUL',
    down: 'CROUCH',
    up: 'JUMP',
    parry: 'BLOCK',
    strike: 'STRIKE',
  },
  pipes: { left: 'LEFT', right: 'RIGHT', run: 'HOLD TO RUN', jump: 'JUMP' },
  dave: { left: 'LEFT', right: 'RIGHT', up: 'JUMP', fire: 'FIRE', down: 'DOWN' },
  road: { left: 'LEFT', right: 'RIGHT', go: 'HOLD TO GO', brake: 'BRAKE' },
}
