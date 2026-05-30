<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";
import { recordGameResult } from "../utils/progress";

const GAME_ID = "asteroid-dodge";
const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore(GAME_ID));
const status = ref("躲避陨石");
const running = ref(false);
const progressVersion = ref(0);
const runResult = ref(null);

const ROCK_MIN_RADIUS = 0.028;
const ROCK_MAX_RADIUS = 0.076;
const ROCK_MIN_SPEED = 0.45;
const ROCK_MAX_SPEED = 1.16;
const SPAWN_INTERVAL = 0.28;
const SCORE_SYNC_INTERVAL = 90;

let ctx;
let width = 430;
let height = 620;
let dpr = 1;
let animationId = 0;
let lastTime = 0;
let spawnTimer = 0;
let scoreValue = 0;
let survivalTime = 0;
let dodgedRocks = 0;
let lastScoreSync = 0;
let resizeObserver;
let canvasRect;
let activePointerId = null;
let explosionFlash = null;

let player = { x: 0.5, y: 0.88 };
let rocks = [];
let particles = [];
let stars = [];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sceneScale() {
  return Math.min(width, height);
}

function playerRadius() {
  return Math.max(13, sceneScale() * 0.038);
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const rest = totalSeconds % 60;
  return minutes ? `${minutes}分${String(rest).padStart(2, "0")}秒` : `${rest}秒`;
}

function generateStars() {
  stars = Array.from({ length: 96 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: randomBetween(0.7, 2.4),
    opacity: randomBetween(0.35, 0.9),
    speed: randomBetween(0.025, 0.095),
    phase: Math.random() * Math.PI * 2,
    twinkle: randomBetween(1.2, 3.2),
  }));
}

function makeRockShape() {
  const points = 11;
  return Array.from({ length: points }, (_, index) => ({
    angle: (Math.PI * 2 * index) / points,
    radius: randomBetween(0.72, 1.08),
  }));
}

function makeCraters() {
  return [
    { x: -0.24, y: -0.18, r: 0.2, alpha: 0.38 },
    { x: 0.26, y: 0.18, r: 0.16, alpha: 0.32 },
    { x: -0.06, y: 0.34, r: 0.13, alpha: 0.28 },
  ];
}

function spawnRock() {
  rocks.push({
    x: randomBetween(0.06, 0.94),
    y: -0.09,
    radius: randomBetween(ROCK_MIN_RADIUS, ROCK_MAX_RADIUS),
    speed: randomBetween(ROCK_MIN_SPEED, ROCK_MAX_SPEED),
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: randomBetween(-3.2, 3.2),
    shape: makeRockShape(),
    craters: makeCraters(),
  });
}

function readCanvasRect() {
  canvasRect = canvas.value?.getBoundingClientRect() || null;
  return canvasRect;
}

function resizeCanvas() {
  const rect = readCanvasRect();
  if (!rect?.width || !rect?.height || !ctx) return;

  width = rect.width;
  height = rect.height;
  dpr = Math.min(window.devicePixelRatio || 1, 2);

  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);
  if (canvas.value.width !== nextWidth || canvas.value.height !== nextHeight) {
    canvas.value.width = nextWidth;
    canvas.value.height = nextHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bgGradient = null; // 尺寸变化后背景渐变失效，下一帧重建
}

function restart() {
  resizeCanvas();
  player = { x: 0.5, y: 0.88 };
  rocks = [];
  particles = [];
  explosionFlash = null;
  scoreValue = 0;
  survivalTime = 0;
  dodgedRocks = 0;
  score.value = 0;
  status.value = "躲避陨石";
  runResult.value = null;
  running.value = true;
  spawnTimer = 0;
  lastScoreSync = 0;
  generateStars();
  ensureLoop();
}

function syncScore(currentTime, force = false) {
  if (!force && currentTime - lastScoreSync < SCORE_SYNC_INTERVAL) return;
  score.value = Math.floor(scoreValue);
  lastScoreSync = currentTime;
}

function movePlayerTo(clientX, clientY) {
  if (!running.value) return;

  const rect = canvasRect || readCanvasRect();
  if (!rect?.width || !rect?.height) return;

  const padX = clamp(playerRadius() / width, 0.06, 0.16);
  const padY = clamp(playerRadius() / height, 0.05, 0.14);
  player.x = clamp((clientX - rect.left) / rect.width, padX, 1 - padX);
  player.y = clamp((clientY - rect.top) / rect.height, padY, 1 - padY);
}

