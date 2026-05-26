<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";

const colors = ["#53f3ff", "#ff4fd8", "#ffd166", "#7dff6f", "#a78bfa"];
const PROGRESS_KEY = "zuma-chapter-progress";
const chapters = [
  {
    title: "轨道热身",
    detail: "两波短链练习，适合熟悉插入和连锁。",
    waves: 2,
    startLength: 9,
    growth: 2,
    maxChain: 23,
    baseProgress: 12,
    speed: 0.78,
    spawnChance: 0.16,
    perfectScore: 900,
  },
  {
    title: "双环推进",
    detail: "球链更长，失误会让轨道压力明显上升。",
    waves: 3,
    startLength: 10,
    growth: 2,
    maxChain: 24,
    baseProgress: 14,
    speed: 0.92,
    spawnChance: 0.2,
    perfectScore: 1500,
  },
  {
    title: "色彩洪流",
    detail: "高频新球进入轨道，连锁消除价值更高。",
    waves: 3,
    startLength: 12,
    growth: 3,
    maxChain: 25,
    baseProgress: 16,
    speed: 1.05,
    spawnChance: 0.24,
    perfectScore: 2100,
  },
  {
    title: "核心回廊",
    detail: "四波连续防守，必须保持轨道空间。",
    waves: 4,
    startLength: 13,
    growth: 3,
    maxChain: 26,
    baseProgress: 18,
    speed: 1.16,
    spawnChance: 0.27,
    perfectScore: 3000,
  },
  {
    title: "终端封锁",
    detail: "最终五波挑战，球链速度和密度都会更高。",
    waves: 5,
    startLength: 14,
    growth: 3,
    maxChain: 27,
    baseProgress: 20,
    speed: 1.28,
    spawnChance: 0.3,
    perfectScore: 4200,
  },
];

const chain = ref([]);
const current = ref(0);
const next = ref(1);
const score = ref(0);
const best = ref(getBestScore("zuma"));
const chapterIndex = ref(0);
const wave = ref(1);
const progress = ref(16);
const status = ref("点击轨道插入能量球");
const running = ref(true);
const chapterFinished = ref(false);
const levelProgress = ref(getSavedValue(PROGRESS_KEY, { cleared: [], perfect: [] }));
let timer = 0;

const currentChapter = computed(() => chapters[chapterIndex.value]);
const clearedCount = computed(() => levelProgress.value.cleared?.length || 0);
const perfectCount = computed(() => levelProgress.value.perfect?.length || 0);
const currentCleared = computed(() => levelProgress.value.cleared?.includes(chapterIndex.value));
const currentPerfect = computed(() => levelProgress.value.perfect?.includes(chapterIndex.value));
const chapterProgress = computed(() => Math.round((clearedCount.value / chapters.length) * 100));
const displayWave = computed(() => `${chapterIndex.value + 1}-${wave.value}`);

function randomColor() {
  return Math.floor(Math.random() * colors.length);
}

function colorValue(index) {
  return colors[index];
}

function makeChain(length) {
  const result = [];
  while (result.length < length) {
    const color = randomColor();
    const last = result.at(-1);
    const beforeLast = result.at(-2);
    if (last === color && beforeLast === color) continue;
    result.push(color);
  }
  return result;
}

function startWave() {
  const length = Math.min(
    currentChapter.value.maxChain - 4,
    currentChapter.value.startLength + (wave.value - 1) * currentChapter.value.growth,
  );
  chain.value = makeChain(length);
  progress.value = currentChapter.value.baseProgress;
  running.value = true;
  chapterFinished.value = false;
  status.value = `${currentChapter.value.title} · 第 ${wave.value}/${currentChapter.value.waves} 波`;
}

function restartChapter(resetScore = true) {
  if (resetScore) score.value = 0;
  wave.value = 1;
  current.value = randomColor();
  next.value = randomColor();
  startWave();
}

function restartRun() {
  chapterIndex.value = 0;
  restartChapter(true);
}

function switchChapter(index) {
  chapterIndex.value = index;
  restartChapter(true);
}

function nextChapter() {
  if (!chapterFinished.value || chapterIndex.value >= chapters.length - 1) return;
  chapterIndex.value += 1;
  restartChapter(false);
}

