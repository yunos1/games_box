<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const levels = {
  easy: { label: "初级", rows: 9, cols: 9, mines: 10 },
  normal: { label: "中级", rows: 12, cols: 12, mines: 24 },
  hard: { label: "高级", rows: 14, cols: 16, mines: 40 },
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
    finished.value = true;
    status.value = "排爆完成";
    best.value = setBestScore("minesweeper", best.value + 1);
  } else {
    status.value = "继续扫描";
  }
}

function toggleFlag(index) {
  const cell = cells.value[index];
  if (finished.value || !cell || cell.revealed) return;
  cell.flagged = !cell.flagged;
  flags.value += cell.flagged ? 1 : -1;
}

function onContext(event, index) {
  event.preventDefault();
  toggleFlag(index);
}

let pressTimer = null;
function onTouchStart(index) {
  pressTimer = window.setTimeout(() => toggleFlag(index), 420);
}

function onTouchEnd() {
  window.clearTimeout(pressTimer);
}

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
    <section class="game-panel split-panel">
      <div class="board-shell mines-area">
        <div
          class="mine-board"
          :style="{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }"
        >
          <button
            v-for="(cell, index) in cells"
            :key="index"
            class="mine-cell"
            :class="{ revealed: cell.revealed, flagged: cell.flagged, mine: cell.mine && cell.revealed }"
            type="button"
            @click="reveal(index)"
            @contextmenu="onContext($event, index)"
            @touchstart.passive="onTouchStart(index)"
            @touchend.passive="onTouchEnd"
          >
            <span v-if="cell.flagged && !cell.revealed">⚑</span>
            <span v-else-if="cell.revealed && cell.mine">✹</span>
            <span v-else-if="cell.revealed && cell.count">{{ cell.count }}</span>
          </button>
        </div>
      </div>
      <aside class="control-panel">
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
  overflow: auto;
  padding: 12px;
}

.mine-board {
  display: grid;
  gap: 4px;
  width: min(100%, 620px);
}

.mine-cell {
  display: grid;
  min-width: 28px;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.16);
  border-radius: 5px;
  background: rgba(10, 23, 45, 0.9);
  color: var(--cyan);
  font-weight: 900;
  cursor: pointer;
}

.mine-cell.revealed {
  background: rgba(3, 8, 18, 0.78);
  border-color: rgba(145, 235, 255, 0.08);
}

.mine-cell.flagged {
  color: var(--yellow);
}

.mine-cell.mine {
  color: var(--danger);
  box-shadow: inset 0 0 18px rgba(255, 92, 124, 0.25);
}
</style>
