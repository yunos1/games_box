<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";

const size = 9;
const PROGRESS_KEY = "tower-defense-level-progress";
const levels = [
  {
    title: "星门直线",
    detail: "第一条防线，路径短但敌人血量较低。",
    waves: 3,
    startEnergy: 170,
    lives: 10,
    baseHp: 2,
    path: [
      [0, 4], [1, 4], [2, 4], [2, 3], [3, 3], [4, 3], [4, 4], [4, 5],
      [5, 5], [6, 5], [6, 4], [7, 4], [8, 4],
    ],
  },
  {
    title: "折线峡谷",
    detail: "转弯更多，适合在拐点布置升级塔。",
    waves: 4,
    startEnergy: 190,
    lives: 9,
    baseHp: 3,
    path: [
      [0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [5, 4],
      [5, 5], [5, 6], [6, 6], [7, 6], [8, 6],
    ],
  },
  {
    title: "双折回廊",
    detail: "路径更长但出怪更密，能源管理会更紧。",
    waves: 5,
    startEnergy: 210,
    lives: 8,
    baseHp: 4,
    path: [
      [0, 6], [1, 6], [2, 6], [3, 6], [3, 5], [3, 4], [2, 4], [1, 4],
      [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [5, 3], [5, 4], [6, 4],
      [7, 4], [8, 4],
    ],
  },
  {
    title: "终端环线",
    detail: "最终防线，敌人耐久高，需要尽早升级核心塔。",
    waves: 6,
    startEnergy: 240,
    lives: 8,
    baseHp: 5,
    path: [
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3], [3, 3],
      [2, 3], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [6, 6], [6, 7],
      [7, 7], [8, 7],
    ],
  },
];

const towers = ref([]);
const enemies = ref([]);
const levelIndex = ref(0);
const wave = ref(0);
const score = ref(0);
const best = ref(getBestScore("tower-defense"));
const energy = ref(150);
const lives = ref(10);
const active = ref(false);
const spawnLeft = ref(0);
const status = ref("布置炮塔后启动波次");
const levelFinished = ref(false);
const levelProgress = ref(getSavedValue(PROGRESS_KEY, { cleared: [], perfect: [] }));
let timer = 0;
let tickCount = 0;

const currentLevel = computed(() => levels[levelIndex.value]);
const currentPath = computed(() => currentLevel.value.path);
const pathKeys = computed(() => new Set(currentPath.value.map(([x, y]) => `${x},${y}`)));
const clearedCount = computed(() => levelProgress.value.cleared?.length || 0);
const perfectCount = computed(() => levelProgress.value.perfect?.length || 0);
const currentCleared = computed(() => levelProgress.value.cleared?.includes(levelIndex.value));
const currentPerfect = computed(() => levelProgress.value.perfect?.includes(levelIndex.value));
const chapterProgress = computed(() => Math.round((clearedCount.value / levels.length) * 100));
const displayScore = computed(() => score.value + clearedCount.value * 150);

const cells = computed(() => {
  const result = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const key = `${x},${y}`;
      result.push({
        key,
        x,
        y,
        path: pathKeys.value.has(key),
        tower: towers.value.find((tower) => tower.x === x && tower.y === y),
        enemy: enemies.value.find((enemy) => currentPath.value[enemy.step]?.[0] === x && currentPath.value[enemy.step]?.[1] === y),
      });
    }
  }
  return result;
});

function resetLevel(keepScore = false) {
  towers.value = [];
  enemies.value = [];
  wave.value = 0;
  if (!keepScore) score.value = 0;
  energy.value = currentLevel.value.startEnergy;
  lives.value = currentLevel.value.lives;
  active.value = false;
  spawnLeft.value = 0;
  levelFinished.value = false;
  status.value = `${currentLevel.value.title} · 第 ${levelIndex.value + 1}/${levels.length} 关`;
}

function restartRun() {
  levelIndex.value = 0;
  resetLevel(false);
}

function restartLevel() {
  resetLevel(false);
}

function switchLevel(index) {
  levelIndex.value = index;
  resetLevel(false);
}

function nextLevel() {
  if (!levelFinished.value || levelIndex.value >= levels.length - 1) return;
  levelIndex.value += 1;
  resetLevel(true);
}

function buildTower(cell) {
  if (cell.path || active.value || levelFinished.value) return;
  if (cell.tower) {
    if (cell.tower.level >= 3 || energy.value < 45) return;
    cell.tower.level += 1;
    cell.tower.range += 1;
    energy.value -= 45;
    status.value = `炮塔升级到 ${cell.tower.level} 级`;
    return;
  }
  if (energy.value < 50) return;
  towers.value.push({ x: cell.x, y: cell.y, cooldown: 0, level: 1, range: 2 });
  energy.value -= 50;
  status.value = "炮塔已部署";
}

function startWave() {
  if (active.value || lives.value <= 0 || levelFinished.value) return;
  wave.value += 1;
  active.value = true;
  spawnLeft.value = 4 + wave.value * 2 + levelIndex.value;
  status.value = `${currentLevel.value.title} · 第 ${wave.value}/${currentLevel.value.waves} 波`;
}