function markChapterComplete() {
  const cleared = new Set(levelProgress.value.cleared || []);
  const perfect = new Set(levelProgress.value.perfect || []);
  cleared.add(chapterIndex.value);
  if (score.value >= currentChapter.value.perfectScore) perfect.add(chapterIndex.value);
  levelProgress.value = {
    cleared: [...cleared].sort((a, b) => a - b),
    perfect: [...perfect].sort((a, b) => a - b),
  };
  setSavedValue(PROGRESS_KEY, levelProgress.value);
  score.value += 320 + currentChapter.value.waves * 90 + Math.max(0, 100 - Math.round(progress.value)) * 4;
  best.value = setBestScore("zuma", score.value);
}

function removeMatches() {
  let total = 0;
  let combo = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const nextChain = [];
    for (let index = 0; index < chain.value.length;) {
      let end = index + 1;
      while (end < chain.value.length && chain.value[end] === chain.value[index]) end += 1;
      const length = end - index;
      if (length >= 3) {
        total += length;
        combo += 1;
        changed = true;
      } else {
        nextChain.push(...chain.value.slice(index, end));
      }
      index = end;
    }
    if (changed) chain.value = nextChain;
  }
  if (total > 0) {
    const gained = total * (42 + chapterIndex.value * 6) + Math.max(0, combo - 1) * 95;
    score.value += gained;
    progress.value = Math.max(4, progress.value - total * 3.2 - combo * 1.5);
    best.value = setBestScore("zuma", score.value);
    status.value = combo > 1 ? `连锁 ${combo} 次，消除 ${total} 颗` : `消除 ${total} 颗能量球`;
  }
  return total;
}

function insertAt(index) {
  if (!running.value || chapterFinished.value) return;
  chain.value.splice(index, 0, current.value);
  current.value = next.value;
  next.value = randomColor();
  const removed = removeMatches();
  if (!removed) {
    progress.value += 4.5 + chapterIndex.value * 0.4;
    status.value = "球链继续推进";
  }
  checkState();
}

function nextWave() {
  if (wave.value >= currentChapter.value.waves) {
    running.value = false;
    chapterFinished.value = true;
    markChapterComplete();
    status.value =
      chapterIndex.value >= chapters.length - 1
        ? "终端封锁解除"
        : `${currentChapter.value.title} 完成`;
    return;
  }
  wave.value += 1;
  score.value += 220 + wave.value * 45 + chapterIndex.value * 60;
  best.value = setBestScore("zuma", score.value);
  startWave();
}

function checkState() {
  if (chain.value.length === 0) {
    nextWave();
    return;
  }
  if (progress.value >= 100 || chain.value.length >= currentChapter.value.maxChain) {
    running.value = false;
    progress.value = 100;
    status.value = "球链抵达终点";
    best.value = setBestScore("zuma", score.value);
  }
}

function update() {
  if (!running.value || chapterFinished.value) return;
  progress.value += currentChapter.value.speed + wave.value * 0.06 + chain.value.length * 0.02;
  if (Math.random() < currentChapter.value.spawnChance && chain.value.length < currentChapter.value.maxChain - 2) {
    chain.value.unshift(randomColor());
  }
  checkState();
}

