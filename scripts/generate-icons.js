/**
 * Generates PWA icons as PNG files without any npm dependencies.
 * Uses Node.js built-in zlib to create valid PNG binaries.
 *
 * Output: public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
 *
 * Run once with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// Dark navy background matching navbar (#111827), white "T" letterform
const BG = { r: 0x11, g: 0x18, b: 0x27 };
const FG = { r: 0xff, g: 0xff, b: 0xff };

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32be(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = uint32be(data.length);
  const payload = Buffer.concat([t, data]);
  const crc = uint32be(crc32(payload));
  return Buffer.concat([len, payload, crc]);
}

function makePng(size) {
  // Draw each pixel
  const pixels = [];
  const cx = size / 2;
  const cy = size / 2;
  const pad = size * 0.15;       // padding from edge
  const strokeW = size * 0.09;  // stroke width of the T

  // T geometry (all in px):
  // horizontal bar: full width minus pad, height = strokeW, top at pad
  // vertical stem: centered, from top of crossbar to bottom minus pad

  const barTop = pad;
  const barBottom = barTop + strokeW;
  const stemLeft = cx - strokeW / 2;
  const stemRight = cx + strokeW / 2;
  const stemBottom = size - pad;

  for (let y = 0; y < size; y++) {
    pixels.push(0); // filter byte for this row
    for (let x = 0; x < size; x++) {
      const inBar = y >= barTop && y < barBottom && x >= pad && x < size - pad;
      const inStem = y >= barTop && y < stemBottom && x >= stemLeft && x < stemRight;
      const px = inBar || inStem ? FG : BG;
      pixels.push(px.r, px.g, px.b);
    }
  }

  const raw = Buffer.from(pixels);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk('IHDR', Buffer.concat([
    uint32be(size),  // width
    uint32be(size),  // height
    Buffer.from([8, 2, 0, 0, 0]), // 8-bit depth, RGB, no interlace
  ]));
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

for (const { name, size } of [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]) {
  const buf = makePng(size);
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log(`Generated ${name} (${size}x${size}, ${buf.length} bytes)`);
}
