import { useRef, useState } from 'react'
import { fill } from '../config/profile'
import { STORIES, STORY_ORDER } from '../intro/stories'
import { Btn, Group, Row, Screen, Toggle } from '../ui/bits'
import { exportSave, importSave } from '../engine/storage'
import { useStore } from '../store'
import { BUILD_ID, checkForUpdate, takeUpdate } from '../update'
import { UpdatePill } from '../ui/UpdatePill'

/**
 * {papa}'s corner.
 *
 * Not hidden behind a passcode — a nine-year-old who goes looking in here
 * finds his own name and a text box, which is not a catastrophe.
 *
 * Rebuilt because it had grown into seven stacked panels, each with a heading,
 * a paragraph of explanation and a pair of chunky buttons for what was usually
 * a yes-or-no question. Everything was the same size and the same weight, so
 * nothing was findable, and it read like a form. Now it is rows: the name of
 * the thing, one line saying what it does, and the control beside it.
 *
 * Two things went entirely rather than being tidied.
 *
 * The list of the phone's own voices is gone. It existed because the app had
 * to guess which installed reader sounded least wrong, and the guess was bad —
 * but the answer to that turned out to be shipping our own recordings rather
 * than choosing better among the phone's, and with those in place the device
 * voice is a fallback nobody should have to shop for. It was also reported as
 * useless in exactly those words: they all sound the same.
 *
 * And the grid of shortcuts to four of the six games, which duplicated the
 * front screen badly — the front screen is a place you walk around with all
 * six doors in it, and this was a worse copy of it that had fallen two games
 * behind.
 */
