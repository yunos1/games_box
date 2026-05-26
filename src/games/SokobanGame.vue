<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";

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
  history.value = [];
  status.value = `${currentLevelInfo.value.title} · 第 ${levelIndex.value + 1}/${levels.length} 关`;
}

function restart() {
  parseLevel();
}

function snapshot() {
  return {
    player: { ...player.value },
    boxes: new Set(boxes.value),
    moves: moves.value,
  };
}

function undo() {
  if (levelDone.value) return;
  const last = history.value.pop();
  if (!last) return;
  player.value = last.player;
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

onMounted(() => {
  restart();
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <GameLayout game-id="sokoban" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="sokoban-board" :style="{ gridTemplateColumns: `repeat(${width}, 1fr)` }">
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="sokoban-cell"
            :class="{ wall: cell.wall, goal: cell.goal, box: cell.box, player: cell.player, done: cell.box && cell.goal }"
          >
            <span v-if="cell.player">◆</span>
            <span v-else-if="cell.box">■</span>
            <span v-else-if="cell.goal">◎</span>
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
        <p>方向键或 WASD 推箱子，移动端使用下面方向键。</p>
        <div class="d-pad">
          <button class="up" type="button" @click="move('up')">↑</button>
          <button class="left" type="button" @click="move('left')">←</button>
          <button class="center" type="button" @click="undo">↶</button>
          <button class="right" type="button" @click="move('right')">→</button>
          <button class="down" type="button" @click="move('down')">↓</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.sokoban-board {
  display: grid;
  gap: 5px;
  width: min(90vw, 560px);
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.86);
}

.sokoban-cell {
  display: grid;
  aspect-ratio: 1;
  min-width: 0;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.1);
  border-radius: 4px;
  background: rgba(12, 25, 49, 0.54);
  color: var(--cyan);
  font-size: clamp(1rem, 4vw, 1.8rem);
  font-weight: 900;
}

.sokoban-cell.wall {
  background: linear-gradient(135deg, #193248, #0b1628);
  box-shadow: inset 0 0 16px rgba(83, 243, 255, 0.12);
}

.sokoban-cell.goal {
  color: var(--yellow);
}

.sokoban-cell.box {
  color: #f97316;
  text-shadow: 0 0 14px rgba(249, 115, 22, 0.8);
}

.sokoban-cell.done {
  color: var(--green);
}

.sokoban-cell.player {
  color: var(--pink);
  text-shadow: 0 0 14px rgba(255, 79, 216, 0.8);
}
</style>
