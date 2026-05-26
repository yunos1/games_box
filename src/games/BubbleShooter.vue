<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const rows = 11;
const cols = 10;
const colors = ["#53f3ff", "#ff4fd8", "#ffd166", "#7dff6f", "#a78bfa"];

const board = ref([]);
const gridRef = ref(null);
const current = ref(0);
const next = ref(1);
const score = ref(0);
const best = ref(getBestScore("bubble-shooter"));
const moves = ref(0);
const status = ref("点击任意列发射泡泡");
const finished = ref(false);
const aimCol = ref(Math.floor(cols / 2));
const launcherX = ref(50);

const remaining = computed(() => board.value.flat().filter((item) => item !== null).length);

function randomColor() {
  return Math.floor(Math.random() * colors.length);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function activeColorIndexes(source = board.value) {
  return [...new Set(source.flat().filter((item) => item !== null))];
}

function randomPlayableColor(activeColors = activeColorIndexes()) {
  const pool = activeColors.length ? activeColors : colors.map((_, index) => index);
  return pool[Math.floor(Math.random() * pool.length)];
}

function advanceQueue(activeColors = activeColorIndexes()) {
  if (!activeColors.length) return false;
  current.value = activeColors.includes(next.value) ? next.value : randomPlayableColor(activeColors);
  next.value = randomPlayableColor(activeColors);
  return true;
}

function colorValue(index) {
  return index === null ? "transparent" : colors[index];
}

function refreshBoard() {
  board.value = board.value.map((row) => [...row]);
}

function aimAtColumn(col) {
  aimCol.value = clamp(col, 0, cols - 1);
  launcherX.value = ((aimCol.value + 0.5) / cols) * 100;
}

function updateAimFromPointer(event) {
  const grid = gridRef.value;
  if (!grid || typeof event.clientX !== "number") return aimCol.value;
  const rect = grid.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width);
  const percent = rect.width ? (x / rect.width) * 100 : 50;
  const col = rect.width ? Math.floor((x / rect.width) * cols) : aimCol.value;
  aimCol.value = clamp(col, 0, cols - 1);
  launcherX.value = clamp(percent, 4, 96);
  return aimCol.value;
}

function moveLauncher(event) {
  updateAimFromPointer(event);
}

function shootFromColumn(col, event) {
  if (event?.clientX) updateAimFromPointer(event);
  else aimAtColumn(col);
  shoot(col);
}

function restart() {
  board.value = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, () => (row < 5 ? randomColor() : null)),
  );
  const activeColors = activeColorIndexes();
  current.value = randomPlayableColor(activeColors);
  next.value = randomPlayableColor(activeColors);
  score.value = 0;
  moves.value = 0;
  finished.value = false;
  aimAtColumn(Math.floor(cols / 2));
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

  refreshBoard();

  const activeColors = activeColorIndexes();
  if (!activeColors.length) {
    finished.value = true;
    score.value += 500;
    best.value = setBestScore("bubble-shooter", score.value);
    status.value = "全清完成";
    return;
  }

  if (board.value[rows - 1].some((value) => value !== null)) {
    finished.value = true;
    best.value = setBestScore("bubble-shooter", score.value);
    status.value = "泡泡触底";
    return;
  }

  advanceQueue(activeColors);
}

restart();
</script>

<template>
  <GameLayout
    class="bubble-layout"
    game-id="bubble-shooter"
    :score="score"
    :best="best"
    :moves="moves"
    :status="status"
    @restart="restart"
  >
    <section class="game-panel split-panel bubble-panel">
      <div class="board-shell bubble-board-shell">
        <div class="bubble-stage" :style="{ '--launcher-x': `${launcherX}%` }" @pointermove="moveLauncher" @pointerdown="moveLauncher">
          <span class="bubble-aim-line" aria-hidden="true"></span>
          <div ref="gridRef" class="bubble-grid">
            <div v-for="(row, rowIndex) in board" :key="rowIndex" class="bubble-row" :class="{ odd: rowIndex % 2 }">
              <button
                v-for="(bubble, colIndex) in row"
                :key="`${rowIndex}-${colIndex}`"
                class="bubble-cell"
                :class="{ empty: bubble === null }"
                type="button"
                :style="{ '--bubble-color': colorValue(bubble) }"
                :aria-label="`发射到第 ${colIndex + 1} 列`"
                @click="shootFromColumn(colIndex, $event)"
              >
                <span v-if="bubble !== null"></span>
              </button>
            </div>
          </div>
          <div class="bubble-launcher">
            <div class="bubble-launcher-head">
              <span class="launcher-line"></span>
              <span class="bubble-preview" :style="{ '--bubble-color': colorValue(current) }"></span>
            </div>
          </div>
        </div>
      </div>
      <aside class="control-panel bubble-control-panel">
        <div class="bubble-control-title">
          <h2>发射器</h2>
          <span>当前 / 下一颗</span>
        </div>
        <div class="bubble-swatches" aria-label="当前和下一颗泡泡">
          <span class="bubble-preview large" :style="{ '--bubble-color': colorValue(current) }"></span>
          <span class="bubble-preview" :style="{ '--bubble-color': colorValue(next) }"></span>
        </div>
        <button class="pill-button primary bubble-reset-button" type="button" @click="restart">重新布阵</button>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
