import { useState } from 'react'
import { Keypad } from './Keypad'
import { Btn } from './bits'
import { fill } from '../config/profile'
import type { Problem } from '../engine/types'

/**
 * Each kind of problem gets its own way in, because for most of them the
 * picture and the answer are the same object: you tap the broken step, or the
 * machine you think is lying, rather than translating your thinking into a
 * number first.
 *
 * The question itself is printed here rather than by whoever is showing the
 * problem. It was left to the caller once, and the caller forgot: a pile of
 * blocks and a number pad turned up with nothing at all saying what was being
 * asked. Keeping it in here means there is no caller that can get it wrong.
 */
export function ProblemView({
  problem,
  locked,
  onAnswer,
}: {
  problem: Problem
  locked: boolean
  onAnswer: (given: string, correct: boolean) => void
}) {
  const figure = figureFor(problem)

  return (
    /*
     * Side by side on a phone held sideways.
     *
     * Stacked, a question and a keypad are about 400 pixels of height and the
     * screen is 360, so the bottom row of keys was simply gone. Landscape has
     * width going spare and no height at all, which is the one shape where
     * putting the question next to the answer is the obvious thing to do.
     *
     * The picture goes on the question's side, not the keypad's. It was in
     * with the keypad, which is fine until a question has both — and the route
     * counting one always does. A four-by-four grid and a twelve-key pad in
     * one column comes to nearly six hundred pixels on a screen four hundred
     * tall, so the bottom two thirds of the keypad were off the edge, reachable
     * only by scrolling a panel nobody would think to scroll mid-game. The
     * audit called it and it was right.
     */
    <div className="short:grid short:grid-cols-[1fr_1.15fr] short:items-start short:gap-4">
      <div className="short:self-center">
        <p className="text-xl leading-snug text-chalk sm:text-2xl short:text-base">
          {fill(problem.prompt)}
        </p>
        {figure && <div className="mt-4 short:mt-2">{figure}</div>}
      </div>
      <div className="mt-4 short:mt-0">
        <ProblemBody problem={problem} locked={locked} onAnswer={onAnswer} />
      </div>
    </div>
  )
}

/**
 * The picture that goes with a problem, if it has one.
 *
 * Kept apart from the answer control so the two can be laid out separately,
 * which is the whole of the fix above.
 */
function figureFor(problem: Problem) {
  if (problem.kind === 'path-count') return <PathGrid data={problem.data as GridData} />
  if (problem.kind === 'papas-mistake') return null
  if (problem.kind === 'knights-knaves') return null
  if (problem.kind === 'fraction-duel') return null
  return <BlockPile data={problem.data as { n?: number }} />
}

function ProblemBody({
  problem,
  locked,
  onAnswer,
}: {
  problem: Problem
  locked: boolean
  onAnswer: (given: string, correct: boolean) => void
}) {
  switch (problem.kind) {
    case 'papas-mistake':
      return <StepPicker problem={problem} locked={locked} onAnswer={onAnswer} />
    case 'knights-knaves':
      return <MachinePicker problem={problem} locked={locked} onAnswer={onAnswer} />
    case 'fraction-duel':
      return <FractionPicker problem={problem} locked={locked} onAnswer={onAnswer} />
    // The pictures for these two are drawn by `figureFor`, over on the
    // question's side of a sideways screen.
    case 'path-count':
    default:
      return <NumberEntry problem={problem} locked={locked} onAnswer={onAnswer} />
  }
}

function NumberEntry({
  problem,
  locked,
  onAnswer,
}: {
  problem: Problem
  locked: boolean
  onAnswer: (given: string, correct: boolean) => void
}) {
  const [value, setValue] = useState('')

  const submit = () => {
    if (locked || value === '' || problem.answer.type !== 'number') return
    onAnswer(value, Number(value) === problem.answer.value)
  }

  return <Keypad value={value} onChange={setValue} onSubmit={submit} disabled={locked} />
}

function StepPicker({
  problem,
  locked,
  onAnswer,
}: {
  problem: Problem
  locked: boolean
  onAnswer: (given: string, correct: boolean) => void
}) {
  const { lines } = problem.data as { lines: string[] }
  const answer = problem.answer
  const [picked, setPicked] = useState<number | null>(null)

  const choose = (i: number) => {
    if (locked || answer.type !== 'choice') return
    setPicked(i)
    onAnswer(`Step ${i + 1}`, i === answer.correctIndex)
  }

  return (
    // Two across on a phone held sideways, or the last answer falls off.
    <div className="grid grid-cols-1 gap-2 short:grid-cols-2">
      {lines.map((line, i) => (
        <button
          key={line}
          type="button"
          disabled={locked}
          onClick={() => choose(i)}
          className={`block-btn text-left font-mono text-lg sm:text-xl short:text-sm ${
            picked === i ? 'border-sky bg-sky text-ink' : ''
          } ${locked && answer.type === 'choice' && i === answer.correctIndex ? 'border-moss' : ''}`}
        >
          {line}
        </button>
      ))}
    </div>
  )
}

