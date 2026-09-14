import { useCallback, useEffect, useRef, useState } from 'react'
import { Btn, Panel, Screen, Tag } from '../ui/bits'
import { CUES, CUE_NOTES, CUE_TITLES, VOICE_LINES, linesFor } from '../voiceLines'
import {
  allClips,
  extensionFor,
  mimeForExtension,
  pickRecordingMime,
  putClip,
  removeClip,
  type VoiceClip,
} from '../engine/voiceStore'
import { makeZip, readZip, type ZipEntry } from '../lib/zip'
import { loadVoice } from '../audio'
import { useStore } from '../store'

/**
 * The recording booth.
 *
 * Read a line, tap once to record, tap again to stop, listen back, keep or
 * redo. Clips go straight into this device's IndexedDB — they are never
 * uploaded, never committed, and never leave unless the ZIP button is used.
 *
 * The microphone needs a secure context, so this works on localhost and over
 * HTTPS but not on a plain-HTTP deploy.
 */
export function Studio() {
  const go = useStore((s) => s.go)

  const [clips, setClips] = useState<Map<string, VoiceClip>>(new Map())
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)

  const importRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const refresh = useCallback(async () => {
    setClips(await allClips())
    await loadVoice()
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Hold the microphone open for the whole session: one permission prompt, and
  // no half-second of lost audio at the start of every take.
  useEffect(
    () => () => {
      recorderRef.current?.state === 'recording' && recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioRef.current?.pause()
    },
    [],
  )

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setRecordingId(null)
  }

  const record = async (lineId: string) => {
    if (recordingId) {
      stop()
      if (recordingId === lineId) return
    }

    setError('')

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser will not record audio. Safari or Chrome will.')
      return
    }

    try {
      streamRef.current ??= await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      setError('No microphone access. Allow it in the browser settings and try again.')
      return
    }

    const mime = pickRecordingMime()
    const recorder = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined)
    const chunks: BlobPart[] = []

    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'audio/webm'
      const blob = new Blob(chunks, { type })
      if (blob.size > 0) void putClip(lineId, { blob, mime: type, at: Date.now() }).then(refresh)
    }

    recorderRef.current = recorder
    recorder.start()
    setRecordingId(lineId)
  }

  const playBack = (lineId: string) => {
    const clip = clips.get(lineId)
    if (!clip) return

    audioRef.current?.pause()
    const url = URL.createObjectURL(clip.blob)
    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingId(lineId)
    audio.onended = () => {
      setPlayingId(null)
      URL.revokeObjectURL(url)
    }
    void audio.play().catch(() => setPlayingId(null))
  }

  const downloadZip = async () => {
    const entries: ZipEntry[] = []
    for (const [lineId, clip] of clips) {
      const bytes = new Uint8Array(await clip.blob.arrayBuffer())
      entries.push({ name: `voice/${lineId}.${extensionFor(clip.mime)}`, bytes })
    }
    if (entries.length === 0) return

    const url = URL.createObjectURL(makeZip(entries))
    const a = document.createElement('a')
    a.href = url
    a.download = 'voice-lines.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Loads a ZIP of clips into this device.
   *
   * This is how recordings get from the device they were made on to the device
   * they will be played on. The alternative — shipping them with the app —
   * would put Papa's voice on a public URL, which is the one thing this project
   * is built to avoid.
   */
  const importZip = async (file: File) => {
    setError('')
    try {
      const entries = await readZip(file)
      const known = new Map(VOICE_LINES.map((l) => [l.id, l]))
      let loaded = 0

      for (const entry of entries) {
        const base = entry.name.split('/').pop() ?? ''
        const dot = base.lastIndexOf('.')
        if (dot < 1) continue

        const lineId = base.slice(0, dot)
        const mime = mimeForExtension(base.slice(dot + 1))
        if (!known.has(lineId) || !mime || entry.bytes.length === 0) continue

        await putClip(lineId, { blob: new Blob([entry.bytes], { type: mime }), mime, at: Date.now() })
        loaded++
      }

      await refresh()
      setStatus(
        loaded === 0
          ? 'Nothing in that file matched a line. Filenames need to look like greeting-1.m4a.'
          : `Loaded ${loaded} recording${loaded === 1 ? '' : 's'}.`,
      )
    } catch {
      setError('That file could not be read as a ZIP.')
    }
  }

  const done = clips.size
  const total = VOICE_LINES.length

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Record your voice</h1>
          <p className="text-sm text-dim">
            {done} of {total} recorded &middot; stays on this device
          </p>
        </div>
        <button type="button" onClick={() => go('settings')} className="text-sm text-dim">
          Done
        </button>
      </header>

      {error && (
        <Panel className="border-rust/50 bg-rust/10">
          <p className="text-sm">{error}</p>
        </Panel>
      )}

      <Panel>
        <p className="text-sm leading-relaxed text-dim">
          Tap the circle to start, tap again to stop. Say it the way you would say it across the
          room, not the way you would read it aloud. A short pause before and after each line is
          fine &mdash; nothing is trimmed, so leave a beat rather than clipping a word.
        </p>
      </Panel>

      {CUES.map((cue) => {
        const lines = linesFor(cue)
        const cueDone = lines.filter((l) => clips.has(l.id)).length

        return (
          <section key={cue} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 pt-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-dim">
                {CUE_TITLES[cue]}
              </h2>
              <Tag tone={cueDone === lines.length ? 'good' : 'dim'}>
                {cueDone}/{lines.length}
              </Tag>
            </div>

            {CUE_NOTES[cue] && (
              <p className="text-sm leading-relaxed text-bolt/80">{CUE_NOTES[cue]}</p>
            )}

            {lines.map((line) => {
              const recorded = clips.has(line.id)
              const isRecording = recordingId === line.id

              return (
                <Panel key={line.id} className={isRecording ? 'border-rust' : ''}>
                  <p className="text-lg leading-snug">&ldquo;{line.text}&rdquo;</p>
                  {line.direction && (
                    <p className="mt-1 text-sm italic text-dim">{line.direction}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void record(line.id)}
                      aria-label={isRecording ? 'Stop recording' : 'Record'}
                      className={`flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-block-sm transition-transform active:translate-y-[3px] ${
                        isRecording
                          ? 'animate-pulse border-rust bg-rust'
                          : recorded
                            ? 'border-ink-line bg-ink-soft'
                            : 'border-rust/60 bg-rust/20'
                      }`}
                    >
                      <span
                        className={
                          isRecording
                            ? 'h-5 w-5 rounded-sm bg-ink'
                            : 'h-5 w-5 rounded-full bg-rust'
                        }
                      />
                    </button>

                    {recorded && !isRecording && (
                      <>
                        <Btn onClick={() => playBack(line.id)} className="px-4 py-2 text-sm">
                          {playingId === line.id ? 'Playing...' : 'Listen'}
                        </Btn>
                        <Btn
                          onClick={() => void removeClip(line.id).then(refresh)}
                          className="px-4 py-2 text-sm text-dim"
                        >
                          Delete
                        </Btn>
                        <Tag tone="good">Recorded</Tag>
                      </>
                    )}

                    {isRecording && <span className="text-sm text-rust">Recording&hellip;</span>}
                  </div>
                </Panel>
              )
            })}
          </section>
        )
      })}

      <Panel className="flex flex-col gap-3">
        <h2 className="font-bold">Move them between devices</h2>
        <p className="text-sm leading-relaxed text-dim">
          Clips live in this browser&rsquo;s storage, so a recording made on one device is not on
          the others. Download them here, send the file across however you like, and load it in on
          the other device. Nothing is uploaded and nothing is published &mdash; your voice stays on
          the devices you put it on.
        </p>
        <Btn onClick={() => void downloadZip()} disabled={done === 0}>
          Download all {done} as a ZIP
        </Btn>
        <Btn onClick={() => importRef.current?.click()}>Load a ZIP onto this device</Btn>
        <input
          ref={importRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importZip(file)
            e.target.value = ''
          }}
        />
      </Panel>

      {status && <p className="text-center text-sm text-moss">{status}</p>}
    </Screen>
  )
}
