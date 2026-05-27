<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ChevronDown, Gamepad2, Settings } from "lucide-vue-next";
import GameLayout from "../components/GameLayout.vue";
import { createSwipeHandlers } from "../utils/touch";
import { SNAKE_FOODS } from "../data/snakeFoods";
import { SNAKE_SKINS, getSnakeSkinById } from "../data/snakeSkins";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("snake-arena"));
const status = ref("争夺能量核心");
const paused = ref(false);
const selectedSkinId = ref(getSavedValue("snake:skin", "cyber"));
const selectedSkin = computed(() => getSnakeSkinById(selectedSkinId.value));

const grid = 28;
const size = 560;
const dirs = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let ctx;
let player;
let aiSnakes;
let foods;
let direction;
let nextDirection;
let loopId = 0;
let lastTick = 0;
let gameOver = false;
const foodImages = new Map();
let foodBag = [];
let lastFoodId = "";

function selectSkin(id) {
  selectedSkinId.value = id;
  setSavedValue("snake:skin", id);
  draw();
}

function shuffleFoods() {
  const nextBag = [...SNAKE_FOODS];
  for (let i = nextBag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [nextBag[i], nextBag[j]] = [nextBag[j], nextBag[i]];
  }
  if (nextBag[0]?.id === lastFoodId && nextBag.length > 1) {
    [nextBag[0], nextBag[1]] = [nextBag[1], nextBag[0]];
  }
  foodBag = nextBag;
}

function nextFoodAsset() {
  if (!foodBag.length) shuffleFoods();
  const nextFood = foodBag.shift() || SNAKE_FOODS[0];
  lastFoodId = nextFood.id;
  return nextFood;
}

function same(a, b) {
  return a.x === b.x && a.y === b.y;
}

function allSegments() {
  return [...player.body, ...aiSnakes.flatMap((snake) => snake.body)];
}

function occupied(point) {
  return allSegments().some((part) => same(part, point));
}

function spawnFood() {
  let food;
  do {
    food = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid),
      value: Math.random() < 0.16 ? 30 : 10,
      asset: nextFoodAsset(),
    };
  } while (occupied(food) || foods.some((item) => same(item, food)));
  foods.push(food);
}

function restart() {
  player = {
    body: [
      { x: 14, y: 18 },
      { x: 13, y: 18 },
      { x: 12, y: 18 },
      { x: 11, y: 18 },
    ],
  };
  aiSnakes = [
    { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], dir: "right", skinId: "candy", respawn: 0 },
    { body: [{ x: 22, y: 8 }, { x: 23, y: 8 }, { x: 24, y: 8 }], dir: "left", skinId: "tiger", respawn: 0 },
    { body: [{ x: 8, y: 23 }, { x: 8, y: 24 }, { x: 8, y: 25 }], dir: "up", skinId: "jungle", respawn: 0 },
  ];
  foods = [];
  lastFoodId = "";
  shuffleFoods();
  direction = dirs.right;
  nextDirection = dirs.right;
  score.value = 0;
  paused.value = false;
  gameOver = false;
  status.value = "争夺能量核心";
  for (let i = 0; i < 10; i += 1) spawnFood();
  draw();
}

function setDirection(name) {
  const dir = dirs[name];
  if (!dir || gameOver) return;
  if (dir.x + direction.x === 0 && dir.y + direction.y === 0) return;
  nextDirection = dir;
}

function inBounds(point) {
  return point.x >= 0 && point.y >= 0 && point.x < grid && point.y < grid;
}

function killAi(snake) {
  score.value += 50;
  best.value = setBestScore("snake-arena", score.value);
  snake.body = [];
  snake.respawn = 18;
}

