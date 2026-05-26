<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";

const size = 9;
const PROGRESS_KEY = "dungeon-rogue-floor-progress";

const floors = [
  {
    title: "废弃前厅",
    detail: "清掉巡逻守卫后抵达出口，熟悉地牢节奏。",
    targetTurns: 24,
    startHp: 10,
    map: [
      "#########",
      "#@  #  P#",
      "# # # # #",
      "# e   E #",
      "# ###   #",
      "#   P # #",
      "# # e  X#",
      "#       #",
      "#########",
    ],
  },
  {
    title: "回声走廊",
    detail: "通道更窄，先吃药还是先打精英会影响存活。",
    targetTurns: 30,
    startHp: 10,
    map: [
      "#########",
      "#@ e#  X#",
      "# # # ###",
      "# #   P #",
      "# ### # #",
      "# E   # #",
      "#   # e #",
      "# P     #",
      "#########",
    ],
  },
  {
    title: "碎石矿井",
    detail: "敌人分布在两翼，必须绕行清场才能打开出口。",
    targetTurns: 36,
    startHp: 11,
    map: [
      "#########",
      "#@  # e #",
      "# # # # #",
      "# # P #X#",
      "#   ### #",
      "###   E #",
      "# e #   #",
      "#   P   #",
      "#########",
    ],
  },
  {
    title: "守卫十字",
    detail: "中心区有两名精英，利用药剂保持血量。",
    targetTurns: 42,
    startHp: 12,
    map: [
      "#########",
      "#@   # X#",
      "# ## # ##",
      "# e  E  #",
      "### # ###",
      "#  E   P#",
      "# ## #  #",
      "#P   e  #",
      "#########",
    ],
  },
  {
    title: "遗迹核心",
    detail: "最终楼层，先拆外围守卫，再突破核心精英。",
    targetTurns: 50,
    startHp: 12,
    map: [
      "#########",
      "#@ e  P #",
      "# ### # #",
      "#E  # #X#",
      "# # E # #",
      "# #   # #",
      "# P ### #",
      "#  e    #",
      "#########",
    ],
  },
];

const walls = ref(new Set());
const player = ref({ x: 1, y: 1, hp: 10 });
const enemies = ref([]);
const potions = ref([]);
const exit = ref({ x: 7, y: 7 });
const score = ref(0);
const best = ref(getBestScore("dungeon-rogue"));
const floorIndex = ref(0);
const turns = ref(0);
const status = ref("探索地牢");
const floorFinished = ref(false);
const levelProgress = ref(getSavedValue(PROGRESS_KEY, { cleared: [], perfect: [] }));

const floor = computed(() => floorIndex.value + 1);
const currentFloor = computed(() => floors[floorIndex.value]);
const clearedCount = computed(() => levelProgress.value.cleared?.length || 0);
const perfectCount = computed(() => levelProgress.value.perfect?.length || 0);
const currentCleared = computed(() => levelProgress.value.cleared?.includes(floorIndex.value));
const currentPerfect = computed(() => levelProgress.value.perfect?.includes(floorIndex.value));
const chapterProgress = computed(() => Math.round((clearedCount.value / floors.length) * 100));
const floorScore = computed(() => score.value + clearedCount.value * 120);

const cells = computed(() => {
  const result = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const key = `${x},${y}`;
      const enemy = enemies.value.find((item) => item.x === x && item.y === y);
      result.push({
        key,
        wall: walls.value.has(key),
        player: player.value.x === x && player.value.y === y,
        enemy,
        potion: potions.value.find((potion) => potion.x === x && potion.y === y),
        exit: exit.value.x === x && exit.value.y === y,
      });
    }
  }
  return result;
});

