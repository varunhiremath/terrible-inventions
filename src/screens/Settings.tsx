import { useRef, useState } from 'react'
import { getProfile } from '../config/profile'
import { Btn, Panel, Screen } from '../ui/bits'
import { exportSave, importSave } from '../engine/storage'
import { useStore } from '../store'

/**
 * {papa}'s corner. Not hidden behind a passcode — an eight-year-old who goes
 * looking in here finds his own name and a text box, which is not a catastrophe.
 */
export function Settings() {
  const { save, saveNames, saveNote, replaceSave, go } = useStore()
  const profile = getProfile()

  const [kidName, setKidName] = useState(save.names.kidName ?? '')
  const [papaName, setPapaName] = useState(save.names.papaName ?? '')
  const [note, setNote] = useState(save.note?.text ?? '')
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
        <button type="button" onClick={() => go('lab')} className="text-sm text-dim">
          Done
        </button>
      </header>

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
