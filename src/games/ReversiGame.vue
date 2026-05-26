<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const size = 8;
const dirs = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];
const board = ref(Array(size * size).fill(""));
const current = ref("B");
const finished = ref(false);
const best = ref(getBestScore("reversi"));

const blackCount = computed(() => board.value.filter((cell) => cell === "B").length);
const whiteCount = computed(() => board.value.filter((cell) => cell === "W").length);
const status = computed(() => {
  if (finished.value) {
    if (blackCount.value === whiteCount.value) return "平局";
    return `${blackCount.value > whiteCount.value ? "黑子" : "白子"}获胜`;
  }
  return `${current.value === "B" ? "黑子" : "白子"}行动`;
});

function idx(x, y) {
  return y * size + x;
}

function flipsAt(index, mark, source = board.value) {
  if (source[index]) return [];
  const x = index % size;
  const y = Math.floor(index / size);
  const other = mark === "B" ? "W" : "B";
  const flips = [];
  for (const [dx, dy] of dirs) {
    const line = [];
    let nx = x + dx;
    let ny = y + dy;
    while (nx >= 0 && ny >= 0 && nx < size && ny < size && source[idx(nx, ny)] === other) {
      line.push(idx(nx, ny));
      nx += dx;
      ny += dy;
    }
    if (line.length && nx >= 0 && ny >= 0 && nx < size && ny < size && source[idx(nx, ny)] === mark) {
      flips.push(...line);
    }
  }
  return flips;
}

function hasMove(mark) {
  return board.value.some((_, index) => flipsAt(index, mark).length);
}

function endIfNeeded() {
  if (!hasMove("B") && !hasMove("W")) {
    finished.value = true;
    best.value = setBestScore("reversi", Math.max(blackCount.value, whiteCount.value));
  }
}

function play(index) {
  if (finished.value) return;
  const flips = flipsAt(index, current.value);
  if (!flips.length) return;
  board.value[index] = current.value;
  flips.forEach((flip) => {
    board.value[flip] = current.value;
  });
  const next = current.value === "B" ? "W" : "B";
  current.value = hasMove(next) ? next : current.value;
  endIfNeeded();
}

function restart() {
  board.value = Array(size * size).fill("");
  board.value[idx(3, 3)] = "W";
  board.value[idx(4, 4)] = "W";
  board.value[idx(3, 4)] = "B";
  board.value[idx(4, 3)] = "B";
  current.value = "B";
  finished.value = false;
}

restart();
</script>

<template>
  <GameLayout game-id="reversi" :score="blackCount + whiteCount" :best="best" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="reversi-board">
          <button
            v-for="(cell, index) in board"
            :key="index"
            class="reversi-cell"
            :class="{ legal: flipsAt(index, current).length }"
            type="button"
            @click="play(index)"
          >
            <span v-if="cell" :class="cell"></span>
          </button>
        </div>
      </div>
      <aside class="control-panel">
        <h2>局势</h2>
        <p>黑子：{{ blackCount }}　白子：{{ whiteCount }}</p>
        <p>点击合法空格，夹住对方棋子即可翻转。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.reversi-board {
  display: grid;
  width: min(88vw, 520px);
  aspect-ratio: 1;
  grid-template-columns: repeat(8, 1fr);
  gap: 5px;
  padding: 9px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(4, 29, 27, 0.86);
}

.reversi-cell {
  display: grid;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: 5px;
  background: rgba(12, 25, 49, 0.54);
  cursor: pointer;
}

.reversi-cell.legal {
  box-shadow: inset 0 0 12px rgba(125, 255, 111, 0.16);
}

.reversi-cell span {
  width: 72%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.reversi-cell .B { background: #020611; border: 2px solid #ecfeff; }
.reversi-cell .W { background: #ecfeff; box-shadow: 0 0 14px rgba(236, 254, 255, 0.55); }
</style>