function attack() {
  towers.value.forEach((tower) => {
    if (tower.cooldown > 0) {
      tower.cooldown -= 1;
      return;
    }
    const target = enemies.value.find((enemy) => {
      const pos = currentPath.value[enemy.step];
      return pos && Math.abs(pos[0] - tower.x) + Math.abs(pos[1] - tower.y) <= tower.range;
    });
    if (!target) return;
    target.hp -= tower.level;
    tower.cooldown = Math.max(1, 3 - tower.level);
  });
  enemies.value = enemies.value.filter((enemy) => {
    if (enemy.hp > 0) return true;
    score.value += 25 + enemy.reward;
    energy.value += 18 + enemy.reward;
    best.value = setBestScore("tower-defense", displayScore.value);
    return false;
  });
}

function markLevelComplete() {
  const cleared = new Set(levelProgress.value.cleared || []);
  const perfect = new Set(levelProgress.value.perfect || []);
  cleared.add(levelIndex.value);
  if (lives.value >= Math.ceil(currentLevel.value.lives * 0.7)) perfect.add(levelIndex.value);
  levelProgress.value = {
    cleared: [...cleared].sort((a, b) => a - b),
    perfect: [...perfect].sort((a, b) => a - b),
  };
  setSavedValue(PROGRESS_KEY, levelProgress.value);
  score.value += 240 + lives.value * 25 + currentLevel.value.waves * 40;
  best.value = setBestScore("tower-defense", displayScore.value);
}

function update() {
  if (lives.value <= 0 || levelFinished.value) return;
  tickCount += 1;
  if (active.value && spawnLeft.value > 0 && tickCount % 2 === 0) {
    enemies.value.push({
      id: Date.now() + Math.random(),
      step: 0,
      hp: currentLevel.value.baseHp + Math.floor(wave.value * 0.8) + levelIndex.value,
      reward: levelIndex.value + Math.floor(wave.value / 2),
    });
    spawnLeft.value -= 1;
  }
  attack();
  enemies.value.forEach((enemy) => {
    enemy.step += 1;
  });
  enemies.value = enemies.value.filter((enemy) => {
    if (enemy.step < currentPath.value.length) return true;
    lives.value -= 1;
    return false;
  });
  if (lives.value <= 0) {
    status.value = "防线失守";
    best.value = setBestScore("tower-defense", displayScore.value);
  } else if (active.value && spawnLeft.value === 0 && enemies.value.length === 0) {
    active.value = false;
    energy.value += 58 + wave.value * 12;
    score.value += wave.value * 35;
    best.value = setBestScore("tower-defense", displayScore.value);
    if (wave.value >= currentLevel.value.waves) {
      levelFinished.value = true;
      markLevelComplete();
      status.value =
        levelIndex.value >= levels.length - 1
          ? "终端环线守住了"
          : `${currentLevel.value.title} 完成`;
    } else {
      status.value = `第 ${wave.value} 波完成，准备下一波`;
    }
  }
}

onMounted(() => {
  resetLevel(false);
  timer = window.setInterval(update, 520);
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <GameLayout game-id="tower-defense" :score="displayScore" :best="best" :moves="`L${levelIndex + 1}-W${wave}`" :status="status" @restart="restartRun">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="td-board">
          <button
            v-for="cell in cells"
            :key="cell.key"
            class="td-cell"
            :class="{ path: cell.path, tower: cell.tower, enemy: cell.enemy }"
            type="button"
            @click="buildTower(cell)"
          >
            <span v-if="cell.enemy">◆</span>
            <span v-else-if="cell.tower">{{ cell.tower.level }}</span>
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
              <span>波次目标</span>
              <strong>{{ wave }}/{{ currentLevel.waves }}</strong>
            </div>
            <div>
              <span>护盾</span>
              <strong>{{ lives }}</strong>
            </div>
            <div>
              <span>能量</span>
              <strong>{{ energy }}</strong>
            </div>
            <div>
              <span>状态</span>
              <strong>{{ currentPerfect ? "完美" : currentCleared ? "已守住" : "未完成" }}</strong>
            </div>
          </div>
          <div class="level-meter" aria-label="塔防关卡进度">
            <span :style="{ width: `${chapterProgress}%` }"></span>
          </div>
          <span v-if="levelFinished" class="level-note">{{ levelIndex >= levels.length - 1 ? "全部防线完成" : "关卡完成，可进入下一关" }}</span>
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
        <button class="pill-button primary" type="button" :disabled="active || levelFinished" @click="startWave">启动波次</button>
        <button class="pill-button primary" type="button" :disabled="!levelFinished || levelIndex >= levels.length - 1" @click="nextLevel">下一关</button>
        <button class="pill-button" type="button" @click="restartLevel">重开本关</button>
        <p>点击空地建塔；非波次期间点击已有炮塔可升级，最高 3 级。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.td-board {
  display: grid;
  width: min(88vw, 520px);
  aspect-ratio: 1;
  grid-template-columns: repeat(9, 1fr);
  gap: 5px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.td-cell {
  display: grid;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: 5px;
  background: rgba(12, 25, 49, 0.6);
  color: var(--cyan);
  font-weight: 900;
}

.td-cell.path { background: rgba(34, 211, 238, 0.18); }
.td-cell.tower { color: #ffd166; text-shadow: 0 0 12px rgba(255, 209, 102, 0.7); }
.td-cell.enemy { color: #ff4fd8; text-shadow: 0 0 12px rgba(255, 79, 216, 0.8); }
</style>
