import { describe, expect, it } from 'vitest'
import { makeZip, readZip } from './zip'

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

describe('readZip', () => {
  it('reads back what makeZip wrote', async () => {
    const files = {
      'voice/greeting-1.m4a': 'first clip',
      'voice/struggle-4.m4a': 'a longer one, with, punctuation',
      'voice/right-1.m4a': '',
    }
    const blob = makeZip(Object.entries(files).map(([name, text]) => ({ name, bytes: bytes(text) })))

    const read = await readZip(blob)
    const decoder = new TextDecoder()
    expect(Object.fromEntries(read.map((f) => [f.name, decoder.decode(f.bytes)]))).toEqual(files)
  })

  it('survives a round trip of many entries', async () => {
    const entries = Array.from({ length: 37 }, (_, i) => ({
      name: `voice/line-${i}.m4a`,
      bytes: bytes(`clip number ${i} `.repeat(i + 1)),
    }))
    const read = await readZip(makeZip(entries))
    expect(read).toHaveLength(37)
    expect(read.map((f) => f.name)).toEqual(entries.map((e) => e.name))
    expect(read[36].bytes.length).toBe(entries[36].bytes.length)
  })

  it('reads an empty archive as no files', async () => {
    expect(await readZip(makeZip([]))).toEqual([])
  })

  it('rejects something that is not a zip', async () => {
    await expect(readZip(new Blob([bytes('just some text, not an archive at all')]))).rejects.toThrow(
      /not a zip/,
    )
  })
})
