import { useEffect } from 'react'
import { Arcade } from './screens/Arcade'
import { Dave } from './screens/Dave'
import { Home } from './screens/Home'
import { Intro } from './intro/Intro'
import { STORIES } from './intro/stories'
import { Pipes } from './screens/Pipes'
import { Road } from './screens/Road'
import { Prince } from './screens/Prince'
import { Note } from './screens/Note'
import { Settings } from './screens/Settings'
import { Coop } from './screens/Coop'
import { useStore } from './store'
import { unlock } from './audio'
import { startMusic, stopMusic, unlockAudio } from './music/player'

export default function App() {
  const { ready, screen, save, boot, intro, introDone } = useStore()

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
   * Each game gets a tune of its own. For a while Dave was borrowing the
   * maze's, which made two quite different games feel like one game wearing
   * two skins; the caves have their own now, slower and mostly space, and the
   * pipes have the only cheerful thing in here. Everywhere else is quiet.
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
    const tune =
      screen === 'arcade' ? 'chase' : screen === 'dave' ? 'cavern' : screen === 'pipes' ? 'pipes' : screen === 'road' ? 'road' : null
    if (tune) startMusic(tune)
    else stopMusic()
    // `save.music` is in here so switching it back on in settings starts the
    // tune again, rather than waiting for the next change of screen.
  }, [screen, save.music])

  useEffect(() => stopMusic, [])

  if (!ready) return null

  // The intro sits over whatever screen it belongs to, so finishing it lands
  // you in the game rather than back at a menu.
  if (intro && STORIES[intro]) {
    return <Intro story={STORIES[intro]} onDone={introDone} />
  }

  switch (screen) {
    case 'dave':
      return <Dave />
    case 'prince':
      return <Prince />
    case 'pipes':
      return <Pipes />
    case 'road':
      return <Road />
    case 'note':
      return <Note />
    case 'settings':
      return <Settings />
    case 'coop':
      return <Coop />
    case 'arcade':
      return <Arcade />
    default:
      return <Home />
  }
}
