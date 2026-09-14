import { Btn } from './bits'

/**
 * A number pad drawn by the app.
 *
 * iOS throws up a full system keyboard for a real <input>, which on a tablet
 * eats half the screen and buries the problem being solved. Ten buttons and a
 * backspace are all that any answer here needs.
 */
export function Keypad({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
}) {
  const press = (digit: string) => {
    if (value.length >= 7) return
    onChange((value === '0' ? '' : value) + digit)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="block-panel flex min-h-[72px] items-center justify-end px-5 font-mono text-4xl font-bold tabular-nums"
        aria-live="polite"
      >
        {value || <span className="text-dim">?</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Btn key={d} onClick={() => press(d)} disabled={disabled} className="font-mono text-2xl">
            {d}
          </Btn>
        ))}

        <Btn onClick={() => onChange(value.slice(0, -1))} disabled={disabled} className="text-xl">
          &larr;
        </Btn>
        <Btn onClick={() => press('0')} disabled={disabled} className="font-mono text-2xl">
          0
        </Btn>
        <Btn tone="go" onClick={onSubmit} disabled={disabled || value.length === 0}>
          Check
        </Btn>
      </div>
    </div>
  )
}
