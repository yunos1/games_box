<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const board = ref(Array(9).fill(""));
const mode = ref("ai");
const current = ref("X");
const winner = ref("");
const winLine = ref([]);
const moves = ref(0);
const xWins = ref(getBestScore("tic-tac-toe"));
const thinking = ref(false);

const status = computed(() => {
  if (winner.value === "draw") return "平局，棋盘已满";
  if (winner.value) return `${winner.value} 获胜`;
  if (thinking.value) return "AI 正在计算";
  return `${current.value} 行动`;
});

function inspect(nextBoard = board.value) {
  for (const line of lines) {
    const [a, b, c] = line;
    if (nextBoard[a] && nextBoard[a] === nextBoard[b] && nextBoard[a] === nextBoard[c]) {
      return { winner: nextBoard[a], line };
    }
  }
  if (nextBoard.every(Boolean)) return { winner: "draw", line: [] };
  return { winner: "", line: [] };
}

function restart() {
  board.value = Array(9).fill("");
  current.value = "X";
  winner.value = "";
  winLine.value = [];
  moves.value = 0;
  thinking.value = false;
}

function finishTurn() {
  const result = inspect();
  winner.value = result.winner;
  winLine.value = result.line;
  if (winner.value === "X") xWins.value = setBestScore("tic-tac-toe", xWins.value + 1);
  if (!winner.value) current.value = current.value === "X" ? "O" : "X";
}

function chooseAiMove() {
  const empty = board.value.map((value, index) => (value ? -1 : index)).filter((index) => index >= 0);
  const findMove = (mark) =>
    empty.find((index) => {
      const test = [...board.value];
      test[index] = mark;
      return inspect(test).winner === mark;
    });

  return (
    findMove("O") ??
    findMove("X") ??
    (board.value[4] ? undefined : 4) ??
    [0, 2, 6, 8].find((index) => !board.value[index]) ??
    empty[0]
  );
}

function aiTurn() {
  if (mode.value !== "ai" || current.value !== "O" || winner.value) return;
  thinking.value = true;
  window.setTimeout(() => {
    const index = chooseAiMove();
    if (index !== undefined) {
      board.value[index] = "O";
      moves.value += 1;
      finishTurn();
    }
    thinking.value = false;
  }, 260);
}

function play(index) {
  if (board.value[index] || winner.value || thinking.value) return;
  if (mode.value === "ai" && current.value === "O") return;
  board.value[index] = current.value;
  moves.value += 1;
  finishTurn();
  aiTurn();
}

function switchMode(nextMode) {
  mode.value = nextMode;
  restart();
}

restart();
</script>

<template>
  <GameLayout
    game-id="tic-tac-toe"
    :best="xWins"
    :moves="moves"
    :status="status"
    @restart="restart"
  >
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="ttt-board">
          <button
            v-for="(cell, index) in board"
            :key="index"
            class="ttt-cell"
            :class="{ x: cell === 'X', o: cell === 'O', win: winLine.includes(index) }"
            type="button"
            :aria-label="`格子 ${index + 1}`"
            @click="play(index)"
          >
            {{ cell }}
          </button>
        </div>
      </div>
      <aside class="control-panel">
        <h2>对战模式</h2>
        <div class="segmented">
          <button type="button" :class="{ active: mode === 'ai' }" @click="switchMode('ai')">挑战 AI</button>
          <button type="button" :class="{ active: mode === 'local' }" @click="switchMode('local')">本地双人</button>
        </div>
        <p>X 先手。AI 会优先取胜、拦截，再争夺中心和角位。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.ttt-board {
  display: grid;
  width: min(86vw, 430px);
  aspect-ratio: 1;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.ttt-cell {
  display: grid;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(7, 16, 31, 0.8);
  color: var(--text);
  font-size: clamp(2.4rem, 12vw, 5rem);
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
}

.ttt-cell.x {
  color: var(--pink);
  text-shadow: 0 0 18px rgba(255, 79, 216, 0.75);
}

.ttt-cell.o {
  color: var(--cyan);
  text-shadow: 0 0 18px rgba(83, 243, 255, 0.75);
}

.ttt-cell.win {
  border-color: var(--yellow);
  box-shadow: inset 0 0 26px rgba(255, 209, 102, 0.18);
}
</style>
