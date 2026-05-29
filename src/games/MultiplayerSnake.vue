<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Copy,
  Crown,
  Maximize,
  Minimize,
  Play,
  Radio,
  RotateCcw,
  UsersRound,
  WifiOff,
} from "lucide-vue-next";
import snakeArenaIcon from "../assets/icons/snake-arena.svg";
import { SNAKE_FOODS } from "../data/snakeFoods";
import { getSnakeSkinById } from "../data/snakeSkins";
import { getSavedValue } from "../utils/storage";
import { createSwipeHandlers } from "../utils/touch";

const props = defineProps({
  roomCode: {
    type: String,
    required: true,
  },
});

const router = useRouter();
const canvas = ref(null);
const gameContainer = ref(null);
const room = ref(null);
const selfId = ref("");
const connection = ref("connecting");
const copied = ref(false);
const serverError = ref("");
const isFullscreen = ref(false);

const CELL_SIZE = 35;
const DEFAULT_GRID_WIDTH = 36;
const DEFAULT_GRID_HEIGHT = 24;
const dirs = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const foodAssets = new Map(SNAKE_FOODS.map((food) => [food.id, food]));
const foodImages = new Map();

let ctx;
let socket;
let resizeObserver;
let lastDirection = "";

const safeRoomCode = computed(() => props.roomCode.trim().toUpperCase());
const players = computed(() => room.value?.players || []);
const ownPlayer = computed(() => players.value.find((player) => player.id === selfId.value) || null);
const hostPlayer = computed(() => players.value.find((player) => player.host) || null);
const connectedCount = computed(() => players.value.filter((player) => player.connected).length);
const aliveCount = computed(() => players.value.filter((player) => player.alive).length);
const score = computed(() => ownPlayer.value?.score ?? 0);
const bestScore = computed(() => Math.max(...players.value.map((player) => player.score || 0), 0));
const canStart = computed(() => Boolean(ownPlayer.value?.host && ["lobby", "ended"].includes(room.value?.phase)));
const readyLabel = computed(() => (ownPlayer.value?.ready ? "取消准备" : "准备"));
const statusText = computed(() => {
  if (serverError.value) return serverError.value;
  if (connection.value === "connecting") return "连接房间中";
  if (connection.value === "closed") return "连接已断开";
  if (!room.value) return "等待房间状态";
  if (room.value.phase === "lobby") return "等待玩家准备";
  if (room.value.phase === "playing") return ownPlayer.value?.alive ? "正在争夺能量核心" : "观战中";
  if (room.value.winnerId) {
    const winner = players.value.find((player) => player.id === room.value.winnerId);
    return `${winner?.name || "玩家"} 获胜`;
  }
  return "本局结束";
});

function makeWsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    name: getSavedValue("online:player-name", "玩家"),
    skinId: getSavedValue("snake:skin", "cyber"),
  });
  return `${protocol}//${window.location.host}/api/rooms/${safeRoomCode.value}/ws?${params}`;
}

function connect() {
  connection.value = "connecting";
  serverError.value = "";
  socket?.close();
  socket = new WebSocket(makeWsUrl());
  socket.addEventListener("open", () => {
    connection.value = "open";
  });
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "hello") {
      selfId.value = message.playerId;
      return;
    }
    if (message.type === "room") {
      serverError.value = "";
      room.value = message.state;
      nextTick(() => {
        resize();
        draw();
      });
    }
    if (message.type === "error") {
      serverError.value = message.message || "房间操作失败";
      window.setTimeout(() => {
        serverError.value = "";
      }, 1800);
    }
  });
  socket.addEventListener("close", () => {
    connection.value = "closed";
  });
  socket.addEventListener("error", () => {
    connection.value = "closed";
  });
}

function send(payload) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function toggleReady() {
  send({ type: "ready", ready: !ownPlayer.value?.ready });
}

function startGame() {
  send({ type: "start" });
  // 游戏开始时自动进入全屏
  if (!isFullscreen.value) {
    setTimeout(() => enterFullscreen(), 100);
  }
}

function reconnect() {
  connect();
}

function setDirection(name) {
  if (!dirs[name] || lastDirection === name) return;
  lastDirection = name;
  send({ type: "input", direction: name });
}

function onKey(event) {
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
  };
  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  setDirection(direction);
}

function goBack() {
  router.push("/online");
}

async function copyRoomLink() {
  const link = `${window.location.origin}${window.location.pathname}#/online/snake/${safeRoomCode.value}`;
  await navigator.clipboard?.writeText(link);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1400);
}

function enterFullscreen() {
  if (!gameContainer.value) return;
  const elem = gameContainer.value;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => {});
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

function toggleFullscreen() {
  if (isFullscreen.value) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  setTimeout(() => resize(), 100);
}

