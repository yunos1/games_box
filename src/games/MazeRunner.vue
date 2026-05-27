<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";
import { createSwipeHandlers } from "../utils/touch";

const size = 17;
const walls = ref(new Set());
const player = ref({ x: 1, y: 1 });
const exit = { x: size - 2, y: size - 2 };
const moves = ref(0);
const best = ref(getBestScore("maze-runner"));
const status = ref("寻找星门出口");
const finished = ref(false);

const score = computed(() => (finished.value ? Math.max(100, 1000 - moves.value * 8) : Math.max(0, 400 - moves.value * 2)));
const cells = computed(() => {
  const result = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.abs(player.value.x - x) + Math.abs(player.value.y - y);
      result.push({
        key: toKey(x, y),
        wall: walls.value.has(toKey(x, y)),
        player: player.value.x === x && player.value.y === y,
        exit: exit.x === x && exit.y === y,
        visible: distance <= 5 || finished.value,
      });
    }
  }
  return result;
});

function toKey(x, y) {
  return `${x},${y}`;
}

function restart() {
  const maze = Array.from({ length: size }, () => Array(size).fill(true));
  const stack = [{ x: 1, y: 1 }];
  maze[1][1] = false;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = [
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
    ]
      .map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy, dx, dy }))
      .filter((next) => next.x > 0 && next.y > 0 && next.x < size - 1 && next.y < size - 1 && maze[next.y][next.x]);

    if (!choices.length) {
      stack.pop();
      continue;
    }
    const next = choices[Math.floor(Math.random() * choices.length)];
    maze[current.y + next.dy / 2][current.x + next.dx / 2] = false;
    maze[next.y][next.x] = false;
    stack.push({ x: next.x, y: next.y });
  }

  walls.value = new Set();
  maze.forEach((row, y) => {
    row.forEach((wall, x) => {
      if (wall) walls.value.add(toKey(x, y));
    });
  });
  player.value = { x: 1, y: 1 };
  moves.value = 0;
  finished.value = false;
  status.value = "寻找星门出口";
}

function move(direction) {
  if (finished.value) return;
  const dirs = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const [dx, dy] = dirs[direction];
  const nx = player.value.x + dx;
  const ny = player.value.y + dy;
  if (walls.value.has(toKey(nx, ny))) return;
  player.value = { x: nx, y: ny };
  moves.value += 1;
  if (nx === exit.x && ny === exit.y) {
    finished.value = true;
    status.value = "星门抵达";
    best.value = setBestScore("maze-runner", score.value);
  } else {
    status.value = "继续探索";
  }
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
  if (!map[event.key]) return;
  event.preventDefault();
  move(map[event.key]);
}

const swipe = createSwipeHandlers(move);

onMounted(() => {
  restart();
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <GameLayout game-id="maze-runner" :score="score" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd" @touchmove.prevent>
        <div class="maze-board">
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="maze-cell"
            :class="{ wall: cell.wall, player: cell.player, exit: cell.exit, hidden: !cell.visible }"
          >
            <span v-if="cell.player">◆</span>
            <span v-else-if="cell.exit">◎</span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>方向键或 WASD 移动，移动端可在迷宫区域滑动。视野会围绕当前位置展开。</p>
        <div class="d-pad">
          <button class="up" type="button" @click="move('up')">↑</button>
          <button class="left" type="button" @click="move('left')">←</button>
          <button class="center" type="button" @click="restart">•</button>
          <button class="right" type="button" @click="move('right')">→</button>
          <button class="down" type="button" @click="move('down')">↓</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.maze-board {
  display: grid;
  width: min(88vw, 560px);
  aspect-ratio: 1;
  grid-template-columns: repeat(17, 1fr);
  grid-template-rows: repeat(17, 1fr);
  gap: 2px;
  padding: 8px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.maze-cell {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  place-items: center;
  border-radius: 3px;
  background: rgba(12, 25, 49, 0.62);
  color: #60a5fa;
  font-size: clamp(0.6rem, 2vw, 1rem);
  font-weight: 900;
  line-height: 1;
}

.maze-cell > span {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  line-height: 1;
}

.maze-cell.wall {
  background: #172033;
  box-shadow: inset 0 0 8px rgba(96, 165, 250, 0.14);
}

.maze-cell.player {
  color: #ffd166;
  text-shadow: 0 0 12px rgba(255, 209, 102, 0.8);
}

.maze-cell.exit {
  color: #7dff6f;
}

.maze-cell.hidden {
  filter: brightness(0.25);
}
</style>
