import { useMemo, useState } from 'react'
import { BackButton, Btn } from '../ui/bits'
import { ProblemView } from '../ui/ProblemView'
import { fill } from '../config/profile'
import { idOf, pickQuestion } from '../quiz/interlude'
import { UPGRADES, nextCost, owned, worthOf } from '../workshop/kit'
import { useStore } from '../store'

/**
 * The workshop.
 *
 * Where the maths went. It used to interrupt a game at the moment a life was
 * lost, which is the worst moment anybody has ever chosen to ask somebody a
 * question — so the games ask about facts now, and the sums live here, behind
 * a door you only go through when you want something.
 *
 * What you want is on the shelf. Playing any of the six earns coins, slowly.
 * Sums earn them quickly. Nothing forces the second, and that is the whole
 * design: the maths is the shortcut, not the toll.
 */
export function Workshop() {
  const go = useStore((s) => s.go)
  const save = useStore((s) => s.save)
  const solve = useStore((s) => s.solveForCoins)
  const answered = useStore((s) => s.answerInterlude)
  /** Paying for a written answer, which has no `Problem` for the grader. */
  const addCoins = useStore((s) => s.addCoins)
  const buy = useStore((s) => s.buyUpgrade)

  const [round, setRound] = useState(0)
  const [verdict, setVerdict] = useState<{ correct: boolean; paid: number } | null>(null)
  const [bought, setBought] = useState<string | null>(null)

  /*
   * One problem per round, chosen once.
   *
   * `round` is in the dependency list on purpose: pressing "another one" is
   * the only thing that should ever change the question. A re-render must not.
   */
  const question = useMemo(
    () =>
      pickQuestion(save.rating, Math.random(), Math.floor(Math.random() * 1e9), {
        // Maths only. This is the room he came to for maths.
        topics: ['maths'],
        solved: save.solved,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  )

  const pays = worthOf(question.kind === 'maths' ? question.problem.rating : question.item.rating)

  const answer = (correct: boolean) => {
    if (verdict) return
    if (question.kind === 'maths') {
      solve(question.problem, correct, pays)
    } else {
      // A written one: it counts as solved and it pays, but it does not move
      // the rating — only the generated sums do that, and they are graded.
      answered(null, correct, idOf(question), 'maths')
      if (correct) addCoins(pays)
    }
    setVerdict({ correct, paid: correct ? pays : 0 })
  }



  const again = () => {
    setVerdict(null)
    setRound((n) => n + 1)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-3 overflow-y-auto p-3 sm:p-5">
      {/* Room at the top left for the back button, which floats over this. */}
      <div className="mt-7 flex items-baseline justify-between sm:mt-0">
        <h1 className="font-mono text-lg font-bold uppercase tracking-widest text-chalk sm:ml-20 sm:text-2xl">
          The Workshop
        </h1>
        <p className="font-mono text-lg font-bold tabular-nums text-bolt">
          ◆ {save.coins}
        </p>
      </div>

      <p className="text-sm text-dim">
        Playing earns coins. Sums earn them faster. Spend them on things that
        make every game easier — {fill('{papa}')} will not be pleased.
      </p>

      {/* --- the sum ------------------------------------------------------ */}
      <div className="block-panel p-4 short:p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-bolt">
            Worth {pays} coins
          </span>
          {verdict && (
            <span className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${
              verdict.correct ? 'text-moss' : 'text-rust'
            }`}>
              {verdict.correct ? `+${verdict.paid}` : 'Not that one'}
            </span>
          )}
        </div>

        <div className="mt-3">
          {question.kind === 'maths' ? (
            <ProblemView
              problem={question.problem}
              locked={verdict !== null}
              onAnswer={(_given, correct) => answer(correct)}
            />
          ) : (
            <>
              <p className="text-xl leading-snug text-chalk sm:text-2xl short:text-base">
                {fill(question.item.prompt)}
              </p>
              <div className="mt-4 grid gap-2.5 short:mt-2 short:grid-cols-2 short:gap-2">
                {question.options.map((option, i) => {
                  const right = option === question.answer
                  const picked = verdict !== null
                  const mark = !picked ? '' : right ? 'mark-right' : 'opacity-40'
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={verdict !== null}
                      onClick={() => answer(right)}
                      style={{ animationDelay: `${60 + i * 45}ms` }}
                      className={`rise-in block-btn px-4 py-3.5 text-left text-base
                                  disabled:opacity-100 short:py-2 short:text-sm ${mark}`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {verdict && (
          <div className="fade-in mt-4 border-t-2 border-ink-line pt-3">
            <p className="text-[0.95rem] leading-relaxed text-chalk/90">
              {fill(question.kind === 'maths' ? question.problem.explain : question.item.explain)}
            </p>
            <Btn tone="go" onClick={again} className="mt-4 w-full py-3">
              Another one
            </Btn>
          </div>
        )}
      </div>

      {/* --- the shelf ---------------------------------------------------- */}
      <h2 className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.2em] text-dim">
        On the shelf
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {UPGRADES.map((upgrade) => {
          const have = owned(save, upgrade.id)
          const cost = nextCost(save, upgrade.id)
          const can = cost !== null && save.coins >= cost
          return (
            <button
              key={upgrade.id}
              type="button"
              disabled={!can}
              onClick={() => {
                if (buy(upgrade.id, cost ?? 0, upgrade.costs.length)) setBought(upgrade.id)
              }}
              className={`block-btn flex items-start justify-between gap-3 p-3 text-left
                          disabled:opacity-50 ${can ? 'border-moss/70' : ''} ${
                bought === upgrade.id ? 'mark-right' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block font-bold text-chalk">
                  {upgrade.name}
                  {have > 0 && (
                    <span className="ml-2 font-mono text-[0.7rem] text-moss">
                      ×{have}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-dim">{upgrade.says}</span>
                <span className="mt-1 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim/70">
                  {upgrade.where}
                </span>
              </span>
              <span className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                cost === null ? 'text-dim' : can ? 'text-moss' : 'text-rust'
              }`}>
                {cost === null ? 'MAX' : cost}
              </span>
            </button>
          )
        })}
      </div>

      <BackButton onClick={() => go('home')} />
      <div className="h-14" />
    </div>
  )
}
