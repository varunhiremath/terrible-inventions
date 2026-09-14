import { useEffect } from 'react'
import { Lab } from './screens/Lab'
import { Gauntlet } from './screens/Gauntlet'
import { Summary } from './screens/Summary'
import { Note } from './screens/Note'
import { Settings } from './screens/Settings'
import { Studio } from './screens/Studio'
import { useStore } from './store'
import { unlock } from './audio'

export default function App() {
  const { ready, screen, boot } = useStore()

  useEffect(() => {
    void boot()
  }, [boot])

  // iOS keeps audio muted until a real gesture opens it, so the first tap
  // anywhere is what makes {papa}'s voice possible later in the session.
  useEffect(() => {
    const open = () => unlock()
    window.addEventListener('pointerdown', open, { once: true })
    return () => window.removeEventListener('pointerdown', open)
  }, [])

  if (!ready) return null

  switch (screen) {
    case 'gauntlet':
      return <Gauntlet />
    case 'summary':
      return <Summary />
    case 'note':
      return <Note />
    case 'settings':
      return <Settings />
    case 'studio':
      return <Studio />
    default:
      return <Lab />
  }
}
