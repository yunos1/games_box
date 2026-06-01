<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ChevronDown, Settings, Maximize, Minimize } from "lucide-vue-next";
import GameLayout from "../components/GameLayout.vue";
import { SNAKE_FOODS } from "../data/snakeFoods";
import { SNAKE_SKINS, getSnakeSkinById } from "../data/snakeSkins";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const canvas = ref(null);
const gameContainer = ref(null);
const score = ref(0);
const best = ref(getBestScore("snake"));
const status = ref("收集能量核心");
const paused = ref(false);
const progressVersion = ref(0);
const runResult = ref(null);
const selectedSkinId = ref(getSavedValue("snake:skin", "cyber"));
const selectedSkin = computed(() => getSnakeSkinById(selectedSkinId.value));
const dailyVariant = getDailyVariantForGame("snake");
const variantEffect = dailyVariant?.effect || "";
const isFullscreen = ref(false);

const gridCols = 22;
const MAX_PIXEL_RATIO = 2;
const TOUCH_DIRECTION_DEADZONE = 8;
const TOUCH_DIRECTION_SMOOTHING = 0.42;
const LONG_SNAKE_LENGTH = 520;
const LONG_SNAKE_EXACT_SEGMENTS = 220;
const LONG_SNAKE_TAIL_KEEP_SEGMENTS = 24;
const dirs = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const KEY_ACTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  " ": "pause",
};
let gridRows = 22;
let ctx;
let snake;
let previousSnake = [];
let snakeCells = new Set();
let food;
let direction;
let nextDirection;
let loopId = 0;
let lastTick = 0;
let renderAlpha = 1;
let gameOver = false;
let foodsEaten = 0;
let maxLength = 3;
let runNewGoalIds = new Set();
let resizeObserver;
let canvasSize = { width: 660, height: 660 };
let canvasPixelRatio = 1;
const foodImages = new Map();
const bodySpriteCache = new Map();
let foodBag = [];
let lastFoodId = "";
let activePointerId = null;
let touchAnchor = null;
let smoothedTouchDirection = null;

function selectSkin(id) {
  selectedSkinId.value = id;
  setSavedValue("snake:skin", id);
  draw();
}

function shuffleFoods() {
  const foods = [...SNAKE_FOODS];
  for (let i = foods.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [foods[i], foods[j]] = [foods[j], foods[i]];
  }
  if (foods[0]?.id === lastFoodId && foods.length > 1) {
    [foods[0], foods[1]] = [foods[1], foods[0]];
  }
  foodBag = foods;
}

function nextFoodAsset() {
  if (!foodBag.length) shuffleFoods();
  const nextFood = foodBag.shift() || SNAKE_FOODS[0];
  lastFoodId = nextFood.id;
  return nextFood;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cellKey(point) {
  return `${point.x}:${point.y}`;
}

function cloneSnakeBody(body = snake) {
  return body.map((part) => ({ x: part.x, y: part.y }));
}

function rebuildSnakeCells() {
  snakeCells = new Set((snake || []).map(cellKey));
}

function normalizeDirection(dir) {
  const length = Math.hypot(dir.x, dir.y);
  if (!length) return dirs.right;
  return {
    x: dir.x / length,
    y: dir.y / length,
  };
}

function directionNameFromVector(dir) {
  if (Math.abs(dir.x) > Math.abs(dir.y)) return dir.x > 0 ? "right" : "left";
  if (Math.abs(dir.y) > 0) return dir.y > 0 ? "down" : "up";
  return null;
}

function placeFood() {
  let x;
  let y;
  do {
    x = Math.floor(Math.random() * gridCols);
    y = Math.floor(Math.random() * gridRows);
  } while (snakeCells.has(`${x}:${y}`));

  food = {
    x,
    y,
    kind: variantEffect === "golden-food" && (foodsEaten + 1) % 4 === 0 ? "gold" : "normal",
    asset: nextFoodAsset(),
  };
}

function syncProgress() {
  const result = recordGameResult("snake", {
    score: score.value,
    foods: foodsEaten,
    maxLength,
    dailyVariantId: dailyVariant?.id,
  });
  result.newlyUnlocked.forEach((id) => runNewGoalIds.add(id));
  progressVersion.value += 1;
  return result;
}

function showRunResult(title, detail) {
  const result = syncProgress();
  runResult.value = {
    title,
    detail,
    stats: [
      { label: "分数", value: score.value },
      { label: "能量核心", value: foodsEaten },
      { label: "最大长度", value: maxLength },
    ],
    stars: result.stars,
    total: result.total,
    variantCompleted: result.variantCompleted,
    newGoals: result.goals.filter((goal) => runNewGoalIds.has(goal.id)),
    goals: result.goals,
  };
}

function enterFullscreen() {
  if (!gameContainer.value) return;
  const elem = gameContainer.value;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => {});
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

function toggleFullscreen() {
  if (isFullscreen.value) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  setTimeout(() => resize(), 100);
}

function restart() {
  const startY = Math.floor(gridRows / 2);
  const startX = Math.floor(gridCols / 2);
  snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ];
  previousSnake = cloneSnakeBody(snake);
  rebuildSnakeCells();
  direction = dirs.right;
  nextDirection = dirs.right;
  activePointerId = null;
  touchAnchor = null;
  smoothedTouchDirection = null;
  renderAlpha = 1;
  score.value = 0;
  runResult.value = null;
  runNewGoalIds = new Set();
  foodsEaten = 0;
  maxLength = snake.length;
  lastFoodId = "";
  shuffleFoods();
  status.value =
    variantEffect === "turbo"
      ? "高速核心：节奏更快，得分更高"
      : variantEffect === "wrap-walls"
        ? "相位边界：撞墙会穿越"
        : "收集能量核心";
  paused.value = false;
  gameOver = false;
  placeFood();
  draw();
  ensureLoop();

  // 游戏开始时自动进入全屏
  if (!isFullscreen.value) {
    setTimeout(() => enterFullscreen(), 100);
  }
}