function resize() {
  const target = canvas.value;
  if (!target) return;
  const parent = target.parentElement;
  if (!parent) return;

  const { width: boardWidth, height: boardHeight } = boardSize();
  const availableWidth = Math.max(260, parent.clientWidth - 12);
  const availableHeight = Math.max(220, parent.clientHeight - 12);
  const scale = Math.min(availableWidth / boardWidth, availableHeight / boardHeight);
  target.style.width = `${Math.floor(boardWidth * scale)}px`;
  target.style.height = `${Math.floor(boardHeight * scale)}px`;
}

function gridSize() {
  const state = room.value;
  if (!state) {
    return { width: DEFAULT_GRID_WIDTH, height: DEFAULT_GRID_HEIGHT };
  }
  const legacyGrid = state.grid || DEFAULT_GRID_HEIGHT;
  return {
    width: state.gridWidth || legacyGrid,
    height: state.gridHeight || legacyGrid,
  };
}

function boardSize() {
  const grid = gridSize();
  return {
    width: grid.width * CELL_SIZE,
    height: grid.height * CELL_SIZE,
  };
}

function syncCanvasSize() {
  const size = boardSize();
  if (canvas.value && (canvas.value.width !== size.width || canvas.value.height !== size.height)) {
    canvas.value.width = size.width;
    canvas.value.height = size.height;
  }
  return size;
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function getFoodImage(foodId) {
  const asset = foodAssets.get(foodId);
  if (!asset?.image || typeof Image === "undefined") return null;
  if (!foodImages.has(asset.image)) {
    const image = new Image();
    image.onload = () => draw();
    image.src = asset.image;
    foodImages.set(asset.image, image);
  }
  const image = foodImages.get(asset.image);
  return image.complete && image.naturalWidth ? image : null;
}

function drawFood(food, cell) {
  const image = getFoodImage(food.assetId);
  const centerX = food.x * cell + cell / 2;
  const centerY = food.y * cell + cell / 2;
  const imageSize = cell * 1.34;

  ctx.save();
  ctx.shadowBlur = 16;
  ctx.shadowColor = food.value > 10 ? "#facc15" : "#ffd166";
  if (image) {
    ctx.drawImage(image, centerX - imageSize / 2, centerY - imageSize / 2, imageSize, imageSize);
  } else {
    ctx.fillStyle = food.value > 10 ? "#facc15" : "#ffd166";
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSnakePart(part, index, cell, skin, dir, faded) {
  const gap = Math.max(0.5, cell * 0.025);
  const x = part.x * cell + gap;
  const y = part.y * cell + gap;
  const partSize = cell - gap * 2;
  const isHead = index === 0;
  const center = { x: x + partSize / 2, y: y + partSize / 2 };

  ctx.save();
  ctx.globalAlpha = faded ? 0.42 : 1;
  ctx.shadowBlur = isHead ? 18 : 10;
  ctx.shadowColor = isHead ? skin.head : skin.glow;
  const fill = ctx.createLinearGradient(x, y, x + partSize, y + partSize);
  fill.addColorStop(0, isHead ? skin.head : skin.body);
  fill.addColorStop(1, skin.bodyAlt);
  ctx.fillStyle = fill;
  roundedRect(x, y, partSize, partSize, isHead ? partSize * 0.42 : partSize * 0.32);
  ctx.fill();

  if (isHead) {
    const forward = dir || dirs.right;
    const side = { x: -forward.y, y: forward.x };
    const eyeForward = partSize * 0.2;
    const eyeSide = partSize * 0.18;
    const eyeRadius = Math.max(1.8, partSize * 0.09);
    ctx.shadowBlur = 0;
    ctx.fillStyle = skin.eye;
    [-1, 1].forEach((sign) => {
      ctx.beginPath();
      ctx.arc(
        center.x + forward.x * eyeForward + side.x * eyeSide * sign,
        center.y + forward.y * eyeForward + side.y * eyeSide * sign,
        eyeRadius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  }

  ctx.restore();
}

function drawSnake(snake) {
  const player = players.value.find((item) => item.id === snake.playerId);
  const skin = getSnakeSkinById(player?.skinId || "cyber");
  const cell = CELL_SIZE;
  const dir = dirs[snake.dir] || dirs.right;
  [...snake.body].reverse().forEach((part, reversedIndex) => {
    drawSnakePart(part, snake.body.length - 1 - reversedIndex, cell, skin, dir, !player?.connected);
  });
}

function draw() {
  if (!ctx) return;
  const grid = gridSize();
  const { width: boardWidth, height: boardHeight } = syncCanvasSize();
  const cell = CELL_SIZE;
  ctx.clearRect(0, 0, boardWidth, boardHeight);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, boardWidth, boardHeight);
  ctx.strokeStyle = "rgba(83, 243, 255, 0.06)";
  for (let i = 0; i <= grid.width; i += 1) {
    const x = i * cell;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, boardHeight);
    ctx.stroke();
  }
  for (let i = 0; i <= grid.height; i += 1) {
    const y = i * cell;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(boardWidth, y);
    ctx.stroke();
  }

  (room.value?.foods || []).forEach((food) => drawFood(food, cell));
  Object.values(room.value?.snakes || {}).forEach(drawSnake);
  ctx.shadowBlur = 0;
}

const swipe = createSwipeHandlers(setDirection);

onMounted(() => {
  ctx = canvas.value.getContext("2d");
  syncCanvasSize();
  connect();
  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.value.parentElement);
  window.addEventListener("keydown", onKey);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("mozfullscreenchange", onFullscreenChange);
  document.addEventListener("msfullscreenchange", onFullscreenChange);
  draw();
});

onUnmounted(() => {
  socket?.close();
  resizeObserver?.disconnect();
  window.removeEventListener("keydown", onKey);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  document.removeEventListener("mozfullscreenchange", onFullscreenChange);
  document.removeEventListener("msfullscreenchange", onFullscreenChange);
});

watch(room, () => draw(), { deep: true });
</script>

<template>
  <main class="game-shell multiplayer-shell">
    <div class="starfield" aria-hidden="true"></div>
    <section class="game-frame">
      <header class="game-topbar">
        <button class="icon-button" type="button" aria-label="返回联机大厅" @click="goBack">
          <ArrowLeft :size="20" />
        </button>
        <div class="game-title-wrap">
          <img class="game-mini-icon" :src="snakeArenaIcon" alt="" />
          <div>
            <p class="game-kicker">ROOM {{ safeRoomCode }}</p>
            <h1>多人贪吃蛇</h1>
          </div>
        </div>
        <div class="game-actions">
          <button class="icon-button" type="button" :aria-label="copied ? '已复制' : '复制房间链接'" @click="copyRoomLink">
            <CheckCircle2 v-if="copied" :size="20" />
            <Copy v-else :size="20" />
          </button>
          <button class="icon-button" type="button" aria-label="重新连接" @click="reconnect">
            <RotateCcw :size="20" />
          </button>
        </div>
      </header>

      <div class="game-hud-row">
        <div class="game-info-row">
          <div class="stat-chip">
            <span>房间</span>
            <strong>{{ safeRoomCode }}</strong>
          </div>
          <div class="stat-chip">
            <span>分数</span>
            <strong>{{ score }}</strong>
          </div>
          <div class="stat-chip">
            <span>最高</span>
            <strong>{{ bestScore }}</strong>
          </div>
          <div class="stat-chip">
            <span>在线</span>
            <strong>{{ connectedCount }}/{{ room?.maxPlayers || 6 }}</strong>
          </div>
          <div class="status-chip">{{ statusText }}</div>
        </div>
      </div>

      <div class="game-content">
        <section ref="gameContainer" class="game-panel split-panel multiplayer-panel" :class="{ 'is-fullscreen': isFullscreen }">
          <button
            class="fullscreen-toggle"
            type="button"
            :title="isFullscreen ? '退出全屏' : '进入全屏'"
            @click="toggleFullscreen"
          >
            <Minimize v-if="isFullscreen" :size="20" />
            <Maximize v-else :size="20" />
          </button>
          <div
            class="board-shell multiplayer-board-shell"
            @touchstart.passive="swipe.onTouchStart"
            @touchend.passive="swipe.onTouchEnd"
            @touchmove.prevent
          >
            <canvas ref="canvas" class="canvas-board multiplayer-canvas" aria-label="多人贪吃蛇游戏画布"></canvas>
            <div v-if="room?.phase !== 'playing'" class="room-overlay">
              <strong>{{ room?.phase === "ended" ? statusText : "等待开局" }}</strong>
              <span>房间 {{ safeRoomCode }}</span>
            </div>
          </div>

          <aside class="control-panel multiplayer-control">
            <section class="room-action-panel">
              <div class="panel-title">
                <Radio v-if="connection === 'open'" :size="18" />
                <WifiOff v-else :size="18" />
                <span>{{ connection === "open" ? "已连接" : "未连接" }}</span>
              </div>
              <div class="room-button-row">
                <button class="pill-button" type="button" @click="toggleReady">
                  {{ readyLabel }}
                </button>
                <button v-if="canStart" class="pill-button primary" type="button" @click="startGame">
                  <Play :size="16" />
                  {{ room?.phase === "ended" ? "再开一局" : "开始" }}
                </button>
              </div>
            </section>

            <section class="player-list-panel">
              <div class="panel-title">
                <UsersRound :size="18" />
                <span>玩家 {{ connectedCount }}</span>
              </div>
              <div class="room-player-list">
                <div
                  v-for="player in players"
                  :key="player.id"
                  class="room-player"
                  :class="{ self: player.id === selfId, offline: !player.connected }"
                  :style="{ '--skin': getSnakeSkinById(player.skinId).body }"
                >
                  <span class="player-swatch"></span>
                  <div>
                    <strong>
                      {{ player.name }}
                      <Crown v-if="player.host" :size="14" />
                    </strong>
                    <small>
                      {{
                        player.connected
                          ? room?.phase === "playing"
                            ? player.alive
                              ? "存活"
                              : "观战"
                            : player.ready
                              ? "已准备"
                              : "待准备"
                          : "离线"
                      }}
                    </small>
                  </div>
                  <em>{{ player.score }}</em>
                </div>
              </div>
            </section>

            <section class="room-dpad-panel">
              <div class="d-pad multiplayer-dpad" aria-label="移动方向">
                <button class="up" type="button" aria-label="向上" @click="setDirection('up')">
                  <ArrowUp :size="18" />
                </button>
                <button class="left" type="button" aria-label="向左" @click="setDirection('left')">
                  <ArrowLeft :size="18" />
                </button>
                <button class="center" type="button" aria-label="复制房间链接" @click="copyRoomLink">
                  <Copy :size="16" />
                </button>
                <button class="right" type="button" aria-label="向右" @click="setDirection('right')">
                  <ArrowRight :size="18" />
                </button>
                <button class="down" type="button" aria-label="向下" @click="setDirection('down')">
                  <ArrowDown :size="18" />
                </button>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(.multiplayer-shell .game-frame) {
  width: min(1740px, 100%);
}

.multiplayer-panel {
  position: relative;
  grid-template-columns: minmax(0, 1fr) minmax(230px, 300px);
}

.multiplayer-panel.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #020611;
  padding: 12px;
  margin: 0;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
  gap: 12px;
}

.fullscreen-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid rgba(145, 235, 255, 0.3);
  border-radius: 8px;
  background: rgba(7, 13, 27, 0.88);
  color: var(--cyan);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.fullscreen-toggle:hover {
  border-color: var(--cyan);
  box-shadow: 0 0 16px rgba(83, 243, 255, 0.3);
  transform: translateY(-1px);
}

.multiplayer-board-shell {
  position: relative;
}

.multiplayer-canvas {
  max-width: 100%;
  max-height: 100%;
}

.room-overlay {
  position: absolute;
  inset: auto 18px 18px;
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.72);
  backdrop-filter: blur(8px);
}

.room-overlay strong,
.room-overlay span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-overlay strong {
  color: var(--yellow);
}

.room-overlay span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 900;
}

