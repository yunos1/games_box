<script setup>
import { computed, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const rows = 10;
const cols = 6;
const symbols = ["◆", "●", "▲", "■", "✦", "✚", "✹", "◇", "⬡"];

const tiles = ref([]);
const selected = ref(null);
const score = ref(0);
const best = ref(getBestScore("link-link"));
const status = ref("连接相同芯片");
const connectionPaths = ref([]);
const clearingIndexes = ref([]);
const completionNotice = ref(false);
const clearTimers = new Set();
let connectionId = 0;
let completionTimer;

const remaining = computed(() => tiles.value.filter((tile, index) => tile && !isClearing(index)).length);
const connectionLines = computed(() =>
  connectionPaths.value.map(({ id, path }) => ({
    id,
    points: path
      .map((point, index) => {
        const previous = path[index - 1];
        const next = path[index + 1];
        let x = colToX(point.col);
        let y = rowToY(point.row);

        if (index === 0 && next) {
          x += Math.sign(colToX(next.col) - x) * 0.5;
          y += Math.sign(rowToY(next.row) - y) * 0.5;
        } else if (index === path.length - 1 && previous) {
          x += Math.sign(colToX(previous.col) - x) * 0.5;
          y += Math.sign(rowToY(previous.row) - y) * 0.5;
        }

        x = Math.min(cols, Math.max(0, x));
        y = Math.min(rows, Math.max(0, y));
        return `${x},${y}`;
      })
      .join(" "),
  })),
);

function colToX(col) {
  return col - 0.5;
}

function rowToY(row) {
  return row - 0.5;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function createTilePool() {
  const pool = [];
  for (let index = 0; index < (rows * cols) / 2; index += 1) {
    const symbol = symbols[index % symbols.length];
    pool.push(symbol, symbol);
  }
  return pool;
}

function toPos(index) {
  return { row: Math.floor(index / cols), col: index % cols };
}

function buildMatrix(targetIndex, board = tiles.value) {
  const matrix = Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(""));
  board.forEach((value, index) => {
    if (!value || index === targetIndex) return;
    const { row, col } = toPos(index);
    matrix[row + 1][col + 1] = value;
  });
  return matrix;
}

function findConnection(first, second, board = tiles.value, withPath = false) {
  if (first === second || board[first] !== board[second]) return withPath ? [] : false;
  const start = toPos(first);
  const end = toPos(second);
  const target = { row: end.row + 1, col: end.col + 1 };
  const matrix = buildMatrix(second, board);
  const queue = [];
  const seen = new Set();
  const moves = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  moves.forEach(([dr, dc], dir) => {
    const row = start.row + 1;
    const col = start.col + 1;
    queue.push({ row, col, dir, turns: 0, path: withPath ? [{ row, col }] : null });
    seen.add(`${start.row + 1},${start.col + 1},${dir},0`);
  });

  while (queue.length) {
    const current = queue.shift();
    const [dr, dc] = moves[current.dir];
    const next = { row: current.row + dr, col: current.col + dc };
    if (next.row < 0 || next.col < 0 || next.row >= rows + 2 || next.col >= cols + 2) continue;
    if (next.row === target.row && next.col === target.col) {
      return withPath ? [...current.path, next] : true;
    }
    if (matrix[next.row][next.col]) continue;

    moves.forEach((move, dir) => {
      const turns = current.turns + (dir === current.dir ? 0 : 1);
      if (turns > 2) return;
      const key = `${next.row},${next.col},${dir},${turns}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({
        row: next.row,
        col: next.col,
        dir,
        turns,
        path: withPath ? [...current.path, next] : null,
      });
    });
  }
  return withPath ? [] : false;
}

function canConnect(first, second, board = tiles.value) {
  return Boolean(findConnection(first, second, board));
}

function isClearing(index) {
  return clearingIndexes.value.includes(index);
}

function getActiveBoard() {
  return tiles.value.map((tile, index) => (isClearing(index) ? "" : tile));
}

function getConnectionPath(first, second) {
  return findConnection(first, second, getActiveBoard(), true);
}

function showConnection(path) {
  const id = connectionId;
  connectionId += 1;
  connectionPaths.value = [...connectionPaths.value, { id, path }];
  window.setTimeout(() => {
    connectionPaths.value = connectionPaths.value.filter((line) => line.id !== id);
  }, 640);
}

function showCompletionNotice() {
  window.clearTimeout(completionTimer);
  completionNotice.value = true;
  completionTimer = window.setTimeout(() => {
    completionNotice.value = false;
  }, 2200);
}

function findConnectablePair(board = tiles.value) {
  for (let first = 0; first < board.length; first += 1) {
    if (!board[first]) continue;
    for (let second = first + 1; second < board.length; second += 1) {
      if (board[first] === board[second] && canConnect(first, second, board)) {
        return [first, second];
      }
    }
  }
  return null;
}

function createGuaranteedLayout(values, openIndexes = Array.from({ length: rows * cols }, (_, index) => index)) {
  const pairSymbol = values.find((value, index) => values.indexOf(value) !== index);
  const board = Array(rows * cols).fill("");
  if (!pairSymbol) {
    values.forEach((value, index) => {
      board[openIndexes[index]] = value;
    });
    return board;
  }

  const rest = [];
  let skipped = 0;
  values.forEach((value) => {
    if (value === pairSymbol && skipped < 2) {
      skipped += 1;
      return;
    }
    rest.push(value);
  });

  const probe = Array(rows * cols).fill("");
  openIndexes.forEach((index) => {
    probe[index] = "__block";
  });
  const pairPositions =
    openIndexes
      .flatMap((first, index) => openIndexes.slice(index + 1).map((second) => [first, second]))
      .find(([first, second]) => {
        probe[first] = "__pair";
        probe[second] = "__pair";
        const connects = canConnect(first, second, probe);
        probe[first] = "__block";
        probe[second] = "__block";
        return connects;
      }) || openIndexes.slice(0, 2);

  board[pairPositions[0]] = pairSymbol;
  board[pairPositions[1]] = pairSymbol;
  const pairSet = new Set(pairPositions);
  const positions = shuffle(openIndexes.filter((index) => !pairSet.has(index)));
  shuffle(rest).forEach((value, index) => {
    board[positions[index]] = value;
  });
  return board;
}

function createPlayableLayout(values, fixedEmptyIndexes = null) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const next = Array(rows * cols).fill("");
    const openIndexes = fixedEmptyIndexes
      ? Array.from({ length: rows * cols }, (_, index) => index).filter((index) => !fixedEmptyIndexes.has(index))
      : Array.from({ length: rows * cols }, (_, index) => index);
    const positions = shuffle(openIndexes);

    shuffle(values).forEach((value, index) => {
      next[positions[index]] = value;
    });

    if (findConnectablePair(next)) return next;
  }

  const openIndexes = fixedEmptyIndexes
    ? Array.from({ length: rows * cols }, (_, index) => index).filter((index) => !fixedEmptyIndexes.has(index))
    : Array.from({ length: rows * cols }, (_, index) => index);
  return createGuaranteedLayout(values, openIndexes);
}

function reshuffleIfBlocked() {
  const activeBoard = getActiveBoard();
  if (remaining.value === 0 || clearingIndexes.value.length || findConnectablePair(activeBoard)) return false;

  const values = activeBoard.filter(Boolean);
  const emptyIndexes = new Set(activeBoard.map((tile, index) => (tile ? -1 : index)).filter((index) => index >= 0));
  const next = createPlayableLayout(values, emptyIndexes);
  tiles.value = next;
  selected.value = null;
  return true;
}

function restart() {
  clearTimers.forEach((timer) => window.clearTimeout(timer));
  clearTimers.clear();
  window.clearTimeout(completionTimer);
  tiles.value = createPlayableLayout(createTilePool());
  selected.value = null;
  connectionPaths.value = [];
  clearingIndexes.value = [];
  completionNotice.value = false;
  connectionId = 0;
  score.value = 0;
  status.value = "连接相同芯片";
}

function choose(index) {
  if (!tiles.value[index] || isClearing(index)) return;
  if (selected.value === null) {
    selected.value = index;
    status.value = "选择另一个同类芯片";
    return;
  }
  if (selected.value === index) {
    selected.value = null;
    status.value = "重新选择芯片";
    return;
  }
  const path = getConnectionPath(selected.value, index);
  if (path.length) {
    const first = selected.value;
    const second = index;
    showConnection(path);
    clearingIndexes.value = [...clearingIndexes.value, first, second];
    score.value += 40;
    best.value = setBestScore("link-link", score.value);
    selected.value = null;
    status.value = "连接成功";
    const clearTimer = window.setTimeout(() => {
      clearTimers.delete(clearTimer);
      tiles.value[first] = "";
      tiles.value[second] = "";
      clearingIndexes.value = clearingIndexes.value.filter((clearingIndex) => clearingIndex !== first && clearingIndex !== second);
      if (remaining.value === 0) {
        best.value = setBestScore("link-link", score.value + 200);
        status.value = "全部清除";
        showCompletionNotice();
        return;
      }
      status.value = reshuffleIfBlocked() ? "连接成功，已自动洗牌" : "连接成功";
    }, 640);
    clearTimers.add(clearTimer);
  } else {
    selected.value = index;
    status.value = "线路受阻，换一组试试";
  }
}

onUnmounted(() => {
  clearTimers.forEach((timer) => window.clearTimeout(timer));
  clearTimers.clear();
  window.clearTimeout(completionTimer);
});

restart();
</script>

<template>
  <GameLayout game-id="link-link" :score="score" :best="best" :moves="remaining" :status="status" @restart="restart">
    <section class="game-panel link-panel">
      <div class="board-shell link-board-shell">
        <div class="link-board">
          <svg
            v-if="connectionLines.length"
            class="link-path-layer"
            :viewBox="`0 0 ${cols} ${rows}`"
            aria-hidden="true"
          >
            <g v-for="line in connectionLines" :key="line.id">
              <polyline class="link-path-glow" :points="line.points" />
              <polyline class="link-path-line" :points="line.points" />
            </g>
          </svg>
          <button
            v-for="(tile, index) in tiles"
            :key="index"
            class="link-tile"
            :class="{ selected: selected === index, clearing: clearingIndexes.includes(index), cleared: !tile }"
            type="button"
            @click="choose(index)"
          >
            {{ tile }}
          </button>
          <div v-if="completionNotice" class="link-complete-notice" aria-live="polite">
            <span class="link-complete-ring"></span>
            <span class="link-complete-spark spark-a"></span>
            <span class="link-complete-spark spark-b"></span>
            <span class="link-complete-spark spark-c"></span>
            <strong>全部清除</strong>
            <small>+200 奖励</small>
          </div>
        </div>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.link-panel {
  height: 100%;
  align-items: stretch;
}

.link-board-shell {
  width: 100%;
  height: 100%;
  justify-self: stretch;
  align-self: stretch;
  place-items: center;
}

.link-board {
  position: relative;
  display: grid;
  width: min(100cqw, calc(100cqh * 0.6), 560px) !important;
  aspect-ratio: 6 / 10;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(10, 1fr);
  gap: 8px;
  padding: 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
}

.link-path-layer {
  position: absolute;
  inset: 0;
  z-index: 4;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.link-path-glow,
.link-path-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.link-path-glow {
  stroke: rgba(180, 210, 210, 0.11);
  stroke-width: 0.13;
  stroke-dasharray: 0.18 0.18;
  animation: link-path-flash 320ms ease-in-out 2;
}

.link-path-line {
  stroke: rgba(214, 224, 202, 0.58);
  stroke-width: 0.045;
  stroke-dasharray: 0.12 0.12;
  filter: drop-shadow(0 0 2px rgba(214, 224, 202, 0.26));
  animation: link-path-flash 320ms ease-in-out 2;
}

.link-tile {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: var(--radius);
  background: rgba(12, 25, 49, 0.78);
  color: #34d399;
  font-size: clamp(1.2rem, 6vw, 2.2rem);
  font-weight: 900;
  cursor: pointer;
  text-shadow: 0 0 14px rgba(52, 211, 153, 0.75);
}

.link-tile.selected {
  border-color: #ffd166;
  box-shadow: inset 0 0 22px rgba(255, 209, 102, 0.2);
}

.link-tile.clearing {
  animation: link-tile-flash 320ms ease-in-out 2;
}

.link-tile.cleared {
  visibility: hidden;
}

.link-complete-notice {
  position: absolute;
  inset: 50% auto auto 50%;
  z-index: 6;
  display: grid;
  min-width: 148px;
  min-height: 88px;
  place-items: center;
  padding: 16px 18px;
  border: 1px solid rgba(214, 224, 202, 0.38);
  border-radius: var(--radius);
  background: rgba(6, 13, 28, 0.82);
  box-shadow:
    0 0 26px rgba(83, 243, 255, 0.16),
    inset 0 0 22px rgba(214, 224, 202, 0.08);
  color: #ecfeff;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: link-complete-card 2200ms ease forwards;
}

.link-complete-notice strong,
.link-complete-notice small {
  position: relative;
  z-index: 1;
}

.link-complete-notice strong {
  font-size: 1.05rem;
  letter-spacing: 0;
}

.link-complete-notice small {
  margin-top: 4px;
  color: var(--yellow);
  font-weight: 900;
}

.link-complete-ring {
  position: absolute;
  width: 74px;
  height: 74px;
  border: 1px dashed rgba(214, 224, 202, 0.46);
  border-radius: 50%;
  animation: link-complete-ring 1200ms ease-out forwards;
}

.link-complete-spark {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: #7dff6f;
  box-shadow: 0 0 12px rgba(125, 255, 111, 0.7);
  animation: link-complete-spark 900ms ease-out forwards;
}

.link-complete-spark.spark-a {
  --spark-x: -52px;
  --spark-y: -34px;
}

.link-complete-spark.spark-b {
  --spark-x: 58px;
  --spark-y: -22px;
  background: #53f3ff;
  box-shadow: 0 0 12px rgba(83, 243, 255, 0.68);
  animation-delay: 90ms;
}

.link-complete-spark.spark-c {
  --spark-x: 42px;
  --spark-y: 42px;
  background: #ffd166;
  box-shadow: 0 0 12px rgba(255, 209, 102, 0.62);
  animation-delay: 160ms;
}

@keyframes link-path-flash {
  50% {
    opacity: 0.32;
  }
}

@keyframes link-tile-flash {
  50% {
    border-color: rgba(214, 224, 202, 0.7);
    box-shadow: inset 0 0 16px rgba(214, 224, 202, 0.16), 0 0 12px rgba(214, 224, 202, 0.16);
    opacity: 0.72;
  }
}

@keyframes link-complete-card {
  0% {
    opacity: 0;
    transform: translate(-50%, -46%) scale(0.88);
  }

  14%,
  72% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -54%) scale(0.96);
  }
}

@keyframes link-complete-ring {
  0% {
    opacity: 0.8;
    transform: scale(0.45) rotate(0deg);
  }

  100% {
    opacity: 0;
    transform: scale(1.55) rotate(120deg);
  }
}

@keyframes link-complete-spark {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.6) rotate(0deg);
  }

  28% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate(var(--spark-x), var(--spark-y)) scale(1) rotate(45deg);
  }
}

@media (max-width: 520px) {
  .link-board-shell {
    width: 100%;
    height: 100%;
    padding: 6px;
  }

  .link-board {
    width: min(100cqw, calc(100cqh * 0.6)) !important;
    gap: 6px;
    padding: 8px;
  }
}
</style>
