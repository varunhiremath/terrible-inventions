/**
 * Writes the app icons from a pixel pattern, with no image library and no
 * network. The look is meant to match the app: chunky blocks, one accent
 * colour, readable at 40px on a home screen.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [0x14, 0x16, 0x1f]
const FG = [0xff, 0xc8, 0x4a]

// A cog, eight by eight.
const COG = [
  '.XX..XX.',
  'XXXXXXXX',
  'XX....XX',
  '.X.XX.X.',
  '.X.XX.X.',
  'XX....XX',
  'XXXXXXXX',
  '.XX..XX.',
]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size, padding) {
  const cell = (size - padding * 2) / COG.length
  const raw = Buffer.alloc(size * (size * 3 + 1))

  let at = 0
  for (let y = 0; y < size; y++) {
    raw[at++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - padding) / cell)
      const gy = Math.floor((y - padding) / cell)
      const lit =
        gy >= 0 && gy < COG.length && gx >= 0 && gx < COG.length && COG[gy][gx] === 'X'
      const [r, g, b] = lit ? FG : BG
      raw[at++] = r
      raw[at++] = g
      raw[at++] = b
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Maskable icons get a fatter margin so nothing is lost when a launcher
// crops the corners into a circle.
for (const [size, padding] of [
  [180, 30],
  [192, 32],
  [512, 96],
]) {
  const file = `public/icon-${size}.png`
  writeFileSync(file, png(size, padding))
  console.log(`wrote ${file}`)
}
