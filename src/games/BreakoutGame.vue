<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";
import { getDailyVariantForGame, recordGameResult } from "../utils/progress";

const canvas = ref(null);
const score = ref(0);
const best = ref(getBestScore("breakout"));
const status = ref("击碎所有能量砖");
const paused = ref(false);
const progressVersion = ref(0);
const wideCharges = ref(1);
const slowCharges = ref(1);
const blastCharges = ref(1);
const runResult = ref(null);
const dailyVariant = getDailyVariantForGame("breakout");
const variantEffect = dailyVariant?.effect || "";

let ctx;
let width = 720;
let height = 480;
let paddle;
let ball;
let bricks;
let keys = {};
let loopId = 0;
let lives = 3;
let finished = false;
let bricksBroken = 0;
let runNewGoalIds = new Set();

function makeBricks() {
  const rows = 5;
  const cols = 9;
  const gap = 8;
  const brickWidth = (width - 72 - gap * (cols - 1)) / cols;
  return Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      x: 36 + col * (brickWidth + gap),
      y: 44 + row * 28,
      w: brickWidth,
      h: 18,
      hp: variantEffect === "reinforced-bricks" && row < 2 ? 2 : 1,
      alive: true,
      color: row % 2 ? "#ff4fd8" : "#53f3ff",
    };
  });
}

function syncProgress(extra = {}) {
  const result = recordGameResult("breakout", {
    score: score.value,
    bricksBroken,
    cleared: false,
    livesLeft: lives,
    dailyVariantId: dailyVariant?.id,
    ...extra,
  });
  result.newlyUnlocked.forEach((id) => runNewGoalIds.add(id));
  progressVersion.value += 1;
  return result;
}

function showRunResult(title, detail, extra = {}) {
  const result = syncProgress(extra);
  runResult.value = {
    title,
    detail,
    stats: [
      { label: "分数", value: extra.score ?? score.value },
      { label: "击碎砖块", value: bricksBroken },
      { label: "剩余生命", value: extra.livesLeft ?? lives },
    ],
    stars: result.stars,
    total: result.total,
    variantCompleted: result.variantCompleted,
    newGoals: result.goals.filter((goal) => runNewGoalIds.has(goal.id)),
    goals: result.goals,
  };
}

function finishClear() {
  finished = true;
  const finalScore = score.value + lives * 25 + (variantEffect === "one-life" ? 150 : 0);
  score.value = finalScore;
  status.value = "清场完成";
  best.value = setBestScore("breakout", finalScore);
  showRunResult("清场完成", "所有能量砖已击碎，生命奖励已经计入分数。", { score: finalScore, cleared: true, livesLeft: lives });
}

function restart() {
  const paddleWidth = variantEffect === "wide-paddle" ? 154 : 116;
  paddle = { x: width / 2 - paddleWidth / 2, y: height - 44, w: paddleWidth, h: 12, speed: 8 };
  ball = { x: width / 2, y: height - 72, vx: variantEffect === "wide-paddle" ? 4.6 : 4, vy: -5, r: 8 };
  bricks = makeBricks();
  score.value = 0;
  lives = variantEffect === "one-life" ? 1 : 3;
  bricksBroken = 0;
  wideCharges.value = 1;
  slowCharges.value = 1;
  blastCharges.value = 1;
  runResult.value = null;
  runNewGoalIds = new Set();
  finished = false;
  paused.value = false;
  status.value =
    variantEffect === "one-life"
      ? "一命清场：清场奖励更高"
      : variantEffect === "reinforced-bricks"
        ? "前排砖块已加固"
        : "击碎所有能量砖";
  draw();
}

function movePaddleTo(clientX) {
  const rect = canvas.value.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * width;
  paddle.x = Math.max(0, Math.min(width - paddle.w, x - paddle.w / 2));
}

