<script setup>
import { computed, ref } from "vue";
import {
  Brain,
  ChartNoAxesColumn,
  CheckCircle2,
  Circle,
  Flag,
  Gamepad2,
  Gift,
  LayoutGrid,
  Medal,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
} from "lucide-vue-next";
import GameCard from "../components/GameCard.vue";
import { games } from "../data/games";
import {
  getDailyChallenge,
  getDailyChallengeStatus,
  getDailyVariantHighlights,
  getDailyVariantStatus,
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
const actionTags = new Set(["动作", "反应", "街机"]);
const puzzleTags = new Set(["益智", "逻辑", "解谜", "推理"]);
const strategyCasualTags = new Set(["策略", "冒险", "消除", "休闲"]);
const recommendedGames = computed(() => {
  const ids = [challenge.gameId, ...dailyRules.map(({ game }) => game.id)];
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.map((id) => games.find((game) => game.id === id)).filter(Boolean).slice(0, 6);
});
const actionGames = computed(() => games.filter((game) => actionTags.has(game.tag)));
const puzzleGames = computed(() => games.filter((game) => puzzleTags.has(game.tag)));
const strategyCasualGames = computed(() => games.filter((game) => strategyCasualTags.has(game.tag)));
const tabs = computed(() => [
  { id: "featured", label: "推荐", icon: Sparkles, count: recommendedGames.value.length },
  { id: "all", label: "全部", icon: LayoutGrid, count: games.length },
  { id: "action", label: "动作街机", icon: Gamepad2, count: actionGames.value.length },
  { id: "puzzle", label: "益智解谜", icon: Brain, count: puzzleGames.value.length },
  { id: "strategy", label: "策略休闲", icon: Swords, count: strategyCasualGames.value.length },
  { id: "progress", label: "进度", icon: ChartNoAxesColumn, count: `${starTotal}/${starMax}` },
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
        <span>{{ tab.label }}</span>
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
        <GameCard v-for="(game, index) in recommendedGames" :key="game.id" :game="game" :index="index" />
      </section>
    </section>

    <section v-else-if="activeTab === 'all'" class="tab-panel" aria-label="全部游戏">
      <section class="tab-section-heading">
        <div>
          <p class="eyebrow">GAME LIBRARY</p>
          <h2>全部游戏</h2>
        </div>
        <span>{{ games.length }} 款</span>
      </section>
      <section class="game-grid" aria-label="全部游戏菜单">
        <GameCard v-for="(game, index) in games" :key="game.id" :game="game" :index="index" />
      </section>
    </section>

    <section v-else-if="activeTab === 'action'" class="tab-panel" aria-label="动作街机">
      <section class="tab-section-heading">
        <div>
          <p class="eyebrow">ARCADE</p>
          <h2>动作街机</h2>
        </div>
        <span>{{ actionGames.length }} 款</span>
      </section>
      <section class="game-grid" aria-label="动作街机游戏">
        <GameCard v-for="(game, index) in actionGames" :key="game.id" :game="game" :index="index" />
      </section>
    </section>

    <section v-else-if="activeTab === 'puzzle'" class="tab-panel" aria-label="益智解谜">
      <section class="tab-section-heading">
        <div>
          <p class="eyebrow">PUZZLE</p>
          <h2>益智解谜</h2>
        </div>
        <span>{{ puzzleGames.length }} 款</span>
      </section>
      <section class="game-grid" aria-label="益智解谜游戏">
        <GameCard v-for="(game, index) in puzzleGames" :key="game.id" :game="game" :index="index" />
      </section>
    </section>

    <section v-else-if="activeTab === 'strategy'" class="tab-panel" aria-label="策略休闲">
      <section class="tab-section-heading">
        <div>
          <p class="eyebrow">TACTICAL & CHILL</p>
          <h2>策略休闲</h2>
        </div>
        <span>{{ strategyCasualGames.length }} 款</span>
      </section>
      <section class="game-grid" aria-label="策略休闲游戏">
        <GameCard v-for="(game, index) in strategyCasualGames" :key="game.id" :game="game" :index="index" />
      </section>
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
