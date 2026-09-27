import { useEffect, useState } from 'react'
import { Btn } from '../ui/bits'
import { useStore } from '../store'
import { connect, makeCode, relayUrl, type Link, type LinkState } from '../net/link'

/**
 * Getting two devices into the same race.
 *
 * Four letters, typed on the other phone. There is nothing else to it from
 * where he is standing, and that is the point: anything involving an address
 * or an account is a thing a nine-year-old cannot do on his own, and the
 * address is asked for once, in the settings, by whoever set the relay up.
 *
 * The codes have no vowels in them, so a random four cannot come out as a word
 * anybody would rather it had not.
 */
export function Together({
  onLive,
  onClose,
}: {
  onLive: (link: Link, host: boolean) => void
  onClose: () => void
}) {
  const relay = useStore((s) => s.save.relay ?? '')
  const setRelay = useStore((s) => s.setRelay)

  const [address, setAddress] = useState(relay)
  const [code, setCode] = useState('')
  const [typed, setTyped] = useState('')
  const [link, setLink] = useState<Link | null>(null)
  const [state, setState] = useState<LinkState>({ at: 'off' })

  useEffect(() => {
    if (!link) return
    return link.onState(setState)
  }, [link])

  // Once both are in, hand the line over and get out of the way.
  useEffect(() => {
    if (state.at === 'playing' && link) onLive(link, state.seat === 'host')
  }, [state, link, onLive])

  const dial = (want: string) => {
    const url = relayUrl(address, want)
    if (!url) return
    setRelay(address)
    setCode(want)
    link?.close()
    setLink(connect(url))
  }

  const stop = () => {
    link?.close()
    setLink(null)
    setState({ at: 'off' })
    setCode('')
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-3"
      /* The road steers on pointer events and captures them, which kills the
         click on anything inside an overlay. Every panel in here does this. */
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="block-panel w-full max-w-md p-5 short:p-3">
        <p className="text-sm font-bold uppercase tracking-wider text-rust">Play together</p>

        {!address.trim() && (
          <>
            <p className="mt-2 text-sm leading-snug text-dim">
              Two devices need something in the middle to pass messages between them.
              There is a laptop-sized one in <span className="text-chalk">server/</span> —
              run it and it prints the address to put here.
            </p>
            <input
              className="mt-2 w-full rounded-xl border-2 border-ink-line bg-ink px-3 py-2.5
                         text-base text-chalk outline-none focus:border-sky"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ws://192.168.1.24:8787"
              aria-label="Relay address"
            />
          </>
        )}

        {address.trim() && state.at === 'off' && (
          <>
            <p className="mt-2 text-lg leading-snug">
              One of you starts a race and reads out the code. The other types it in.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Btn tone="go" onClick={() => dial(makeCode())} className="py-3">
                Start a race
              </Btn>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border-2 border-ink-line bg-ink px-3 py-2.5
                             text-center font-mono text-xl uppercase tracking-[0.3em]
                             text-chalk outline-none focus:border-sky"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="CODE"
                  aria-label="Race code"
                />
                <Btn
                  onClick={() => dial(typed)}
                  disabled={typed.length < 4}
                  className="shrink-0 px-4 py-2.5"
                >
                  Join
                </Btn>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAddress('')}
              className="mt-3 text-xs text-dim underline"
            >
              Change the relay address
            </button>
          </>
        )}

        {state.at === 'dialling' && <p className="mt-3 text-lg">Calling…</p>}

        {state.at === 'waiting' && (
          <div className="mt-3">
            {state.seat === 'host' ? (
              <>
                <p className="text-sm text-dim">Read this out:</p>
                <p className="mt-1 font-mono text-5xl font-bold tracking-[0.2em] text-bolt">
                  {code}
                </p>
                <p className="mt-2 text-sm text-dim">Waiting for the other one to join…</p>
              </>
            ) : (
              <p className="text-lg">In. Waiting for the race to start…</p>
            )}
          </div>
        )}

        {state.at === 'lost' && (
          <p className="mt-3 text-lg leading-snug text-rust">{state.why}</p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {state.at !== 'off' && <Btn onClick={stop}>Stop</Btn>}
          <Btn onClick={onClose}>Back to the race</Btn>
        </div>
      </div>
    </div>
  )
}
