<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { createSwipeHandlers } from "../utils/touch";
import { getBestScore, setBestScore } from "../utils/storage";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("snake-arena"));
const status = ref("争夺能量核心");
const paused = ref(false);

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
    color: "#53f3ff",
  };
  aiSnakes = [
    { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], dir: "right", color: "#ff4fd8", respawn: 0 },
    { body: [{ x: 22, y: 8 }, { x: 23, y: 8 }, { x: 24, y: 8 }], dir: "left", color: "#ffd166", respawn: 0 },
    { body: [{ x: 8, y: 23 }, { x: 8, y: 24 }, { x: 8, y: 25 }], dir: "up", color: "#7dff6f", respawn: 0 },
  ];
  foods = [];
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

function drawSnake(snake, isPlayer = false) {
  const cell = size / grid;
  snake.body.forEach((part, index) => {
    ctx.shadowBlur = index === 0 ? 18 : 9;
    ctx.shadowColor = snake.color;
    ctx.fillStyle = index === 0 && isPlayer ? "#ecfeff" : snake.color;
    ctx.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
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

  foods.forEach((food) => {
    ctx.shadowBlur = 16;
    ctx.shadowColor = food.value > 10 ? "#ff4fd8" : "#ffd166";
    ctx.fillStyle = food.value > 10 ? "#ff4fd8" : "#ffd166";
    ctx.beginPath();
    ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
  });
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
  const displaySize = Math.min(canvas.value.parentElement.clientWidth - 24, 620);
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
      <aside class="control-panel">
        <h2>操作</h2>
        <p>方向键或 WASD 控制蓝白蛇，收集能量核心并避开 AI 蛇群。</p>
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

<style scoped>
.arena-canvas {
  aspect-ratio: 1;
}
</style>
