import type { ReactNode } from 'react'

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">{children}</div>
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`block-panel p-4 sm:p-5 ${className}`}>{children}</div>
}

type BtnProps = {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'plain' | 'go' | 'pick' | 'chosen'
  className?: string
}

export function Btn({ children, onClick, disabled, tone = 'plain', className = '' }: BtnProps) {
  const tones = {
    plain: 'bg-ink-soft text-chalk',
    go: 'bg-bolt text-ink border-bolt',
    pick: 'bg-ink-soft text-chalk hover:border-sky/60',
    chosen: 'bg-sky text-ink border-sky',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // 60px minimum: a finger is not a mouse pointer.
      className={`block-btn min-h-[60px] ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Tag({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'warn' | 'good' }) {
  const tones = {
    dim: 'bg-ink-line text-dim',
    warn: 'bg-bolt/15 text-bolt',
    good: 'bg-moss/15 text-moss',
  }
  return (
    <span className={`rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  )
}

/**
 * The way out of a game.
 *
 * It used to sit in the bottom-right corner, a few millimetres from the jump
 * button and directly above the phone's own navigation bar, and it was being
 * pressed by accident mid-game — which drops you out of a run you were in the
 * middle of. Top-left instead: the far corner from both thumbs on a phone held
 * sideways, and nowhere near anything the system owns.
 *
 * Still quiet. It is a way out, not something to be invited to press.
 */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back to the menu"
      onClick={onClick}
      // The pointer handlers below the canvas steer the game; a press meant
      // for this button must not also be read as a press on the board.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="absolute left-2 top-1 z-20 flex items-center gap-1 rounded-lg px-2 py-1.5
                 font-mono text-[0.7rem] uppercase tracking-widest text-dim/60
                 active:text-chalk"
    >
      <span aria-hidden="true" className="text-sm leading-none">&lsaquo;</span>
      back
    </button>
  )
}

/**
 * A switch, for the things that are simply on or off.
 *
 * The settings used to give every yes-or-no question a pair of chunky buttons
 * side by side, one of them highlighted. That is four times the ink and twice
 * the width of the thing it is asking, and a screen of them reads like a form
 * from 1998. A switch says the same thing in one control and is the shape
 * every phone has trained everybody to recognise.
 */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        on ? 'bg-moss/80' : 'bg-ink-line'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-1 h-5 w-5 rounded-full bg-chalk shadow transition-all ${
          on ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}

/**
 * One line of settings: what it is on the left, the control on the right.
 *
 * The old screen put a heading, a paragraph and a control in a panel of its
 * own for every single option, so seven options were seven panels and a great
 * deal of scrolling. A row with a name, one line of explanation and the
 * control beside it fits the same information in a fifth of the height.
 */
export function Row({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-bold text-chalk">{title}</p>
        {hint && <p className="mt-0.5 text-xs leading-snug text-dim">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

/** A titled group of rows, with hairlines between them. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="block-panel px-4 py-1 sm:px-5">
      <h2 className="pt-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-dim">
        {title}
      </h2>
      <div className="divide-y divide-white/5">{children}</div>
    </section>
  )
}
