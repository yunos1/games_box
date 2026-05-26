<script setup>
import { computed, ref } from "vue";
import {
  Brain,
  ChartNoAxesColumn,
  CheckCircle2,
  Clock3,
  Circle,
  Compass,
  Flag,
  Gamepad2,
  Gift,
  Grid2X2,
  LayoutGrid,
  List,
  Medal,
  Search,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  Zap,
} from "lucide-vue-next";
import GameCard from "../components/GameCard.vue";
import { games } from "../data/games";
import { getProgress } from "../utils/storage";
import {
  getDailyChallenge,
  getDailyChallengeStatus,
  getDailyVariantHighlights,
  getDailyVariantStatus,
  getGameStarSummary,
  getLeaderboardHighlights,
  getTotalStarCount,
  getUnlockedAchievements,
  getUnlockedRewards,
} from "../utils/progress";

const challenge = getDailyChallenge();
const challengeDone = getDailyChallengeStatus(challenge);
const dailyRules = getDailyVariantHighlights(4);
const leaderboard = getLeaderboardHighlights(5);
const achievements = getUnlockedAchievements();
const starTotal = getTotalStarCount();
const starMax = games.length * 3;
const rewards = getUnlockedRewards(starTotal);
const unlockedCount = computed(() => achievements.filter((item) => item.unlocked).length);
const rewardCount = computed(() => rewards.filter((item) => item.unlocked).length);
const activeTab = ref("featured");
const searchQuery = ref("");
const libraryView = ref("grid");
const progress = getProgress();
const gameProgress = progress.games || {};
const actionTags = new Set(["动作", "反应", "街机"]);
const puzzleTags = new Set(["益智", "逻辑", "解谜", "推理"]);
const strategyCasualTags = new Set(["策略", "冒险", "消除", "休闲"]);
const routeSeeds = {
  quick: ["guess-number", "link-link", "lights-out"],
  brain: ["sudoku", "laser-puzzle", "sokoban"],
  arcade: ["snake", "breakout", "plane-war"],
};

function findGames(ids) {
  return ids.map((id) => games.find((game) => game.id === id)).filter(Boolean);
}

function activityTime(game) {
  const entry = gameProgress[game.id] || {};
  return entry.lastResultAt || entry.lastPlayedAt || "";
}

function filterGames(list) {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return list;
  return list.filter((game) =>
    [game.title, game.subtitle, game.description, game.tag, game.difficulty].some((value) =>
      String(value).toLowerCase().includes(query),
    ),
  );
}

const recommendedGames = computed(() => {
  const ids = [challenge.gameId, ...dailyRules.map(({ game }) => game.id)];
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.map((id) => games.find((game) => game.id === id)).filter(Boolean).slice(0, 6);
});
const actionGames = computed(() => games.filter((game) => actionTags.has(game.tag)));
const puzzleGames = computed(() => games.filter((game) => puzzleTags.has(game.tag)));
const strategyCasualGames = computed(() => games.filter((game) => strategyCasualTags.has(game.tag)));
const librarySections = computed(() => [
  { id: "all", eyebrow: "GAME LIBRARY", title: "全部游戏", games },
  { id: "action", eyebrow: "ARCADE", title: "动作街机", games: actionGames.value },
  { id: "puzzle", eyebrow: "PUZZLE", title: "益智解谜", games: puzzleGames.value },
  { id: "strategy", eyebrow: "TACTICAL & CHILL", title: "策略休闲", games: strategyCasualGames.value },
]);
const activeLibrary = computed(() => librarySections.value.find((section) => section.id === activeTab.value) || null);
const filteredLibraryGames = computed(() => filterGames(activeLibrary.value?.games || []));
const recentlyPlayedGames = computed(() =>
  games
    .filter((game) => activityTime(game))
    .sort((a, b) => new Date(activityTime(b)) - new Date(activityTime(a)))
    .slice(0, 4),
);
const lastPlayedGame = computed(() => games.find((game) => game.id === progress.lastPlayed) || recentlyPlayedGames.value[0] || null);
const starFocus = computed(() => {
  const candidates = games
    .map((game) => {
      const summary = getGameStarSummary(game.id);
      return {
        game,
        ...summary,
        remaining: summary.total - summary.stars,
      };
    })
    .filter((item) => item.remaining > 0)
    .sort((a, b) => a.remaining - b.remaining || b.stars - a.stars || a.game.title.localeCompare(b.game.title, "zh-Hans-CN"));
  return candidates[0] || null;
});
const dailyProgress = computed(() => {
  const done = dailyRules.filter(({ game }) => getDailyVariantStatus(game.id)).length + (challengeDone ? 1 : 0);
  const total = dailyRules.length + 1;
  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
});
const playRoutes = computed(() => [
  {
    id: "quick",
    title: "轻松开局",
    detail: "短局、低压力，适合先热身。",
    icon: Zap,
    accent: "#53f3ff",
    games: findGames(routeSeeds.quick),
  },
  {
    id: "brain",
    title: "烧脑推进",
    detail: "逻辑、关卡和推演放在一条线里。",
    icon: Brain,
    accent: "#facc15",
    games: findGames(routeSeeds.brain),
  },
  {
    id: "arcade",
    title: "动作爽局",
    detail: "反应、节奏和即时反馈更集中。",
    icon: Gamepad2,
    accent: "#ff4fd8",
    games: findGames(routeSeeds.arcade),
  },
]);

