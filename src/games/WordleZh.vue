<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const puzzles = [
  { answer: "风和日丽", theme: "天气", hints: ["形容天气很好，适合出门。", "里面有风，也有太阳。", "第一个字是“风”。"] },
  { answer: "车水马龙", theme: "城市", hints: ["形容街上非常热闹。", "常用来说车多人多。", "第一个字是“车”。"] },
  { answer: "欢声笑语", theme: "快乐", hints: ["形容很多人开心说笑。", "前两个字和声音有关。", "第一个字是“欢”。"] },
  { answer: "心想事成", theme: "祝福", hints: ["常用来祝愿愿望实现。", "过年、生日祝福里经常出现。", "第一个字是“心”。"] },
  { answer: "海阔天空", theme: "自然", hints: ["形容空间开阔，也能形容聊天很自由。", "里面有海，也有天。", "第一个字是“海”。"] },
  { answer: "一帆风顺", theme: "祝福", hints: ["祝事情进展顺利。", "画面像船借着风向前走。", "第一个字是“一”。"] },
  { answer: "井井有条", theme: "秩序", hints: ["形容整齐、有条理。", "常用来夸房间、计划或工作安排。", "第一个字是“井”。"] },
  { answer: "万事如意", theme: "祝福", hints: ["祝所有事情都顺心。", "常见于新年祝福。", "第一个字是“万”。"] },
  { answer: "春暖花开", theme: "季节", hints: ["形容春天来了。", "天气变暖，花也开了。", "第一个字是“春”。"] },
  { answer: "落叶归根", theme: "归乡", hints: ["常用来比喻回到故乡或本源。", "画面是叶子落回树根附近。", "第一个字是“落”。"] },
  { answer: "星辰大海", theme: "梦想", hints: ["常用来形容远大的目标和浪漫远方。", "里面有天空里的光，也有海。", "第一个字是“星”。"] },
  { answer: "灯火通明", theme: "夜景", hints: ["形容夜晚灯光很亮。", "常用来写城市、房间或街道。", "第一个字是“灯”。"] },
];
const wordLength = 4;
const maxGuesses = 6;
const today = new Date();
const dailyPuzzleIndex = (today.getFullYear() * 372 + (today.getMonth() + 1) * 31 + today.getDate()) % puzzles.length;
const puzzleIndex = ref(dailyPuzzleIndex);
const input = ref("");
const guesses = ref([]);
const status = ref("猜一个四字词语");
const best = ref(getBestScore("wordle-zh"));
const finished = ref(false);
const revealedHints = ref(1);
const showSuccessCelebration = ref(false);
let celebrationTimer = null;
const fireworkBursts = [
  { x: "18%", y: "26%", color: "#53f3ff", delay: "0s" },
  { x: "78%", y: "22%", color: "#facc15", delay: "0.12s" },
  { x: "50%", y: "16%", color: "#f472b6", delay: "0.22s" },
  { x: "28%", y: "68%", color: "#86efac", delay: "0.32s" },
  { x: "72%", y: "64%", color: "#a78bfa", delay: "0.44s" },
];
const sparkAngles = Array.from({ length: 12 }, (_, index) => `${index * 30}deg`);

const puzzle = computed(() => puzzles[puzzleIndex.value]);
const target = computed(() => puzzle.value.answer);
const candidateWords = computed(() => puzzles.map((item) => item.answer));
const visibleHints = computed(() => puzzle.value.hints.slice(0, revealedHints.value));
const won = computed(() => finished.value && guesses.value.at(-1) === target.value);
const rows = computed(() =>
  Array.from({ length: maxGuesses }, (_, index) => {
    if (guesses.value[index]) return guesses.value[index];
    if (!finished.value && index === guesses.value.length) return input.value.trim();
    return "";
  }),
);
const remaining = computed(() => maxGuesses - guesses.value.length);
const inputChars = computed(() => [...input.value.trim()].slice(0, wordLength));
const score = computed(() => {
  if (!finished.value || guesses.value.at(-1) !== target.value) return 0;
  const hintPenalty = Math.max(0, revealedHints.value - 1) * 40;
  return Math.max(100, (maxGuesses + 1 - guesses.value.length) * 120 - hintPenalty);
});

function rowState(row, rowIndex, colIndex) {
  if (rowIndex < guesses.value.length) return evaluate(row)[colIndex];
  if (rowIndex === guesses.value.length && inputChars.value[colIndex]) return "typing";
  return "empty";
}

function evaluate(word) {
  return [...word].map((char, index) => {
    if (target.value[index] === char) return "hit";
    if ([...target.value].includes(char)) return "near";
    return "miss";
  });
}

function clearCelebrationTimer() {
  if (!celebrationTimer) return;
  window.clearTimeout(celebrationTimer);
  celebrationTimer = null;
}

function showCelebration() {
  clearCelebrationTimer();
  showSuccessCelebration.value = true;
  celebrationTimer = window.setTimeout(() => {
    showSuccessCelebration.value = false;
    celebrationTimer = null;
  }, 5000);
}

