const GRID_WIDTH = 36 * 10;
const GRID_HEIGHT = 24 * 10;
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const TICK_MS = 115;
const FOOD_TARGET = 72;
const LOCAL_FOOD_RATIO = 0.62;
const CONTESTED_FOOD_RATIO = 0.18;
const FOOD_SPAWN_RADIUS = 22;
const EXPLORE_FOOD_RADIUS = 72;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VALID_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const SKIN_IDS = new Set(["cyber", "lava", "frost", "jungle", "royal", "candy", "galaxy", "jade", "tiger", "ghost"]);
const FOOD_IDS = [
  "apple",
  "pear",
  "strawberry",
  "cherry",
  "lemon",
  "orange",
  "kiwi",
  "watermelon",
  "grape",
  "blueberry",
  "pineapple",
  "banana",
  "peach",
  "dragonfruit",
  "starfruit",
  "plum",
  "coconut",
  "mango",
  "chili",
  "energy-core",
];

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const STARTS = [
  { dir: "right", body: [{ x: 36, y: 48 }, { x: 35, y: 48 }, { x: 34, y: 48 }] },
  { dir: "left", body: [{ x: 323, y: 192 }, { x: 324, y: 192 }, { x: 325, y: 192 }] },
  { dir: "down", body: [{ x: 72, y: 192 }, { x: 72, y: 191 }, { x: 72, y: 190 }] },
  { dir: "up", body: [{ x: 287, y: 48 }, { x: 287, y: 49 }, { x: 287, y: 50 }] },
  { dir: "right", body: [{ x: 36, y: 120 }, { x: 35, y: 120 }, { x: 34, y: 120 }] },
  { dir: "left", body: [{ x: 323, y: 120 }, { x: 324, y: 120 }, { x: 325, y: 120 }] },
];

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function randomRoomCode(length = 5) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join("");
}

function normalizeRoomCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : "";
}

function cleanName(value) {
  return String(value || "玩家")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .trim()
    .slice(0, 12) || "玩家";
}

function cleanSkinId(value) {
  return SKIN_IDS.has(value) ? value : "cyber";
}

function createRoomState(roomCode) {
  return {
    roomCode,
    phase: "lobby",
    grid: GRID_HEIGHT,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    maxPlayers: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS,
    players: {},
    snakes: {},
    foods: [],
    winnerId: "",
    tick: 0,
    startedPlayerCount: 0,
    message: "等待玩家准备",
  };
}

function same(a, b) {
  return a.x === b.x && a.y === b.y;
}

function pointKey(point) {
  return `${point.x}:${point.y}`;
}

function inBounds(point) {
  return point.x >= 0 && point.y >= 0 && point.x < GRID_WIDTH && point.y < GRID_HEIGHT;
}

