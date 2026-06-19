/* Generates real PNG app icons from the dumbbell design (no external deps).
 * Run: node scripts/gen-icons.cjs
 *
 * The previous public/icon-*.png files were JPEGs renamed to .png, which fails
 * Chrome's PWA icon validation and suppresses the install prompt. */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createCanvas(size) {
  // RGBA buffer
  return { size, data: Buffer.alloc(size * size * 4, 0) };
}

function setPx(c, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  // simple source-over alpha blend
  const sa = a / 255;
  const da = c.data[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return;
  c.data[i] = Math.round((r * sa + c.data[i] * da * (1 - sa)) / outA);
  c.data[i + 1] = Math.round((g * sa + c.data[i + 1] * da * (1 - sa)) / outA);
  c.data[i + 2] = Math.round((b * sa + c.data[i + 2] * da * (1 - sa)) / outA);
  c.data[i + 3] = Math.round(outA * 255);
}

function hex(h, alpha = 255) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

// Rounded rect in 0..100 design space, scaled by `s`, offset by ox/oy.
function roundRect(c, s, ox, oy, x, y, w, h, r, color) {
  const X = x * s + ox, Y = y * s + oy, W = w * s, H = h * s, R = r * s;
  for (let py = Math.floor(Y); py < Y + H; py++) {
    for (let px = Math.floor(X); px < X + W; px++) {
      // distance into corners
      const cx = Math.min(Math.max(px + 0.5, X + R), X + W - R);
      const cy = Math.min(Math.max(py + 0.5, Y + R), Y + H - R);
      const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // anti-aliased edge
      const cov = Math.max(0, Math.min(1, R - dist + 0.5));
      if (cov <= 0) continue;
      const col = color.slice();
      col[3] = Math.round(col[3] * cov);
      setPx(c, px, py, col);
    }
  }
}

function drawDumbbell(c, scale, ox, oy) {
  const s = scale;
  // shaft
  roundRect(c, s, ox, oy, 25, 44, 50, 12, 4, hex('#a1a1aa'));
  // left plates
  roundRect(c, s, ox, oy, 15, 25, 8, 50, 4, hex('#5dcaa5'));
  roundRect(c, s, ox, oy, 7, 30, 6, 40, 3, hex('#38b2ac'));
  // right plates
  roundRect(c, s, ox, oy, 77, 25, 8, 50, 4, hex('#5dcaa5'));
  roundRect(c, s, ox, oy, 87, 30, 6, 40, 3, hex('#38b2ac'));
  // highlight line (approx as thin rounded rect)
  roundRect(c, s, ox, oy, 30, 49, 40, 2, 1, hex('#ffffff', 150));
}

function render(size, { maskable = false } = {}) {
  const c = createCanvas(size);
  // background (full bleed)
  if (maskable) {
    // fill whole canvas with bg so the safe-zone crop still shows brand bg
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) setPx(c, x, y, hex('#0e0e10'));
  } else {
    roundRect(c, size / 100, 0, 0, 0, 0, 100, 100, 20, hex('#0e0e10'));
  }
  // dumbbell: for maskable, shrink to ~72% centered (safe zone)
  if (maskable) {
    const inner = size * 0.72;
    const scale = inner / 100;
    const off = (size - inner) / 2;
    drawDumbbell(c, scale, off, off);
  } else {
    drawDumbbell(c, size / 100, 0, 0);
  }
  return c;
}

function encodePNG(c) {
  const { size, data } = c;
  const bytesPerRow = size * 4;
  const raw = Buffer.alloc((bytesPerRow + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (bytesPerRow + 1)] = 0; // filter: none
    data.copy(raw, y * (bytesPerRow + 1) + 1, y * bytesPerRow, (y + 1) * bytesPerRow);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, body) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, body, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const outDir = path.join(__dirname, '..', 'public');
const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of targets) {
  const png = encodePNG(render(size, opts));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('wrote', name, size + 'x' + size, png.length + ' bytes');
}
