<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeft, CheckCircle2, Circle, RotateCcw, Pause, Play, Sparkles, Star, X } from "lucide-vue-next";
import { getGameById } from "../data/games";
import { getNextCampaignNode } from "../utils/campaign";
import { getDailyVariantForGame, getDailyVariantStatus, getGameStarSummary } from "../utils/progress";

const props = defineProps({
  gameId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "",
  },
  score: {
    type: [Number, String],
    default: null,
  },
  best: {
    type: [Number, String],
    default: null,
  },
  moves: {
    type: [Number, String],
    default: null,
  },
  paused: {
    type: Boolean,
    default: false,
  },
  showPause: {
    type: Boolean,
    default: false,
  },
  progressVersion: {
    type: Number,
    default: 0,
  },
  runResult: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["restart", "toggle-pause", "dismiss-result"]);
const route = useRoute();
const router = useRouter();
const homeTabIds = new Set(["featured", "all", "action", "puzzle", "strategy", "progress"]);
const normalizeHomeTab = (value) => {
  const tab = Array.isArray(value) ? value[0] : value;
  return typeof tab === "string" && homeTabIds.has(tab) ? tab : "";
};
const game = computed(() => getGameById(props.gameId));
const fromTab = computed(() => normalizeHomeTab(route.query.fromTab));
const homeTarget = computed(() => (fromTab.value ? { path: "/", query: { tab: fromTab.value } } : "/"));
const withFromTab = (routePath) => (fromTab.value ? { path: routePath, query: { fromTab: fromTab.value } } : routePath);
const goHome = () => {
  const previousPath = window.history.state?.back;
  if (typeof previousPath === "string" && previousPath.startsWith("/") && !previousPath.startsWith("/game/")) {
    router.back();
    return;
  }
  router.push(homeTarget.value);
};
const dailyVariant = computed(() => getDailyVariantForGame(props.gameId));
const dailyVariantDone = computed(() => {
  props.progressVersion;
  return getDailyVariantStatus(props.gameId);
});
const starSummary = computed(() => {
  props.progressVersion;
  return getGameStarSummary(props.gameId);
});
const compactMeta = ref(null);
const ruleMetaOpen = ref(false);
const starMetaOpen = ref(false);
let metaQuery;
const updateCompactMeta = () => {
  const nextCompact = Boolean(metaQuery?.matches);
  if (compactMeta.value === nextCompact) return;
  compactMeta.value = nextCompact;
  ruleMetaOpen.value = false;
  starMetaOpen.value = false;
};
const syncMetaOpen = (target, event) => {
  const isOpen = event.target.open;
  if (target === "rule") ruleMetaOpen.value = isOpen;
  if (target === "star") starMetaOpen.value = isOpen;
};
const stats = computed(() =>
  [
    props.score !== null ? { label: "分数", value: props.score } : null,
    props.best !== null ? { label: "最佳", value: props.best } : null,
    props.moves !== null ? { label: "步数", value: props.moves } : null,
  ].filter(Boolean),
);
const nextCampaignNode = computed(() => {
  props.progressVersion;
  return getNextCampaignNode(props.gameId);
});
const nextCampaignTarget = computed(() =>
  nextCampaignNode.value ? withFromTab(nextCampaignNode.value.game.route) : "",
);
const nextActionLabel = computed(() => (nextCampaignNode.value?.game.id === props.gameId ? "继续补星" : "下一关"));

onMounted(() => {
  metaQuery = window.matchMedia("(max-width: 860px)");
  updateCompactMeta();
  metaQuery.addEventListener("change", updateCompactMeta);
});

onUnmounted(() => {
  metaQuery?.removeEventListener("change", updateCompactMeta);
});
</script>

