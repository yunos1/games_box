<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("plane-war"));
const status = ref("穿梭弹幕");
const paused = ref(false);
const progressVersion = ref(0);
const shieldCharges = ref(1);
const bombCharges = ref(1);
const focusCharges = ref(1);
const runResult = ref(null);
const dailyVariant = getDailyVariantForGame("plane-war");
const variantEffect = dailyVariant?.effect || "";

let ctx;
let width = 540;
let height = 700;
let player;
let bullets;
let enemies;
let enemyBullets;
let keys = {};
let frame = 0;
let loopId = 0;
let finished = false;
let kills = 0;
let hitsTaken = 0;
let focusFrames = 0;
let runNewGoalIds = new Set();

function restart() {
  player = { x: width / 2, y: height - 80, r: 18, lives: variantEffect === "extra-shield" ? 4 : 3, cooldown: 0 };
  bullets = [];
  enemies = [];
  enemyBullets = [];
  keys = {};
  frame = 0;
  kills = 0;
  hitsTaken = 0;
  focusFrames = 0;
  shieldCharges.value = 1;
  bombCharges.value = 1;
  focusCharges.value = 1;
  runResult.value = null;
  runNewGoalIds = new Set();
  score.value = 0;
  paused.value = false;
  finished = false;
  status.value =
    variantEffect === "elite-rush"
      ? "精英突袭：敌机更密，奖励更高"
      : variantEffect === "piercing-shot"
        ? "穿透弹幕：主武器伤害提高"
        : "穿梭弹幕";
  draw();
}

function spawnEnemy() {
  const r = 18 + Math.random() * 8;
  enemies.push({
    x: 36 + Math.random() * (width - 72),
    y: -30,
    r,
    hp: r > 22 || variantEffect === "elite-rush" ? 2 : 1,
    speed: (variantEffect === "elite-rush" ? 2.1 : 1.7) + Math.random() * 1.3,
    cooldown: (variantEffect === "elite-rush" ? 58 : 70) + Math.random() * 70,
  });
}

function fire() {
  if (player.cooldown > 0) return;
  const damage = variantEffect === "piercing-shot" ? 2 : 1;
  bullets.push({ x: player.x - 9, y: player.y - 24, vy: -8.4, damage, pierce: variantEffect === "piercing-shot" ? 1 : 0 });
  bullets.push({ x: player.x + 9, y: player.y - 24, vy: -8.4, damage, pierce: variantEffect === "piercing-shot" ? 1 : 0 });
  player.cooldown = focusFrames > 0 ? 7 : 10;
}

function movePlayerTo(clientX, clientY) {
  const rect = canvas.value.getBoundingClientRect();
  player.x = ((clientX - rect.left) / rect.width) * width;
  player.y = ((clientY - rect.top) / rect.height) * height;
  player.x = Math.max(22, Math.min(width - 22, player.x));
  player.y = Math.max(60, Math.min(height - 30, player.y));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function syncProgress() {
  const result = recordGameResult("plane-war", {
    score: score.value,
    kills,
    hitsTaken,
    survivedFrames: frame,
    dailyVariantId: dailyVariant?.id,
  });
  result.newlyUnlocked.forEach((id) => runNewGoalIds.add(id));
  progressVersion.value += 1;
  return result;
}

function showRunResult(title, detail) {
  const result = syncProgress();
  runResult.value = {
    title,
    detail,
    stats: [
      { label: "分数", value: score.value },
      { label: "击落", value: kills },
      { label: "受击", value: hitsTaken },
      { label: "生存", value: `${Math.floor(frame / 60)}s` },
    ],
    stars: result.stars,
    total: result.total,
    variantCompleted: result.variantCompleted,
    newGoals: result.goals.filter((goal) => runNewGoalIds.has(goal.id)),
    goals: result.goals,
  };
}

function update() {
  if (paused.value || finished) return;
  frame += 1;
  if (focusFrames > 0) focusFrames -= 1;
  if (frame % (variantEffect === "elite-rush" ? 30 : 44) === 0) spawnEnemy();
  const playerSpeed = focusFrames > 0 ? 7.4 : 6;
  if (keys.ArrowLeft || keys.a) player.x -= playerSpeed;
  if (keys.ArrowRight || keys.d) player.x += playerSpeed;
  if (keys.ArrowUp || keys.w) player.y -= playerSpeed;
  if (keys.ArrowDown || keys.s) player.y += playerSpeed;
  player.x = Math.max(22, Math.min(width - 22, player.x));
  player.y = Math.max(60, Math.min(height - 30, player.y));
  if (player.cooldown > 0) player.cooldown -= 1;
  fire();

  bullets.forEach((bullet) => {
    bullet.y += bullet.vy;
  });
  bullets = bullets.filter((bullet) => bullet.y > -20);

  enemies.forEach((enemy) => {
    enemy.y += enemy.speed;
    enemy.cooldown -= 1;
    if (enemy.cooldown <= 0) {
      const bulletSpeed = focusFrames > 0 ? 2.3 : 3.2;
      enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.r, vx: (player.x - enemy.x) / 95, vy: bulletSpeed });
      enemy.cooldown = 90 + Math.random() * 80;
    }
  });

  enemyBullets.forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += focusFrames > 0 ? bullet.vy * 0.72 : bullet.vy;
  });
  enemyBullets = enemyBullets.filter((bullet) => bullet.y < height + 30);

  bullets.forEach((bullet) => {
    enemies.forEach((enemy) => {
      if (enemy.hp <= 0 || distance(bullet, enemy) > enemy.r + 4) return;
      enemy.hp -= bullet.damage || 1;
      if (bullet.pierce > 0) bullet.pierce -= 1;
      else bullet.y = -100;
      if (enemy.hp <= 0) {
        kills += 1;
        score.value += variantEffect === "elite-rush" ? 30 : 20;
        best.value = setBestScore("plane-war", score.value);
        syncProgress();
      }
    });
  });
  enemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.y < height + 60);

  const hitEnemy = enemies.find((enemy) => distance(player, enemy) < player.r + enemy.r);
  const hitBullet = enemyBullets.find((bullet) => distance(player, bullet) < player.r + 5);
  if (hitEnemy || hitBullet) {
    if (hitEnemy) hitEnemy.hp = 0;
    if (hitBullet) hitBullet.y = height + 100;
    hitsTaken += 1;
    player.lives -= 1;
    status.value = `护盾剩余 ${player.lives}`;
    if (player.lives <= 0) {
      finished = true;
      status.value = "战机坠毁，点击重开";
      best.value = setBestScore("plane-war", score.value);
      showRunResult("战机坠毁", `本局受击 ${hitsTaken} 次，已保留击落与星级进度。`);
    }
  }
}

