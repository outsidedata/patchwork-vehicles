// Writes the stylized ground's flat colour maps, one 16×16 PNG of a single colour per layer, beside this
// file: `node games/vehicles/assets/ground/solid.mjs`. Each is a `texture` of vehicles.scene.json's catalogue,
// named by a layer's `map` in assets/stylized.json.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const colours = {
  'stylized-grass': [79, 154, 58],
  'stylized-hollows': [108, 191, 58],
  'stylized-earth': [168, 121, 74],
  'stylized-track': [196, 154, 99],
}
const SIZE = 16

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = buf => {
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}

for (const [name, [r, g, b]] of Object.entries(colours)) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8 // bits a channel
  header[9] = 2 // RGB
  const rows = Buffer.alloc(SIZE * (1 + SIZE * 3))
  for (let y = 0; y < SIZE; y++) {
    const at = y * (1 + SIZE * 3)
    rows[at] = 0 // no filter
    for (let x = 0; x < SIZE; x++) rows.set([r, g, b], at + 1 + x * 3)
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(new URL(`${name}.png`, import.meta.url), png)
  console.log(`${name}.png`, `rgb(${r}, ${g}, ${b})`)
}
