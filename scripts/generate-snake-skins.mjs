import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve("src/assets/snake-skins");

const skins = [
  { id: "cyber", bg: ["#061426", "#161032"], body: "#53f3ff", alt: "#ff4fd8", glow: "#b8fff7", eye: "#020611", pattern: "circuits" },
  { id: "lava", bg: ["#1a0706", "#3b1208"], body: "#ff6b35", alt: "#ffd166", glow: "#ff2e63", eye: "#fff3c4", pattern: "cracks" },
  { id: "frost", bg: ["#071b2c", "#dffcff"], body: "#b7f7ff", alt: "#6bbcff", glow: "#ffffff", eye: "#0c2742", pattern: "snow" },
  { id: "jungle", bg: ["#06170f", "#124b2c"], body: "#7dff6f", alt: "#2dd36f", glow: "#d4ff75", eye: "#07120c", pattern: "leaves" },
  { id: "royal", bg: ["#160827", "#3d1c72"], body: "#9b5cff", alt: "#ffd166", glow: "#f6e7ff", eye: "#fff7c4", pattern: "gems" },
  { id: "candy", bg: ["#2a1024", "#ffe0f3"], body: "#ff7ad9", alt: "#53f3ff", glow: "#fff1a8", eye: "#40132f", pattern: "stripes" },
  { id: "galaxy", bg: ["#020611", "#20144a"], body: "#6d5dfc", alt: "#ff4fd8", glow: "#f8fbff", eye: "#ffffff", pattern: "stars" },
  { id: "jade", bg: ["#021812", "#0e5b4b"], body: "#22d3a6", alt: "#b6f7d1", glow: "#eafff5", eye: "#06221b", pattern: "scales" },
  { id: "tiger", bg: ["#190f02", "#4d3204"], body: "#ffd166", alt: "#111827", glow: "#53f3ff", eye: "#ffffff", pattern: "tiger" },
  { id: "ghost", bg: ["#07111f", "#31425f"], body: "#edf6ff", alt: "#9bd8ff", glow: "#dffcff", eye: "#53f3ff", pattern: "mist" },
];

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) {
    c = (c ^ buf[i]) >>> 0;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : (c >>> 1) >>> 0;
    }
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const len = Buffer.alloc(4);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([len, name, data, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND"),
  ]);
}

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function makeCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4);

  function blend(x, y, color, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h || alpha <= 0) return;

    const i = (y * w + x) * 4;
    const srcA = Math.max(0, Math.min(1, alpha * ((color[3] ?? 255) / 255)));
    const dstA = buf[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    buf[i] = Math.round((color[0] * srcA + buf[i] * dstA * (1 - srcA)) / outA);
    buf[i + 1] = Math.round((color[1] * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA);
    buf[i + 2] = Math.round((color[2] * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA);
    buf[i + 3] = Math.round(outA * 255);
  }

  function fillGradient(c1, c2) {
    const a = hexToRgb(c1);
    const b = hexToRgb(c2);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const radial = Math.hypot(x - w * 0.72, y - h * 0.22) / (w * 0.88);
        const t = Math.max(0, Math.min(1, (x / w) * 0.28 + (y / h) * 0.52 + radial * 0.28));
        const c = mix(a, b, t);
        const i = (y * w + x) * 4;
        buf[i] = c[0];
        buf[i + 1] = c[1];
        buf[i + 2] = c[2];
        buf[i + 3] = 255;
      }
    }
  }

  function circle(cx, cy, r, color, alpha = 1) {
    const c = Array.isArray(color) ? color : hexToRgb(color);
    for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y += 1) {
      for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x += 1) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + 1) blend(x, y, c, alpha * Math.max(0, Math.min(1, r + 1 - d)));
      }
    }
  }

  function rect(x, y, rw, rh, color, alpha = 1) {
    const c = Array.isArray(color) ? color : hexToRgb(color);
    for (let yy = y; yy < y + rh; yy += 1) {
      for (let xx = x; xx < x + rw; xx += 1) blend(xx, yy, c, alpha);
    }
  }

  function line(x1, y1, x2, y2, r, color, alpha = 1) {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5);
    for (let i = 0; i <= steps; i += 1) {
      const t = steps ? i / steps : 0;
      circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, color, alpha);
    }
  }

  return { buf, fillGradient, circle, rect, line };
}