function gameCardStatus(game) {
  const summary = getGameStarSummary(game.id);
  if (lastPlayedGame.value?.id === game.id) return { label: "继续", tone: "hot" };
  if (summary.stars >= summary.total) return { label: "满星", tone: "done" };
  if (summary.total - summary.stars === 1) return { label: "差一星", tone: "focus" };
  return null;
}

const tabs = computed(() => [
  { id: "featured", label: "推荐", shortLabel: "推荐", icon: Sparkles, count: recommendedGames.value.length },
  { id: "all", label: "全部", shortLabel: "全部", icon: LayoutGrid, count: games.length },
  { id: "action", label: "动作街机", shortLabel: "街机", icon: Gamepad2, count: actionGames.value.length },
  { id: "puzzle", label: "益智解谜", shortLabel: "解谜", icon: Brain, count: puzzleGames.value.length },
  { id: "strategy", label: "策略休闲", shortLabel: "策略", icon: Swords, count: strategyCasualGames.value.length },
  { id: "progress", label: "进度", shortLabel: "进度", icon: ChartNoAxesColumn, count: `${starTotal}/${starMax}` },
]);
</script>

<template>
  <main class="home-page">
    <div class="starfield" aria-hidden="true"></div>
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">SOLO ARCADE COLLECTION</p>
        <h1>NEON BOX</h1>
        <p class="hero-subtitle">打开即入局，每次挑战都会留下记录、点亮星级，并推进当天目标。</p>
      </div>
      <div class="command-strip" aria-hidden="true">
        <span>READY</span>
        <span>LOCAL SAVE</span>
        <span>PC + MOBILE</span>
      </div>
    </section>

    <nav class="home-tabs" aria-label="首页分类">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="home-tab-button"
        :class="{ active: activeTab === tab.id }"
        type="button"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="18" />
        <span class="home-tab-label home-tab-label-full">{{ tab.label }}</span>
        <span class="home-tab-label home-tab-label-short">{{ tab.shortLabel }}</span>
        <strong>{{ tab.count }}</strong>
      </button>
    </nav>

    <section v-if="activeTab === 'featured'" class="tab-panel" aria-label="推荐">
      <section class="home-dashboard compact-dashboard" aria-label="玩家控制台">
        <article class="dashboard-panel daily-panel" :style="{ '--accent': challenge.accent }">
          <div class="panel-title">
            <Target :size="19" />
            <span>今日挑战</span>
          </div>
          <div class="daily-core">
            <p>{{ challenge.title }}</p>
            <h2>{{ challenge.gameTitle }}</h2>
            <span>{{ challenge.detail }}</span>
          </div>
          <div class="daily-actions">
            <RouterLink class="panel-link" :to="challenge.gameRoute">开始挑战</RouterLink>
            <strong :class="{ done: challengeDone }">{{ challengeDone ? "已完成" : `${challenge.reward} XP` }}</strong>
          </div>
        </article>

        <RouterLink class="dashboard-panel marathon-panel" to="/marathon">
          <div class="panel-title">
            <Flag :size="19" />
            <span>街机马拉松</span>
          </div>
          <div class="marathon-core">
            <h2>今日 5 连战</h2>
            <p>按当天路线连续挑战 5 款游戏，完成后可重置再跑一轮。</p>
          </div>
          <div class="marathon-tags">
            <span>每日路线</span>
            <span>本地存档</span>
            <span>手动结算</span>
          </div>
        </RouterLink>
      </section>

      <section class="smart-dashboard" aria-label="智能入口">
        <RouterLink
          v-if="lastPlayedGame"
          class="dashboard-panel smart-card"
          :to="lastPlayedGame.route"
          :style="{ '--accent': lastPlayedGame.accent }"
        >
          <div class="panel-title">
            <Clock3 :size="19" />
            <span>继续上次</span>
          </div>
          <h2>{{ lastPlayedGame.title }}</h2>
          <p>{{ lastPlayedGame.description }}</p>
          <strong>继续挑战</strong>
        </RouterLink>
        <article v-else class="dashboard-panel smart-card" :style="{ '--accent': challenge.accent }">
          <div class="panel-title">
            <Clock3 :size="19" />
            <span>继续上次</span>
          </div>
          <h2>还没有记录</h2>
          <p>先完成任意一局，这里会自动出现最近游玩的入口。</p>
          <strong>等待首局</strong>
        </article>

        <RouterLink
          v-if="starFocus"
          class="dashboard-panel smart-card"
          :to="starFocus.game.route"
          :style="{ '--accent': starFocus.game.accent }"
        >
          <div class="panel-title">
            <Compass :size="19" />
            <span>星级冲刺</span>
          </div>
          <h2>{{ starFocus.game.title }}</h2>
          <p>已点亮 {{ starFocus.stars }}/{{ starFocus.total }} 星，再拿 {{ starFocus.remaining }} 星就能补完。</p>
          <strong>冲刺星级</strong>
        </RouterLink>

        <article class="dashboard-panel smart-card daily-progress-card" :style="{ '--accent': '#7dff6f' }">
          <div class="panel-title">
            <Target :size="19" />
            <span>今日进度</span>
          </div>
          <h2>{{ dailyProgress.done }}/{{ dailyProgress.total }}</h2>
          <p>今日挑战和规则变体会一起计入当天进度。</p>
          <div class="smart-meter" aria-hidden="true">
            <span :style="{ width: `${dailyProgress.percent}%` }"></span>
          </div>
        </article>
      </section>

      <section v-if="recentlyPlayedGames.length" class="recent-strip" aria-label="最近玩过">
        <span><Clock3 :size="16" />最近玩过</span>
        <RouterLink v-for="game in recentlyPlayedGames" :key="game.id" :to="game.route" :style="{ '--accent': game.accent }">
          {{ game.title }}
        </RouterLink>
      </section>

      <section class="route-dashboard" aria-label="玩法路线">
        <article
          v-for="route in playRoutes"
          :key="route.id"
          class="dashboard-panel route-card"
          :style="{ '--accent': route.accent }"
        >
          <div class="panel-title">
            <component :is="route.icon" :size="19" />
            <span>{{ route.title }}</span>
          </div>
          <p>{{ route.detail }}</p>
          <div class="route-game-list">
            <RouterLink v-for="game in route.games" :key="game.id" :to="game.route" :style="{ '--accent': game.accent }">
              <img :src="game.icon" alt="" />
              <span>{{ game.title }}</span>
            </RouterLink>
          </div>
        </article>
      </section>

      <section class="rule-dashboard" aria-label="今日规则变体">
        <RouterLink
          v-for="{ game, variant } in dailyRules"
          :key="`${game.id}-${variant.id}`"
          class="dashboard-panel rule-card"
          :class="{ done: getDailyVariantStatus(game.id) }"
          :style="{ '--accent': game.accent }"
          :to="game.route"
        >
          <div class="panel-title">
            <Sparkles :size="19" />
            <span>{{ game.title }}</span>
          </div>
          <strong>{{ getDailyVariantStatus(game.id) ? "已完成" : variant.title }}</strong>
          <span>{{ variant.detail }}</span>
        </RouterLink>
      </section>

      <section class="tab-section-heading">
        <div>
          <p class="eyebrow">QUICK START</p>
          <h2>今日推荐</h2>
        </div>
        <span>{{ recommendedGames.length }} 款</span>
      </section>
      <section class="game-grid compact-game-grid" aria-label="今日推荐游戏">
        <GameCard
          v-for="(game, index) in recommendedGames"
          :key="game.id"
          :game="game"
          :index="index"
          :status="gameCardStatus(game)"
        />
      </section>
    </section>

    <section v-else-if="activeLibrary" class="tab-panel" :aria-label="activeLibrary.title">
      <section class="tab-section-heading library-heading">
        <div>
          <p class="eyebrow">{{ activeLibrary.eyebrow }}</p>
          <h2>{{ activeLibrary.title }}</h2>
        </div>
        <span>{{ filteredLibraryGames.length }}/{{ activeLibrary.games.length }}</span>
      </section>

      <section class="library-toolbar" aria-label="游戏库工具">
        <label class="library-search">
          <Search :size="18" />
          <input v-model="searchQuery" type="search" placeholder="搜索游戏、类型或玩法" />
        </label>
        <div class="view-toggle" aria-label="视图切换">
          <button
            type="button"
            :class="{ active: libraryView === 'grid' }"
            aria-label="卡片视图"
            @click="libraryView = 'grid'"
          >
            <Grid2X2 :size="17" />
          </button>
          <button
            type="button"
            :class="{ active: libraryView === 'list' }"
            aria-label="列表视图"
            @click="libraryView = 'list'"
          >
            <List :size="17" />
          </button>
        </div>
      </section>

      <section
        v-if="filteredLibraryGames.length"
        class="game-grid"
        :class="{ 'list-game-grid': libraryView === 'list' }"
        :aria-label="`${activeLibrary.title}游戏`"
      >
        <GameCard
          v-for="(game, index) in filteredLibraryGames"
          :key="game.id"
          :game="game"
          :index="index"
          :compact="libraryView === 'list'"
          :status="gameCardStatus(game)"
        />
      </section>
      <div v-else class="empty-state library-empty">没有匹配的游戏</div>
    </section>

    <section v-else class="tab-panel progress-panel" aria-label="进度">
      <section class="progress-summary-grid">
        <article class="dashboard-panel star-total-panel">
          <div class="panel-title">
            <Star :size="19" />
            <span>星级进度</span>
          </div>
          <strong>{{ starTotal }}/{{ starMax }}</strong>
          <span>每款游戏都有 3 个目标，完成后会点亮卡片星级。</span>
        </article>

        <article class="dashboard-panel leaderboard-panel">
          <div class="panel-title">
            <Trophy :size="19" />
            <span>本地排行榜</span>
          </div>
          <ol v-if="leaderboard.length" class="leaderboard-list">
            <li v-for="entry in leaderboard" :key="`${entry.gameId}-${entry.score}-${entry.date}`">
              <span>{{ entry.game.title }}</span>
              <strong>{{ entry.score }}</strong>
            </li>
          </ol>
          <div v-else class="empty-state">暂无记录</div>
        </article>
      </section>

      <section class="feature-dashboard progress-detail-grid" aria-label="进度详情">
        <article class="dashboard-panel achievement-panel">
          <div class="panel-title">
            <Medal :size="19" />
            <span>成就 {{ unlockedCount }}/{{ achievements.length }}</span>
          </div>
          <div class="achievement-list">
            <div
              v-for="achievement in achievements"
              :key="achievement.id"
              class="achievement-item"
              :class="{ unlocked: achievement.unlocked }"
            >
              <CheckCircle2 v-if="achievement.unlocked" :size="17" />
              <Circle v-else :size="17" />
              <div>
                <strong>{{ achievement.title }}</strong>
                <span>{{ achievement.description }}</span>
              </div>
            </div>
          </div>
        </article>

        <article class="dashboard-panel reward-panel">
          <div class="panel-title">
            <Gift :size="19" />
            <span>星级奖励 {{ rewardCount }}/{{ rewards.length }}</span>
          </div>
          <div class="reward-list">
            <div v-for="reward in rewards" :key="reward.id" class="reward-row" :class="{ unlocked: reward.unlocked }">
              <CheckCircle2 v-if="reward.unlocked" :size="17" />
              <Circle v-else :size="17" />
              <div>
                <strong>{{ reward.title }}</strong>
                <span>{{ reward.description }}</span>
              </div>
              <em>{{ reward.progress }}/{{ reward.stars }}</em>
            </div>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>