function setDirection(name) {
  const dir = dirs[name];
  if (!dir) return;
  if (dir.x + direction.x === 0 && dir.y + direction.y === 0) return;
  nextDirection = dir;
}

function setDirectionFromSwipe(clientX, clientY) {
  if (!canvas.value || gameOver || !touchAnchor) return;
  const rect = canvas.value.getBoundingClientRect();
  const dx = clientX - rect.left - touchAnchor.x;
  const dy = clientY - rect.top - touchAnchor.y;
  if (Math.hypot(dx, dy) < TOUCH_DIRECTION_DEADZONE) return;
  const targetDirection = normalizeDirection({ x: dx, y: dy });
  smoothedTouchDirection = smoothedTouchDirection
    ? normalizeDirection({
        x: smoothedTouchDirection.x + (targetDirection.x - smoothedTouchDirection.x) * TOUCH_DIRECTION_SMOOTHING,
        y: smoothedTouchDirection.y + (targetDirection.y - smoothedTouchDirection.y) * TOUCH_DIRECTION_SMOOTHING,
      })
    : targetDirection;
  const name = directionNameFromVector(smoothedTouchDirection);
  if (name) setDirection(name);
}

function onPointerDown(event) {
  if (gameOver) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  const rect = canvas.value.getBoundingClientRect();
  touchAnchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  smoothedTouchDirection = { ...direction };
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (activePointerId !== event.pointerId || gameOver) return;
  event.preventDefault();
  setDirectionFromSwipe(event.clientX, event.clientY);
}

function onPointerEnd(event) {
  if (activePointerId === event.pointerId) activePointerId = null;
  touchAnchor = null;
  smoothedTouchDirection = null;
  try {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  } catch {
    // Pointer capture may already have been released by the browser.
  }
}

function step() {
  if (paused.value || gameOver) return;
  previousSnake = cloneSnakeBody();
  direction = nextDirection;
  let head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };
  if (variantEffect === "wrap-walls") {
    head = {
      x: (head.x + gridCols) % gridCols,
      y: (head.y + gridRows) % gridRows,
    };
  }

  if (
    (variantEffect !== "wrap-walls" && (head.x < 0 || head.y < 0 || head.x >= gridCols || head.y >= gridRows)) ||
    snakeCells.has(cellKey(head))
  ) {
    gameOver = true;
    status.value = "撞毁，点击重开";
    best.value = setBestScore("snake", score.value);
    showRunResult("航迹中断", "撞上边界或自己的身体，本局结算。");
    return;
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    foodsEaten += 1;
    score.value += food.kind === "gold" ? 30 : variantEffect === "turbo" ? 15 : 10;
    maxLength = Math.max(maxLength, snake.length);
    best.value = setBestScore("snake", score.value);
    syncProgress();
    rebuildSnakeCells();
    placeFood();
  } else {
    snake.pop();
    rebuildSnakeCells();
  }
}