export function Settings() {
  const {
    save, saveNames, saveNote, replaceSave, setRewards, setVoice, setMusic, go,
    watchIntro, startCoop, setRelay,
  } = useStore()

  const [kidName, setKidName] = useState(save.names.kidName ?? '')
  const [papaName, setPapaName] = useState(save.names.papaName ?? '')
  const [note, setNote] = useState(save.note?.text ?? '')
  const [rewards, setRewardText] = useState(save.rewards.join('\n'))
  const [status, setStatus] = useState('')
  const [relay, setRelayText] = useState(save.relay ?? '')
  const [looking, setLooking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const field =
    'w-full rounded-xl border-2 border-ink-line bg-ink px-3 py-2.5 text-base text-chalk outline-none focus:border-sky'

  const download = () => {
    const blob = new Blob([exportSave(save)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terrible-inventions-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const restore = async (file: File) => {
    try {
      replaceSave(importSave(await file.text()))
      setStatus('Restored.')
    } catch {
      setStatus('That file did not look like a backup.')
    }
  }

  /*
   * Asking for a new version by hand.
   *
   * The app already asks every time it comes back to the foreground, so this
   * button is mostly for reassurance — but reassurance is the whole reason it
   * was asked for, and a button that reports "you are on the latest one" is
   * worth having even when it never has anything else to say.
   */
  const look = () => {
    setLooking(true)
    setStatus('')
    checkForUpdate()
    window.setTimeout(() => {
      setLooking(false)
      setStatus(
        document.body.textContent?.includes('New version')
          ? ''
          : 'This is the latest version.',
      )
    }, 2500)
  }

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <button type="button" onClick={() => go('home')} className="text-sm text-dim">
          Done
        </button>
      </header>

      <Group title="Sound">
        <Row title="Voice" hint={fill("{papa} reads his lines out loud.")}>
          <Toggle
            label="Voice"
            on={save.voice === 'computer'}
            onChange={(on) => setVoice(on ? 'computer' : 'off')}
          />
        </Row>
        <Row title="Music" hint="A tune under each game. Ducks when anybody speaks.">
          <Toggle label="Music" on={save.music} onChange={setMusic} />
        </Row>
      </Group>

      <Group title="This app">
        <Row title="Version" hint={BUILD_ID}>
          <div className="flex items-center gap-2">
            <UpdatePill />
            <Btn onClick={look} className="px-3 py-2 text-xs">
              {looking ? 'Looking…' : 'Check'}
            </Btn>
          </div>
        </Row>
        <Row
          title="Reload"
          hint="Throws away what is loaded and fetches it again, if something looks stuck."
        >
          <Btn onClick={() => void takeUpdate()} className="px-3 py-2 text-xs">
            Reload
          </Btn>
        </Row>
      </Group>

      <Group title="Names">
        <div className="py-3">
          <p className="text-xs leading-snug text-dim">
            Kept on this device only, and never in the code or any backup you share.
            Everything written in the games says {'{kid}'} and {'{papa}'} until these
            fill them in.
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <input
              className={field}
              value={kidName}
              onChange={(e) => setKidName(e.target.value)}
              placeholder="Player"
              aria-label="Player name"
            />
            <input
              className={field}
              value={papaName}
              onChange={(e) => setPapaName(e.target.value)}
              placeholder="Grown-up"
              aria-label="Grown-up name"
            />
          </div>
          <Btn
            className="mt-2 px-3 py-2 text-sm"
            onClick={() => {
              saveNames({ kidName: kidName.trim(), papaName: papaName.trim() })
              setStatus('Names saved.')
            }}
          >
            Save names
          </Btn>
        </div>
      </Group>

      <Group title="Rewards">
        <div className="py-3">
          <p className="text-xs leading-snug text-dim">
            One per line. Offered when he beats something of {fill('{papa}')}&rsquo;s.
          </p>
          <textarea
            className={`${field} mt-2.5 h-24`}
            value={rewards}
            onChange={(e) => setRewardText(e.target.value)}
            aria-label="Rewards"
          />
          <Btn
            className="mt-2 px-3 py-2 text-sm"
            onClick={() => {
              setRewards(rewards.split('\n').map((r) => r.trim()).filter(Boolean))
              setStatus('Rewards saved.')
            }}
          >
            Save rewards
          </Btn>
        </div>
      </Group>

      <Group title="A note for him">
        <div className="py-3">
          <p className="text-xs leading-snug text-dim">
            Shown once, the next time he opens the app.
          </p>
          <textarea
            className={`${field} mt-2.5 h-20`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Note"
          />
          <Btn
            className="mt-2 px-3 py-2 text-sm"
            onClick={() => {
              saveNote(note.trim())
              setStatus(note.trim() ? 'Note saved.' : 'Note cleared.')
            }}
          >
            Save note
          </Btn>
        </div>
      </Group>

      <Group title="Playing together">
        <Row title="Two-player puzzle" hint="One puzzle, two halves of the clues, one device.">
          <Btn onClick={startCoop} className="px-3 py-2 text-xs">Start</Btn>
        </Row>
        <div className="py-3">
          <p className="text-sm font-bold text-chalk">Relay</p>
          <p className="mt-0.5 text-xs leading-snug text-dim">
            For racing on two devices. They need something in the middle to pass
            messages between them — run{' '}
            <span className="text-chalk">node server/relay.mjs</span> on a laptop on
            the same wifi and it prints the address. See server/README.md.
          </p>
          <input
            className={`${field} mt-2.5`}
            value={relay}
            onChange={(e) => setRelayText(e.target.value)}
            onBlur={() => setRelay(relay)}
            placeholder="ws://192.168.1.24:8787"
            aria-label="Relay address"
          />
        </div>
      </Group>

      <Group title="Intros">
        <div className="py-3">
          <p className="text-xs leading-snug text-dim">Watch any of them again.</p>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {STORY_ORDER.map((id) => (
              <Btn key={id} onClick={() => watchIntro(id)} className="px-1.5 py-2 text-[0.7rem]">
                {STORIES[id].title}
              </Btn>
            ))}
          </div>
        </div>
      </Group>

      <Group title="Backup">
        <Row
          title="Save a copy"
          hint="Progress lives in this browser and nowhere else, and iOS clears that for apps it thinks are unused."
        >
          <Btn onClick={download} className="px-3 py-2 text-xs">Save</Btn>
        </Row>
        <Row title="Restore" hint="From a backup file taken earlier.">
          <Btn onClick={() => fileRef.current?.click()} className="px-3 py-2 text-xs">
            Restore
          </Btn>
        </Row>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void restore(file)
          }}
        />
      </Group>

      {status && <p className="pb-2 text-center text-sm text-moss">{status}</p>}
    </Screen>
  )
}
