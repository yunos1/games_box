<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { createSwipeHandlers } from "../utils/touch";
import { getBestScore, setBestScore } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("snake"));
const status = ref("收集能量核心");
const paused = ref(false);
const progressVersion = ref(0);
const runResult = ref(null);
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

function draw() {
  if (!canvas.value) return;
  const width = canvas.value.width;
  const cell = width / grid;
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

  snake.forEach((part, index) => {
    ctx.shadowColor = index === 0 ? "#53f3ff" : "#7dff6f";
    ctx.fillStyle = index === 0 ? "#53f3ff" : "#7dff6f";
    ctx.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
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
      </aside>
    </section>
  </GameLayout>
</template>
