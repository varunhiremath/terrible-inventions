/**
 * The relay.
 *
 * Two phones cannot talk to each other directly. A browser can open a
 * connection but cannot accept one, so something has to sit in the middle and
 * introduce them — and since something has to be there anyway, it may as well
 * pass the messages along rather than go to the trouble of handing off to a
 * peer-to-peer connection afterwards. On a home network the round trip through
 * a box in the same room is a couple of milliseconds, which is less than a
 * frame.
 *
 * What it does is the whole of what it does: a room has two seats, whatever
 * arrives at one seat is sent to the other, and when either leaves the room is
 * closed. It does not know what a race is, it never looks inside a message,
 * and it keeps nothing.
 *
 *   node server/relay.mjs
 *
 * It prints the addresses to type into the app. Both devices need to be on the
 * same wifi as the machine running it. There is also a Cloudflare Worker in
 * this folder that does exactly the same job, for playing from two different
 * houses; see the README.
 */
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 8787)

/** code -> the seats in that room. Two at most; the third is turned away. */
const rooms = new Map()

const server = createServer((req, res) => {
  // A plain GET, so you can check from a phone's browser that you typed the
  // address right before wondering why the game will not connect.
  res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' })
  res.end(`terrible-inventions relay: ${rooms.size} room(s) open\n`)
})

const wss = new WebSocketServer({ server })

wss.on('connection', (socket, req) => {
  const code = new URL(req.url, 'http://x').pathname.replace(/^\/+|\/+$/g, '').toUpperCase()
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    socket.close(4000, 'bad room code')
    return
  }

  const seats = rooms.get(code) ?? []
  if (seats.length >= 2) {
    socket.close(4001, 'room full')
    return
  }
  seats.push(socket)
  rooms.set(code, seats)

  // Whoever got here first is the host: they run the race, the other watches
  // their own car in it. Said out loud rather than assumed, because which of
  // the two devices opened the app first is not something either can work out.
  socket.send(JSON.stringify({ t: 'seat', host: seats.length === 1 }))
  if (seats.length === 2) {
    for (const seat of seats) send(seat, { t: 'both' })
  }

  socket.on('message', (data, isBinary) => {
    for (const seat of rooms.get(code) ?? []) {
      if (seat !== socket && seat.readyState === 1) seat.send(data, { binary: isBinary })
    }
  })

  const leave = () => {
    const left = (rooms.get(code) ?? []).filter((seat) => seat !== socket)
    if (left.length === 0) rooms.delete(code)
    else {
      rooms.set(code, left)
      for (const seat of left) send(seat, { t: 'gone' })
    }
  }
  socket.on('close', leave)
  socket.on('error', leave)
})

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message))
}

server.listen(PORT, () => {
  const addresses = []
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address)
    }
  }
  console.log(`relay listening on port ${PORT}`)
  console.log('')
  console.log('Put one of these into the app, under Settings → Playing together:')
  for (const address of addresses) console.log(`    ws://${address}:${PORT}`)
  if (addresses.length === 0) console.log(`    ws://localhost:${PORT}   (this machine only)`)
})