function parseFloor(keepHp = false) {
  const hp = keepHp ? Math.min(12, Math.max(1, player.value.hp + 1)) : currentFloor.value.startHp;
  walls.value = new Set();
  enemies.value = [];
  potions.value = [];
  currentFloor.value.map.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const key = `${x},${y}`;
      if (char === "#") walls.value.add(key);
      if (char === "@") player.value = { x, y, hp };
      if (char === "e" || char === "E") {
        enemies.value.push({
          x,
          y,
          hp: char === "E" ? 3 : 2,
          maxHp: char === "E" ? 3 : 2,
          damage: char === "E" ? 2 : 1,
          score: char === "E" ? 140 : 90,
          elite: char === "E",
        });
      }
      if (char === "P") potions.value.push({ x, y });
      if (char === "X") exit.value = { x, y };
    });
  });
  turns.value = 0;
  floorFinished.value = false;
  status.value = `${currentFloor.value.title} · 第 ${floor.value}/${floors.length} 层`;
}

function restartRun() {
  floorIndex.value = 0;
  score.value = 0;
  parseFloor(false);
}

function restartFloor() {
  parseFloor(false);
}

function nextFloor() {
  if (!floorFinished.value || floorIndex.value >= floors.length - 1) return;
  floorIndex.value += 1;
  parseFloor(true);
}

function switchFloor(index) {
  floorIndex.value = index;
  score.value = 0;
  parseFloor(false);
}

function blocked(x, y) {
  return x < 0 || y < 0 || x >= size || y >= size || walls.value.has(`${x},${y}`);
}

function markFloorComplete() {
  const cleared = new Set(levelProgress.value.cleared || []);
  const perfect = new Set(levelProgress.value.perfect || []);
  cleared.add(floorIndex.value);
  if (turns.value <= currentFloor.value.targetTurns && player.value.hp >= 4) perfect.add(floorIndex.value);
  levelProgress.value = {
    cleared: [...cleared].sort((a, b) => a - b),
    perfect: [...perfect].sort((a, b) => a - b),
  };
  setSavedValue(PROGRESS_KEY, levelProgress.value);
  const bonus = Math.max(80, 320 - turns.value * 4 + player.value.hp * 18);
  score.value += bonus;
  best.value = setBestScore("dungeon-rogue", floorScore.value);
}

function move(dir) {
  if (player.value.hp <= 0 || floorFinished.value) return;
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const nx = player.value.x + delta[0];
  const ny = player.value.y + delta[1];
  if (blocked(nx, ny)) return;

  const enemy = enemies.value.find((item) => item.x === nx && item.y === ny);
  turns.value += 1;
  if (enemy) {
    enemy.hp -= 1;
    player.value.hp -= enemy.damage;
    if (enemy.hp <= 0) {
      enemies.value = enemies.value.filter((item) => item !== enemy);
      score.value += enemy.score;
      best.value = setBestScore("dungeon-rogue", floorScore.value);
      status.value = enemy.elite ? "精英守卫击破" : "守卫击破";
    } else {
      status.value = `交战中，敌人剩余 ${enemy.hp}`;
    }
  } else {
    player.value.x = nx;
    player.value.y = ny;
  }

  const potion = potions.value.find((item) => item.x === player.value.x && item.y === player.value.y);
  if (potion) {
    player.value.hp = Math.min(12, player.value.hp + 4);
    potions.value = potions.value.filter((item) => item !== potion);
    status.value = "恢复生命";
  }

  if (player.value.hp <= 0) {
    status.value = "生命耗尽";
    best.value = setBestScore("dungeon-rogue", floorScore.value);
    return;
  }

  if (player.value.x === exit.value.x && player.value.y === exit.value.y) {
    if (enemies.value.length) {
      status.value = "出口被守卫封锁";
      return;
    }
    floorFinished.value = true;
    markFloorComplete();
    status.value =
      floorIndex.value >= floors.length - 1
        ? "遗迹核心已突破"
        : `${currentFloor.value.title} 完成`;
  } else if (enemies.value.length) {
    status.value = "击败守卫后前往出口";
  } else {
    status.value = "出口已开放";
  }
}

