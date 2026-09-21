import { useEffect } from 'react'
import { Arcade } from './screens/Arcade'
import { Dave } from './screens/Dave'
import { Prince } from './screens/Prince'
import { Shop } from './screens/Shop'
import { Note } from './screens/Note'
import { Settings } from './screens/Settings'
import { Studio } from './screens/Studio'
import { Coop } from './screens/Coop'
import { useStore } from './store'
import { unlock } from './audio'
import { startMusic, stopMusic, unlockAudio } from './music/player'

export default function App() {
  const { ready, screen, save, boot } = useStore()

  useEffect(() => {
    void boot()
  }, [boot])

  // iOS keeps audio muted until a real gesture opens it, so the first tap
  // anywhere is what makes {papa}'s voice possible later in the session. The
  // music needs the same permission and is easy to forget, because on a
  // desktop browser it starts without it and everything looks fine.
  useEffect(() => {
    const open = () => {
      unlock()
      unlockAudio()
    }
    window.addEventListener('pointerdown', open, { once: true })
    window.addEventListener('keydown', open, { once: true })
    return () => {
      window.removeEventListener('pointerdown', open)
      window.removeEventListener('keydown', open)
    }
  }, [])

  /*
   * Each screen gets its tune. The maze is the chase; the shop is the same
   * four chords at half the speed, because a maths problem is on screen there
   * and music that hurries you is the last thing that helps. Everywhere else
   * is quiet.
   */
  useEffect(() => {
    if (!save.music) {
      stopMusic()
      return
    }
    // The dungeon is deliberately not in this list. It scores itself out of
    // short cues fired by what happens — a level starting, a guard noticing
    // you, a blade landing, the clock — and it is silent in between, which is
    // how the original worked and most of why those cues land at all. A loop
    // running underneath would take that away, and for a while one was: the
    // chase tune from the maze was playing over the whole thing.
    if (screen === 'arcade' || screen === 'dave') startMusic('chase')
    else if (screen === 'shop') startMusic('shop')
    else stopMusic()
    // `save.music` is in here so switching it back on in settings starts the
    // tune again, rather than waiting for the next change of screen.
  }, [screen, save.music])

  useEffect(() => stopMusic, [])

  if (!ready) return null

  switch (screen) {
    case 'dave':
      return <Dave />
    case 'prince':
      return <Prince />
    case 'shop':
      return <Shop />
    case 'note':
      return <Note />
    case 'settings':
      return <Settings />
    case 'studio':
      return <Studio />
    case 'coop':
      return <Coop />
    default:
      return <Arcade />
  }
}
