<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("flappy-bird"));
const status = ref("点击跃升");
const paused = ref(false);

let ctx;
let width = 520;
let height = 640;
let bird;
let pipes;
let frame;
let loopId;
let gameOver;
let birdSkinIndex = 0;
let pipeSkinIndex = 0;
let randomizeSkinsOnRestart = false;

const pipeWidth = () => Math.max(48, Math.min(70, width * 0.055));
const pipeSpeed = () => Math.max(2.35, Math.min(3.5, width / 360));
const birdSkins = [
  { body: "#ffd166", wing: "#ff4fd8", eye: "#020611", glow: "#ffd166", tail: "#fef3c7", spot: "#fff7ad" },
  { body: "#7dd3fc", wing: "#38bdf8", eye: "#031525", glow: "#7dd3fc", tail: "#e0f2fe", spot: "#bae6fd" },
  { body: "#a7f3d0", wing: "#34d399", eye: "#042015", glow: "#6ee7b7", tail: "#d1fae5", spot: "#ecfdf5" },
  { body: "#f0abfc", wing: "#c084fc", eye: "#1f062f", glow: "#f0abfc", tail: "#fae8ff", spot: "#f5d0fe" },
  { body: "#fca5a5", wing: "#fb7185", eye: "#2b0710", glow: "#fda4af", tail: "#ffe4e6", spot: "#fecdd3" },
  { body: "#fdba74", wing: "#fb923c", eye: "#241003", glow: "#fdba74", tail: "#ffedd5", spot: "#fed7aa" },
  { body: "#c4b5fd", wing: "#818cf8", eye: "#11113f", glow: "#c4b5fd", tail: "#ede9fe", spot: "#ddd6fe" },
  { body: "#f9a8d4", wing: "#ec4899", eye: "#31051b", glow: "#f9a8d4", tail: "#fce7f3", spot: "#fbcfe8" },
  { body: "#fde68a", wing: "#84cc16", eye: "#17210a", glow: "#fde68a", tail: "#fef9c3", spot: "#ecfccb" },
  { body: "#99f6e4", wing: "#14b8a6", eye: "#052622", glow: "#5eead4", tail: "#ccfbf1", spot: "#a7f3d0" },
];
const pipeSkins = [
  { shaft: "#53f3ff", cap: "#ff4fd8", glow: "#53f3ff", stripe: "rgba(236,254,255,0.28)", shade: "rgba(2,6,17,0.18)" },
  { shaft: "#22c55e", cap: "#a3e635", glow: "#86efac", stripe: "rgba(236,253,245,0.28)", shade: "rgba(5,46,22,0.2)" },
  { shaft: "#f97316", cap: "#facc15", glow: "#fdba74", stripe: "rgba(255,247,237,0.28)", shade: "rgba(67,20,7,0.2)" },
  { shaft: "#8b5cf6", cap: "#ec4899", glow: "#c4b5fd", stripe: "rgba(245,243,255,0.28)", shade: "rgba(30,27,75,0.2)" },
  { shaft: "#38bdf8", cap: "#0ea5e9", glow: "#7dd3fc", stripe: "rgba(240,249,255,0.3)", shade: "rgba(8,47,73,0.2)" },
  { shaft: "#f43f5e", cap: "#fb7185", glow: "#fda4af", stripe: "rgba(255,241,242,0.28)", shade: "rgba(76,5,25,0.2)" },
  { shaft: "#eab308", cap: "#fef08a", glow: "#fde047", stripe: "rgba(254,252,232,0.32)", shade: "rgba(66,32,6,0.2)" },
  { shaft: "#14b8a6", cap: "#2dd4bf", glow: "#5eead4", stripe: "rgba(240,253,250,0.3)", shade: "rgba(4,47,46,0.2)" },
  { shaft: "#64748b", cap: "#cbd5e1", glow: "#94a3b8", stripe: "rgba(248,250,252,0.24)", shade: "rgba(15,23,42,0.24)" },
  { shaft: "#d946ef", cap: "#f0abfc", glow: "#e879f9", stripe: "rgba(253,244,255,0.28)", shade: "rgba(74,4,78,0.2)" },
];

function pickNextIndex(length, current) {
  if (length < 2) return 0;
  let next = current;
  while (next === current) next = Math.floor(Math.random() * length);
  return next;
}

function randomizeSkins() {
  birdSkinIndex = pickNextIndex(birdSkins.length, birdSkinIndex);
  pipeSkinIndex = pickNextIndex(pipeSkins.length, pipeSkinIndex);
}

function restart() {
  if (randomizeSkinsOnRestart) {
    randomizeSkins();
    randomizeSkinsOnRestart = false;
  }
  bird = { x: Math.max(92, Math.min(140, width * 0.24)), y: height / 2, vy: 0, r: 14 };
  pipes = [];
  frame = 0;
  score.value = 0;
  gameOver = false;
  paused.value = false;
  status.value = "点击跃升";
  draw();
}

function flap() {
  if (gameOver) {
    restart();
    return;
  }
  if (paused.value) return;
  bird.vy = -5.7;
}

function addPipe() {
  const gap = 184;
  const top = 80 + Math.random() * (height - gap - 180);
  pipes.push({ x: width + 30, top, bottom: top + gap, scored: false });
}

