import { generatorFor } from '../content'
import { fill } from '../config/profile'
import { Btn, Panel, Screen } from '../ui/bits'
import { useStore } from '../store'

/**
 * What he sees at the end of a sitting.
 *
 * There is deliberately no score, no percentage and no streak here. The
 * evidence on gifted children is that praising the result pushes them toward
 * protecting a reputation for being clever, and the first thing that goes is
 * any appetite for hard problems. So this screen only ever reports what he
 * *did*: which one was hardest, where he kept going, what he took on.
 */
export function Summary() {
  const { sessionLog, go } = useStore()

  const solved = sessionLog.filter((a) => a.correct)
  const hardest = solved.reduce<(typeof solved)[number] | null>(
    (best, a) => (!best || a.problemRating > best.problemRating ? a : best),
    null,
  )
  const longest = sessionLog.reduce<(typeof sessionLog)[number] | null>(
    (best, a) => (!best || a.elapsedMs > best.elapsedMs ? a : best),
    null,
  )

  const stretches = sessionLog.filter((a) => a.stretch).length
  const persisted = sessionLog.filter((a) => a.hintsUsed > 0 && a.correct).length

  const notes: string[] = []
  if (hardest) notes.push(`The hardest thing you cracked was a ${generatorFor(hardest.kind).name}.`)
  if (stretches > 0) {
    notes.push(
      stretches === 1
        ? 'You took on one that was over your head. That is the only way the ceiling ever moves.'
        : `You took on ${stretches} that were over your head.`,
    )
  }
  if (persisted > 0) {
    notes.push(
      `${persisted} of these needed a nudge first, and you carried on and got there anyway.`,
    )
  }
  if (longest && longest.elapsedMs > 45_000) {
    notes.push(
      `You sat with one of them for ${Math.round(longest.elapsedMs / 1000)} seconds without giving up on it.`,
    )
  }

  return (
    <Screen>
      <h1 className="text-3xl font-extrabold tracking-tight">Workshop closed</h1>
      <p className="text-dim">
        {fill(`You went through ${sessionLog.length} of {papa}'s machines.`)}
      </p>

      <div className="flex flex-col gap-2">
        {notes.map((note) => (
          <Panel key={note}>
            <p className="leading-relaxed">{fill(note)}</p>
          </Panel>
        ))}
      </div>

      <Btn tone="go" onClick={() => go('lab')} className="py-6 text-xl">
        Back to the Lab
      </Btn>
    </Screen>
  )
}
