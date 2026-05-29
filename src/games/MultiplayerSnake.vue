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

const CELL_SIZE = 30;
const DEFAULT_GRID_WIDTH = 36;
const DEFAULT_GRID_HEIGHT = 24;
const DEFAULT_VIEWPORT_COLS = 36;
const DEFAULT_VIEWPORT_ROWS = 24;
const CAMERA_SMOOTHING = 1;
const MINIMAP_WIDTH = 154;
const MINIMAP_HEIGHT = 104;
const MINIMAP_PADDING = 12;
const EDGE_HINT_PADDING = 34;
const EDGE_HINT_DISTANCE = 34;
const BOUNDARY_WARNING_CELLS = 7;
const SPATIAL_BUCKET_SIZE = 12;
const LONG_SNAKE_LENGTH = 720;
const LONG_SNAKE_EXACT_SEGMENTS = 260;
const LONG_SNAKE_TAIL_KEEP_SEGMENTS = 24;
const LONG_SNAKE_VISIBLE_BUDGET = 560;
const MINIMAP_DENSITY_CELL = 4;
const MINIMAP_DENSITY_SAMPLE_TARGET = 1100;
const TOUCH_DIRECTION_DEADZONE = 14;
const INPUT_SEND_INTERVAL = 50;
const dirs = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const KEY_DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};
const foodAssets = new Map(SNAKE_FOODS.map((food) => [food.id, food]));
const foodImages = new Map();

