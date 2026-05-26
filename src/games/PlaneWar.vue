<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { Bomb, Crosshair, Gauge, Rocket, Shield, Sparkles, Target, Wrench, Zap } from "lucide-vue-next";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("plane-war"));
const status = ref("穿梭弹幕");
const paused = ref(false);
const progressVersion = ref(0);
const shieldCharges = ref(9);
const bombCharges = ref(9);
const focusCharges = ref(9);
const burstCharges = ref(9);
const repairCharges = ref(9);
const laserCharges = ref(9);
const spreadCharges = ref(9);
const slowCharges = ref(9);
const magnetCharges = ref(9);
const droneCharges = ref(9);
const runResult = ref(null);
const dailyVariant = getDailyVariantForGame("plane-war");
const variantEffect = dailyVariant?.effect || "";
const playerRadius = 13;
const playerPlaneScale = 0.68;
const enemyMinRadius = 13;
const enemyRadiusRange = 6;

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
let burstFrames = 0;
let laserFrames = 0;
let slowFrames = 0;
let magnetFrames = 0;
let droneFrames = 0;
let runNewGoalIds = new Set();
let playerSkinIndex = 0;

const fighterSkins = [
  { hull: "#53f3ff", wing: "#1d4ed8", cockpit: "#ecfeff", trim: "#ff4fd8", flame: "#ffd166", glow: "#53f3ff" },
  { hull: "#f97316", wing: "#7c2d12", cockpit: "#ffedd5", trim: "#facc15", flame: "#fb7185", glow: "#fdba74" },
  { hull: "#22c55e", wing: "#14532d", cockpit: "#dcfce7", trim: "#a3e635", flame: "#67e8f9", glow: "#86efac" },
  { hull: "#a78bfa", wing: "#4c1d95", cockpit: "#ede9fe", trim: "#f0abfc", flame: "#f472b6", glow: "#c4b5fd" },
  { hull: "#f43f5e", wing: "#881337", cockpit: "#ffe4e6", trim: "#fb7185", flame: "#fde047", glow: "#fda4af" },
  { hull: "#38bdf8", wing: "#075985", cockpit: "#e0f2fe", trim: "#2dd4bf", flame: "#fef08a", glow: "#7dd3fc" },
  { hull: "#eab308", wing: "#713f12", cockpit: "#fef9c3", trim: "#84cc16", flame: "#fb923c", glow: "#fde047" },
  { hull: "#14b8a6", wing: "#134e4a", cockpit: "#ccfbf1", trim: "#5eead4", flame: "#c084fc", glow: "#2dd4bf" },
  { hull: "#64748b", wing: "#0f172a", cockpit: "#e2e8f0", trim: "#94a3b8", flame: "#38bdf8", glow: "#cbd5e1" },
  { hull: "#d946ef", wing: "#701a75", cockpit: "#fae8ff", trim: "#f9a8d4", flame: "#facc15", glow: "#e879f9" },
  { hull: "#fb7185", wing: "#4a044e", cockpit: "#fff1f2", trim: "#c084fc", flame: "#fdba74", glow: "#fda4af" },
  { hull: "#84cc16", wing: "#365314", cockpit: "#f7fee7", trim: "#22c55e", flame: "#67e8f9", glow: "#bef264" },
  { hull: "#0ea5e9", wing: "#082f49", cockpit: "#f0f9ff", trim: "#f59e0b", flame: "#f97316", glow: "#38bdf8" },
  { hull: "#c084fc", wing: "#312e81", cockpit: "#faf5ff", trim: "#60a5fa", flame: "#fb7185", glow: "#ddd6fe" },
  { hull: "#f59e0b", wing: "#431407", cockpit: "#fffbeb", trim: "#ef4444", flame: "#fde68a", glow: "#fbbf24" },
  { hull: "#2dd4bf", wing: "#042f2e", cockpit: "#f0fdfa", trim: "#818cf8", flame: "#f472b6", glow: "#5eead4" },
];
const skillButtons = [
  { id: "spread", label: "\u6563\u5c04", icon: Target, charges: spreadCharges, action: useSpread },
  { id: "slow", label: "\u7f13\u6d41", icon: Gauge, charges: slowCharges, action: useSlow },
  { id: "magnet", label: "\u78c1\u8f68", icon: Crosshair, charges: magnetCharges, action: useMagnet },
  { id: "drone", label: "\u50da\u673a", icon: Rocket, charges: droneCharges, action: useDrone },
  { id: "shield", label: "护盾", icon: Shield, charges: shieldCharges, action: useShield },
  { id: "bomb", label: "清屏", icon: Bomb, charges: bombCharges, action: useBomb },
  { id: "focus", label: "专注", icon: Crosshair, charges: focusCharges, action: useFocus },
  { id: "burst", label: "连射", icon: Zap, charges: burstCharges, action: useBurst },
  { id: "repair", label: "维修", icon: Wrench, charges: repairCharges, action: useRepair },
  { id: "laser", label: "光束", icon: Sparkles, charges: laserCharges, action: useLaser },
];