function MachinePicker({
  problem,
  locked,
  onAnswer,
}: {
  problem: Problem
  locked: boolean
  onAnswer: (given: string, correct: boolean) => void
}) {
  const { lines } = problem.data as { names: string[]; lines: { name: string; text: string }[] }
  const [chosen, setChosen] = useState<string[]>([])

  const toggle = (name: string) => {
    if (locked) return
    setChosen((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const submit = () => {
    if (locked || problem.answer.type !== 'set') return
    const want = [...problem.answer.values].sort()
    const got = [...chosen].sort()
    onAnswer(
      got.length ? got.join(', ') : 'nobody',
      want.length === got.length && want.every((v, i) => v === got[i]),
    )
  }

  return (
    /*
     * Four statements, a line of instructions and a Check button come to about
     * four hundred pixels stacked, and a small phone held sideways has three
     * hundred and sixty. The Check was off the bottom edge entirely, which on
     * the one question in the set that cannot be answered by tapping an option
     * means the question cannot be answered at all. So on a short screen every
     * row gives some height back: the name goes on the same line as what it
     * said, the tick box shrinks, and the instructions become one small line.
     */
    <div className="flex flex-col gap-3 short:gap-1.5">
      {lines.map(({ name, text }) => {
        const on = chosen.includes(name)
        return (
          <button
            key={name}
            type="button"
            disabled={locked}
            onClick={() => toggle(name)}
            className={`block-btn flex items-center gap-4 text-left short:gap-2 short:py-1.5 ${
              on ? 'border-moss bg-moss/15' : ''
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-lg
                          short:h-6 short:w-6 short:rounded-lg short:text-sm ${
                on ? 'border-moss bg-moss text-ink' : 'border-ink-line text-dim'
              }`}
            >
              {on ? '✓' : ''}
            </span>
            <span className="min-w-0 short:flex short:items-baseline short:gap-2">
              <span className="block font-bold text-bolt short:text-sm">{name}</span>
              <span className="block text-base font-normal text-chalk short:text-sm short:leading-tight">
                &ldquo;{text}&rdquo;
              </span>
            </span>
          </button>
        )
      })}

      <p className="text-sm text-dim short:text-[0.7rem] short:leading-tight">
        Tap the ones telling the truth. It is fine to tap none of them.
      </p>

      <Btn tone="go" onClick={submit} disabled={locked} className="short:py-1.5 short:text-sm">
        Check
      </Btn>
    </div>
  )
}

function FractionPicker({
  problem,
  locked,
  onAnswer,
}: {
  problem: Problem
  locked: boolean
  onAnswer: (given: string, correct: boolean) => void
}) {
  const answer = problem.answer
  const [picked, setPicked] = useState<number | null>(null)
  if (answer.type !== 'choice') return null

  const choose = (i: number) => {
    if (locked) return
    setPicked(i)
    onAnswer(answer.options[i], i === answer.correctIndex)
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 short:gap-2">
      {answer.options.map((option, i) => {
        const [top, bottom] = option.split('/')
        return (
          <button
            key={option}
            type="button"
            disabled={locked}
            onClick={() => choose(i)}
            className={`block-btn flex flex-col items-center justify-center gap-1 py-8 short:py-3 ${
              picked === i ? 'border-sky bg-sky text-ink' : ''
            } ${locked && i === answer.correctIndex ? 'border-moss' : ''}`}
          >
            <span className="font-mono text-5xl leading-none short:text-3xl">{top}</span>
            <span className="h-[3px] w-14 rounded bg-current" />
            <span className="font-mono text-5xl leading-none short:text-3xl">{bottom}</span>
          </button>
        )
      })}
    </div>
  )
}

interface GridData {
  cols: number
  rows: number
  blocked: [number, number][]
}

function PathGrid({ data }: { data: GridData }) {
  const { cols, rows, blocked } = data
  const isBlocked = (r: number, c: number) => blocked.some(([br, bc]) => br === r && bc === c)

  return (
    <div className="flex justify-center">
      <div
        // Smaller cells on a short screen: the grid is there to be understood,
        // not admired, and the height it takes is height the keypad wants.
        className="grid gap-1.5 short:gap-1 short:[--cell:30px]"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          width: `min(100%, calc(${cols} * var(--cell, 56px)))`,
        }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols)
          const c = i % cols
          const start = r === 0 && c === 0
          const end = r === rows - 1 && c === cols - 1

          return (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-bold ${
                isBlocked(r, c)
                  ? 'border-ink-line bg-ink text-dim'
                  : start
                    ? 'border-moss bg-moss/20 text-moss'
                    : end
                      ? 'border-bolt bg-bolt/20 text-bolt'
                      : 'border-ink-line bg-ink-soft'
              }`}
            >
              {isBlocked(r, c) ? '✕' : start ? 'IN' : end ? 'OUT' : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BlockPile({ data }: { data: { n?: number } }) {
  const n = data?.n
  if (!n || n > 60) return null

  return (
    // Smaller bricks on a short screen: forty-five of them at full size is a
    // pile five rows deep, and those rows come out of the keypad's height.
    <div className="flex flex-wrap justify-center gap-1.5 short:gap-1">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="h-5 w-5 rounded border-2 border-bolt/40 bg-bolt/25 sm:h-6 sm:w-6 short:h-3 short:w-3 short:rounded-sm short:border"
        />
      ))}
    </div>
  )
}

export function Prompt({ text }: { text: string }) {
  return <p className="text-xl leading-snug sm:text-2xl">{fill(text)}</p>
}