let ctx;
let socket;
let resizeObserver;
let lastDirection = null;
let lastInputAt = 0;
let camera = { x: 0, y: 0 };
let cameraReady = false;
let animationFrameId = 0;
let spatialCache = createSpatialCache();
let canvasSize = { width: DEFAULT_VIEWPORT_COLS * CELL_SIZE, height: DEFAULT_VIEWPORT_ROWS * CELL_SIZE };

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
      if (room.value?.phase !== message.state?.phase) {
        cameraReady = false;
        lastDirection = null;
      }
      room.value = message.state;
      nextTick(() => {
        resize();
        if (message.state?.phase === "playing") startRenderLoop();
        else stopRenderLoop();
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

function normalizeDirection(dir) {
  const value = typeof dir === "string" ? dirs[dir] : dir;
  const x = Number(value?.x);
  const y = Number(value?.y);
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 0) return null;
  return {
    x: x / length,
    y: y / length,
  };
}

function directionChanged(next, threshold = 0.018) {
  if (!lastDirection) return true;
  return Math.abs(next.x - lastDirection.x) > threshold || Math.abs(next.y - lastDirection.y) > threshold;
}

function sendDirection(dir, force = false) {
  const next = normalizeDirection(dir);
  if (!next) return;
  const now = performance.now();
  if (!force && now - lastInputAt < INPUT_SEND_INTERVAL) return;
  if (!force && !directionChanged(next)) return;
  lastDirection = next;
  lastInputAt = now;
  send({ type: "input", direction: next });
}

function setDirection(name) {
  if (!dirs[name]) return;
  sendDirection(dirs[name], true);
}

function setFreeDirectionFromPoint(clientX, clientY, force = false) {
  const target = canvas.value;
  if (!target || room.value?.phase !== "playing" || !ownPlayer.value?.alive) return;
  const rect = target.getBoundingClientRect();
  const head = ownSnake()?.body?.[0];
  const headScreen = head
    ? worldToScreen(head, camera, CELL_SIZE)
    : {
        x: rect.width / 2,
        y: rect.height / 2,
      };
  const dx = clientX - rect.left - headScreen.x;
  const dy = clientY - rect.top - headScreen.y;
  if (Math.hypot(dx, dy) < TOUCH_DIRECTION_DEADZONE) return;
  sendDirection({ x: dx, y: dy }, force);
}

function onTouchStart(event) {
  const touch = event.touches[0];
  if (!touch) return;
  setFreeDirectionFromPoint(touch.clientX, touch.clientY, true);
}

function onTouchMove(event) {
  const touch = event.touches[0];
  if (!touch) return;
  setFreeDirectionFromPoint(touch.clientX, touch.clientY);
}

function onTouchEnd(event) {
  const touch = event.changedTouches[0];
  if (!touch) return;
  setFreeDirectionFromPoint(touch.clientX, touch.clientY, true);
}

function onKey(event) {
  const direction = KEY_DIRECTIONS[event.key];
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

  const availableWidth = Math.max(260, parent.clientWidth - 12);
  const availableHeight = Math.max(220, parent.clientHeight - 12);
  target.style.width = "100%";
  target.style.height = "100%";
  canvasSize = {
    width: Math.floor(availableWidth),
    height: Math.floor(availableHeight),
  };
  syncCanvasSize();
  draw();
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
  return canvasSize;
}

function syncCanvasSize() {
  const size = boardSize();
  if (canvas.value && (canvas.value.width !== size.width || canvas.value.height !== size.height)) {
    canvas.value.width = size.width;
    canvas.value.height = size.height;
  }
  return size;
}

function ownSnake() {
  return room.value?.snakes?.[selfId.value] || null;
}

function targetCameraOffset(boardWidth, boardHeight, cell) {
  const snake = ownSnake();
  const grid = gridSize();
  const worldWidth = grid.width * cell;
  const worldHeight = grid.height * cell;
  const fallback = {
    x: Math.max(0, (worldWidth - boardWidth) / 2),
    y: Math.max(0, (worldHeight - boardHeight) / 2),
  };
  const head = snake?.body?.[0];
  const target = head
    ? {
        x: head.x * cell + cell / 2 - boardWidth / 2,
        y: head.y * cell + cell / 2 - boardHeight / 2,
      }
    : fallback;

  return {
    x: clamp(target.x, 0, Math.max(0, worldWidth - boardWidth)),
    y: clamp(target.y, 0, Math.max(0, worldHeight - boardHeight)),
  };
}

function cameraOffset(boardWidth, boardHeight, cell) {
  const target = targetCameraOffset(boardWidth, boardHeight, cell);
  if (!cameraReady) {
    camera = target;
    cameraReady = true;
    return camera;
  }

  camera = {
    x: camera.x + (target.x - camera.x) * CAMERA_SMOOTHING,
    y: camera.y + (target.y - camera.y) * CAMERA_SMOOTHING,
  };
  return camera;
}

function isPointVisible(point, camera, boardWidth, boardHeight, cell, padding = 2) {
  const x = point.x * cell;
  const y = point.y * cell;
  return (
    x >= camera.x - padding * cell &&
    y >= camera.y - padding * cell &&
    x <= camera.x + boardWidth + padding * cell &&
    y <= camera.y + boardHeight + padding * cell
  );
}

function visibleWorldBounds(camera, boardWidth, boardHeight, cell, padding = 2) {
  return {
    left: camera.x - padding * cell,
    top: camera.y - padding * cell,
    right: camera.x + boardWidth + padding * cell,
    bottom: camera.y + boardHeight + padding * cell,
  };
}

function bucketKey(x, y) {
  return `${Math.floor(x / SPATIAL_BUCKET_SIZE)}:${Math.floor(y / SPATIAL_BUCKET_SIZE)}`;
}

function createSpatialCache(tick = null, roomRef = null) {
  return {
    tick,
    roomRef,
    foods: null,
    snakes: new Map(),
    minimapDensities: new Map(),
  };
}

function ensureSpatialCache() {
  const tick = room.value?.tick ?? -1;
  if (spatialCache.tick !== tick || spatialCache.roomRef !== room.value) {
    spatialCache = createSpatialCache(tick, room.value);
  }
}

function buildPointBuckets(points) {
  const buckets = new Map();
  points.forEach((point) => {
    const key = bucketKey(point.x, point.y);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(point);
  });
  return buckets;
}

function cachedFoodBuckets() {
  ensureSpatialCache();
  if (!spatialCache.foods) spatialCache.foods = buildPointBuckets(room.value?.foods || []);
  return spatialCache.foods;
}

function snakeBodyLength(snake) {
  return snake.bodyLength || snake.body?.length || 0;
}

function normalizePublicBodyPart(part, fallbackIndex, sampled = false) {
  return {
    ...part,
    index: Number.isFinite(part.index) ? part.index : fallbackIndex,
    tailSampled: sampled || Boolean(part.tailSampled),
    sampleWeight: part.sampleWeight || 1,
  };
}

function snakeRenderParts(snake) {
  const body = snake.body || [];
  const bodyLength = snakeBodyLength(snake);
  if (bodyLength > body.length) {
    return body.map((part, index) => normalizePublicBodyPart(part, index, Boolean(part.tailSampled)));
  }

  return body.map((part, index) => normalizePublicBodyPart(part, index, false));
}

function cachedSnakeBuckets(snake) {
  ensureSpatialCache();
  const cacheKey = snake.playerId;
  if (!spatialCache.snakes.has(cacheKey)) {
    spatialCache.snakes.set(cacheKey, buildPointBuckets(snakeRenderParts(snake)));
  }
  return spatialCache.snakes.get(cacheKey);
}

function queryBuckets(buckets, camera, boardWidth, boardHeight, cell, padding = 2) {
  const left = Math.floor((camera.x / cell - padding) / SPATIAL_BUCKET_SIZE);
  const right = Math.floor(((camera.x + boardWidth) / cell + padding) / SPATIAL_BUCKET_SIZE);
  const top = Math.floor((camera.y / cell - padding) / SPATIAL_BUCKET_SIZE);
  const bottom = Math.floor(((camera.y + boardHeight) / cell + padding) / SPATIAL_BUCKET_SIZE);
  const items = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const bucket = buckets.get(`${x}:${y}`);
      if (bucket) items.push(...bucket);
    }
  }
  return items;
}

