<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";
import { createSwipeHandlers } from "../utils/touch";

const PROGRESS_KEY = "sokoban-level-progress";

const levels = [
  [
    "#######",
    "#   @ #",
    "#   $.#",
    "#     #",
    "#     #",
    "#######",
  ],
  [
    "#######",
    "# .   #",
    "#     #",
    "#  $  #",
    "#  @  #",
    "#######",
  ],
  [
    "########",
    "#      #",
    "#  #   #",
    "#  .   #",
    "#  $#  #",
    "#  @   #",
    "########",
  ],
  [
    "########",
    "#  .   #",
    "# $# . #",
    "#    $@#",
    "#   #  #",
    "#      #",
    "########",
  ],
  [
    "########",
    "#.     #",
    "#  #   #",
    "#$     #",
    "#@$ #  #",
    "# .    #",
    "########",
  ],
  [
    "#########",
    "# +     #",
    "# $##   #",
    "#       #",
    "# $ ##  #",
    "#  .    #",
    "#########",
  ],
  [
    "#########",
    "#+      #",
    "#$ ##   #",
    "#       #",
    "# $.##  #",
    "#       #",
    "#########",
  ],
  [
    "#########",
    "#    . .#",
    "#  ##$  #",
    "#     $ #",
    "#   ##  #",
    "#.  $@  #",
    "#########",
  ],
  [
    "##########",
    "#      . #",
    "#  ## $  #",
    "#  @$  . #",
    "#    ##  #",
    "#    $   #",
    "#  .#    #",
    "##########",
  ],
  [
    "##########",
    "#       .#",
    "#  ##    #",
    "#  +  $  #",
    "#  $ ##  #",
    "#    . $ #",
    "#   #    #",
    "##########",
  ],
  [
    "##########",
    "#        #",
    "#  ## $@ #",
    "#    . $ #",
    "#    ##.$#",
    "#        #",
    "#   #   .#",
    "##########",
  ],
  [
    "##########",
    "#        #",
    "# $##$ $ #",
    "#   .  . #",
    "#  $@##  #",
    "# .    . #",
    "#   #    #",
    "##########",
  ],
  [
    "###########",
    "# .       #",
    "#  ## @$. #",
    "#     #   #",
    "#  $      #",
    "#   #  .$ #",
    "#     ##  #",
    "#     .$  #",
    "###########",
  ],
  [
    "###########",
    "#   . .   #",
    "# .##$    #",
    "# $ $@#   #",
    "#      $  #",
    "#   #     #",
    "#     ##  #",
    "#.        #",
    "###########",
  ],
  [
    "###########",
    "#         #",
    "#  ## . $ #",
    "#     #   #",
    "#      .$@#",
    "#.  #     #",
    "# $   ##$.#",
    "#         #",
    "###########",
  ],
  [
    "###########",
    "#      .  #",
    "#  ##@$   #",
    "# $ $.# . #",
    "#  .   $  #",
    "#.$ #     #",
    "#     ##  #",
    "#         #",
    "###########",
  ],
  [
    "############",
    "#          #",
    "# $##@     #",
    "# .  $#    #",
    "#.     . . #",
    "#   #  ##$ #",
    "#          #",
    "#    ## $$ #",
    "#         .#",
    "############",
  ],
  [
    "############",
    "#          #",
    "#  ## .$ $ #",
    "#   . # $ .#",
    "#   $@  .  #",
    "#.  #  ##  #",
    "#  $       #",
    "#    ##    #",
    "#          #",
    "############",
  ],
  [
    "############",
    "#          #",
    "#. ## $    #",
    "#     #    #",
    "#    .    .#",
    "# $+#  ##  #",
    "# .$       #",
    "#.$ $##  $ #",
    "#          #",
    "############",
  ],
  [
    "############",
    "#      .   #",
    "# .##  $.  #",
    "#     #$ $.#",
    "#   $@.    #",
    "#   #  ##$ #",
    "#  $       #",
    "#    ##    #",
    "#    .     #",
    "############",
  ],
];

