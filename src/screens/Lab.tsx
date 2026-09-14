import { GENERATORS } from '../content'
import { fill, getProfile } from '../config/profile'
import { Btn, Panel, Screen, Tag } from '../ui/bits'
import { useStore } from '../store'

export function Lab() {
  const { save, startSession, startCoop, go } = useStore()
  const { kidName } = getProfile()
  const unreadNote = save.note && !save.note.seen

  return (
    <Screen>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
            Terrible
            <br />
            Inventions
          </h1>
          <p className="mt-2 text-dim">
            {fill('{papa} built these. They all went wrong.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => go('settings')}
          className="block-btn px-4 py-3 text-sm"
          aria-label="Settings"
        >
          &#9881;
        </button>
      </header>

      {unreadNote && (
        <button type="button" onClick={() => go('note')} className="block-btn border-bolt bg-bolt/15 text-left">
          <span className="flex items-center gap-3">
            <Tag tone="warn">New</Tag>
            <span>{fill('A note from {papa}')}</span>
          </span>
        </button>
      )}

      <Btn tone="go" onClick={startSession} className="py-8 text-2xl">
        Fix a Machine
      </Btn>

      <Btn onClick={startCoop} className="py-6 text-xl">
        {fill('Get {papa}')}
        <span className="block text-sm font-normal text-dim">
          A puzzle neither of you can do alone
        </span>
      </Btn>

      {save.machinesWorked > 0 && (
        <Panel>
          <p className="text-dim">
            {kidName} has taken apart{' '}
            <span className="font-bold text-chalk">{save.machinesWorked}</span>{' '}
            {save.machinesWorked === 1 ? 'machine' : 'machines'} so far.
          </p>
        </Panel>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-dim">What is broken</h2>
        {GENERATORS.map((g) => (
          <Panel key={g.id} className="flex items-baseline justify-between gap-4">
            <span className="font-bold">{fill(g.name)}</span>
            <span className="text-right text-sm text-dim">{fill(g.blurb)}</span>
          </Panel>
        ))}
      </div>
    </Screen>
  )
}
