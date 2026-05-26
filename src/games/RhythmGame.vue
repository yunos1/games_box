<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const lanes = ["D", "F", "J", "K"];
const notes = ref([]);
const score = ref(0);
const best = ref(getBestScore("rhythm-game"));
const combo = ref(0);
const status = ref("命中判定线");
const running = ref(false);
let timer = 0;
let tick = 0;

const grid = computed(() =>
  Array.from({ length: 7 }, (_, row) =>
    lanes.map((_, lane) => notes.value.find((note) => note.lane === lane && note.row === row)),
  ),
);

function start() {
  running.value = true;
  status.value = "节奏开始";
}

function restart() {
  notes.value = [];
  score.value = 0;
  combo.value = 0;
  tick = 0;
  running.value = false;
  status.value = "命中判定线";
}

function hit(lane) {
  const index = notes.value.findIndex((note) => note.lane === lane && note.row >= 5);
  if (index >= 0) {
    notes.value.splice(index, 1);
    combo.value += 1;
    score.value += 20 + combo.value * 2;
    best.value = setBestScore("rhythm-game", score.value);
    status.value = "Perfect";
  } else {
    combo.value = 0;
    status.value = "Miss";
  }
}

function update() {
  if (!running.value) return;
  tick += 1;
  if (tick % 2 === 0) notes.value.push({ id: Date.now() + Math.random(), lane: Math.floor(Math.random() * lanes.length), row: 0 });
  notes.value.forEach((note) => {
    note.row += 1;
  });
  const missed = notes.value.some((note) => note.row > 6);
  if (missed) combo.value = 0;
  notes.value = notes.value.filter((note) => note.row <= 6);
}

function onKey(event) {
  const lane = lanes.findIndex((key) => key.toLowerCase() === event.key.toLowerCase());
  if (lane >= 0) {
    event.preventDefault();
    hit(lane);
  }
  if (event.key === " ") start();
}

onMounted(() => {
  restart();
  window.addEventListener("keydown", onKey);
  timer = window.setInterval(update, 420);
});
onUnmounted(() => {
  window.clearInterval(timer);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <GameLayout game-id="rhythm-game" :score="score" :best="best" :moves="combo" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="rhythm-board">
          <template v-for="(row, rowIndex) in grid" :key="rowIndex">
            <button
              v-for="(note, laneIndex) in row"
              :key="`${rowIndex}-${laneIndex}`"
              class="rhythm-cell"
              :class="{ note, judge: rowIndex === 6 }"
              type="button"
              @click="rowIndex === 6 && hit(laneIndex)"
            >
              <span v-if="note">●</span>
              <strong v-if="rowIndex === 6">{{ lanes[laneIndex] }}</strong>
            </button>
          </template>
        </div>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <button class="pill-button primary" type="button" @click="start">开始</button>
        <p>键盘 D/F/J/K 或点击底部判定线。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.rhythm-board {
  display: grid;
  width: min(88vw, 430px);
  height: min(70vh, 560px);
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 7px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.rhythm-cell {
  position: relative;
  display: grid;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: var(--radius);
  background: rgba(12, 25, 49, 0.54);
  color: #ecfeff;
  font-weight: 900;
}

.rhythm-cell.note {
  color: #fb7185;
  text-shadow: 0 0 16px rgba(251, 113, 133, 0.8);
}

.rhythm-cell.judge {
  border-color: rgba(125, 255, 111, 0.48);
  background: rgba(14, 43, 31, 0.6);
}

.rhythm-cell strong {
  position: absolute;
  bottom: 6px;
  font-size: 0.75rem;
}
</style>
