<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const width = 13;
const height = 13;
const directions = {
  up: { x: 0, y: -1, mark: "▲" },
  down: { x: 0, y: 1, mark: "▼" },
  left: { x: -1, y: 0, mark: "◀" },
  right: { x: 1, y: 0, mark: "▶" },
};

const walls = ref(new Set());
const player = ref({ x: 6, y: 11, dir: "up", alive: true });
const enemies = ref([]);
const bullets = ref([]);
const score = ref(0);
const best = ref(getBestScore("tank-battle"));
const status = ref("摧毁所有敌方坦克");
const paused = ref(false);
let timer = 0;

const cells = computed(() => {
  const result = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = toKey(x, y);
      const enemy = enemies.value.find((item) => item.x === x && item.y === y);
      const bullet = bullets.value.find((item) => item.x === x && item.y === y);
      result.push({
        key,
        wall: walls.value.has(key),
        player: player.value.alive && player.value.x === x && player.value.y === y,
        playerDir: player.value.dir,
        enemy,
        bullet,
      });
    }
  }
  return result;
});

function toKey(x, y) {
  return `${x},${y}`;
}

function isBlocked(x, y) {
  return (
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height ||
    walls.value.has(toKey(x, y)) ||
    enemies.value.some((enemy) => enemy.x === x && enemy.y === y) ||
    (player.value.alive && player.value.x === x && player.value.y === y)
  );
}

function restart() {
  walls.value = new Set([
    "2,2",
    "3,2",
    "9,2",
    "10,2",
    "5,4",
    "6,4",
    "7,4",
    "2,6",
    "3,6",
    "9,6",
    "10,6",
    "5,8",
    "6,8",
    "7,8",
    "1,10",
    "11,10",
  ]);
  player.value = { x: 6, y: 11, dir: "up", alive: true };
  enemies.value = [
    { id: 1, x: 1, y: 1, dir: "down", cooldown: 2 },
    { id: 2, x: 6, y: 1, dir: "down", cooldown: 4 },
    { id: 3, x: 11, y: 1, dir: "down", cooldown: 6 },
  ];
  bullets.value = [];
  score.value = 0;
  paused.value = false;
  status.value = "摧毁所有敌方坦克";
}

function movePlayer(dir) {
  if (paused.value || !player.value.alive) return;
  player.value.dir = dir;
  const delta = directions[dir];
  const next = { x: player.value.x + delta.x, y: player.value.y + delta.y };
  if (isBlocked(next.x, next.y)) return;
  player.value.x = next.x;
  player.value.y = next.y;
}

function shoot(owner = "player", origin = player.value) {
  if (paused.value) return;
  const delta = directions[origin.dir];
  const x = origin.x + delta.x;
  const y = origin.y + delta.y;
  if (x < 0 || y < 0 || x >= width || y >= height || walls.value.has(toKey(x, y))) return;
  bullets.value.push({
    id: Date.now() + Math.random(),
    x,
    y,
    dx: delta.x,
    dy: delta.y,
    owner,
  });
}

function updateBullets() {
  const nextBullets = [];
  bullets.value.forEach((bullet) => {
    const next = { ...bullet, x: bullet.x + bullet.dx, y: bullet.y + bullet.dy };
    const key = toKey(next.x, next.y);
    if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height || walls.value.has(key)) return;

    const enemyIndex = enemies.value.findIndex((enemy) => enemy.x === next.x && enemy.y === next.y);
    if (bullet.owner === "player" && enemyIndex >= 0) {
      enemies.value.splice(enemyIndex, 1);
      score.value += 100;
      best.value = setBestScore("tank-battle", score.value);
      return;
    }

    if (bullet.owner === "enemy" && player.value.alive && player.value.x === next.x && player.value.y === next.y) {
      player.value.alive = false;
      status.value = "基地失守，点击重开";
      return;
    }

    nextBullets.push(next);
  });
  bullets.value = nextBullets;
}

function enemyStep(enemy) {
  enemy.cooldown -= 1;
  if (enemy.cooldown <= 0) {
    enemy.cooldown = 4 + Math.floor(Math.random() * 5);
    shoot("enemy", enemy);
  }
  if (Math.random() < 0.42) {
    const choices = Object.keys(directions);
    enemy.dir = choices[Math.floor(Math.random() * choices.length)];
  }
  const delta = directions[enemy.dir];
  const nx = enemy.x + delta.x;
  const ny = enemy.y + delta.y;
  if (!isBlocked(nx, ny)) {
    enemy.x = nx;
    enemy.y = ny;
  }
}

function tick() {
  if (paused.value || !player.value.alive) return;
  updateBullets();
  enemies.value.forEach(enemyStep);
  if (!enemies.value.length) {
    status.value = "清场完成";
    best.value = setBestScore("tank-battle", score.value + 300);
    paused.value = true;
  }
}

function togglePause() {
  if (!player.value.alive) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续突袭";
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
    shoot();
  }
}

onMounted(() => {
  restart();
  window.addEventListener("keydown", onKey);
  timer = window.setInterval(tick, 260);
});

onUnmounted(() => {
  window.clearInterval(timer);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <GameLayout
    game-id="tank-battle"
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
        <div class="tank-board">
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="tank-cell"
            :class="{ wall: cell.wall, player: cell.player, enemy: cell.enemy, bullet: cell.bullet }"
          >
            <span v-if="cell.player">{{ directions[cell.playerDir].mark }}</span>
            <span v-else-if="cell.enemy">{{ directions[cell.enemy.dir].mark }}</span>
            <span v-else-if="cell.bullet">•</span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>方向键或 WASD 移动，空格开火。移动端使用方向键和发射键。</p>
        <button class="pill-button primary" type="button" @click="shoot()">发射</button>
        <div class="d-pad">
          <button class="up" type="button" @click="movePlayer('up')">↑</button>
          <button class="left" type="button" @click="movePlayer('left')">←</button>
          <button class="center" type="button" @click="shoot()">●</button>
          <button class="right" type="button" @click="movePlayer('right')">→</button>
          <button class="down" type="button" @click="movePlayer('down')">↓</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.tank-board {
  display: grid;
  width: min(88vw, 560px);
  aspect-ratio: 1;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
  padding: 8px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.tank-cell {
  display: grid;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.08);
  border-radius: 4px;
  background: rgba(12, 25, 49, 0.56);
  color: var(--cyan);
  font-size: clamp(0.82rem, 3vw, 1.35rem);
  font-weight: 900;
}

.tank-cell.wall {
  background: linear-gradient(135deg, #3b2f16, #14213d);
  box-shadow: inset 0 0 12px rgba(234, 179, 8, 0.18);
}

.tank-cell.player {
  color: #53f3ff;
  text-shadow: 0 0 14px rgba(83, 243, 255, 0.85);
}

.tank-cell.enemy {
  color: #fb7185;
  text-shadow: 0 0 14px rgba(251, 113, 133, 0.85);
}

.tank-cell.bullet {
  color: #ffd166;
}
</style>
