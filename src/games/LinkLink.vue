<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const rows = 6;
const cols = 6;
const symbols = ["◆", "●", "▲", "■", "✦", "✚", "✹", "◇", "⬡"];

const tiles = ref([]);
const selected = ref(null);
const score = ref(0);
const best = ref(getBestScore("link-link"));
const status = ref("连接相同芯片");

const remaining = computed(() => tiles.value.filter(Boolean).length);

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function restart() {
  const pool = [];
  for (let index = 0; index < (rows * cols) / 2; index += 1) {
    const symbol = symbols[index % symbols.length];
    pool.push(symbol, symbol);
  }
  tiles.value = shuffle(pool);
  selected.value = null;
  score.value = 0;
  status.value = "连接相同芯片";
}

function toIndex(row, col) {
  return row * cols + col;
}

function toPos(index) {
  return { row: Math.floor(index / cols), col: index % cols };
}

function buildMatrix(targetIndex) {
  const matrix = Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(""));
  tiles.value.forEach((value, index) => {
    if (!value || index === targetIndex) return;
    const { row, col } = toPos(index);
    matrix[row + 1][col + 1] = value;
  });
  return matrix;
}

function canConnect(first, second) {
  if (first === second || tiles.value[first] !== tiles.value[second]) return false;
  const start = toPos(first);
  const end = toPos(second);
  const target = { row: end.row + 1, col: end.col + 1 };
  const matrix = buildMatrix(second);
  const queue = [];
  const seen = new Set();
  const moves = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  moves.forEach(([dr, dc], dir) => {
    queue.push({ row: start.row + 1, col: start.col + 1, dir, turns: 0 });
    seen.add(`${start.row + 1},${start.col + 1},${dir},0`);
  });

  while (queue.length) {
    const current = queue.shift();
    const [dr, dc] = moves[current.dir];
    const next = { row: current.row + dr, col: current.col + dc };
    if (next.row < 0 || next.col < 0 || next.row >= rows + 2 || next.col >= cols + 2) continue;
    if (next.row === target.row && next.col === target.col) return true;
    if (matrix[next.row][next.col]) continue;

    moves.forEach((move, dir) => {
      const turns = current.turns + (dir === current.dir ? 0 : 1);
      if (turns > 2) return;
      const key = `${next.row},${next.col},${dir},${turns}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({ row: next.row, col: next.col, dir, turns });
    });
  }
  return false;
}

function choose(index) {
  if (!tiles.value[index]) return;
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
  if (canConnect(selected.value, index)) {
    tiles.value[selected.value] = "";
    tiles.value[index] = "";
    score.value += 40;
    best.value = setBestScore("link-link", score.value);
    selected.value = null;
    status.value = remaining.value === 0 ? "全部清除" : "连接成功";
    if (remaining.value === 0) best.value = setBestScore("link-link", score.value + 200);
  } else {
    selected.value = index;
    status.value = "线路受阻，换一组试试";
  }
}

restart();
</script>

<template>
  <GameLayout game-id="link-link" :score="score" :best="best" :moves="remaining" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="link-board">
          <button
            v-for="(tile, index) in tiles"
            :key="index"
            class="link-tile"
            :class="{ selected: selected === index, cleared: !tile }"
            type="button"
            @click="choose(index)"
          >
            {{ tile }}
          </button>
        </div>
      </div>
      <aside class="control-panel">
        <h2>规则</h2>
        <p>选择两个相同芯片。连接线路可以穿过空格，最多允许两次转弯。</p>
        <p>剩余芯片：{{ remaining }}</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.link-board {
  display: grid;
  width: min(88vw, 520px);
  aspect-ratio: 1;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.link-tile {
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

.link-tile.cleared {
  visibility: hidden;
}
</style>
