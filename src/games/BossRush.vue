<script setup>
import { Activity, Coins, Crosshair, Gauge, HeartPulse, RadioTower, Shield, Sparkles, Zap } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";
import { recordGameResult } from "../utils/progress";

const ECONOMY_KEY = "boss-rush:economy";
const defaultUpgrades = {
  damage: 0,
  fireRate: 0,
  shield: 0,
  drone: 0,
};
const savedEconomy = getSavedValue(ECONOMY_KEY, {});

const bossStages = [
  {
    id: "sentinel",
    name: "哨戒核心",
    code: "SENTINEL",
    skill: "扇形拦截",
    pattern: "fan",
    hp: 360,
    reward: 55,
    sides: 12,
    radiusScale: 0.106,
    drift: 0.18,
    palette: {
      primary: "#53f3ff",
      secondary: "#2563eb",
      core: "#ffd166",
      dark: "#0f2c6b",
      bullet: "#ffd166",
      bulletAlt: "#53f3ff",
      nebula: "rgba(83, 243, 255, 0.11)",
    },
  },
  {
    id: "wraith",
    name: "幻影棱镜",
    code: "WRAITH",
    skill: "追踪棱弹",
    pattern: "hunter",
    hp: 430,
    reward: 75,
    sides: 10,
    radiusScale: 0.112,
    drift: 0.23,
    palette: {
      primary: "#ff4fd8",
      secondary: "#8b5cf6",
      core: "#ecfeff",
      dark: "#2e1065",
      bullet: "#ff4fd8",
      bulletAlt: "#a78bfa",
      nebula: "rgba(255, 79, 216, 0.13)",
    },
  },
  {
    id: "forge",
    name: "熔炉战舰",
    code: "FORGE",
    skill: "回旋火轮",
    pattern: "spiral",
    hp: 520,
    reward: 95,
    sides: 14,
    radiusScale: 0.12,
    drift: 0.16,
    palette: {
      primary: "#f97316",
      secondary: "#ef4444",
      core: "#fef08a",
      dark: "#431407",
      bullet: "#fb923c",
      bulletAlt: "#ff5c7c",
      nebula: "rgba(249, 115, 22, 0.1)",
    },
  },
  {
    id: "typhoon",
    name: "台风矩阵",
    code: "TYPHOON",
    skill: "弹幕降雨",
    pattern: "rain",
    hp: 600,
    reward: 120,
    sides: 16,
    radiusScale: 0.118,
    drift: 0.26,
    palette: {
      primary: "#2dd4bf",
      secondary: "#0f766e",
      core: "#ccfbf1",
      dark: "#042f2e",
      bullet: "#2dd4bf",
      bulletAlt: "#facc15",
      nebula: "rgba(45, 212, 191, 0.11)",
    },
  },
  {
    id: "monarch",
    name: "猩红王座",
    code: "MONARCH",
    skill: "终局复合弹幕",
    pattern: "monarch",
    hp: 760,
    reward: 180,
    sides: 18,
    radiusScale: 0.128,
    drift: 0.22,
    palette: {
      primary: "#ff5c7c",
      secondary: "#991b1b",
      core: "#ffd166",
      dark: "#450a0a",
      bullet: "#ff5c7c",
      bulletAlt: "#ff4fd8",
      nebula: "rgba(255, 92, 124, 0.13)",
    },
  },
];

const upgradeMeta = [
  { id: "damage", label: "伤害", icon: Crosshair, max: 5, baseCost: 80, stepCost: 55 },
  { id: "fireRate", label: "射速", icon: Zap, max: 4, baseCost: 70, stepCost: 60 },
  { id: "shield", label: "护盾", icon: Shield, max: 3, baseCost: 90, stepCost: 75 },
  { id: "drone", label: "僚机", icon: Gauge, max: 3, baseCost: 110, stepCost: 95 },
];

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("boss-rush"));
const status = ref("首领来袭");
const paused = ref(false);
const bossHp = ref(100);
const playerLives = ref(3);
const elapsedSeconds = ref(0);
const hitsTaken = ref(0);
const bossHits = ref(0);
const currentStageIndex = ref(0);
const clearedStages = ref(0);
const coins = ref(Math.max(0, Number(savedEconomy.coins) || 0));
const coinsEarned = ref(0);
const upgrades = ref({ ...defaultUpgrades, ...(savedEconomy.upgrades || {}) });
const progressVersion = ref(0);
const runResult = ref(null);

let width = 540;
let height = 720;
let ctx;
let player;
let boss;
let bullets;
let bossBullets;
let particles;
let floaters;
let keys = {};
let frame = 0;
let stageFrame = 0;
let stageTransition = 0;
let loopId = 0;
let finished = false;
let shock = 0;
let runNewGoalIds = new Set();

const currentStage = computed(() => bossStages[currentStageIndex.value] || bossStages[0]);
const stageCount = bossStages.length;
const stageDisplay = computed(() => `${currentStageIndex.value + 1}/${stageCount}`);
const phase = computed(() => {
  if (bossHp.value <= 34) return 3;
  if (bossHp.value <= 67) return 2;
  return 1;
});

const phaseLabel = computed(() => ["", "OPEN", "RAGE", "NOVA"][phase.value]);
const maxShield = computed(() => 3 + (Number(upgrades.value.shield) || 0));
const shieldRatio = computed(() => Math.max(0, Math.min(100, (playerLives.value / maxShield.value) * 100)));
const shieldDisplay = computed(() => Math.max(0, playerLives.value));
const upgradeDefinitions = computed(() =>
  upgradeMeta.map((item) => {
    const level = Number(upgrades.value[item.id]) || 0;
    const cost = item.baseCost + level * item.stepCost;
    return {
      ...item,
      level,
      cost,
      maxed: level >= item.max,
      affordable: coins.value >= cost,
    };
  }),
);

