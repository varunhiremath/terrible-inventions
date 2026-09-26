import { useEffect, useMemo, useState } from 'react'
import { FlagBox } from '../ui/FlagBox'
import { ProblemView } from '../ui/ProblemView'
import { fill } from '../config/profile'
import { musicPlaying, startMusic, stopMusic } from '../music/player'
import { idOf, pickQuestion, topicOf } from '../quiz/interlude'
import { FLAG_OF } from '../quiz/flags'
import { TOPICS } from '../quiz/types'
import { useStore } from '../store'

/**
 * The moment between lives.
 *
 * One question, one answer, and back to the game. It gets a card of its own
 * rather than a panel of controls, because it is the only thing on the screen
 * and it should look like it knows that. A colour and a word at the top say
 * which kind of question is coming before the question is read, which is worth
 * more than it sounds: knowing you are about to be asked about flags is half
 * of being ready to answer about flags.
 *
 * A wrong answer costs nothing. Somebody who has just lost a life is not in the
 * mood to be fined, and the explanation runs either way because the point is
 * the idea rather than the mark.
 */
export function Interlude({
  onDone,
  reward,
}: {
  /** Told whether it was right, so the game can pay out. */
  onDone: (correct: boolean) => void
  /** What a right answer is worth here, in the game's own terms. */
  reward?: string
}) {
  const save = useStore((s) => s.save)
  const recent = useStore((s) => s.recentQuestions)
  const lastTopic = useStore((s) => s.lastTopic)
  const answered = useStore((s) => s.answerInterlude)

  // Chosen once, not on every render: a re-render is not a reroll, and a
  // question that changed under you as you thought about it would be cruel.
  const question = useMemo(
    () =>
      pickQuestion(
        save.rating,
        Math.random(),
        Math.floor(Math.random() * 1e9),
        recent,
        lastTopic,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [verdict, setVerdict] = useState<{ correct: boolean; given: string } | null>(null)

  /*
   * The chase tune keeps running while a question is on screen otherwise, and
   * being hurried is the last thing that helps anyone think. This is the same
   * four chords at half the speed, and the game's own tune comes back the
   * moment the question is done with.
   */
  useEffect(() => {
    const was = musicPlaying()
    startMusic('thinking')
    return () => {
      if (was) startMusic(was)
      else stopMusic()
    }
  }, [])

  const topic = TOPICS[topicOf(question)]

  const settle = (given: string, correct: boolean) => {
    if (verdict) return
    setVerdict({ correct, given })
    answered(
      question.kind === 'maths' ? question.problem : null,
      correct,
      idOf(question),
      topicOf(question),
    )
  }

  return (
    <div className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-ink/90 p-3 backdrop-blur-sm short:p-1.5">
      <div className="rise-in block-panel max-h-full w-full max-w-xl overflow-y-auto p-5 sm:p-6 short:max-w-3xl short:p-3">
        {/* The topic, as a colour first and a word second. */}
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: topic.tint }} />
          <span
            className="font-mono text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: topic.tint }}
          >
            {topic.label}
          </span>
        </div>

        {question.kind === 'maths' ? (
          <div className="mt-4">
            <ProblemView problem={question.problem} locked={verdict !== null} onAnswer={settle} />
          </div>
        ) : (
          <>
            {question.item.flag && (
              <div className="mx-auto mt-4 overflow-hidden rounded-xl border-2 border-ink-line shadow-block short:mt-2 short:max-w-[12rem]">
                <div className="aspect-[3/2] w-full">
                  <FlagBox name={question.item.flag} className="rounded-none" />
                </div>
              </div>
            )}

            <p className="mt-4 text-xl leading-snug text-chalk sm:text-2xl short:mt-2 short:text-base">
              {fill(question.item.prompt)}
            </p>

            <div
              /*
               * Two columns when the screen is short.
               *
               * One column of four full-width answers is 360 pixels of height
               * on its own, so on a phone held sideways the fourth answer was
               * cut off by the bottom edge and `skip` was below it, off the
               * screen entirely. Nobody mid-game is going to scroll a question
               * to find out there was a fourth option.
               */
              className={`mt-5 grid gap-2.5 short:mt-2.5 short:gap-2 ${
                question.item.showFlags ? 'grid-cols-2' : 'grid-cols-1 short:grid-cols-2'
              }`}
            >
              {question.options.map((option, i) => {
                const picked = verdict?.given === option
                const right = option === question.answer
                // Once answered, the right one is always shown as right,
                // whether or not it was the one chosen. Being told only that
                // you were wrong teaches nothing at all.
                const mark = !verdict ? '' : right ? 'mark-right' : picked ? 'mark-wrong' : 'opacity-40'

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={verdict !== null}
                    onClick={() => settle(option, right)}
                    // Staggered, so the options read as a list arriving rather
                    // than a block appearing.
                    style={{ animationDelay: `${60 + i * 45}ms` }}
                    className={`rise-in block-btn flex items-center gap-3 px-4 py-3.5 text-left text-base
                                transition-colors disabled:opacity-100 short:py-2 short:text-sm ${mark}`}
                  >
                    {question.item.showFlags ? (
                      <span className="h-14 w-full overflow-hidden rounded-lg border-2 border-ink-line sm:h-16 short:h-9">
                        <FlagBox name={FLAG_OF[option]} className="rounded-none" />
                      </span>
                    ) : (
                      <span className="leading-snug">{option}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {verdict && (
          <div className="fade-in mt-5 border-t-2 border-ink-line pt-4 short:mt-3 short:pt-2">
            <p
              className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${
                verdict.correct ? 'text-moss' : 'text-rust'
              }`}
            >
              {verdict.correct ? 'Got it' : 'Not that one'}
            </p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-chalk/90 short:mt-1 short:text-sm">
              {fill(question.kind === 'maths' ? question.problem.explain : question.item.explain)}
            </p>
            {reward && verdict.correct && (
              <p className="mt-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-moss short:mt-2">
                {reward}
              </p>
            )}
            <button
              type="button"
              onClick={() => onDone(verdict.correct)}
              className="block-btn mt-5 w-full bg-bolt py-4 text-lg text-ink short:mt-3 short:py-2.5 short:text-base"
            >
              Back to it
            </button>
          </div>
        )}

        {/*
          * No way past it.
          *
          * There used to be a skip, on the reasoning that being stuck on a
          * question you cannot answer is worse than not being asked. But there
          * are four options and a wrong answer costs nothing — so the skip was
          * only ever a way of not playing this part, and a reward for
          * answering is no reward at all if the answer is optional.
          */}
        {!verdict && reward && (
          <p className="mt-4 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-moss short:mt-2">
            right answer: {reward}
          </p>
        )}
      </div>
    </div>
  )
}
