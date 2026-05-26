<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const player = ref({ x: 50, y: 88 });
const rocks = ref([]);
const score = ref(0);
const best = ref(getBestScore("asteroid-dodge"));
const status = ref("躲避陨石");
const running = ref(false);
let timer = 0;

function restart() {
  player.value = { x: 50, y: 88 };
  rocks.value = [];
  score.value = 0;
  status.value = "躲避陨石";
  running.value = true;
}

function moveTo(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const point = event.touches?.[0] || event;
  player.value.x = Math.max(6, Math.min(94, ((point.clientX - rect.left) / rect.width) * 100));
  player.value.y = Math.max(10, Math.min(92, ((point.clientY - rect.top) / rect.height) * 100));
}

function update() {
  if (!running.value) return;
  if (Math.random() < 0.34) rocks.value.push({ id: Date.now() + Math.random(), x: 5 + Math.random() * 90, y: -5, size: 4 + Math.random() * 5, speed: 2 + Math.random() * 2 });
  rocks.value.forEach((rock) => {
    rock.y += rock.speed;
  });
  rocks.value = rocks.value.filter((rock) => rock.y < 110);
  score.value += 1;
  const hit = rocks.value.some((rock) => Math.hypot(rock.x - player.value.x, rock.y - player.value.y) < rock.size + 3);
  if (hit) {
    running.value = false;
    status.value = "飞船受损";
    best.value = setBestScore("asteroid-dodge", score.value);
  }
}

onMounted(() => {
  restart();
  timer = window.setInterval(update, 90);
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <GameLayout game-id="asteroid-dodge" :score="score" :best="best" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="dodge-arena" @mousemove="moveTo" @touchmove.prevent="moveTo" @touchstart.prevent="moveTo">
          <span class="ship" :style="{ left: `${player.x}%`, top: `${player.y}%` }">▲</span>
          <span
            v-for="rock in rocks"
            :key="rock.id"
            class="rock"
            :style="{ left: `${rock.x}%`, top: `${rock.y}%`, width: `${rock.size * 2}%`, height: `${rock.size * 2}%` }"
          ></span>
        </div>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>鼠标或手指拖动飞船，尽量在陨石雨中存活。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.dodge-arena {
  position: relative;
  width: min(88vw, 430px);
  height: min(70vh, 620px);
  overflow: hidden;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: radial-gradient(circle at center, rgba(83, 243, 255, 0.1), rgba(3, 8, 18, 0.94));
  touch-action: none;
}

.ship,
.rock {
  position: absolute;
  transform: translate(-50%, -50%);
}

.ship {
  color: #53f3ff;
  font-size: 2rem;
  text-shadow: 0 0 18px rgba(83, 243, 255, 0.9);
}

.rock {
  border-radius: 50%;
  background: #f97316;
  box-shadow: 0 0 16px rgba(249, 115, 22, 0.8);
}
</style>