function drawGrid(width, height, cell) {
  ctx.strokeStyle = "rgba(83, 243, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= gridCols; x += 1) {
    const p = x * cell;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, height);
    ctx.stroke();
  }
  for (let y = 0; y <= gridRows; y += 1) {
    const p = y * cell;
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(width, p);
    ctx.stroke();
  }
}

function roundedRect(x, y, width, height, radius, c = ctx) {
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + width, y, x + width, y + height, radius);
  c.arcTo(x + width, y + height, x, y + height, radius);
  c.arcTo(x, y + height, x, y, radius);
  c.arcTo(x, y, x + width, y, radius);
  c.closePath();
}

function drawSkinPattern(skin, x, y, size, index, c = ctx) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  c.save();
  c.globalAlpha = 0.9;
  c.strokeStyle = skin.bodyAlt;
  c.fillStyle = skin.bodyAlt;
  c.lineWidth = Math.max(1.2, size * 0.08);

  if (skin.pattern === "circuits") {
    c.beginPath();
    c.moveTo(x + size * 0.22, cy);
    c.lineTo(x + size * 0.78, cy);
    c.moveTo(cx, y + size * 0.26);
    c.lineTo(cx, y + size * 0.46);
    c.stroke();
    c.beginPath();
    c.arc(x + size * 0.78, cy, size * 0.08, 0, Math.PI * 2);
    c.fill();
  }

  if (skin.pattern === "cracks") {
    c.beginPath();
    c.moveTo(x + size * 0.24, y + size * 0.24);
    c.lineTo(cx, cy);
    c.lineTo(x + size * 0.7, y + size * 0.76);
    c.stroke();
  }

  if (skin.pattern === "snow") {
    c.lineWidth = Math.max(1, size * 0.06);
    c.beginPath();
    c.moveTo(cx - size * 0.18, cy);
    c.lineTo(cx + size * 0.18, cy);
    c.moveTo(cx, cy - size * 0.18);
    c.lineTo(cx, cy + size * 0.18);
    c.stroke();
  }

  if (skin.pattern === "leaves") {
    c.save();
    c.translate(cx, cy);
    c.rotate(index % 2 ? -0.65 : 0.65);
    c.beginPath();
    c.ellipse(0, 0, size * 0.2, size * 0.09, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  if (skin.pattern === "gems") {
    c.beginPath();
    c.moveTo(cx, y + size * 0.18);
    c.lineTo(x + size * 0.72, cy);
    c.lineTo(cx, y + size * 0.82);
    c.lineTo(x + size * 0.28, cy);
    c.closePath();
    c.fill();
  }

  if (skin.pattern === "stripes") {
    c.beginPath();
    c.moveTo(x + size * 0.24, y + size * 0.82);
    c.lineTo(x + size * 0.82, y + size * 0.24);
    c.stroke();
  }

  if (skin.pattern === "stars") {
    c.lineWidth = Math.max(1, size * 0.05);
    c.beginPath();
    c.moveTo(cx - size * 0.2, cy);
    c.lineTo(cx + size * 0.2, cy);
    c.moveTo(cx, cy - size * 0.2);
    c.lineTo(cx, cy + size * 0.2);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, size * 0.05, 0, Math.PI * 2);
    c.fill();
  }

  if (skin.pattern === "scales") {
    c.globalAlpha = 0.55;
    for (let i = 0; i < 3; i += 1) {
      c.beginPath();
      c.arc(x + size * (0.28 + i * 0.22), cy, size * 0.12, Math.PI, Math.PI * 2);
      c.stroke();
    }
  }

  if (skin.pattern === "tiger") {
    c.lineWidth = Math.max(1.4, size * 0.12);
    c.beginPath();
    c.moveTo(x + size * 0.2, y + size * 0.22);
    c.lineTo(x + size * 0.72, y + size * 0.76);
    c.stroke();
  }

  if (skin.pattern === "mist") {
    c.globalAlpha = 0.26;
    c.beginPath();
    c.arc(x + size * 0.36, y + size * 0.36, size * 0.2, 0, Math.PI * 2);
    c.arc(x + size * 0.68, y + size * 0.66, size * 0.16, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

function getBodySprite(skin, cell) {
  const key = `${Math.round(cell * 100)}|${skin.body}|${skin.bodyAlt}|${skin.glow}|${skin.pattern}`;
  const cached = bodySpriteCache.get(key);
  if (cached) return cached;

  const gap = Math.max(0.5, cell * 0.025);
  const size = cell - gap * 2;
  const blur = Math.max(6, cell * 0.32);
  const pad = Math.ceil(blur + 2);
  const spriteSize = Math.ceil(size + pad * 2);
  const sprite = document.createElement("canvas");
  sprite.width = spriteSize;
  sprite.height = spriteSize;
  const c = sprite.getContext("2d");

  c.shadowBlur = blur;
  c.shadowColor = skin.glow;
  const fill = c.createLinearGradient(pad, pad, pad + size, pad + size);
  fill.addColorStop(0, skin.body);
  fill.addColorStop(1, skin.bodyAlt);
  c.fillStyle = fill;
  roundedRect(pad, pad, size, size, size * 0.34, c);
  c.fill();

  c.shadowBlur = 0;
  c.fillStyle = "rgba(255,255,255,0.24)";
  roundedRect(pad + size * 0.18, pad + size * 0.14, size * 0.32, size * 0.14, size * 0.07, c);
  c.fill();
  drawSkinPattern(skin, pad, pad, size, 0, c);

  const entry = { canvas: sprite, half: spriteSize / 2 };
  bodySpriteCache.set(key, entry);
  return entry;
}

function drawSnakePart(part, index, cell, skin) {
  const isHead = index === 0;
  const centerX = part.x * cell + cell / 2;
  const centerY = part.y * cell + cell / 2;

  if (!isHead) {
    const sprite = getBodySprite(skin, cell);
    ctx.drawImage(sprite.canvas, centerX - sprite.half, centerY - sprite.half);
    return;
  }

  const gap = Math.max(0.5, cell * 0.025);
  const x = part.x * cell + gap;
  const y = part.y * cell + gap;
  const size = cell - gap * 2;
  const center = { x: x + size / 2, y: y + size / 2 };

  ctx.save();
  ctx.shadowBlur = Math.max(12, cell * 0.5);
  ctx.shadowColor = skin.head;
  const fill = ctx.createLinearGradient(x, y, x + size, y + size);
  fill.addColorStop(0, skin.head);
  fill.addColorStop(1, skin.bodyAlt);
  ctx.fillStyle = fill;
  roundedRect(x, y, size, size, size * 0.42);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  roundedRect(x + size * 0.18, y + size * 0.14, size * 0.32, size * 0.14, size * 0.07);
  ctx.fill();

  const dir = direction || dirs.right;
  const side = { x: -dir.y, y: dir.x };
  const forward = { x: dir.x, y: dir.y };
  const eyeForward = size * 0.2;
  const eyeSide = size * 0.18;
  const eyeRadius = Math.max(2.2, size * 0.09);
  const eyes = [-1, 1].map((sign) => ({
    x: center.x + forward.x * eyeForward + side.x * eyeSide * sign,
    y: center.y + forward.y * eyeForward + side.y * eyeSide * sign,
  }));
  ctx.fillStyle = skin.eye;
  eyes.forEach((eye) => {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.beginPath();
    ctx.arc(eye.x + eyeRadius * 0.25, eye.y - eyeRadius * 0.25, eyeRadius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.eye;
  });

  ctx.strokeStyle = skin.bodyAlt;
  ctx.lineWidth = Math.max(1.2, size * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(center.x + forward.x * size * 0.42, center.y + forward.y * size * 0.42);
  ctx.lineTo(center.x + forward.x * size * 0.62 + side.x * size * 0.15, center.y + forward.y * size * 0.62 + side.y * size * 0.15);
  ctx.moveTo(center.x + forward.x * size * 0.42, center.y + forward.y * size * 0.42);
  ctx.lineTo(center.x + forward.x * size * 0.62 - side.x * size * 0.15, center.y + forward.y * size * 0.62 - side.y * size * 0.15);
  ctx.stroke();

  ctx.restore();
}

function getFoodImage(foodAsset) {
  if (!foodAsset?.image || typeof Image === "undefined") return null;
  if (!foodImages.has(foodAsset.image)) {
    const image = new Image();
    image.onload = () => draw();
    image.src = foodAsset.image;
    foodImages.set(foodAsset.image, image);
  }
  const image = foodImages.get(foodAsset.image);
  return image.complete && image.naturalWidth ? image : null;
}

function drawFood(cell) {
  const image = getFoodImage(food.asset);
  const centerX = food.x * cell + cell / 2;
  const centerY = food.y * cell + cell / 2;
  const imageSize = cell * (food.kind === "gold" ? 1.24 : 1.12);

  ctx.save();
  ctx.shadowBlur = food.kind === "gold" ? 24 : 18;
  ctx.shadowColor = food.kind === "gold" ? "#facc15" : "#ffd166";

  if (image) {
    ctx.drawImage(image, centerX - imageSize / 2, centerY - imageSize / 2, imageSize, imageSize);
  } else {
    ctx.fillStyle = food.kind === "gold" ? "#facc15" : "#ffd166";
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * (food.kind === "gold" ? 0.5 : 0.42), 0, Math.PI * 2);
    ctx.fill();
  }

  if (food.kind === "gold") {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.66)";
    ctx.lineWidth = Math.max(1.4, cell * 0.045);
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function boardSize() {
  return canvasSize;
}

function syncCanvasSize() {
  if (!canvas.value) return canvasSize;
  const nextRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const pixelWidth = Math.max(1, Math.floor(canvasSize.width * nextRatio));
  const pixelHeight = Math.max(1, Math.floor(canvasSize.height * nextRatio));
  if (canvas.value.width !== pixelWidth || canvas.value.height !== pixelHeight || canvasPixelRatio !== nextRatio) {
    canvas.value.width = pixelWidth;
    canvas.value.height = pixelHeight;
    canvasPixelRatio = nextRatio;
    ctx = canvas.value.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    bodySpriteCache.clear();
  }
  ctx.setTransform(canvasPixelRatio, 0, 0, canvasPixelRatio, 0, 0);
  ctx.imageSmoothingEnabled = true;
  return boardSize();
}

function interpolatedPart(part, index) {
  if (renderAlpha >= 0.99) return part;
  const from = previousSnake[index];
  if (!from) return part;
  return {
    x: from.x + (part.x - from.x) * renderAlpha,
    y: from.y + (part.y - from.y) * renderAlpha,
  };
}

function drawableSnakeParts() {
  const parts = snake.map((part, index) => ({ ...interpolatedPart(part, index), index }));
  if (parts.length <= LONG_SNAKE_LENGTH) return parts;
  const tailKeepStart = Math.max(LONG_SNAKE_EXACT_SEGMENTS, parts.length - LONG_SNAKE_TAIL_KEEP_SEGMENTS);
  return parts.filter((part) => part.index < LONG_SNAKE_EXACT_SEGMENTS || part.index >= tailKeepStart);
}

function draw() {
  if (!canvas.value || !snake || !food) return;
  const { width, height } = syncCanvasSize();
  const cell = width / gridCols;
  const skin = selectedSkin.value;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height, cell);

  drawFood(cell);

  drawableSnakeParts().reverse().forEach((part) => {
    drawSnakePart(part, part.index, cell, skin);
  });
  ctx.shadowBlur = 0;
}

function loop(time) {
  if (paused.value || gameOver) {
    loopId = 0; // 暂停/结束时停止循环，恢复由 ensureLoop 重启，避免空转重绘
    return;
  }
  const tickSpeed = variantEffect === "turbo" ? 108 : 150;
  if (!lastTick) lastTick = time;
  if (time - lastTick > Math.max(tickSpeed, 240)) lastTick = time - tickSpeed;
  if (time - lastTick >= tickSpeed) {
    step();
    lastTick = time;
  }
  renderAlpha = clamp((time - lastTick) / tickSpeed, 0, 1);
  draw();
  loopId = requestAnimationFrame(loop);
}

// 幂等启动主循环：仅在未运行时启动，避免重复 rAF
function ensureLoop() {
  if (loopId) return;
  lastTick = 0;
  loopId = requestAnimationFrame(loop);
}

function resize() {
  if (!canvas.value) return;
  const parent = canvas.value.parentElement;
  if (!parent) return;

  // 全屏模式下使用整个视口
  const maxWidth = isFullscreen.value ? window.innerWidth : 820;
  const maxHeight = isFullscreen.value ? window.innerHeight : parent.clientHeight - 4;
  const availableWidth = Math.max(280, Math.min(parent.clientWidth - 4, maxWidth));
  const availableHeight = Math.max(280, maxHeight);
  const cell = availableWidth / gridCols;
  gridRows = Math.max(12, Math.floor(availableHeight / cell));
  const width = Math.floor(gridCols * cell);
  const height = Math.floor(gridRows * cell);
  canvas.value.style.width = `${width}px`;
  canvas.value.style.height = `${height}px`;
  canvasSize = { width, height };
  syncCanvasSize();
  draw();
}

function togglePause() {
  if (gameOver) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续收集能量核心";
  if (!paused.value) ensureLoop();
}

function onKey(event) {
  const action = KEY_ACTIONS[event.key];
  if (!action) return;
  event.preventDefault();
  if (action === "pause") togglePause();
  else setDirection(action);
}

onMounted(() => {
  ctx = canvas.value.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  resize();
  restart();
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas.value.parentElement);
  }
  requestAnimationFrame(resize);
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKey);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("mozfullscreenchange", onFullscreenChange);
  document.addEventListener("msfullscreenchange", onFullscreenChange);
  ensureLoop();
});

onUnmounted(() => {
  cancelAnimationFrame(loopId);
  resizeObserver?.disconnect();
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKey);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  document.removeEventListener("mozfullscreenchange", onFullscreenChange);
  document.removeEventListener("msfullscreenchange", onFullscreenChange);
});
</script>