function resetRound(nextStatus = "猜一个四字词语") {
  clearCelebrationTimer();
  showSuccessCelebration.value = false;
  input.value = "";
  guesses.value = [];
  finished.value = false;
  revealedHints.value = 1;
  status.value = nextStatus;
}

function submit() {
  const word = input.value.trim();
  if ([...word].length !== wordLength) {
    status.value = "请输入 4 个汉字";
    return;
  }
  if (finished.value || guesses.value.length >= maxGuesses) return;
  guesses.value.push(word);
  input.value = "";
  if (word === target.value) {
    finished.value = true;
    status.value = `猜对了：${target.value}`;
    best.value = setBestScore("wordle-zh", score.value);
    showCelebration();
  } else if (guesses.value.length >= maxGuesses) {
    finished.value = true;
    status.value = `答案：${target.value}`;
  } else {
    status.value = `继续猜词，还剩 ${remaining.value} 次`;
  }
}

function showHint() {
  if (revealedHints.value >= puzzle.value.hints.length) return;
  revealedHints.value += 1;
  status.value = `已给出第 ${revealedHints.value} 条提示`;
}

function selectCandidate(word) {
  if (finished.value) return;
  input.value = word;
  status.value = "已填入候选词，提交后看颜色";
}

function nextPuzzle() {
  puzzleIndex.value = (puzzleIndex.value + 1) % puzzles.length;
  resetRound("已换一题");
}

function restart() {
  resetRound("重新开始本题");
}

onBeforeUnmount(clearCelebrationTimer);
</script>

<template>
  <GameLayout game-id="wordle-zh" :score="score" :best="best" :moves="guesses.length" :status="status" @restart="restart">
    <section class="game-panel split-panel wordle-panel">
      <div class="board-shell">
        <div v-if="won && showSuccessCelebration" class="wordle-success-layer" role="status" aria-live="polite">
          <div class="fireworks" aria-hidden="true">
            <span
              v-for="burst in fireworkBursts"
              :key="`${burst.x}-${burst.y}`"
              class="firework-burst"
              :style="{ '--x': burst.x, '--y': burst.y, '--firework-color': burst.color, '--delay': burst.delay }"
            >
              <i
                v-for="angle in sparkAngles"
                :key="angle"
                :style="{ '--angle': angle }"
              ></i>
            </span>
          </div>
          <div class="success-card">
            <span>猜对了</span>
            <strong>{{ target }}</strong>
            <small>用了 {{ guesses.length }} 次，得分 {{ score }}</small>
          </div>
        </div>
        <div class="wordle-play-area">
          <div class="wordle-intro">
            <h2>猜一个四字词语</h2>
            <p>默认每天换一题，重新开局不会换答案；想立即换题可以点右侧“换一题”。</p>
            <div class="wordle-legend" aria-label="颜色说明">
              <span><i class="hit"></i>字和位置都对</span>
              <span><i class="near"></i>有这个字，位置不对</span>
              <span><i class="miss"></i>没有这个字</span>
            </div>
          </div>

          <div class="wordle-clue-box">
            <div>
              <span>本题主题</span>
              <strong>{{ puzzle.theme }}</strong>
            </div>
            <ul>
              <li v-for="hint in visibleHints" :key="hint">{{ hint }}</li>
            </ul>
          </div>

          <form class="wordle-form" @submit.prevent="submit">
            <label class="field">
              <span>输入四字词语</span>
              <input
                v-model="input"
                maxlength="4"
                :disabled="finished"
                placeholder="例如：星海漫游"
                autocomplete="off"
              />
            </label>
            <button class="pill-button primary" type="submit" :disabled="finished">提交</button>
          </form>

          <div class="wordle-board" aria-label="中文猜词棋盘">
            <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="wordle-row">
              <span
                v-for="col in wordLength"
                :key="col"
                class="wordle-cell"
                :class="rowState(row, rowIndex, col - 1)"
              >
                {{ [...row][col - 1] || "" }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>玩法</h2>
          <div class="mini-stat-grid">
            <div>
              <span>剩余次数</span>
              <strong>{{ remaining }}</strong>
            </div>
            <div>
              <span>提示</span>
              <strong>{{ revealedHints }}/{{ puzzle.hints.length }}</strong>
            </div>
          </div>
        <p>答案就在下面这些候选词里。你可以点候选词快速填入，也可以自己输入任意 4 个汉字试探。</p>
        <div class="word-bank" aria-label="候选词库">
          <button
            v-for="word in candidateWords"
            :key="word"
            type="button"
            :disabled="finished"
            @click="selectCandidate(word)"
          >
            {{ word }}
          </button>
        </div>
        <p>例：提交“星海漫游”，如果“星”变绿，说明第 1 个字就是“星”；如果变黄，说明答案里有“星”但不在第 1 位。</p>
        <button class="pill-button primary" type="button" :disabled="revealedHints >= puzzle.hints.length" @click="showHint">再给一个提示</button>
        <button class="pill-button" type="button" @click="nextPuzzle">换一题</button>
        <button class="pill-button" type="button" @click="restart">重新开局</button>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.wordle-play-area {
  position: relative;
  display: grid;
  width: min(100%, 520px);
  gap: 16px;
  justify-items: stretch;
  padding: 18px;
}

.wordle-panel :deep(.board-shell) {
  position: relative;
  overflow: hidden;
}

.wordle-success-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.success-card {
  display: grid;
  min-width: min(82%, 320px);
  gap: 8px;
  justify-items: center;
  padding: 18px;
  border: 1px solid rgba(134, 239, 172, 0.5);
  border-radius: var(--radius);
  background: rgba(3, 12, 24, 0.86);
  box-shadow: 0 22px 70px rgba(34, 197, 94, 0.28), inset 0 0 28px rgba(83, 243, 255, 0.1);
  animation: success-pop 420ms ease both;
}

.success-card span {
  color: #86efac;
  font-size: 0.85rem;
  font-weight: 900;
}

.success-card strong {
  color: var(--text);
  font-size: clamp(2rem, 8vw, 3.2rem);
  line-height: 1;
}

.success-card small {
  color: var(--muted);
  font-weight: 800;
}

.fireworks {
  position: absolute;
  inset: 0;
}

.firework-burst {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: 8px;
  height: 8px;
  transform: translate(-50%, -50%);
}

.firework-burst::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid var(--firework-color);
  opacity: 0;
  animation: firework-ring 1.2s ease-out var(--delay) both;
}