const levelInfo = [
  { title: "仓库热身", target: 18, detail: "熟悉推箱规则，把单个能量箱送入目标。" },
  { title: "中央搬运", target: 22, detail: "从中场规划路线，避免绕路。" },
  { title: "窄道转向", target: 24, detail: "利用墙角调整箱子方向。" },
  { title: "双箱同步", target: 38, detail: "先处理靠边目标，再回收中路箱子。" },
  { title: "墙侧推送", target: 40, detail: "不要把箱子压死在左侧边界。" },
  { title: "双线仓库", target: 46, detail: "两只箱子分线推进，先远后近。" },
  { title: "回环通道", target: 48, detail: "绕路少，关键是先打开上侧通道。" },
  { title: "三点归仓", target: 56, detail: "三个目标分散，先做最远点。" },
  { title: "折返货架", target: 64, detail: "利用中间隔断制造回身空间。" },
  { title: "交错目标", target: 66, detail: "每次推动都要留下下一步站位。" },
  { title: "侧翼仓门", target: 72, detail: "右下角目标要提前规划进场方向。" },
  { title: "四箱矩阵", target: 82, detail: "先拆箱群，再逐个送入目标。" },
  { title: "深仓入口", target: 84, detail: "入口狭窄，箱子顺序比距离更重要。" },
  { title: "中心拥堵", target: 92, detail: "别让玩家被箱子和墙同时封住。" },
  { title: "尾仓调度", target: 96, detail: "右侧箱子需要借助下方空间换向。" },
  { title: "目标回廊", target: 104, detail: "优先清理靠近目标的箱子。" },
  { title: "大型仓库 I", target: 118, detail: "多箱多目标，先保留中央机动空间。" },
  { title: "大型仓库 II", target: 124, detail: "把左侧目标和右侧目标分批处理。" },
  { title: "拥挤核心", target: 132, detail: "先解开中路箱群，再处理边角。" },
  { title: "终端仓库", target: 140, detail: "最终关卡，保持每条通路可回收。" },
];

const levelIndex = ref(0);
const walls = ref(new Set());
const goals = ref(new Set());
const boxes = ref(new Set());
const player = ref({ x: 0, y: 0 });
const facing = ref("down");
const width = ref(0);
const height = ref(0);
const moves = ref(0);
const status = ref("把能量箱推入目标点");
const best = ref(getBestScore("sokoban"));
const history = ref([]);
const levelProgress = ref(getSavedValue(PROGRESS_KEY, { cleared: [], perfect: [] }));

const currentLevelInfo = computed(() => levelInfo[levelIndex.value] || { title: `第 ${levelIndex.value + 1} 关`, target: 60, detail: "" });
const levelDone = computed(() => [...boxes.value].every((key) => goals.value.has(key)));
const clearedCount = computed(() => levelProgress.value.cleared?.length || 0);
const perfectCount = computed(() => levelProgress.value.perfect?.length || 0);
const currentCleared = computed(() => levelProgress.value.cleared?.includes(levelIndex.value));
const currentPerfect = computed(() => levelProgress.value.perfect?.includes(levelIndex.value));
const chapterProgress = computed(() => Math.round((clearedCount.value / levels.length) * 100));
const cells = computed(() => {
  const result = [];
  for (let y = 0; y < height.value; y += 1) {
    for (let x = 0; x < width.value; x += 1) {
      const key = toKey(x, y);
      result.push({
        key,
        wall: walls.value.has(key),
        goal: goals.value.has(key),
        box: boxes.value.has(key),
        player: player.value.x === x && player.value.y === y,
        facing: player.value.x === x && player.value.y === y ? facing.value : "",
      });
    }
  }
  return result;
});

function toKey(x, y) {
  return `${x},${y}`;
}

function parseLevel() {
  const map = levels[levelIndex.value];
  width.value = Math.max(...map.map((row) => row.length));
  height.value = map.length;
  walls.value = new Set();
  goals.value = new Set();
  boxes.value = new Set();
  map.forEach((row, y) => {
    [...row.padEnd(width.value, " ")].forEach((char, x) => {
      const key = toKey(x, y);
      if (char === "#") walls.value.add(key);
      if (char === "." || char === "+" || char === "*") goals.value.add(key);
      if (char === "$" || char === "*") boxes.value.add(key);
      if (char === "@" || char === "+") player.value = { x, y };
    });
  });
  moves.value = 0;
  facing.value = "down";
  history.value = [];
  status.value = `${currentLevelInfo.value.title} · 第 ${levelIndex.value + 1}/${levels.length} 关`;
}

function restart() {
  parseLevel();
}

function snapshot() {
  return {
    player: { ...player.value },
    facing: facing.value,
    boxes: new Set(boxes.value),
    moves: moves.value,
  };
}