function handlePointerDown(event) {
  event.preventDefault();
  activePointerId = event.pointerId;
  readCanvasRect();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  movePlayerTo(event.clientX, event.clientY);
}

function handlePointerMove(event) {
  if (event.pointerType !== "mouse" && activePointerId !== event.pointerId) return;
  event.preventDefault();
  movePlayerTo(event.clientX, event.clientY);
}

function handlePointerEnd(event) {
  if (activePointerId === event.pointerId) activePointerId = null;
  try {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  } catch {
    // Capture may already be released by the browser.
  }
}

function createExplosion(x, y) {
  explosionFlash = { x, y, life: 1 };

  const particleCount = 30;
  for (let i = 0; i < particleCount; i += 1) {
    const angle = (Math.PI * 2 * i) / particleCount + randomBetween(-0.18, 0.18);
    const speed = randomBetween(0.18, 0.46);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: randomBetween(3, 7),
    });
  }
}

function finishRun() {
  const finalScore = Math.floor(scoreValue);
  const previousBest = best.value;

  running.value = false;
  status.value = "飞船受损";
  score.value = finalScore;
  best.value = setBestScore(GAME_ID, finalScore);

  const result = recordGameResult(GAME_ID, {
    score: finalScore,
    survivedFrames: Math.floor(survivalTime * 60),
    dodgedRocks,
  });
  progressVersion.value += 1;
  runResult.value = {
    title: best.value > previousBest ? "刷新纪录" : "飞船受损",
    detail: best.value > previousBest ? "新航线记录已写入，继续冲更远的陨石带。" : "飞船已经受损，本局航线数据如下。",
    stats: [
      { label: "分数", value: finalScore },
      { label: "存活", value: formatDuration(survivalTime) },
      { label: "躲过陨石", value: dodgedRocks },
      { label: "最佳", value: best.value },
    ],
    stars: result.stars,
    total: result.total,
    variantCompleted: result.variantCompleted,
    newGoals: result.goals.filter((goal) => result.newlyUnlocked.includes(goal.id)),
    goals: result.goals,
  };
  createExplosion(player.x, player.y);
}

function updateStars(delta) {
  for (const star of stars) {
    star.y += star.speed * delta;
    if (star.y > 1.02) {
      star.y = -0.02;
      star.x = Math.random();
    }
  }
}

function updateParticles(delta) {
  if (explosionFlash) {
    explosionFlash.life -= delta * 2.6;
    if (explosionFlash.life <= 0) explosionFlash = null;
  }

  let writeIndex = 0;
  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 0.09 * delta;
    particle.life -= 1.75 * delta;
    if (particle.life > 0) {
      particles[writeIndex] = particle;
      writeIndex += 1;
    }
  }
  particles.length = writeIndex;
}

function updateRocks(delta) {
  let writeIndex = 0;
  for (let i = 0; i < rocks.length; i += 1) {
    const rock = rocks[i];
    rock.y += rock.speed * delta;
    rock.rotation += rock.rotationSpeed * delta;
    if (rock.y < 1.14) {
      rocks[writeIndex] = rock;
      writeIndex += 1;
    } else {
      dodgedRocks += 1;
    }
  }
  rocks.length = writeIndex;
}

function checkCollision() {
  const scale = sceneScale();
  const px = player.x * width;
  const py = player.y * height;
  const pr = playerRadius();

  for (const rock of rocks) {
    const rx = rock.x * width;
    const ry = rock.y * height;
    const rr = rock.radius * scale;
    const dx = rx - px;
    const dy = ry - py;
    const hitDistance = rr + pr;
    if (dx * dx + dy * dy < hitDistance * hitDistance) {
      finishRun();
      return;
    }
  }
}

function updateGame(delta, currentTime) {
  updateStars(delta);
  updateParticles(delta);

  if (!running.value) return;

  survivalTime += delta;
  spawnTimer += delta;
  while (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer -= SPAWN_INTERVAL;
    if (Math.random() < 0.85) spawnRock();
  }

  updateRocks(delta);
  checkCollision();

  if (running.value) {
    scoreValue += delta * 62;
    syncScore(currentTime);
  }
}

let bgGradient = null;

