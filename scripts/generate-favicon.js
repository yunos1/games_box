import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outPath = resolve("public/favicon.ico");
const sizes = [16, 32, 48];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function writePixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fillCircle(pixels, size, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) writePixel(pixels, size, x, y, color);
    }
  }
}

function fillRoundedRect(pixels, size, x, y, width, height, radius, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const dx = Math.max(x - px, 0, px - (x + width - 1));
      const dy = Math.max(y - py, 0, py - (y + height - 1));
      const cornerX = px < x + radius ? x + radius : px >= x + width - radius ? x + width - radius - 1 : px;
      const cornerY = py < y + radius ? y + radius : py >= y + height - radius ? y + height - radius - 1 : py;
      const cornerDistance = Math.hypot(px - cornerX, py - cornerY);
      if ((!dx && !dy && cornerDistance <= radius) || (px >= x + radius && px < x + width - radius) || (py >= y + radius && py < y + height - radius)) {
        writePixel(pixels, size, px, py, color);
      }
    }
  }
}

function drawLine(pixels, size, x1, y1, x2, y2, thickness, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    fillCircle(pixels, size, x, y, thickness / 2, color);
  }
}

function createPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 64;
  const c = (value) => Math.round(value * scale);

  fillRoundedRect(pixels, size, 0, 0, size, size, c(14), [5, 7, 19, 255]);
  fillRoundedRect(pixels, size, c(10), c(20), c(44), c(30), c(12), [9, 18, 38, 255]);
  fillRoundedRect(pixels, size, c(12), c(22), c(40), c(26), c(10), [18, 33, 61, 255]);
  drawLine(pixels, size, c(14), c(22), c(50), c(48), c(3), [83, 243, 255, 170]);
  drawLine(pixels, size, c(50), c(22), c(14), c(48), c(3), [255, 79, 216, 130]);
  drawLine(pixels, size, c(22), c(29), c(22), c(40), c(4), [125, 255, 111, 255]);
  drawLine(pixels, size, c(16.5), c(34.5), c(27.5), c(34.5), c(4), [125, 255, 111, 255]);
  fillCircle(pixels, size, c(42), c(31), c(4), [255, 209, 102, 255]);
  fillCircle(pixels, size, c(49), c(38), c(4), [255, 79, 216, 255]);
  drawLine(pixels, size, c(31), c(24), c(35), c(24), c(3), [83, 243, 255, 255]);

  const scanlines = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    pixels.copy(row, 1, y * size * 4, (y + 1) * size * 4);
    scanlines.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(scanlines))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function createIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size === 256 ? 0 : image.size;
    entry[1] = image.size === 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, createIco(sizes.map((size) => ({ size, data: createPng(size) }))));
console.log(`Generated ${outPath}`);
