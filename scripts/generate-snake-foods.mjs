import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve("src/assets/snake-foods");
const size = 128;

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
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function makeCanvas(width, height) {
  const buf = Buffer.alloc(width * height * 4);

  function blend(x, y, color, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;

    const source = Array.isArray(color) ? color : hexToRgb(color);
    const i = (y * width + x) * 4;
    const srcA = Math.max(0, Math.min(1, alpha * ((source[3] ?? 255) / 255)));
    const dstA = buf[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    buf[i] = Math.round((source[0] * srcA + buf[i] * dstA * (1 - srcA)) / outA);
    buf[i + 1] = Math.round((source[1] * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA);
    buf[i + 2] = Math.round((source[2] * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA);
    buf[i + 3] = Math.round(outA * 255);
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

  function ellipse(cx, cy, rx, ry, color, alpha = 1, rotation = 0) {
    const c = Array.isArray(color) ? color : hexToRgb(color);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const radius = Math.max(rx, ry) + 2;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const px = dx * cos + dy * sin;
        const py = -dx * sin + dy * cos;
        const d = Math.hypot(px / rx, py / ry);
        if (d <= 1.035) blend(x, y, c, alpha * Math.max(0, Math.min(1, (1.035 - d) * 24)));
      }
    }
  }

  function line(x1, y1, x2, y2, r, color, alpha = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.6));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, color, alpha);
    }
  }

  function polygon(points, color, alpha = 1) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.floor(Math.min(...xs) - 1);
    const maxX = Math.ceil(Math.max(...xs) + 1);
    const minY = Math.floor(Math.min(...ys) - 1);
    const maxY = Math.ceil(Math.max(...ys) + 1);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          const xi = points[i][0];
          const yi = points[i][1];
          const xj = points[j][0];
          const yj = points[j][1];
          const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
          if (intersect) inside = !inside;
        }
        if (inside) blend(x, y, color, alpha);
      }
    }
  }

  function star(cx, cy, outer, inner, points, color, alpha = 1, rotation = -Math.PI / 2) {
    const polygonPoints = [];
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 ? inner : outer;
      const angle = rotation + (Math.PI * i) / points;
      polygonPoints.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    polygon(polygonPoints, color, alpha);
  }

  function sparkle(cx, cy, r, color, alpha = 0.75) {
    line(cx - r, cy, cx + r, cy, 1.1, color, alpha);
    line(cx, cy - r, cx, cy + r, 1.1, color, alpha);
    circle(cx, cy, 2, color, alpha);
  }

  return { buf, blend, circle, ellipse, line, polygon, star, sparkle };
}

function paintGlow(c, color) {
  for (let r = 54; r >= 18; r -= 6) {
    c.circle(64, 66, r, color, 0.022);
  }
}

function leaf(c, x, y, rotation = 0, color = "#36d66f") {
  c.ellipse(x, y, 10, 5, color, 0.95, rotation);
  c.line(x - Math.cos(rotation) * 5, y - Math.sin(rotation) * 5, x + Math.cos(rotation) * 8, y + Math.sin(rotation) * 8, 0.7, "#eaffd9", 0.45);
}

function seedDots(c, points, color = "#1f2937") {
  points.forEach(([x, y, r = 2]) => c.circle(x, y, r, color, 0.9));
}

