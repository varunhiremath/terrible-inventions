import { useState } from 'react'
import { Btn, Panel, Screen, Tag } from '../ui/bits'
import { fill, getProfile } from '../config/profile'
import { renderClue } from '../content/coop'
import { emptyBoard, isComplete, matchesSolution, placeValue, type BoardRow } from '../content/coop/board'
import { useStore } from '../store'
import { play } from '../audio'

/**
 * Two people, one tablet, half the clues each.
 *
 * The private hands are not a secrecy mechanism — anyone can lean over and
 * look. They are a way of structuring the conversation: the only practical
 * route to the answer is each person saying out loud what they are holding.
 * That is the whole point, because explaining your reasoning to somebody else
 * is where the understanding actually happens.
 */
export function Coop() {
  const { coop, coopShowing, coopSolved, showHand, finishCoop, go } = useStore()
  const { kidName, papaName } = getProfile()

  const [picks, setPicks] = useState<BoardRow[]>(() =>
    coop ? emptyBoard(coop.categories.length, coop.subjects.length) : [],
  )
  const [hintsOpen, setHintsOpen] = useState(0)

  if (!coop) return null

  const locked = coopSolved !== null
  const complete = isComplete(picks)

  const choose = (cat: number, subject: number, value: number) => {
    if (locked) return
    setPicks((prev) => prev.map((row, c) => (c === cat ? placeValue(row, subject, value) : row)))
  }

  const check = () => {
    const solved = matchesSolution(picks, coop.solution)
    finishCoop(solved)
    play(solved ? 'right' : 'wrong')
  }

  if (coopShowing) {
    const hand = coopShowing === 'a' ? coop.cluesA : coop.cluesB
    const owner = coopShowing === 'a' ? kidName : papaName

    return (
      <Screen>
        <Panel className="border-bolt/50 bg-bolt/10">
          <p className="text-sm font-bold uppercase tracking-wider text-bolt">
            {owner} only
          </p>
          <p className="mt-1 text-sm text-dim">
            Read these out to each other. Do not just summarise them.
          </p>
        </Panel>

        <div className="flex flex-col gap-2">
          {hand.map((clue, i) => (
            <Panel key={i} className="text-lg leading-snug">
              {renderClue(clue, coop.subjects, coop.categories)}
            </Panel>
          ))}
        </div>

        <Btn tone="go" onClick={() => showHand(null)} className="py-6 text-xl">
          Hide these
        </Btn>
      </Screen>
    )
  }

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => go('lab')} className="text-sm text-dim">
          &larr; Lab
        </button>
        <Tag tone="warn">Two players</Tag>
      </header>

      <Panel>
        <p className="text-xl leading-snug">{fill(coop.brief)}</p>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Btn onClick={() => showHand('a')} className="py-6">
          {kidName}&rsquo;s clues
          <span className="block text-sm font-normal text-dim">{coop.cluesA.length}</span>
        </Btn>
        <Btn onClick={() => showHand('b')} className="py-6">
          {papaName}&rsquo;s clues
          <span className="block text-sm font-normal text-dim">{coop.cluesB.length}</span>
        </Btn>
      </div>

      <div className="flex flex-col gap-3">
        {coop.subjects.map((subject, s) => (
          <Panel key={subject} className="flex flex-col gap-3">
            <p className="font-bold text-bolt">{subject}</p>

            {coop.categories.map((category, c) => (
              <div key={category.name} className="flex flex-wrap items-center gap-2">
                {category.values.slice(0, coop.subjects.length).map((value, v) => {
                  const picked = picks[c][s] === v
                  const right = locked && coop.solution[c][s] === v
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={locked}
                      onClick={() => choose(c, s, v)}
                      className={`min-h-[44px] rounded-xl border-2 px-4 py-2 text-sm font-bold transition-transform active:translate-y-[2px] ${
                        right
                          ? 'border-moss bg-moss/20 text-moss'
                          : picked
                            ? 'border-sky bg-sky text-ink'
                            : 'border-ink-line bg-ink text-dim'
                      }`}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            ))}
          </Panel>
        ))}
      </div>

      {coop.hints.slice(0, hintsOpen).map((hint, i) => (
        <Panel key={hint} className="border-sky/30 bg-sky/5">
          <p className="text-sm text-dim">Nudge {i + 1}</p>
          <p className="mt-1">{fill(hint)}</p>
        </Panel>
      ))}

      {!locked && hintsOpen < coop.hints.length && (
        <Btn onClick={() => setHintsOpen((n) => n + 1)}>
          {hintsOpen === 0 ? 'Give us a nudge' : 'Another nudge'}
        </Btn>
      )}

      {!locked && (
        <Btn tone="go" onClick={check} disabled={!complete} className="py-6 text-xl">
          {complete ? "We're done" : 'Place every machine first'}
        </Btn>
      )}

      {locked && (
        <Panel className={coopSolved ? 'border-moss/50' : 'border-sky/40'}>
          <p className="text-lg font-bold">
            {coopSolved ? 'Between you, you got it.' : 'Not quite — the right answer is marked above.'}
          </p>
          <p className="mt-2 leading-relaxed text-chalk/90">{fill(coop.explain)}</p>
          <Btn tone="go" onClick={() => go('lab')} className="mt-4 w-full">
            Back to the Lab
          </Btn>
        </Panel>
      )}
    </Screen>
  )
}