<template>
  <GameLayout
    class="snake-layout"
    game-id="snake"
    :score="score"
    :best="best"
    :status="status"
    :paused="paused"
    :progress-version="progressVersion"
    :run-result="runResult"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
    @dismiss-result="runResult = null"
  >
    <section ref="gameContainer" class="game-panel split-panel snake-play-panel" :class="{ 'is-fullscreen': isFullscreen }">
      <button
        class="fullscreen-toggle"
        type="button"
        :title="isFullscreen ? '退出全屏' : '进入全屏'"
        @click="toggleFullscreen"
      >
        <Minimize v-if="isFullscreen" :size="20" />
        <Maximize v-else :size="20" />
      </button>
      <div
        class="board-shell snake-board-shell"
      >
        <canvas
          ref="canvas"
          class="canvas-board snake-canvas"
          aria-label="贪吃蛇游戏画布"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerEnd"
          @pointercancel="onPointerEnd"
        ></canvas>
      </div>
      <aside class="control-panel snake-side-panel">
        <details class="snake-drawer" open>
          <summary>
            <Settings :size="18" />
            <span>设置</span>
            <ChevronDown class="drawer-chevron" :size="17" />
          </summary>
          <div class="snake-skin-grid" role="list" aria-label="贪吃蛇皮肤">
            <button
              v-for="skin in SNAKE_SKINS"
              :key="skin.id"
              class="snake-skin-option"
              :class="{ active: selectedSkinId === skin.id }"
              :style="{ '--skin': skin.body, '--skin-alt': skin.bodyAlt, '--skin-glow': skin.glow }"
              type="button"
              role="listitem"
              :title="`${skin.name} - ${skin.subtitle}`"
              :aria-label="skin.name"
              :aria-pressed="selectedSkinId === skin.id"
              @click="selectSkin(skin.id)"
            >
              <img :src="skin.preview" alt="" />
            </button>
          </div>
        </details>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