const foods = [
  {
    id: "apple",
    glow: "#ff4f6d",
    draw(c) {
      c.circle(54, 67, 26, "#e9354f");
      c.circle(75, 67, 26, "#f7475e");
      c.ellipse(64, 77, 31, 27, "#d92842");
      c.line(64, 39, 70, 28, 3, "#6b3f16");
      leaf(c, 79, 32, -0.35, "#49d36f");
      c.ellipse(50, 54, 9, 5, "#fff1f2", 0.34, -0.6);
    },
  },
  {
    id: "pear",
    glow: "#b7f35a",
    draw(c) {
      c.circle(64, 73, 29, "#a8df47");
      c.ellipse(64, 51, 21, 27, "#c7ee62");
      c.line(64, 25, 69, 36, 3, "#7a4b1e");
      leaf(c, 78, 31, -0.25, "#43c96b");
      c.ellipse(55, 48, 7, 13, "#f8ffd7", 0.27, 0.4);
    },
  },
  {
    id: "strawberry",
    glow: "#ff4f7a",
    draw(c) {
      c.circle(51, 60, 23, "#ec274f");
      c.circle(76, 60, 23, "#ff3f68");
      c.polygon(
        [
          [34, 65],
          [94, 65],
          [64, 106],
        ],
        "#e51f48",
      );
      [46, 56, 66, 78, 87].forEach((x, index) => c.line(x, 35 + index * 2, 64, 50, 4, "#37c96b"));
      seedDots(c, [
        [51, 66, 1.6],
        [66, 63, 1.6],
        [78, 72, 1.6],
        [57, 82, 1.6],
        [70, 91, 1.6],
      ], "#ffe58a");
    },
  },
  {
    id: "cherry",
    glow: "#ff315c",
    draw(c) {
      c.line(55, 63, 65, 25, 2.3, "#49c35e");
      c.line(82, 66, 66, 25, 2.3, "#49c35e");
      c.circle(52, 76, 21, "#df1f42");
      c.circle(82, 78, 21, "#f93954");
      c.ellipse(45, 67, 6, 4, "#fff0f4", 0.45, -0.7);
      c.ellipse(76, 69, 6, 4, "#fff0f4", 0.45, -0.7);
      leaf(c, 76, 29, -0.2, "#68df62");
    },
  },
  {
    id: "lemon",
    glow: "#ffe869",
    draw(c) {
      c.ellipse(64, 66, 40, 26, "#f8dc35", 1, -0.28);
      c.ellipse(64, 66, 31, 19, "#fff06c", 0.75, -0.28);
      c.circle(26, 77, 7, "#f1ca21");
      c.circle(102, 55, 7, "#f1ca21");
      leaf(c, 87, 33, -0.2, "#50c96b");
    },
  },
  {
    id: "orange",
    glow: "#ff9d35",
    draw(c) {
      c.circle(64, 66, 34, "#f78220");
      c.circle(64, 66, 27, "#ffa332", 0.82);
      c.line(64, 35, 64, 97, 1.4, "#ffd184", 0.46);
      c.line(38, 51, 91, 82, 1.1, "#ffd184", 0.36);
      c.line(37, 82, 91, 50, 1.1, "#ffd184", 0.36);
      leaf(c, 75, 29, -0.45, "#47c66c");
      c.line(64, 34, 70, 25, 3, "#79521b");
    },
  },
  {
    id: "kiwi",
    glow: "#90f463",
    draw(c) {
      c.circle(64, 66, 36, "#8a5a27");
      c.circle(64, 66, 30, "#77dd4e");
      c.circle(64, 66, 14, "#e9ffd6");
      for (let i = 0; i < 16; i += 1) {
        const angle = (Math.PI * 2 * i) / 16;
        c.circle(64 + Math.cos(angle) * 21, 66 + Math.sin(angle) * 21, 1.4, "#1d2b16", 0.9);
      }
      c.ellipse(51, 50, 7, 4, "#d7ff8f", 0.45, -0.5);
    },
  },
  {
    id: "watermelon",
    glow: "#38e978",
    draw(c) {
      c.circle(64, 67, 41, "#1ec66a");
      c.circle(64, 67, 35, "#d8fb7c");
      c.circle(64, 67, 29, "#f04b66");
      c.polygon(
        [
          [22, 65],
          [106, 65],
          [106, 22],
          [22, 22],
        ],
        [0, 0, 0, 0],
        0,
      );
      seedDots(c, [
        [54, 73, 2],
        [66, 87, 2],
        [77, 70, 2],
      ], "#2b1621");
      c.line(32, 67, 96, 67, 2, "#fdfcc7", 0.5);
    },
  },
  {
    id: "grape",
    glow: "#ba6cff",
    draw(c) {
      const grapes = [
        [52, 52],
        [68, 50],
        [82, 61],
        [45, 68],
        [62, 69],
        [78, 78],
        [56, 88],
      ];
      grapes.forEach(([x, y], index) => {
        c.circle(x, y, 14, index % 2 ? "#8a46d9" : "#a65df4");
        c.ellipse(x - 4, y - 5, 4, 2.5, "#f1dcff", 0.38, -0.7);
      });
      c.line(66, 40, 75, 25, 2.5, "#7d4a18");
      leaf(c, 82, 30, -0.35, "#45cf65");
    },
  },
  {
    id: "blueberry",
    glow: "#5da2ff",
    draw(c) {
      c.circle(64, 66, 35, "#3976e8");
      c.circle(64, 66, 27, "#4a8fff", 0.74);
      c.star(64, 48, 12, 5, 6, "#244d9d", 0.9, -Math.PI / 2);
      c.ellipse(52, 55, 7, 4, "#e9f2ff", 0.35, -0.7);
    },
  },
  {
    id: "pineapple",
    glow: "#ffd445",
    draw(c) {
      c.ellipse(64, 75, 27, 34, "#f4be2a");
      c.ellipse(64, 75, 19, 27, "#ffdb4a", 0.75);
      for (let i = -2; i <= 2; i += 1) c.line(42, 67 + i * 10, 86, 89 + i * 10, 1.1, "#b8781e", 0.48);
      for (let i = -2; i <= 2; i += 1) c.line(86, 67 + i * 10, 42, 89 + i * 10, 1.1, "#b8781e", 0.48);
      c.polygon([[46, 45], [55, 17], [65, 47]], "#46c96d");
      c.polygon([[60, 45], [70, 12], [77, 48]], "#2db75f");
      c.polygon([[75, 48], [91, 24], [86, 56]], "#52d877");
    },
  },
  {
    id: "banana",
    glow: "#ffe76b",
    draw(c) {
      c.line(32, 79, 48, 95, 11, "#f6c332");
      c.line(48, 95, 77, 92, 12, "#ffd84d");
      c.line(77, 92, 99, 66, 10, "#ffe66c");
      c.line(38, 70, 55, 82, 6, "#fff29a", 0.58);
      c.circle(30, 77, 5, "#6f4b20");
      c.circle(101, 64, 5, "#6f4b20");
    },
  },
  {
    id: "peach",
    glow: "#ff9e75",
    draw(c) {
      c.circle(55, 67, 27, "#ff986f");
      c.circle(76, 68, 27, "#ffb06f");
      c.line(65, 43, 63, 94, 1.5, "#db7058", 0.55);
      c.ellipse(49, 58, 8, 5, "#ffe1cb", 0.36, -0.6);
      c.line(65, 39, 71, 28, 3, "#7a4a1d");
      leaf(c, 81, 32, -0.3, "#4bd16d");
    },
  },
  {
    id: "dragonfruit",
    glow: "#ff69ca",
    draw(c) {
      c.polygon([[41, 51], [30, 34], [50, 42]], "#69d96b");
      c.polygon([[87, 51], [103, 37], [91, 61]], "#69d96b");
      c.polygon([[47, 88], [32, 103], [57, 96]], "#69d96b");
      c.ellipse(64, 68, 34, 38, "#f241aa");
      c.ellipse(64, 68, 24, 28, "#fff8f8");
      seedDots(c, [
        [55, 61, 1.2],
        [68, 57, 1.2],
        [76, 70, 1.2],
        [59, 79, 1.2],
        [70, 87, 1.2],
      ], "#171717");
    },
  },
  {
    id: "starfruit",
    glow: "#fff06b",
    draw(c) {
      c.star(64, 68, 39, 18, 5, "#f6dc3d", 1, -Math.PI / 2);
      c.star(64, 68, 27, 12, 5, "#fff27a", 0.65, -Math.PI / 2);
      c.line(64, 39, 64, 96, 1.2, "#c19622", 0.32);
      c.line(41, 58, 88, 79, 1.1, "#c19622", 0.28);
    },
  },
  {
    id: "plum",
    glow: "#a66bff",
    draw(c) {
      c.ellipse(64, 69, 33, 36, "#7d3bd1");
      c.ellipse(74, 74, 23, 28, "#9a5df3", 0.55);
      c.line(64, 37, 70, 25, 3, "#6b4016");
      leaf(c, 81, 30, -0.35, "#52d36d");
      c.ellipse(50, 55, 7, 11, "#e9d9ff", 0.28, 0.6);
    },
  },
  {
    id: "coconut",
    glow: "#f1d1a2",
    draw(c) {
      c.circle(64, 68, 37, "#8b5428");
      c.circle(64, 68, 28, "#f2ead9");
      c.circle(64, 68, 20, "#fff8ec");
      c.circle(54, 52, 3.2, "#5a311a");
      c.circle(66, 49, 3.2, "#5a311a");
      c.circle(75, 56, 3.2, "#5a311a");
      c.ellipse(51, 59, 7, 4, "#ffffff", 0.34, -0.5);
    },
  },
  {
    id: "mango",
    glow: "#ffb340",
    draw(c) {
      c.ellipse(65, 69, 28, 39, "#ffa832", 1, -0.35);
      c.ellipse(55, 72, 18, 31, "#f26248", 0.42, -0.35);
      c.ellipse(72, 57, 12, 18, "#ffe27c", 0.4, -0.35);
      c.line(64, 33, 70, 24, 3, "#7a4b1b");
      leaf(c, 82, 30, -0.35, "#4bc96b");
    },
  },
  {
    id: "chili",
    glow: "#ff4050",
    draw(c) {
      c.line(45, 50, 59, 72, 15, "#ef233c");
      c.line(59, 72, 90, 83, 14, "#ff475c");
      c.line(90, 83, 101, 61, 8, "#df1d34");
      c.ellipse(50, 45, 8, 6, "#fff0f0", 0.32, -0.4);
      c.line(42, 41, 31, 30, 4, "#47c96a");
      leaf(c, 39, 35, 0.45, "#4dd36d");
    },
  },
  {
    id: "energy-core",
    glow: "#53f3ff",
    draw(c) {
      c.star(64, 65, 39, 29, 6, "#1bb7ff", 0.95, Math.PI / 6);
      c.circle(64, 65, 26, "#53f3ff", 0.9);
      c.circle(64, 65, 15, "#dffcff", 0.95);
      c.line(42, 64, 86, 64, 1.3, "#ffffff", 0.65);
      c.line(64, 42, 64, 86, 1.3, "#ffffff", 0.65);
      c.sparkle(83, 42, 8, "#ffffff", 0.8);
    },
  },
];

async function generate() {
  await mkdir(outDir, { recursive: true });

  for (const food of foods) {
    const c = makeCanvas(size, size);
    paintGlow(c, food.glow);
    food.draw(c);
    c.sparkle(98, 31, 5, "#ffffff", 0.32);
    await writeFile(path.join(outDir, `${food.id}.png`), png(size, size, c.buf));
  }

  console.log(`Generated ${foods.length} snake foods in ${outDir}`);
}

generate();
