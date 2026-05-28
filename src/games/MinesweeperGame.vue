<script setup>
import { computed, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const levels = {
  easy: { label: "初级", rows: 20, cols: 9, mines: 22 },
  normal: { label: "中级", rows: 22, cols: 10, mines: 36 },
  hard: { label: "高级", rows: 24, cols: 12, mines: 52 },
};

const level = ref("easy");
const cells = ref([]);
const initialized = ref(false);
const status = ref("第一步不会踩雷");
const finished = ref(false);
const flags = ref(0);
const opened = ref(0);
const best = ref(getBestScore("minesweeper"));

const config = computed(() => levels[level.value]);
const remainingMines = computed(() => config.value.mines - flags.value);

function neighbors(index) {
  const { rows, cols } = config.value;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const result = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push(nr * cols + nc);
    }
  }
  return result;
}

function buildBoard(safeIndex) {
  const total = config.value.rows * config.value.cols;
  const mineSet = new Set();
  const forbidden = new Set([safeIndex, ...neighbors(safeIndex)]);
  while (mineSet.size < config.value.mines) {
    const index = Math.floor(Math.random() * total);
    if (!forbidden.has(index)) mineSet.add(index);
  }

  cells.value = Array.from({ length: total }, (_, index) => ({
    mine: mineSet.has(index),
    revealed: false,
    flagged: false,
    count: 0,
  }));

  cells.value.forEach((cell, index) => {
    if (!cell.mine) cell.count = neighbors(index).filter((next) => cells.value[next].mine).length;
  });
  initialized.value = true;
}

function restart() {
  clearPressState();
  const total = config.value.rows * config.value.cols;
  cells.value = Array.from({ length: total }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    count: 0,
  }));
  initialized.value = false;
  finished.value = false;
  flags.value = 0;
  opened.value = 0;
  status.value = "第一步不会踩雷";
}

function reveal(index) {
  if (finished.value) return;
  if (!initialized.value) buildBoard(index);
  const cell = cells.value[index];
  if (!cell || cell.flagged || cell.revealed) return;
  cell.revealed = true;
  opened.value += 1;

  if (cell.mine) {
    finished.value = true;
    cells.value.forEach((item) => {
      if (item.mine) item.revealed = true;
    });
    status.value = "触雷，任务失败";
    return;
  }

  if (cell.count === 0) {
    neighbors(index).forEach((next) => {
      if (!cells.value[next].revealed) reveal(next);
    });
  }

  const safeCount = config.value.rows * config.value.cols - config.value.mines;
  if (opened.value >= safeCount) {
    completeRun("排爆完成");
  } else {
    status.value = "继续扫描";
  }
}

function toggleFlag(index) {
  const cell = cells.value[index];
  if (finished.value || !cell || cell.revealed) return;
  cell.flagged = !cell.flagged;
  flags.value += cell.flagged ? 1 : -1;
  status.value = cell.flagged ? "已标记雷区" : "已取消标记";
  checkFlagVictory();
}

function onContext(event, index) {
  event.preventDefault();
  if (suppressNextClick) {
    scheduleSuppressClear();
    return;
  }
  toggleFlag(index);
}

let pressTimer = null;
let suppressClearTimer = null;
let longPressTriggered = false;
let suppressNextClick = false;

function completeRun(message) {
  finished.value = true;
  status.value = message;
  best.value = setBestScore("minesweeper", best.value + 1);
}

function checkFlagVictory() {
  if (!initialized.value || finished.value || flags.value !== config.value.mines) return;
  const perfectlyFlagged = cells.value.every((cell) => (cell.mine ? cell.flagged : !cell.flagged));
  if (perfectlyFlagged) completeRun("排爆完成");
}

function onCellClick(event, index) {
  if (suppressNextClick) {
    event.preventDefault();
    suppressNextClick = false;
    window.clearTimeout(suppressClearTimer);
    suppressClearTimer = null;
    return;
  }
  reveal(index);
}

function onPointerDown(event, index) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
  window.clearTimeout(pressTimer);
  longPressTriggered = false;
  pressTimer = window.setTimeout(() => {
    longPressTriggered = true;
    suppressNextClick = true;
    toggleFlag(index);
  }, 360);
}

function onPointerUp(event, index) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
  window.clearTimeout(pressTimer);
  suppressNextClick = true;
  scheduleSuppressClear();
  if (longPressTriggered) {
    longPressTriggered = false;
    return;
  }
  reveal(index);
}

