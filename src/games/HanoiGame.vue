<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const diskCount = ref(5);
const towers = ref([[], [], []]);
const selected = ref(null);
const moves = ref(0);
const best = ref(getBestScore("hanoi"));
const status = ref("把圆盘移到右侧塔");
const score = computed(() => (towers.value[2].length === diskCount.value ? Math.max(100, 1000 - moves.value * 20) : 0));

function restart() {
  towers.value = [Array.from({ length: diskCount.value }, (_, index) => diskCount.value - index), [], []];
  selected.value = null;
  moves.value = 0;
  status.value = "把圆盘移到右侧塔";
}

function choose(index) {
  if (selected.value === null) {
    if (towers.value[index].length) selected.value = index;
    return;
  }
  if (selected.value === index) {
    selected.value = null;
    return;
  }
  const from = towers.value[selected.value];
  const to = towers.value[index];
  const disk = from.at(-1);
  if (!disk || (to.length && to.at(-1) < disk)) {
    status.value = "大盘不能压小盘";
    selected.value = null;
    return;
  }
  to.push(from.pop());
  moves.value += 1;
  selected.value = null;
  if (towers.value[2].length === diskCount.value) {
    status.value = "转移完成";
    best.value = setBestScore("hanoi", score.value);
  } else {
    status.value = "继续转移";
  }
}

restart();
</script>

<template>
  <GameLayout game-id="hanoi" :score="score" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="hanoi-board">
          <button
            v-for="(tower, index) in towers"
            :key="index"
            class="hanoi-tower"
            :class="{ selected: selected === index }"
            type="button"
            @click="choose(index)"
          >
            <span v-for="disk in [...tower].reverse()" :key="disk" class="disk" :style="{ '--w': `${30 + disk * 12}%` }"></span>
          </button>
        </div>
      </div>
      <aside class="control-panel">
        <h2>规则</h2>
        <p>点击源塔再点击目标塔。一次只能移动最上方圆盘，大盘不能压小盘。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.hanoi-board {
  display: grid;
  width: min(92vw, 620px);
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.hanoi-tower {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border: 1px solid rgba(145, 235, 255, 0.22);
  border-radius: var(--radius);
  background: linear-gradient(to bottom, rgba(12, 25, 49, 0.54), rgba(3, 8, 18, 0.8));
  padding: 12px;
  cursor: pointer;
}

.hanoi-tower.selected {
  border-color: var(--yellow);
  box-shadow: inset 0 0 24px rgba(255, 209, 102, 0.16);
}

.disk {
  display: block;
  width: var(--w);
  height: 22px;
  border-radius: 999px;
  background: linear-gradient(90deg, #53f3ff, #ff4fd8);
}
</style>