function update() {
  if (paused.value || finished) return;
  if (keys.ArrowLeft || keys.a) paddle.x -= paddle.speed;
  if (keys.ArrowRight || keys.d) paddle.x += paddle.speed;
  paddle.x = Math.max(0, Math.min(width - paddle.w, paddle.x));

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ball.r || ball.x > width - ball.r) ball.vx *= -1;
  if (ball.y < ball.r) ball.vy *= -1;

  const hitPaddle =
    ball.y + ball.r >= paddle.y &&
    ball.y - ball.r <= paddle.y + paddle.h &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.w &&
    ball.vy > 0;
  if (hitPaddle) {
    const offset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    ball.vx = offset * 6;
    ball.vy = -Math.abs(ball.vy) - 0.05;
  }

  bricks.forEach((brick) => {
    if (!brick.alive) return;
    const hit =
      ball.x + ball.r > brick.x &&
      ball.x - ball.r < brick.x + brick.w &&
      ball.y + ball.r > brick.y &&
      ball.y - ball.r < brick.y + brick.h;
    if (!hit) return;
    brick.hp -= 1;
    ball.vy *= -1;
    if (brick.hp <= 0) {
      brick.alive = false;
      bricksBroken += 1;
      score.value += variantEffect === "one-life" ? 15 : 10;
      best.value = setBestScore("breakout", score.value);
      syncProgress();
    }
  });

  if (bricks.every((brick) => !brick.alive)) {
    finishClear();
  }

  if (ball.y > height + 20) {
    lives -= 1;
    if (lives <= 0) {
      finished = true;
      status.value = "生命耗尽";
      best.value = setBestScore("breakout", score.value);
      showRunResult("生命耗尽", "球已经离场，保留本局击碎砖块和星级进度。", { livesLeft: 0 });
    } else {
      status.value = `剩余生命 ${lives}`;
      ball = { x: width / 2, y: height - 72, vx: 4, vy: -5, r: 8 };
      paddle.x = width / 2 - paddle.w / 2;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(83, 243, 255, 0.08)";
  for (let x = 0; x < width; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  bricks.forEach((brick) => {
    if (!brick.alive) return;
    ctx.shadowBlur = 14;
    const color = brick.hp > 1 ? "#ffd166" : brick.color;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  });

  ctx.shadowColor = "#53f3ff";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#53f3ff";
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

  ctx.shadowColor = "#ffd166";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd166";
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ecfeff";
  ctx.font = "18px sans-serif";
  ctx.fillText(`LIFE ${lives}`, 24, height - 18);
}

function useWidePaddle() {
  if (finished || wideCharges.value <= 0) return;
  wideCharges.value -= 1;
  const center = paddle.x + paddle.w / 2;
  paddle.w = Math.min(190, paddle.w + 44);
  paddle.x = Math.max(0, Math.min(width - paddle.w, center - paddle.w / 2));
  status.value = "挡板扩展";
}

function useSlowBall() {
  if (finished || slowCharges.value <= 0) return;
  slowCharges.value -= 1;
  ball.vx *= 0.72;
  ball.vy *= 0.72;
  status.value = "球速降低";
}

function useBlastRow() {
  if (finished || blastCharges.value <= 0) return;
  const targets = bricks
    .filter((brick) => brick.alive)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 5);
  if (!targets.length) return;
  blastCharges.value -= 1;
  targets.forEach((brick) => {
    brick.alive = false;
    brick.hp = 0;
  });
  bricksBroken += targets.length;
  score.value += targets.length * 10;
  best.value = setBestScore("breakout", score.value);
  status.value = "爆破清除";
  if (bricks.every((brick) => !brick.alive)) finishClear();
  else syncProgress();
}

function loop() {
  update();
  draw();
  loopId = requestAnimationFrame(loop);
}

function resize() {
  const max = canvas.value.parentElement.clientWidth - 24;
  const displayWidth = Math.min(max, 720);
  canvas.value.style.width = `${displayWidth}px`;
  canvas.value.style.height = `${displayWidth * (height / width)}px`;
}

function togglePause() {
  if (finished) return;
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续反弹";
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
    game-id="breakout"
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
          aria-label="打砖块游戏画布"
          @mousemove="movePaddleTo($event.clientX)"
          @touchmove.prevent="movePaddleTo($event.touches[0].clientX)"
        ></canvas>
      </div>
      <aside class="control-panel">
        <h2>操作</h2>
        <p>方向键、A/D 或鼠标移动挡板。移动端拖动画布即可控制挡板。</p>
        <h3>技能</h3>
        <div class="segmented">
          <button type="button" :disabled="wideCharges <= 0" @click="useWidePaddle">扩板 {{ wideCharges }}</button>
          <button type="button" :disabled="slowCharges <= 0" @click="useSlowBall">慢球 {{ slowCharges }}</button>
          <button type="button" :disabled="blastCharges <= 0" @click="useBlastRow">爆破 {{ blastCharges }}</button>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>