function respawnAi(snake, index) {
  const starts = [
    [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
    [{ x: 22, y: 8 }, { x: 23, y: 8 }, { x: 24, y: 8 }],
    [{ x: 8, y: 23 }, { x: 8, y: 24 }, { x: 8, y: 25 }],
  ];
  snake.body = starts[index].map((part) => ({ ...part }));
  snake.dir = index === 1 ? "left" : index === 2 ? "up" : "right";
  snake.respawn = 0;
}

function movePlayer() {
  direction = nextDirection;
  const head = {
    x: player.body[0].x + direction.x,
    y: player.body[0].y + direction.y,
  };
  const tail = player.body.at(-1);
  const hitsSelf = player.body.slice(0, -1).some((part) => same(part, head));
  const hitsAi = aiSnakes.some((snake) => snake.body.some((part) => same(part, head)));
  if (!inBounds(head) || hitsSelf || hitsAi) {
    gameOver = true;
    status.value = "撞毁，点击重开";
    best.value = setBestScore("snake-arena", score.value);
    return;
  }
  player.body.unshift(head);
  const foodIndex = foods.findIndex((food) => same(food, head));
  if (foodIndex >= 0) {
    const [food] = foods.splice(foodIndex, 1);
    score.value += food.value;
    best.value = setBestScore("snake-arena", score.value);
    spawnFood();
  } else if (!same(head, tail)) {
    player.body.pop();
  }
}

function chooseAiDirection(snake) {
  const head = snake.body[0];
  const target = foods
    .map((food) => ({ food, distance: Math.abs(food.x - head.x) + Math.abs(food.y - head.y) }))
    .sort((a, b) => a.distance - b.distance)[0]?.food;
  const options = Object.entries(dirs)
    .filter(([, dir]) => {
      const current = dirs[snake.dir];
      return dir.x + current.x !== 0 || dir.y + current.y !== 0;
    })
    .map(([name, dir]) => {
      const next = { x: head.x + dir.x, y: head.y + dir.y };
      const blocked = !inBounds(next) || allSegments().some((part) => same(part, next));
      const distance = target ? Math.abs(target.x - next.x) + Math.abs(target.y - next.y) : Math.random() * 10;
      return { name, next, blocked, distance };
    })
    .filter((option) => !option.blocked)
    .sort((a, b) => a.distance - b.distance);
  return options[0]?.name || snake.dir;
}

function moveAi() {
  aiSnakes.forEach((snake, index) => {
    if (snake.respawn > 0) {
      snake.respawn -= 1;
      if (snake.respawn === 0) respawnAi(snake, index);
      return;
    }
    snake.dir = chooseAiDirection(snake);
    const dir = dirs[snake.dir];
    const head = { x: snake.body[0].x + dir.x, y: snake.body[0].y + dir.y };
    const blocked = !inBounds(head) || allSegments().some((part) => same(part, head));
    if (blocked) {
      killAi(snake);
      return;
    }
    snake.body.unshift(head);
    const foodIndex = foods.findIndex((food) => same(food, head));
    if (foodIndex >= 0) {
      foods.splice(foodIndex, 1);
      spawnFood();
    } else {
      snake.body.pop();
    }
  });
}

function step() {
  if (paused.value || gameOver) return;
  movePlayer();
  if (!gameOver) moveAi();
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

function drawSkinPattern(skin, x, y, partSize, index) {
  const cx = x + partSize / 2;
  const cy = y + partSize / 2;
  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = skin.bodyAlt;
  ctx.fillStyle = skin.bodyAlt;
  ctx.lineWidth = Math.max(1, partSize * 0.08);

  if (skin.pattern === "circuits") {
    ctx.beginPath();
    ctx.moveTo(x + partSize * 0.22, cy);
    ctx.lineTo(x + partSize * 0.78, cy);
    ctx.moveTo(cx, y + partSize * 0.26);
    ctx.lineTo(cx, y + partSize * 0.46);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + partSize * 0.78, cy, partSize * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  if (skin.pattern === "cracks") {
    ctx.beginPath();
    ctx.moveTo(x + partSize * 0.24, y + partSize * 0.24);
    ctx.lineTo(cx, cy);
    ctx.lineTo(x + partSize * 0.7, y + partSize * 0.76);
    ctx.stroke();
  }

  if (skin.pattern === "snow") {
    ctx.lineWidth = Math.max(1, partSize * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - partSize * 0.18, cy);
    ctx.lineTo(cx + partSize * 0.18, cy);
    ctx.moveTo(cx, cy - partSize * 0.18);
    ctx.lineTo(cx, cy + partSize * 0.18);
    ctx.stroke();
  }

  if (skin.pattern === "leaves") {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(index % 2 ? -0.65 : 0.65);
    ctx.beginPath();
    ctx.ellipse(0, 0, partSize * 0.2, partSize * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (skin.pattern === "gems") {
    ctx.beginPath();
    ctx.moveTo(cx, y + partSize * 0.18);
    ctx.lineTo(x + partSize * 0.72, cy);
    ctx.lineTo(cx, y + partSize * 0.82);
    ctx.lineTo(x + partSize * 0.28, cy);
    ctx.closePath();
    ctx.fill();
  }

  if (skin.pattern === "stripes") {
    ctx.beginPath();
    ctx.moveTo(x + partSize * 0.24, y + partSize * 0.82);
    ctx.lineTo(x + partSize * 0.82, y + partSize * 0.24);
    ctx.stroke();
  }

  if (skin.pattern === "stars") {
    ctx.lineWidth = Math.max(1, partSize * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - partSize * 0.2, cy);
    ctx.lineTo(cx + partSize * 0.2, cy);
    ctx.moveTo(cx, cy - partSize * 0.2);
    ctx.lineTo(cx, cy + partSize * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, partSize * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  if (skin.pattern === "scales") {
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x + partSize * (0.28 + i * 0.22), cy, partSize * 0.12, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (skin.pattern === "tiger") {
    ctx.lineWidth = Math.max(1.2, partSize * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + partSize * 0.2, y + partSize * 0.22);
    ctx.lineTo(x + partSize * 0.72, y + partSize * 0.76);
    ctx.stroke();
  }

  if (skin.pattern === "mist") {
    ctx.globalAlpha = 0.26;
    ctx.beginPath();
    ctx.arc(x + partSize * 0.36, y + partSize * 0.36, partSize * 0.2, 0, Math.PI * 2);
    ctx.arc(x + partSize * 0.68, y + partSize * 0.66, partSize * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSnakePart(part, index, cell, skin, dir) {
  const gap = Math.max(1.2, cell * 0.045);
  const x = part.x * cell + gap;
  const y = part.y * cell + gap;
  const partSize = cell - gap * 2;
  const center = { x: x + partSize / 2, y: y + partSize / 2 };
  const isHead = index === 0;

  ctx.save();
  ctx.shadowBlur = isHead ? 16 : 9;
  ctx.shadowColor = isHead ? skin.head : skin.glow;
  const fill = ctx.createLinearGradient(x, y, x + partSize, y + partSize);
  fill.addColorStop(0, isHead ? skin.head : skin.body);
  fill.addColorStop(1, skin.bodyAlt);
  ctx.fillStyle = fill;
  roundedRect(x, y, partSize, partSize, isHead ? partSize * 0.42 : partSize * 0.34);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundedRect(x + partSize * 0.18, y + partSize * 0.14, partSize * 0.32, partSize * 0.14, partSize * 0.07);
  ctx.fill();
  if (!isHead) drawSkinPattern(skin, x, y, partSize, index);

  if (isHead) {
    const forward = dir || dirs.right;
    const side = { x: -forward.y, y: forward.x };
    const eyeForward = partSize * 0.2;
    const eyeSide = partSize * 0.18;
    const eyeRadius = Math.max(1.8, partSize * 0.09);
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
    ctx.lineWidth = Math.max(1, partSize * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(center.x + forward.x * partSize * 0.42, center.y + forward.y * partSize * 0.42);
    ctx.lineTo(
      center.x + forward.x * partSize * 0.62 + side.x * partSize * 0.15,
      center.y + forward.y * partSize * 0.62 + side.y * partSize * 0.15,
    );
    ctx.moveTo(center.x + forward.x * partSize * 0.42, center.y + forward.y * partSize * 0.42);
    ctx.lineTo(
      center.x + forward.x * partSize * 0.62 - side.x * partSize * 0.15,
      center.y + forward.y * partSize * 0.62 - side.y * partSize * 0.15,
    );
    ctx.stroke();
  }

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

function drawFood(food, cell) {
  const image = getFoodImage(food.asset);
  const centerX = food.x * cell + cell / 2;
  const centerY = food.y * cell + cell / 2;
  const isGold = food.value > 10;
  const imageSize = cell * (isGold ? 1.18 : 1.06);

  ctx.save();
  ctx.shadowBlur = isGold ? 20 : 14;
  ctx.shadowColor = isGold ? "#facc15" : "#ffd166";
  if (image) {
    ctx.drawImage(image, centerX - imageSize / 2, centerY - imageSize / 2, imageSize, imageSize);
  } else {
    ctx.fillStyle = isGold ? "#facc15" : "#ffd166";
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * (isGold ? 0.48 : 0.38), 0, Math.PI * 2);
    ctx.fill();
  }

  if (isGold) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.66)";
    ctx.lineWidth = Math.max(1.2, cell * 0.045);
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnake(snake, isPlayer = false) {
  const cell = size / grid;
  const skin = isPlayer ? selectedSkin.value : getSnakeSkinById(snake.skinId);
  const dir = isPlayer ? direction : dirs[snake.dir];
  [...snake.body].reverse().forEach((part, reversedIndex) => {
    drawSnakePart(part, snake.body.length - 1 - reversedIndex, cell, skin, dir);
  });
}

function draw() {
  if (!ctx) return;
  const cell = size / grid;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(83, 243, 255, 0.06)";
  for (let i = 0; i <= grid; i += 1) {
    const pos = i * cell;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  foods.forEach((food) => drawFood(food, cell));
  drawSnake(player, true);
  aiSnakes.forEach((snake) => drawSnake(snake));
  ctx.shadowBlur = 0;
}

function loop(time) {
  if (time - lastTick > Math.max(82, 138 - score.value * 0.04)) {
    step();
    draw();
    lastTick = time;
  }
  loopId = requestAnimationFrame(loop);
}

function resize() {
  const parent = canvas.value.parentElement;
  const displaySize = Math.min(parent.clientWidth - 12, parent.clientHeight - 12, 620);
  canvas.value.style.width = `${displaySize}px`;
  canvas.value.style.height = `${displaySize}px`;
}

function togglePause() {
  if (gameOver) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续争夺能量核心";
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
  canvas.value.width = size;
  canvas.value.height = size;
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
    game-id="snake-arena"
    :score="score"
    :best="best"
    :status="status"
    :paused="paused"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
  >
    <section class="game-panel split-panel">
      <div
        class="board-shell"
        @click="gameOver && restart()"
        @touchstart.passive="swipe.onTouchStart"
        @touchend.passive="swipe.onTouchEnd"
        @touchmove.prevent
      >
        <canvas ref="canvas" class="canvas-board arena-canvas" aria-label="贪吃蛇大作战游戏画布"></canvas>
      </div>
      <aside class="control-panel arena-side-panel">
        <details class="arena-drawer">
          <summary>
            <Gamepad2 :size="18" />
            <span>操作</span>
            <ChevronDown class="drawer-chevron" :size="17" />
          </summary>
          <div class="d-pad">
            <button class="up" type="button" aria-label="向上" @click="setDirection('up')">↑</button>
            <button class="left" type="button" aria-label="向左" @click="setDirection('left')">←</button>
            <button class="center" type="button" :aria-label="paused ? '继续' : '暂停'" @click="togglePause">
              {{ paused ? "▶" : "Ⅱ" }}
            </button>
            <button class="right" type="button" aria-label="向右" @click="setDirection('right')">→</button>
            <button class="down" type="button" aria-label="向下" @click="setDirection('down')">↓</button>
          </div>
        </details>

        <details class="arena-drawer">
          <summary>
            <Settings :size="18" />
            <span>皮肤</span>
            <ChevronDown class="drawer-chevron" :size="17" />
          </summary>
          <div class="arena-skin-grid" role="list" aria-label="贪吃蛇大作战皮肤">
            <button
              v-for="skin in SNAKE_SKINS"
              :key="skin.id"
              class="arena-skin-option"
              :class="{ active: selectedSkinId === skin.id }"
              :style="{ '--skin': skin.body, '--skin-alt': skin.bodyAlt, '--skin-glow': skin.glow }"
              type="button"
              role="listitem"
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
.arena-canvas {
  aspect-ratio: 1;
}

.arena-side-panel {
  gap: 10px;
  overflow: visible;
  padding: 0;
  border: 0;
  background: transparent;
}

.arena-drawer {
  overflow: hidden;
  border: 1px solid rgba(145, 235, 255, 0.2);
  border-radius: var(--radius);
  background: rgba(7, 13, 27, 0.76);
}

.arena-drawer > summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  min-height: 46px;
  padding: 0 12px;
  color: var(--text);
  cursor: pointer;
  font-weight: 900;
  list-style: none;
}

.arena-drawer > summary::-webkit-details-marker {
  display: none;
}

.arena-drawer > summary svg {
  color: var(--cyan);
}

.arena-drawer > summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-chevron {
  transition: transform 0.18s ease;
}

.arena-drawer[open] .drawer-chevron {
  transform: rotate(180deg);
}

.arena-drawer .d-pad,
.arena-skin-grid {
  margin: 0 12px 12px;
}

.arena-skin-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  max-height: 226px;
  overflow: auto;
  overscroll-behavior: contain;
}

.arena-skin-option {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  min-width: 0;
  padding: 3px;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--skin), transparent 82%), rgba(5, 10, 22, 0.62)),
    rgba(6, 13, 28, 0.74);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.arena-skin-option:hover,
.arena-skin-option.active {
  border-color: color-mix(in srgb, var(--skin), white 18%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--skin-glow), transparent 72%);
}

.arena-skin-option:hover {
  transform: translateY(-1px);
}

.arena-skin-option img {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-glow), transparent 58%);
}

@media (max-width: 860px) {
  .arena-side-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    max-height: none;
  }

  .arena-drawer {
    min-width: 0;
  }

  .arena-drawer > summary {
    min-height: 38px;
    padding: 0 9px;
    gap: 6px;
    font-size: 0.88rem;
  }

  .arena-drawer .d-pad,
  .arena-skin-grid {
    margin: 0 9px 9px;
  }

  .arena-skin-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    max-height: min(30svh, 180px);
  }
}

@media (max-width: 430px), (max-height: 720px) {
  .arena-side-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .arena-skin-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