.multiplayer-control {
  gap: 10px;
}

.room-action-panel,
.player-list-panel,
.room-dpad-panel {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(145, 235, 255, 0.14);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.44);
}

.room-button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.room-player-list {
  display: grid;
  gap: 7px;
}

.room-player {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 46px;
  padding: 8px;
  border: 1px solid rgba(145, 235, 255, 0.12);
  border-radius: var(--radius);
  background: rgba(6, 13, 28, 0.62);
}

.room-player.self {
  border-color: rgba(83, 243, 255, 0.44);
}

.room-player.offline {
  opacity: 0.52;
}

.player-swatch {
  width: 14px;
  height: 32px;
  border-radius: 999px;
  background: var(--skin);
  box-shadow: 0 0 12px color-mix(in srgb, var(--skin), transparent 30%);
}

.room-player strong {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  color: var(--text);
  font-size: 0.9rem;
}

.room-player strong svg {
  flex: 0 0 auto;
  color: var(--yellow);
}

.room-player small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.72rem;
}

.room-player em {
  color: var(--cyan);
  font-style: normal;
  font-weight: 900;
}

.multiplayer-dpad {
  margin: 0 auto;
}

.multiplayer-dpad button {
  display: grid;
  place-items: center;
}

@media (max-width: 860px) {
  .multiplayer-panel {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(156px, auto);
  }

  .multiplayer-panel.is-fullscreen {
    padding: 8px;
    grid-template-rows: minmax(0, 1fr) minmax(180px, auto);
  }

  .fullscreen-toggle {
    top: 8px;
    left: 8px;
    width: 38px;
    height: 38px;
  }

  .multiplayer-control {
    grid-template-columns: minmax(180px, 0.9fr) minmax(220px, 1fr) auto;
    max-height: min(30svh, 210px);
  }

  .room-dpad-panel {
    align-content: center;
  }
}

@media (max-width: 640px) {
  .multiplayer-control {
    grid-template-columns: 1fr;
    max-height: min(34svh, 240px);
  }

  .room-overlay {
    right: 10px;
    bottom: 10px;
    left: 10px;
  }
}
</style>
