import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function icon(size, padded) {
  return png(size, (x, y) => {
    const margin = padded ? size * 0.18 : size * 0.08;
    const left = margin, right = size - margin, top = margin, bottom = size - margin;
    const inside = x >= left && x <= right && y >= top && y <= bottom;
    if (!inside) return padded ? [15, 118, 110, 255] : [246, 248, 252, 0];
    const bookLeft = left + (right - left) * 0.22;
    const bookRight = right - (right - left) * 0.22;
    const bookTop = top + (bottom - top) * 0.2;
    const bookBottom = bottom - (bottom - top) * 0.18;
    const onBook = x >= bookLeft && x <= bookRight && y >= bookTop && y <= bookBottom;
    if (!onBook) return [15, 118, 110, 255];
    const fold = Math.abs(x - (bookLeft + bookRight) / 2) < size * 0.015;
    return fold ? [15, 118, 110, 255] : [255, 255, 255, 255];
  });
}
writeFileSync('public/icon-192.png', icon(192, false));
writeFileSync('public/icon-512.png', icon(512, false));
writeFileSync('public/icon-maskable-192.png', icon(192, true));
writeFileSync('public/icon-maskable-512.png', icon(512, true));
