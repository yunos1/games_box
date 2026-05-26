<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const cols = 10;
const rows = 20;
const colors = {
  I: "#53f3ff",
  O: "#ffd166",
  T: "#a78bfa",
  S: "#7dff6f",
  Z: "#ff5c7c",
  J: "#38bdf8",
  L: "#f97316",
};
const shapes = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const board = ref([]);
const current = ref(null);
const nextType = ref("I");
const score = ref(0);
const best = ref(getBestScore("tetris"));
const lineCount = ref(0);
const status = ref("堆叠消行");
const paused = ref(false);
const finished = ref(false);
let timer = 0;

const cells = computed(() => {
  const view = board.value.map((row) => row.map((value) => value));
  if (current.value) {
    current.value.shape.forEach((row, y) => {
      row.forEach((filled, x) => {
        if (!filled) return;
        const bx = current.value.x + x;
        const by = current.value.y + y;
        if (by >= 0 && by < rows && bx >= 0 && bx < cols) view[by][bx] = current.value.type;
      });
    });
  }
  return view.flat();
});

const speed = computed(() => Math.max(120, 620 - lineCount.value * 18));

function emptyBoard() {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
}

function randomType() {
  const keys = Object.keys(shapes);
  return keys[Math.floor(Math.random() * keys.length)];
}

function makePiece(type) {
  return {
    type,
    shape: shapes[type].map((row) => [...row]),
    x: Math.floor(cols / 2) - 2,
    y: 0,
  };
}

function collide(piece = current.value, dx = 0, dy = 0, shape = piece.shape) {
  return shape.some((row, y) =>
    row.some((filled, x) => {
      if (!filled) return false;
      const bx = piece.x + x + dx;
      const by = piece.y + y + dy;
      return bx < 0 || bx >= cols || by >= rows || (by >= 0 && board.value[by][bx]);
    }),
  );
}

function spawn() {
  current.value = makePiece(nextType.value);
  nextType.value = randomType();
  if (collide()) {
    finished.value = true;
    status.value = "堆叠到顶";
    best.value = setBestScore("tetris", score.value);
  }
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotate() {
  if (paused.value || finished.value) return;
  const rotated = rotateMatrix(current.value.shape);
  if (!collide(current.value, 0, 0, rotated)) current.value.shape = rotated;
}

function move(dx, dy) {
  if (paused.value || finished.value) return false;
  if (collide(current.value, dx, dy)) return false;
  current.value.x += dx;
  current.value.y += dy;
  return true;
}

function clearLines() {
  let cleared = 0;
  board.value = board.value.filter((row) => {
    const full = row.every(Boolean);
    if (full) cleared += 1;
    return !full;
  });
  while (board.value.length < rows) board.value.unshift(Array(cols).fill(""));
  if (cleared) {
    lineCount.value += cleared;
    score.value += [0, 100, 300, 500, 800][cleared] || cleared * 220;
    best.value = setBestScore("tetris", score.value);
    status.value = `消除 ${cleared} 行`;
  }
}

function lockPiece() {
  current.value.shape.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) return;
      const bx = current.value.x + x;
      const by = current.value.y + y;
      if (by >= 0 && by < rows && bx >= 0 && bx < cols) board.value[by][bx] = current.value.type;
    });
  });
  clearLines();
  spawn();
}

function tick() {
  if (paused.value || finished.value) return;
  if (!move(0, 1)) lockPiece();
}

function hardDrop() {
  if (paused.value || finished.value) return;
  while (move(0, 1)) score.value += 1;
  lockPiece();
}

function restart() {
  board.value = emptyBoard();
  score.value = 0;
  lineCount.value = 0;
  status.value = "堆叠消行";
  paused.value = false;
  finished.value = false;
  nextType.value = randomType();
  spawn();
}

function togglePause() {
  if (finished.value) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续堆叠";
}

function onKey(event) {
  const map = {
    ArrowLeft: () => move(-1, 0),
    a: () => move(-1, 0),
    ArrowRight: () => move(1, 0),
    d: () => move(1, 0),
    ArrowDown: () => move(0, 1),
    s: () => move(0, 1),
    ArrowUp: rotate,
    w: rotate,
    " ": hardDrop,
    p: togglePause,
  };
  const action = map[event.key];
  if (!action) return;
  event.preventDefault();
  action();
}

onMounted(() => {
  restart();
  window.addEventListener("keydown", onKey);
  timer = window.setInterval(tick, speed.value);
});

onUnmounted(() => {
  window.clearInterval(timer);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <GameLayout
    game-id="tetris"
    :score="score"
    :best="best"
    :moves="lineCount"
    :status="status"
    :paused="paused"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
  >
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="tetris-board">
          <div
            v-for="(cell, index) in cells"
            :key="index"
            class="tetris-cell"
            :class="{ filled: cell }"
            :style="{ '--block': cell ? colors[cell] : 'transparent' }"
          ></div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>方向键移动，↑ 旋转，空格硬降，P 暂停。下一块：{{ nextType }}</p>
        <div class="d-pad">
          <button class="up" type="button" @click="rotate">↻</button>
          <button class="left" type="button" @click="move(-1, 0)">←</button>
          <button class="center" type="button" @click="hardDrop">↓</button>
          <button class="right" type="button" @click="move(1, 0)">→</button>
          <button class="down" type="button" @click="move(0, 1)">↓</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.tetris-board {
  display: grid;
  width: min(72vw, 330px);
  aspect-ratio: 10 / 20;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
  padding: 8px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.tetris-cell {
  min-width: 0;
  border: 1px solid rgba(145, 235, 255, 0.08);
  border-radius: 3px;
  background: rgba(12, 25, 49, 0.52);
}

.tetris-cell.filled {
  background: var(--block);
  box-shadow: 0 0 14px color-mix(in srgb, var(--block), transparent 35%);
}

@media (max-width: 860px) {
  .tetris-board {
    width: auto;
    height: 100%;
    max-width: min(100%, 330px);
    max-height: 100%;
    gap: 2px;
    padding: 6px;
  }
}
</style>
