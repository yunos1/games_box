<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const puzzle = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
];

const solution = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

const values = ref([...puzzle]);
const selected = ref(puzzle.findIndex((value) => !value));
const mistakes = ref(0);
const hints = ref(3);
const best = ref(getBestScore("sudoku"));
const status = ref("填满九宫矩阵");

const filledCount = computed(() => values.value.filter(Boolean).length);
const score = computed(() => Math.max(0, filledCount.value * 10 - mistakes.value * 25 + hints.value * 15));

function restart() {
  values.value = [...puzzle];
  selected.value = puzzle.findIndex((value) => !value);
  mistakes.value = 0;
  hints.value = 3;
  status.value = "填满九宫矩阵";
}

function setNumber(number) {
  const index = selected.value;
  if (index < 0 || puzzle[index]) return;
  values.value[index] = number;
  if (number && number !== solution[index]) {
    mistakes.value += 1;
    status.value = "这个数字冲突了";
  } else {
    status.value = "继续推演";
  }
  checkWin();
}

function clearCell() {
  if (selected.value >= 0 && !puzzle[selected.value]) {
    values.value[selected.value] = 0;
  }
}

function useHint() {
  if (hints.value <= 0) return;
  const index = values.value.findIndex((value, cellIndex) => value !== solution[cellIndex]);
  if (index < 0) return;
  values.value[index] = solution[index];
  selected.value = index;
  hints.value -= 1;
  status.value = "已填入一个提示";
  checkWin();
}

function checkWin() {
  if (values.value.every((value, index) => value === solution[index])) {
    status.value = "数独完成";
    best.value = setBestScore("sudoku", score.value);
  }
}

function cellClass(index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const sameGroup =
    selected.value >= 0 &&
    (Math.floor(selected.value / 9) === row ||
      selected.value % 9 === col ||
      (Math.floor(Math.floor(selected.value / 9) / 3) === Math.floor(row / 3) &&
        Math.floor((selected.value % 9) / 3) === Math.floor(col / 3)));
  return {
    given: puzzle[index],
    selected: selected.value === index,
    related: sameGroup,
    wrong: values.value[index] && values.value[index] !== solution[index],
  };
}
</script>

<template>
  <GameLayout
    game-id="sudoku"
    :score="score"
    :best="best"
    :moves="mistakes"
    :status="status"
    @restart="restart"
  >
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="sudoku-board">
          <button
            v-for="(value, index) in values"
            :key="index"
            class="sudoku-cell"
            :class="cellClass(index)"
            type="button"
            @click="selected = index"
          >
            {{ value || "" }}
          </button>
        </div>
      </div>
      <aside class="control-panel">
        <h2>数字面板</h2>
        <div class="number-pad">
          <button v-for="number in 9" :key="number" type="button" @click="setNumber(number)">{{ number }}</button>
        </div>
        <button class="pill-button" type="button" @click="clearCell">清空</button>
        <button class="pill-button primary" type="button" @click="useHint">提示 {{ hints }}</button>
        <p>选择空格后填数字。错误会扣分，提示次数有限。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.sudoku-board {
  display: grid;
  width: min(88vw, 520px);
  aspect-ratio: 1;
  grid-template-columns: repeat(9, 1fr);
  border: 2px solid rgba(83, 243, 255, 0.62);
  border-radius: var(--radius);
  overflow: hidden;
  background: rgba(3, 8, 18, 0.86);
}

.sudoku-cell {
  display: grid;
  min-width: 0;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.16);
  background: rgba(12, 25, 49, 0.62);
  color: var(--cyan);
  font-size: clamp(1rem, 4.4vw, 2rem);
  font-weight: 900;
  cursor: pointer;
}

.sudoku-cell:nth-child(3n) {
  border-right-color: rgba(83, 243, 255, 0.5);
}

.sudoku-cell:nth-child(n + 19):nth-child(-n + 27),
.sudoku-cell:nth-child(n + 46):nth-child(-n + 54) {
  border-bottom-color: rgba(83, 243, 255, 0.5);
}

.sudoku-cell.given {
  color: #ffd166;
  background: rgba(49, 36, 12, 0.82);
}

.sudoku-cell.related {
  background: rgba(83, 243, 255, 0.1);
}

.sudoku-cell.selected {
  outline: 3px solid rgba(255, 79, 216, 0.74);
  outline-offset: -3px;
}

.sudoku-cell.wrong {
  color: var(--danger);
}

.number-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.number-pad button {
  min-height: 46px;
  border: 1px solid rgba(145, 235, 255, 0.22);
  border-radius: var(--radius);
  background: rgba(8, 20, 42, 0.82);
  color: var(--text);
  font-weight: 900;
  cursor: pointer;
}
</style>