const phaseNodes = [
  { value: 1, label: "OPEN" },
  { value: 2, label: "RAGE" },
  { value: 3, label: "NOVA" },
];

function bossRadius() {
  return Math.max(46, Math.min(78, width * currentStage.value.radiusScale));
}

function saveEconomy() {
  setSavedValue(ECONOMY_KEY, {
    coins: coins.value,
    upgrades: upgrades.value,
  });
}

function upgradeSkill(id) {
  const item = upgradeDefinitions.value.find((entry) => entry.id === id);
  if (!item || item.maxed || !item.affordable) return;
  coins.value -= item.cost;
  upgrades.value = {
    ...upgrades.value,
    [id]: item.level + 1,
  };
  if (id === "shield" && player && !finished) {
    player.lives += 1;
    playerLives.value = player.lives;
  }
  saveEconomy();
  status.value = `${item.label} Lv.${item.level + 1}`;
}

function makePlayer() {
  player = {
    x: width / 2,
    y: height - 78,
    r: 15,
    lives: maxShield.value,
    cooldown: 0,
    invincible: 0,
    trail: [],
  };
  playerLives.value = player.lives;
}

function startStage(index) {
  const stage = bossStages[index] || bossStages[0];
  currentStageIndex.value = index;
  stageFrame = 0;
  stageTransition = 0;
  boss = {
    x: width / 2,
    y: Math.max(104, height * 0.16),
    r: bossRadius(),
    hp: stage.hp,
    maxHp: stage.hp,
    angle: 0,
    flash: 0,
    defeated: false,
  };
  bullets = [];
  bossBullets = [];
  bossHp.value = 100;
  status.value = `${stage.name} 接近`;
  draw();
}

function restart() {
  currentStageIndex.value = 0;
  clearedStages.value = 0;
  coinsEarned.value = 0;
  makePlayer();
  bullets = [];
  bossBullets = [];
  particles = [];
  floaters = [];
  keys = {};
  frame = 0;
  stageFrame = 0;
  stageTransition = 0;
  hitsTaken.value = 0;
  bossHits.value = 0;
  shock = 0;
  runNewGoalIds = new Set();
  score.value = 0;
  bossHp.value = 100;
  elapsedSeconds.value = 0;
  paused.value = false;
  runResult.value = null;
  finished = false;
  startStage(0);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampPlayer() {
  player.x = Math.max(player.r + 8, Math.min(width - player.r - 8, player.x));
  player.y = Math.max(height * 0.36, Math.min(height - player.r - 12, player.y));
}

function movePlayerTo(clientX, clientY) {
  if (finished || !canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  player.x = ((clientX - rect.left) / rect.width) * width;
  player.y = ((clientY - rect.top) / rect.height) * height;
  clampPlayer();
}

function addParticles(x, y, color, amount = 8, power = 2.4) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * power;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 18 + Math.random() * 20,
      maxLife: 38,
      size: 1.4 + Math.random() * 3.4,
      color,
    });
  }
}

function addFloater(x, y, text, color = "#ecfeff") {
  floaters.push({ x, y, text, color, life: 42, maxLife: 42 });
}

function fire() {
  if (player.cooldown > 0) return;
  const damage = 4 + (Number(upgrades.value.damage) || 0) * 1.25;
  const droneLevel = Number(upgrades.value.drone) || 0;
  const boost = phase.value === 3 ? 0.2 : 0;
  bullets.push({ x: player.x - 11, y: player.y - 25, vx: -0.42 - boost, vy: -10.2, damage });
  bullets.push({ x: player.x + 11, y: player.y - 25, vx: 0.42 + boost, vy: -10.2, damage });
  if (phase.value >= 2) bullets.push({ x: player.x, y: player.y - 31, vx: 0, vy: -11.2, damage: damage * 0.82 });
  if (droneLevel > 0) {
    bullets.push({ x: player.x - 25, y: player.y - 8, vx: -0.22 - droneLevel * 0.04, vy: -9.2, damage: damage * (0.38 + droneLevel * 0.1) });
    bullets.push({ x: player.x + 25, y: player.y - 8, vx: 0.22 + droneLevel * 0.04, vy: -9.2, damage: damage * (0.38 + droneLevel * 0.1) });
  }
  player.cooldown = Math.max(4, (phase.value === 3 ? 6 : 8) - (Number(upgrades.value.fireRate) || 0));
}

function spawnBossBullet(x, y, vx, vy, options = {}) {
  bossBullets.push({
    x,
    y,
    vx,
    vy,
    r: options.r || 5,
    color: options.color || "#ff5c7c",
    core: options.core || "#fff1f2",
    type: options.type || "orb",
    spin: Math.random() * Math.PI * 2,
  });
}

