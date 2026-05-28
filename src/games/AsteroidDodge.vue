<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const player = ref({ x: 50, y: 88 });
const rocks = ref([]);
const particles = ref([]);
const stars = ref([]);
const score = ref(0);
const best = ref(getBestScore("asteroid-dodge"));
const status = ref("躲避陨石");
const running = ref(false);
const explosion = ref(null);
let animationId = 0;
let lastTime = 0;
let spawnTimer = 0;

// 生成星空背景
function generateStars() {
  const starCount = 80;
  stars.value = Array.from({ length: starCount }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.6 + 0.4,
    speed: Math.random() * 0.3 + 0.1,
  }));
}

function restart() {
  player.value = { x: 50, y: 88 };
  rocks.value = [];
  particles.value = [];
  explosion.value = null;
  score.value = 0;
  status.value = "躲避陨石";
  running.value = true;
  spawnTimer = 0;
  generateStars();
}

function moveTo(event) {
  if (!running.value) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const point = event.touches?.[0] || event;
  player.value.x = Math.max(6, Math.min(94, ((point.clientX - rect.left) / rect.width) * 100));
  player.value.y = Math.max(10, Math.min(92, ((point.clientY - rect.top) / rect.height) * 100));
}

// 创建爆炸粒子效果
function createExplosion(x, y) {
  explosion.value = { x, y };
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount;
    const speed = Math.random() * 3 + 2;
    particles.value.push({
      id: Date.now() + Math.random(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
    });
  }
  setTimeout(() => {
    explosion.value = null;
  }, 300);
}

function update(currentTime) {
  if (!running.value) {
    animationId = requestAnimationFrame(update);
    return;
  }

  const deltaTime = currentTime - lastTime;
  if (deltaTime < 16) {
    animationId = requestAnimationFrame(update);
    return;
  }
  lastTime = currentTime;

  // 更新星空
  stars.value.forEach((star) => {
    star.y += star.speed;
    if (star.y > 100) star.y = -2;
  });

  // 生成陨石（降低频率）
  spawnTimer += deltaTime;
  if (spawnTimer > 280) {
    spawnTimer = 0;
    if (Math.random() < 0.85) {
      rocks.value.push({
        id: Date.now() + Math.random(),
        x: 5 + Math.random() * 90,
        y: -5,
        size: 3 + Math.random() * 4,
        speed: 1.5 + Math.random() * 1.8,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  // 更新陨石位置
  rocks.value.forEach((rock) => {
    rock.y += rock.speed;
    rock.rotation += rock.rotationSpeed;
  });

  // 移除屏幕外的陨石
  rocks.value = rocks.value.filter((rock) => rock.y < 110);

  // 更新粒子
  particles.value.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;
  });
  particles.value = particles.value.filter((p) => p.life > 0);

  // 碰撞检测（优化算法）
  const playerRadius = 3;
  for (const rock of rocks.value) {
    const dx = rock.x - player.value.x;
    const dy = rock.y - player.value.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < rock.size + playerRadius) {
      running.value = false;
      status.value = "飞船受损";
      best.value = setBestScore("asteroid-dodge", score.value);
      createExplosion(player.value.x, player.value.y);
      break;
    }
  }

  // 更新分数
  if (running.value) {
    score.value += 1;
  }

  animationId = requestAnimationFrame(update);
}

onMounted(() => {
  restart();
  animationId = requestAnimationFrame(update);
});

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
});
</script>