function onKey(event) {
  const map = { ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
  if (!map[event.key]) return;
  event.preventDefault();
  move(map[event.key]);
}

onMounted(() => {
  restartRun();
  window.addEventListener("keydown", onKey);
});
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <GameLayout game-id="dungeon-rogue" :score="floorScore" :best="best" :moves="`F${floor}`" :status="status" @restart="restartRun">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="dungeon-board">
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="dungeon-cell"
            :class="{ wall: cell.wall, player: cell.player, enemy: cell.enemy, elite: cell.enemy?.elite, potion: cell.potion, exit: cell.exit, open: cell.exit && !enemies.length }"
          >
            <span v-if="cell.player">◆</span>
            <span v-else-if="cell.enemy">{{ cell.enemy.elite ? "◆" : "▲" }}</span>
            <span v-else-if="cell.potion">✚</span>
            <span v-else-if="cell.exit">◎</span>
          </div>
        </div>
      </div>
      <aside class="control-panel">
        <h2>楼层</h2>
        <div class="level-panel">
          <h3>{{ currentFloor.title }}</h3>
          <p>{{ currentFloor.detail }}</p>
          <div class="mini-stat-grid">
            <div>
              <span>目标回合</span>
              <strong>{{ currentFloor.targetTurns }}</strong>
            </div>
            <div>
              <span>本层状态</span>
              <strong>{{ currentPerfect ? "完美" : currentCleared ? "已突破" : "未突破" }}</strong>
            </div>
            <div>
              <span>生命</span>
              <strong>{{ player.hp }}</strong>
            </div>
            <div>
              <span>敌人</span>
              <strong>{{ enemies.length }}</strong>
            </div>
          </div>
          <div class="level-meter" aria-label="地牢楼层进度">
            <span :style="{ width: `${chapterProgress}%` }"></span>
          </div>
          <span v-if="floorFinished" class="level-note">{{ floorIndex >= floors.length - 1 ? "全部楼层完成" : "楼层完成，可进入下一层" }}</span>
        </div>
        <div class="level-select-grid">
          <button
            v-for="(_, index) in floors"
            :key="index"
            type="button"
            :class="{
              active: floorIndex === index,
              cleared: levelProgress.cleared?.includes(index),
              perfect: levelProgress.perfect?.includes(index),
            }"
            @click="switchFloor(index)"
          >
            {{ index + 1 }}
          </button>
        </div>
        <button class="pill-button primary" type="button" :disabled="!floorFinished || floorIndex >= floors.length - 1" @click="nextFloor">进入下一层</button>
        <button class="pill-button" type="button" @click="restartFloor">重开本层</button>
        <p>方向键或 WASD 移动，撞向敌人即攻击；清掉守卫后抵达出口。</p>
        <div class="d-pad">
          <button class="up" type="button" @click="move('up')">↑</button>
          <button class="left" type="button" @click="move('left')">←</button>
          <button class="center" type="button">◆</button>
          <button class="right" type="button" @click="move('right')">→</button>
          <button class="down" type="button" @click="move('down')">↓</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.dungeon-board {
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

.dungeon-cell {
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: rgba(12, 25, 49, 0.62);
  color: var(--cyan);
  font-weight: 900;
}

.dungeon-cell.wall { background: #1f2937; }
.dungeon-cell.player { color: #ffd166; text-shadow: 0 0 12px rgba(255, 209, 102, 0.75); }
.dungeon-cell.enemy { color: #fb7185; }
.dungeon-cell.elite { color: #ff4fd8; text-shadow: 0 0 12px rgba(255, 79, 216, 0.78); }
.dungeon-cell.potion { color: #7dff6f; }
.dungeon-cell.exit { color: #53f3ff; }
.dungeon-cell.exit.open {
  box-shadow: inset 0 0 20px rgba(83, 243, 255, 0.24);
}
</style>