function randomSkinIndex(exclude = -1) {
  if (fighterSkins.length < 2) return 0;
  let next = exclude;
  while (next === exclude) next = Math.floor(Math.random() * fighterSkins.length);
  return next;
}

function restart() {
  playerSkinIndex = randomSkinIndex(playerSkinIndex);
  player = {
    x: width / 2,
    y: height - 80,
    r: playerRadius,
    lives: variantEffect === "extra-shield" ? 4 : 3,
    cooldown: 0,
    skin: playerSkinIndex,
  };
  bullets = [];
  enemies = [];
  enemyBullets = [];
  keys = {};
  frame = 0;
  kills = 0;
  hitsTaken = 0;
  focusFrames = 0;
  burstFrames = 0;
  laserFrames = 0;
  slowFrames = 0;
  magnetFrames = 0;
  droneFrames = 0;
  shieldCharges.value = 9;
  bombCharges.value = 9;
  focusCharges.value = 9;
  burstCharges.value = 9;
  repairCharges.value = 9;
  laserCharges.value = 9;
  spreadCharges.value = 9;
  slowCharges.value = 9;
  magnetCharges.value = 9;
  droneCharges.value = 9;
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
  const r = enemyMinRadius + Math.random() * enemyRadiusRange;
  const hp = r > 17 || variantEffect === "elite-rush" ? 2 : 1;
  enemies.push({
    x: 36 + Math.random() * (width - 72),
    y: -30,
    r,
    hp,
    maxHp: hp,
    speed: (variantEffect === "elite-rush" ? 2.1 : 1.7) + Math.random() * 1.3,
    cooldown: (variantEffect === "elite-rush" ? 58 : 70) + Math.random() * 70,
    skin: randomSkinIndex(),
  });
}

function fire() {
  if (player.cooldown > 0) return;
  const damage = variantEffect === "piercing-shot" ? 2 : 1;
  const pierce = variantEffect === "piercing-shot" ? 1 : 0;
  bullets.push({ x: player.x - 7, y: player.y - 18, vy: -8.4, damage, pierce });
  bullets.push({ x: player.x + 7, y: player.y - 18, vy: -8.4, damage, pierce });
  if (burstFrames > 0) {
    bullets.push({ x: player.x, y: player.y - 22, vy: -9.2, damage, pierce });
    bullets.push({ x: player.x - 13, y: player.y - 9, vx: -0.55, vy: -7.9, damage, pierce });
    bullets.push({ x: player.x + 13, y: player.y - 9, vx: 0.55, vy: -7.9, damage, pierce });
  }
  if (droneFrames > 0) {
    bullets.push({ x: player.x - 22, y: player.y - 6, vx: -0.35, vy: -8.8, damage, pierce });
    bullets.push({ x: player.x + 22, y: player.y - 6, vx: 0.35, vy: -8.8, damage, pierce });
  }
  player.cooldown = burstFrames > 0 ? 5 : focusFrames > 0 ? 7 : 10;
}

