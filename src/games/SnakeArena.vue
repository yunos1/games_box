<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ChevronDown, Settings, Maximize, Minimize } from "lucide-vue-next";
import GameLayout from "../components/GameLayout.vue";
import { SNAKE_FOODS } from "../data/snakeFoods";
import { SNAKE_SKINS, getSnakeSkinById } from "../data/snakeSkins";
import { getBestScore, getSavedValue, setBestScore, setSavedValue } from "../utils/storage";

const canvas = ref(null);
const gameContainer = ref(null);
const score = ref(0);
const best = ref(getBestScore("snake-arena"));
const status = ref("争夺能量核心");
const paused = ref(false);
const selectedSkinId = ref(getSavedValue("snake:skin", "cyber"));
const selectedSkin = computed(() => getSnakeSkinById(selectedSkinId.value));
const isFullscreen = ref(false);

const size = 840;
const VIEWPORT_GRID = 24;
const WORLD_SCALE = 10;
const grid = VIEWPORT_GRID * WORLD_SCALE;
const CELL_SIZE = 30;
const MAX_PIXEL_RATIO = 2;
const CAMERA_SMOOTHING = 0.26;
const FOOD_TARGET = 72;
const LOCAL_FOOD_RATIO = 0.62;
const CONTESTED_FOOD_RATIO = 0.18;
const FOOD_SPAWN_RADIUS = 22;
const EXPLORE_FOOD_RADIUS = 72;
const SPATIAL_BUCKET_SIZE = 12;
const SNAKE_RENDER_PADDING = 4;
const MINIMAP_SIZE = 132;
const MINIMAP_PADDING = 12;
const MINIMAP_DENSITY_CELL = 4;
const MINIMAP_DENSITY_SAMPLE_TARGET = 1100;
const EDGE_HINT_PADDING = 34;
const EDGE_HINT_DISTANCE = 34;
const BOUNDARY_WARNING_CELLS = 7;
const LONG_SNAKE_LENGTH = 720;
const LONG_SNAKE_EXACT_SEGMENTS = 260;
const LONG_SNAKE_TAIL_KEEP_SEGMENTS = 24;
const LONG_SNAKE_VISIBLE_BUDGET = 560;
const HIT_RADIUS = 0.72;
const FOOD_PICKUP_RADIUS = 0.86;
const TOUCH_DIRECTION_DEADZONE = 8;
const TOUCH_DIRECTION_SMOOTHING = 0.42;
const MAX_TURN_DEGREES = 150; // 单次转向最大角度，避免移动端瞬间 180° 反向
const MAX_TURN_RADIANS = (MAX_TURN_DEGREES * Math.PI) / 180;
const RESPAWN_DELAY = 3000; // 玩家死亡后随机复活的延迟（毫秒）
const FOOD_CHAIN_STRIDE = 3; // 食物链采样间隔：身体每隔几段掉落一个食物
const FOOD_CHAIN_MAX = 60; // 单次死亡掉落食物数量上限，避免食物无限堆积
const HIT_RADIUS_SQUARED = HIT_RADIUS * HIT_RADIUS;
const FOOD_PICKUP_RADIUS_SQUARED = FOOD_PICKUP_RADIUS * FOOD_PICKUP_RADIUS;
const dirs = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIR_ENTRIES = Object.entries(dirs);
const DIR_NAMES = Object.keys(dirs);
const KEY_ACTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  " ": "pause",
};

let ctx;
let player;
let aiSnakes;
let foods;
let direction;
let nextDirection;
let loopId = 0;
let lastTick = 0;
let renderAlpha = 1;
let camera = { x: 0, y: 0 };
let cameraReady = false;
let stateTick = 0;
let spatialCache = createSpatialCache();
let resizeObserver;
let canvasSize = { width: size, height: size };
let canvasPixelRatio = 1;
const foodImages = new Map();
let foodBag = [];
let lastFoodId = "";
let activePointerId = null;
let smoothedTouchDirection = null;
let touchAnchor = null; // 当前触摸的起始屏幕坐标（相对画布），用于判定滑动方向
let lastPlayerHead = null; // 玩家最近一次的头部世界坐标，死亡期间供相机定位
let frameNow = 0; // 最近一帧的时间戳（来自 requestAnimationFrame），用于复活计时

function selectSkin(id) {
  selectedSkinId.value = id;
  setSavedValue("snake:skin", id);
  draw();
}

function shuffleFoods() {
  const nextBag = [...SNAKE_FOODS];
  for (let i = nextBag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [nextBag[i], nextBag[j]] = [nextBag[j], nextBag[i]];
  }
  if (nextBag[0]?.id === lastFoodId && nextBag.length > 1) {
    [nextBag[0], nextBag[1]] = [nextBag[1], nextBag[0]];
  }
  foodBag = nextBag;
}

function nextFoodAsset() {
  if (!foodBag.length) shuffleFoods();
  const nextFood = foodBag.shift() || SNAKE_FOODS[0];
  lastFoodId = nextFood.id;
  return nextFood;
}

