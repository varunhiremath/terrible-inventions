import { useEffect, useRef } from 'react'
import { drawFlag } from '../quiz/drawFlag'
import { FLAGS } from '../quiz/flags'

/**
 * A flag, drawn onto a canvas at whatever size it ends up.
 *
 * It measures itself rather than being told a size, because it appears both as
 * a big picture above a question and as four small ones on buttons, and a flag
 * that has to be told how big it is would need every caller to agree.
 */
export function FlagBox({ name, className = '' }: { name: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    const flag = FLAGS[name]
    if (!canvas || !flag) return

    const paint = () => {
      const box = canvas.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) return
      // Cap the pixel ratio: past 2 it costs memory and nobody can see it.
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(box.width * ratio)
      canvas.height = Math.round(box.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawFlag(ctx, flag, 0, 0, canvas.width, canvas.height)
    }

    paint()
    // Turning a phone sideways changes the size without remounting anything.
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [name])

  return (
    <canvas
      ref={ref}
      // The flag is the question. Naming the country here would answer it for
      // anyone using a screen reader, so it stays deliberately unlabelled.
      aria-hidden="true"
      className={`block h-full w-full rounded-lg ${className}`}
    />
  )
}