:global(.snake-layout.game-shell) {
  padding: 12px;
}

:global(.snake-layout .game-frame) {
  width: min(1380px, 100%);
}

:global(.snake-layout .game-content) {
  padding: 10px 14px 14px;
}

:global(.snake-layout .game-meta-row) {
  display: none;
}

.snake-play-panel {
  position: relative;
  grid-template-columns: minmax(0, 1fr) 118px;
  gap: 8px;
  align-items: stretch;
}

.snake-play-panel.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #020611;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  gap: 0;
  padding: 0;
  margin: 0;
}

.fullscreen-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid rgba(145, 235, 255, 0.3);
  border-radius: 8px;
  background: rgba(7, 13, 27, 0.88);
  color: var(--cyan);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.fullscreen-toggle:hover {
  border-color: var(--cyan);
  box-shadow: 0 0 16px rgba(83, 243, 255, 0.3);
  transform: translateY(-1px);
}

.snake-board-shell {
  height: 100%;
  min-height: 0;
  padding: 4px;
}

.snake-board-shell .canvas-board {
  max-height: 100%;
}

.snake-canvas {
  touch-action: none;
}

.is-fullscreen .snake-board-shell {
  padding: 0;
}

.is-fullscreen .snake-side-panel {
  display: none;
}

.snake-side-panel {
  gap: 0;
  overflow: visible;
  padding: 0;
  border: 0;
  background: transparent;
}

