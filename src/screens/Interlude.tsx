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
 * ONE question, and the word is doing work.
 *
 * A wrong answer used to offer another, as many as he liked, on the reasoning
 * that somebody asking for another question is exactly what this card exists
 * to encourage. It is — and the reward made it a loophole rather than an
 * invitation. Reported from the sofa again: "he is using the questions as a
 * way to get infinite lives". Of course he was. Every death was recoverable
 * with certainty, because you could keep taking questions until one of them
 * came out right, so the lives in the corner of the screen stopped meaning
 * anything and the game stopped being a game.
 *
 * One attempt puts the risk back without taking the generosity away: the
 * bargain is still offered, a wrong answer still gets its explanation, and
 * nothing is ever taken off him for guessing. It just does not pay twice.
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

  // Chosen once, not on every render: a re-render is not a reroll, and a
  // question that changed under you as you thought about it would be cruel.
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

  /*
   * Everything gets smaller once it has been answered.
   *
   * The card grows by an explanation and a button at the moment of answering,
   * which is the moment it has the least room to grow into — reported as
   * having to scroll up and down to find the way back. The question still has
   * to be readable next to the verdict, so nothing is removed; the parts that
   * were sized for *choosing* an answer, which nobody is doing any more, give
   * up their room instead.
   */
  const tight = verdict !== null

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
      {/*
        * A column with the buttons nailed to the bottom of it.
        *
        * The card used to be one scrolling box, so a long explanation pushed
        * the way out below the fold and getting back into the game meant
        * scrolling to find it. Whatever happens above, the thing you press is
        * on the screen: the reading scrolls, the doing does not.
        */}
      <div className="rise-in block-panel flex max-h-full w-full max-w-xl flex-col p-5 sm:p-6 short:max-w-3xl short:p-3">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {phase === 'offer' && (
            <div className="fade-in">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-rust">
                {lastChance ? 'Last one' : 'A question, if you want it'}
              </p>
              <p className="mt-2 text-xl leading-snug text-chalk sm:text-2xl short:text-base">
                {lastChance
                  ? 'That was the last of them. Get this one right and you can keep going.'
                  : `Answer it and you get ${reward ?? 'it'} back. Or carry straight on without.`}
              </p>
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
                <div
                  className={`mx-auto overflow-hidden rounded-xl border-2 border-ink-line shadow-block ${
                    tight ? 'mt-2 max-w-[9rem] short:mt-1 short:max-w-[7rem]'
                          : 'mt-4 short:mt-2 short:max-w-[12rem]'
                  }`}
                >
                  <div className="aspect-[3/2] w-full">
                    <FlagBox name={question.item.flag} className="rounded-none" />
                  </div>
                </div>
              )}

              <p
                className={`leading-snug text-chalk ${
                  tight ? 'mt-3 text-base sm:text-lg short:mt-1.5 short:text-sm'
                        : 'mt-4 text-xl sm:text-2xl short:mt-2 short:text-base'
                }`}
              >
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
                className={`grid ${tight ? 'mt-3 gap-1.5 short:mt-1.5' : 'mt-5 gap-2.5 short:mt-2.5 short:gap-2'} ${
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
                      className={`rise-in block-btn flex items-center gap-3 text-left transition-colors
                                  disabled:opacity-100 ${
                                    tight
                                      ? 'px-3 py-1.5 text-sm short:py-1'
                                      : 'px-4 py-3.5 text-base short:py-2 short:text-sm'
                                  } ${mark}`}
                    >
                      {question.item.showFlags ? (
                        <span
                          className={`w-full overflow-hidden rounded-lg border-2 border-ink-line ${
                            tight ? 'h-8 short:h-6' : 'h-14 sm:h-16 short:h-9'
                          }`}
                        >
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
            <div className="fade-in mt-3 border-t-2 border-ink-line pt-3 short:mt-2 short:pt-2">
              <p
                className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${
                  verdict.correct ? 'text-moss' : 'text-rust'
                }`}
              >
                {verdict.correct ? 'Got it' : 'Not that one'}
              </p>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-chalk/90 short:text-sm">
                {fill(question.kind === 'maths' ? question.problem.explain : question.item.explain)}
              </p>
              {reward && verdict.correct && (
                <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-moss">
                  {reward}
                </p>
              )}
            </div>
          )}
        </div>

        {/* --- the part you press, which never scrolls ------------------- */}
        <div className="shrink-0">
          {phase === 'offer' && (
            <div className="mt-5 grid gap-2.5 short:mt-3 short:grid-cols-2 short:gap-2">
              <button
                type="button"
                onClick={() => setPhase('asking')}
                className="block-btn bg-bolt px-4 py-4 text-lg text-ink short:py-2.5 short:text-base"
              >
                {lastChance ? 'Give me the question' : `Answer it for ${reward ?? 'it'}`}
              </button>
              <button
                type="button"
                onClick={() => onDone(false)}
                className="block-btn px-4 py-3.5 text-base short:py-2.5 short:text-sm"
              >
                {lastChance ? 'No thanks, I am done' : 'Carry on without it'}
              </button>
            </div>
          )}

          {/*
            * The stakes, while the question is up.
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
              {`right answer: ${reward}`}
            </p>
          )}

          {/*
            * One way out, whichever way it went.
            *
            * This used to offer another question after a wrong one. That is
            * how the lives in the corner stopped meaning anything — see the
            * note at the top of the file.
            */}
          {verdict && (
            <button
              type="button"
              onClick={() => onDone(verdict.correct)}
              className="block-btn mt-4 w-full bg-bolt py-4 text-lg text-ink short:mt-2.5 short:py-2.5 short:text-base"
            >
              Back to it
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
