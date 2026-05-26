<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("boss-rush"));
const status = ref("首领来袭");
const paused = ref(false);
const bossHp = ref(100);

const width = 540;
const height = 720;

let ctx;
let player;
let boss;
let bullets;
let bossBullets;
let keys = {};
let frame = 0;
let loopId = 0;
let finished = false;

const phase = computed(() => {
  if (bossHp.value <= 34) return 3;
  if (bossHp.value <= 67) return 2;
  return 1;
});

function restart() {
  player = { x: width / 2, y: height - 74, r: 15, lives: 3, cooldown: 0, invincible: 0 };
  boss = { x: width / 2, y: 112, r: 58, hp: 360, maxHp: 360, angle: 0 };
  bullets = [];
  bossBullets = [];
  keys = {};
  frame = 0;
  score.value = 0;
  bossHp.value = 100;
  paused.value = false;
  finished = false;
  status.value = "首领来袭";
  draw();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function movePlayerTo(clientX, clientY) {
  if (finished) return;
  const rect = canvas.value.getBoundingClientRect();
  player.x = ((clientX - rect.left) / rect.width) * width;
  player.y = ((clientY - rect.top) / rect.height) * height;
  player.x = Math.max(20, Math.min(width - 20, player.x));
  player.y = Math.max(260, Math.min(height - 24, player.y));
}

function fire() {
  if (player.cooldown > 0) return;
  bullets.push({ x: player.x - 10, y: player.y - 22, vx: -0.35, vy: -9 });
  bullets.push({ x: player.x + 10, y: player.y - 22, vx: 0.35, vy: -9 });
  player.cooldown = 8;
}

function fireBossPattern() {
  const hpRatio = boss.hp / boss.maxHp;
  const currentPhase = hpRatio > 0.67 ? 1 : hpRatio > 0.34 ? 2 : 3;
  if (frame % Math.max(14, 38 - currentPhase * 7) !== 0) return;

  if (currentPhase === 1) {
    for (let i = -2; i <= 2; i += 1) {
      bossBullets.push({ x: boss.x, y: boss.y + 44, vx: i * 0.9, vy: 3.2, r: 5, color: "#ffd166" });
    }
  } else if (currentPhase === 2) {
    const base = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let i = -2; i <= 2; i += 1) {
      const angle = base + i * 0.22;
      bossBullets.push({ x: boss.x, y: boss.y + 32, vx: Math.cos(angle) * 3.2, vy: Math.sin(angle) * 3.2, r: 5, color: "#ff4fd8" });
    }
  } else {
    boss.angle += 0.34;
    for (let i = 0; i < 8; i += 1) {
      const angle = boss.angle + (Math.PI * 2 * i) / 8;
      bossBullets.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * 2.6, vy: Math.sin(angle) * 2.6, r: 4.5, color: "#ff5c7c" });
    }
  }
}