function update() {
  if (paused.value || gameOver) return;
  frame += 1;
  if (frame % 112 === 0) addPipe();
  bird.vy += 0.25;
  bird.y += bird.vy;
  pipes.forEach((pipe) => {
    pipe.x -= pipeSpeed();
    if (!pipe.scored && pipe.x + pipeWidth() < bird.x) {
      pipe.scored = true;
      score.value += 1;
      best.value = setBestScore("flappy-bird", score.value);
    }
  });
  pipes = pipes.filter((pipe) => pipe.x > -80);

  const hitPipe = pipes.some(
    (pipe) =>
      bird.x + bird.r > pipe.x &&
      bird.x - bird.r < pipe.x + pipeWidth() &&
      (bird.y - bird.r < pipe.top || bird.y + bird.r > pipe.bottom),
  );
  if (bird.y - bird.r < 0 || bird.y + bird.r > height || hitPipe) {
    gameOver = true;
    randomizeSkinsOnRestart = true;
    status.value = "撞上光柱，点击重开";
  }
}

function drawPipeSection(x, y, w, h, capY, skin) {
  const shaftGradient = ctx.createLinearGradient(x, 0, x + w, 0);
  shaftGradient.addColorStop(0, skin.shade);
  shaftGradient.addColorStop(0.18, skin.shaft);
  shaftGradient.addColorStop(0.72, skin.shaft);
  shaftGradient.addColorStop(1, skin.shade);
  ctx.fillStyle = shaftGradient;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = skin.stripe;
  for (let stripeY = y + 18; stripeY < y + h; stripeY += 46) {
    ctx.fillRect(x + 8, stripeY, Math.max(8, w - 16), 4);
  }

  ctx.fillStyle = skin.cap;
  ctx.fillRect(x - 5, capY, w + 10, 12);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(x + 2, capY + 2, Math.max(8, w - 4), 2);
}

function drawPipe(pipe) {
  const widthNow = pipeWidth();
  const skin = pipeSkins[pipeSkinIndex];
  ctx.shadowBlur = 18;
  ctx.shadowColor = skin.glow;
  drawPipeSection(pipe.x, 0, widthNow, pipe.top, pipe.top - 12, skin);
  drawPipeSection(pipe.x, pipe.bottom, widthNow, height - pipe.bottom, pipe.bottom, skin);
}

function drawBird() {
  const skin = birdSkins[birdSkinIndex];
  const wingMode = birdSkinIndex % 3;

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(Math.max(-0.5, Math.min(0.7, bird.vy / 12)));
  ctx.shadowColor = skin.glow;
  ctx.shadowBlur = 20;

  ctx.fillStyle = skin.tail;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-34, wingMode === 1 ? 13 : 9);
  ctx.lineTo(-24, -10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin.spot;
  ctx.beginPath();
  ctx.arc(-3, -5, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin.wing;
  ctx.beginPath();
  if (wingMode === 0) {
    ctx.moveTo(-8, 0);
    ctx.lineTo(-28, 10);
    ctx.lineTo(-12, -10);
  } else if (wingMode === 1) {
    ctx.ellipse(-9, 4, 13, 6, -0.35, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-7, 2);
    ctx.lineTo(-22, 16);
    ctx.lineTo(-17, -7);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skin.eye;
  ctx.beginPath();
  ctx.arc(9, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(10, -5, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#07101f");
  gradient.addColorStop(1, "#020611");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(83, 243, 255, 0.07)";
  for (let y = 0; y < height; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  pipes.forEach(drawPipe);
  drawBird();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(236,254,255,0.92)";
  ctx.font = "700 42px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(score.value, width / 2, 72);
}

function loop() {
  update();
  draw();
  loopId = requestAnimationFrame(loop);
}

function resize() {
  const parent = canvas.value.parentElement;
  const previousWidth = width;
  const previousHeight = height;
  width = Math.max(320, Math.floor(parent.clientWidth));
  height = Math.max(360, Math.floor(parent.clientHeight));
  canvas.value.width = width;
  canvas.value.height = height;
  canvas.value.style.width = "100%";
  canvas.value.style.height = "100%";

  if (!bird) return;
  const xScale = width / previousWidth;
  const yScale = height / previousHeight;
  bird.x = Math.min(width - bird.r, Math.max(bird.r, bird.x * xScale));
  bird.y = Math.min(height - bird.r, Math.max(bird.r, bird.y * yScale));
  pipes = pipes.map((pipe) => ({
    ...pipe,
    x: pipe.x * xScale,
    top: pipe.top * yScale,
    bottom: pipe.bottom * yScale,
  }));
  draw();
}

function togglePause() {
  if (gameOver) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续穿越";
}

function onKey(event) {
  if (event.key === " " || event.key === "ArrowUp" || event.key === "w") {
    event.preventDefault();
    flap();
  }
  if (event.key === "p") togglePause();
}

onMounted(() => {
  ctx = canvas.value.getContext("2d");
  resize();
  restart();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKey);
  loopId = requestAnimationFrame(loop);
});

onUnmounted(() => {
  cancelAnimationFrame(loopId);
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <GameLayout
    game-id="flappy-bird"
    :score="score"
    :best="best"
    :status="status"
    :paused="paused"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
  >
    <section class="game-panel flappy-panel">
      <div class="board-shell flappy-board-shell">
        <canvas
          ref="canvas"
          class="canvas-board flappy-canvas"
          aria-label="Flappy Bird 游戏画布"
          @click="flap"
          @touchstart.prevent="flap"
        ></canvas>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
.flappy-panel {
  height: 100%;
}

.flappy-board-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  background: #020611;
}

.flappy-canvas {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
</style>
