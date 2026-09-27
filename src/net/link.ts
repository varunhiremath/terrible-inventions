/**
 * The line between two devices.
 *
 * Deliberately a socket to a relay rather than a peer-to-peer connection.
 * WebRTC would shave a few milliseconds off on a home network and costs an ICE
 * negotiation, a signalling exchange, a STUN server and a fallback for the
 * ten-or-so per cent of networks that refuse to let two browsers talk directly
 * — and something has to sit in the middle to introduce them anyway. Since it
 * has to be there, it may as well carry the messages. A round trip through a
 * laptop in the same room is a couple of milliseconds; through a Cloudflare
 * edge it is a few tens. A race is playable at either.
 *
 * The relay has two seats to a room and no idea what any of it means. Whoever
 * takes the first seat runs the race. See `server/README.md`.
 */

export type Seat = 'host' | 'guest'

export type LinkState =
  | { at: 'off' }
  | { at: 'dialling' }
  /** Connected, seat known, waiting for the other person. */
  | { at: 'waiting'; seat: Seat }
  | { at: 'playing'; seat: Seat }
  | { at: 'lost'; why: string }

type Listener = (state: LinkState) => void

export interface Link {
  send(message: unknown): void
  /** What arrives from the other end. Replaces any previous one. */
  onMessage(handler: (message: unknown) => void): void
  onState(listener: Listener): () => void
  state(): LinkState
  close(): void
}

/** Four letters, no vowels, so a room code cannot come out as a word. */
const LETTERS = 'BCDFGHJKLMNPQRSTVWXYZ23456789'

export function makeCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += LETTERS[Math.floor(Math.random() * LETTERS.length)]
  }
  return code
}

/**
 * Tidy up whatever was typed into the relay box.
 *
 * People paste `https://…` because that is what the deploy printed, and type
 * an address with no scheme at all because that is what an address looks like.
 * Both are what they meant.
 */
export function relayUrl(typed: string, code: string): string | null {
  const text = typed.trim().replace(/\/+$/, '')
  if (!text) return null
  let base = text
  if (base.startsWith('https://')) base = `wss://${base.slice('https://'.length)}`
  else if (base.startsWith('http://')) base = `ws://${base.slice('http://'.length)}`
  else if (!base.startsWith('ws://') && !base.startsWith('wss://')) base = `ws://${base}`
  return `${base}/${code.toUpperCase()}`
}

export function connect(url: string): Link {
  let state: LinkState = { at: 'dialling' }
  const listeners = new Set<Listener>()
  let handler: ((message: unknown) => void) | null = null
  let socket: WebSocket | null = null
  let seat: Seat | null = null
  let shut = false

  const move = (next: LinkState) => {
    state = next
    for (const listener of listeners) listener(state)
  }

  try {
    socket = new WebSocket(url)
  } catch {
    move({ at: 'lost', why: 'That relay address does not look like an address.' })
  }

  if (socket) {
    socket.onmessage = (event) => {
      let message: unknown
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      /*
       * Two kinds of message come down the same wire: the relay's own, which
       * say who you are and who else is here, and the game's, which the relay
       * has never looked at. They are told apart by their tag, and the relay's
       * are handled here rather than being passed on.
       */
      const tag = (message as { t?: string }).t
      if (tag === 'seat') {
        seat = (message as { host: boolean }).host ? 'host' : 'guest'
        move({ at: 'waiting', seat })
        return
      }
      if (tag === 'both') {
        if (seat) move({ at: 'playing', seat })
        return
      }
      if (tag === 'gone') {
        if (seat) move({ at: 'waiting', seat })
        return
      }
      handler?.(message)
    }

    socket.onclose = (event) => {
      if (shut) return
      move({
        at: 'lost',
        why:
          event.code === 4001
            ? 'Somebody else is already using that code. Try another one.'
            : event.code === 4000
              ? 'That code is not one this relay will take.'
              : 'The line went down.',
      })
    }

    socket.onerror = () => {
      if (shut) return
      move({ at: 'lost', why: 'Could not reach the relay. Check the address and the wifi.' })
    }
  }

  return {
    send(message) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message))
      }
    },
    onMessage(next) {
      handler = next
    },
    onState(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    state: () => state,
    close() {
      shut = true
      socket?.close()
      move({ at: 'off' })
    },
  }
}