:global(.bubble-layout .game-content) {
  padding: 10px;
}

.bubble-stage {
  --launcher-x: 50%;
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 72px;
  align-items: stretch;
  gap: 10px;
  justify-items: center;
  width: 100%;
  height: 100%;
  padding: 8px;
  touch-action: none;
}

.bubble-grid {
  display: grid;
  align-content: start;
  gap: clamp(3px, 1.1vmin, 5px);
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
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
  gap: clamp(3px, 1.1vmin, 5px);
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
  touch-action: manipulation;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
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
  position: relative;
  width: 100%;
  max-width: 620px;
  height: 72px;
  margin: 0 auto;
}

.bubble-launcher-head {
  position: absolute;
  left: var(--launcher-x);
  top: 0;
  display: grid;
  place-items: center;
  gap: 7px;
  transform: translateX(-50%);
  transition: left 0.08s ease-out;
}

.bubble-aim-line {
  position: absolute;
  left: var(--launcher-x);
  bottom: 56px;
  z-index: 2;
  width: 2px;
  height: calc(100% - 74px);
  border-radius: 999px;
  background: linear-gradient(rgba(83, 243, 255, 0.05), rgba(83, 243, 255, 0.92));
  box-shadow:
    0 0 12px rgba(83, 243, 255, 0.72),
    0 0 28px rgba(83, 243, 255, 0.24);
  pointer-events: none;
  transform: translateX(-50%);
  transition: left 0.08s ease-out;
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

.control-panel.bubble-control-panel {
  grid-template-columns: minmax(72px, 0.8fr) auto minmax(92px, 120px);
  align-items: center;
  align-content: center;
  gap: 10px;
  overflow: visible;
  padding: 10px;
}

.bubble-control-title {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.bubble-control-title h2 {
  margin: 0;
  overflow: hidden;
  font-size: 0.98rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bubble-control-title span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bubble-swatches {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.bubble-control-panel .bubble-preview {
  width: 30px;
}

.bubble-control-panel .bubble-preview.large {
  width: 44px;
}

.bubble-reset-button {
  min-height: 38px;
  min-width: 0;
  padding: 7px 10px;
  white-space: nowrap;
}

@media (max-width: 860px) {
  :global(.bubble-layout.game-shell) {
    padding: 0;
  }

  :global(.bubble-layout .game-frame) {
    border-radius: 0;
  }

  :global(.bubble-layout .game-content) {
    padding: 4px;
  }

  .bubble-panel.split-panel {
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 4px;
  }

  .bubble-board-shell {
    height: 100%;
    padding: 2px;
  }

  .bubble-stage {
    grid-template-rows: minmax(0, 1fr) 58px;
    gap: 4px;
    padding: 2px;
  }

  .bubble-grid {
    padding: 6px;
  }

  .bubble-launcher {
    height: 58px;
  }

  .bubble-aim-line {
    bottom: 44px;
    height: calc(100% - 56px);
  }

  .launcher-line {
    height: 32px;
  }

  .bubble-launcher-head {
    gap: 4px;
  }

  .control-panel.bubble-control-panel {
    grid-template-columns: minmax(66px, 0.85fr) auto minmax(84px, 104px);
    max-height: none;
    padding: 8px;
    border-radius: 10px;
  }

  .bubble-control-title h2 {
    font-size: 0.92rem;
  }

  .bubble-control-title span {
    font-size: 0.66rem;
  }

  .bubble-control-panel .bubble-preview {
    width: 26px;
  }

  .bubble-control-panel .bubble-preview.large {
    width: 38px;
  }

  .bubble-reset-button {
    min-height: 34px;
    padding: 6px 8px;
    font-size: 0.82rem;
  }
}

@media (max-width: 430px), (max-height: 720px) {
  .bubble-panel.split-panel {
    grid-template-rows: minmax(0, 1fr) auto;
  }
}
</style>
