<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Copy, Gamepad2, Plus, Swords, UsersRound } from "lucide-vue-next";
import snakeArenaIcon from "../assets/icons/snake-arena.svg";
import { SNAKE_SKINS, getSnakeSkinById } from "../data/snakeSkins";
import { getSavedValue, setSavedValue } from "../utils/storage";

const router = useRouter();
const NAME_KEY = "online:player-name";
const SKIN_KEY = "snake:skin";

const fallbackName = `玩家${Math.floor(1000 + Math.random() * 9000)}`;
const playerName = ref(getSavedValue(NAME_KEY, fallbackName));
const selectedSkinId = ref(getSavedValue(SKIN_KEY, "cyber"));
const roomCode = ref("");
const creating = ref(false);
const joining = ref(false);
const error = ref("");

const selectedSkin = computed(() => getSnakeSkinById(selectedSkinId.value));
const normalizedRoomCode = computed(() => roomCode.value.trim().replace(/\s+/g, "").toUpperCase());

function saveProfile() {
  const name = playerName.value.trim().slice(0, 12) || fallbackName;
  playerName.value = name;
  setSavedValue(NAME_KEY, name);
  setSavedValue(SKIN_KEY, selectedSkinId.value);
}

function selectSkin(id) {
  selectedSkinId.value = id;
  saveProfile();
}

async function createRoom() {
  if (creating.value) return;
  error.value = "";
  creating.value = true;
  saveProfile();
  try {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "multiplayer-snake" }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "房间服务暂时不可用");
    }
    const data = await response.json();
    router.push({ name: "online-snake-room", params: { roomCode: data.roomCode } });
  } catch (err) {
    error.value = err?.message || "创建房间失败";
  } finally {
    creating.value = false;
  }
}

function joinRoom() {
  if (joining.value) return;
  error.value = "";
  const code = normalizedRoomCode.value;
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    error.value = "请输入 4-8 位房间码";
    return;
  }
  joining.value = true;
  saveProfile();
  router.push({ name: "online-snake-room", params: { roomCode: code } });
}

async function copyJoinHint() {
  const url = `${window.location.origin}${window.location.pathname}#/online`;
  await navigator.clipboard?.writeText(url);
}
</script>

<template>
  <main class="home-page online-page">
    <div class="starfield" aria-hidden="true"></div>
    <section class="hero-panel online-hero">
      <div class="hero-copy">
        <p class="eyebrow">ONLINE ARCADE ROOM</p>
        <h1>联机大厅</h1>
        <p class="hero-subtitle">创建房间，把房间码发给朋友，同屏争夺能量核心。</p>
      </div>
      <div class="command-strip" aria-hidden="true">
        <span>ROOM CODE</span>
        <span>WEBSOCKET</span>
        <span>2-6 PLAYERS</span>
      </div>
    </section>

    <section class="mode-switch" aria-label="游玩区域">
      <RouterLink class="mode-card" to="/">
        <Gamepad2 :size="21" />
        <div>
          <span>单机游戏</span>
          <strong>本地挑战与进度</strong>
        </div>
      </RouterLink>
      <article class="mode-card active">
        <Swords :size="21" />
        <div>
          <span>联机游戏</span>
          <strong>多人贪吃蛇房间</strong>
        </div>
      </article>
    </section>

    <section class="online-grid" aria-label="联机大厅">
      <article class="dashboard-panel online-room-panel">
        <div class="panel-title">
          <UsersRound :size="19" />
          <span>多人贪吃蛇</span>
        </div>
        <div class="online-game-title">
          <img :src="snakeArenaIcon" alt="" />
          <div>
            <h2>创建或加入房间</h2>
            <p>房主开始后，所有玩家在同一张地图里实时移动、抢食物、争最后存活。</p>
          </div>
        </div>

        <div class="online-actions">
          <button class="panel-link online-primary-action" type="button" :disabled="creating" @click="createRoom">
            <Plus :size="18" />
            {{ creating ? "创建中" : "创建房间" }}
          </button>
          <label class="online-join-field">
            <span>房间码</span>
            <input
              v-model="roomCode"
              type="text"
              inputmode="text"
              maxlength="8"
              placeholder="例如 A7K2"
              @keydown.enter.prevent="joinRoom"
            />
          </label>
          <button class="pill-button" type="button" :disabled="joining" @click="joinRoom">
            加入房间
          </button>
        </div>

        <p v-if="error" class="online-error">{{ error }}</p>
      </article>

      <aside class="dashboard-panel online-profile-panel">
        <div class="panel-title">
          <Copy :size="19" />
          <span>玩家档案</span>
        </div>
        <label class="online-name-field">
          <span>昵称</span>
          <input v-model="playerName" type="text" maxlength="12" @blur="saveProfile" @keydown.enter.prevent="saveProfile" />
        </label>

        <div class="online-selected-skin" :style="{ '--skin': selectedSkin.body, '--skin-alt': selectedSkin.bodyAlt }">
          <img :src="selectedSkin.preview" alt="" />
          <div>
            <strong>{{ selectedSkin.name }}</strong>
            <span>{{ selectedSkin.subtitle }}</span>
          </div>
        </div>

        <div class="online-skin-grid" role="list" aria-label="联机贪吃蛇皮肤">
          <button
            v-for="skin in SNAKE_SKINS"
            :key="skin.id"
            class="online-skin-option"
            :class="{ active: selectedSkinId === skin.id }"
            type="button"
            role="listitem"
            :aria-label="skin.name"
            :aria-pressed="selectedSkinId === skin.id"
            @click="selectSkin(skin.id)"
          >
            <img :src="skin.preview" alt="" />
          </button>
        </div>

        <button class="pill-button online-copy-button" type="button" @click="copyJoinHint">
          <Copy :size="16" />
          复制大厅链接
        </button>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.online-page {
  width: min(1080px, calc(100vw - 32px));
}