function drawBackground(currentTime) {
  // 主背景渐变颜色与坐标固定，缓存复用，仅在 resize 时重建
  if (!bgGradient) {
    bgGradient = ctx.createRadialGradient(width * 0.5, height * 0.32, 0, width * 0.5, height * 0.42, height * 0.72);
    bgGradient.addColorStop(0, "#0c3650");
    bgGradient.addColorStop(0.45, "#07182d");
    bgGradient.addColorStop(1, "#020611");
  }
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  const drift = Math.sin(currentTime * 0.00025) * width * 0.08;
  const cyanGlow = ctx.createRadialGradient(width * 0.22 + drift, height * 0.22, 0, width * 0.22 + drift, height * 0.22, width * 0.55);
  cyanGlow.addColorStop(0, "rgba(83, 243, 255, 0.13)");
  cyanGlow.addColorStop(1, "rgba(83, 243, 255, 0)");
  ctx.fillStyle = cyanGlow;
  ctx.fillRect(0, 0, width, height);

  const magentaGlow = ctx.createRadialGradient(width * 0.82 - drift, height * 0.68, 0, width * 0.82 - drift, height * 0.68, width * 0.46);
  magentaGlow.addColorStop(0, "rgba(255, 79, 216, 0.11)");
  magentaGlow.addColorStop(1, "rgba(255, 79, 216, 0)");
  ctx.fillStyle = magentaGlow;
  ctx.fillRect(0, 0, width, height);
}

