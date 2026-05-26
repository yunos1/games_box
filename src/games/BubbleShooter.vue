<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const rows = 11;
const cols = 10;
const colors = ["#53f3ff", "#ff4fd8", "#ffd166", "#7dff6f", "#a78bfa"];

const board = ref([]);
const current = ref(0);
const next = ref(1);
const score = ref(0);
const best = ref(getBestScore("bubble-shooter"));
const moves = ref(0);
const status = ref("点击任意列发射泡泡");
const finished = ref(false);

const remaining = computed(() => board.value.flat().filter((item) => item !== null).length);

function randomColor() {
  return Math.floor(Math.random() * colors.length);
}

function colorValue(index) {
  return index === null ? "transparent" : colors[index];
}

function refreshBoard() {
  board.value = board.value.map((row) => [...row]);
}

function restart() {
  board.value = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, () => (row < 5 ? randomColor() : null)),
  );
  current.value = randomColor();
  next.value = randomColor();
  score.value = 0;
  moves.value = 0;
  finished.value = false;
  status.value = "点击任意列发射泡泡";
}

function getNeighbors(row, col) {
  const diagonal = row % 2 === 0 ? [[-1, -1], [1, -1]] : [[-1, 1], [1, 1]];
  return [[-1, 0], [1, 0], [0, -1], [0, 1], ...diagonal]
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols);
}

function collectGroup(row, col, color) {
  const stack = [[row, col]];
  const seen = new Set([`${row},${col}`]);
  while (stack.length) {
    const [r, c] = stack.pop();
    getNeighbors(r, c).forEach(([nr, nc]) => {
      const key = `${nr},${nc}`;
      if (seen.has(key) || board.value[nr][nc] !== color) return;
      seen.add(key);
      stack.push([nr, nc]);
    });
  }
  return [...seen].map((key) => key.split(",").map(Number));
}

function dropFloating() {
  const anchored = new Set();
  const stack = [];
  board.value[0].forEach((value, col) => {
    if (value !== null) {
      anchored.add(`0,${col}`);
      stack.push([0, col]);
    }
  });
  while (stack.length) {
    const [row, col] = stack.pop();
    getNeighbors(row, col).forEach(([nr, nc]) => {
      const key = `${nr},${nc}`;
      if (anchored.has(key) || board.value[nr][nc] === null) return;
      anchored.add(key);
      stack.push([nr, nc]);
    });
  }
  let dropped = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (board.value[row][col] !== null && !anchored.has(`${row},${col}`)) {
        board.value[row][col] = null;
        dropped += 1;
      }
    }
  }
  return dropped;
}

function shoot(col) {
  if (finished.value) return;
  let hitRow = rows - 1;
  while (hitRow >= 0 && board.value[hitRow][col] === null) hitRow -= 1;
  const placeRow = hitRow + 1;
  if (placeRow >= rows) {
    status.value = "这一列已经触底";
    finished.value = true;
    best.value = setBestScore("bubble-shooter", score.value);
    return;
  }

  board.value[placeRow][col] = current.value;
  moves.value += 1;
  const group = collectGroup(placeRow, col, current.value);
  if (group.length >= 3) {
    group.forEach(([row, itemCol]) => {
      board.value[row][itemCol] = null;
    });
    const dropped = dropFloating();
    const gained = group.length * 30 + dropped * 45;
    score.value += gained;
    best.value = setBestScore("bubble-shooter", score.value);
    status.value = `消除 ${group.length} 个泡泡${dropped ? `，坠落 ${dropped} 个` : ""}`;
  } else {
    status.value = "继续寻找三连";
  }

  current.value = next.value;
  next.value = randomColor();
  refreshBoard();

  if (remaining.value === 0) {
    finished.value = true;
    score.value += 500;
    best.value = setBestScore("bubble-shooter", score.value);
    status.value = "全清完成";
  } else if (board.value[rows - 1].some((value) => value !== null)) {
    finished.value = true;
    best.value = setBestScore("bubble-shooter", score.value);
    status.value = "泡泡触底";
  }
}

restart();
</script>

<template>
  <GameLayout game-id="bubble-shooter" :score="score" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="bubble-stage">
          <div class="bubble-grid">
            <div v-for="(row, rowIndex) in board" :key="rowIndex" class="bubble-row" :class="{ odd: rowIndex % 2 }">
              <button
                v-for="(bubble, colIndex) in row"
                :key="`${rowIndex}-${colIndex}`"
                class="bubble-cell"
                :class="{ empty: bubble === null }"
                type="button"
                :style="{ '--bubble-color': colorValue(bubble) }"
                :aria-label="`发射到第 ${colIndex + 1} 列`"
                @click="shoot(colIndex)"
              >
                <span v-if="bubble !== null"></span>
              </button>
            </div>
          </div>
          <div class="bubble-launcher">
            <span class="launcher-line"></span>
            <span class="bubble-preview" :style="{ '--bubble-color': colorValue(current) }"></span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>发射器</h2>
        <p>当前泡泡</p>
        <div class="bubble-swatches">
          <span class="bubble-preview large" :style="{ '--bubble-color': colorValue(current) }"></span>
          <span class="bubble-preview" :style="{ '--bubble-color': colorValue(next) }"></span>
        </div>
        <p>点击目标列发射泡泡，三个及以上相连同色泡泡会被消除，悬空泡泡会一起坠落。</p>
        <button class="pill-button primary" type="button" @click="restart">重新布阵</button>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.bubble-stage {
  display: grid;
  gap: 14px;
  justify-items: center;
  width: min(92vw, 560px);
  padding: 14px;
}

.bubble-grid {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(145, 235, 255, 0.22);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at 50% 0%, rgba(83, 243, 255, 0.12), transparent 44%),
    rgba(3, 8, 18, 0.86);
}

.bubble-row {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 5px;
}

.bubble-row.odd {
  padding-left: clamp(10px, 3vw, 24px);
  padding-right: clamp(0px, 2vw, 12px);
}

.bubble-cell {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  min-width: 0;
  border: 1px solid rgba(145, 235, 255, 0.14);
  border-radius: 50%;
  background: rgba(12, 25, 49, 0.56);
  cursor: crosshair;
}

.bubble-cell span,
.bubble-preview {
  width: 82%;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.84), transparent 20%),
    var(--bubble-color);
  box-shadow:
    0 0 18px color-mix(in srgb, var(--bubble-color), transparent 26%),
    inset -8px -10px 16px rgba(0, 0, 0, 0.22);
}

.bubble-cell.empty {
  background: rgba(12, 25, 49, 0.28);
}

.bubble-cell.empty:hover {
  border-color: rgba(83, 243, 255, 0.72);
  box-shadow: inset 0 0 18px rgba(83, 243, 255, 0.13);
}

.bubble-launcher {
  display: grid;
  place-items: center;
  gap: 7px;
}

.launcher-line {
  width: 2px;
  height: 44px;
  background: linear-gradient(transparent, rgba(83, 243, 255, 0.95));
  box-shadow: 0 0 18px rgba(83, 243, 255, 0.85);
}

.bubble-preview {
  display: inline-block;
  width: 34px;
}

.bubble-preview.large {
  width: 52px;
}

.bubble-swatches {
  display: flex;
  align-items: center;
  gap: 14px;
}
</style>
