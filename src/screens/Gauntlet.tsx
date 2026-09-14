import { fill } from '../config/profile'
import { Btn, Panel, Screen, Tag } from '../ui/bits'
import { Prompt, ProblemView } from '../ui/ProblemView'
import { SESSION_LENGTH, useStore } from '../store'
import { play } from '../audio'

export function Gauntlet() {
  const { current, verdict, hintsOpen, openHint, answer, next, sessionLog, go } = useStore()
  if (!current) return null

  const { problem, spec } = current
  const done = sessionLog.length
  const locked = verdict !== null

  const handleAnswer = (given: string, correct: boolean) => {
    answer(given, correct)
    play(correct ? 'right' : 'wrong')
  }

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => go('lab')} className="text-sm text-dim">
          &larr; Lab
        </button>
        <div className="flex gap-1.5" aria-label={`Problem ${done + 1} of ${SESSION_LENGTH}`}>
          {Array.from({ length: SESSION_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                i < done ? 'bg-bolt' : i === done ? 'bg-chalk' : 'bg-ink-line'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Said out loud, before he starts. A stretch problem he misses is the
          system working, and he should know that going in rather than after. */}
      {spec.stretch && (
        <Panel className="border-bolt/40 bg-bolt/10">
          <Tag tone="warn">Hard one</Tag>
          <p className="mt-2 text-sm">
            {spec.atCeiling
              ? 'This is the hardest thing in here. Nobody expects you to get it.'
              : 'This one is above your level on purpose. Most people miss it. Worth a go anyway.'}
          </p>
        </Panel>
      )}

      <Panel>
        <Prompt text={problem.prompt} />
      </Panel>

      <ProblemView problem={problem} locked={locked} onAnswer={handleAnswer} />

      {problem.hints.slice(0, hintsOpen).map((hint, i) => (
        <Panel key={hint} className="border-sky/30 bg-sky/5">
          <p className="text-sm text-dim">Nudge {i + 1}</p>
          <p className="mt-1">{fill(hint)}</p>
        </Panel>
      ))}

      {!locked && hintsOpen < problem.hints.length && (
        <Btn
          onClick={() => {
            openHint()
            play('hint')
          }}
        >
          {hintsOpen === 0 ? 'Give me a nudge' : 'Another nudge'}
        </Btn>
      )}

      {verdict && (
        <Panel className={verdict.correct ? 'border-moss/50' : 'border-sky/40'}>
          <p className="text-lg font-bold">
            {verdict.correct ? "That's it." : `Not this time — you said ${verdict.given}.`}
          </p>
          <p className="mt-2 leading-relaxed text-chalk/90">{fill(problem.explain)}</p>
          <Btn tone="go" onClick={next} className="mt-4 w-full">
            {done >= SESSION_LENGTH ? 'Finish' : 'Next machine'}
          </Btn>
        </Panel>
      )}
    </Screen>
  )
}