function drawStars(currentTime) {
  ctx.save();
  for (const star of stars) {
    const pulse = 0.62 + Math.sin(currentTime * 0.001 * star.twinkle + star.phase) * 0.38;
    ctx.globalAlpha = star.opacity * pulse;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShip(currentTime) {
  const x = player.x * width;
  const y = player.y * height;
  const shipWidth = Math.max(34, sceneScale() * 0.102);
  const shipHeight = shipWidth * 1.24;
  const pulse = 0.5 + Math.sin(currentTime * 0.022) * 0.5;

  ctx.save();
  ctx.translate(x, y);

  if (running.value) {
    const flameHeight = shipHeight * (0.42 + pulse * 0.12);
    const flame = ctx.createLinearGradient(0, shipHeight * 0.24, 0, shipHeight * 0.24 + flameHeight);
    flame.addColorStop(0, "rgba(255, 241, 168, 0.9)");
    flame.addColorStop(0.42, "rgba(96, 239, 255, 0.7)");
    flame.addColorStop(1, "rgba(14, 165, 233, 0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.ellipse(0, shipHeight * 0.45, shipWidth * 0.14, flameHeight * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowColor = "rgba(96, 239, 255, 0.8)";
  ctx.shadowBlur = 18;
  const hullGradient = ctx.createLinearGradient(0, -shipHeight * 0.48, 0, shipHeight * 0.42);
  hullGradient.addColorStop(0, "#a7f3ff");
  hullGradient.addColorStop(0.42, "#38bdf8");
  hullGradient.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = hullGradient;
  ctx.strokeStyle = "rgba(191, 246, 255, 0.9)";
  ctx.lineWidth = 1.4;

  ctx.beginPath();
  ctx.moveTo(0, -shipHeight * 0.48);
  ctx.lineTo(shipWidth * 0.34, shipHeight * 0.22);
  ctx.lineTo(shipWidth * 0.18, shipHeight * 0.36);
  ctx.lineTo(shipWidth * 0.05, shipHeight * 0.31);
  ctx.lineTo(0, shipHeight * 0.38);
  ctx.lineTo(-shipWidth * 0.05, shipHeight * 0.31);
  ctx.lineTo(-shipWidth * 0.18, shipHeight * 0.36);
  ctx.lineTo(-shipWidth * 0.34, shipHeight * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  const cockpit = ctx.createRadialGradient(-shipWidth * 0.05, -shipHeight * 0.14, 0, 0, -shipHeight * 0.1, shipWidth * 0.18);
  cockpit.addColorStop(0, "#ffffff");
  cockpit.addColorStop(0.35, "#bae6fd");
  cockpit.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = cockpit;
  ctx.beginPath();
  ctx.ellipse(0, -shipHeight * 0.1, shipWidth * 0.11, shipHeight * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawRocks() {
  const scale = sceneScale();

  for (const rock of rocks) {
    const x = rock.x * width;
    const y = rock.y * height;
    const radius = rock.radius * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rock.rotation);
    ctx.shadowColor = "rgba(249, 115, 22, 0.52)";
    ctx.shadowBlur = 10;

    const gradient = ctx.createRadialGradient(-radius * 0.25, -radius * 0.28, radius * 0.08, 0, 0, radius);
    gradient.addColorStop(0, "#fed7aa");
    gradient.addColorStop(0.38, "#fb923c");
    gradient.addColorStop(0.78, "#f97316");
    gradient.addColorStop(1, "#9a3412");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(255, 237, 213, 0.34)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    rock.shape.forEach((point, index) => {
      const px = Math.cos(point.angle) * point.radius * radius;
      const py = Math.sin(point.angle) * point.radius * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    for (const crater of rock.craters) {
      ctx.fillStyle = `rgba(127, 29, 29, ${crater.alpha})`;
      ctx.beginPath();
      ctx.arc(crater.x * radius, crater.y * radius, crater.r * radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawParticles() {
  if (explosionFlash) {
    const x = explosionFlash.x * width;
    const y = explosionFlash.y * height;
    const radius = sceneScale() * (0.14 + (1 - explosionFlash.life) * 0.2);
    const flash = ctx.createRadialGradient(x, y, 0, x, y, radius);
    flash.addColorStop(0, `rgba(251, 191, 36, ${0.72 * explosionFlash.life})`);
    flash.addColorStop(0.42, `rgba(249, 115, 22, ${0.36 * explosionFlash.life})`);
    flash.addColorStop(1, "rgba(249, 115, 22, 0)");
    ctx.fillStyle = flash;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.shadowColor = "rgba(251, 191, 36, 0.8)";
  ctx.shadowBlur = 8;
  for (const particle of particles) {
    ctx.globalAlpha = clamp(particle.life, 0, 1);
    const gradient = ctx.createRadialGradient(particle.x * width, particle.y * height, 0, particle.x * width, particle.y * height, particle.size);
    gradient.addColorStop(0, "#fff7ad");
    gradient.addColorStop(0.42, "#fbbf24");
    gradient.addColorStop(1, "#dc2626");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(particle.x * width, particle.y * height, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw(currentTime = 0) {
  if (!ctx || width <= 0 || height <= 0) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  drawBackground(currentTime);
  drawStars(currentTime);
  drawRocks();
  drawShip(currentTime);
  drawParticles();
}

function loop(currentTime) {
  if (!lastTime) lastTime = currentTime;
  const delta = Math.min((currentTime - lastTime) / 1000, 1 / 30);
  lastTime = currentTime;

  updateGame(delta, currentTime);
  draw(currentTime);
  if (running.value) {
    animationId = requestAnimationFrame(loop);
  } else {
    animationId = 0; // 结束后停止空转，结束态已绘制
  }
}

// 幂等启动主循环：仅在未运行时启动
function ensureLoop() {
  if (animationId) return;
  lastTime = 0;
  animationId = requestAnimationFrame(loop);
}

onMounted(() => {
  ctx = canvas.value.getContext("2d", { alpha: false, desynchronized: true });
  resizeCanvas();
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas.value);
  window.addEventListener("resize", resizeCanvas);
  restart();
  ensureLoop();
});

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
  resizeObserver?.disconnect();
  window.removeEventListener("resize", resizeCanvas);
});
</script>

<template>
  <GameLayout
    game-id="asteroid-dodge"
    :score="score"
    :best="best"
    :status="status"
    :progress-version="progressVersion"
    :run-result="runResult"
    @restart="restart"
    @dismiss-result="runResult = null"
  >
    <section class="game-panel">
      <div class="board-shell dodge-board-shell">
        <canvas
          ref="canvas"
          class="canvas-board dodge-canvas"
          aria-label="飞船躲避陨石游戏画布"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerEnd"
          @pointercancel="handlePointerEnd"
        ></canvas>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.dodge-board-shell {
  padding: 0;
  background: #020611;
}

.dodge-canvas {
  display: block;
  width: min(100cqw, 70cqh);
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  border: 2px solid rgba(96, 239, 255, 0.28);
  border-radius: var(--radius);
  background: #020611;
  box-shadow:
    inset 0 0 60px rgba(6, 182, 212, 0.1),
    0 0 30px rgba(6, 182, 212, 0.15);
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}

@media (max-width: 860px) {
  .dodge-canvas {
    width: min(100%, 70cqh);
  }
}
</style>