onMounted(() => {
  restartRun();
  timer = window.setInterval(update, 900);
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <GameLayout game-id="zuma" :score="score" :best="best" :moves="displayWave" :status="status" @restart="restartRun">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="zuma-stage">
          <div class="zuma-progress">
            <span :style="{ width: `${progress}%` }"></span>
          </div>
          <div class="zuma-track" :class="{ stopped: !running }">
            <button
              v-for="(ball, index) in chain"
              :key="`${index}-${ball}`"
              class="zuma-ball"
              type="button"
              :style="{ '--ball-color': colorValue(ball) }"
              :aria-label="`插入到第 ${index + 1} 颗前`"
              @click="insertAt(index)"
            ></button>
            <button class="zuma-slot" type="button" aria-label="插入到队尾" @click="insertAt(chain.length)">+</button>
          </div>
          <div class="zuma-shooter">
            <span class="zuma-core" :style="{ '--ball-color': colorValue(current) }"></span>
            <span class="zuma-ray"></span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>章节</h2>
        <div class="level-panel">
          <h3>{{ currentChapter.title }}</h3>
          <p>{{ currentChapter.detail }}</p>
          <div class="mini-stat-grid">
            <div>
              <span>波次目标</span>
              <strong>{{ wave }}/{{ currentChapter.waves }}</strong>
            </div>
            <div>
              <span>完美分</span>
              <strong>{{ currentChapter.perfectScore }}</strong>
            </div>
            <div>
              <span>章节状态</span>
              <strong>{{ currentPerfect ? "完美" : currentCleared ? "已通关" : "未完成" }}</strong>
            </div>
            <div>
              <span>轨道压力</span>
              <strong>{{ Math.round(progress) }}%</strong>
            </div>
          </div>
          <div class="level-meter" aria-label="祖玛章节进度">
            <span :style="{ width: `${chapterProgress}%` }"></span>
          </div>
          <span v-if="chapterFinished" class="level-note">{{ chapterIndex >= chapters.length - 1 ? "全部章节完成" : "章节完成，可进入下一章" }}</span>
        </div>
        <div class="level-select-grid">
          <button
            v-for="(_, index) in chapters"
            :key="index"
            type="button"
            :class="{
              active: chapterIndex === index,
              cleared: levelProgress.cleared?.includes(index),
              perfect: levelProgress.perfect?.includes(index),
            }"
            @click="switchChapter(index)"
          >
            {{ index + 1 }}
          </button>
        </div>
        <div class="zuma-ammo">
          <span class="zuma-core large" :style="{ '--ball-color': colorValue(current) }"></span>
          <span class="zuma-core" :style="{ '--ball-color': colorValue(next) }"></span>
        </div>
        <button class="pill-button primary" type="button" :disabled="!running" @click="insertAt(chain.length)">射向队尾</button>
        <button class="pill-button primary" type="button" :disabled="!chapterFinished || chapterIndex >= chapters.length - 1" @click="nextChapter">下一章</button>
        <button class="pill-button" type="button" @click="restartChapter(true)">重开本章</button>
        <p>点击轨道上的球，把当前球插到它前面；三颗及以上同色相连会消除并触发连锁。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.zuma-stage {
  display: grid;
  width: min(92vw, 660px);
  min-height: 420px;
  align-content: center;
  gap: 26px;
  padding: 18px;
}

.zuma-progress {
  height: 10px;
  overflow: hidden;
  border: 1px solid rgba(145, 235, 255, 0.22);
  border-radius: 999px;
  background: rgba(3, 8, 18, 0.76);
}

.zuma-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #53f3ff, #ffd166, #ff5c7c);
  box-shadow: 0 0 18px rgba(255, 92, 124, 0.48);
}

.zuma-track {
  display: flex;
  min-height: 124px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px;
  padding: 18px;
  border: 1px solid rgba(145, 235, 255, 0.2);
  border-radius: var(--radius);
  background:
    linear-gradient(90deg, transparent, rgba(83, 243, 255, 0.1), transparent),
    rgba(4, 10, 22, 0.82);
}

.zuma-track.stopped {
  opacity: 0.78;
}

.zuma-ball,
.zuma-core {
  width: 34px;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  background:
    radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.86), transparent 18%),
    var(--ball-color);
  box-shadow:
    0 0 18px color-mix(in srgb, var(--ball-color), transparent 22%),
    inset -8px -10px 14px rgba(0, 0, 0, 0.24);
  cursor: pointer;
}

.zuma-ball:hover {
  transform: translateY(-3px);
}

.zuma-slot {
  width: 34px;
  aspect-ratio: 1;
  border: 1px dashed rgba(145, 235, 255, 0.55);
  border-radius: 50%;
  background: rgba(83, 243, 255, 0.08);
  color: var(--cyan);
  cursor: pointer;
}

.zuma-shooter {
  display: grid;
  justify-items: center;
  gap: 8px;
}

.zuma-ray {
  width: 2px;
  height: 62px;
  background: linear-gradient(rgba(83, 243, 255, 0.95), transparent);
  box-shadow: 0 0 18px rgba(83, 243, 255, 0.8);
}

.zuma-core {
  display: inline-block;
}

.zuma-core.large {
  width: 54px;
}

.zuma-ammo {
  display: flex;
  align-items: center;
  gap: 14px;
}
</style>
