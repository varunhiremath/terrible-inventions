/**
 * The one-liners each game opens with.
 *
 * In one place because two things read them: the screens that say them, and
 * the renderer that turns every known line into an audio clip before the app
 * ships. When they were written inline the renderer had to go hunting for them
 * with a regular expression, and the moment a call site was reworded slightly
 * the clip stopped matching and the phone's synthesiser quietly took over —
 * which sounds exactly like the bug it was meant to fix.
 *
 * Placeholders stay in: the clip is keyed by the line as written here.
 */
export const OPENERS = {
  caves: 'Into the hideout, then. Do try not to touch anything hot.',
  dungeon: 'Down you go. You have got an hour, and I have got all the guards.',
  coop: 'Right then. {kid} versus {papa}. Off we go.',
} as const

export type Opener = keyof typeof OPENERS
