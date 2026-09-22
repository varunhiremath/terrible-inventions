import { useEffect, useRef, useState } from 'react'
import { SCENES } from './scenes'
import { beatAt, beatStart, totalSeconds, type Story } from './timeline'
import { fill } from '../config/profile'
import { say, silence } from '../voice'
import { duckMusic } from '../music/player'

/**
 * The intro.
 *
 * Drawn rather than played: there is no video file anywhere in this project
 * and there is not going to be, because the whole thing has to work on a
 * tablet with the wifi off and weighs a few hundred kilobytes. So a cutscene
 * is a timeline, a set of scene functions, and the games' own drawing code.
 *
 * Three things it has to do or it is worse than nothing. It has to be
 * skippable at any moment, with the button visible from the first frame rather
 * than appearing after ten seconds. It has to be watchable a second time on
 * purpose, so seeing it is not a punishment for opening the wrong menu. And it
 * has to say which buttons do what, because an intro that sets up a story and
 * then drops you in with no idea how to play is an intro everybody skips.
 */
export function Intro({ story, onDone }: { story: Story; onDone: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const started = useRef(0)
  /** Which beat has had its line spoken, so it is said once and not per frame. */
  const spoken = useRef(-1)
  const [caption, setCaption] = useState('')
  const [voice, setVoice] = useState<'papa' | 'narrator'>('narrator')

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    started.current = performance.now()
    spoken.current = -1
    let frame = 0
    let finished = false

    const loop = () => {
      const clock = (performance.now() - started.current) / 1000
      const now = beatAt(story, clock)
      const w = canvas.width
      const h = canvas.height

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const scene = SCENES[now.beat.scene]
      if (scene) scene({ ctx, w, h, t: now.t, clock })

      if (now.beat.scene === 'title') {
        ctx.fillStyle = '#f4c430'
        const size = Math.min(w * 0.11, h * 0.16)
        ctx.font = `bold ${size}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(story.title, w / 2, h / 2)
      }

      // The line is said once, on the frame the beat turns over, and shown for
      // as long as the beat lasts.
      if (now.index !== spoken.current) {
        spoken.current = now.index
        const text = fill(now.beat.line)
        setCaption(text)
        setVoice(now.beat.voice)
        silence()
        duckMusic(3)
        say(text, now.beat.voice === 'papa' ? { as: 'papa' } : {})
      }

      if (now.done && !finished) {
        finished = true
        window.setTimeout(onDone, 500)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      silence()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story])

  const skipBeat = () => {
    const clock = (performance.now() - started.current) / 1000
    const now = beatAt(story, clock)
    const next = now.index + 1
    if (next >= story.beats.length) {
      silence()
      onDone()
      return
    }
    // Wind the clock forward rather than tracking a separate offset: one
    // source of truth for where we are, and skipping cannot drift from it.
    started.current = performance.now() - beatStart(story, next) * 1000
  }

  const done = () => {
    silence()
    onDone()
  }

  return (
    <div className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black">
      <div ref={wrapRef} className="relative min-h-0 flex-1" onClick={skipBeat}>
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
          <p
            className={`mx-auto max-w-2xl text-center text-lg leading-snug sm:text-xl ${
              voice === 'papa' ? 'font-bold text-rust' : 'text-paper'
            }`}
          >
            {caption}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 bg-black px-4 py-3">
        <p className="font-mono text-[0.7rem] uppercase tracking-widest text-dim/60">
          tap for the next bit
        </p>
        <button
          type="button"
          onClick={done}
          className="rounded-full border border-dim/40 px-5 py-2 font-mono text-xs uppercase tracking-widest text-paper"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

export { totalSeconds }
