import { useEffect, useMemo, useState } from 'react'
import { FlagBox } from '../ui/FlagBox'
import { ProblemView } from '../ui/ProblemView'
import { fill } from '../config/profile'
import { musicPlaying, startMusic, stopMusic } from '../music/player'
import { FACT_TOPICS, idOf, pickQuestion, topicOf } from '../quiz/interlude'
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
 *
 * It is offered rather than imposed, and that is the whole design.
 *
 * The first version put the question up with no way past it, reasoning that a
 * skip is only a way of not playing this part and that a reward means nothing
 * if answering is optional. What actually happened was reported from the
 * sofa: he tapped whichever answer was nearest to get back to the game. Which
 * is the same thing as skipping, except it teaches him that guessing works
 * and it spends a question he might have wanted.
 *
 * So the card opens with the bargain stated plainly — answer one and have the
 * life back, or carry on without it — and both doors are the same size. If he
 * does not want to think right now he says so, honestly, in one tap, and
 * nothing is lost. If he does, he means it.
 *
 * And getting one wrong is not the end of the conversation. The explanation
 * comes up and then he can take another, as many as he likes: somebody asking
 * for another question is exactly the thing this whole card exists to
 * encourage, and refusing him on the grounds that he already had a go would
 * be perverse.
 */
export function Interlude({
  onDone,
  reward,
  lastChance = false,
}: {
  /** Told whether it was right, so the game can pay out. */
  onDone: (correct: boolean) => void
  /** What a right answer is worth here, in the game's own terms. */
  reward?: string
  /**
   * Whether this is the last one: no cars left, and a right answer is the
   * only way the run carries on.
   *
   * It changes what the card says rather than how it works. The stakes are
   * the point — "one more question and you can keep going" is a reason to
   * think about it, where the same card at the start of a run is an
   * interruption.
   */
  lastChance?: boolean
}) {
  const save = useStore((s) => s.save)
  const recent = useStore((s) => s.recentQuestions)
  const lastTopic = useStore((s) => s.lastTopic)
  const answered = useStore((s) => s.answerInterlude)

  /**
   * Which part of the conversation this is.
   *
   * `offer` is the bargain; `asking` is a question on screen; the verdict
   * below turns it into an answer and an explanation.
   */
  const [phase, setPhase] = useState<'offer' | 'asking'>('offer')
  /** Bumped to fetch another question, which is the only thing that rerolls. */
  const [round, setRound] = useState(0)

  // Chosen once per round, not on every render: a re-render is not a reroll,
  // and a question that changed under you as you thought about it would be
  // cruel.
  const question = useMemo(
    () =>
      pickQuestion(save.rating, Math.random(), Math.floor(Math.random() * 1e9), {
        recent,
        lastTopic,
        solved: save.solved,
        /*
         * Facts, never sums.
         *
         * This is the card that interrupts a game. Sums are real work with a
         * number pad and being handed one at the moment you lose a life is a
         * punishment wearing a reward's coat — so the maths moved to the
         * workshop, where going in is a choice and a right answer buys
         * something. What is left here is the part worth being interrupted
         * for: something true you did not know.
         */
        topics: FACT_TOPICS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  )
  const [verdict, setVerdict] = useState<{ correct: boolean; given: string } | null>(null)
  /** Whether any question this time round has been got right. */
  const [won, setWon] = useState(false)

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
    if (correct) setWon(true)
    answered(
      question.kind === 'maths' ? question.problem : null,
      correct,
      idOf(question),
      topicOf(question),
    )
  }

  return (
    /*
     * Pointer events stop at this card and do not reach the game under it.
     *
     * Every game that uses a pad captures the pointer on the way down, so a
     * thumb sliding off a button keeps steering it. Capture retargets the
     * matching pointerup — and the compatibility mouse events with it — to the
     * element holding the capture, and a browser raises a click only when the
     * down and the up share a target. So the answer buttons on this card never
     * received one: the question could not be answered by touching it in the
     * road, the caves or the pipes. Only by keyboard, which is what every
     * check I had was using.
     *
     * Found by a probe pressing a card with a real pointer instead of calling
     * its handler. It is the third time in this project that a thing worked
     * from the keyboard and not from a finger.
     */
    <div
      className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-ink/90 p-3 backdrop-blur-sm short:p-1.5"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="rise-in block-panel max-h-full w-full max-w-xl overflow-y-auto p-5 sm:p-6 short:max-w-3xl short:p-3">
        {phase === 'offer' && (
          <div className="fade-in">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-rust">
              {lastChance ? 'Last one' : 'A question, if you want it'}
            </p>
            <p className="mt-2 text-xl leading-snug text-chalk sm:text-2xl short:text-base">
              {lastChance
                ? 'That was the last of them. Get one question right and you can keep going.'
                : `Answer one and you get ${reward ?? 'it'} back. Or carry straight on without.`}
            </p>
            <div className="mt-5 grid gap-2.5 short:mt-3 short:grid-cols-2 short:gap-2">
              <button
                type="button"
                onClick={() => setPhase('asking')}
                className="block-btn bg-bolt px-4 py-4 text-lg text-ink short:py-2.5 short:text-base"
              >
                {lastChance ? 'Give me a question' : `Answer one for ${reward ?? 'it'}`}
              </button>
              <button
                type="button"
                onClick={() => onDone(false)}
                className="block-btn px-4 py-3.5 text-base short:py-2.5 short:text-sm"
              >
                {lastChance ? 'No thanks, I am done' : 'Carry on without it'}
              </button>
            </div>
          </div>
        )}

        {/* The topic, as a colour first and a word second. */}
        {phase === 'asking' && (
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: topic.tint }} />
          <span
            className="font-mono text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: topic.tint }}
          >
            {topic.label}
          </span>
        </div>
        )}

        {phase === 'asking' && (question.kind === 'maths' ? (
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
        ))}

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
            {/*
              * Right: take it and go. Wrong: another one, or go anyway.
              *
              * The reward is paid on `won` rather than on this last answer,
              * so getting one right and then trying another for fun cannot
              * take it away again.
              */}
            {verdict.correct ? (
              <button
                type="button"
                onClick={() => onDone(true)}
                className="block-btn mt-5 w-full bg-bolt py-4 text-lg text-ink short:mt-3 short:py-2.5 short:text-base"
              >
                Back to it
              </button>
            ) : (
              <div className="mt-5 grid gap-2.5 short:mt-3 short:grid-cols-2 short:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVerdict(null)
                    setRound((n) => n + 1)
                  }}
                  className="block-btn bg-bolt px-4 py-4 text-lg text-ink short:py-2.5 short:text-base"
                >
                  Try another one
                </button>
                <button
                  type="button"
                  onClick={() => onDone(won)}
                  className="block-btn px-4 py-3.5 text-base short:py-2.5 short:text-sm"
                >
                  {lastChance ? 'That is enough' : 'Back to it'}
                </button>
              </div>
            )}
          </div>
        )}

        {/*
          * The stakes, while a question is up.
          *
          * There used to be a note here explaining that there was no way past
          * the card, on the reasoning that a reward means nothing if answering
          * is optional. That turned out to be exactly backwards: with no way
          * past, the cheapest way out was to guess — so the reward was being
          * paid out at random and the question was not being read. Offering
          * the skip up front is what makes the answer mean something.
          */}
        {phase === 'asking' && !verdict && reward && (
          <p className="mt-4 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-moss short:mt-2">
            {won ? 'already won — this one is for fun' : `right answer: ${reward}`}
          </p>
        )}
      </div>
    </div>
  )
}
