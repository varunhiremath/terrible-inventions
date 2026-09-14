/**
 * A minimal ZIP writer — stored entries only, no compression.
 *
 * Exists so the recording booth can hand back all the clips as one file instead
 * of thirty-seven separate downloads. Audio is already compressed, so storing
 * rather than deflating costs nothing and keeps this dependency-free.
 */

const crcTable = /* @__PURE__ */ (() =>
  Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  }))()

function crc32(bytes: Uint8Array<ArrayBuffer>): number {
  let c = 0xffffffff
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  /**
   * Pinned to a plain ArrayBuffer rather than ArrayBufferLike: a Blob cannot be
   * built from a view over a SharedArrayBuffer, and TypeScript now tracks that.
   */
  bytes: Uint8Array<ArrayBuffer>
}

export function makeZip(entries: readonly ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const locals: BlobPart[] = []
  const centrals: BlobPart[] = []
  let offset = 0
  let centralSize = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.bytes)
    const size = entry.bytes.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true) // local file header
    local.setUint16(4, 20, true) // version needed
    local.setUint16(8, 0, true) // method: stored
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true) // compressed size
    local.setUint32(22, size, true) // uncompressed size
    local.setUint16(26, name.length, true)

    locals.push(new Uint8Array(local.buffer), name, entry.bytes)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true) // central directory header
    central.setUint16(4, 20, true) // version made by
    central.setUint16(6, 20, true) // version needed
    central.setUint16(10, 0, true) // method: stored
    central.setUint32(16, crc, true)
    central.setUint32(20, size, true)
    central.setUint32(24, size, true)
    central.setUint16(28, name.length, true)
    central.setUint32(42, offset, true) // offset of local header

    centrals.push(new Uint8Array(central.buffer), name)
    centralSize += 46 + name.length
    offset += 30 + name.length + size
  }

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true) // end of central directory
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], {
    type: 'application/zip',
  })
}


/** One file recovered from an archive. */
export interface ZipFile {
  name: string
  bytes: Uint8Array<ArrayBuffer>
}

/**
 * Reads an archive back.
 *
 * The counterpart to `makeZip`, so recordings can be carried from the device
 * they were made on to the device they will be played on without ever being
 * published. Handles stored entries (what this app writes) and deflated ones
 * (what every other zip tool writes), so a file that has been through a desktop
 * archiver on the way still opens.
 */
export async function readZip(blob: Blob): Promise<ZipFile[]> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  const eocd = findEndOfCentralDirectory(view, buf.length)
  if (eocd === -1) throw new Error('not a zip file')

  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)

  const decoder = new TextDecoder()
  const out: ZipFile[] = []

  for (let i = 0; i < count; i++) {
    if (at + 46 > buf.length || view.getUint32(at, true) !== 0x02014b50) break

    const method = view.getUint16(at + 10, true)
    const compressedSize = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const localOffset = view.getUint32(at + 42, true)
    const name = decoder.decode(buf.subarray(at + 46, at + 46 + nameLength))

    // Directory entries have no content of their own.
    if (!name.endsWith('/')) {
      // The local header repeats the name and extra fields, at its own lengths.
      const localNameLength = view.getUint16(localOffset + 26, true)
      const localExtraLength = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const raw = buf.slice(start, start + compressedSize)

      out.push({ name, bytes: method === 0 ? raw : await inflate(raw) })
    }

    at += 46 + nameLength + extraLength + commentLength
  }

  return out
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('this browser cannot read compressed archives')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Scans backwards for the end-of-central-directory signature. It sits at the
 * very end unless the archive carries a comment, which is why this searches
 * rather than reading a fixed offset.
 */
function findEndOfCentralDirectory(view: DataView, length: number): number {
  const earliest = Math.max(0, length - 0xffff - 22)
  for (let i = length - 22; i >= earliest; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i
  }
  return -1
}