function fireBossPattern() {
  const stage = currentStage.value;
  const palette = stage.palette;
  const hpRatio = boss.hp / boss.maxHp;
  const currentPhase = hpRatio > 0.67 ? 1 : hpRatio > 0.34 ? 2 : 3;
  const cadence = Math.max(10, 40 - currentPhase * 6 - currentStageIndex.value * 2);
  if (frame % cadence !== 0) return;

  if (stage.pattern === "fan") {
    for (let i = -2; i <= 2; i += 1) {
      spawnBossBullet(boss.x + i * 13, boss.y + boss.r * 0.62, i * 0.78, 3.2, {
        color: palette.bullet,
        core: palette.core,
        r: 5.5,
      });
    }
    if (currentPhase >= 3) {
      const base = Math.atan2(player.y - boss.y, player.x - boss.x);
      spawnBossBullet(boss.x, boss.y, Math.cos(base) * 3.8, Math.sin(base) * 3.8, {
        color: palette.bulletAlt,
        core: "#ecfeff",
        r: 6,
        type: "diamond",
      });
    }
    return;
  }

  if (stage.pattern === "hunter") {
    const base = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let i = -2; i <= 2 + (currentPhase === 3 ? 1 : 0); i += 1) {
      const angle = base + i * 0.16;
      spawnBossBullet(boss.x, boss.y + boss.r * 0.34, Math.cos(angle) * 3.45, Math.sin(angle) * 3.45, {
        color: palette.bullet,
        core: palette.core,
        r: 5.4,
        type: "diamond",
      });
    }
    for (const side of [-1, 1]) {
      spawnBossBullet(boss.x + side * boss.r * 0.72, boss.y, side * 1.1, 3.55, {
        color: palette.bulletAlt,
        core: "#ecfeff",
        r: 4.6,
      });
    }
    return;
  }

  if (stage.pattern === "spiral") {
    boss.angle += 0.42;
    for (let i = 0; i < 8 + currentPhase * 2; i += 1) {
      const angle = boss.angle + (Math.PI * 2 * i) / (8 + currentPhase * 2);
      spawnBossBullet(boss.x, boss.y, Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, {
        color: i % 2 ? palette.bulletAlt : palette.bullet,
        core: palette.core,
        r: 4.8,
        type: i % 2 ? "diamond" : "orb",
      });
    }
    return;
  }

  if (stage.pattern === "rain") {
    for (let i = 0; i < 5 + currentPhase; i += 1) {
      const x = ((frame * 17 + i * 83) % (width + 80)) - 40;
      spawnBossBullet(x, -18, Math.sin((frame + i * 19) / 38) * 0.7, 3.05 + currentPhase * 0.28, {
        color: i % 2 ? palette.bulletAlt : palette.bullet,
        core: palette.core,
        r: 4.8,
        type: "diamond",
      });
    }
    const base = Math.atan2(player.y - boss.y, player.x - boss.x);
    spawnBossBullet(boss.x, boss.y + boss.r * 0.35, Math.cos(base) * 3.9, Math.sin(base) * 3.9, {
      color: palette.bullet,
      core: "#ecfeff",
      r: 6.4,
    });
    return;
  }

  boss.angle += 0.34;
  for (let i = 0; i < 10 + currentPhase * 2; i += 1) {
    const angle = boss.angle + (Math.PI * 2 * i) / (10 + currentPhase * 2);
    spawnBossBullet(boss.x, boss.y, Math.cos(angle) * 2.7, Math.sin(angle) * 2.7, {
      color: i % 2 ? palette.bullet : palette.bulletAlt,
      core: palette.core,
      r: 4.9,
      type: i % 2 ? "diamond" : "orb",
    });
  }
  if (frame % 40 === 0) {
    const base = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let i = -1; i <= 1; i += 1) {
      const angle = base + i * 0.13;
      spawnBossBullet(boss.x, boss.y + boss.r * 0.2, Math.cos(angle) * 4.25, Math.sin(angle) * 4.25, {
        color: palette.bulletAlt,
        core: "#fdf4ff",
        r: 6.2,
        type: "diamond",
      });
    }
  }
}

function syncProgress(won) {
  const result = recordGameResult("boss-rush", {
    score: score.value,
    won,
    completed: won,
    hitsTaken: hitsTaken.value,
    bossHits: bossHits.value,
    stagesCleared: clearedStages.value,
    coinsEarned: coinsEarned.value,
    survivedFrames: frame,
    livesLeft: player?.lives || 0,
    bossHp: bossHp.value,
  });
  result.newlyUnlocked.forEach((id) => runNewGoalIds.add(id));
  progressVersion.value += 1;
  return result;
}

function showRunResult(title, detail, won) {
  const result = syncProgress(won);
  runResult.value = {
    title,
    detail,
    stats: [
      { label: "分数", value: score.value },
      { label: "关卡", value: `${clearedStages.value}/${stageCount}` },
      { label: "金币", value: `+${coinsEarned.value}` },
      { label: "命中", value: bossHits.value },
      { label: "受击", value: hitsTaken.value },
      { label: "耗时", value: `${Math.floor(frame / 60)}s` },
    ],
    stars: result.stars,
    total: result.total,
    variantCompleted: result.variantCompleted,
    newGoals: result.goals.filter((goal) => runNewGoalIds.has(goal.id)),
    goals: result.goals,
  };
}

function clearStage() {
  if (stageTransition > 0 || finished || boss.defeated) return;
  const stage = currentStage.value;
  const finalStage = currentStageIndex.value >= stageCount - 1;
  const reward = stage.reward + Math.max(0, player.lives) * 8 + (finalStage ? 60 : 0);
  boss.defeated = true;
  clearedStages.value += 1;
  coins.value += reward;
  coinsEarned.value += reward;
  saveEconomy();
  score.value += stage.reward * 6 + Math.max(0, player.lives) * 70;
  status.value = `${stage.name} 击破 +${reward}G`;
  addFloater(boss.x, boss.y - boss.r, `+${reward}G`, "#ffd166");
  addParticles(boss.x, boss.y, stage.palette.core, 28, 5.2);
  addParticles(boss.x, boss.y, stage.palette.primary, 34, 5);
  shock = 10;

  if (finalStage) {
    endRun(true);
    return;
  }

  stageTransition = 96;
}

