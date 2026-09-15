import { Btn, Panel, Screen, Tag } from '../ui/bits'
import { Prompt, ProblemView } from '../ui/ProblemView'
import { SHOP } from '../arcade/shop'
import { taunt } from '../arcade/taunts'
import { fill } from '../config/profile'
import { say } from '../voice'
import { useStore } from '../store'

/**
 * Where maths buys power.
 *
 * Not a toll: solving a problem never buys permission to play, it buys an
 * advantage — and a harder problem buys a better one. A wrong answer costs
 * nothing at all beyond the prize, so reaching for something above your level
 * is free, which is the only way an unbounded difficulty ladder is any use.
 */
export function Shop() {
  const save = useStore((s) => s.save)
  const shopping = useStore((s) => s.shopping)
  const attempt = useStore((s) => s.attempt)
  const answerShop = useStore((s) => s.answerShop)
  const openShopHint = useStore((s) => s.openShopHint)
  const closeShopping = useStore((s) => s.closeShopping)
  const beginRun = useStore((s) => s.beginRun)
  const startCoop = useStore((s) => s.startCoop)

  const powerUps = save.arcade.powerUps

  if (shopping) {
    const { problem, verdict, hintsOpen, item } = shopping

    return (
      <Screen>
        <header className="flex items-center justify-between gap-3">
          <button type="button" onClick={closeShopping} className="text-sm text-dim">
            &larr; Back to the shop
          </button>
          {item ? <Tag tone="warn">{'★'.repeat(item.stars)}</Tag> : <Tag tone="warn">One more go</Tag>}
        </header>

        <p className="text-sm font-bold uppercase tracking-wider text-bolt">
          {item ? item.name : 'Earn another go'}
        </p>

        <Panel>
          <Prompt text={problem.prompt} />
        </Panel>

        <ProblemView
          problem={problem}
          locked={verdict !== null}
          onAnswer={(given, correct) => answerShop(given, correct)}
        />

        {problem.hints.slice(0, hintsOpen).map((hint, i) => (
          <Panel key={hint} className="border-sky/30 bg-sky/5">
            <p className="text-sm text-dim">Nudge {i + 1}</p>
            <p className="mt-1">{fill(hint)}</p>
          </Panel>
        ))}

        {!verdict && hintsOpen < problem.hints.length && (
          <Btn onClick={openShopHint}>{hintsOpen === 0 ? 'Give me a nudge' : 'Another nudge'}</Btn>
        )}

        {verdict && (
          <Panel className={verdict.correct ? 'border-moss/50' : 'border-sky/40'}>
            <p className="text-lg font-bold">
              {verdict.correct
                ? item
                  ? `${item.name} — yours.`
                  : 'Right. Back you go.'
                : `Not this time — you said ${verdict.given}.`}
            </p>
            <p className="mt-2 leading-relaxed text-chalk/90">{fill(problem.explain)}</p>

            <div className="mt-4 flex flex-col gap-2">
              {verdict.correct ? (
                <Btn tone="go" onClick={beginRun} className="py-4">Back to the maze</Btn>
              ) : (
                <>
                  <Btn tone="go" onClick={closeShopping}>Try something else</Btn>
                  <Btn onClick={beginRun}>Back to the maze</Btn>
                </>
              )}
            </div>
          </Panel>
        )}
      </Screen>
    )
  }

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Shop</h1>
        <button type="button" onClick={beginRun} className="text-sm text-dim">
          Back to the maze
        </button>
      </header>

      <Panel className="border-rust/40 bg-rust/10">
        <p className="text-sm font-bold uppercase tracking-wider text-rust">{fill('{papa}')}</p>
        <p className="mt-1">{fill(taunt('shopping'))}</p>
      </Panel>

      <Panel>
        <p className="text-sm text-dim">You are carrying</p>
        <p className="mt-1 text-lg">
          {powerUps.spareLives > 0 && `${powerUps.spareLives} spare ${powerUps.spareLives === 1 ? 'life' : 'lives'}`}
          {powerUps.freezes > 0 && `${powerUps.spareLives > 0 ? ' · ' : ''}${powerUps.freezes} freeze${powerUps.freezes === 1 ? '' : 's'}`}
          {powerUps.pelletBoost > 1 && `${powerUps.spareLives > 0 || powerUps.freezes > 0 ? ' · ' : ''}stronger pellets`}
          {powerUps.spareLives === 0 && powerUps.freezes === 0 && powerUps.pelletBoost === 1 && (
            <span className="text-dim">nothing at all</span>
          )}
        </p>
      </Panel>

      <p className="text-sm leading-relaxed text-dim">
        Harder problem, better prize. Getting one wrong costs you nothing &mdash; so there is no
        reason not to try the three-star one.
      </p>

      <div className="flex flex-col gap-2">
        {SHOP.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              attempt(item.id)
              say(fill(item.blurb))
            }}
            className="block-btn text-left"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-bold">{item.name}</span>
              <span className="text-bolt">{'★'.repeat(item.stars)}</span>
            </span>
            <span className="mt-1 block text-sm font-normal text-dim">{fill(item.blurb)}</span>
          </button>
        ))}

        <button type="button" onClick={startCoop} className="block-btn border-sky/40 text-left">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-bold">Two-player puzzle</span>
            <span className="text-sky">2 players</span>
          </span>
          <span className="mt-1 block text-sm font-normal text-dim">
            {fill('Half the clues each, so neither of you can do it alone. Solve it together for a freeze.')}
          </span>
        </button>
      </div>
    </Screen>
  )
}
