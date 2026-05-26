<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { createSwipeHandlers } from "../utils/touch";
import { SNAKE_SKINS, getSnakeSkinById } from "../data/snakeSkins";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const canvas = ref(null);
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

const grid = 22;
let ctx;
let snake;
let food;
let direction;
let nextDirection;
let loopId = 0;
let lastTick = 0;
let gameOver = false;
let foodsEaten = 0;
let maxLength = 3;
let runNewGoalIds = new Set();

function selectSkin(id) {
  selectedSkinId.value = id;
  setSavedValue("snake:skin", id);
  draw();
}

function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid),
      kind: variantEffect === "golden-food" && (foodsEaten + 1) % 4 === 0 ? "gold" : "normal",
    };
  } while (snake.some((part) => part.x === food.x && part.y === food.y));
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

function restart() {
  snake = [
    { x: 10, y: 11 },
    { x: 9, y: 11 },
    { x: 8, y: 11 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score.value = 0;
  runResult.value = null;
  runNewGoalIds = new Set();
  foodsEaten = 0;
  maxLength = snake.length;
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
}

function setDirection(name) {
  const dirs = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const dir = dirs[name];
  if (!dir) return;
  if (dir.x + direction.x === 0 && dir.y + direction.y === 0) return;
  nextDirection = dir;
}

function step() {
  if (paused.value || gameOver) return;
  direction = nextDirection;
  let head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };
  if (variantEffect === "wrap-walls") {
    head = {
      x: (head.x + grid) % grid,
      y: (head.y + grid) % grid,
    };
  }

  if (
    (variantEffect !== "wrap-walls" && (head.x < 0 || head.y < 0 || head.x >= grid || head.y >= grid)) ||
    snake.some((part) => part.x === head.x && part.y === head.y)
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
    placeFood();
  } else {
    snake.pop();
  }
}

function drawGrid(width, cell) {
  ctx.strokeStyle = "rgba(83, 243, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= grid; i += 1) {
    const p = i * cell;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, width);
    ctx.moveTo(0, p);
    ctx.lineTo(width, p);
    ctx.stroke();
  }
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawSkinPattern(skin, x, y, size, index) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = skin.bodyAlt;
  ctx.fillStyle = skin.bodyAlt;
  ctx.lineWidth = Math.max(1.2, size * 0.08);

  if (skin.pattern === "circuits") {
    ctx.beginPath();
    ctx.moveTo(x + size * 0.22, cy);
    ctx.lineTo(x + size * 0.78, cy);
    ctx.moveTo(cx, y + size * 0.26);
    ctx.lineTo(cx, y + size * 0.46);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size * 0.78, cy, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  if (skin.pattern === "cracks") {
    ctx.beginPath();
    ctx.moveTo(x + size * 0.24, y + size * 0.24);
    ctx.lineTo(cx, cy);
    ctx.lineTo(x + size * 0.7, y + size * 0.76);
    ctx.stroke();
  }

  if (skin.pattern === "snow") {
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.18, cy);
    ctx.lineTo(cx + size * 0.18, cy);
    ctx.moveTo(cx, cy - size * 0.18);
    ctx.lineTo(cx, cy + size * 0.18);
    ctx.stroke();
  }

  if (skin.pattern === "leaves") {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(index % 2 ? -0.65 : 0.65);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.2, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (skin.pattern === "gems") {
    ctx.beginPath();
    ctx.moveTo(cx, y + size * 0.18);
    ctx.lineTo(x + size * 0.72, cy);
    ctx.lineTo(cx, y + size * 0.82);
    ctx.lineTo(x + size * 0.28, cy);
    ctx.closePath();
    ctx.fill();
  }

  if (skin.pattern === "stripes") {
    ctx.beginPath();
    ctx.moveTo(x + size * 0.24, y + size * 0.82);
    ctx.lineTo(x + size * 0.82, y + size * 0.24);
    ctx.stroke();
  }

  if (skin.pattern === "stars") {
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.2, cy);
    ctx.lineTo(cx + size * 0.2, cy);
    ctx.moveTo(cx, cy - size * 0.2);
    ctx.lineTo(cx, cy + size * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  if (skin.pattern === "scales") {
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x + size * (0.28 + i * 0.22), cy, size * 0.12, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (skin.pattern === "tiger") {
    ctx.lineWidth = Math.max(1.4, size * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.2, y + size * 0.22);
    ctx.lineTo(x + size * 0.72, y + size * 0.76);
    ctx.stroke();
  }

  if (skin.pattern === "mist") {
    ctx.globalAlpha = 0.26;
    ctx.beginPath();
    ctx.arc(x + size * 0.36, y + size * 0.36, size * 0.2, 0, Math.PI * 2);
    ctx.arc(x + size * 0.68, y + size * 0.66, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSnakePart(part, index, cell, skin) {
  const gap = Math.max(2, cell * 0.08);
  const x = part.x * cell + gap;
  const y = part.y * cell + gap;
  const size = cell - gap * 2;
  const center = { x: x + size / 2, y: y + size / 2 };
  const isHead = index === 0;

  ctx.save();
  ctx.shadowBlur = isHead ? 22 : 15;
  ctx.shadowColor = isHead ? skin.head : skin.glow;
  const fill = ctx.createLinearGradient(x, y, x + size, y + size);
  fill.addColorStop(0, isHead ? skin.head : skin.body);
  fill.addColorStop(1, skin.bodyAlt);
  ctx.fillStyle = fill;
  roundedRect(x, y, size, size, isHead ? size * 0.42 : size * 0.34);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  roundedRect(x + size * 0.18, y + size * 0.14, size * 0.32, size * 0.14, size * 0.07);
  ctx.fill();
  if (!isHead) drawSkinPattern(skin, x, y, size, index);

  if (isHead) {
    const dir = direction || { x: 1, y: 0 };
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
  }

  ctx.restore();
}

function draw() {
  if (!canvas.value) return;
  const width = canvas.value.width;
  const cell = width / grid;
  const skin = selectedSkin.value;
  ctx.clearRect(0, 0, width, width);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, width, width);
  drawGrid(width, cell);

  ctx.shadowBlur = 18;
  ctx.shadowColor = food.kind === "gold" ? "#facc15" : "#ffd166";
  ctx.fillStyle = food.kind === "gold" ? "#facc15" : "#ffd166";
  ctx.beginPath();
  ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * (food.kind === "gold" ? 0.42 : 0.32), 0, Math.PI * 2);
  ctx.fill();

  [...snake].reverse().forEach((part, reversedIndex) => {
    drawSnakePart(part, snake.length - 1 - reversedIndex, cell, skin);
  });
  ctx.shadowBlur = 0;
}

function loop(time) {
  const baseSpeed = variantEffect === "turbo" ? 108 : 150;
  const minSpeed = variantEffect === "turbo" ? 62 : 80;
  if (time - lastTick > Math.max(minSpeed, baseSpeed - score.value * 0.55)) {
    step();
    draw();
    lastTick = time;
  }
  loopId = requestAnimationFrame(loop);
}

function resize() {
  if (!canvas.value) return;
  const size = Math.min(canvas.value.parentElement.clientWidth - 24, 620);
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.value.style.width = `${size}px`;
  canvas.value.style.height = `${size}px`;
  canvas.value.width = Math.floor(size * pixelRatio);
  canvas.value.height = Math.floor(size * pixelRatio);
  ctx = canvas.value.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  canvas.value.width = size;
  canvas.value.height = size;
  draw();
}

function togglePause() {
  if (gameOver) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续收集能量核心";
}

function onKey(event) {
  const map = {
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
  const action = map[event.key];
  if (!action) return;
  event.preventDefault();
  if (action === "pause") togglePause();
  else setDirection(action);
}

const swipe = createSwipeHandlers(setDirection);

onMounted(() => {
  ctx = canvas.value.getContext("2d");
  restart();
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKey);
  loopId = requestAnimationFrame(loop);
});

onUnmounted(() => {
  cancelAnimationFrame(loopId);
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <GameLayout
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
    <section class="game-panel split-panel">
      <div class="board-shell" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd" @touchmove.prevent>
        <canvas ref="canvas" class="canvas-board" aria-label="贪吃蛇游戏画布"></canvas>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>方向键或 WASD 控制，空格暂停。移动端在画布区域滑动。</p>
        <div class="d-pad">
          <button class="up" type="button" @click="setDirection('up')">↑</button>
          <button class="left" type="button" @click="setDirection('left')">←</button>
          <button class="center" type="button" @click="togglePause">{{ paused ? "▶" : "Ⅱ" }}</button>
          <button class="right" type="button" @click="setDirection('right')">→</button>
          <button class="down" type="button" @click="setDirection('down')">↓</button>
        </div>
        <h3>皮肤</h3>
        <div class="snake-skin-grid" role="list" aria-label="贪吃蛇皮肤">
          <button
            v-for="skin in SNAKE_SKINS"
            :key="skin.id"
            class="snake-skin-option"
            :class="{ active: selectedSkinId === skin.id }"
            :style="{ '--skin': skin.body, '--skin-alt': skin.bodyAlt, '--skin-glow': skin.glow }"
            type="button"
            role="listitem"
            :aria-pressed="selectedSkinId === skin.id"
            @click="selectSkin(skin.id)"
          >
            <img :src="skin.preview" alt="" />
            <span>
              <strong>{{ skin.name }}</strong>
              <small>{{ skin.subtitle }}</small>
            </span>
          </button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.snake-skin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.snake-skin-option {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 58px;
  padding: 7px;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--skin), transparent 84%), rgba(5, 10, 22, 0.62)),
    rgba(6, 13, 28, 0.74);
  color: var(--text);
  cursor: pointer;
  text-align: left;
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

.snake-skin-option img {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-glow), transparent 58%);
}

.snake-skin-option span,
.snake-skin-option strong,
.snake-skin-option small {
  display: block;
  min-width: 0;
}

.snake-skin-option strong,
.snake-skin-option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snake-skin-option strong {
  font-size: 0.78rem;
}

.snake-skin-option small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.68rem;
}

@media (max-width: 860px) {
  .snake-skin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