<template>
  <main class="game-shell">
    <div class="starfield" aria-hidden="true"></div>
    <section class="game-frame">
      <header class="game-topbar">
        <button class="icon-button" type="button" aria-label="返回首页" @click="goHome">
          <ArrowLeft :size="20" />
        </button>
        <div class="game-title-wrap">
          <img v-if="game" class="game-mini-icon" :src="game.icon" alt="" />
          <div>
            <p class="game-kicker">{{ game?.subtitle }}</p>
            <h1>{{ game?.title }}</h1>
          </div>
        </div>
        <div class="game-actions">
          <button v-if="showPause" class="icon-button" type="button" :aria-label="paused ? '继续' : '暂停'" @click="emit('toggle-pause')">
            <Play v-if="paused" :size="20" />
            <Pause v-else :size="20" />
          </button>
          <button class="icon-button" type="button" aria-label="重新开始" @click="emit('restart')">
            <RotateCcw :size="20" />
          </button>
        </div>
      </header>

      <div class="game-hud-row">
        <div class="game-info-row">
          <div v-for="item in stats" :key="item.label" class="stat-chip">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
          <div v-if="status" class="status-chip">{{ status }}</div>
        </div>

        <div class="game-meta-row">
          <details
            v-if="dailyVariant"
            class="game-rule-card game-meta-card"
            :class="{ done: dailyVariantDone }"
            :open="ruleMetaOpen"
            @toggle="syncMetaOpen('rule', $event)"
          >
            <summary class="mini-panel-title">
              <Sparkles :size="17" />
              <strong>今日规则</strong>
              <span>{{ dailyVariantDone ? "已完成" : dailyVariant.title }}</span>
            </summary>
            <p>{{ dailyVariant.detail }}</p>
          </details>

          <details class="game-star-card game-meta-card" :open="starMetaOpen" @toggle="syncMetaOpen('star', $event)">
            <summary class="mini-panel-title">
              <Star :size="17" />
              <strong>星级目标</strong>
              <span>{{ starSummary.stars }}/{{ starSummary.total }}</span>
            </summary>
            <div class="star-goal-list">
              <div
                v-for="goal in starSummary.goals"
                :key="goal.id"
                class="star-goal-item"
                :class="{ unlocked: goal.unlocked }"
              >
                <CheckCircle2 v-if="goal.unlocked" :size="16" />
                <Circle v-else :size="16" />
                <div>
                  <strong>{{ goal.title }}</strong>
                  <span>{{ goal.description }}</span>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div class="game-content">
        <slot />
      </div>

      <div v-if="runResult" class="result-backdrop" role="dialog" aria-modal="true" aria-label="本局结算">
        <section class="result-modal">
          <button class="icon-button result-close" type="button" aria-label="关闭结算" @click="emit('dismiss-result')">
            <X :size="18" />
          </button>
          <div class="result-header">
            <p class="game-kicker">RUN REPORT</p>
            <h2>{{ runResult.title || "本局结算" }}</h2>
            <span>{{ runResult.detail || "继续挑战下一颗星。" }}</span>
          </div>

          <div class="result-stats">
            <div v-for="item in runResult.stats || []" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>

          <div class="result-flags">
            <span v-if="runResult.variantCompleted" class="result-flag done">今日规则完成</span>
            <span v-if="runResult.newGoals?.length" class="result-flag">新目标 +{{ runResult.newGoals.length }}</span>
            <span class="result-flag">{{ runResult.stars || 0 }}/{{ runResult.total || 3 }} 星</span>
          </div>

          <div v-if="runResult.goals?.length" class="result-goals">
            <div v-for="goal in runResult.goals" :key="goal.id" :class="{ unlocked: goal.unlocked }">
              <CheckCircle2 v-if="goal.unlocked" :size="16" />
              <Circle v-else :size="16" />
              <div>
                <strong>{{ goal.title }}</strong>
                <span>{{ goal.description }}</span>
              </div>
            </div>
          </div>

          <RouterLink
            v-if="nextCampaignNode"
            class="result-next-card"
            :to="nextCampaignTarget"
            :style="{ '--accent': nextCampaignNode.game.accent }"
          >
            <img :src="nextCampaignNode.game.icon" alt="" />
            <div>
              <span>{{ nextActionLabel }}</span>
              <strong>{{ nextCampaignNode.game.title }}</strong>
              <p>{{ nextCampaignNode.game.description }}</p>
            </div>
            <Play :size="18" />
          </RouterLink>

          <div class="result-actions">
            <button class="pill-button primary" type="button" @click="emit('restart')">再来一局</button>
            <button class="pill-button" type="button" @click="emit('dismiss-result')">继续查看</button>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
