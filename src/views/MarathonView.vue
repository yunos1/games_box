<script setup>
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowLeft, CheckCircle2, Circle, Flag, Play, RotateCcw, Star, Trophy } from "lucide-vue-next";
import { getGameById } from "../data/games";
import { getSavedValue, setSavedValue } from "../utils/storage";
import { getGameStarSummary, getTodayKey } from "../utils/progress";

const MARATHON_KEY = "arcade-marathon";
const marathonPool = [
  "snake",
  "2048",
  "breakout",
  "plane-war",
  "tetris",
  "flappy-bird",
  "asteroid-dodge",
  "bubble-shooter",
  "boss-rush",
];
const stageLabels = ["开场热身", "节奏推进", "中段压力", "高能爆发", "终局冲刺"];

function hashString(value) {
  return [...value].reduce((hash, char) => (hash * 33 + char.charCodeAt(0)) % 1000003, 13);
}

function buildLineup(date) {
  return marathonPool
    .map((id, index) => {
      const game = getGameById(id);
      return game
        ? {
            game,
            seed: hashString(`${date}:${id}:${index}`),
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.seed - b.seed)
    .slice(0, 5)
    .map((item, index) => ({
      ...item.game,
      stage: index + 1,
      label: stageLabels[index],
      stars: getGameStarSummary(item.game.id).stars,
    }));
}

const today = getTodayKey();
const lineup = buildLineup(today);
const lineupIds = lineup.map((game) => game.id);

function initialState() {
  const saved = getSavedValue(MARATHON_KEY, null);
  if (saved?.date === today && Array.isArray(saved.completedIds) && saved.lineupIds?.join(",") === lineupIds.join(",")) {
    return saved;
  }
  return {
    date: today,
    lineupIds,
    completedIds: [],
    updatedAt: new Date().toISOString(),
  };
}

const runState = ref(initialState());

const completedCount = computed(() => lineup.filter((game) => runState.value.completedIds.includes(game.id)).length);
const currentStage = computed(() => lineup.find((game) => !runState.value.completedIds.includes(game.id)) || lineup[lineup.length - 1]);
const isComplete = computed(() => completedCount.value >= lineup.length);
const starCount = computed(() => lineup.reduce((total, game) => total + game.stars, 0));
const routeSeed = computed(() => hashString(`${today}:marathon`) % 9999);

function persist(nextState) {
  runState.value = {
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  setSavedValue(MARATHON_KEY, runState.value);
}

function toggleStage(gameId) {
  const completed = new Set(runState.value.completedIds);
  if (completed.has(gameId)) completed.delete(gameId);
  else completed.add(gameId);
  persist({
    ...runState.value,
    completedIds: lineupIds.filter((id) => completed.has(id)),
  });
}

function resetRun() {
  persist({
    date: today,
    lineupIds,
    completedIds: [],
  });
}
</script>

<template>
  <main class="marathon-page">
    <div class="starfield" aria-hidden="true"></div>

    <section class="marathon-header">
      <RouterLink class="icon-button" to="/" aria-label="返回首页">
        <ArrowLeft :size="20" />
      </RouterLink>
      <div>
        <p class="eyebrow">DAILY ARCADE RUN</p>
        <h1>街机马拉松</h1>
        <span>路线 #{{ routeSeed }} · {{ today }}</span>
      </div>
      <button class="icon-button" type="button" aria-label="重置马拉松" @click="resetRun">
        <RotateCcw :size="20" />
      </button>
    </section>

    <section class="marathon-summary" aria-label="马拉松进度">
      <article class="marathon-meter">
        <div class="panel-title">
          <Flag :size="19" />
          <span>今日进度</span>
        </div>
        <strong>{{ completedCount }}/{{ lineup.length }}</strong>
        <div class="marathon-progress" aria-hidden="true">
          <span :style="{ width: `${(completedCount / lineup.length) * 100}%` }"></span>
        </div>
        <p>{{ isComplete ? "今日路线已完成，可以重置再跑一轮。" : `下一关：${currentStage?.title}` }}</p>
      </article>

      <article class="marathon-next" :style="{ '--accent': currentStage?.accent }">
        <div class="panel-title">
          <Play :size="19" />
          <span>{{ isComplete ? "终点报告" : "下一关" }}</span>
        </div>
        <h2>{{ isComplete ? "今日 5 连战完成" : currentStage?.title }}</h2>
        <p>{{ isComplete ? "所有关卡都已打卡，星级路线会继续保留在本地。" : currentStage?.description }}</p>
        <RouterLink v-if="!isComplete && currentStage" class="panel-link" :to="currentStage.route">进入游戏</RouterLink>
        <button v-else class="panel-link as-button" type="button" @click="resetRun">重置路线</button>
      </article>

      <article class="marathon-prize">
        <div class="panel-title">
          <Trophy :size="19" />
          <span>路线强度</span>
        </div>
        <strong>{{ starCount }}</strong>
        <span>本路线已点亮星级总数</span>
      </article>
    </section>

    <section class="marathon-route" aria-label="今日马拉松路线">
      <article
        v-for="game in lineup"
        :key="game.id"
        class="marathon-stage"
        :class="{ done: runState.completedIds.includes(game.id), current: currentStage?.id === game.id && !isComplete }"
        :style="{ '--accent': game.accent }"
      >
        <div class="stage-index">
          <CheckCircle2 v-if="runState.completedIds.includes(game.id)" :size="20" />
          <Circle v-else :size="20" />
          <span>{{ game.stage }}</span>
        </div>

        <img class="stage-icon" :src="game.icon" alt="" />
        <div class="stage-copy">
          <p>{{ game.label }}</p>
          <h2>{{ game.title }}</h2>
          <span>{{ game.subtitle }} · {{ game.tag }} · {{ game.difficulty }}</span>
        </div>

        <div class="stage-stars">
          <Star :size="16" />
          <strong>{{ game.stars }}/3</strong>
        </div>

        <div class="stage-actions">
          <RouterLink class="pill-button primary" :to="game.route">挑战</RouterLink>
          <button class="pill-button" type="button" @click="toggleStage(game.id)">
            {{ runState.completedIds.includes(game.id) ? "取消" : "完成" }}
          </button>
        </div>
      </article>
    </section>
  </main>
</template>