<template>
  <GameLayout game-id="asteroid-dodge" :score="score" :best="best" :status="status" @restart="restart">
    <section class="game-panel">
      <div class="board-shell">
        <div class="dodge-arena" @mousemove="moveTo" @touchmove.prevent="moveTo" @touchstart.prevent="moveTo">
          <!-- 星空背景 -->
          <div class="starfield">
            <div
              v-for="star in stars"
              :key="star.id"
              class="star"
              :style="{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
              }"
            ></div>
          </div>

          <!-- 飞船 -->
          <div class="ship" :style="{ left: `${player.x}%`, top: `${player.y}%` }">
            <svg viewBox="0 0 40 50" class="ship-body">
              <defs>
                <linearGradient id="shipGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color: #60efff; stop-opacity: 1" />
                  <stop offset="100%" style="stop-color: #0ea5e9; stop-opacity: 1" />
                </linearGradient>
                <filter id="shipGlow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <!-- 飞船主体 -->
              <path
                d="M20 5 L30 35 L25 40 L20 38 L15 40 L10 35 Z"
                fill="url(#shipGradient)"
                stroke="#60efff"
                stroke-width="1.5"
                filter="url(#shipGlow)"
              />
              <!-- 驾驶舱 -->
              <ellipse cx="20" cy="20" rx="4" ry="6" fill="#38bdf8" opacity="0.8" />
            </svg>
            <!-- 引擎尾焰 -->
            <div v-if="running" class="engine-flame"></div>
          </div>

          <!-- 陨石 -->
          <div
            v-for="rock in rocks"
            :key="rock.id"
            class="rock"
            :style="{
              left: `${rock.x}%`,
              top: `${rock.y}%`,
              width: `${rock.size * 2}%`,
              height: `${rock.size * 2}%`,
              transform: `translate(-50%, -50%) rotate(${rock.rotation}deg)`,
            }"
          >
            <svg viewBox="0 0 100 100" class="rock-svg">
              <defs>
                <radialGradient id="rockGradient">
                  <stop offset="0%" style="stop-color: #fb923c; stop-opacity: 1" />
                  <stop offset="70%" style="stop-color: #f97316; stop-opacity: 1" />
                  <stop offset="100%" style="stop-color: #ea580c; stop-opacity: 1" />
                </radialGradient>
                <filter id="rockGlow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <!-- 不规则陨石形状 -->
              <path
                d="M50 10 L65 20 L75 35 L80 55 L70 75 L50 85 L30 80 L15 65 L10 45 L20 25 Z"
                fill="url(#rockGradient)"
                filter="url(#rockGlow)"
              />
              <!-- 陨石坑 -->
              <circle cx="40" cy="35" r="8" fill="#dc2626" opacity="0.4" />
              <circle cx="60" cy="55" r="6" fill="#dc2626" opacity="0.3" />
              <circle cx="35" cy="60" r="5" fill="#dc2626" opacity="0.35" />
            </svg>
          </div>

          <!-- 爆炸粒子 -->
          <div
            v-for="particle in particles"
            :key="particle.id"
            class="particle"
            :style="{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              opacity: particle.life,
            }"
          ></div>

          <!-- 爆炸光效 -->
          <div v-if="explosion" class="explosion" :style="{ left: `${explosion.x}%`, top: `${explosion.y}%` }"></div>
        </div>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.dodge-arena {
  position: relative;
  width: min(88vw, 430px);
  height: min(70vh, 620px);
  overflow: hidden;
  border: 2px solid rgba(96, 239, 255, 0.3);
  border-radius: var(--radius);
  background: radial-gradient(ellipse at center, rgba(14, 165, 233, 0.15) 0%, rgba(3, 7, 18, 0.98) 70%);
  touch-action: none;
  box-shadow: inset 0 0 60px rgba(6, 182, 212, 0.1), 0 0 30px rgba(6, 182, 212, 0.15);
}

/* 星空背景 */
.starfield {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.star {
  position: absolute;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
  animation: twinkle 3s ease-in-out infinite;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

/* 飞船 */
.ship {
  position: absolute;
  width: 40px;
  height: 50px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10;
  transition: left 0.05s ease-out, top 0.05s ease-out;
}

.ship-body {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 12px rgba(96, 239, 255, 0.8));
}

/* 引擎尾焰 */
.engine-flame {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 25px;
  background: linear-gradient(to bottom, rgba(96, 239, 255, 0.9) 0%, rgba(14, 165, 233, 0.6) 50%, transparent 100%);
  border-radius: 50% 50% 50% 50% / 30% 30% 70% 70%;
  filter: blur(2px);
  animation: flameFlicker 0.1s ease-in-out infinite;
}

@keyframes flameFlicker {
  0%,
  100% {
    height: 25px;
    opacity: 0.9;
  }
  50% {
    height: 20px;
    opacity: 0.7;
  }
}

/* 陨石 */
.rock {
  position: absolute;
  pointer-events: none;
  will-change: transform;
}

.rock-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.6));
}

/* 爆炸粒子 */
.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: radial-gradient(circle, #fbbf24 0%, #f97316 50%, #dc2626 100%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
}

/* 爆炸光效 */
.explosion {
  position: absolute;
  width: 100px;
  height: 100px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(251, 191, 36, 0.8) 0%, rgba(249, 115, 22, 0.4) 40%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  animation: explode 0.3s ease-out forwards;
}

@keyframes explode {
  0% {
    transform: translate(-50%, -50%) scale(0.2);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2);
    opacity: 0;
  }
}

@media (max-width: 860px) {
  .dodge-arena {
    width: min(100%, 430px);
    height: 100%;
  }
}
</style>