function drawPlane(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "#53f3ff";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#53f3ff";
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(22, 22);
  ctx.lineTo(0, 12);
  ctx.lineTo(-22, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff4fd8";
  ctx.fillRect(-5, -6, 10, 24);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(83, 243, 255, 0.18)";
  for (let i = 0; i < 54; i += 1) {
    const x = (i * 97 + frame * 0.7) % width;
    const y = (i * 53 + frame * 2) % height;
    ctx.fillRect(x, y, 2, 8);
  }

  ctx.shadowBlur = 12;
  ctx.shadowColor = "#ffd166";
  ctx.fillStyle = "#ffd166";
  bullets.forEach((bullet) => ctx.fillRect(bullet.x - 2, bullet.y - 12, 4, 16));

  ctx.shadowColor = "#ff5c7c";
  ctx.fillStyle = "#ff5c7c";
  enemyBullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  enemies.forEach((enemy) => {
    ctx.shadowColor = "#ff4fd8";
    ctx.fillStyle = enemy.hp > 1 ? "#ff4fd8" : "#a78bfa";
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y + enemy.r);
    ctx.lineTo(enemy.x + enemy.r, enemy.y - enemy.r);
    ctx.lineTo(enemy.x - enemy.r, enemy.y - enemy.r);
    ctx.closePath();
    ctx.fill();
  });
  drawPlane(player.x, player.y);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ecfeff";
  ctx.font = "700 18px sans-serif";
  ctx.fillText(`SHIELD ${player.lives}`, 20, 30);
  if (focusFrames > 0) ctx.fillText("FOCUS", width - 92, 30);
}

function useShield() {
  if (finished || shieldCharges.value <= 0) return;
  shieldCharges.value -= 1;
  player.lives += 1;
  status.value = `护盾强化 ${player.lives}`;
}

function useBomb() {
  if (finished || bombCharges.value <= 0) return;
  const removedEnemies = enemies.length;
  const removedBullets = enemyBullets.length;
  if (!removedEnemies && !removedBullets) return;
  bombCharges.value -= 1;
  enemies = [];
  enemyBullets = [];
  kills += removedEnemies;
  score.value += removedEnemies * 15;
  best.value = setBestScore("plane-war", score.value);
  status.value = "脉冲清屏";
  syncProgress();
}

function useFocus() {
  if (finished || focusCharges.value <= 0) return;
  focusCharges.value -= 1;
  focusFrames = 300;
  status.value = "专注模式";
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
  status.value = paused.value ? "已暂停" : "继续作战";
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
    game-id="plane-war"
    :score="score"
    :best="best"
    :status="status"
    :paused="paused"
    :progress-version="progressVersion"
    :run-result="runResult"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
    @dismiss-result="runResult = null"
  >
    <section class="game-panel split-panel">
      <div class="board-shell">
        <canvas
          ref="canvas"
          class="canvas-board"
          aria-label="飞机大战游戏画布"
          @click="finished && restart()"
          @mousemove="movePlayerTo($event.clientX, $event.clientY)"
          @touchmove.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
          @touchstart.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
        ></canvas>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>键盘 WASD / 方向键移动，自动射击。移动端拖动战机，空格暂停。</p>
        <h3>技能</h3>
        <div class="segmented">
          <button type="button" :disabled="shieldCharges <= 0" @click="useShield">护盾 {{ shieldCharges }}</button>
          <button type="button" :disabled="bombCharges <= 0" @click="useBomb">清屏 {{ bombCharges }}</button>
          <button type="button" :disabled="focusCharges <= 0" @click="useFocus">专注 {{ focusCharges }}</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>
