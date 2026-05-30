/**
 * Dependency-free PNG icon generator (Workstream I) — rasterizes the Asta app
 * icon (public/icon.svg: rounded green square + "A" glyph) to real 192/512 PNGs
 * for PWA installability. Uses only Node built-ins (zlib). Run: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0x1b, 0x6b, 0x4f]; // #1b6b4f
const FG = [0xea, 0xff, 0xf4]; // #eafff4
const VB = 512;
const RADIUS = 112;

// Glyph polygons in the 512 viewBox (even-odd fill → inner triangle is a hole).
const OUTER = [[256,116],[372,396],[312,396],[289,338],[223,338],[200,396],[140,396]];
const INNER = [[256,214],[237,282],[275,282]];

/** Even-odd ray cast across both subpaths → true inside the filled glyph. */
function inGlyph(px, py) {
  let crossings = 0;
  for (const poly of [OUTER, INNER]) {
    for (let i = 0, n = poly.length; i < n; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % n];
      if ((y1 > py) !== (y2 > py)) {
        const xAt = x1 + ((py - y1) / (y2 - y1)) * (x2 - x1);
        if (px < xAt) crossings++;
      }
    }
  }
  return crossings % 2 === 1;
}

/** Inside the rounded square? (transparent outside the corner radius.) */
function inRounded(px, py, r) {
  if (px < 0 || py < 0 || px > VB || py > VB) return false;
  const cx = px < r ? r : px > VB - r ? VB - r : px;
  const cy = py < r ? r : py > VB - r ? VB - r : py;
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function render(size) {
  const scale = VB / size;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter byte: none
    for (let x = 0; x < size; x++) {
      // sample at pixel centre, in viewBox space
      const vx = (x + 0.5) * scale;
      const vy = (y + 0.5) * scale;
      if (!inRounded(vx, vy, RADIUS)) {
        raw[o++] = 0; raw[o++] = 0; raw[o++] = 0; raw[o++] = 0; // transparent
      } else if (inGlyph(vx, vy)) {
        raw[o++] = FG[0]; raw[o++] = FG[1]; raw[o++] = FG[2]; raw[o++] = 255;
      } else {
        raw[o++] = BG[0]; raw[o++] = BG[1]; raw[o++] = BG[2]; raw[o++] = 255;
      }
    }
  }
  return encodePng(size, size, deflateSync(raw, { level: 9 }));
}

// --- minimal PNG container (RGBA, 8-bit) ---
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, idat) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [192, 512]) {
  const png = render(size);
  const path = new URL(`../public/icon-${size}.png`, import.meta.url);
  writeFileSync(path, png);
  console.log(`wrote public/icon-${size}.png (${png.length} bytes)`);
}