.online-hero h1 {
  font-size: clamp(2.7rem, 8vw, 6.4rem);
}

.online-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
  gap: 14px;
  padding: 20px 0 0;
}

.online-room-panel,
.online-profile-panel {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 18px;
}

.online-game-title {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.online-game-title img {
  width: 72px;
  height: 72px;
  filter: drop-shadow(0 0 16px rgba(125, 255, 111, 0.46));
}

.online-game-title h2 {
  margin: 0;
  font-size: clamp(1.65rem, 4vw, 2.7rem);
  letter-spacing: 0;
}

.online-game-title p {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.6;
}

.online-actions {
  display: grid;
  grid-template-columns: auto minmax(180px, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.online-primary-action {
  gap: 7px;
  min-height: 42px;
  cursor: pointer;
}

.online-primary-action:disabled,
.online-actions .pill-button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.online-join-field,
.online-name-field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.online-join-field span,
.online-name-field span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 800;
}

.online-join-field input,
.online-name-field input {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(145, 235, 255, 0.24);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.72);
  color: var(--text);
  padding: 8px 10px;
  outline: none;
}

.online-join-field input {
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.online-join-field input:focus,
.online-name-field input:focus {
  border-color: var(--cyan);
  box-shadow: 0 0 0 3px rgba(83, 243, 255, 0.1);
}

.online-error {
  margin: 0;
  color: var(--danger);
  font-weight: 800;
}

.online-selected-skin {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--skin), transparent 62%);
  border-radius: var(--radius);
  background:
    linear-gradient(145deg, rgba(5, 10, 22, 0.7), rgba(5, 10, 22, 0.46)),
    linear-gradient(90deg, color-mix(in srgb, var(--skin), transparent 86%), transparent 54%);
}

.online-selected-skin img {
  width: 48px;
  height: 48px;
}

.online-selected-skin strong,
.online-selected-skin span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-selected-skin strong {
  color: var(--text);
}

.online-selected-skin span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.82rem;
}

.online-skin-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.online-skin-option {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.18);
  border-radius: var(--radius);
  background: rgba(3, 8, 18, 0.58);
  cursor: pointer;
}

.online-skin-option.active {
  border-color: rgba(83, 243, 255, 0.72);
  background: rgba(83, 243, 255, 0.12);
  box-shadow: inset 0 0 18px rgba(83, 243, 255, 0.08);
}

.online-skin-option img {
  width: 78%;
  height: 78%;
}

.online-copy-button {
  width: fit-content;
}

@media (max-width: 820px) {
  .online-grid,
  .online-actions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .online-game-title {
    grid-template-columns: 1fr;
  }

  .online-game-title img {
    width: 58px;
    height: 58px;
  }
}
</style>