function opposite(a, b) {
  const first = DIRS[a];
  const second = DIRS[b];
  return first && second && first.x + second.x === 0 && first.y + second.y === 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class SnakeRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = createRoomState("");
    this.pendingDirections = new Map();
    this.interval = null;
    this.ready = this.ctx.storage.get("room").then((stored) => {
      if (stored?.roomCode) this.room = stored;
      if (this.room.phase === "playing") this.room.phase = "ended";
    });
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const code = normalizeRoomCode(url.pathname.split("/").filter(Boolean).at(2));
    if (code && !this.room.roomCode) this.room.roomCode = code;

    if (request.method === "POST" && url.pathname === "/init") {
      const body = await request.json().catch(() => ({}));
      const roomCode = normalizeRoomCode(body.roomCode);
      if (roomCode && !this.room.roomCode) {
        this.room.roomCode = roomCode;
        await this.saveRoom();
      }
      return json({ roomCode: this.room.roomCode });
    }

    if (request.method === "GET" && url.pathname.endsWith("/ws")) {
      return this.handleSocket(request);
    }

    if (request.method === "GET") {
      return json(this.publicState());
    }

    return new Response("Method not allowed", { status: 405 });
  }

  async handleSocket(request) {
    if (request.headers.get("upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    this.pruneDisconnectedLobbyPlayers();
    if (this.connectedPlayers().length >= MAX_PLAYERS) {
      return new Response("Room is full", { status: 409 });
    }

    const url = new URL(request.url);
    const playerId = crypto.randomUUID();
    const player = {
      id: playerId,
      name: cleanName(url.searchParams.get("name")),
      skinId: cleanSkinId(url.searchParams.get("skinId")),
      ready: false,
      host: !this.connectedPlayers().some((item) => item.host),
      connected: true,
      alive: false,
      score: 0,
      joinedAt: Date.now(),
    };
    this.room.players[playerId] = player;
    this.assignHost();
    await this.saveRoom();

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ playerId });
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "hello", playerId }));
    this.broadcast();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    await this.ready;
    const playerId = ws.deserializeAttachment()?.playerId;
    const player = this.room.players[playerId];
    if (!player) return;

    let data;
    try {
      data = JSON.parse(typeof message === "string" ? message : "");
    } catch {
      return;
    }

    if (data.type === "input") {
      if (this.room.phase !== "playing" || !player.alive) return;
      if (VALID_DIRECTIONS.has(data.direction)) this.pendingDirections.set(playerId, data.direction);
      return;
    }

    if (data.type === "ready") {
      if (this.room.phase !== "lobby") return;
      player.ready = Boolean(data.ready);
      await this.saveRoom();
      this.broadcast();
      return;
    }

    if (data.type === "start") {
      if (!player.host || !["lobby", "ended"].includes(this.room.phase)) return;
      const connected = this.connectedPlayers();
      if (connected.length < MIN_PLAYERS) {
        ws.send(JSON.stringify({ type: "error", message: "至少需要 2 名玩家" }));
        return;
      }
      const everyoneReady = connected.every((item) => item.host || item.ready);
      if (!everyoneReady && this.room.phase === "lobby") {
        ws.send(JSON.stringify({ type: "error", message: "还有玩家未准备" }));
        return;
      }
      await this.startGame();
    }
  }

  async webSocketClose(ws) {
    await this.markDisconnected(ws);
  }

  async webSocketError(ws) {
    await this.markDisconnected(ws);
  }

  async markDisconnected(ws) {
    await this.ready;
    const playerId = ws.deserializeAttachment()?.playerId;
    const player = this.room.players[playerId];
    if (!player) return;
    player.connected = false;
    player.ready = false;
    player.alive = false;
    delete this.room.snakes[playerId];
    this.pendingDirections.delete(playerId);
    this.assignHost();

    if (!this.connectedPlayers().length) {
      this.stopGameLoop();
      const roomCode = this.room.roomCode;
      this.room = createRoomState(roomCode);
      await this.ctx.storage.delete("room");
      return;
    }

    if (this.room.phase === "playing") this.maybeFinishGame();
    this.pruneDisconnectedLobbyPlayers();
    await this.saveRoom();
    this.broadcast();
  }

  connectedPlayers() {
    return Object.values(this.room.players).filter((player) => player.connected);
  }

  orderedPlayers() {
    return Object.values(this.room.players).sort((a, b) => Number(b.host) - Number(a.host) || a.joinedAt - b.joinedAt);
  }

  assignHost() {
    const connected = this.connectedPlayers().sort((a, b) => a.joinedAt - b.joinedAt);
    if (!connected.length) return;
    if (connected.some((player) => player.host)) return;
    Object.values(this.room.players).forEach((player) => {
      player.host = false;
    });
    connected[0].host = true;
  }

  pruneDisconnectedLobbyPlayers() {
    if (!["lobby", "ended"].includes(this.room.phase)) return;
    Object.entries(this.room.players).forEach(([id, player]) => {
      if (!player.connected) {
        delete this.room.players[id];
        delete this.room.snakes[id];
      }
    });
    this.assignHost();
  }

  publicState() {
    return {
      roomCode: this.room.roomCode,
      phase: this.room.phase,
      grid: this.room.grid || GRID_HEIGHT,
      gridWidth: this.room.gridWidth || GRID_WIDTH,
      gridHeight: this.room.gridHeight || this.room.grid || GRID_HEIGHT,
      maxPlayers: this.room.maxPlayers,
      minPlayers: this.room.minPlayers,
      players: this.orderedPlayers().map((player) => ({
        id: player.id,
        name: player.name,
        skinId: player.skinId,
        ready: player.ready,
        host: player.host,
        connected: player.connected,
        alive: player.alive,
        score: player.score,
      })),
      snakes: this.room.snakes,
      foods: this.room.foods,
      winnerId: this.room.winnerId,
      tick: this.room.tick,
      message: this.room.message,
    };
  }

  broadcast() {
    const message = JSON.stringify({ type: "room", state: this.publicState() });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        // The close handler will clean up stale sockets.
      }
    }
  }

  async saveRoom() {
    await this.ctx.storage.put("room", this.room);
  }

  async startGame() {
    this.stopGameLoop();
    this.pendingDirections.clear();
    this.room.phase = "playing";
    this.room.grid = GRID_HEIGHT;
    this.room.gridWidth = GRID_WIDTH;
    this.room.gridHeight = GRID_HEIGHT;
    this.room.winnerId = "";
    this.room.tick = 0;
    this.room.foods = [];
    this.room.snakes = {};

    const starters = this.connectedPlayers().slice(0, MAX_PLAYERS);
    this.room.startedPlayerCount = starters.length;
    Object.values(this.room.players).forEach((player) => {
      player.ready = false;
      player.alive = false;
      player.score = 0;
    });
    starters.forEach((player, index) => {
      const start = STARTS[index % STARTS.length];
      player.alive = true;
      this.room.snakes[player.id] = {
        playerId: player.id,
        dir: start.dir,
        body: start.body.map((part) => ({ ...part })),
      };
    });
    while (this.room.foods.length < FOOD_TARGET) this.spawnFood();
    this.room.message = "正在争夺能量核心";
    await this.saveRoom();
    this.broadcast();
    this.interval = setInterval(() => this.step(), TICK_MS);
  }

  stopGameLoop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  spawnFood() {
    const occupied = this.occupiedPoints();
    const anchors = Object.values(this.room.snakes)
      .map((snake) => snake.body[0])
      .filter(Boolean);
    const modeRoll = Math.random();
    const mode = modeRoll < LOCAL_FOOD_RATIO ? "local" : modeRoll < LOCAL_FOOD_RATIO + CONTESTED_FOOD_RATIO ? "contested" : "explore";
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const anchor = this.foodAnchor(anchors, mode);
      const radius = mode === "explore" ? EXPLORE_FOOD_RADIUS : FOOD_SPAWN_RADIUS;
      const isBonus = mode === "contested" || Math.random() < 0.16;
      const food = {
        x: anchor
          ? clamp(anchor.x + Math.floor(Math.random() * (radius * 2 + 1)) - radius, 0, GRID_WIDTH - 1)
          : Math.floor(Math.random() * GRID_WIDTH),
        y: anchor
          ? clamp(anchor.y + Math.floor(Math.random() * (radius * 2 + 1)) - radius, 0, GRID_HEIGHT - 1)
          : Math.floor(Math.random() * GRID_HEIGHT),
        value: isBonus ? 30 : 10,
        assetId: FOOD_IDS[Math.floor(Math.random() * FOOD_IDS.length)],
      };
      if (occupied.has(pointKey(food))) continue;
      if (this.room.foods.some((item) => same(item, food))) continue;
      this.room.foods.push(food);
      return;
    }
  }

  foodAnchor(anchors, mode) {
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

  occupiedPoints(plans = null) {
    const occupied = new Set();
    const hasPlans = Boolean(plans);
    Object.entries(this.room.snakes).forEach(([playerId, snake]) => {
      const bodyLength = hasPlans
        ? plans[playerId]?.grows
          ? snake.body.length
          : Math.max(0, snake.body.length - 1)
        : snake.body.length;
      snake.body.slice(0, bodyLength).forEach((part) => occupied.add(pointKey(part)));
    });
    return occupied;
  }

  step() {
    if (this.room.phase !== "playing") return;

    const activeIds = Object.keys(this.room.snakes).filter((id) => this.room.players[id]?.alive);
    if (!activeIds.length) {
      this.endGame("");
      return;
    }

    const plans = {};
    activeIds.forEach((playerId) => {
      const snake = this.room.snakes[playerId];
      const pending = this.pendingDirections.get(playerId);
      if (pending && !opposite(snake.dir, pending)) snake.dir = pending;
      this.pendingDirections.delete(playerId);
      const dir = DIRS[snake.dir];
      const head = { x: snake.body[0].x + dir.x, y: snake.body[0].y + dir.y };
      const foodIndex = this.room.foods.findIndex((food) => same(food, head));
      plans[playerId] = {
        head,
        foodIndex,
        grows: foodIndex >= 0,
      };
    });

    const occupied = this.occupiedPoints(plans);
    const deadIds = new Set();
    const headCounts = new Map();
    Object.entries(plans).forEach(([playerId, plan]) => {
      if (!inBounds(plan.head) || occupied.has(pointKey(plan.head))) deadIds.add(playerId);
      const key = pointKey(plan.head);
      headCounts.set(key, [...(headCounts.get(key) || []), playerId]);
    });
    headCounts.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => deadIds.add(id));
    });

    deadIds.forEach((playerId) => {
      this.room.players[playerId].alive = false;
      delete this.room.snakes[playerId];
    });

    const eatenIndexes = new Set();
    Object.entries(plans).forEach(([playerId, plan]) => {
      if (deadIds.has(playerId)) return;
      const snake = this.room.snakes[playerId];
      if (!snake) return;
      snake.body.unshift(plan.head);
      if (plan.foodIndex >= 0 && !eatenIndexes.has(plan.foodIndex)) {
        const food = this.room.foods[plan.foodIndex];
        this.room.players[playerId].score += food?.value || 10;
        eatenIndexes.add(plan.foodIndex);
      } else {
        snake.body.pop();
      }
    });

    if (eatenIndexes.size) {
      this.room.foods = this.room.foods.filter((_, index) => !eatenIndexes.has(index));
      while (this.room.foods.length < FOOD_TARGET) this.spawnFood();
    }

    this.room.tick += 1;
    this.maybeFinishGame();
    this.broadcast();
  }

  maybeFinishGame() {
    if (this.room.phase !== "playing") return;
    const alive = Object.values(this.room.players).filter((player) => player.alive);
    if (alive.length > 1) return;
    this.endGame(alive[0]?.id || "");
  }

  endGame(winnerId) {
    this.stopGameLoop();
    this.room.phase = "ended";
    this.room.winnerId = winnerId;
    this.room.message = winnerId ? `${this.room.players[winnerId]?.name || "玩家"} 获胜` : "本局结束";
    Object.values(this.room.players).forEach((player) => {
      player.alive = false;
      player.ready = false;
    });
    const savePromise = this.saveRoom().catch(() => {});
    if (typeof this.ctx.waitUntil === "function") this.ctx.waitUntil(savePromise);
    this.broadcast();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const roomCode = randomRoomCode();
      const id = env.SNAKE_ROOMS.idFromName(roomCode);
      const stub = env.SNAKE_ROOMS.get(id);
      await stub.fetch(
        new Request("https://snake-room.local/init", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomCode }),
        }),
      );
      return json({ roomCode });
    }

    const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{4,8})(?:\/(?:ws|state))?$/i);
    if (roomMatch) {
      const roomCode = normalizeRoomCode(roomMatch[1]);
      if (!roomCode) return new Response("Invalid room code", { status: 400 });
      const id = env.SNAKE_ROOMS.idFromName(roomCode);
      const stub = env.SNAKE_ROOMS.get(id);
      return stub.fetch(request);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
