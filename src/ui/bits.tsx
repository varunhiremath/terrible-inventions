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
