<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const size = 15;
const board = ref(Array(size * size).fill(""));
const current = ref("B");
const winner = ref("");
const moves = ref(0);
const best = ref(getBestScore("gomoku"));
const status = computed(() => {
  if (winner.value === "draw") return "平局";
  if (winner.value) return `${winner.value === "B" ? "黑子" : "白子"}获胜`;
  return `${current.value === "B" ? "黑子" : "白子"}落子`;
});

function indexOf(x, y) {
  return y * size + x;
}

function checkWin(x, y, mark) {
  return [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ].some(([dx, dy]) => {
    let count = 1;
    for (const dir of [-1, 1]) {
      let nx = x + dx * dir;
      let ny = y + dy * dir;
      while (nx >= 0 && ny >= 0 && nx < size && ny < size && board.value[indexOf(nx, ny)] === mark) {
        count += 1;
        nx += dx * dir;
        ny += dy * dir;
      }
    }
    return count >= 5;
  });
}

function play(index) {
  if (board.value[index] || winner.value) return;
  board.value[index] = current.value;
  moves.value += 1;
  const x = index % size;
  const y = Math.floor(index / size);
  if (checkWin(x, y, current.value)) {
    winner.value = current.value;
    best.value = setBestScore("gomoku", best.value + 1);
    return;
  }
  if (moves.value >= board.value.length) {
    winner.value = "draw";
    return;
  }
  current.value = current.value === "B" ? "W" : "B";
}

function restart() {
  board.value = Array(size * size).fill("");
  current.value = "B";
  winner.value = "";
  moves.value = 0;
}

restart();
</script>

<template>
  <GameLayout game-id="gomoku" :score="moves" :best="best" :status="status" @restart="restart">
    <section class="game-panel">
      <div class="board-shell">
        <div class="gomoku-board">
          <button v-for="(cell, index) in board" :key="index" class="gomoku-cell" type="button" @click="play(index)">
            <span v-if="cell" :class="cell">{{ cell === "B" ? "●" : "○" }}</span>
          </button>
        </div>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.gomoku-board {
  display: grid;
  width: min(92vw, 620px);
  aspect-ratio: 1;
  grid-template-columns: repeat(15, 1fr);
  gap: 2px;
  padding: 8px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.gomoku-cell {
  display: grid;
  min-width: 0;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.1);
  border-radius: 3px;
  background: rgba(12, 25, 49, 0.62);
  color: var(--text);
  font-size: clamp(0.8rem, 2.7vw, 1.35rem);
  cursor: pointer;
}

.gomoku-cell .B { color: #ecfeff; text-shadow: 0 0 12px rgba(236, 254, 255, 0.7); }
.gomoku-cell .W { color: #53f3ff; text-shadow: 0 0 12px rgba(83, 243, 255, 0.8); }
</style>
