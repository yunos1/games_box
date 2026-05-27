<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { createSwipeHandlers } from "../utils/touch";
import { getBestScore, setBestScore } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const cols = 5;
const rows = 8;
const board = ref(Array(cols * rows).fill(0));
const score = ref(0);
const best = ref(getBestScore("2048"));
const status = ref("合并到 2048");
const gameOver = ref(false);
const moves = ref(0);
const progressVersion = ref(0);
const runResult = ref(null);
const dailyVariant = getDailyVariantForGame("2048");
const variantEffect = dailyVariant?.effect || "";
let runNewGoalIds = new Set();

const tiles = computed(() =>
  board.value.map((value, index) => ({
    value,
    index,
    row: Math.floor(index / cols),
    col: index % cols,
  })),
);

function emptyIndexes() {
  return board.value.map((value, index) => (value ? -1 : index)).filter((index) => index >= 0);
}

function addTile() {
  const empty = emptyIndexes();
  if (!empty.length) return;
  const index = empty[Math.floor(Math.random() * empty.length)];
  const fourChance = variantEffect === "rich-spawn" ? 0.34 : 0.12;
  board.value[index] = Math.random() < fourChance ? 4 : 2;
}

function slideLine(line) {
  const values = line.filter(Boolean);
  const merged = [];
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === values[i + 1]) {
      const value = values[i] * 2;
      merged.push(value);
      score.value += variantEffect === "score-boost" ? value + Math.floor(value / 4) : value;
      i += 1;
    } else {
      merged.push(values[i]);
    }
  }
  return merged;
}

function padLine(line, length) {
  const next = slideLine(line);
  while (next.length < length) next.push(0);
  return next;
}

function lineIndexes(direction, line) {
  if (direction === "left") return Array.from({ length: cols }, (_, col) => line * cols + col);
  if (direction === "right") return Array.from({ length: cols }, (_, col) => line * cols + (cols - 1 - col));
  if (direction === "up") return Array.from({ length: rows }, (_, row) => row * cols + line);
  return Array.from({ length: rows }, (_, row) => (rows - 1 - row) * cols + line);
}

function lineCount(direction) {
  return direction === "left" || direction === "right" ? rows : cols;
}

function lineLength(direction) {
  return direction === "left" || direction === "right" ? cols : rows;
}

function canMove() {
  if (emptyIndexes().length) return true;
  for (let index = 0; index < board.value.length; index += 1) {
    const right = index % cols < cols - 1 ? index + 1 : -1;
    const down = index + cols < board.value.length ? index + cols : -1;
    if (right > 0 && board.value[index] === board.value[right]) return true;
    if (down > 0 && board.value[index] === board.value[down]) return true;
  }
  return false;
}

function maxTile() {
  return Math.max(...board.value);
}

function syncProgress() {
  const result = recordGameResult("2048", {
    score: score.value,
    moves: moves.value,
    maxTile: maxTile(),
    dailyVariantId: dailyVariant?.id,
  });
  result.newlyUnlocked.forEach((id) => runNewGoalIds.add(id));
  progressVersion.value += 1;
  return result;
}

function showRunResult(title, detail) {
  const result = syncProgress();
  runResult.value = {
    title,
    detail,
    stats: [
      { label: "分数", value: score.value },
      { label: "最大方块", value: maxTile() },
      { label: "步数", value: moves.value },
    ],
    stars: result.stars,
    total: result.total,
    variantCompleted: result.variantCompleted,
    newGoals: result.goals.filter((goal) => runNewGoalIds.has(goal.id)),
    goals: result.goals,
  };
}

function move(direction) {
  if (gameOver.value) return;
  const previous = board.value.join(",");
  for (let line = 0; line < lineCount(direction); line += 1) {
    const indexes = lineIndexes(direction, line);
    const next = padLine(indexes.map((index) => board.value[index]), lineLength(direction));
    indexes.forEach((index, valueIndex) => {
      board.value[index] = next[valueIndex];
    });
  }
  if (board.value.join(",") === previous) return;
  moves.value += 1;
  addTile();
  best.value = setBestScore("2048", score.value);
  syncProgress();
  if (board.value.includes(2048)) status.value = "2048 达成，还可以继续";
  else if (variantEffect === "move-limit") status.value = `限步聚变 ${Math.max(0, 160 - moves.value)} 步`;
  if (variantEffect === "move-limit" && moves.value >= 160 && maxTile() < 1024) {
    gameOver.value = true;
    status.value = "限步结束，未达 1024";
    showRunResult("限步结束", "这局没能在 160 步内合成 1024。");
    return;
  }
  if (!canMove()) {
    gameOver.value = true;
    status.value = "没有可移动方块";
    showRunResult("棋盘锁死", "没有可移动方块，本局结算。");
  }
}

function restart() {
  board.value = Array(cols * rows).fill(0);
  score.value = 0;
  moves.value = 0;
  runResult.value = null;
  runNewGoalIds = new Set();
  status.value = variantEffect === "move-limit" ? "160 步内合成 1024" : "合并到 2048";
  gameOver.value = false;
  addTile();
  addTile();
  if (variantEffect === "rich-spawn") {
    addTile();
    addTile();
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
  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
}

const swipe = createSwipeHandlers(move);

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
restart();
</script>

<template>
  <GameLayout
    game-id="2048"
    :score="score"
    :best="best"
    :moves="moves"
    :status="status"
    :progress-version="progressVersion"
    :run-result="runResult"
    @restart="restart"
    @dismiss-result="runResult = null"
  >
    <section class="game-panel game-2048-panel">
      <div class="board-shell board-2048-shell" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd" @touchmove.prevent>
        <div class="grid-2048">
          <div v-for="tile in tiles" :key="tile.index" class="tile-2048" :class="`v-${tile.value}`">
            <span v-if="tile.value">{{ tile.value }}</span>
          </div>
        </div>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.game-2048-panel {
  grid-template-columns: minmax(0, 1fr);
}

.board-2048-shell {
  width: 100%;
  height: 100%;
}

.grid-2048 {
  display: grid;
  width: min(100cqw, calc(100cqh * 2 / 3)) !important;
  height: min(100cqh, calc(100cqw * 3 / 2));
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(8, minmax(0, 1fr));
  gap: clamp(5px, 1cqw, 10px);
  padding: clamp(6px, 1cqw, 8px);
  border: 0;
  border-radius: var(--radius);
  background: rgba(4, 10, 22, 0.86);
}

.tile-2048 {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius);
  background: rgba(12, 25, 49, 0.72);
  color: var(--text);
  font-size: clamp(1rem, 4.5cqw, 2rem);
  font-weight: 900;
  line-height: 1;
}

.v-2 { background: #14314a; }
.v-4 { background: #1c3b55; }
.v-8 { background: #4b2a5b; }
.v-16 { background: #6a3157; }
.v-32 { background: #7c2d42; }
.v-64 { background: #8a3a22; }
.v-128 { background: #7a5418; }
.v-256 { background: #687019; }
.v-512 { background: #28745a; }
.v-1024 { background: #176a82; font-size: clamp(0.82rem, 3.8cqw, 1.55rem); }
.v-2048 { background: #5d3b9e; font-size: clamp(0.82rem, 3.8cqw, 1.55rem); box-shadow: inset 0 0 28px rgba(255, 209, 102, 0.32); }
</style>