function endRun(won) {
  if (finished) return;
  finished = true;
  if (won) {
    score.value += 1000 + player.lives * 120 + coinsEarned.value;
    bossHp.value = 0;
    status.value = `全关突破 +${coinsEarned.value}G`;
    addParticles(boss.x, boss.y, currentStage.value.palette.core, 36, 5.5);
    addParticles(boss.x, boss.y, currentStage.value.palette.primary, 36, 5.2);
    shock = 10;
  } else {
    status.value = "挑战失败";
    addParticles(player.x, player.y, "#53f3ff", 22, 4.4);
    shock = 8;
  }
  best.value = setBestScore("boss-rush", score.value);
  showRunResult(won ? "全关突破" : "战机坠毁", won ? `连续击破 ${stageCount} 名首领，金币已存入升级仓。` : "本局金币与记录已保留，升级后再压进弹幕。", won);
}

function updateProjectiles() {
  bullets.forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
  });

  bossBullets.forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.spin += 0.08;
  });

  bullets.forEach((bullet) => {
    if (boss.defeated || bullet.dead || bullet.y < -30 || distance(bullet, boss) > boss.r * 0.94) return;
    bullet.dead = true;
    boss.hp = Math.max(0, boss.hp - bullet.damage);
    boss.flash = 5;
    bossHits.value += 1;
    score.value += Math.ceil(bullet.damage);
    bossHp.value = Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100));
    addParticles(bullet.x, bullet.y, phase.value === 3 ? "#ff5c7c" : "#53f3ff", 5, 2.1);
    if (bossHits.value % 18 === 0) addFloater(bullet.x, bullet.y - 12, `-${Math.round(bullet.damage * 18)}`, "#ffd166");
    if (bossHp.value === 67 || bossHp.value === 34) status.value = `进入第 ${phase.value} 阶段`;
    shock = Math.min(5, shock + 0.32);
  });

  bullets = bullets.filter((bullet) => !bullet.dead && bullet.y > -36);
  bossBullets = bossBullets.filter((bullet) => bullet.y < height + 36 && bullet.x > -40 && bullet.x < width + 40);
}

function updateParticles() {
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= 1;
  });
  particles = particles.filter((particle) => particle.life > 0);

  floaters.forEach((floater) => {
    floater.y -= 0.52;
    floater.life -= 1;
  });
  floaters = floaters.filter((floater) => floater.life > 0);
}

function update() {
  if (paused.value || finished) {
    updateParticles();
    if (shock > 0) shock *= 0.86;
    return;
  }

  frame += 1;
  stageFrame += 1;
  elapsedSeconds.value = Math.floor(frame / 60);

  if (stageTransition > 0) {
    stageTransition -= 1;
    updateParticles();
    if (shock > 0) shock *= 0.88;
    if (stageTransition === 0) startStage(currentStageIndex.value + 1);
    return;
  }

  boss.r = bossRadius();

  const playerSpeed = player.invincible > 0 ? 6.6 : 6;
  if (keys.ArrowLeft || keys.a || keys.A) player.x -= playerSpeed;
  if (keys.ArrowRight || keys.d || keys.D) player.x += playerSpeed;
  if (keys.ArrowUp || keys.w || keys.W) player.y -= playerSpeed;
  if (keys.ArrowDown || keys.s || keys.S) player.y += playerSpeed;
  clampPlayer();

  player.trail.push({ x: player.x, y: player.y + 19, life: 16 });
  player.trail = player.trail.map((point) => ({ ...point, life: point.life - 1 })).filter((point) => point.life > 0);

  if (player.cooldown > 0) player.cooldown -= 1;
  if (player.invincible > 0) player.invincible -= 1;
  if (boss.flash > 0) boss.flash -= 1;
  if (shock > 0) shock *= 0.88;
  fire();

  const drift = Math.min(width * currentStage.value.drift, 148);
  boss.x = width / 2 + Math.sin(stageFrame / 42) * drift + Math.sin(stageFrame / 93) * width * 0.035;
  boss.y = Math.max(92, height * 0.155) + Math.sin(stageFrame / 64) * 18;
  fireBossPattern();
  updateProjectiles();
  updateParticles();

  if (player.invincible === 0) {
    const hit = bossBullets.find((bullet) => distance(player, bullet) < player.r + bullet.r * 0.78);
    if (hit) {
      hit.y = height + 100;
      player.lives -= 1;
      playerLives.value = player.lives;
      hitsTaken.value += 1;
      player.invincible = 84;
      shock = 7;
      addParticles(player.x, player.y, hit.color, 18, 3.6);
      status.value = `护盾剩余 ${player.lives}`;
      if (player.lives <= 0) endRun(false);
    }
  }

  if (boss.hp <= 0) clearStage();
}

