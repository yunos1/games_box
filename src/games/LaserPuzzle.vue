<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";

const size = 7;
const PROGRESS_KEY = "laser-puzzle-level-progress";
const levels = [
  {
    title: "折光入门",
    detail: "让光束完成两次转向，命中右上角目标。",
    targetMoves: 2,
    source: { x: 0, y: 3, dir: "right" },
    target: { x: 6, y: 1 },
    mirrors: [
      { x: 2, y: 3, type: "\\" },
      { x: 2, y: 1, type: "\\" },
    ],
  },
  {
    title: "阶梯折返",
    detail: "沿上行通道三次折射，接入右侧接收器。",
    targetMoves: 3,
    source: { x: 3, y: 6, dir: "up" },
    target: { x: 6, y: 2 },
    mirrors: [
      { x: 3, y: 4, type: "\\" },
      { x: 5, y: 4, type: "\\" },
      { x: 5, y: 2, type: "\\" },
    ],
  },
  {
    title: "长线校准",
    detail: "四个镜面串联，最后一束光从上沿切入目标。",
    targetMoves: 4,
    source: { x: 0, y: 5, dir: "right" },
    target: { x: 6, y: 0 },
    mirrors: [
      { x: 1, y: 5, type: "\\" },
      { x: 1, y: 2, type: "\\" },
      { x: 4, y: 2, type: "\\" },
      { x: 4, y: 0, type: "\\" },
    ],
  },
  {
    title: "回环矩阵",
    detail: "从右下角反推到左上角，保持每次转向都向内收束。",
    targetMoves: 4,
    source: { x: 6, y: 6, dir: "left" },
    target: { x: 0, y: 0 },
    mirrors: [
      { x: 4, y: 6, type: "/" },
      { x: 4, y: 2, type: "/" },
      { x: 1, y: 2, type: "/" },
      { x: 1, y: 0, type: "/" },
    ],
  },
  {
    title: "深井折线",
    detail: "光束需要一路向下推进，再从右下角落点。",
    targetMoves: 4,
    source: { x: 0, y: 0, dir: "down" },
    target: { x: 6, y: 6 },
    mirrors: [
      { x: 0, y: 2, type: "/" },
      { x: 3, y: 2, type: "/" },
      { x: 3, y: 5, type: "/" },
      { x: 6, y: 5, type: "/" },
    ],
  },
  {
    title: "终端回收",
    detail: "从右上角发射，连续折向左下终端。",
    targetMoves: 4,
    source: { x: 6, y: 0, dir: "down" },
    target: { x: 0, y: 6 },
    mirrors: [
      { x: 6, y: 2, type: "\\" },
      { x: 3, y: 2, type: "\\" },
      { x: 3, y: 5, type: "\\" },
      { x: 0, y: 5, type: "\\" },
    ],
  },
];

const levelIndex = ref(0);
const mirrors = ref([]);
const moves = ref(0);
const best = ref(getBestScore("laser-puzzle"));
const status = ref("旋转镜面校准光路");
const levelProgress = ref(getSavedValue(PROGRESS_KEY, { cleared: [], perfect: [] }));

const currentLevel = computed(() => levels[levelIndex.value]);
const mirrorMap = computed(() => new Map(mirrors.value.map((mirror) => [toKey(mirror.x, mirror.y), mirror])));
const trace = computed(() => calculateTrace());
const hitTarget = computed(() => trace.value.hit);
const score = computed(() => (hitTarget.value ? Math.max(120, 620 + levelIndex.value * 80 - moves.value * 35) : 0));
const clearedCount = computed(() => levelProgress.value.cleared?.length || 0);
const perfectCount = computed(() => levelProgress.value.perfect?.length || 0);
const currentCleared = computed(() => levelProgress.value.cleared?.includes(levelIndex.value));
const currentPerfect = computed(() => levelProgress.value.perfect?.includes(levelIndex.value));
const chapterProgress = computed(() => Math.round((clearedCount.value / levels.length) * 100));
const cells = computed(() => {
  const path = new Set(trace.value.path);
  const result = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const key = toKey(x, y);
      result.push({
        key,
        x,
        y,
        source: currentLevel.value.source.x === x && currentLevel.value.source.y === y,
        sourceDir: currentLevel.value.source.dir,
        target: currentLevel.value.target.x === x && currentLevel.value.target.y === y,
        mirror: mirrorMap.value.get(key),
        beam: path.has(key),
      });
    }
  }
  return result;
});

function toKey(x, y) {
  return `${x},${y}`;
}

function restart() {
  mirrors.value = currentLevel.value.mirrors.map((mirror) => ({ ...mirror }));
  moves.value = 0;
  status.value = `${currentLevel.value.title} · 第 ${levelIndex.value + 1}/${levels.length} 关`;
}

function nextLevel() {
  levelIndex.value = (levelIndex.value + 1) % levels.length;
  restart();
}

function reflect(dir, type) {
  if (type === "/") {
    return { up: "right", right: "up", down: "left", left: "down" }[dir];
  }
  return { up: "left", left: "up", down: "right", right: "down" }[dir];
}

function delta(dir) {
  return {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  }[dir];
}

