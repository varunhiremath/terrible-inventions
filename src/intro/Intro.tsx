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
  const bandRef = useRef<HTMLDivElement>(null)
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

    /*
     * How much of the picture the caption is sitting on.
     *
     * The band is opaque and across the bottom, and every one of these games
     * draws the thing you steer down there — so the ship, the car and the
     * runner were all underneath it. Measured rather than guessed at, because
     * it is two lines of text on a phone and one on a tablet, and the scene is
     * given the room that is left.
     */
    let band = 0
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      band = Math.round((bandRef.current?.offsetHeight ?? 0) * dpr)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    if (bandRef.current) observer.observe(bandRef.current)

    started.current = performance.now()
    spoken.current = -1
    let frame = 0
    let finished = false

    const loop = () => {
      const clock = (performance.now() - started.current) / 1000
      const now = beatAt(story, clock)
      const w = canvas.width
      // The picture is what is left above the caption. Never less than half
      // the canvas, in case the band is ever measured absurdly — a scene drawn
      // into a sliver is worse than one partly covered.
      const h = Math.max(canvas.height / 2, canvas.height - band)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, canvas.height)
      const scene = SCENES[now.beat.scene]
      if (scene) scene({ ctx, w, h, t: now.t, clock })

      /*
       * The title goes over the last beat, whatever that beat is showing.
       *
       * It used to have a scene of its own: a gold rectangle on a black plate,
       * which is a title card and is also thirty seconds of game followed by
       * five seconds of nothing. Over the game it needs a band behind it or
       * the letters land on whatever masonry happens to be there.
       */
      if (now.index === story.beats.length - 1) {
        /*
         * Shrunk to fit rather than set at a fixed size. A width of 0.11 suits
         * PAPA PANIC and runs THE LONG WAY OUT off both edges of a phone — on
         * the one story whose title is the longest and whose last beat is the
         * one worth looking at.
         */
        let size = Math.min(w * 0.11, h * 0.16)
        const room = w * 0.92
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (let tries = 0; tries < 12; tries++) {
          ctx.font = `bold ${size}px ui-monospace, monospace`
          if (ctx.measureText(story.title).width <= room) break
          size *= 0.9
        }
        const show = Math.min(1, now.t * 3)
        ctx.globalAlpha = show
        ctx.fillStyle = 'rgba(8,10,16,0.72)'
        ctx.fillRect(0, h / 2 - size, w, size * 2)
        ctx.fillStyle = '#ffc84a'
        ctx.fillText(story.title, w / 2, h / 2)
        ctx.globalAlpha = 1
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
        // `raw` is the line as written, placeholders and all: that is what
        // the rendered clip was keyed by.
        say(text, {
          ...(now.beat.voice === 'papa' ? { as: 'papa' as const } : {}),
          raw: now.beat.line,
        })
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

        {/*
          * The caption, on a solid band rather than a fade.
          *
          * It was coral over a gradient, which on a phone in daylight over a
          * dark level is two low-contrast things fighting. {papa} keeps a
          * colour of his own because whose line it is matters, but it is the
          * warm one now, and both sit on something opaque.
          */}
        <div ref={bandRef} className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/80 px-4 pb-5 pt-4">
          <p
            className={`mx-auto max-w-2xl text-center text-xl font-semibold leading-snug sm:text-2xl ${
              voice === 'papa' ? 'text-bolt' : 'text-chalk'
            }`}
          >
            {caption}
          </p>
        </div>
      </div>

      {/*
        * The way out, along the bottom.
        *
        * The story plays before every go at a game now rather than only the
        * first, so this has to be the most obvious thing on the screen after
        * the picture: full width, thumb height, and there from the first frame.
        * A skip you have to look for is worse than no skip at all.
        */}
      <div className="bg-black px-4 pb-4 pt-3">
        <p className="mb-2 text-center font-mono text-[0.7rem] uppercase tracking-widest text-dim/60">
          tap the picture for the next bit
        </p>
        <button
          type="button"
          onClick={done}
          className="w-full rounded-2xl border-2 border-dim/40 py-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-paper active:translate-y-[2px]"
        >
          Skip to the game
        </button>
      </div>
    </div>
  )
}

export { totalSeconds }