function drawNebula(x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(2, 6, 17, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackground() {
  const palette = currentStage.value.palette;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#050818");
  sky.addColorStop(0.42, "#080b1f");
  sky.addColorStop(1, "#020611");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawNebula(width * 0.18, height * 0.12, width * 0.46, palette.nebula);
  drawNebula(width * 0.84, height * 0.34, width * 0.42, "rgba(83, 243, 255, 0.09)");
  drawNebula(width * 0.43, height * 0.86, width * 0.5, "rgba(255, 209, 102, 0.07)");

  ctx.save();
  for (let layer = 0; layer < 3; layer += 1) {
    const count = [54, 38, 24][layer];
    const speed = [0.46, 1.1, 1.85][layer];
    ctx.fillStyle = `rgba(236, 254, 255, ${0.18 + layer * 0.16})`;
    ctx.strokeStyle = `rgba(83, 243, 255, ${0.08 + layer * 0.06})`;
    for (let i = 0; i < count; i += 1) {
      const x = (i * 97 + layer * 61 + Math.sin((frame + i) / 80) * 16) % width;
      const y = (i * 53 + layer * 79 + frame * speed) % height;
      const length = 3 + layer * 6;
      ctx.fillRect(x, y, layer + 1, layer + 1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1.2, y + length);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(83, 243, 255, 0.045)";
  ctx.lineWidth = 1;
  for (let y = (frame * 0.7) % 56; y < height; y += 56) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const vignette = ctx.createRadialGradient(width / 2, height * 0.48, height * 0.2, width / 2, height * 0.5, height * 0.74);
  vignette.addColorStop(0, "rgba(2, 6, 17, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawPlayerBullet(bullet) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ffd166";
  const beam = ctx.createLinearGradient(bullet.x, bullet.y + 10, bullet.x, bullet.y - 22);
  beam.addColorStop(0, "rgba(255, 209, 102, 0)");
  beam.addColorStop(0.4, "#ffd166");
  beam.addColorStop(1, "#ecfeff");
  ctx.strokeStyle = beam;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bullet.x, bullet.y + 12);
  ctx.lineTo(bullet.x - bullet.vx * 1.8, bullet.y - 18);
  ctx.stroke();
  ctx.restore();
}

function drawBossBullet(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(bullet.spin);
  ctx.shadowBlur = 17;
  ctx.shadowColor = bullet.color;

  if (bullet.type === "diamond") {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.moveTo(0, -bullet.r * 1.6);
    ctx.lineTo(bullet.r * 1.1, 0);
    ctx.lineTo(0, bullet.r * 1.6);
    ctx.lineTo(-bullet.r * 1.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = bullet.core;
    ctx.beginPath();
    ctx.arc(0, 0, bullet.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const orb = ctx.createRadialGradient(-bullet.r * 0.28, -bullet.r * 0.32, 0, 0, 0, bullet.r * 1.55);
    orb.addColorStop(0, bullet.core);
    orb.addColorStop(0.42, bullet.color);
    orb.addColorStop(1, "rgba(255, 92, 124, 0.08)");
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(0, 0, bullet.r * 1.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProjectiles() {
  bullets.forEach(drawPlayerBullet);
  bossBullets.forEach(drawBossBullet);
}

function drawPlayer() {
  ctx.save();

  player.trail.forEach((point) => {
    const alpha = point.life / 16;
    ctx.fillStyle = `rgba(83, 243, 255, ${alpha * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, 20 * alpha, 9 * alpha, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.translate(player.x, player.y);
  ctx.globalAlpha = player.invincible > 0 && frame % 10 < 5 ? 0.5 : 1;
  ctx.shadowBlur = 24;
  ctx.shadowColor = "#53f3ff";

  const flamePulse = 0.7 + Math.sin(frame / 6) * 0.3;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(-8, 24);
  ctx.lineTo(0, 44 + flamePulse * 10);
  ctx.lineTo(8, 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0f2c6b";
  ctx.beginPath();
  ctx.moveTo(0, -31);
  ctx.lineTo(31, 17);
  ctx.lineTo(11, 10);
  ctx.lineTo(7, 31);
  ctx.lineTo(0, 22);
  ctx.lineTo(-7, 31);
  ctx.lineTo(-11, 10);
  ctx.lineTo(-31, 17);
  ctx.closePath();
  ctx.fill();

  const hull = ctx.createLinearGradient(0, -36, 0, 34);
  hull.addColorStop(0, "#ecfeff");
  hull.addColorStop(0.32, "#53f3ff");
  hull.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.bezierCurveTo(14, -15, 13, 15, 5, 34);
  ctx.lineTo(0, 41);
  ctx.lineTo(-5, 34);
  ctx.bezierCurveTo(-13, 15, -14, -15, 0, -38);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fdf4ff";
  ctx.beginPath();
  ctx.ellipse(0, -12, 6, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff4fd8";
  ctx.fillRect(-3, 6, 6, 21);
  ctx.beginPath();
  ctx.moveTo(-17, 18);
  ctx.lineTo(-30, 31);
  ctx.lineTo(-10, 26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(17, 18);
  ctx.lineTo(30, 31);
  ctx.lineTo(10, 26);
  ctx.closePath();
  ctx.fill();

  if (player.invincible > 0) {
    ctx.globalAlpha = 0.35 + Math.sin(frame / 5) * 0.12;
    ctx.strokeStyle = "#ecfeff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 34 + Math.sin(frame / 7) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoss() {
  if (boss.defeated) return;
  const stage = currentStage.value;
  const palette = stage.palette;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(Math.sin(frame / 54) * 0.06);

  const phaseColor = phase.value === 3 ? palette.bulletAlt : phase.value === 2 ? palette.primary : palette.secondary;
  ctx.shadowBlur = phase.value === 3 ? 42 : 30;
  ctx.shadowColor = phaseColor;

  ctx.strokeStyle = phase.value === 3 ? "rgba(255, 92, 124, 0.42)" : "rgba(83, 243, 255, 0.32)";
  ctx.lineWidth = 2;
  for (let ring = 0; ring < 2; ring += 1) {
    ctx.save();
    ctx.rotate((frame / (70 + ring * 35)) * (ring ? -1 : 1));
    ctx.beginPath();
    ctx.arc(0, 0, boss.r + 14 + ring * 15, 0.14, Math.PI * 1.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, boss.r + 14 + ring * 15, Math.PI * 1.25, Math.PI * 1.86);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(8, 11, 31, 0.96)";
  ctx.beginPath();
  ctx.ellipse(-boss.r * 0.76, 6, boss.r * 0.46, boss.r * 0.28, -0.32, 0, Math.PI * 2);
  ctx.ellipse(boss.r * 0.76, 6, boss.r * 0.46, boss.r * 0.28, 0.32, 0, Math.PI * 2);
  ctx.fill();

  const armor = ctx.createRadialGradient(0, -boss.r * 0.25, boss.r * 0.12, 0, 0, boss.r * 1.2);
  armor.addColorStop(0, boss.flash > 0 ? "#fff1f2" : "#fdf4ff");
  armor.addColorStop(0.34, phase.value === 1 ? palette.primary : palette.bulletAlt);
  armor.addColorStop(1, palette.dark);
  ctx.fillStyle = armor;
  ctx.beginPath();
  for (let i = 0; i < stage.sides; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / stage.sides;
    const radius = i % 2 ? boss.r * 0.68 : boss.r;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(236, 254, 255, 0.58)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 18;
  ctx.shadowColor = "#020611";
  ctx.fillStyle = "#020611";
  ctx.beginPath();
  ctx.arc(0, 0, boss.r * 0.36, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(-4, -6, 0, 0, 0, boss.r * 0.36);
  core.addColorStop(0, "#ecfeff");
  core.addColorStop(0.42, palette.core);
  core.addColorStop(1, phaseColor);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, boss.r * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(frame / 34);
  ctx.strokeStyle = "rgba(236, 254, 255, 0.72)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(boss.r * 0.14, 0);
    ctx.lineTo(boss.r * 0.34, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  particles.forEach((particle) => {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 12;
    ctx.shadowColor = particle.color;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  floaters.forEach((floater) => {
    const alpha = Math.max(0, floater.life / floater.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = floater.color;
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(floater.text, floater.x, floater.y);
    ctx.restore();
  });
}

function drawHud() {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(2, 6, 17, 0.42)";
  ctx.fillRect(14, 14, 136, 32);
  ctx.fillRect(width - 148, 14, 134, 32);
  ctx.strokeStyle = "rgba(145, 235, 255, 0.24)";
  ctx.strokeRect(14, 14, 136, 32);
  ctx.strokeRect(width - 148, 14, 134, 32);
  ctx.fillStyle = "#ecfeff";
  ctx.font = "800 16px Inter, system-ui, sans-serif";
  ctx.fillText(`SHIELD ${playerLives.value}`, 26, 36);
  ctx.fillText(`STAGE ${currentStageIndex.value + 1}`, width - 128, 36);

  const barWidth = Math.min(width - 72, 420);
  const x = (width - barWidth) / 2;
  const y = 58;
  ctx.fillStyle = "rgba(2, 6, 17, 0.68)";
  ctx.fillRect(x, y, barWidth, 8);
  const fill = ctx.createLinearGradient(x, y, x + barWidth, y);
  fill.addColorStop(0, currentStage.value.palette.secondary);
  fill.addColorStop(0.58, currentStage.value.palette.primary);
  fill.addColorStop(1, currentStage.value.palette.bulletAlt);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, barWidth * (bossHp.value / 100), 8);
  ctx.strokeStyle = "rgba(236, 254, 255, 0.35)";
  ctx.strokeRect(x, y, barWidth, 8);
  ctx.restore();
}

function drawOverlay(title, detail) {
  ctx.save();
  ctx.fillStyle = "rgba(2, 6, 17, 0.58)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ecfeff";
  ctx.textAlign = "center";
  ctx.font = "900 32px Inter, system-ui, sans-serif";
  ctx.fillText(title, width / 2, height * 0.48);
  ctx.fillStyle = "#ffd166";
  ctx.font = "800 15px Inter, system-ui, sans-serif";
  ctx.fillText(detail, width / 2, height * 0.48 + 30);
  ctx.restore();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (shock > 0.2) {
    ctx.translate((Math.random() - 0.5) * shock, (Math.random() - 0.5) * shock);
  }
  drawBackground();
  drawProjectiles();
  drawBoss();
  drawPlayer();
  drawParticles();
  drawHud();
  ctx.restore();

  if (paused.value) drawOverlay("PAUSED", "TACTICAL HOLD");
  else if (finished && !runResult.value) drawOverlay(score.value > 0 ? "RUN SAVED" : "MISSION END", "MISSION LOGGED");
}

function loop() {
  update();
  draw();
  loopId = requestAnimationFrame(loop);
}

function resize() {
  if (!canvas.value) return;
  const parent = canvas.value.parentElement;
  const previousWidth = width;
  const previousHeight = height;
  width = Math.max(280, Math.floor(parent.clientWidth));
  height = Math.max(380, Math.floor(parent.clientHeight));
  canvas.value.width = width;
  canvas.value.height = height;
  canvas.value.style.width = "100%";
  canvas.value.style.height = "100%";

  if (!player) return;
  const xScale = width / previousWidth;
  const yScale = height / previousHeight;
  player.x *= xScale;
  player.y *= yScale;
  player.trail = player.trail.map((point) => ({ ...point, x: point.x * xScale, y: point.y * yScale }));
  clampPlayer();
  boss.x *= xScale;
  boss.y *= yScale;
  boss.r = bossRadius();
  bullets = bullets.map((bullet) => ({ ...bullet, x: bullet.x * xScale, y: bullet.y * yScale }));
  bossBullets = bossBullets.map((bullet) => ({ ...bullet, x: bullet.x * xScale, y: bullet.y * yScale }));
  particles = particles.map((particle) => ({ ...particle, x: particle.x * xScale, y: particle.y * yScale }));
  floaters = floaters.map((floater) => ({ ...floater, x: floater.x * xScale, y: floater.y * yScale }));
  draw();
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
    :moves="`S${stageDisplay} P${phase}`"
    :status="status"
    :paused="paused"
    :progress-version="progressVersion"
    :run-result="runResult"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
    @dismiss-result="runResult = null"
  >
    <section class="game-panel split-panel boss-rush-panel">
      <div class="board-shell boss-rush-board-shell">
        <canvas
          ref="canvas"
          class="canvas-board boss-rush-canvas"
          aria-label="Boss Rush 飞机大战画布"
          @click="finished && restart()"
          @mousemove="movePlayerTo($event.clientX, $event.clientY)"
          @touchmove.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
          @touchstart.prevent="movePlayerTo($event.touches[0].clientX, $event.touches[0].clientY)"
        ></canvas>
      </div>

      <aside class="control-panel boss-console">
        <div class="boss-core-card">
          <div class="boss-core-icon" aria-hidden="true">
            <RadioTower :size="22" />
          </div>
          <div>
            <span>{{ currentStage.code }}</span>
            <strong>{{ currentStage.name }}</strong>
          </div>
        </div>

        <div class="boss-meter-card">
          <div class="meter-head">
            <span>核心完整度</span>
            <strong>{{ bossHp }}%</strong>
          </div>
          <div class="boss-meter" aria-label="Boss 血量">
            <span :style="{ width: `${bossHp}%` }"></span>
          </div>
        </div>

        <div class="boss-readout-grid">
          <div>
            <RadioTower :size="16" />
            <span>关卡</span>
            <strong>{{ stageDisplay }}</strong>
          </div>
          <div>
            <Coins :size="16" />
            <span>金币</span>
            <strong>{{ coins }}</strong>
          </div>
          <div>
            <Shield :size="16" />
            <span>护盾</span>
            <strong>{{ playerLives }}</strong>
          </div>
          <div>
            <Crosshair :size="16" />
            <span>命中</span>
            <strong>{{ bossHits }}</strong>
          </div>
          <div>
            <HeartPulse :size="16" />
            <span>受击</span>
            <strong>{{ hitsTaken }}</strong>
          </div>
          <div>
            <Activity :size="16" />
            <span>耗时</span>
            <strong>{{ elapsedSeconds }}s</strong>
          </div>
        </div>

        <div class="shield-meter-card">
          <div class="meter-head">
            <span>护盾阵列</span>
            <strong>{{ shieldDisplay }}/{{ maxShield }}</strong>
          </div>
          <div class="shield-meter" aria-label="护盾">
            <span :style="{ width: `${shieldRatio}%` }"></span>
          </div>
        </div>

        <div class="stage-stack" aria-label="Boss 关卡">
          <div
            v-for="(stage, index) in bossStages"
            :key="stage.id"
            class="stage-node"
            :class="{ active: currentStageIndex === index, done: index < clearedStages }"
          >
            <span>{{ index + 1 }}</span>
            <strong>{{ stage.name }}</strong>
            <em>{{ stage.skill }}</em>
          </div>
        </div>

        <div class="phase-stack" aria-label="Boss 阶段">
          <div
            v-for="node in phaseNodes"
            :key="node.value"
            class="phase-node"
            :class="{ active: phase === node.value, done: phase > node.value }"
          >
            <Sparkles :size="15" />
            <span>{{ node.label }}</span>
            <strong>P{{ node.value }}</strong>
          </div>
        </div>

        <div class="upgrade-grid" aria-label="升级">
          <button
            v-for="upgrade in upgradeDefinitions"
            :key="upgrade.id"
            class="upgrade-button"
            type="button"
            :disabled="upgrade.maxed || !upgrade.affordable"
            :aria-label="`${upgrade.label} 等级 ${upgrade.level}，${upgrade.maxed ? '已满级' : `花费 ${upgrade.cost} 金币升级`}`"
            :title="upgrade.maxed ? `${upgrade.label} MAX` : `${upgrade.label} ${upgrade.cost}G`"
            @click="upgradeSkill(upgrade.id)"
          >
            <component :is="upgrade.icon" :size="15" />
            <span>{{ upgrade.label }}</span>
            <strong>Lv.{{ upgrade.level }}</strong>
            <em>{{ upgrade.maxed ? "MAX" : `${upgrade.cost}G` }}</em>
          </button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.boss-rush-panel {
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr) minmax(210px, 260px);
}

.boss-rush-board-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  background: #020611;
}

.boss-rush-canvas {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.boss-console {
  align-self: stretch;
  gap: 9px;
  overflow: auto;
  padding: 10px;
  border-color: rgba(255, 92, 124, 0.2);
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 79, 216, 0.13), transparent 38%),
    linear-gradient(180deg, rgba(12, 14, 32, 0.86), rgba(5, 10, 22, 0.72));
}

.boss-core-card,
.boss-meter-card,
.shield-meter-card,
.stage-stack,
.phase-stack,
.boss-readout-grid > div {
  border: 1px solid rgba(145, 235, 255, 0.16);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.52);
}

.boss-core-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px;
}

.boss-core-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid rgba(255, 92, 124, 0.32);
  border-radius: var(--radius);
  background: rgba(255, 79, 216, 0.1);
  color: #ff9bd7;
  box-shadow: inset 0 0 18px rgba(255, 79, 216, 0.12);
}

.boss-core-card span,
.meter-head span,
.boss-readout-grid span,
.stage-node em,
.phase-node span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
}

.boss-core-card strong {
  display: block;
  margin-top: 2px;
  overflow-wrap: anywhere;
  color: #ecfeff;
  font-size: 1.15rem;
  line-height: 1;
}

.boss-meter-card,
.shield-meter-card {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.meter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.meter-head strong {
  color: #ecfeff;
  font-size: 0.82rem;
}

.boss-meter,
.shield-meter {
  height: 14px;
  overflow: hidden;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: 999px;
  background: rgba(3, 8, 18, 0.82);
}

.boss-meter span,
.shield-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.16s ease;
}

.boss-meter span {
  background: linear-gradient(90deg, #53f3ff, #ff4fd8 58%, #ff5c7c);
  box-shadow: 0 0 18px rgba(255, 92, 124, 0.55);
}

.shield-meter span {
  background: linear-gradient(90deg, #2563eb, #53f3ff, #ecfeff);
  box-shadow: 0 0 16px rgba(83, 243, 255, 0.46);
}

.boss-readout-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.boss-readout-grid > div {
  display: grid;
  min-height: 68px;
  align-content: center;
  justify-items: start;
  gap: 4px;
  padding: 9px;
  color: #ecfeff;
}

.boss-readout-grid svg {
  color: #ffd166;
}

.boss-readout-grid strong {
  color: #ecfeff;
  font-size: 1.05rem;
  line-height: 1;
}

.phase-stack {
  display: grid;
  gap: 6px;
  padding: 8px;
}

.stage-stack {
  display: grid;
  gap: 6px;
  padding: 8px;
}

.stage-node {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 3px 7px;
  align-items: center;
  min-height: 34px;
  padding: 6px 7px;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: var(--radius);
  color: rgba(159, 183, 198, 0.74);
}

.stage-node span {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  grid-row: 1 / 3;
  border-radius: 50%;
  background: rgba(145, 235, 255, 0.08);
  color: #ecfeff;
  font-size: 0.72rem;
  font-weight: 900;
}

.stage-node strong {
  min-width: 0;
  overflow: hidden;
  color: #ecfeff;
  font-size: 0.76rem;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-node em {
  overflow: hidden;
  font-style: normal;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-node.done {
  border-color: rgba(125, 255, 111, 0.24);
  background: rgba(34, 197, 94, 0.08);
}

.stage-node.done span {
  background: rgba(34, 197, 94, 0.2);
  color: #7dff6f;
}

.stage-node.active {
  border-color: rgba(255, 209, 102, 0.42);
  background: rgba(255, 209, 102, 0.08);
}

.stage-node.active span {
  background: rgba(255, 209, 102, 0.18);
  color: #ffd166;
}

.phase-node {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  min-height: 31px;
  padding: 6px 7px;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: var(--radius);
  color: rgba(159, 183, 198, 0.72);
}

.phase-node strong {
  color: rgba(236, 254, 255, 0.76);
  font-size: 0.72rem;
}

.phase-node.done {
  border-color: rgba(83, 243, 255, 0.24);
  color: #53f3ff;
}

.phase-node.active {
  border-color: rgba(255, 209, 102, 0.42);
  background: rgba(255, 209, 102, 0.08);
  color: #ffd166;
}

.phase-node.active strong,
.phase-node.active span {
  color: #ffd166;
}

.upgrade-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.upgrade-button {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 6px;
  align-items: center;
  min-height: 56px;
  padding: 8px;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.56);
  color: #ecfeff;
  cursor: pointer;
}

.upgrade-button:hover:not(:disabled) {
  border-color: rgba(255, 209, 102, 0.46);
  background: rgba(255, 209, 102, 0.08);
}

.upgrade-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.upgrade-button svg {
  grid-row: 1 / 3;
  color: #ffd166;
}

.upgrade-button span,
.upgrade-button strong,
.upgrade-button em {
  min-width: 0;
  overflow: hidden;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upgrade-button span {
  font-size: 0.72rem;
  font-weight: 900;
}

.upgrade-button strong {
  color: var(--muted);
  font-size: 0.66rem;
}

.upgrade-button em {
  position: absolute;
  right: 5px;
  bottom: 4px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(255, 209, 102, 0.16);
  color: #ffd166;
  font-size: 0.58rem;
  font-style: normal;
  font-weight: 900;
}

@media (max-width: 860px) {
  .boss-rush-panel {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .boss-console {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-height: 260px;
    overflow: auto;
  }

  .stage-stack,
  .phase-stack {
    grid-column: 1 / -1;
  }

  .stage-stack {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .stage-node {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .stage-node span {
    grid-row: auto;
  }

  .stage-node em {
    display: none;
  }

  .phase-stack,
  .upgrade-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .boss-console {
    grid-template-columns: 1fr;
    max-height: 230px;
  }

  .boss-readout-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .boss-readout-grid > div {
    min-height: 54px;
    padding: 7px;
  }

  .boss-readout-grid span {
    display: none;
  }

  .upgrade-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
