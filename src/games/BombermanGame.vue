<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const width = 13;
const height = 11;
const dirs = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const walls = ref(new Set());
const crates = ref(new Set());
const bombs = ref([]);
const blasts = ref(new Set());
const player = ref({ x: 1, y: 1, alive: true });
const enemies = ref([]);
const score = ref(0);
const best = ref(getBestScore("bomberman"));
const status = ref("清掉敌人和箱子");
const paused = ref(false);
let timer = 0;

const cells = computed(() => {
  const result = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = toKey(x, y);
      result.push({
        key,
        wall: walls.value.has(key),
        crate: crates.value.has(key),
        blast: blasts.value.has(key),
        bomb: bombs.value.find((bomb) => bomb.x === x && bomb.y === y),
        player: player.value.alive && player.value.x === x && player.value.y === y,
        enemy: enemies.value.find((enemy) => enemy.x === x && enemy.y === y),
      });
    }
  }
  return result;
});

function toKey(x, y) {
  return `${x},${y}`;
}

function buildWalls() {
  const next = new Set();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || (x % 2 === 0 && y % 2 === 0)) {
        next.add(toKey(x, y));
      }
    }
  }
  return next;
}

function restart() {
  walls.value = buildWalls();
  crates.value = new Set();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (walls.value.has(toKey(x, y))) continue;
      if ((x <= 2 && y <= 2) || (x === 11 && y === 9)) continue;
      if ((x * 7 + y * 5) % 3 !== 0) crates.value.add(toKey(x, y));
    }
  }
  bombs.value = [];
  blasts.value = new Set();
  player.value = { x: 1, y: 1, alive: true };
  enemies.value = [
    { id: 1, x: 11, y: 1, dir: "left" },
    { id: 2, x: 1, y: 9, dir: "right" },
    { id: 3, x: 11, y: 9, dir: "up" },
  ];
  score.value = 0;
  paused.value = false;
  status.value = "清掉敌人和箱子";
}

function isBlocked(x, y, includeBomb = true) {
  const key = toKey(x, y);
  return (
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height ||
    walls.value.has(key) ||
    crates.value.has(key) ||
    enemies.value.some((enemy) => enemy.x === x && enemy.y === y) ||
    (includeBomb && bombs.value.some((bomb) => bomb.x === x && bomb.y === y))
  );
}

function movePlayer(dir) {
  if (paused.value || !player.value.alive) return;
  const [dx, dy] = dirs[dir];
  const nx = player.value.x + dx;
  const ny = player.value.y + dy;
  if (isBlocked(nx, ny)) return;
  player.value.x = nx;
  player.value.y = ny;
  if (blasts.value.has(toKey(nx, ny))) lose();
}

function placeBomb() {
  if (paused.value || !player.value.alive) return;
  if (bombs.value.some((bomb) => bomb.x === player.value.x && bomb.y === player.value.y)) return;
  bombs.value.push({ x: player.value.x, y: player.value.y, timer: 8 });
}

function blastCells(origin) {
  const result = [toKey(origin.x, origin.y)];
  Object.values(dirs).forEach(([dx, dy]) => {
    for (let step = 1; step <= 2; step += 1) {
      const x = origin.x + dx * step;
      const y = origin.y + dy * step;
      const key = toKey(x, y);
      if (walls.value.has(key)) break;
      result.push(key);
      if (crates.value.has(key)) break;
    }
  });
  return result;
}

function explode(bomb) {
  const area = blastCells(bomb);
  blasts.value = new Set([...blasts.value, ...area]);
  area.forEach((key) => {
    if (crates.value.delete(key)) score.value += 10;
  });
  enemies.value = enemies.value.filter((enemy) => {
    const hit = area.includes(toKey(enemy.x, enemy.y));
    if (hit) score.value += 80;
    return !hit;
  });
  best.value = setBestScore("bomberman", score.value);
  if (area.includes(toKey(player.value.x, player.value.y))) lose();
  window.setTimeout(() => {
    blasts.value = new Set([...blasts.value].filter((key) => !area.includes(key)));
  }, 420);
}