function undo() {
  if (levelDone.value) return;
  const last = history.value.pop();
  if (!last) return;
  player.value = last.player;
  facing.value = last.facing;
  boxes.value = last.boxes;
  moves.value = last.moves;
  status.value = "已撤销一步";
}

function markLevelComplete() {
  const cleared = new Set(levelProgress.value.cleared || []);
  const perfect = new Set(levelProgress.value.perfect || []);
  cleared.add(levelIndex.value);
  if (moves.value <= currentLevelInfo.value.target) perfect.add(levelIndex.value);
  levelProgress.value = {
    cleared: [...cleared].sort((a, b) => a - b),
    perfect: [...perfect].sort((a, b) => a - b),
  };
  setSavedValue(PROGRESS_KEY, levelProgress.value);
  best.value = setBestScore("sokoban", Math.max(best.value, levelIndex.value + 1));
}

function move(direction) {
  if (levelDone.value) return;
  const dirs = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const [dx, dy] = dirs[direction];
  const next = { x: player.value.x + dx, y: player.value.y + dy };
  const nextKey = toKey(next.x, next.y);
  if (walls.value.has(nextKey)) return;

  const nextBoxes = new Set(boxes.value);
  if (nextBoxes.has(nextKey)) {
    const beyond = { x: next.x + dx, y: next.y + dy };
    const beyondKey = toKey(beyond.x, beyond.y);
    if (walls.value.has(beyondKey) || nextBoxes.has(beyondKey)) return;
    history.value.push(snapshot());
    nextBoxes.delete(nextKey);
    nextBoxes.add(beyondKey);
    boxes.value = nextBoxes;
  } else {
    history.value.push(snapshot());
  }

  player.value = next;
  facing.value = direction;
  moves.value += 1;
  if (levelDone.value) {
    markLevelComplete();
    status.value =
      moves.value <= currentLevelInfo.value.target
        ? `${currentLevelInfo.value.title} 完美完成`
        : `${currentLevelInfo.value.title} 完成`;
  } else {
    status.value = "继续推进";
  }
}

function nextLevel() {
  levelIndex.value = (levelIndex.value + 1) % levels.length;
  restart();
}

function switchLevel(index) {
  levelIndex.value = index;
  restart();
}

function onKey(event) {
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
  };
  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
}

const swipe = createSwipeHandlers(move);

onMounted(() => {
  restart();
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <GameLayout game-id="sokoban" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd" @touchmove.prevent>
        <div
          class="sokoban-board"
          :style="{
            gridTemplateColumns: `repeat(${width}, 1fr)`,
            gridTemplateRows: `repeat(${height}, 1fr)`,
            aspectRatio: `${width} / ${height}`,
          }"
        >
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="sokoban-cell"
            :class="{ wall: cell.wall, goal: cell.goal, box: cell.box, player: cell.player, done: cell.box && cell.goal }"
          >
            <span v-if="cell.goal && !cell.wall" class="goal-marker" aria-hidden="true">
              <span class="goal-core"></span>
            </span>
            <span v-if="cell.box" class="box-art" aria-label="箱子">
              <span class="box-strap vertical"></span>
              <span class="box-strap horizontal"></span>
              <span class="box-emblem"></span>
            </span>
            <span v-if="cell.player" class="worker-art" :class="`facing-${cell.facing}`" aria-label="人物">
              <span class="worker-shadow"></span>
              <span class="worker-legs"></span>
              <span class="worker-body"></span>
              <span class="worker-head"></span>
              <span class="worker-cap"></span>
            </span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>关卡</h2>
        <div class="level-panel">
          <h3>{{ currentLevelInfo.title }}</h3>
          <p>{{ currentLevelInfo.detail }}</p>
          <div class="mini-stat-grid">
            <div>
              <span>目标步数</span>
              <strong>{{ currentLevelInfo.target }}</strong>
            </div>
            <div>
              <span>本关状态</span>
              <strong>{{ currentPerfect ? "完美" : currentCleared ? "已通关" : "未通关" }}</strong>
            </div>
            <div>
              <span>已通关</span>
              <strong>{{ clearedCount }}/{{ levels.length }}</strong>
            </div>
            <div>
              <span>完美</span>
              <strong>{{ perfectCount }}</strong>
            </div>
          </div>
          <div class="level-meter" aria-label="关卡总进度">
            <span :style="{ width: `${chapterProgress}%` }"></span>
          </div>
          <span v-if="levelDone" class="level-note">本关完成，进入下一关继续挑战</span>
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
        <button class="pill-button" type="button" @click="undo">撤销一步</button>
        <p>方向键或 WASD 推箱子，移动端在棋盘上滑动。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.sokoban-board {
  display: grid;
  gap: clamp(3px, 0.75cqw, 6px);
  width: min(90vw, 620px);
  padding: clamp(7px, 1.2cqw, 12px);
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at 24% 18%, rgba(255, 209, 102, 0.08), transparent 26%),
    linear-gradient(135deg, rgba(6, 15, 32, 0.96), rgba(3, 8, 18, 0.9));
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.28),
    inset 0 0 28px rgba(83, 243, 255, 0.08);
}