function movePlayerTo(clientX, clientY) {
  const rect = canvas.value.getBoundingClientRect();
  player.x = ((clientX - rect.left) / rect.width) * width;
  player.y = ((clientY - rect.top) / rect.height) * height;
  player.x = Math.max(player.r + 6, Math.min(width - player.r - 6, player.x));
  player.y = Math.max(42, Math.min(height - player.r - 10, player.y));
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
  if (burstFrames > 0) burstFrames -= 1;
  if (laserFrames > 0) laserFrames -= 1;
  if (slowFrames > 0) slowFrames -= 1;
  if (magnetFrames > 0) magnetFrames -= 1;
  if (droneFrames > 0) droneFrames -= 1;
  if (frame % (variantEffect === "elite-rush" ? 30 : 44) === 0) spawnEnemy();
  const playerSpeed = focusFrames > 0 ? 7.4 : 6;
  if (keys.ArrowLeft || keys.a) player.x -= playerSpeed;
  if (keys.ArrowRight || keys.d) player.x += playerSpeed;
  if (keys.ArrowUp || keys.w) player.y -= playerSpeed;
  if (keys.ArrowDown || keys.s) player.y += playerSpeed;
  player.x = Math.max(player.r + 6, Math.min(width - player.r - 6, player.x));
  player.y = Math.max(42, Math.min(height - player.r - 10, player.y));
  if (player.cooldown > 0) player.cooldown -= 1;
  fire();

  bullets.forEach((bullet) => {
    if (magnetFrames > 0 && enemies.length) {
      const target = enemies.reduce((nearest, enemy) => {
        if (enemy.hp <= 0) return nearest;
        if (!nearest) return enemy;
        return Math.abs(enemy.x - bullet.x) < Math.abs(nearest.x - bullet.x) ? enemy : nearest;
      }, null);
      if (target) bullet.x += (target.x - bullet.x) * 0.028;
    }
    bullet.x += bullet.vx || 0;
    bullet.y += bullet.vy;
  });
  bullets = bullets.filter((bullet) => bullet.y > -20);

  enemies.forEach((enemy) => {
    enemy.y += enemy.speed * (slowFrames > 0 ? 0.64 : 1);
    enemy.cooldown -= 1;
    if (enemy.cooldown <= 0) {
      const bulletSpeed = focusFrames > 0 ? 2.3 : 3.2;
      enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.r, vx: (player.x - enemy.x) / 95, vy: bulletSpeed });
      enemy.cooldown = 90 + Math.random() * 80;
    }
  });

  enemyBullets.forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += (focusFrames > 0 ? bullet.vy * 0.72 : bullet.vy) * (slowFrames > 0 ? 0.66 : 1);
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

  if (laserFrames > 0) {
    enemies.forEach((enemy) => {
      if (Math.abs(enemy.x - player.x) > 14 || enemy.y >= player.y) return;
      enemy.hp -= 0.055;
      if (enemy.hp <= 0) {
        kills += 1;
        score.value += variantEffect === "elite-rush" ? 30 : 20;
        best.value = setBestScore("plane-war", score.value);
        syncProgress();
      }
    });
    enemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.y < height + 60);
  }

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

