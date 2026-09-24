import { useMemo, useState } from 'react'
import { ProblemView } from '../ui/ProblemView'
import { Btn } from '../ui/bits'
import { fill } from '../config/profile'
import { idOf, pickQuestion } from '../quiz/interlude'
import { useStore } from '../store'

/**
 * The moment between lives.
 *
 * One question, one answer, and back to the game. This replaced a shop where
 * maths bought power-ups: the shop had a shape to it — pick a prize, earn it,
 * spend it — and every part of that shape was a reason to be somewhere other
 * than the game.
 *
 * A wrong answer costs nothing. Somebody who has just lost a life is not in
 * the mood to be fined, and the explanation runs either way because the point
 * is the idea rather than the mark.
 */
export function Interlude({ onDone }: { onDone: () => void }) {
  const save = useStore((s) => s.save)
  const recent = useStore((s) => s.recentQuestions)
  const answered = useStore((s) => s.answerInterlude)

  // Chosen once, not on every render: a re-render is not a reroll, and a
  // question that changed under you as you thought about it would be cruel.
  const question = useMemo(
    () => pickQuestion(save.rating, Math.random(), Math.floor(Math.random() * 1e9), recent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [verdict, setVerdict] = useState<{ correct: boolean; given: string } | null>(null)

  const settle = (given: string, correct: boolean) => {
    if (verdict) return
    setVerdict({ correct, given })
    answered(question.kind === 'maths' ? question.problem : null, correct, idOf(question))
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/95 p-3">
      <div className="block-panel max-h-full w-full max-w-lg overflow-y-auto p-4 sm:p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-dim">
          {question.kind === 'maths' ? 'A quick one' : 'Something else'}
        </p>

        {question.kind === 'maths' ? (
          <div className="mt-2">
            <ProblemView problem={question.problem} locked={verdict !== null} onAnswer={settle} />
          </div>
        ) : (
          <>
            <p className="mt-2 text-lg leading-snug sm:text-xl">{fill(question.item.prompt)}</p>
            <div className="mt-4 flex flex-col gap-2">
              {question.options.map((option) => {
                const picked = verdict?.given === option
                const right = option === question.answer
                // Once it is answered, the right one is always shown as right,
                // whether or not it was the one chosen.
                const tone = !verdict ? 'pick' : right ? 'chosen' : picked ? 'plain' : 'plain'
                return (
                  <Btn
                    key={option}
                    tone={tone}
                    disabled={verdict !== null}
                    onClick={() => settle(option, right)}
                    className={`px-3 py-3 text-left text-base ${
                      verdict && picked && !right ? 'border-rust/70 opacity-70' : ''
                    }`}
                  >
                    {option}
                  </Btn>
                )
              })}
            </div>
          </>
        )}

        {verdict && (
          <div className="mt-4 border-t border-dim/20 pt-3">
            <p className={`font-mono text-xs uppercase tracking-widest ${verdict.correct ? 'text-sky' : 'text-rust'}`}>
              {verdict.correct ? 'Got it' : 'Not that one'}
            </p>
            <p className="mt-1 text-sm leading-snug text-chalk">
              {fill(question.kind === 'maths' ? question.problem.explain : question.item.explain)}
            </p>
            <Btn tone="go" onClick={onDone} className="mt-4 w-full py-4 text-lg">
              Back to it
            </Btn>
          </div>
        )}

        {!verdict && (
          <button
            type="button"
            onClick={onDone}
            className="mt-4 w-full px-2 py-2 font-mono text-[0.7rem] uppercase tracking-widest text-dim/50"
          >
            skip
          </button>
        )}
      </div>
    </div>
  )
}
