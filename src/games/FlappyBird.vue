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

function restart() {
  bird = { x: 120, y: height / 2, vy: 0, r: 14 };
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
  bird.vy = -8.2;
}

function addPipe() {
  const gap = 158;
  const top = 80 + Math.random() * (height - gap - 180);
  pipes.push({ x: width + 30, top, bottom: top + gap, scored: false });
}

function update() {
  if (paused.value || gameOver) return;
  frame += 1;
  if (frame % 92 === 0) addPipe();
  bird.vy += 0.42;
  bird.y += bird.vy;
  pipes.forEach((pipe) => {
    pipe.x -= 3;
    if (!pipe.scored && pipe.x + 52 < bird.x) {
      pipe.scored = true;
      score.value += 1;
      best.value = setBestScore("flappy-bird", score.value);
    }
  });
  pipes = pipes.filter((pipe) => pipe.x > -80);

  const hitPipe = pipes.some(
    (pipe) =>
      bird.x + bird.r > pipe.x &&
      bird.x - bird.r < pipe.x + 52 &&
      (bird.y - bird.r < pipe.top || bird.y + bird.r > pipe.bottom),
  );
  if (bird.y - bird.r < 0 || bird.y + bird.r > height || hitPipe) {
    gameOver = true;
    status.value = "撞上光柱，点击重开";
  }
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

  pipes.forEach((pipe) => {
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#53f3ff";
    ctx.fillStyle = "#53f3ff";
    ctx.fillRect(pipe.x, 0, 52, pipe.top);
    ctx.fillRect(pipe.x, pipe.bottom, 52, height - pipe.bottom);
    ctx.fillStyle = "#ff4fd8";
    ctx.fillRect(pipe.x - 5, pipe.top - 12, 62, 12);
    ctx.fillRect(pipe.x - 5, pipe.bottom, 62, 12);
  });

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(Math.max(-0.5, Math.min(0.7, bird.vy / 12)));
  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff4fd8";
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-28, 10);
  ctx.lineTo(-12, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#020611";
  ctx.beginPath();
  ctx.arc(9, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const max = Math.min(canvas.value.parentElement.clientWidth - 24, 420);
  canvas.value.style.width = `${max}px`;
  canvas.value.style.height = `${max * (height / width)}px`;
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
  canvas.value.width = width;
  canvas.value.height = height;
  restart();
  resize();
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
    <section class="game-panel split-panel">
      <div class="board-shell">
        <canvas
          ref="canvas"
          class="canvas-board"
          aria-label="Flappy Bird 游戏画布"
          @click="flap"
          @touchstart.prevent="flap"
        ></canvas>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>点击、触屏或空格让机械鸟跃升，P 键暂停。</p>
      </aside>
    </section>
  </GameLayout>
</template>