function drawPlane(x, y, options = {}) {
  const { enemy = false, skinIndex = 0, scale = 1, elite = false } = options;
  const skin = fighterSkins[skinIndex % fighterSkins.length];
  const direction = enemy ? -1 : 1;
  const pulse = 0.75 + Math.sin(frame / 9 + skinIndex) * 0.25;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale * direction);
  ctx.shadowColor = skin.glow;
  ctx.shadowBlur = enemy ? 14 : 22;

  ctx.fillStyle = skin.wing;
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(34, 15);
  ctx.lineTo(14, 8);
  ctx.lineTo(8, 30);
  ctx.lineTo(0, 22);
  ctx.lineTo(-8, 30);
  ctx.lineTo(-14, 8);
  ctx.lineTo(-34, 15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skin.hull;
  ctx.beginPath();
  ctx.moveTo(0, -36);
  ctx.bezierCurveTo(13, -18, 12, 12, 5, 31);
  ctx.lineTo(0, 37);
  ctx.lineTo(-5, 31);
  ctx.bezierCurveTo(-12, 12, -13, -18, 0, -36);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skin.cockpit;
  ctx.beginPath();
  ctx.ellipse(0, -13, 6, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin.trim;
  ctx.fillRect(-3, 1, 6, 22);
  ctx.beginPath();
  ctx.moveTo(-18, 18);
  ctx.lineTo(-29, 31);
  ctx.lineTo(-10, 25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, 18);
  ctx.lineTo(29, 31);
  ctx.lineTo(10, 25);
  ctx.closePath();
  ctx.fill();

  if (!enemy || elite) {
    ctx.shadowBlur = 10 + pulse * 12;
    ctx.shadowColor = skin.flame;
    ctx.fillStyle = skin.flame;
    ctx.beginPath();
    ctx.moveTo(-8, 31);
    ctx.lineTo(0, 48 + pulse * 10);
    ctx.lineTo(8, 31);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawEnemyHealth(enemy) {
  const maxHp = enemy.maxHp || 1;
  if (maxHp <= 1) return;
  const barWidth = enemy.r * 1.75;
  const barHeight = 5;
  const x = enemy.x - barWidth / 2;
  const y = enemy.y - enemy.r - 18;
  const ratio = Math.max(0, Math.min(1, enemy.hp / maxHp));

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(3, 8, 18, 0.76)";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = ratio > 0.5 ? "#67e8f9" : "#ffd166";
  ctx.fillRect(x, y, barWidth * ratio, barHeight);
  ctx.strokeStyle = "rgba(236, 254, 255, 0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);
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
    drawPlane(enemy.x, enemy.y, {
      enemy: true,
      elite: enemy.hp > 1,
      scale: Math.max(0.54, enemy.r / 23),
      skinIndex: enemy.skin,
    });
    drawEnemyHealth(enemy);
  });

  if (laserFrames > 0) {
    const skin = fighterSkins[player.skin % fighterSkins.length];
    ctx.shadowBlur = 28;
    ctx.shadowColor = skin.glow;
    ctx.strokeStyle = skin.trim;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 24);
    ctx.lineTo(player.x, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(236,254,255,0.78)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawPlane(player.x, player.y, { skinIndex: player.skin, scale: playerPlaneScale });

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ecfeff";
  ctx.font = "700 18px sans-serif";
  ctx.fillText(`SHIELD ${player.lives}`, 20, 30);
  if (focusFrames > 0) ctx.fillText("FOCUS", width - 92, 30);
  if (burstFrames > 0) ctx.fillText("BURST", width - 188, 30);
  if (laserFrames > 0) ctx.fillText("LASER", width - 286, 30);
  if (slowFrames > 0) ctx.fillText("SLOW", 20, 56);
  if (droneFrames > 0) ctx.fillText("DRONE", 102, 56);
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

function useBurst() {
  if (finished || burstCharges.value <= 0) return;
  burstCharges.value -= 1;
  burstFrames = 360;
  status.value = "连射过载";
}

function useRepair() {
  if (finished || repairCharges.value <= 0) return;
  if (player.lives >= 5) return;
  repairCharges.value -= 1;
  player.lives = Math.min(5, player.lives + 2);
  status.value = `维修完成 ${player.lives}`;
}

function useLaser() {
  if (finished || laserCharges.value <= 0) return;
  laserCharges.value -= 1;
  laserFrames = 180;
  status.value = "光束锁定";
}

function useSpread() {
  if (finished || spreadCharges.value <= 0) return;
  spreadCharges.value -= 1;
  const damage = variantEffect === "piercing-shot" ? 2 : 1;
  [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8].forEach((vx) => {
    bullets.push({ x: player.x, y: player.y - 18, vx, vy: -8.4 + Math.abs(vx) * 0.25, damage, pierce: 0 });
  });
  status.value = "\u6563\u5c04\u9f50\u5c04";
}

function useSlow() {
  if (finished || slowCharges.value <= 0) return;
  slowCharges.value -= 1;
  slowFrames = 360;
  status.value = "\u654c\u673a\u7f13\u6d41";
}

function useMagnet() {
  if (finished || magnetCharges.value <= 0) return;
  magnetCharges.value -= 1;
  magnetFrames = 420;
  status.value = "\u78c1\u8f68\u5f39\u836f";
}

function useDrone() {
  if (finished || droneCharges.value <= 0) return;
  droneCharges.value -= 1;
  droneFrames = 420;
  status.value = "\u50da\u673a\u4e0a\u7ebf";
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
  width = Math.max(260, Math.floor(parent.clientWidth));
  height = Math.max(320, Math.floor(parent.clientHeight));
  canvas.value.width = width;
  canvas.value.height = height;
  canvas.value.style.width = "100%";
  canvas.value.style.height = "100%";

  if (!player) return;
  const xScale = width / previousWidth;
  const yScale = height / previousHeight;
  player.x = Math.max(player.r + 6, Math.min(width - player.r - 6, player.x * xScale));
  player.y = Math.max(42, Math.min(height - player.r - 10, player.y * yScale));
  bullets = bullets.map((bullet) => ({ ...bullet, x: bullet.x * xScale, y: bullet.y * yScale }));
  enemies = enemies.map((enemy) => ({ ...enemy, x: enemy.x * xScale, y: enemy.y * yScale }));
  enemyBullets = enemyBullets.map((bullet) => ({ ...bullet, x: bullet.x * xScale, y: bullet.y * yScale }));
  draw();
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
    <section class="game-panel split-panel plane-war-panel">
      <div class="board-shell plane-war-board-shell">
        <canvas
          ref="canvas"
          class="canvas-board plane-war-canvas"
          aria-label="飞机大战游戏画布"
          @click="finished && restart()"
          @mousemove="movePlayerTo($event.clientX, $event.clientY)"
          @touchmove.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
          @touchstart.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
        ></canvas>
      </div>
      <aside class="control-panel plane-control-panel">
        <div class="plane-skill-grid" aria-label="技能">
          <button
            v-for="skill in skillButtons"
            :key="skill.id"
            class="plane-skill-button"
            type="button"
            :aria-label="`${skill.label}，剩余 ${skill.charges.value}`"
            :title="`${skill.label} x${skill.charges.value}`"
            :disabled="skill.charges.value <= 0"
            @click="skill.action"
          >
            <component :is="skill.icon" :size="15" />
            <span>{{ skill.charges.value }}</span>
          </button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.plane-war-panel {
  align-items: stretch;
}

.plane-war-board-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  background: #020611;
}

.plane-war-canvas {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.plane-control-panel {
  align-self: start;
  gap: 8px;
  overflow: hidden;
  max-height: none;
  padding: 10px;
}

.plane-skill-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.plane-skill-button {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 34px;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(6, 13, 28, 0.76);
  color: #ecfeff;
  cursor: pointer;
}

.plane-skill-button:hover:not(:disabled) {
  border-color: rgba(83, 243, 255, 0.72);
  background: rgba(83, 243, 255, 0.13);
}

.plane-skill-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.plane-skill-button span {
  position: absolute;
  right: 3px;
  bottom: 2px;
  min-width: 14px;
  height: 14px;
  border-radius: 999px;
  background: rgba(255, 209, 102, 0.18);
  color: var(--yellow);
  font-size: 0.58rem;
  font-weight: 900;
  line-height: 14px;
  text-align: center;
}
</style>
