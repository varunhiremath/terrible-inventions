import { useEffect, useRef, useState } from 'react'
import { fill, getProfile } from '../config/profile'
import { STORIES, STORY_ORDER } from '../intro/stories'
import { Btn, Panel, Screen } from '../ui/bits'
import { exportSave, importSave } from '../engine/storage'
import { useStore } from '../store'
import { availableVoices, chooseVoice, chosenVoice, currentVoiceName } from '../speech'
import { say } from '../voice'

/**
 * {papa}'s corner. Not hidden behind a passcode — an eight-year-old who goes
 * looking in here finds his own name and a text box, which is not a catastrophe.
 */
export function Settings() {
  const { save, saveNames, saveNote, replaceSave, setRewards, setVoice, setMusic, go, watchIntro, startCoop } = useStore()
  const profile = getProfile()

  const [kidName, setKidName] = useState(save.names.kidName ?? '')
  const [papaName, setPapaName] = useState(save.names.papaName ?? '')
  const [note, setNote] = useState(save.note?.text ?? '')
  const [rewards, setRewardText] = useState(save.rewards.join('\n'))
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  /*
   * The device's own voices, which arrive late on some browsers and not at all
   * until something has spoken on others — so the list is re-read when the
   * synthesiser says it has them, rather than read once and trusted.
   */
  const [voices, setVoices] = useState(availableVoices())
  const [picked, setPicked] = useState(chosenVoice())
  useEffect(() => {
    const refresh = () => setVoices(availableVoices())
    refresh()
    speechSynthesis?.addEventListener?.('voiceschanged', refresh)
    const timer = window.setTimeout(refresh, 400)
    return () => {
      speechSynthesis?.removeEventListener?.('voiceschanged', refresh)
      window.clearTimeout(timer)
    }
  }, [])

  const tryVoice = (name: string | null) => {
    chooseVoice(name)
    setPicked(name)
    say(fill('Right then. {kid} versus {papa}. Off we go.'), { as: 'papa' })
  }

  const field =
    'w-full rounded-xl border-2 border-ink-line bg-ink px-4 py-3 text-lg text-chalk outline-none focus:border-sky'

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

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <button type="button" onClick={() => go('home')} className="text-sm text-dim">
          Done
        </button>
      </header>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">{fill('What beating {papa} is worth')}</h2>
        <p className="text-sm leading-relaxed text-dim">
          One promise per line, used in order. Shown when he clears a level, so these reward
          getting through something hard rather than being quick at sums.
        </p>
        <textarea
          className={`${field} min-h-[96px] resize-y`}
          value={rewards}
          placeholder={'You pick tonight\u2019s film\nStay up twenty minutes later\nChoose Saturday breakfast'}
          onChange={(e) => setRewardText(e.target.value)}
          aria-label="Rewards"
        />
        <Btn
          onClick={() => {
            const list = rewards.split('\n').map((r) => r.trim()).filter(Boolean)
            setRewards(list)
            setStatus(list.length ? `${list.length} promise${list.length === 1 ? '' : 's'} saved.` : 'Promises cleared.')
          }}
        >
          Save promises
        </Btn>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">Names</h2>
        <p className="text-sm leading-relaxed text-dim">
          These are stored only on this device and are never sent anywhere. The code in the
          repository ships with placeholders, so no real name is in it.
        </p>
        <input
          className={field}
          value={kidName}
          placeholder={profile.kidName}
          onChange={(e) => setKidName(e.target.value)}
          aria-label="Player name"
        />
        <input
          className={field}
          value={papaName}
          placeholder={profile.papaName}
          onChange={(e) => setPapaName(e.target.value)}
          aria-label="Grown-up name"
        />
        <Btn
          onClick={() => {
            saveNames({ kidName: kidName.trim() || undefined, papaName: papaName.trim() || undefined })
            setStatus('Names saved.')
          }}
        >
          Save names
        </Btn>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">Leave a note</h2>
        <p className="text-sm text-dim">Shown once, the next time he opens the app.</p>
        <textarea
          className={`${field} min-h-[120px] resize-y`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note"
        />
        <Btn
          onClick={() => {
            saveNote(note)
            setStatus(note.trim() ? 'Note saved.' : 'Note cleared.')
          }}
        >
          Save note
        </Btn>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">Voice</h2>
        <p className="text-sm leading-relaxed text-dim">
          The computer voice reads every line, including ones written later, and each
          character gets its own pitch.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([['computer', 'Computer'], ['off', 'Silent']] as const).map(
            ([value, label]) => (
              <Btn
                key={value}
                tone={save.voice === value ? 'chosen' : 'plain'}
                onClick={() => setVoice(value)}
                className="px-3 py-3 text-sm"
              >
                {label}
              </Btn>
            ),
          )}
        </div>

        {/*
          * Which voice, chosen here rather than guessed.
          *
          * The app picks the deepest male voice it can recognise, but what a
          * phone actually has installed is not something it can be told from
          * here — Android names four different readers "English (United
          * Kingdom)" — and the guess came out as a woman's voice once already.
          * Tapping one says a line in it, so it can be chosen by ear in about
          * ten seconds, which beats any amount of cleverness.
          *
          * Kept on the device, not in the save: a backup restored on the
          * tablet should not name a voice the tablet does not have.
          */}
        {save.voice === 'computer' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Which voice</h3>
            <p className="text-xs leading-relaxed text-dim">
              Tap one to hear it. Using {currentVoiceName()} right now.
            </p>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              <Btn
                tone={picked === null ? 'chosen' : 'plain'}
                onClick={() => tryVoice(null)}
                className="px-3 py-2 text-left text-sm"
              >
                Pick the deepest one automatically
              </Btn>
              {voices.map((voice) => (
                <Btn
                  key={voice.voiceURI}
                  tone={picked === voice.name ? 'chosen' : 'plain'}
                  onClick={() => tryVoice(voice.name)}
                  className="px-3 py-2 text-left text-sm"
                >
                  {voice.name} <span className="text-dim">{voice.lang}</span>
                </Btn>
              ))}
              {voices.length === 0 && (
                <p className="text-xs text-dim">
                  This device has not handed over its voice list yet. Play a game and come back.
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">Games</h2>
        <p className="text-sm leading-relaxed text-dim">
          Both are here. Losing a life in either one offers the shop, which is where the
          maths lives.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={() => go('home')} className="px-3 py-3 text-sm">Papa Panic</Btn>
          <Btn onClick={() => go('dave')} className="px-3 py-3 text-sm">The Caves</Btn>
          <Btn onClick={() => go('prince')} className="px-3 py-3 text-sm">The Dungeon</Btn>
          <Btn onClick={() => go('pipes')} className="px-3 py-3 text-sm">The Pipes</Btn>
        </div>
        <Btn onClick={startCoop} className="px-3 py-3 text-sm">Two-player puzzle</Btn>
        <p className="mt-3 text-sm text-dim">Watch an intro again</p>
        <div className="grid grid-cols-4 gap-2">
          {STORY_ORDER.map((id) => (
            <Btn key={id} onClick={() => watchIntro(id)} className="px-2 py-3 text-xs">
              {STORIES[id].title}
            </Btn>
          ))}
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">Music</h2>
        <p className="text-sm leading-relaxed text-dim">
          A tune plays under the maze and a slower one in the shop. It drops out of the way
          on its own whenever {fill('{papa}')} says something. Some days it is the last thing
          anyone wants.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([[true, 'On'], [false, 'Off']] as const).map(([value, label]) => (
            <Btn
              key={label}
              tone={save.music === value ? 'chosen' : 'plain'}
              onClick={() => setMusic(value)}
              className="px-3 py-3 text-sm"
            >
              {label}
            </Btn>
          ))}
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">Backup</h2>
        <p className="text-sm leading-relaxed text-dim">
          Progress lives in this browser&rsquo;s storage and nowhere else. iOS can clear that for
          apps it thinks are unused, so take a copy occasionally.
        </p>
        <Btn onClick={download}>Save a backup file</Btn>
        <Btn onClick={() => fileRef.current?.click()}>Restore from a backup</Btn>
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
      </Panel>

      {status && <p className="text-center text-sm text-moss">{status}</p>}
    </Screen>
  )
}
