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
const resultKey = ref(0);

const status = computed(() => {
  if (winner.value === "draw") return "平局，棋盘已满";
  if (winner.value) return `${winner.value} 获胜`;
  if (thinking.value) return "AI 正在计算";
  return `${current.value} 行动`;
});

const resultTitle = computed(() => {
  if (winner.value === "draw") return "平局";
  if (mode.value === "ai") return winner.value === "X" ? "你赢了" : "AI 获胜";
  return `${winner.value} 获胜`;
});

const resultDetail = computed(() => {
  if (winner.value === "draw") return "棋盘已满，势均力敌";
  if (mode.value === "ai") return winner.value === "X" ? "漂亮，三点连线" : "再来一局，换个开局";
  return `${winner.value} 连成一线`;
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
  if (winner.value) resultKey.value += 1;
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
      <div class="board-shell ttt-board-shell">
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
        <Transition name="ttt-end">
          <div
            v-if="winner"
            :key="resultKey"
            class="ttt-result"
            :class="{ draw: winner === 'draw', lose: mode === 'ai' && winner === 'O' }"
            role="status"
            aria-live="polite"
          >
            <span class="ttt-result-mark">{{ winner === "draw" ? "=" : winner }}</span>
            <strong>{{ resultTitle }}</strong>
            <small>{{ resultDetail }}</small>
          </div>
        </Transition>
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
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.ttt-board-shell {
  position: relative;
}

.ttt-cell {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
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

.ttt-result {
  position: absolute;
  inset: 50% auto auto 50%;
  z-index: 2;
  display: grid;
  justify-items: center;
  min-width: min(74%, 310px);
  padding: 18px 22px;
  border: 1px solid rgba(255, 209, 102, 0.48);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 209, 102, 0.28), transparent 58%),
    rgba(5, 10, 22, 0.92);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.4),
    0 0 34px rgba(255, 209, 102, 0.24),
    inset 0 0 24px rgba(255, 209, 102, 0.08);
  pointer-events: none;
  text-align: center;
  transform: translate(-50%, -50%);
}

.ttt-result::before,
.ttt-result::after {
  position: absolute;
  inset: -12px;
  content: "";
  border: 1px solid rgba(255, 209, 102, 0.34);
  border-radius: inherit;
  animation: ttt-result-ring 1s ease-out both;
}

.ttt-result::after {
  inset: -22px;
  animation-delay: 0.12s;
}

.ttt-result.draw {
  border-color: rgba(145, 235, 255, 0.48);
  background:
    radial-gradient(circle at 50% 0%, rgba(83, 243, 255, 0.22), transparent 58%),
    rgba(5, 10, 22, 0.92);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.4),
    0 0 34px rgba(83, 243, 255, 0.18),
    inset 0 0 24px rgba(83, 243, 255, 0.07);
}

.ttt-result.draw::before,
.ttt-result.draw::after {
  border-color: rgba(83, 243, 255, 0.3);
}

.ttt-result.lose {
  border-color: rgba(255, 79, 216, 0.5);
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 79, 216, 0.24), transparent 58%),
    rgba(5, 10, 22, 0.92);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.4),
    0 0 34px rgba(255, 79, 216, 0.2),
    inset 0 0 24px rgba(255, 79, 216, 0.07);
}

.ttt-result.lose::before,
.ttt-result.lose::after {
  border-color: rgba(255, 79, 216, 0.32);
}

.ttt-result-mark {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  margin-bottom: 8px;
  border: 1px solid rgba(236, 254, 255, 0.28);
  border-radius: 50%;
  color: var(--yellow);
  background: rgba(3, 8, 18, 0.72);
  font-size: 2rem;
  font-weight: 900;
  line-height: 1;
  text-shadow: 0 0 16px rgba(255, 209, 102, 0.76);
  animation: ttt-result-mark 0.72s cubic-bezier(0.16, 1.2, 0.32, 1) both;
}

.ttt-result.draw .ttt-result-mark {
  color: var(--cyan);
  text-shadow: 0 0 16px rgba(83, 243, 255, 0.74);
}

.ttt-result.lose .ttt-result-mark {
  color: var(--pink);
  text-shadow: 0 0 16px rgba(255, 79, 216, 0.74);
}

.ttt-result strong {
  color: #ecfeff;
  font-size: clamp(1.25rem, 4.5vw, 1.7rem);
  line-height: 1.1;
}

.ttt-result small {
  margin-top: 7px;
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.35;
}

.ttt-end-enter-active {
  animation: ttt-result-pop 0.58s cubic-bezier(0.16, 1.2, 0.32, 1) both;
}

.ttt-end-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.ttt-end-leave-to {
  opacity: 0;
  transform: translate(-50%, -48%) scale(0.96);
}

@keyframes ttt-result-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -45%) scale(0.78);
  }
  68% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.04);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes ttt-result-mark {
  0% {
    transform: scale(0.42) rotate(-12deg);
  }
  70% {
    transform: scale(1.12) rotate(4deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}

@keyframes ttt-result-ring {
  0% {
    opacity: 0.75;
    transform: scale(0.82);
  }
  100% {
    opacity: 0;
    transform: scale(1.24);
  }
}
</style>
