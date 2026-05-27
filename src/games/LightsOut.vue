<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const size = 5;
const lights = ref(Array(size * size).fill(false));
const moves = ref(0);
const best = ref(getBestScore("lights-out"));
const status = ref("熄灭全部灯");
const score = computed(() => (lights.value.every((light) => !light) ? Math.max(100, 600 - moves.value * 12) : lights.value.filter(Boolean).length));

function idx(x, y) {
  return y * size + x;
}

function toggleIndex(index) {
  lights.value[index] = !lights.value[index];
}

function press(index) {
  const x = index % size;
  const y = Math.floor(index / size);
  [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < size && ny < size) toggleIndex(idx(nx, ny));
  });
  moves.value += 1;
  if (lights.value.every((light) => !light)) {
    status.value = "灯阵归零";
    best.value = setBestScore("lights-out", score.value);
  } else {
    status.value = "继续校准";
  }
}

function restart() {
  lights.value = Array(size * size).fill(false);
  [2, 6, 7, 11, 12, 13, 17, 18, 22].forEach((index) => press(index));
  moves.value = 0;
  status.value = "熄灭全部灯";
}

restart();
</script>

<template>
  <GameLayout game-id="lights-out" :score="score" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel">
      <div class="board-shell">
        <div class="lights-board">
          <button v-for="(light, index) in lights" :key="index" class="light-cell" :class="{ on: light }" type="button" @click="press(index)"></button>
        </div>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.lights-board {
  display: grid;
  width: min(88vw, 460px);
  aspect-ratio: 1;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.light-cell {
  border: 1px solid rgba(145, 235, 255, 0.16);
  border-radius: var(--radius);
  background: #111827;
  cursor: pointer;
}

.light-cell.on {
  background: #fde047;
  box-shadow: 0 0 22px rgba(253, 224, 71, 0.6);
}
</style>