function onPointerCancel() {
  window.clearTimeout(pressTimer);
  if (suppressNextClick) scheduleSuppressClear();
  longPressTriggered = false;
}

function scheduleSuppressClear() {
  window.clearTimeout(suppressClearTimer);
  suppressClearTimer = window.setTimeout(() => {
    suppressNextClick = false;
    suppressClearTimer = null;
  }, 800);
}

function clearPressState() {
  window.clearTimeout(pressTimer);
  window.clearTimeout(suppressClearTimer);
  pressTimer = null;
  suppressClearTimer = null;
  longPressTriggered = false;
  suppressNextClick = false;
}

function clearPressTimer() {
  clearPressState();
}

onUnmounted(clearPressTimer);

function switchLevel(key) {
  level.value = key;
  restart();
}

restart();
</script>

<template>
  <GameLayout
    game-id="minesweeper"
    :score="opened"
    :best="best"
    :status="status"
    @restart="restart"
  >
    <section class="game-panel split-panel mines-panel">
      <div class="board-shell mines-area">
        <div
          class="mine-board"
          :style="{
            '--board-ratio': config.cols / config.rows,
            gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
          }"
        >
          <button
            v-for="(cell, index) in cells"
            :key="index"
            class="mine-cell"
            :class="{ revealed: cell.revealed, flagged: cell.flagged, mine: cell.mine && cell.revealed }"
            type="button"
            @click="onCellClick($event, index)"
            @contextmenu="onContext($event, index)"
            @pointerdown="onPointerDown($event, index)"
            @pointerup="onPointerUp($event, index)"
            @pointercancel="onPointerCancel"
            @pointerleave="onPointerCancel"
          >
            <span v-if="cell.flagged && !cell.revealed" class="flag-icon">🚩</span>
            <span v-else-if="cell.revealed && cell.mine">✹</span>
            <span v-else-if="cell.revealed && cell.count">{{ cell.count }}</span>
          </button>
        </div>
      </div>
      <aside class="control-panel mines-controls">
        <h2>难度</h2>
        <div class="segmented">
          <button
            v-for="(item, key) in levels"
            :key="key"
            type="button"
            :class="{ active: level === key }"
            @click="switchLevel(key)"
          >
            {{ item.label }}
          </button>
        </div>
        <p>右键插旗，移动端长按插旗。</p>
        <p>剩余雷数：{{ remainingMines }}</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.mines-area {
  container-type: size;
  overflow: hidden;
  padding: 8px;
}

.mine-board {
  display: grid;
  gap: 4px;
  width: min(100cqw, calc(100cqh * var(--board-ratio)));
  height: min(100cqh, calc(100cqw / var(--board-ratio)));
  min-height: 0;
}

.mine-cell {
  display: grid;
  min-width: 28px;
  min-height: 0;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.16);
  border-radius: 5px;
  background: rgba(10, 23, 45, 0.9);
  color: var(--cyan);
  font-weight: 900;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-touch-callout: none;
}

.mine-cell.revealed {
  background: rgba(3, 8, 18, 0.78);
  border-color: rgba(145, 235, 255, 0.08);
}

.mine-cell.flagged {
  border-color: rgba(255, 209, 102, 0.55);
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 209, 102, 0.24), transparent 54%),
    rgba(44, 20, 34, 0.94);
  box-shadow:
    inset 0 0 14px rgba(255, 209, 102, 0.18),
    0 0 12px rgba(255, 79, 216, 0.18);
  color: #ff4f6d;
}

.flag-icon {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  font-size: clamp(1.35rem, 4.6vw, 2rem);
  line-height: 1;
  filter: drop-shadow(0 0 5px rgba(255, 209, 102, 0.78));
  transform: translateY(-1px) scale(1.12);
}

.mine-cell.mine {
  color: var(--danger);
  box-shadow: inset 0 0 18px rgba(255, 92, 124, 0.25);
}

@media (max-width: 860px) {
  .mines-area {
    overflow: hidden;
    padding: 6px;
  }

  .mine-board {
    width: min(100cqw, calc(100cqh * var(--board-ratio)));
    gap: 3px;
  }

  .mine-cell {
    min-width: 0;
    border-radius: 4px;
    font-size: 0.82rem;
  }

  .mines-panel {
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .mines-controls {
    max-height: none;
  }
}
</style>