.sokoban-cell {
  display: grid;
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  overflow: hidden;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.1);
  border-radius: 5px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 44%),
    rgba(12, 25, 49, 0.58);
  box-shadow: inset 0 0 18px rgba(2, 6, 14, 0.52);
}

.sokoban-cell.wall {
  border-color: rgba(145, 235, 255, 0.2);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.07), transparent 36%),
    repeating-linear-gradient(135deg, rgba(42, 74, 102, 0.92) 0 9px, rgba(17, 34, 58, 0.96) 9px 18px);
  box-shadow:
    inset 0 0 16px rgba(83, 243, 255, 0.14),
    inset 0 -6px 14px rgba(0, 0, 0, 0.34);
}

.goal-marker,
.box-art,
.worker-art,
.worker-art > span {
  position: absolute;
  pointer-events: none;
}

.goal-marker {
  inset: 14%;
  z-index: 1;
  display: grid;
  place-items: center;
  border: 2px solid rgba(255, 224, 102, 0.95);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 245, 178, 0.94) 0 13%, rgba(255, 209, 102, 0.3) 14% 34%, transparent 35%),
    conic-gradient(from 45deg, rgba(255, 209, 102, 0), rgba(255, 209, 102, 0.9), rgba(83, 243, 255, 0.38), rgba(255, 209, 102, 0));
  box-shadow:
    0 0 12px rgba(255, 209, 102, 0.86),
    0 0 24px rgba(83, 243, 255, 0.42),
    inset 0 0 12px rgba(255, 255, 255, 0.22);
  animation:
    goal-pulse 1.35s ease-in-out infinite,
    goal-spin 4.8s linear infinite;
}

.goal-marker::before,
.goal-marker::after {
  position: absolute;
  content: "";
  border-radius: 50%;
}

.goal-marker::before {
  inset: -24%;
  border: 1px solid rgba(255, 209, 102, 0.5);
  animation: goal-wave 1.35s ease-out infinite;
}

.goal-marker::after {
  inset: 28%;
  background: #fff4a8;
  box-shadow: 0 0 12px rgba(255, 245, 178, 0.95);
}

.goal-core {
  width: 16%;
  height: 16%;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 10px #ffffff;
}

.box-art {
  inset: 0;
  z-index: 3;
  overflow: hidden;
  border: 2px solid rgba(92, 43, 11, 0.9);
  border-radius: 4px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.32), transparent 26%),
    linear-gradient(315deg, rgba(96, 43, 12, 0.7), transparent 44%),
    linear-gradient(135deg, #f7a43f 0%, #d96f1d 54%, #a83f13 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 220, 142, 0.42),
    inset 0 -10px 18px rgba(79, 31, 11, 0.34),
    0 2px 8px rgba(0, 0, 0, 0.32);
}

.box-art::before,
.box-art::after {
  position: absolute;
  content: "";
  inset: 8%;
  border: 1px solid rgba(103, 45, 13, 0.34);
  border-radius: 3px;
}

.box-art::after {
  inset: 0;
  background:
    linear-gradient(45deg, transparent 48%, rgba(111, 50, 15, 0.48) 49% 51%, transparent 52%),
    linear-gradient(135deg, transparent 48%, rgba(255, 229, 157, 0.28) 49% 51%, transparent 52%);
}

