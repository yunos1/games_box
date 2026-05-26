<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { createSwipeHandlers } from "../utils/touch";
import { getBestScore, setBestScore } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const size = 4;
const board = ref(Array(size * size).fill(0));
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
    row: Math.floor(index / size),
    col: index % size,
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
  while (merged.length < size) merged.push(0);
  return merged;
}

function lineIndexes(direction, line) {
  if (direction === "left") return [0, 1, 2, 3].map((col) => line * size + col);
  if (direction === "right") return [3, 2, 1, 0].map((col) => line * size + col);
  if (direction === "up") return [0, 1, 2, 3].map((row) => row * size + line);
  return [3, 2, 1, 0].map((row) => row * size + line);
}

function canMove() {
  if (emptyIndexes().length) return true;
  for (let index = 0; index < board.value.length; index += 1) {
    const right = index % size < size - 1 ? index + 1 : -1;
    const down = index + size < board.value.length ? index + size : -1;
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
  for (let line = 0; line < size; line += 1) {
    const indexes = lineIndexes(direction, line);
    const next = slideLine(indexes.map((index) => board.value[index]));
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
  board.value = Array(size * size).fill(0);
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
    <section class="game-panel split-panel">
      <div class="board-shell" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd" @touchmove.prevent>
        <div class="grid-2048">
          <div v-for="tile in tiles" :key="tile.index" class="tile-2048" :class="`v-${tile.value}`">
            <span v-if="tile.value">{{ tile.value }}</span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>键盘方向键或 WASD 移动。手机上直接在棋盘区域滑动。</p>
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
.grid-2048 {
  display: grid;
  width: min(88vw, 460px);
  aspect-ratio: 1;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.22);
  border-radius: var(--radius);
  background: rgba(4, 10, 22, 0.86);
}

.tile-2048 {
  display: grid;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: var(--radius);
  background: rgba(12, 25, 49, 0.72);
  color: var(--text);
  font-size: clamp(1.25rem, 6vw, 2.35rem);
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
.v-1024 { background: #176a82; font-size: clamp(1rem, 4.7vw, 1.9rem); }
.v-2048 { background: #5d3b9e; font-size: clamp(1rem, 4.7vw, 1.9rem); box-shadow: inset 0 0 28px rgba(255, 209, 102, 0.32); }
</style>
