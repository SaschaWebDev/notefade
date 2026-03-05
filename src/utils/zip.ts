const ZIP_LOCAL_FILE_HEADER = 0x04034b50
const ZIP_CENTRAL_DIR_HEADER = 0x02014b50
const ZIP_EOCD_SIGNATURE = 0x06054b50
const ZIP_VERSION_NEEDED = 20
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

/** Build a minimal single-file ZIP (store, no compression) */
export function buildZip(filename: string, data: Uint8Array): Blob {
  const nameBytes = new TextEncoder().encode(filename)
  const nameLen = nameBytes.length
  const fileSize = data.length
  const now = new Date()
  const dosTime =
    ((now.getHours() << 11) |
      (now.getMinutes() << 5) |
      (now.getSeconds() >> 1)) &
    0xffff
  const dosDate =
    ((((now.getFullYear() - 1980) & 0x7f) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate()) &
    0xffff

  const crc = crc32(data)

  const localHeaderSize = 30 + nameLen
  const centralHeaderSize = 46 + nameLen
  const eocdSize = 22
  const totalSize = localHeaderSize + fileSize + centralHeaderSize + eocdSize
  const buf = new ArrayBuffer(totalSize)
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  let offset = 0

  // Local file header
  view.setUint32(offset, ZIP_LOCAL_FILE_HEADER, true); offset += 4
  view.setUint16(offset, ZIP_VERSION_NEEDED, true); offset += 2
  view.setUint16(offset, 0, true); offset += 2 // flags
  view.setUint16(offset, 0, true); offset += 2 // compression: store
  view.setUint16(offset, dosTime, true); offset += 2
  view.setUint16(offset, dosDate, true); offset += 2
  view.setUint32(offset, crc, true); offset += 4
  view.setUint32(offset, fileSize, true); offset += 4 // compressed
  view.setUint32(offset, fileSize, true); offset += 4 // uncompressed
  view.setUint16(offset, nameLen, true); offset += 2
  view.setUint16(offset, 0, true); offset += 2 // extra field len
  bytes.set(nameBytes, offset); offset += nameLen
  bytes.set(data, offset); offset += fileSize

  // Central directory
  const centralOffset = offset
  view.setUint32(offset, ZIP_CENTRAL_DIR_HEADER, true); offset += 4
  view.setUint16(offset, ZIP_VERSION_NEEDED, true); offset += 2 // version made by
  view.setUint16(offset, ZIP_VERSION_NEEDED, true); offset += 2 // version needed
  view.setUint16(offset, 0, true); offset += 2 // flags
  view.setUint16(offset, 0, true); offset += 2 // compression
  view.setUint16(offset, dosTime, true); offset += 2
  view.setUint16(offset, dosDate, true); offset += 2
  view.setUint32(offset, crc, true); offset += 4
  view.setUint32(offset, fileSize, true); offset += 4
  view.setUint32(offset, fileSize, true); offset += 4
  view.setUint16(offset, nameLen, true); offset += 2
  view.setUint16(offset, 0, true); offset += 2 // extra
  view.setUint16(offset, 0, true); offset += 2 // comment
  view.setUint16(offset, 0, true); offset += 2 // disk start
  view.setUint16(offset, 0, true); offset += 2 // internal attrs
  view.setUint32(offset, 0, true); offset += 4 // external attrs
  view.setUint32(offset, 0, true); offset += 4 // local header offset
  bytes.set(nameBytes, offset); offset += nameLen

  // End of central directory
  view.setUint32(offset, ZIP_EOCD_SIGNATURE, true); offset += 4
  view.setUint16(offset, 0, true); offset += 2 // disk number
  view.setUint16(offset, 0, true); offset += 2 // central dir disk
  view.setUint16(offset, 1, true); offset += 2 // entries on disk
  view.setUint16(offset, 1, true); offset += 2 // total entries
  view.setUint32(offset, centralHeaderSize, true); offset += 4
  view.setUint32(offset, centralOffset, true); offset += 4
  view.setUint16(offset, 0, true) // comment length

  return new Blob([buf], { type: 'application/zip' })
}