function lose() {
  player.value.alive = false;
  status.value = "被爆风命中，点击重开";
}

function enemyStep(enemy) {
  if (Math.random() < 0.35) {
    const keys = Object.keys(dirs);
    enemy.dir = keys[Math.floor(Math.random() * keys.length)];
  }
  const [dx, dy] = dirs[enemy.dir];
  const nx = enemy.x + dx;
  const ny = enemy.y + dy;
  const key = toKey(nx, ny);
  if (!walls.value.has(key) && !crates.value.has(key) && !bombs.value.some((bomb) => bomb.x === nx && bomb.y === ny)) {
    enemy.x = nx;
    enemy.y = ny;
  }
  if (enemy.x === player.value.x && enemy.y === player.value.y) lose();
}

function tick() {
  if (paused.value || !player.value.alive) return;
  bombs.value.forEach((bomb) => {
    bomb.timer -= 1;
  });
  const exploding = bombs.value.filter((bomb) => bomb.timer <= 0);
  bombs.value = bombs.value.filter((bomb) => bomb.timer > 0);
  exploding.forEach(explode);
  enemies.value.forEach(enemyStep);
  if (!enemies.value.length) {
    status.value = "爆破完成";
    best.value = setBestScore("bomberman", score.value + 200);
    paused.value = true;
  }
}

function togglePause() {
  if (!player.value.alive) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续爆破";
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
  };
  if (map[event.key]) {
    event.preventDefault();
    movePlayer(map[event.key]);
  }
  if (event.key === " ") {
    event.preventDefault();
    placeBomb();
  }
}

onMounted(() => {
  restart();
  window.addEventListener("keydown", onKey);
  timer = window.setInterval(tick, 300);
});

onUnmounted(() => {
  window.clearInterval(timer);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <GameLayout
    game-id="bomberman"
    :score="score"
    :best="best"
    :status="status"
    :paused="paused"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
  >
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="bomber-board">
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="bomber-cell"
            :class="{ wall: cell.wall, crate: cell.crate, blast: cell.blast, bomb: cell.bomb, player: cell.player, enemy: cell.enemy }"
          >
            <span v-if="cell.player">◆</span>
            <span v-else-if="cell.enemy">▲</span>
            <span v-else-if="cell.bomb">●</span>
            <span v-else-if="cell.crate">■</span>
            <span v-else-if="cell.blast">✦</span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>方向键或 WASD 移动，空格放置炸弹。炸弹会在数拍后引爆。</p>
        <button class="pill-button primary" type="button" @click="placeBomb">放置炸弹</button>
        <div class="d-pad">
          <button class="up" type="button" @click="movePlayer('up')">↑</button>
          <button class="left" type="button" @click="movePlayer('left')">←</button>
          <button class="center" type="button" @click="placeBomb">●</button>
          <button class="right" type="button" @click="movePlayer('right')">→</button>
          <button class="down" type="button" @click="movePlayer('down')">↓</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.bomber-board {
  display: grid;
  width: min(92vw, 620px);
  aspect-ratio: 13 / 11;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
  padding: 8px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.bomber-cell {
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: rgba(12, 25, 49, 0.56);
  color: var(--text);
  font-size: clamp(0.78rem, 3vw, 1.35rem);
  font-weight: 900;
}

.bomber-cell.wall { background: #1f2937; }
.bomber-cell.crate { color: #f97316; background: rgba(86, 45, 17, 0.82); }
.bomber-cell.blast { color: #ffd166; background: rgba(251, 113, 133, 0.42); box-shadow: inset 0 0 16px rgba(255, 209, 102, 0.26); }
.bomber-cell.bomb { color: #fb7185; }
.bomber-cell.player { color: #53f3ff; text-shadow: 0 0 14px rgba(83, 243, 255, 0.82); }
.bomber-cell.enemy { color: #ff4fd8; text-shadow: 0 0 14px rgba(255, 79, 216, 0.82); }
</style>
