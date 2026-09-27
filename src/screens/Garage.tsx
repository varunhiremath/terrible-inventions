import { useEffect, useRef } from 'react'
import { Btn, Toggle } from '../ui/bits'
import { ROSTER, type Racer } from '../road/level'
import { drawCarCard } from '../road/draw'

/**
 * The garage.
 *
 * He asked to pick his own car, and the reason that matters is not the colour:
 * it is that the four you line up against are drawn fresh for every level, so
 * the one constant on the grid is yours. Picking it is the difference between
 * driving a car and driving the car.
 *
 * Every one of these is painted by the same function that paints it on the
 * road, at the same angle you will see it from, so there are no surprises
 * between here and the lights.
 */
function CarPortrait({ who }: { who: Racer }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const box = canvas.getBoundingClientRect()
    // Drawn at the device's real pixel count, or a car on a phone is a smudge.
    const scale = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(box.width * scale))
    canvas.height = Math.max(1, Math.round(box.height * scale))
    const ctx = canvas.getContext('2d')
    if (ctx) drawCarCard(ctx, who, canvas.width, canvas.height)
  }, [who])

  return <canvas ref={ref} className="h-16 w-full short:h-12" />
}

/**
 * How quick a car is, as pips rather than a number.
 *
 * The pace is a fraction of your top speed and means nothing to anybody. Four
 * pips out of five means something to everybody.
 */
function Pips({ pace }: { pace: number }) {
  // The roster runs 0.74 to 0.92, so the scale is stretched over that rather
  // than over nought to one — otherwise every car shows four pips.
  const of = Math.max(1, Math.min(5, Math.round((pace - 0.72) / 0.045)))
  return (
    <span className="tracking-widest text-bolt" aria-label={`speed ${of} out of 5`}>
      {'•'.repeat(of)}
      <span className="text-dim">{'•'.repeat(5 - of)}</span>
    </span>
  )
}

export function Garage({
  picked,
  onPick,
  onClose,
  twoPlayer,
  onTwoPlayer,
}: {
  picked: string
  onPick: (name: string) => void
  onClose: () => void
  twoPlayer: boolean
  onTwoPlayer: (on: boolean) => void
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-3"
      /*
       * The overlay swallows its own pointers.
       *
       * The road reads pointer events on its whole surface to steer, and it
       * captures them — which retargets the pointerup and kills the click on
       * anything inside. Every panel that sits over a game in here has to do
       * this, and every one that forgot was reported as a button that does
       * nothing when you tap it.
       */
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="block-panel max-h-full w-full max-w-2xl overflow-y-auto p-4 short:p-3">
        <p className="text-sm font-bold uppercase tracking-wider text-rust">The garage</p>
        <p className="mt-1 text-lg leading-snug short:text-base">
          Pick something to drive. The rest of them turn out at random, so this
          one is yours.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 short:gap-1.5">
          {ROSTER.map((car) => {
            const mine = car.name === picked
            return (
              <button
                key={car.name}
                onClick={() => onPick(car.name)}
                aria-pressed={mine}
                className={`rounded-xl border-2 p-2 text-left transition short:p-1.5 ${
                  mine
                    ? 'border-bolt bg-bolt/10'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <CarPortrait who={car} />
                <span className="mt-1 block text-sm font-bold text-chalk short:text-xs">
                  {car.name}
                </span>
                <Pips pace={car.pace} />
              </button>
            )
          })}
        </div>

        {/*
          * Two players, on one screen.
          *
          * Somebody else takes the quickest car in the field and the screen
          * splits down the middle — one picture each, one road, one race. It
          * wants a tablet or a laptop: half a phone is not enough road to
          * drive on, and there is nowhere for four more buttons to go.
          */}
        <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-white/5 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-chalk">Two players</p>
            <p className="mt-0.5 text-xs leading-snug text-dim">
              Somebody else drives the quickest of the four. The screen splits in
              two — one of you at each end of a tablet.
            </p>
          </div>
          <Toggle label="Two players" on={twoPlayer} onChange={onTwoPlayer} />
        </div>

        <Btn tone="go" onClick={onClose} className="mt-3 w-full py-3">
          Drive it
        </Btn>
      </div>
    </div>
  )
}