.firework-burst i {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 12px;
  border-radius: 999px;
  background: var(--firework-color);
  box-shadow: 0 0 14px var(--firework-color);
  transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scaleY(0.4);
  opacity: 0;
  animation: firework-spark 1.2s ease-out var(--delay) both;
}

.wordle-intro {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid rgba(145, 235, 255, 0.16);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.5);
}

.wordle-intro h2,
.wordle-intro p {
  margin: 0;
}

.wordle-intro h2 {
  font-size: 1.15rem;
}

.wordle-intro p {
  color: var(--muted);
  line-height: 1.55;
}

.wordle-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wordle-legend span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid rgba(145, 235, 255, 0.14);
  border-radius: 999px;
  background: rgba(6, 13, 28, 0.62);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.wordle-legend i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.wordle-legend .hit { background: #22c55e; }
.wordle-legend .near { background: #facc15; }
.wordle-legend .miss { background: #475569; }

.wordle-clue-box {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(34, 197, 94, 0.22);
  border-radius: var(--radius);
  background: rgba(10, 34, 24, 0.42);
}

.wordle-clue-box div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wordle-clue-box span {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 800;
}

.wordle-clue-box strong {
  color: #86efac;
  font-size: 1.1rem;
}

.wordle-clue-box ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: var(--text);
  line-height: 1.55;
}

.wordle-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.word-bank {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.word-bank button {
  min-height: 36px;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: 8px;
  background: rgba(8, 20, 42, 0.76);
  color: var(--text);
  font-weight: 900;
  letter-spacing: 0;
  cursor: pointer;
}

.word-bank button:hover:not(:disabled) {
  border-color: rgba(83, 243, 255, 0.58);
  color: var(--cyan);
}

.word-bank button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.wordle-board {
  display: grid;
  gap: 8px;
  width: min(100%, 360px);
  justify-self: center;
}

.wordle-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.wordle-cell {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.22);
  border-radius: var(--radius);
  background: rgba(12, 25, 49, 0.72);
  font-size: clamp(1.4rem, 8vw, 2.4rem);
  font-weight: 900;
}

.wordle-cell.hit { background: rgba(34, 197, 94, 0.72); }
.wordle-cell.near { background: rgba(250, 204, 21, 0.72); }
.wordle-cell.miss { background: rgba(51, 65, 85, 0.86); }
.wordle-cell.typing {
  border-color: rgba(83, 243, 255, 0.54);
  background: rgba(83, 243, 255, 0.12);
  color: var(--cyan);
}

.wordle-cell.empty::after {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(145, 235, 255, 0.16);
}

@keyframes success-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes firework-ring {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }
  18% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: scale(5.4);
  }
}

@keyframes firework-spark {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scaleY(0.2);
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-56px) scaleY(1);
  }
}

@media (max-width: 860px) {
  .wordle-play-area {
    height: 100%;
    gap: 8px;
    align-content: start;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 8px;
  }

  .wordle-intro {
    gap: 5px;
    padding: 8px;
  }

  .wordle-intro p,
  .wordle-legend {
    display: none;
  }

  .wordle-clue-box {
    gap: 6px;
    padding: 8px;
  }

  .wordle-clue-box ul {
    gap: 4px;
    line-height: 1.35;
    font-size: 0.82rem;
  }

  .wordle-form {
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .wordle-board {
    width: min(100%, 260px);
    gap: 5px;
  }

  .wordle-row {
    gap: 5px;
  }

  .wordle-cell {
    border-radius: 8px;
    font-size: 1.35rem;
  }
}

@media (max-width: 430px), (max-height: 720px) {
  .wordle-intro {
    display: none;
  }

  .wordle-clue-box li:not(:first-child) {
    display: none;
  }

  .wordle-board {
    width: min(100%, 224px);
  }

  .wordle-cell {
    font-size: 1.12rem;
  }
}
</style>