function drawPattern(c, skin, p, index, alt) {
  if (skin.pattern === "circuits" && index % 3 === 0) {
    c.line(p.x - 10, p.y, p.x + 10, p.y, 1.2, alt, 0.85);
    c.circle(p.x + 8, p.y, 2.5, skin.glow, 0.9);
  }
  if (skin.pattern === "cracks" && index % 2 === 0) c.line(p.x - 7, p.y - 5, p.x + 5, p.y + 7, 1.4, alt, 0.86);
  if (skin.pattern === "snow" && index % 2 === 1) {
    c.circle(p.x, p.y, 3, "#ffffff", 0.72);
    c.line(p.x - 5, p.y, p.x + 5, p.y, 0.8, "#ffffff", 0.7);
  }
  if (skin.pattern === "leaves" && index % 2 === 0) {
    c.circle(p.x - 5, p.y, 4, alt, 0.65);
    c.circle(p.x + 5, p.y - 2, 4, "#d4ff75", 0.45);
  }
  if (skin.pattern === "gems") c.rect(Math.round(p.x - 2), Math.round(p.y - 9), 4, 18, alt, index % 2 ? 0.9 : 0.4);
  if (skin.pattern === "stars" && index % 2 === 0) {
    c.circle(p.x, p.y, 2, "#ffffff", 1);
    c.line(p.x - 5, p.y, p.x + 5, p.y, 0.6, "#ffffff", 0.85);
    c.line(p.x, p.y - 5, p.x, p.y + 5, 0.6, "#ffffff", 0.85);
  }
  if (skin.pattern === "scales") {
    c.circle(p.x - 6, p.y + 2, 3.5, alt, 0.46);
    c.circle(p.x + 4, p.y - 3, 3.5, alt, 0.38);
  }
  if (skin.pattern === "tiger") c.line(p.x - 11, p.y - 8, p.x + 8, p.y + 9, 2.3, alt, 0.84);
  if (skin.pattern === "mist") {
    c.circle(p.x + 8, p.y - 8, 7, alt, 0.18);
    c.circle(p.x - 8, p.y + 8, 6, "#ffffff", 0.16);
  }
}

async function generate() {
  await mkdir(outDir, { recursive: true });

  for (const skin of skins) {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    c.fillGradient(skin.bg[0], skin.bg[1]);

    const glow = hexToRgb(skin.glow);
    for (let i = 0; i < 42; i += 1) {
      const x = (i * 47 + skin.id.length * 13) % w;
      const y = (i * 83 + skin.id.length * 19) % h;
      c.circle(x, y, (i % 3) + 1.5, glow, skin.pattern === "stars" || skin.pattern === "snow" ? 0.62 : 0.18);
    }

    const body = hexToRgb(skin.body);
    const alt = hexToRgb(skin.alt);
    const points = Array.from({ length: 16 }, (_, index) => {
      const t = index / 15;
      return { x: 36 + t * 184, y: 58 + Math.sin(t * Math.PI * 2.2) * 36 + t * 112 };
    });

    for (let glowSize = 5; glowSize > 0; glowSize -= 1) {
      points.forEach((point) => c.circle(point.x, point.y, 18 + glowSize * 5, glow, 0.025));
    }

    for (let i = points.length - 1; i >= 0; i -= 1) {
      const point = points[i];
      const t = i / (points.length - 1);
      const stripe = skin.pattern === "stripes" ? (i % 2 ? 0.78 : 0.12) : Math.sin(t * Math.PI) * 0.32;
      const color = mix(body, alt, stripe);
      c.circle(point.x, point.y, i === 0 ? 17 : 18, color, 1);
      c.circle(point.x - 5, point.y - 6, 5, mix(color, [255, 255, 255], 0.36), 0.55);
      drawPattern(c, skin, point, i, alt);
    }

    const head = points[points.length - 1];
    c.circle(head.x, head.y, 23, body, 1);
    c.circle(head.x + 7, head.y - 6, 4.5, skin.eye, 1);
    c.circle(head.x + 6, head.y + 8, 4.5, skin.eye, 1);
    c.circle(head.x + 8, head.y - 7, 1.5, "#ffffff", 0.85);
    c.circle(head.x + 7, head.y + 7, 1.5, "#ffffff", 0.85);
    c.line(head.x + 20, head.y + 1, head.x + 31, head.y - 5, 1.5, skin.alt, 0.95);
    c.line(head.x + 20, head.y + 1, head.x + 31, head.y + 7, 1.5, skin.alt, 0.95);

    await writeFile(path.join(outDir, `${skin.id}.png`), png(w, h, c.buf));
  }

  console.log(`Generated ${skins.length} snake skins in ${outDir}`);
}

generate();
