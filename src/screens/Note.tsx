import { useEffect } from 'react'
import { fill } from '../config/profile'
import { Btn, Panel, Screen } from '../ui/bits'
import { useStore } from '../store'

export function Note() {
  const { save, markNoteSeen, go } = useStore()

  useEffect(() => {
    markNoteSeen()
  }, [markNoteSeen])

  return (
    <Screen>
      <h1 className="text-2xl font-extrabold tracking-tight">{fill('From {papa}')}</h1>

      <Panel className="border-bolt/40 bg-bolt/10">
        <p className="whitespace-pre-wrap text-xl leading-relaxed">
          {save.note?.text ?? fill('Nothing from {papa} right now.')}
        </p>
      </Panel>

      <Btn tone="go" onClick={() => go('world')}>
        Right then
      </Btn>
    </Screen>
  )
}