.snake-drawer {
  overflow: hidden;
  border: 1px solid rgba(145, 235, 255, 0.2);
  border-radius: var(--radius);
  background: rgba(7, 13, 27, 0.76);
}

.snake-drawer > summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  min-height: 38px;
  padding: 0 9px;
  color: var(--text);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 900;
  list-style: none;
}

.snake-drawer > summary::-webkit-details-marker {
  display: none;
}

.snake-drawer > summary svg {
  color: var(--cyan);
}

.snake-drawer > summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-chevron {
  transition: transform 0.18s ease;
}

.snake-drawer[open] .drawer-chevron {
  transform: rotate(180deg);
}

.snake-drawer .snake-skin-grid {
  margin: 0 8px 8px;
}

.snake-skin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.snake-skin-option {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  min-height: 0;
  padding: 5px;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--skin), transparent 84%), rgba(5, 10, 22, 0.62)),
    rgba(6, 13, 28, 0.74);
  color: var(--text);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.snake-skin-option:hover,
.snake-skin-option.active {
  border-color: color-mix(in srgb, var(--skin), white 18%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--skin-glow), transparent 72%);
}

.snake-skin-option:hover {
  transform: translateY(-1px);
}

.snake-skin-option.active::after {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--cyan);
  box-shadow: 0 0 10px var(--cyan);
  content: "";
}