.box-strap {
  z-index: 1;
  border-radius: 999px;
  background: linear-gradient(90deg, #73310d, #a84b16, #612707);
  box-shadow: inset 0 0 0 1px rgba(255, 215, 150, 0.2);
}

.box-strap.vertical {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 16%;
  transform: translateX(-50%);
}

.box-strap.horizontal {
  top: 50%;
  right: 0;
  left: 0;
  height: 16%;
  transform: translateY(-50%);
}

.box-emblem {
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 24%;
  height: 24%;
  border: 1px solid rgba(255, 239, 179, 0.58);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 44%, #fff1a8 0 20%, #ffd166 21% 48%, #8f3f12 49%);
  box-shadow: 0 0 10px rgba(255, 209, 102, 0.55);
  transform: translate(-50%, -50%);
}

.sokoban-cell.done .box-art {
  border-color: rgba(165, 255, 119, 0.9);
  box-shadow:
    inset 0 0 0 1px rgba(224, 255, 192, 0.55),
    inset 0 -10px 18px rgba(31, 79, 28, 0.28),
    0 0 18px rgba(125, 255, 111, 0.7);
}

.sokoban-cell.done .box-emblem {
  background:
    radial-gradient(circle at 50% 44%, #f1ffe0 0 20%, #7dff6f 21% 48%, #2c7a25 49%);
}

.worker-art {
  inset: 8%;
  z-index: 4;
  transform-origin: 50% 58%;
  filter: drop-shadow(0 5px 7px rgba(0, 0, 0, 0.34));
}

.worker-shadow {
  right: 10%;
  bottom: 0;
  left: 10%;
  height: 16%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.34);
  filter: blur(1px);
}

.worker-legs {
  right: 22%;
  bottom: 10%;
  left: 22%;
  height: 28%;
  border-radius: 40% 40% 24% 24%;
  background:
    linear-gradient(90deg, #243152 0 42%, transparent 43% 57%, #243152 58%),
    linear-gradient(#3a4a73, #1d2848);
}

.worker-body {
  top: 36%;
  right: 18%;
  left: 18%;
  height: 38%;
  border: 2px solid rgba(255, 246, 191, 0.42);
  border-radius: 42% 42% 32% 32%;
  background:
    linear-gradient(90deg, transparent 0 40%, rgba(255, 246, 191, 0.86) 41% 55%, transparent 56%),
    linear-gradient(135deg, #33d7ff, #0f7bb5 62%, #0b4d87);
  box-shadow:
    inset 0 6px 8px rgba(255, 255, 255, 0.18),
    inset 0 -8px 10px rgba(0, 0, 0, 0.18);
}

.worker-head {
  top: 13%;
  left: 50%;
  width: 42%;
  height: 38%;
  border: 2px solid rgba(93, 47, 20, 0.38);
  border-radius: 46% 46% 50% 50%;
  background:
    radial-gradient(circle at 36% 42%, #332016 0 4%, transparent 5%),
    radial-gradient(circle at 64% 42%, #332016 0 4%, transparent 5%),
    radial-gradient(circle at 50% 62%, rgba(160, 72, 45, 0.72) 0 6%, transparent 7%),
    linear-gradient(#ffd49a, #df925d);
  transform: translateX(-50%);
}

.worker-cap {
  top: 6%;
  left: 50%;
  width: 48%;
  height: 24%;
  border-radius: 50% 50% 28% 28%;
  background:
    radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.36), transparent 34%),
    linear-gradient(135deg, #ff69db, #b829a9 68%, #681a78);
  transform: translateX(-50%);
  box-shadow: 0 2px 0 rgba(68, 18, 72, 0.72);
}

.worker-cap::after {
  position: absolute;
  right: -12%;
  bottom: -5%;
  width: 38%;
  height: 32%;
  content: "";
  border-radius: 999px;
  background: #ff9deb;
  box-shadow: 0 0 8px rgba(255, 79, 216, 0.35);
}

.worker-art.facing-left {
  transform: rotate(-8deg);
}

.worker-art.facing-left .worker-cap::after {
  right: auto;
  left: -12%;
}

.worker-art.facing-right {
  transform: rotate(8deg);
}

.worker-art.facing-up .worker-head {
  background:
    linear-gradient(180deg, #8a4f2a 0 34%, #ffd49a 35% 100%);
}

.worker-art.facing-up .worker-cap::after {
  right: 31%;
  bottom: auto;
  top: -5%;
  width: 36%;
}

.worker-art.facing-down .worker-body {
  animation: worker-bob 0.42s ease-in-out;
}

@keyframes goal-pulse {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.76;
  }

  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@keyframes goal-wave {
  0% {
    transform: scale(0.8);
    opacity: 0.88;
  }

  100% {
    transform: scale(1.42);
    opacity: 0;
  }
}

@keyframes goal-spin {
  to {
    rotate: 1turn;
  }
}

@keyframes worker-bob {
  0%,
  100% {
    translate: 0 0;
  }

  50% {
    translate: 0 -4%;
  }
}
</style>