function update() {
  if (paused.value || finished) return;
  frame += 1;
  if (keys.ArrowLeft || keys.a) player.x -= 6;
  if (keys.ArrowRight || keys.d) player.x += 6;
  if (keys.ArrowUp || keys.w) player.y -= 6;
  if (keys.ArrowDown || keys.s) player.y += 6;
  player.x = Math.max(20, Math.min(width - 20, player.x));
  player.y = Math.max(260, Math.min(height - 24, player.y));
  if (player.cooldown > 0) player.cooldown -= 1;
  if (player.invincible > 0) player.invincible -= 1;
  fire();

  boss.x = width / 2 + Math.sin(frame / 42) * 118;
  boss.y = 110 + Math.sin(frame / 64) * 18;
  fireBossPattern();

  bullets.forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
  });
  bossBullets.forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
  });

  bullets.forEach((bullet) => {
    if (bullet.y < -20 || distance(bullet, boss) > boss.r) return;
    bullet.y = -100;
    boss.hp -= 3;
    score.value += 3;
    bossHp.value = Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100));
    if (bossHp.value === 67 || bossHp.value === 34) status.value = `进入第 ${phase.value} 阶段`;
  });
  bullets = bullets.filter((bullet) => bullet.y > -30);
  bossBullets = bossBullets.filter((bullet) => bullet.y < height + 30 && bullet.x > -30 && bullet.x < width + 30);

  if (player.invincible === 0) {
    const hit = bossBullets.find((bullet) => distance(player, bullet) < player.r + bullet.r);
    if (hit) {
      hit.y = height + 100;
      player.lives -= 1;
      player.invincible = 80;
      status.value = `护盾剩余 ${player.lives}`;
      if (player.lives <= 0) {
        finished = true;
        status.value = "挑战失败，点击画布重开";
        best.value = setBestScore("boss-rush", score.value);
      }
    }
  }

  if (boss.hp <= 0) {
    finished = true;
    score.value += 1000;
    bossHp.value = 0;
    status.value = "首领击破";
    best.value = setBestScore("boss-rush", score.value);
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.globalAlpha = player.invincible > 0 && frame % 10 < 5 ? 0.45 : 1;
  ctx.shadowBlur = 22;
  ctx.shadowColor = "#53f3ff";
  ctx.fillStyle = "#53f3ff";
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(20, 18);
  ctx.lineTo(0, 10);
  ctx.lineTo(-20, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ecfeff";
  ctx.fillRect(-4, -4, 8, 17);
  ctx.restore();
}

function drawBoss() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.shadowBlur = 28;
  ctx.shadowColor = phase.value === 3 ? "#ff5c7c" : "#ff4fd8";
  ctx.fillStyle = phase.value === 3 ? "#ff5c7c" : "#ff4fd8";
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 6;
    const radius = i % 2 ? boss.r * 0.72 : boss.r;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#020611";
  ctx.beginPath();
  ctx.arc(0, 0, boss.r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(83, 243, 255, 0.18)";
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 71 + frame * 0.45) % width;
    const y = (i * 43 + frame * 1.5) % height;
    ctx.fillRect(x, y, 2, 7);
  }

  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ffd166";
  ctx.fillStyle = "#ffd166";
  bullets.forEach((bullet) => ctx.fillRect(bullet.x - 2, bullet.y - 12, 4, 16));

  bossBullets.forEach((bullet) => {
    ctx.shadowColor = bullet.color;
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
  });

  drawBoss();
  drawPlayer();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ecfeff";
  ctx.font = "700 18px sans-serif";
  ctx.fillText(`SHIELD ${player.lives}`, 20, 32);
  ctx.fillText(`PHASE ${phase.value}`, width - 118, 32);
}

function loop() {
  update();
  draw();
  loopId = requestAnimationFrame(loop);
}

function resize() {
  const displayWidth = Math.min(canvas.value.parentElement.clientWidth - 24, 430);
  canvas.value.style.width = `${displayWidth}px`;
  canvas.value.style.height = `${displayWidth * (height / width)}px`;
}

function togglePause() {
  if (finished) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续挑战首领";
}

function onKeyDown(event) {
  keys[event.key] = true;
  if (event.key === " ") {
    event.preventDefault();
    togglePause();
  }
}

function onKeyUp(event) {
  keys[event.key] = false;
}

onMounted(() => {
  ctx = canvas.value.getContext("2d");
  canvas.value.width = width;
  canvas.value.height = height;
  restart();
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  loopId = requestAnimationFrame(loop);
});

onUnmounted(() => {
  cancelAnimationFrame(loopId);
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});
</script>

<template>
  <GameLayout
    game-id="boss-rush"
    :score="score"
    :best="best"
    :moves="`P${phase}`"
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
          aria-label="Boss Rush 飞机大战画布"
          @click="finished && restart()"
          @mousemove="movePlayerTo($event.clientX, $event.clientY)"
          @touchmove.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
          @touchstart.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
        ></canvas>
      </div>
      <aside class="control-panel">
        <h2>Boss 状态</h2>
        <div class="boss-meter" aria-label="Boss 血量">
          <span :style="{ width: `${bossHp}%` }"></span>
        </div>
        <p>血量：{{ bossHp }}%　阶段：{{ phase }}</p>
        <p>WASD / 方向键移动，自动射击。移动端拖动战机躲避弹幕。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.boss-meter {
  height: 14px;
  overflow: hidden;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: 999px;
  background: rgba(3, 8, 18, 0.82);
}

.boss-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #53f3ff, #ff4fd8, #ff5c7c);
  box-shadow: 0 0 18px rgba(255, 92, 124, 0.55);
}
</style>
