import { describe, it, expect } from 'vitest'
import { buildZip } from '@/utils/zip'

// Re-implement CRC32 locally for verification (not exported from source)
const CRC32_POLYNOMIAL = 0xedb88320
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let j = 0; j < 8; j++)
      crc = (crc >>> 1) ^ (crc & 1 ? CRC32_POLYNOMIAL : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf))
}

describe('buildZip', () => {
  it('returns a Blob with application/zip MIME type', () => {
    const blob = buildZip('test.txt', new Uint8Array([1, 2, 3]))
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/zip')
  })

  it('starts with local file header magic 0x04034b50', async () => {
    const bytes = await toBytes(buildZip('a.txt', new Uint8Array([0xff])))
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
  })

  it('uses compression method 0 (store)', async () => {
    const bytes = await toBytes(buildZip('a.txt', new Uint8Array([10])))
    const view = new DataView(bytes.buffer)
    // Compression method at offset 8
    expect(view.getUint16(8, true)).toBe(0)
  })

  it('sets compressed size == uncompressed size == data.length', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const bytes = await toBytes(buildZip('f.bin', data))
    const view = new DataView(bytes.buffer)
    // CRC at offset 14, compressed size at 18, uncompressed size at 22
    expect(view.getUint32(18, true)).toBe(data.length)
    expect(view.getUint32(22, true)).toBe(data.length)
  })

  it('stores correct CRC32 in local file header', async () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const bytes = await toBytes(buildZip('h.txt', data))
    const view = new DataView(bytes.buffer)
    const expectedCrc = crc32(data)
    expect(view.getUint32(14, true)).toBe(expectedCrc)
  })

  it('embeds filename bytes matching input', async () => {
    const filename = 'myfile.png'
    const nameBytes = new TextEncoder().encode(filename)
    const data = new Uint8Array([0xab])
    const bytes = await toBytes(buildZip(filename, data))
    // Filename starts at offset 30
    const embedded = bytes.slice(30, 30 + nameBytes.length)
    expect(embedded).toEqual(nameBytes)
  })

  it('embeds file data after local header + filename', async () => {
    const filename = 'x.dat'
    const nameLen = new TextEncoder().encode(filename).length
    const data = new Uint8Array([10, 20, 30, 40])
    const bytes = await toBytes(buildZip(filename, data))
    const dataStart = 30 + nameLen
    const embedded = bytes.slice(dataStart, dataStart + data.length)
    expect(embedded).toEqual(data)
  })

  it('has central directory header magic 0x02014b50 at correct offset', async () => {
    const filename = 'cd.txt'
    const nameLen = new TextEncoder().encode(filename).length
    const data = new Uint8Array([1, 2])
    const bytes = await toBytes(buildZip(filename, data))
    const view = new DataView(bytes.buffer)
    const centralOffset = 30 + nameLen + data.length
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50)
  })

  it('has EOCD magic 0x06054b50 at correct offset', async () => {
    const filename = 'eo.txt'
    const nameLen = new TextEncoder().encode(filename).length
    const data = new Uint8Array([99])
    const bytes = await toBytes(buildZip(filename, data))
    const view = new DataView(bytes.buffer)
    const eocdOffset = 30 + nameLen + data.length + 46 + nameLen
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50)
  })

  it('EOCD reports 1 entry', async () => {
    const filename = 'one.txt'
    const nameLen = new TextEncoder().encode(filename).length
    const data = new Uint8Array([1])
    const bytes = await toBytes(buildZip(filename, data))
    const view = new DataView(bytes.buffer)
    const eocdOffset = 30 + nameLen + data.length + 46 + nameLen
    // Entries on disk at eocd+8, total entries at eocd+10
    expect(view.getUint16(eocdOffset + 8, true)).toBe(1)
    expect(view.getUint16(eocdOffset + 10, true)).toBe(1)
  })

  it('CRC32 matches between local and central headers', async () => {
    const filename = 'crc.bin'
    const nameLen = new TextEncoder().encode(filename).length
    const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
    const bytes = await toBytes(buildZip(filename, data))
    const view = new DataView(bytes.buffer)
    const localCrc = view.getUint32(14, true)
    const centralOffset = 30 + nameLen + data.length
    const centralCrc = view.getUint32(centralOffset + 16, true)
    expect(localCrc).toBe(centralCrc)
  })

  it('total buffer size matches formula: 30 + nameLen + fileSize + 46 + nameLen + 22', async () => {
    const filename = 'size.txt'
    const nameLen = new TextEncoder().encode(filename).length
    const data = new Uint8Array([10, 20, 30])
    const blob = buildZip(filename, data)
    const expected = 30 + nameLen + data.length + 46 + nameLen + 22
    expect(blob.size).toBe(expected)
  })

  it('produces valid ZIP with empty data', async () => {
    const filename = 'empty.txt'
    const nameLen = new TextEncoder().encode(filename).length
    const data = new Uint8Array(0)
    const blob = buildZip(filename, data)
    const bytes = await toBytes(blob)
    const view = new DataView(bytes.buffer)

    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(18, true)).toBe(0) // compressed size
    expect(view.getUint32(22, true)).toBe(0) // uncompressed size
    expect(blob.size).toBe(30 + nameLen + 0 + 46 + nameLen + 22)
  })

  it('handles large data (100KB)', async () => {
    const data = new Uint8Array(100_000)
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff
    const blob = buildZip('large.bin', data)
    const bytes = await toBytes(blob)
    const view = new DataView(bytes.buffer)

    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const nameLen = new TextEncoder().encode('large.bin').length
    expect(view.getUint32(18, true)).toBe(100_000)
    expect(view.getUint32(22, true)).toBe(100_000)
    expect(view.getUint32(14, true)).toBe(crc32(data))
    expect(blob.size).toBe(30 + nameLen + 100_000 + 46 + nameLen + 22)
  })

  it('handles Unicode filename (byte length > char count)', async () => {
    const filename = 'ñoño.txt'
    const nameBytes = new TextEncoder().encode(filename)
    expect(nameBytes.length).toBeGreaterThan(filename.length)

    const data = new Uint8Array([42])
    const blob = buildZip(filename, data)
    const bytes = await toBytes(blob)
    const view = new DataView(bytes.buffer)

    // filename length field at offset 26
    expect(view.getUint16(26, true)).toBe(nameBytes.length)
    // total size uses byte length, not char length
    expect(blob.size).toBe(30 + nameBytes.length + data.length + 46 + nameBytes.length + 22)
  })
})