.snake-skin-option img {
  width: min(42px, 100%);
  height: min(42px, 100%);
  border-radius: 7px;
  object-fit: cover;
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-glow), transparent 58%);
}

@media (max-width: 860px) {
  :global(.snake-layout.game-shell) {
    padding: 0;
  }

  :global(.snake-layout .game-frame) {
    border-radius: 0;
  }

  :global(.snake-layout .game-content) {
    padding: 4px;
  }

  .snake-play-panel {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
    align-content: stretch;
    gap: 6px;
    height: 100%;
  }

  .snake-play-panel.is-fullscreen {
    padding: 8px;
  }

  .fullscreen-toggle {
    top: 8px;
    left: 8px;
    width: 38px;
    height: 38px;
  }

  .snake-board-shell {
    aspect-ratio: auto;
    height: 100%;
    align-self: stretch;
    padding: 2px;
  }

  .snake-side-panel {
    max-height: 76px;
    overflow: hidden;
  }

  .is-fullscreen .snake-side-panel {
    max-height: 90px;
  }

  .snake-drawer {
    min-width: 0;
  }

  .snake-drawer > summary {
    min-height: 32px;
    padding: 0 9px;
    gap: 6px;
    font-size: 0.8rem;
  }

  .snake-drawer .snake-skin-grid {
    margin: 0 8px 7px;
  }

  .snake-skin-grid {
    grid-auto-columns: 42px;
    grid-auto-flow: column;
    grid-template-columns: none;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior: contain;
    padding-bottom: 2px;
  }

  .snake-skin-option {
    width: 42px;
    height: 42px;
    padding: 4px;
  }

  .snake-skin-option img {
    width: 34px;
    height: 34px;
  }
}

@media (max-width: 520px) {
  .snake-side-panel {
    max-height: 70px;
  }

  .snake-drawer > summary {
    min-height: 30px;
  }
}

@media (max-width: 430px), (max-height: 720px) {
  .snake-play-panel {
    grid-template-rows: minmax(0, 1fr) auto;
  }
}
</style>
