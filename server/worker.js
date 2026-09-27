/**
 * The same relay, for playing from two different houses.
 *
 * `relay.mjs` is the one to use when both devices are on the same wifi — it
 * runs on any laptop in the house, needs no account and nothing to set up. This
 * is for when they are not: a Cloudflare Worker with one Durable Object per
 * room, which is free for anything like this amount of traffic.
 *
 *   cd server && npx wrangler deploy
 *
 * It prints a https://… address. Put the same address into the app with
 * `wss://` in place of `https://`.
 *
 * It does exactly what the local one does and knows exactly as little: two
 * seats to a room, whatever arrives at one goes to the other, nothing is
 * looked inside and nothing is kept.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const code = url.pathname.replace(/^\/+|\/+$/g, '').toUpperCase()

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('terrible-inventions relay\n', {
        headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' },
      })
    }
    if (!/^[A-Z0-9]{4,8}$/.test(code)) return new Response('bad room code', { status: 400 })

    // One object per room, named after the code, so the two devices that typed
    // the same code land in the same place wherever in the world they are.
    const room = env.ROOMS.get(env.ROOMS.idFromName(code))
    return room.fetch(request)
  },
}

export class Room {
  constructor(state) {
    this.state = state
    this.seats = []
  }

  async fetch() {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    if (this.seats.length >= 2) {
      server.accept()
      server.close(4001, 'room full')
      return new Response(null, { status: 101, webSocket: client })
    }

    server.accept()
    this.seats.push(server)
    server.send(JSON.stringify({ t: 'seat', host: this.seats.length === 1 }))
    if (this.seats.length === 2) {
      for (const seat of this.seats) this.tell(seat, { t: 'both' })
    }

    server.addEventListener('message', (event) => {
      for (const seat of this.seats) {
        if (seat !== server) {
          try {
            seat.send(event.data)
          } catch {
            // The other end went away mid-send. The close handler tidies up.
          }
        }
      }
    })

    const leave = () => {
      this.seats = this.seats.filter((seat) => seat !== server)
      for (const seat of this.seats) this.tell(seat, { t: 'gone' })
    }
    server.addEventListener('close', leave)
    server.addEventListener('error', leave)

    return new Response(null, { status: 101, webSocket: client })
  }

  tell(seat, message) {
    try {
      seat.send(JSON.stringify(message))
    } catch {
      // Same again: nothing to do but let the close handler run.
    }
  }
}