function worldToScreen(point, camera, cell) {
  return {
    x: point.x * cell + cell / 2 - camera.x,
    y: point.y * cell + cell / 2 - camera.y,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return { r: 83, g: 243, b: 255 };
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function colorWithAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function cachedMinimapDensity(snake, grid, width, height) {
  ensureSpatialCache();
  const cacheKey = `${snake.playerId}:${Math.round(width)}:${Math.round(height)}`;
  if (spatialCache.minimapDensities.has(cacheKey)) return spatialCache.minimapDensities.get(cacheKey);

  const body = snake.body || [];
  const bodyLength = snakeBodyLength(snake);
  const cols = Math.max(1, Math.ceil(width / MINIMAP_DENSITY_CELL));
  const rows = Math.max(1, Math.ceil(height / MINIMAP_DENSITY_CELL));
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const bins = new Map();
  const addPart = (part, weight = 1) => {
    const binX = clamp(Math.floor((part.x / grid.width) * cols), 0, cols - 1);
    const binY = clamp(Math.floor((part.y / grid.height) * rows), 0, rows - 1);
    const key = `${binX}:${binY}`;
    bins.set(key, (bins.get(key) || 0) + weight);
  };

  if (bodyLength > body.length || body.some((part) => part.sampleWeight > 1)) {
    body.forEach((part) => addPart(part, part.sampleWeight || 1));
  } else {
    const stride = Math.max(1, Math.ceil(body.length / MINIMAP_DENSITY_SAMPLE_TARGET));
    for (let index = 0; index < body.length; index += stride) {
      addPart(body[index], Math.min(stride, body.length - index));
    }
  }

  let maxCount = 1;
  const cells = [...bins.entries()].map(([key, count]) => {
    const [binX, binY] = key.split(":").map(Number);
    maxCount = Math.max(maxCount, count);
    return { binX, binY, count };
  });
  const density = { cells, maxCount, cellWidth, cellHeight };
  spatialCache.minimapDensities.set(cacheKey, density);
  return density;
}

function drawMinimapSnakeDensity(snake, skin, grid, x, y, width, height) {
  if (snake.playerId === selfId.value) return;
  const density = cachedMinimapDensity(snake, grid, width, height);
  if (!density.cells.length) return;

  ctx.save();
  density.cells.forEach((cell) => {
    const strength = Math.min(1, cell.count / density.maxCount);
    ctx.fillStyle = colorWithAlpha(skin.body, 0.12 + strength * 0.34);
    ctx.fillRect(
      x + cell.binX * density.cellWidth,
      y + cell.binY * density.cellHeight,
      Math.max(1.4, density.cellWidth + 0.5),
      Math.max(1.4, density.cellHeight + 0.5),
    );
  });
  ctx.restore();
}

function drawMinimap(grid, camera, boardWidth, boardHeight) {
  const width = Math.min(MINIMAP_WIDTH, boardWidth * 0.32);
  const height = Math.min(MINIMAP_HEIGHT, boardHeight * 0.28);
  const x = boardWidth - width - MINIMAP_PADDING;
  const y = MINIMAP_PADDING;
  const scaleX = width / grid.width;
  const scaleY = height / grid.height;
  const viewLeft = clamp(camera.x / CELL_SIZE, 0, grid.width);
  const viewTop = clamp(camera.y / CELL_SIZE, 0, grid.height);
  const viewRight = clamp((camera.x + boardWidth) / CELL_SIZE, viewLeft, grid.width);
  const viewBottom = clamp((camera.y + boardHeight) / CELL_SIZE, viewTop, grid.height);
  const viewX = x + viewLeft * scaleX;
  const viewY = y + viewTop * scaleY;
  const viewWidth = (viewRight - viewLeft) * scaleX;
  const viewHeight = (viewBottom - viewTop) * scaleY;

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(83, 243, 255, 0.22)";
  ctx.fillStyle = "rgba(3, 8, 18, 0.76)";
  roundedRect(x, y, width, height, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(145, 235, 255, 0.3)";
  ctx.stroke();

  ctx.save();
  roundedRect(x, y, width, height, 8);
  ctx.clip();

  Object.values(room.value?.snakes || {}).forEach((snake) => {
    const player = players.value.find((item) => item.id === snake.playerId);
    const skin = getSnakeSkinById(player?.skinId || "cyber");
    drawMinimapSnakeDensity(snake, skin, grid, x, y, width, height);
  });

  (room.value?.foods || []).forEach((food) => {
    ctx.fillStyle = food.value > 10 ? "#facc15" : "#ffd166";
    ctx.fillRect(x + food.x * scaleX - 1, y + food.y * scaleY - 1, 2, 2);
  });

  Object.values(room.value?.snakes || {}).forEach((snake) => {
    const head = snake.body?.[0];
    if (!head) return;
    const player = players.value.find((item) => item.id === snake.playerId);
    const skin = getSnakeSkinById(player?.skinId || "cyber");
    ctx.fillStyle = snake.playerId === selfId.value ? "#ffffff" : skin.head;
    ctx.beginPath();
    ctx.arc(x + head.x * scaleX, y + head.y * scaleY, snake.playerId === selfId.value ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  ctx.strokeStyle = "rgba(83, 243, 255, 0.56)";
  ctx.lineWidth = 1;
  ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);

  ctx.restore();
}

function drawEdgeHint(point, camera, boardWidth, boardHeight, cell, color, radius = 7) {
  const screen = worldToScreen(point, camera, cell);
  if (
    screen.x >= EDGE_HINT_PADDING &&
    screen.y >= EDGE_HINT_PADDING &&
    screen.x <= boardWidth - EDGE_HINT_PADDING &&
    screen.y <= boardHeight - EDGE_HINT_PADDING
  ) {
    return;
  }

  const center = { x: boardWidth / 2, y: boardHeight / 2 };
  const angle = Math.atan2(screen.y - center.y, screen.x - center.x);
  const x = clamp(center.x + Math.cos(angle) * (boardWidth / 2 - EDGE_HINT_DISTANCE), EDGE_HINT_PADDING, boardWidth - EDGE_HINT_PADDING);
  const y = clamp(center.y + Math.sin(angle) * (boardHeight / 2 - EDGE_HINT_DISTANCE), EDGE_HINT_PADDING, boardHeight - EDGE_HINT_PADDING);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(radius + 6, 0);
  ctx.lineTo(-radius, -radius);
  ctx.lineTo(-radius, radius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function edgeHintFoods(limit = 8) {
  const bestFoods = [];
  for (const food of room.value?.foods || []) {
    const insertAt = bestFoods.findIndex((item) => food.value > item.value);
    if (insertAt >= 0) {
      bestFoods.splice(insertAt, 0, food);
    } else if (bestFoods.length < limit) {
      bestFoods.push(food);
    }
    if (bestFoods.length > limit) bestFoods.length = limit;
  }
  return bestFoods;
}

function drawEdgeHints(camera, boardWidth, boardHeight, cell) {
  edgeHintFoods().forEach((food) => drawEdgeHint(food, camera, boardWidth, boardHeight, cell, food.value > 10 ? "#facc15" : "#ffd166", 5));

  Object.values(room.value?.snakes || {}).forEach((snake) => {
    if (snake.playerId === selfId.value) return;
    const head = snake.body?.[0];
    if (!head) return;
    const player = players.value.find((item) => item.id === snake.playerId);
    const skin = getSnakeSkinById(player?.skinId || "cyber");
    drawEdgeHint(head, camera, boardWidth, boardHeight, cell, skin.head, 7);
  });
}

function drawBoundaryWarning(grid, camera, boardWidth, boardHeight, cell) {
  const head = ownSnake()?.body?.[0];
  if (!head) return;
  const distance = Math.min(head.x, head.y, grid.width - 1 - head.x, grid.height - 1 - head.y);
  if (distance > BOUNDARY_WARNING_CELLS) return;
  const alpha = 1 - distance / BOUNDARY_WARNING_CELLS;

  ctx.save();
  ctx.globalAlpha = 0.18 + alpha * 0.34;
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, boardWidth - 8, boardHeight - 8);
  ctx.restore();
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

function drawSnakePart(part, index, cell, skin, dir, faded, sampled = false) {
  const gap = Math.max(0.5, cell * 0.025);
  const isHead = index === 0;
  const isTailSample = sampled && !isHead;
  const sampleInset = isTailSample ? cell * 0.18 : 0;
  const x = part.x * cell + gap + sampleInset;
  const y = part.y * cell + gap + sampleInset;
  const partSize = cell - gap * 2 - sampleInset * 2;
  const center = { x: x + partSize / 2, y: y + partSize / 2 };

  ctx.save();
  ctx.globalAlpha = faded ? (isTailSample ? 0.28 : 0.42) : isTailSample ? 0.62 : 1;
  ctx.shadowBlur = isHead ? 18 : isTailSample ? 5 : 10;
  ctx.shadowColor = isHead ? skin.head : skin.glow;
  const fill = ctx.createLinearGradient(x, y, x + partSize, y + partSize);
  fill.addColorStop(0, isHead ? skin.head : skin.body);
  fill.addColorStop(1, skin.bodyAlt);
  ctx.fillStyle = fill;
  roundedRect(x, y, partSize, partSize, isHead ? partSize * 0.42 : isTailSample ? partSize * 0.5 : partSize * 0.32);
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

function clipVisibleSnakeParts(parts, bodyLength) {
  if (!parts.some((part) => part.tailSampled) || bodyLength <= LONG_SNAKE_LENGTH || parts.length <= LONG_SNAKE_VISIBLE_BUDGET) return parts;

  const tailKeepStart = Math.max(LONG_SNAKE_EXACT_SEGMENTS, bodyLength - LONG_SNAKE_TAIL_KEEP_SEGMENTS);
  const exact = [];
  const tail = [];
  const middle = [];
  parts.forEach((part) => {
    if (part.index < LONG_SNAKE_EXACT_SEGMENTS) exact.push(part);
    else if (part.index >= tailKeepStart) tail.push(part);
    else middle.push(part);
  });

  const middleBudget = Math.max(0, LONG_SNAKE_VISIBLE_BUDGET - exact.length - tail.length);
  if (middle.length <= middleBudget) return parts;

  const stride = Math.max(1, Math.ceil(middle.length / Math.max(1, middleBudget)));
  return [...exact, ...middle.filter((_, index) => index % stride === 0), ...tail].sort((a, b) => b.index - a.index);
}

function drawSnake(snake, camera, boardWidth, boardHeight) {
  const player = players.value.find((item) => item.id === snake.playerId);
  const skin = getSnakeSkinById(player?.skinId || "cyber");
  const cell = CELL_SIZE;
  const dir = normalizeDirection(snake.dir) || dirs.right;
  const buckets = cachedSnakeBuckets(snake);
  const parts = queryBuckets(buckets, camera, boardWidth, boardHeight, cell)
    .filter((part) => isPointVisible(part, camera, boardWidth, boardHeight, cell))
    .sort((a, b) => b.index - a.index);
  clipVisibleSnakeParts(parts, snakeBodyLength(snake)).forEach((part) => {
    drawSnakePart(part, part.index, cell, skin, dir, !player?.connected, part.tailSampled);
  });
}

function visibleFoods(camera, boardWidth, boardHeight, cell) {
  const buckets = cachedFoodBuckets();
  return queryBuckets(buckets, camera, boardWidth, boardHeight, cell).filter((food) =>
    isPointVisible(food, camera, boardWidth, boardHeight, cell),
  );
}

function drawVisibleSnakes(camera, boardWidth, boardHeight) {
  Object.values(room.value?.snakes || {}).forEach((snake) => {
    drawSnake(snake, camera, boardWidth, boardHeight);
  });
}

function draw() {
  if (!ctx) return;
  const grid = gridSize();
  const { width: boardWidth, height: boardHeight } = syncCanvasSize();
  const cell = CELL_SIZE;
  const camera = cameraOffset(boardWidth, boardHeight, cell);
  ctx.clearRect(0, 0, boardWidth, boardHeight);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  const worldWidth = grid.width * cell;
  const worldHeight = grid.height * cell;
  const visibleBounds = visibleWorldBounds(camera, boardWidth, boardHeight, cell);
  ctx.strokeStyle = "rgba(83, 243, 255, 0.06)";
  ctx.lineWidth = 1;
  const startCol = Math.max(0, Math.floor(camera.x / cell) - 1);
  const endCol = Math.min(grid.width, Math.ceil((camera.x + boardWidth) / cell) + 1);
  const startRow = Math.max(0, Math.floor(camera.y / cell) - 1);
  const endRow = Math.min(grid.height, Math.ceil((camera.y + boardHeight) / cell) + 1);
  for (let i = startCol; i <= endCol; i += 1) {
    const x = i * cell;
    ctx.beginPath();
    ctx.moveTo(x, Math.max(0, visibleBounds.top));
    ctx.lineTo(x, Math.min(worldHeight, visibleBounds.bottom));
    ctx.stroke();
  }
  for (let i = startRow; i <= endRow; i += 1) {
    const y = i * cell;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, visibleBounds.left), y);
    ctx.lineTo(Math.min(worldWidth, visibleBounds.right), y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 209, 102, 0.28)";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, worldWidth, worldHeight);

  visibleFoods(camera, boardWidth, boardHeight, cell).forEach((food) => drawFood(food, cell));
  drawVisibleSnakes(camera, boardWidth, boardHeight);
  ctx.restore();
  drawBoundaryWarning(grid, camera, boardWidth, boardHeight, cell);
  drawEdgeHints(camera, boardWidth, boardHeight, cell);
  drawMinimap(grid, camera, boardWidth, boardHeight);
  ctx.shadowBlur = 0;
}

function renderLoop() {
  draw();
  if (room.value?.phase === "playing") {
    animationFrameId = window.requestAnimationFrame(renderLoop);
  } else {
    animationFrameId = 0;
  }
}

function startRenderLoop() {
  if (animationFrameId) return;
  animationFrameId = window.requestAnimationFrame(renderLoop);
}

function stopRenderLoop() {
  if (!animationFrameId) return;
  window.cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
}

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
  stopRenderLoop();
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
            @touchstart.prevent="onTouchStart"
            @touchend.prevent="onTouchEnd"
            @touchmove.prevent="onTouchMove"
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
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: none;
  min-height: 0;
}

.is-fullscreen .multiplayer-board-shell {
  border-radius: 0;
}

.is-fullscreen .multiplayer-canvas {
  box-shadow: none;
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
