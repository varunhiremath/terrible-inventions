import { describe, expect, it } from 'vitest'
import { makeZip } from './zip'

const bytes = (s: string) => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>

describe('makeZip', () => {
  it('writes the expected signatures and entry count', async () => {
    const blob = makeZip([
      { name: 'voice/a.m4a', bytes: bytes('first clip') },
      { name: 'voice/b.m4a', bytes: bytes('second clip, a bit longer') },
    ])
    const buf = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(buf.buffer)

    expect(view.getUint32(0, true)).toBe(0x04034b50) // first local header

    const eocd = buf.length - 22
    expect(view.getUint32(eocd, true)).toBe(0x06054b50) // end of central directory
    expect(view.getUint16(eocd + 8, true)).toBe(2) // entries on this disk
    expect(view.getUint16(eocd + 10, true)).toBe(2) // entries total

    // The central directory must start exactly where the locals stop.
    const centralOffset = view.getUint32(eocd + 16, true)
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50)
    expect(centralOffset + view.getUint32(eocd + 12, true)).toBe(eocd)
  })

  it('round-trips names and contents through the stored entries', async () => {
    const files = {
      'voice/greeting-1.m4a': 'hello there',
      'voice/right-3.m4a': 'correct, and you worked it out',
      'voice/struggle-4.m4a': '',
    }

    const blob = makeZip(
      Object.entries(files).map(([name, text]) => ({ name, bytes: bytes(text) })),
    )
    const buf = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(buf.buffer)
    const decoder = new TextDecoder()

    // Walk the local headers the way an unzip would.
    const found: Record<string, string> = {}
    let at = 0
    while (view.getUint32(at, true) === 0x04034b50) {
      const size = view.getUint32(at + 18, true)
      const nameLength = view.getUint16(at + 26, true)
      const extraLength = view.getUint16(at + 28, true)
      const name = decoder.decode(buf.subarray(at + 30, at + 30 + nameLength))
      const start = at + 30 + nameLength + extraLength
      found[name] = decoder.decode(buf.subarray(start, start + size))
      at = start + size
    }

    expect(found).toEqual(files)
  })

  it('handles an empty archive without corrupting the trailer', async () => {
    const buf = new Uint8Array(await makeZip([]).arrayBuffer())
    expect(buf.length).toBe(22)
    expect(new DataView(buf.buffer).getUint32(0, true)).toBe(0x06054b50)
  })
})