function calculateTrace() {
  let { x, y, dir } = currentLevel.value.source;
  const path = [];
  const seen = new Set();
  for (let step = 0; step < 80; step += 1) {
    const [dx, dy] = delta(dir);
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= size || y >= size) return { path, hit: false };
    const state = `${x},${y},${dir}`;
    if (seen.has(state)) return { path, hit: false };
    seen.add(state);
    path.push(toKey(x, y));
    if (currentLevel.value.target.x === x && currentLevel.value.target.y === y) return { path, hit: true };
    const mirror = mirrorMap.value.get(toKey(x, y));
    if (mirror) dir = reflect(dir, mirror.type);
  }
  return { path, hit: false };
}

function markLevelComplete() {
  const cleared = new Set(levelProgress.value.cleared || []);
  const perfect = new Set(levelProgress.value.perfect || []);
  cleared.add(levelIndex.value);
  if (moves.value <= currentLevel.value.targetMoves) perfect.add(levelIndex.value);
  levelProgress.value = {
    cleared: [...cleared].sort((a, b) => a - b),
    perfect: [...perfect].sort((a, b) => a - b),
  };
  setSavedValue(PROGRESS_KEY, levelProgress.value);
  best.value = setBestScore("laser-puzzle", score.value);
}

function rotateMirror(cell) {
  if (!cell.mirror || hitTarget.value) return;
  cell.mirror.type = cell.mirror.type === "/" ? "\\" : "/";
  moves.value += 1;
  if (hitTarget.value) {
    markLevelComplete();
    status.value = moves.value <= currentLevel.value.targetMoves ? "完美校准完成" : "光路校准完成";
  } else {
    status.value = "继续调整镜面";
  }
}

function switchLevel(index) {
  levelIndex.value = index;
  restart();
}

restart();
</script>

<template>
  <GameLayout game-id="laser-puzzle" :score="score" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="laser-board">
          <button
            v-for="cell in cells"
            :key="cell.key"
            class="laser-cell"
            :class="{ source: cell.source, target: cell.target, mirror: cell.mirror, beam: cell.beam, hit: cell.target && hitTarget }"
            type="button"
            @click="rotateMirror(cell)"
          >
            <span v-if="cell.source">{{ { up: "▲", down: "▼", left: "◀", right: "▶" }[cell.sourceDir] }}</span>
            <span v-else-if="cell.target">◎</span>
            <span v-else-if="cell.mirror">{{ cell.mirror.type }}</span>
            <span v-else-if="cell.beam">·</span>
          </button>
        </div>
      </div>
      <aside class="control-panel">
        <h2>关卡</h2>
        <div class="level-panel">
          <h3>{{ currentLevel.title }}</h3>
          <p>{{ currentLevel.detail }}</p>
          <div class="mini-stat-grid">
            <div>
              <span>目标步数</span>
              <strong>{{ currentLevel.targetMoves }}</strong>
            </div>
            <div>
              <span>本关状态</span>
              <strong>{{ currentPerfect ? "完美" : currentCleared ? "已校准" : "未完成" }}</strong>
            </div>
            <div>
              <span>已校准</span>
              <strong>{{ clearedCount }}/{{ levels.length }}</strong>
            </div>
            <div>
              <span>完美</span>
              <strong>{{ perfectCount }}</strong>
            </div>
          </div>
          <div class="level-meter" aria-label="光路关卡进度">
            <span :style="{ width: `${chapterProgress}%` }"></span>
          </div>
          <span v-if="hitTarget" class="level-note">光路命中，进入下一关继续校准</span>
        </div>
        <div class="level-select-grid">
          <button
            v-for="(_, index) in levels"
            :key="index"
            type="button"
            :class="{
              active: levelIndex === index,
              cleared: levelProgress.cleared?.includes(index),
              perfect: levelProgress.perfect?.includes(index),
            }"
            @click="switchLevel(index)"
          >
            {{ index + 1 }}
          </button>
        </div>
        <button class="pill-button primary" type="button" @click="nextLevel">下一关</button>
        <p>点击镜面切换 / 与 \\，让激光路径命中目标。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.laser-board {
  display: grid;
  width: min(88vw, 520px);
  aspect-ratio: 1;
  grid-template-columns: repeat(7, 1fr);
  gap: 7px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.laser-cell {
  display: grid;
  min-width: 0;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: var(--radius);
  background: rgba(12, 25, 49, 0.62);
  color: var(--muted);
  font-size: clamp(1.1rem, 5vw, 2.2rem);
  font-weight: 900;
  cursor: pointer;
}

.laser-cell.source {
  color: #ffd166;
}

.laser-cell.target {
  color: #7dff6f;
}

.laser-cell.mirror {
  color: #53f3ff;
  text-shadow: 0 0 14px rgba(83, 243, 255, 0.76);
}

.laser-cell.beam {
  background: rgba(244, 114, 182, 0.22);
  box-shadow: inset 0 0 22px rgba(244, 114, 182, 0.22);
}

.laser-cell.hit {
  border-color: #7dff6f;
  box-shadow: inset 0 0 26px rgba(125, 255, 111, 0.28);
}
</style>
