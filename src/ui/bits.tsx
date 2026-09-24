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
