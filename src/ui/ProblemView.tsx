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
  return (
    /*
     * Side by side on a phone held sideways.
     *
     * Stacked, a question and a keypad are about 400 pixels of height and the
     * screen is 360, so the bottom row of keys was simply gone. Landscape has
     * width going spare and no height at all, which is the one shape where
     * putting the question next to the answer is the obvious thing to do.
     */
    <div className="short:grid short:grid-cols-[1fr_1.15fr] short:items-start short:gap-4">
      <p className="text-xl leading-snug text-chalk sm:text-2xl short:self-center short:text-base">
        {fill(problem.prompt)}
      </p>
      <div className="mt-4 short:mt-0">
        <ProblemBody problem={problem} locked={locked} onAnswer={onAnswer} />
      </div>
    </div>
  )
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
    case 'path-count':
      return (
        <>
          <PathGrid data={problem.data as GridData} />
          <NumberEntry problem={problem} locked={locked} onAnswer={onAnswer} />
        </>
      )
    default:
      return (
        <>
          <BlockPile data={problem.data as { n?: number }} />
          <NumberEntry problem={problem} locked={locked} onAnswer={onAnswer} />
        </>
      )
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
    <div className="flex flex-col gap-3">
      {lines.map(({ name, text }) => {
        const on = chosen.includes(name)
        return (
          <button
            key={name}
            type="button"
            disabled={locked}
            onClick={() => toggle(name)}
            className={`block-btn flex items-center gap-4 text-left ${on ? 'border-moss bg-moss/15' : ''}`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-lg ${
                on ? 'border-moss bg-moss text-ink' : 'border-ink-line text-dim'
              }`}
            >
              {on ? '✓' : ''}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-bolt">{name}</span>
              <span className="block text-base font-normal text-chalk">&ldquo;{text}&rdquo;</span>
            </span>
          </button>
        )
      })}

      <p className="text-sm text-dim">
        Tap the ones telling the truth. It is fine to tap none of them.
      </p>

      <Btn tone="go" onClick={submit} disabled={locked}>
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
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, width: `min(100%, ${cols * 56}px)` }}
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
    <div className="flex flex-wrap justify-center gap-1.5">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-5 w-5 rounded border-2 border-bolt/40 bg-bolt/25 sm:h-6 sm:w-6" />
      ))}
    </div>
  )
}

export function Prompt({ text }: { text: string }) {
  return <p className="text-xl leading-snug sm:text-2xl">{fill(text)}</p>
}
