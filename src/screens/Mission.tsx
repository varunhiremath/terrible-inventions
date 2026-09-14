import { fill } from '../config/profile'
import { Btn, Panel, Screen, Tag } from '../ui/bits'
import { Prompt, ProblemView } from '../ui/ProblemView'
import { MACHINES } from '../world/characters'
import { useStore } from '../store'
import { play } from '../audio'

/**
 * Problems, inside a job with a name.
 *
 * Identical machinery to before — same selector, same generators, same rating —
 * but framed as helping somebody rather than as a quantity of questions. The
 * header says whose fault this is and how close it is to being over.
 */
export function Mission() {
  const { current, mission, verdict, hintsOpen, openHint, answer, next, sessionLog, abandonMission } =
    useStore()
  if (!current || !mission) return null

  const machine = MACHINES.find((m) => m.id === mission.machineId)
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
        <button type="button" onClick={abandonMission} className="text-sm text-dim">
          &larr; Leave it for now
        </button>
        <div className="flex gap-1.5" aria-label={`Problem ${done + 1} of ${mission.total}`}>
          {Array.from({ length: mission.total }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                i < done ? 'bg-bolt' : i === done ? 'bg-chalk' : 'bg-ink-line'
              }`}
            />
          ))}
        </div>
      </header>

      {machine && (
        <p className="text-sm font-bold uppercase tracking-wider text-bolt">
          {fill(machine.mission)}
        </p>
      )}

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
        <Btn onClick={() => { openHint(); play('hint') }}>
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
            {done >= mission.total ? `Back to ${machine?.name ?? 'the workshop'}` : 'Keep going'}
          </Btn>
        </Panel>
      )}
    </Screen>
  )
}
