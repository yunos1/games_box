<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const tiles = ref([]);
const moves = ref(0);
const best = ref(getBestScore("fifteen-puzzle"));
const status = ref("排成 1 到 15");
const solved = computed(() => tiles.value.slice(0, 15).every((value, index) => value === index + 1));
const score = computed(() => (solved.value ? Math.max(100, 1000 - moves.value * 10) : 0));

function restart() {
  tiles.value = Array.from({ length: 15 }, (_, index) => index + 1).concat(0);
  moves.value = 0;
  status.value = "排成 1 到 15";
  for (let step = 0; step < 80; step += 1) {
    const empty = tiles.value.indexOf(0);
    const options = neighbors(empty);
    const choice = options[Math.floor(Math.random() * options.length)];
    [tiles.value[empty], tiles.value[choice]] = [tiles.value[choice], tiles.value[empty]];
  }
}

function neighbors(index) {
  const x = index % 4;
  const y = Math.floor(index / 4);
  return [
    [x, y - 1],
    [x, y + 1],
    [x - 1, y],
    [x + 1, y],
  ]
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < 4 && ny < 4)
    .map(([nx, ny]) => ny * 4 + nx);
}

function slide(index) {
  const empty = tiles.value.indexOf(0);
  if (!neighbors(empty).includes(index)) return;
  [tiles.value[empty], tiles.value[index]] = [tiles.value[index], tiles.value[empty]];
  moves.value += 1;
  if (solved.value) {
    status.value = "矩阵归位";
    best.value = setBestScore("fifteen-puzzle", score.value);
  }
}

restart();
</script>

<template>
  <GameLayout game-id="fifteen-puzzle" :score="score" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel">
      <div class="board-shell">
        <div class="fifteen-board">
          <button v-for="(tile, index) in tiles" :key="index" class="fifteen-tile" :class="{ empty: tile === 0 }" type="button" @click="slide(index)">
            {{ tile || "" }}
          </button>
        </div>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.fifteen-board {
  display: grid;
  width: min(88vw, 460px);
  aspect-ratio: 1;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.fifteen-tile {
  display: grid;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: var(--radius);
  background: rgba(37, 99, 235, 0.76);
  color: #ecfeff;
  font-size: clamp(1.4rem, 7vw, 2.4rem);
  font-weight: 900;
  cursor: pointer;
}

.fifteen-tile.empty {
  opacity: 0.22;
  background: rgba(3, 8, 18, 0.88);
}
</style>
