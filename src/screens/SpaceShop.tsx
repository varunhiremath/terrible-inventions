import { MOST_OF, MOST_SHIELDS, SHOP, type Upgrade } from '../space/level'
import { canBuy, owned as aboard, priceOf, type Run } from '../space/run'
import { Btn } from '../ui/bits'
import type { Fact } from '../space/facts'

const ORDER: Upgrade[] = ['shield', 'rapid', 'twin', 'pierce', 'magnet']

/**
 * The card that turns up when a shield goes.
 *
 * It used to be a maths question. It is not any more: this one game asked for
 * the questions to be taken out, and the thing that replaced them has to be
 * worth the interruption on its own. So it is something true about the sky you
 * are in, and then you carry on. Nothing to answer, nothing to get wrong.
 */
export function FactCard({ fact, shields, onDone }: {
  fact: Fact
  shields: number
  onDone: () => void
}) {
  return (
    /*
     * Pointer events stop here.
     *
     * The game underneath captures the pointer on the way down, so that a
     * thumb that slides off a button keeps steering. That capture retargets
     * the matching pointerup to the game, and a browser only raises a click
     * when the down and the up share a target — so the button on this card
     * never saw one, and a knock was the end of the run: the card could not be
     * dismissed by touching it at all. It took a probe pressing it with a real
     * pointer to find; calling the handler directly worked perfectly.
     */
    <div
      className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-ink/90 p-3 backdrop-blur-sm short:p-1.5"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="rise-in block-panel max-h-full w-full max-w-xl overflow-y-auto p-5 short:max-w-2xl short:p-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky" />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-sky">
            Did you know — {fact.about}
          </span>
        </div>

        <p className="mt-4 text-lg leading-snug text-chalk sm:text-xl short:mt-2 short:text-base">
          {fact.text}
        </p>

        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-dim short:mt-2">
          {shields} {shields === 1 ? 'shield' : 'shields'} left
        </p>

        <Btn
          tone="go"
          onClick={onDone}
          className="mt-5 w-full py-4 text-lg short:mt-3 short:py-2.5 short:text-base"
        >
          Back to it
        </Btn>
      </div>
    </div>
  )
}

/**
 * The shop, at a world.
 *
 * Everything broken up on the way leaves a cell behind, the cells go in your
 * pocket, and this is where they go. It opens over the arrival card rather
 * than replacing it, because the fact about the world is the reason for coming
 * and the shop is what you do while you are there.
 *
 * A row you cannot afford is dimmed rather than hidden: knowing that a
 * piercing bolt exists and what it costs is the reason to go back out and
 * shoot more than you strictly have to.
 *
 * The price shown is the price of the *next* one, which for a thing that comes
 * in sizes is not the price of the first.
 */
export function Shop({ run, onBuy }: { run: Run; onBuy: (what: Upgrade) => void }) {
  /*
   * What is already aboard, in the words that suit it.
   *
   * The things that come in sizes say which one you have out of how many; the
   * things you either own or do not just say so. A magnet has three sizes now,
   * because a reach is a thing that can be bigger — and because once the rest
   * of the kit is fitted and deep space is still taking shields off you, it is
   * most of what the scrap is for.
   */
  const owned = (what: Upgrade): string | null => {
    if (what === 'shield') return `${run.shields}/${MOST_SHIELDS}`
    const have = aboard(run, what)
    if (MOST_OF[what] > 1) return have > 0 ? `${have}/${MOST_OF[what]}` : null
    return have > 0 ? 'fitted' : null
  }

  return (
    <div className="mt-4 border-t-2 border-ink-line pt-3 short:mt-2 short:pt-2">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
          Scrap in hand
        </p>
        <p className="font-mono text-lg font-bold tabular-nums text-bolt">{run.purse}</p>
      </div>

      <div className="mt-2 grid gap-1.5 short:grid-cols-2 short:gap-1">
        {ORDER.map((what) => {
          const can = canBuy(run, what)
          const have = owned(what)
          const maxed =
            what === 'shield'
              ? run.shields >= MOST_SHIELDS
              : aboard(run, what) >= MOST_OF[what]

          return (
            <button
              key={what}
              type="button"
              disabled={!can}
              onClick={() => onBuy(what)}
              className={`block-btn flex items-center justify-between gap-3 px-3 py-2 text-left
                          disabled:opacity-45 short:py-1.5 ${can ? 'border-moss/70' : ''}`}
            >
              <span className="min-w-0">
                <span className="block font-bold text-chalk short:text-sm">
                  {SHOP[what].name}
                  {have && <span className="ml-2 font-mono text-[0.7rem] text-dim">{have}</span>}
                </span>
                <span className="block text-xs leading-snug text-dim short:hidden">
                  {SHOP[what].says}
                </span>
              </span>
              <span
                className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                  maxed ? 'text-dim' : can ? 'text-moss' : 'text-rust'
                }`}
              >
                {maxed ? '—' : priceOf(run, what)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