function same(a, b) {
  return distanceSquared(a, b) <= HIT_RADIUS_SQUARED;
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normalizeDirection(dir) {
  const length = Math.hypot(dir.x, dir.y);
  if (!length) return dirs.right;
  return {
    x: dir.x / length,
    y: dir.y / length,
  };
}

// 将目标方向相对当前方向的转角限制在 ±MAX_TURN_DEGREES 内，
// 这样单次转向最多 150°，无法一步反向（防止瞬间 180° 调头）。
function limitTurn(target, current) {
  const currentAngle = Math.atan2(current.y, current.x);
  const targetAngle = Math.atan2(target.y, target.x);
  let delta = targetAngle - currentAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const clamped = clamp(delta, -MAX_TURN_RADIANS, MAX_TURN_RADIANS);
  const angle = currentAngle + clamped;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function occupied(point) {
  return segmentHit(point);
}

function segmentHit(point) {
  for (let index = 0; index < (player?.body?.length || 0); index += 1) {
    if (same(player.body[index], point)) return true;
  }

  for (const snake of aiSnakes || []) {
    for (let index = 0; index < (snake.body?.length || 0); index += 1) {
      if (same(snake.body[index], point)) return true;
    }
  }
  return false;
}

function nearestFood(point) {
  let closest = null;
  let closestDistance = Infinity;
  for (const food of foods || []) {
    const nextDistance = Math.abs(food.x - point.x) + Math.abs(food.y - point.y);
    if (nextDistance < closestDistance) {
      closest = food;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function spawnFood() {
  let food;
  const anchors = [player.body[0], ...aiSnakes.map((snake) => snake.body[0])].filter(Boolean);
  const modeRoll = Math.random();
  const mode = modeRoll < LOCAL_FOOD_RATIO ? "local" : modeRoll < LOCAL_FOOD_RATIO + CONTESTED_FOOD_RATIO ? "contested" : "explore";
  do {
    const anchor = foodAnchor(anchors, mode);
    const radius = mode === "explore" ? EXPLORE_FOOD_RADIUS : FOOD_SPAWN_RADIUS;
    const isBonus = mode === "contested" || Math.random() < 0.16;
    food = {
      x: anchor
        ? clamp(anchor.x + Math.floor(Math.random() * (radius * 2 + 1)) - radius, 0, grid - 1)
        : Math.floor(Math.random() * grid),
      y: anchor
        ? clamp(anchor.y + Math.floor(Math.random() * (radius * 2 + 1)) - radius, 0, grid - 1)
        : Math.floor(Math.random() * grid),
      value: isBonus ? 30 : 10,
      asset: nextFoodAsset(),
    };
  } while (occupied(food) || foods.some((item) => same(item, food)));
  foods.push(food);
}

function foodAnchor(anchors, mode) {
  if (!anchors.length) return null;
  if (mode === "contested" && anchors.length > 1) {
    const first = anchors[Math.floor(Math.random() * anchors.length)];
    const second = anchors[Math.floor(Math.random() * anchors.length)];
    return {
      x: Math.round((first.x + second.x) / 2),
      y: Math.round((first.y + second.y) / 2),
    };
  }
  return anchors[Math.floor(Math.random() * anchors.length)];
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

function makeBodyAt(headX, headY, dirName, length) {
  const dir = dirs[dirName];
  return Array.from({ length }, (_, index) => ({
    x: headX - dir.x * index,
    y: headY - dir.y * index,
  }));
}

function makeStartBody(x, y, dirName, length) {
  return makeBodyAt(x * WORLD_SCALE, y * WORLD_SCALE, dirName, length);
}

function cloneBody(body = []) {
  return body.map((part) => ({ x: part.x, y: part.y }));
}

function snapshotSnake(snake) {
  if (!snake) return;
  snake.previousBody = cloneBody(snake.body);
}

function restart() {
  const playerBody = makeStartBody(12, 16, "right", 4);
  const aiStartBodies = [
    makeStartBody(5, 5, "right", 3),
    makeStartBody(19, 7, "left", 3),
    makeStartBody(8, 20, "up", 3),
  ];
  player = {
    body: playerBody,
    previousBody: cloneBody(playerBody),
    dead: false,
    deadAt: 0,
  };
  aiSnakes = [
    { id: "candy", body: aiStartBodies[0], previousBody: cloneBody(aiStartBodies[0]), dir: "right", skinId: "candy", respawn: 0 },
    { id: "tiger", body: aiStartBodies[1], previousBody: cloneBody(aiStartBodies[1]), dir: "left", skinId: "tiger", respawn: 0 },
    { id: "jungle", body: aiStartBodies[2], previousBody: cloneBody(aiStartBodies[2]), dir: "up", skinId: "jungle", respawn: 0 },
  ];
  foods = [];
  lastFoodId = "";
  shuffleFoods();
  direction = dirs.right;
  nextDirection = dirs.right;
  activePointerId = null;
  smoothedTouchDirection = null;
  touchAnchor = null;
  lastPlayerHead = { ...playerBody[0] };
  renderAlpha = 1;
  cameraReady = false;
  spatialCache = createSpatialCache();
  score.value = 0;
  paused.value = false;
  status.value = "争夺能量核心";
  for (let i = 0; i < FOOD_TARGET; i += 1) spawnFood();
  stateTick += 1;
  draw();
  ensureLoop();

  // 游戏开始时自动进入全屏
  if (!isFullscreen.value) {
    setTimeout(() => enterFullscreen(), 100);
  }
}

function setDirection(name) {
  const dir = dirs[name];
  if (!dir || player?.dead) return;
  const target = normalizeDirection(dir);
  // 防止方向键一键反向（与当前方向夹角接近 180°时忽略），呼应移动端的转向限制
  if (target.x * direction.x + target.y * direction.y < -0.5) return;
  nextDirection = target;
}

// 根据触摸起始锚点到当前点的滑动向量决定方向：
// 只有当手指相对按下位置发生了足够滑动时才转向，纯点击（无滑动）保持原方向。
function setDirectionFromSwipe(clientX, clientY) {
  if (!canvas.value || player?.dead || !touchAnchor) return;
  const rect = canvas.value.getBoundingClientRect();
  const dx = clientX - rect.left - touchAnchor.x;
  const dy = clientY - rect.top - touchAnchor.y;
  if (Math.hypot(dx, dy) < TOUCH_DIRECTION_DEADZONE) return; // 未发生滑动，保持原方向
  const targetDirection = normalizeDirection({ x: dx, y: dy });
  smoothedTouchDirection = smoothedTouchDirection
    ? normalizeDirection({
        x: smoothedTouchDirection.x + (targetDirection.x - smoothedTouchDirection.x) * TOUCH_DIRECTION_SMOOTHING,
        y: smoothedTouchDirection.y + (targetDirection.y - smoothedTouchDirection.y) * TOUCH_DIRECTION_SMOOTHING,
      })
    : targetDirection;
  // 限制单次转角，避免猛地大角度调头
  nextDirection = limitTurn(smoothedTouchDirection, direction);
}

function onPointerDown(event) {
  if (player?.dead) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  const rect = canvas.value.getBoundingClientRect();
  // 仅记录按下锚点并以当前方向为平滑起点；按下本身不转向，等待用户滑动
  touchAnchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  smoothedTouchDirection = { ...direction };
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (activePointerId !== event.pointerId || player?.dead) return;
  event.preventDefault();
  setDirectionFromSwipe(event.clientX, event.clientY);
}

function onPointerEnd(event) {
  if (activePointerId === event.pointerId) activePointerId = null;
  touchAnchor = null;
  smoothedTouchDirection = null;
  try {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  } catch {
    // 浏览器可能已自动释放指针捕获
  }
}

function inBounds(point) {
  return point.x >= 0 && point.y >= 0 && point.x < grid && point.y < grid;
}

function killAi(snake) {
  score.value += 50;
  best.value = setBestScore("snake-arena", score.value);
  snake.body = [];
  snake.previousBody = [];
  snake.respawn = 18;
}

function respawnAi(snake, index) {
  const starts = [
    makeStartBody(5, 5, "right", 3),
    makeStartBody(19, 7, "left", 3),
    makeStartBody(8, 20, "up", 3),
  ];
  snake.body = starts[index].map((part) => ({ ...part }));
  snake.previousBody = cloneBody(snake.body);
  snake.dir = index === 1 ? "left" : index === 2 ? "up" : "right";
  snake.respawn = 0;
}

// 将死亡蛇身沿长度均匀采样成若干食物，长度越长掉落越多（上限 FOOD_CHAIN_MAX）
function spawnFoodChainFromBody(body) {
  if (!body?.length) return;
  const count = clamp(Math.floor(body.length / FOOD_CHAIN_STRIDE), 1, FOOD_CHAIN_MAX);
  for (let i = 0; i < count; i += 1) {
    const part = body[Math.min(body.length - 1, Math.floor((i / count) * body.length))];
    if (!part) continue;
    foods.push({
      x: clamp(Math.round(part.x), 0, grid - 1),
      y: clamp(Math.round(part.y), 0, grid - 1),
      value: i % 4 === 0 ? 30 : 10, // 间隔掉落高能量食物，鼓励其它蛇争夺
      asset: nextFoodAsset(),
    });
  }
}

// 玩家死亡：身体按长度散落成一条食物链，随后进入待复活状态（不再弹窗结束）
function killPlayer() {
  best.value = setBestScore("snake-arena", score.value);
  if (player.body[0]) lastPlayerHead = { ...player.body[0] };
  spawnFoodChainFromBody(player.body);
  player.body = [];
  player.previousBody = [];
  player.dead = true;
  player.deadAt = frameNow;
  activePointerId = null;
  touchAnchor = null;
  smoothedTouchDirection = null;
  status.value = "能量核心碎裂，3 秒后重生";
}

// 在世界内随机寻找一个不与其它蛇重叠的安全出生点
function findRespawnSpot() {
  const margin = 14;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const headX = margin + Math.floor(Math.random() * (grid - margin * 2));
    const headY = margin + Math.floor(Math.random() * (grid - margin * 2));
    const dirName = DIR_NAMES[Math.floor(Math.random() * DIR_NAMES.length)];
    const body = makeBodyAt(headX, headY, dirName, 4);
    if (body.every((part) => inBounds(part) && !segmentHit(part))) {
      return { body, dirName };
    }
  }
  return { body: makeBodyAt(Math.floor(grid / 2), Math.floor(grid / 2), "right", 4), dirName: "right" };
}

// 在随机安全地点复活玩家：身体与分数重置，相机重新定位到新出生点
function respawnPlayer() {
  const spot = findRespawnSpot();
  player.body = spot.body;
  player.previousBody = cloneBody(spot.body);
  player.dead = false;
  player.deadAt = 0;
  direction = dirs[spot.dirName];
  nextDirection = { ...direction };
  lastPlayerHead = { ...spot.body[0] };
  cameraReady = false;
  score.value = 0;
  status.value = "争夺能量核心";
}

function movePlayer() {
  snapshotSnake(player);
  direction = nextDirection;
  const head = {
    x: player.body[0].x + direction.x,
    y: player.body[0].y + direction.y,
  };
  const hitsSelf = player.body.slice(7).some((part) => same(part, head));
  const hitsAi = aiSnakes.some((snake) => snake.body.some((part) => same(part, head)));
  if (!inBounds(head) || hitsSelf || hitsAi) {
    killPlayer();
    return;
  }
  player.body.unshift(head);
  lastPlayerHead = head;
  const foodIndex = foods.findIndex((food) => distanceSquared(food, head) <= FOOD_PICKUP_RADIUS_SQUARED);
  if (foodIndex >= 0) {
    const [food] = foods.splice(foodIndex, 1);
    score.value += food.value;
    best.value = setBestScore("snake-arena", score.value);
    if (foods.length < FOOD_TARGET) spawnFood();
  } else {
    player.body.pop();
  }
}

function chooseAiDirection(snake) {
  const head = snake.body[0];
  const target = nearestFood(head);
  const current = dirs[snake.dir];
  let bestName = snake.dir;
  let bestDistance = Infinity;

  for (const [name, dir] of DIR_ENTRIES) {
    if (dir.x + current.x === 0 && dir.y + current.y === 0) continue;
    const next = { x: head.x + dir.x, y: head.y + dir.y };
    if (!inBounds(next) || segmentHit(next)) continue;
    const nextDistance = target ? Math.abs(target.x - next.x) + Math.abs(target.y - next.y) : Math.random() * 10;
    if (nextDistance < bestDistance) {
      bestName = name;
      bestDistance = nextDistance;
    }
  }

  return bestName;
}

function moveAi() {
  aiSnakes.forEach((snake, index) => {
    snapshotSnake(snake);
    if (snake.respawn > 0) {
      snake.respawn -= 1;
      if (snake.respawn === 0) respawnAi(snake, index);
      return;
    }
    snake.dir = chooseAiDirection(snake);
    const dir = dirs[snake.dir];
    const head = { x: snake.body[0].x + dir.x, y: snake.body[0].y + dir.y };
    const blocked = !inBounds(head) || segmentHit(head);
    if (blocked) {
      killAi(snake);
      return;
    }
    snake.body.unshift(head);
    const foodIndex = foods.findIndex((food) => distanceSquared(food, head) <= FOOD_PICKUP_RADIUS_SQUARED);
    if (foodIndex >= 0) {
      foods.splice(foodIndex, 1);
      if (foods.length < FOOD_TARGET) spawnFood();
    } else {
      snake.body.pop();
    }
  });
}

function step() {
  if (paused.value) return;
  if (player.dead) {
    if (frameNow - player.deadAt >= RESPAWN_DELAY) respawnPlayer();
  } else {
    movePlayer();
  }
  moveAi();
  stateTick += 1;
}

function roundedRect(x, y, width, height, radius, c = ctx) {
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + width, y, x + width, y + height, radius);
  c.arcTo(x + width, y + height, x, y + height, radius);
  c.arcTo(x, y + height, x, y, radius);
  c.arcTo(x, y, x + width, y, radius);
  c.closePath();
}

function worldSize() {
  return {
    width: grid * CELL_SIZE,
    height: grid * CELL_SIZE,
  };
}

function boardSize() {
  if (!canvas.value) {
    return { width: size, height: size };
  }
  const rect = canvas.value.getBoundingClientRect();
  return {
    width: Math.max(280, Math.floor(rect.width || size)),
    height: Math.max(280, Math.floor(rect.height || size)),
  };
}

function syncCanvasSize() {
  if (canvas.value) {
    const nextRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const pixelWidth = Math.max(1, Math.floor(canvasSize.width * nextRatio));
    const pixelHeight = Math.max(1, Math.floor(canvasSize.height * nextRatio));
    if (canvas.value.width !== pixelWidth || canvas.value.height !== pixelHeight || canvasPixelRatio !== nextRatio) {
      canvas.value.width = pixelWidth;
      canvas.value.height = pixelHeight;
      canvasPixelRatio = nextRatio;
      ctx = canvas.value.getContext("2d", { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      bodySpriteCache.clear();
      cameraReady = false;
    }
    ctx.setTransform(canvasPixelRatio, 0, 0, canvasPixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  return canvasSize;
}

function interpolatedSnakePoint(snake, index = 0) {
  const target = snake?.body?.[index];
  if (!target) return null;
  if (renderAlpha >= 0.99) return target;
  const from = snake.previousBody?.[index];
  if (!from) return target;
  return {
    x: from.x + (target.x - from.x) * renderAlpha,
    y: from.y + (target.y - from.y) * renderAlpha,
  };
}

function targetCameraOffset(boardWidth, boardHeight) {
  const world = worldSize();
  const head = interpolatedSnakePoint(player, 0) || lastPlayerHead;
  const target = head
    ? {
        x: head.x * CELL_SIZE + CELL_SIZE / 2 - boardWidth / 2,
        y: head.y * CELL_SIZE + CELL_SIZE / 2 - boardHeight / 2,
      }
    : {
        x: Math.max(0, (world.width - boardWidth) / 2),
        y: Math.max(0, (world.height - boardHeight) / 2),
      };

  return {
    x: clamp(target.x, 0, Math.max(0, world.width - boardWidth)),
    y: clamp(target.y, 0, Math.max(0, world.height - boardHeight)),
  };
}

function cameraOffset(boardWidth, boardHeight) {
  const target = targetCameraOffset(boardWidth, boardHeight);
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

function isPointVisible(point, camera, boardWidth, boardHeight, padding = 2) {
  const x = point.x * CELL_SIZE;
  const y = point.y * CELL_SIZE;
  return (
    x >= camera.x - padding * CELL_SIZE &&
    y >= camera.y - padding * CELL_SIZE &&
    x <= camera.x + boardWidth + padding * CELL_SIZE &&
    y <= camera.y + boardHeight + padding * CELL_SIZE
  );
}

function bucketKey(x, y) {
  return `${Math.floor(x / SPATIAL_BUCKET_SIZE)}:${Math.floor(y / SPATIAL_BUCKET_SIZE)}`;
}

function createSpatialCache(tick = -1) {
  return {
    tick,
    foods: null,
    snakes: new Map(),
    minimapDensities: new Map(),
  };
}

function ensureSpatialCache() {
  if (spatialCache.tick !== stateTick) {
    spatialCache = createSpatialCache(stateTick);
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

function queryBuckets(buckets, camera, boardWidth, boardHeight, padding = 2) {
  const left = Math.floor((camera.x / CELL_SIZE - padding) / SPATIAL_BUCKET_SIZE);
  const right = Math.floor(((camera.x + boardWidth) / CELL_SIZE + padding) / SPATIAL_BUCKET_SIZE);
  const top = Math.floor((camera.y / CELL_SIZE - padding) / SPATIAL_BUCKET_SIZE);
  const bottom = Math.floor(((camera.y + boardHeight) / CELL_SIZE + padding) / SPATIAL_BUCKET_SIZE);
  const items = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const bucket = buckets.get(`${x}:${y}`);
      if (bucket) items.push(...bucket);
    }
  }
  return items;
}

function cachedFoodBuckets() {
  ensureSpatialCache();
  if (!spatialCache.foods) spatialCache.foods = buildPointBuckets(foods || []);
  return spatialCache.foods;
}

function snakeId(snake, isPlayer) {
  return isPlayer ? "player" : snake.id || snake.skinId || snake.dir;
}

function cachedSnakeBuckets(snake, isPlayer) {
  ensureSpatialCache();
  const cacheKey = snakeId(snake, isPlayer);
  if (!spatialCache.snakes.has(cacheKey)) {
    const parts = (snake.body || []).map((part, index) => ({ ...part, index }));
    spatialCache.snakes.set(cacheKey, buildPointBuckets(parts));
  }
  return spatialCache.snakes.get(cacheKey);
}

function visibleFoods(camera, boardWidth, boardHeight) {
  return queryBuckets(cachedFoodBuckets(), camera, boardWidth, boardHeight).filter((food) =>
    isPointVisible(food, camera, boardWidth, boardHeight),
  );
}

function worldToScreen(point, camera) {
  return {
    x: point.x * CELL_SIZE + CELL_SIZE / 2 - camera.x,
    y: point.y * CELL_SIZE + CELL_SIZE / 2 - camera.y,
  };
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

function cachedMinimapDensity(snake, key, minimapSize) {
  ensureSpatialCache();
  const cacheKey = `${key}:${Math.round(minimapSize)}`;
  if (spatialCache.minimapDensities.has(cacheKey)) return spatialCache.minimapDensities.get(cacheKey);

  const body = snake.body || [];
  const cols = Math.max(1, Math.ceil(minimapSize / MINIMAP_DENSITY_CELL));
  const rows = cols;
  const cellSize = minimapSize / cols;
  const stride = Math.max(1, Math.ceil(body.length / MINIMAP_DENSITY_SAMPLE_TARGET));
  const bins = new Map();
  for (let index = 0; index < body.length; index += stride) {
    const part = body[index];
    const binX = clamp(Math.floor((part.x / grid) * cols), 0, cols - 1);
    const binY = clamp(Math.floor((part.y / grid) * rows), 0, rows - 1);
    const binKey = `${binX}:${binY}`;
    bins.set(binKey, (bins.get(binKey) || 0) + Math.min(stride, body.length - index));
  }

  let maxCount = 1;
  const cells = [...bins.entries()].map(([binKey, count]) => {
    const [binX, binY] = binKey.split(":").map(Number);
    maxCount = Math.max(maxCount, count);
    return { binX, binY, count };
  });
  const density = { cells, maxCount, cellSize };
  spatialCache.minimapDensities.set(cacheKey, density);
  return density;
}

function drawMinimapSnakeDensity(snake, skin, key, x, y, minimapSize) {
  if (!snake.body?.length) return;
  const density = cachedMinimapDensity(snake, key, minimapSize);
  density.cells.forEach((cell) => {
    const strength = Math.min(1, cell.count / density.maxCount);
    ctx.fillStyle = colorWithAlpha(skin.body, 0.12 + strength * 0.34);
    ctx.fillRect(
      x + cell.binX * density.cellSize,
      y + cell.binY * density.cellSize,
      Math.max(1.4, density.cellSize + 0.5),
      Math.max(1.4, density.cellSize + 0.5),
    );
  });
}

function drawMinimap(camera, boardWidth, boardHeight) {
  const minimapSize = Math.min(MINIMAP_SIZE, Math.min(boardWidth, boardHeight) * 0.34);
  const x = boardWidth - minimapSize - MINIMAP_PADDING;
  const y = boardHeight - minimapSize - MINIMAP_PADDING;
  const scale = minimapSize / grid;
  const viewLeft = clamp(camera.x / CELL_SIZE, 0, grid);
  const viewTop = clamp(camera.y / CELL_SIZE, 0, grid);
  const viewRight = clamp((camera.x + boardWidth) / CELL_SIZE, viewLeft, grid);
  const viewBottom = clamp((camera.y + boardHeight) / CELL_SIZE, viewTop, grid);
  const viewX = x + viewLeft * scale;
  const viewY = y + viewTop * scale;
  const viewWidth = (viewRight - viewLeft) * scale;
  const viewHeight = (viewBottom - viewTop) * scale;

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(83, 243, 255, 0.22)";
  ctx.fillStyle = "rgba(3, 8, 18, 0.76)";
  roundedRect(x, y, minimapSize, minimapSize, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(145, 235, 255, 0.3)";
  ctx.stroke();

  ctx.save();
  roundedRect(x, y, minimapSize, minimapSize, 8);
  ctx.clip();
  aiSnakes.forEach((snake) => {
    drawMinimapSnakeDensity(snake, getSnakeSkinById(snake.skinId), snakeId(snake, false), x, y, minimapSize);
  });

  foods.forEach((food) => {
    ctx.fillStyle = food.value > 10 ? "#facc15" : "#ffd166";
    ctx.fillRect(x + food.x * scale - 1, y + food.y * scale - 1, 2, 2);
  });

  [
    { snake: player, skin: selectedSkin.value, key: "player", radius: 3, color: "#ffffff" },
    ...aiSnakes.map((snake) => ({ snake, skin: getSnakeSkinById(snake.skinId), key: snakeId(snake, false), radius: 2.2 })),
  ].forEach(({ snake, skin, radius, color }) => {
    const head = snake.body?.[0];
    if (!head) return;
    ctx.fillStyle = color || skin.head;
    ctx.beginPath();
    ctx.arc(x + head.x * scale, y + head.y * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  ctx.strokeStyle = "rgba(83, 243, 255, 0.56)";
  ctx.lineWidth = 1;
  ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);
  ctx.restore();
}

function drawEdgeHint(point, camera, boardWidth, boardHeight, color, radius = 7) {
  const screen = worldToScreen(point, camera);
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
  const x = clamp(
    center.x + Math.cos(angle) * (boardWidth / 2 - EDGE_HINT_DISTANCE),
    EDGE_HINT_PADDING,
    boardWidth - EDGE_HINT_PADDING,
  );
  const y = clamp(
    center.y + Math.sin(angle) * (boardHeight / 2 - EDGE_HINT_DISTANCE),
    EDGE_HINT_PADDING,
    boardHeight - EDGE_HINT_PADDING,
  );

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
  for (const food of foods || []) {
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

function drawEdgeHints(camera, boardWidth, boardHeight) {
  edgeHintFoods().forEach((food) => drawEdgeHint(food, camera, boardWidth, boardHeight, food.value > 10 ? "#facc15" : "#ffd166", 5));

  aiSnakes.forEach((snake) => {
    const head = snake.body?.[0];
    if (!head) return;
    drawEdgeHint(head, camera, boardWidth, boardHeight, getSnakeSkinById(snake.skinId).head, 7);
  });
}

function drawBoundaryWarning(boardWidth, boardHeight) {
  const head = player?.body?.[0];
  if (!head) return;
  const distance = Math.min(head.x, head.y, grid - 1 - head.x, grid - 1 - head.y);
  if (distance > BOUNDARY_WARNING_CELLS) return;
  const alpha = 1 - distance / BOUNDARY_WARNING_CELLS;

  ctx.save();
  ctx.globalAlpha = 0.18 + alpha * 0.34;
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, boardWidth - 8, boardHeight - 8);
  ctx.restore();
}

function drawSkinPattern(skin, x, y, partSize, index, c = ctx) {
  const cx = x + partSize / 2;
  const cy = y + partSize / 2;
  c.save();
  c.globalAlpha = 0.86;
  c.strokeStyle = skin.bodyAlt;
  c.fillStyle = skin.bodyAlt;
  c.lineWidth = Math.max(1, partSize * 0.08);

  if (skin.pattern === "circuits") {
    c.beginPath();
    c.moveTo(x + partSize * 0.22, cy);
    c.lineTo(x + partSize * 0.78, cy);
    c.moveTo(cx, y + partSize * 0.26);
    c.lineTo(cx, y + partSize * 0.46);
    c.stroke();
    c.beginPath();
    c.arc(x + partSize * 0.78, cy, partSize * 0.08, 0, Math.PI * 2);
    c.fill();
  }

  if (skin.pattern === "cracks") {
    c.beginPath();
    c.moveTo(x + partSize * 0.24, y + partSize * 0.24);
    c.lineTo(cx, cy);
    c.lineTo(x + partSize * 0.7, y + partSize * 0.76);
    c.stroke();
  }

  if (skin.pattern === "snow") {
    c.lineWidth = Math.max(1, partSize * 0.06);
    c.beginPath();
    c.moveTo(cx - partSize * 0.18, cy);
    c.lineTo(cx + partSize * 0.18, cy);
    c.moveTo(cx, cy - partSize * 0.18);
    c.lineTo(cx, cy + partSize * 0.18);
    c.stroke();
  }

  if (skin.pattern === "leaves") {
    c.save();
    c.translate(cx, cy);
    c.rotate(index % 2 ? -0.65 : 0.65);
    c.beginPath();
    c.ellipse(0, 0, partSize * 0.2, partSize * 0.09, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  if (skin.pattern === "gems") {
    c.beginPath();
    c.moveTo(cx, y + partSize * 0.18);
    c.lineTo(x + partSize * 0.72, cy);
    c.lineTo(cx, y + partSize * 0.82);
    c.lineTo(x + partSize * 0.28, cy);
    c.closePath();
    c.fill();
  }

  if (skin.pattern === "stripes") {
    c.beginPath();
    c.moveTo(x + partSize * 0.24, y + partSize * 0.82);
    c.lineTo(x + partSize * 0.82, y + partSize * 0.24);
    c.stroke();
  }

  if (skin.pattern === "stars") {
    c.lineWidth = Math.max(1, partSize * 0.05);
    c.beginPath();
    c.moveTo(cx - partSize * 0.2, cy);
    c.lineTo(cx + partSize * 0.2, cy);
    c.moveTo(cx, cy - partSize * 0.2);
    c.lineTo(cx, cy + partSize * 0.2);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, partSize * 0.05, 0, Math.PI * 2);
    c.fill();
  }

  if (skin.pattern === "scales") {
    c.globalAlpha = 0.55;
    for (let i = 0; i < 3; i += 1) {
      c.beginPath();
      c.arc(x + partSize * (0.28 + i * 0.22), cy, partSize * 0.12, Math.PI, Math.PI * 2);
      c.stroke();
    }
  }

  if (skin.pattern === "tiger") {
    c.lineWidth = Math.max(1.2, partSize * 0.12);
    c.beginPath();
    c.moveTo(x + partSize * 0.2, y + partSize * 0.22);
    c.lineTo(x + partSize * 0.72, y + partSize * 0.76);
    c.stroke();
  }

  if (skin.pattern === "mist") {
    c.globalAlpha = 0.26;
    c.beginPath();
    c.arc(x + partSize * 0.36, y + partSize * 0.36, partSize * 0.2, 0, Math.PI * 2);
    c.arc(x + partSize * 0.68, y + partSize * 0.66, partSize * 0.16, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

function shouldSimplifySnakePart(index, bodyLength) {
  return bodyLength > LONG_SNAKE_LENGTH && index >= LONG_SNAKE_EXACT_SEGMENTS && index < bodyLength - LONG_SNAKE_TAIL_KEEP_SEGMENTS;
}

function clipVisibleSnakeParts(parts, bodyLength) {
  if (bodyLength <= LONG_SNAKE_LENGTH || parts.length <= LONG_SNAKE_VISIBLE_BUDGET) return parts;

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

const bodySpriteCache = new Map();

// 预渲染身体段位图（渐变+阴影+高光+图案各做一次），主循环只 drawImage，
// 避免长蛇每帧每段重复 createLinearGradient + shadowBlur 的高昂开销。
function getBodySprite(skin, simplified) {
  const key = `${skin.body}|${skin.bodyAlt}|${skin.glow}|${skin.pattern}|${simplified ? "s" : "n"}`;
  const cached = bodySpriteCache.get(key);
  if (cached) return cached;

  const cell = CELL_SIZE;
  const gap = Math.max(0.5, cell * 0.016);
  const inset = simplified ? cell * 0.08 : 0;
  const partSize = cell - gap * 2 - inset * 2;
  const blur = simplified ? 4 : 11;
  const pad = Math.ceil(blur + 2);
  const spriteSize = Math.ceil(partSize + pad * 2);
  const sprite = document.createElement("canvas");
  sprite.width = spriteSize;
  sprite.height = spriteSize;
  const c = sprite.getContext("2d");

  c.shadowBlur = blur;
  c.shadowColor = skin.glow;
  const fill = c.createLinearGradient(pad, pad, pad + partSize, pad + partSize);
  fill.addColorStop(0, skin.body);
  fill.addColorStop(1, skin.bodyAlt);
  c.fillStyle = fill;
  roundedRect(pad, pad, partSize, partSize, partSize * 0.34, c);
  c.fill();

  if (!simplified) {
    c.shadowBlur = 0;
    c.fillStyle = "rgba(255,255,255,0.22)";
    roundedRect(pad + partSize * 0.18, pad + partSize * 0.14, partSize * 0.32, partSize * 0.14, partSize * 0.07, c);
    c.fill();
    drawSkinPattern(skin, pad, pad, partSize, 0, c);
  }

  const entry = { canvas: sprite, half: spriteSize / 2 };
  bodySpriteCache.set(key, entry);
  return entry;
}

function drawSnakePart(part, index, cell, skin, dir, simplified = false) {
  const isHead = index === 0;
  // 段中心恒为格子中心（与 gap/inset 无关），用于对齐精灵
  const centerX = part.x * cell + cell / 2;
  const centerY = part.y * cell + cell / 2;

  // 身体段：直接绘制预渲染的离屏精灵
  if (!isHead) {
    const sprite = getBodySprite(skin, simplified);
    if (simplified) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.drawImage(sprite.canvas, centerX - sprite.half, centerY - sprite.half);
      ctx.restore();
    } else {
      ctx.drawImage(sprite.canvas, centerX - sprite.half, centerY - sprite.half);
    }
    return;
  }

  // 蛇头：实时绘制（数量少，且眼睛/触角朝向随 dir 变化，无法缓存）
  const gap = Math.max(0.5, cell * 0.016);
  const x = part.x * cell + gap;
  const y = part.y * cell + gap;
  const partSize = cell - gap * 2;
  const center = { x: x + partSize / 2, y: y + partSize / 2 };

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = skin.head;
  const fill = ctx.createLinearGradient(x, y, x + partSize, y + partSize);
  fill.addColorStop(0, skin.head);
  fill.addColorStop(1, skin.bodyAlt);
  ctx.fillStyle = fill;
  roundedRect(x, y, partSize, partSize, partSize * 0.42);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundedRect(x + partSize * 0.18, y + partSize * 0.14, partSize * 0.32, partSize * 0.14, partSize * 0.07);
  ctx.fill();

  const forward = dir || dirs.right;
  const side = { x: -forward.y, y: forward.x };
  const eyeForward = partSize * 0.2;
  const eyeSide = partSize * 0.18;
  const eyeRadius = Math.max(1.8, partSize * 0.09);
  const eyes = [-1, 1].map((sign) => ({
    x: center.x + forward.x * eyeForward + side.x * eyeSide * sign,
    y: center.y + forward.y * eyeForward + side.y * eyeSide * sign,
  }));
  ctx.fillStyle = skin.eye;
  eyes.forEach((eye) => {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.beginPath();
    ctx.arc(eye.x + eyeRadius * 0.25, eye.y - eyeRadius * 0.25, eyeRadius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.eye;
  });

  ctx.strokeStyle = skin.bodyAlt;
  ctx.lineWidth = Math.max(1, partSize * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(center.x + forward.x * partSize * 0.42, center.y + forward.y * partSize * 0.42);
  ctx.lineTo(
    center.x + forward.x * partSize * 0.62 + side.x * partSize * 0.15,
    center.y + forward.y * partSize * 0.62 + side.y * partSize * 0.15,
  );
  ctx.moveTo(center.x + forward.x * partSize * 0.42, center.y + forward.y * partSize * 0.42);
  ctx.lineTo(
    center.x + forward.x * partSize * 0.62 - side.x * partSize * 0.15,
    center.y + forward.y * partSize * 0.62 - side.y * partSize * 0.15,
  );
  ctx.stroke();

  ctx.restore();
}

function getFoodImage(foodAsset) {
  if (!foodAsset?.image || typeof Image === "undefined") return null;
  if (!foodImages.has(foodAsset.image)) {
    const image = new Image();
    image.onload = () => draw();
    image.src = foodAsset.image;
    foodImages.set(foodAsset.image, image);
  }
  const image = foodImages.get(foodAsset.image);
  return image.complete && image.naturalWidth ? image : null;
}

function drawFood(food, cell) {
  const image = getFoodImage(food.asset);
  const centerX = food.x * cell + cell / 2;
  const centerY = food.y * cell + cell / 2;
  const isGold = food.value > 10;
  const imageSize = cell * (isGold ? 1.52 : 1.36);

  ctx.save();
  ctx.shadowBlur = isGold ? 20 : 14;
  ctx.shadowColor = isGold ? "#facc15" : "#ffd166";
  if (image) {
    ctx.drawImage(image, centerX - imageSize / 2, centerY - imageSize / 2, imageSize, imageSize);
  } else {
    ctx.fillStyle = isGold ? "#facc15" : "#ffd166";
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * (isGold ? 0.62 : 0.52), 0, Math.PI * 2);
    ctx.fill();
  }

  if (isGold) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.66)";
    ctx.lineWidth = Math.max(1.2, cell * 0.045);
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// 平滑插值：让每段从"上一帧自身所在格"滑向"当前所在格"，整条蛇连续爬行，
// 而非只有蛇头移动、蛇身每个 tick 瞬间跳一格（那会造成肉眼可见的一闪一闪）。
// 必须用相同的 index：移动后 body[i] 等于旧 body[i-1]，而旧 body[i] 正是它的前一格，
// 因此 previousBody[i] → body[i] 恰好是该段向前滑动一格。
function interpolatedPart(snake, part) {
  if (renderAlpha >= 0.99) return part;
  const from = snake.previousBody?.[part.index];
  if (!from) return part; // 吃食物时新长出的尾段没有对应历史位置，直接停在原地
  return {
    ...part,
    x: from.x + (part.x - from.x) * renderAlpha,
    y: from.y + (part.y - from.y) * renderAlpha,
  };
}

function drawSnake(snake, isPlayer = false, cameraView = camera, boardWidth = size, boardHeight = size) {
  const skin = isPlayer ? selectedSkin.value : getSnakeSkinById(snake.skinId);
  const dir = isPlayer ? direction : dirs[snake.dir];
  const buckets = cachedSnakeBuckets(snake, isPlayer);
  const bodyLength = snake.body?.length || 0;
  const parts = queryBuckets(buckets, cameraView, boardWidth, boardHeight, SNAKE_RENDER_PADDING)
    .sort((a, b) => b.index - a.index)
    .map((part) => interpolatedPart(snake, part))
    .filter((part) => isPointVisible(part, cameraView, boardWidth, boardHeight, SNAKE_RENDER_PADDING));
  clipVisibleSnakeParts(parts, bodyLength).forEach((part) => {
    drawSnakePart(part, part.index, CELL_SIZE, skin, dir, shouldSimplifySnakePart(part.index, bodyLength));
  });
}

function draw() {
  if (!ctx) return;
  const { width: boardWidth, height: boardHeight } = syncCanvasSize();
  const camera = cameraOffset(boardWidth, boardHeight);
  const world = worldSize();
  ctx.setTransform(canvasPixelRatio, 0, 0, canvasPixelRatio, 0, 0);
  ctx.clearRect(0, 0, boardWidth, boardHeight);
  ctx.fillStyle = "#020611";
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  ctx.strokeStyle = "rgba(83, 243, 255, 0.06)";
  ctx.lineWidth = 1;
  const startCol = Math.max(0, Math.floor(camera.x / CELL_SIZE) - 1);
  const endCol = Math.min(grid, Math.ceil((camera.x + boardWidth) / CELL_SIZE) + 1);
  const startRow = Math.max(0, Math.floor(camera.y / CELL_SIZE) - 1);
  const endRow = Math.min(grid, Math.ceil((camera.y + boardHeight) / CELL_SIZE) + 1);
  for (let i = startCol; i <= endCol; i += 1) {
    const pos = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, Math.max(0, camera.y - CELL_SIZE * 2));
    ctx.lineTo(pos, Math.min(world.height, camera.y + boardHeight + CELL_SIZE * 2));
    ctx.stroke();
  }
  for (let i = startRow; i <= endRow; i += 1) {
    const pos = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, camera.x - CELL_SIZE * 2), pos);
    ctx.lineTo(Math.min(world.width, camera.x + boardWidth + CELL_SIZE * 2), pos);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 209, 102, 0.28)";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, world.width, world.height);

  visibleFoods(camera, boardWidth, boardHeight).forEach((food) => drawFood(food, CELL_SIZE));
  drawSnake(player, true, camera, boardWidth, boardHeight);
  aiSnakes.forEach((snake) => drawSnake(snake, false, camera, boardWidth, boardHeight));
  ctx.restore();
  drawBoundaryWarning(boardWidth, boardHeight);
  drawEdgeHints(camera, boardWidth, boardHeight);
  drawMinimap(camera, boardWidth, boardHeight);
  ctx.shadowBlur = 0;
}

function tickInterval() {
  return Math.max(82, 138 - score.value * 0.04);
}

function loop(time) {
  if (paused.value) {
    loopId = 0; // 暂停时停止循环，恢复由 ensureLoop 重启，避免空转
    return;
  }
  frameNow = time;
  const interval = tickInterval();
  if (!lastTick) lastTick = time;
  if (time - lastTick > Math.max(interval, 240)) lastTick = time - interval;

  if (time - lastTick >= interval) {
    step();
    lastTick = time;
  }
  renderAlpha = clamp((time - lastTick) / interval, 0, 1);
  draw();
  loopId = requestAnimationFrame(loop);
}

// 幂等启动主循环：仅在未运行时启动，避免重复 rAF
function ensureLoop() {
  if (loopId) return;
  lastTick = 0;
  loopId = requestAnimationFrame(loop);
}

function resize() {
  if (!canvas.value) return;
  canvas.value.style.width = "100%";
  canvas.value.style.height = "100%";
  canvasSize = boardSize();
  syncCanvasSize();
  draw();
}

function togglePause() {
  paused.value = !paused.value;
  status.value = paused.value ? "已暂停" : "继续争夺能量核心";
  if (!paused.value) ensureLoop();
}

function onKey(event) {
  const action = KEY_ACTIONS[event.key];
  if (!action) return;
  event.preventDefault();
  if (action === "pause") togglePause();
  else setDirection(action);
}

onMounted(() => {
  ctx = canvas.value.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  restart();
  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.value.parentElement);
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKey);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("mozfullscreenchange", onFullscreenChange);
  document.addEventListener("msfullscreenchange", onFullscreenChange);
  ensureLoop();
});

onUnmounted(() => {
  cancelAnimationFrame(loopId);
  resizeObserver?.disconnect();
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKey);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  document.removeEventListener("mozfullscreenchange", onFullscreenChange);
  document.removeEventListener("msfullscreenchange", onFullscreenChange);
});
</script>

<template>
  <GameLayout
    class="snake-arena-layout"
    game-id="snake-arena"
    :score="score"
    :best="best"
    :status="status"
    :paused="paused"
    show-pause
    @restart="restart"
    @toggle-pause="togglePause"
  >
    <section ref="gameContainer" class="game-panel arena-play-panel" :class="{ 'is-fullscreen': isFullscreen }">
      <button
        class="fullscreen-toggle"
        type="button"
        :title="isFullscreen ? '退出全屏' : '进入全屏'"
        @click="toggleFullscreen"
      >
        <Minimize v-if="isFullscreen" :size="20" />
        <Maximize v-else :size="20" />
      </button>
      <div class="board-shell arena-board-shell">
        <details
          class="arena-skin-drawer"
          @click.stop
          @touchstart.stop
          @touchend.stop
          @touchmove.stop
        >
          <summary>
            <Settings :size="18" />
            <span>皮肤</span>
            <ChevronDown class="drawer-chevron" :size="17" />
          </summary>
          <div class="arena-skin-grid" role="list" aria-label="贪吃蛇大作战皮肤">
            <button
              v-for="skin in SNAKE_SKINS"
              :key="skin.id"
              class="arena-skin-option"
              :class="{ active: selectedSkinId === skin.id }"
              :style="{ '--skin': skin.body, '--skin-alt': skin.bodyAlt, '--skin-glow': skin.glow }"
              type="button"
              role="listitem"
              :aria-label="skin.name"
              :aria-pressed="selectedSkinId === skin.id"
              @click="selectSkin(skin.id)"
            >
              <img :src="skin.preview" alt="" />
            </button>
          </div>
        </details>
        <canvas
          ref="canvas"
          class="canvas-board arena-canvas"
          aria-label="贪吃蛇大作战游戏画布"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerEnd"
          @pointercancel="onPointerEnd"
        ></canvas>
      </div>
    </section>
  </GameLayout>
</template>

<style scoped>
:global(.snake-arena-layout.game-shell) {
  padding: 6px;
}

:global(.snake-arena-layout .game-frame) {
  width: min(1800px, 100%);
}

:global(.snake-arena-layout .game-content) {
  padding: 6px;
}

.arena-play-panel {
  position: relative;
  height: 100%;
}

.arena-play-panel.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #020611;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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

.arena-board-shell {
  position: relative;
  padding: 4px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.is-fullscreen .arena-board-shell {
  border: 0;
  border-radius: 0;
  padding: 0;
}

.arena-canvas {
  display: block;
  width: 100%;
  height: 100%;
  max-height: none;
  min-height: 0;
  touch-action: none;
}

.is-fullscreen .arena-canvas {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.arena-skin-drawer {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: min(292px, calc(100% - 20px));
  border: 1px solid rgba(145, 235, 255, 0.2);
  border-radius: var(--radius);
  background: rgba(7, 13, 27, 0.88);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.arena-skin-drawer > summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  min-height: 46px;
  padding: 0 12px;
  color: var(--text);
  cursor: pointer;
  font-weight: 900;
  list-style: none;
}

.arena-skin-drawer > summary::-webkit-details-marker {
  display: none;
}

.arena-skin-drawer > summary svg {
  color: var(--cyan);
}

.arena-skin-drawer > summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-chevron {
  transition: transform 0.18s ease;
}

.arena-skin-drawer[open] .drawer-chevron {
  transform: rotate(180deg);
}

.arena-skin-grid {
  margin: 0 12px 12px;
}

.arena-skin-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  max-height: min(42svh, 226px);
  overflow: auto;
  overscroll-behavior: contain;
}

.arena-skin-option {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  min-width: 0;
  padding: 3px;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--skin), transparent 82%), rgba(5, 10, 22, 0.62)),
    rgba(6, 13, 28, 0.74);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.arena-skin-option:hover,
.arena-skin-option.active {
  border-color: color-mix(in srgb, var(--skin), white 18%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--skin-glow), transparent 72%);
}

.arena-skin-option:hover {
  transform: translateY(-1px);
}

.arena-skin-option img {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-glow), transparent 58%);
}

@media (max-width: 860px) {
  :global(.snake-arena-layout.game-shell) {
    padding: 0;
  }

  :global(.snake-arena-layout .game-frame) {
    border-radius: 0;
  }

  :global(.snake-arena-layout .game-content) {
    padding: 4px;
  }

  .fullscreen-toggle {
    top: 8px;
    left: 8px;
    width: 38px;
    height: 38px;
  }

  .arena-board-shell {
    padding: 2px;
  }

  .arena-skin-drawer {
    top: 7px;
    right: 7px;
    width: min(260px, calc(100% - 14px));
    border-radius: 10px;
  }

  .arena-skin-drawer > summary {
    min-height: 38px;
    padding: 0 9px;
    gap: 6px;
    font-size: 0.88rem;
  }

  .arena-skin-grid {
    margin: 0 9px 9px;
  }

  .arena-skin-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    max-height: min(30svh, 180px);
  }
}

@media (max-width: 430px), (max-height: 720px) {
  .arena-skin-drawer {
    width: min(218px, calc(100% - 14px));
  }

  .arena-skin-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
