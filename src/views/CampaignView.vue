<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { ArrowLeft, CheckCircle2, Circle, Flag, Play, Star, Target, Trophy } from "lucide-vue-next";
import { getCampaignSummary, getQuestChain } from "../utils/campaign";

const campaign = computed(() => getCampaignSummary());
const quests = computed(() => getQuestChain());
</script>

<template>
  <main class="campaign-page">
    <div class="starfield" aria-hidden="true"></div>

    <section class="campaign-header">
      <RouterLink class="icon-button" to="/" aria-label="返回首页">
        <ArrowLeft :size="20" />
      </RouterLink>
      <div>
        <p class="eyebrow">LEVEL MAP</p>
        <h1>关卡地图</h1>
        <span>把小游戏串成路线，点亮关卡、补齐星级、继续下一步。</span>
      </div>
      <RouterLink v-if="campaign.nextNode" class="icon-button" :to="campaign.nextNode.game.route" aria-label="挑战下一关">
        <Play :size="20" />
      </RouterLink>
    </section>

    <section class="campaign-summary" aria-label="地图总览">
      <article class="dashboard-panel campaign-meter-card">
        <div class="panel-title">
          <Flag :size="19" />
          <span>地图进度</span>
        </div>
        <strong>{{ campaign.completed }}/{{ campaign.total }}</strong>
        <div class="marathon-progress" aria-hidden="true">
          <span :style="{ width: `${campaign.percent}%` }"></span>
        </div>
        <p>{{ campaign.nextNode ? `下一关：${campaign.nextNode.game.title}` : "所有路线都已点亮。" }}</p>
      </article>

      <article class="dashboard-panel campaign-next-card" :style="{ '--accent': campaign.nextNode?.game.accent || '#53f3ff' }">
        <div class="panel-title">
          <Target :size="19" />
          <span>当前推荐</span>
        </div>
        <h2>{{ campaign.nextNode?.game.title || "路线已完成" }}</h2>
        <p>{{ campaign.nextNode?.game.description || "可以回到任意路线补满星级。" }}</p>
        <RouterLink v-if="campaign.nextNode" class="panel-link" :to="campaign.nextNode.game.route">进入关卡</RouterLink>
      </article>

      <article class="dashboard-panel campaign-star-card">
        <div class="panel-title">
          <Trophy :size="19" />
          <span>星级总览</span>
        </div>
        <strong>{{ campaign.stars }}/{{ campaign.totalStars }}</strong>
        <span>{{ campaign.mastered }} 个关卡已满星</span>
      </article>
    </section>

    <section class="quest-chain" aria-label="任务链">
      <article
        v-for="quest in quests"
        :key="quest.id"
        class="dashboard-panel quest-card"
        :class="{ done: quest.done }"
        :style="{ '--accent': quest.accent }"
      >
        <div class="panel-title">
          <CheckCircle2 v-if="quest.done" :size="19" />
          <Circle v-else :size="19" />
          <span>{{ quest.title }}</span>
        </div>
        <p>{{ quest.detail }}</p>
        <div>
          <strong>{{ quest.progress }}</strong>
          <RouterLink class="panel-link" :to="quest.route">{{ quest.done ? "查看" : "去完成" }}</RouterLink>
        </div>
      </article>
    </section>

    <section class="campaign-chapters" aria-label="关卡路线">
      <article
        v-for="chapter in campaign.chapters"
        :key="chapter.id"
        class="dashboard-panel chapter-card"
        :style="{ '--accent': chapter.accent }"
      >
        <header class="chapter-head">
          <div>
            <p class="eyebrow">{{ chapter.eyebrow }}</p>
            <h2>{{ chapter.title }}</h2>
            <span>{{ chapter.detail }}</span>
          </div>
          <strong>{{ chapter.completed }}/{{ chapter.total }}</strong>
        </header>

        <div class="chapter-meter" aria-hidden="true">
          <span :style="{ width: `${chapter.percent}%` }"></span>
        </div>

        <div class="chapter-node-list">
          <RouterLink
            v-for="node in chapter.nodes"
            :key="node.game.id"
            class="chapter-node"
            :class="node.state"
            :to="node.game.route"
            :style="{ '--accent': node.game.accent }"
          >
            <div class="node-index">
              <CheckCircle2 v-if="node.completed" :size="18" />
              <Circle v-else :size="18" />
              <span>{{ node.index + 1 }}</span>
            </div>
            <img :src="node.game.icon" alt="" />
            <div class="node-copy">
              <strong>{{ node.game.title }}</strong>
              <span>{{ node.game.subtitle }} · {{ node.game.difficulty }}</span>
            </div>
            <div class="node-stars">
              <Star :size="15" />
              <span>{{ node.stars }}/{{ node.total }}</span>
            </div>
          </RouterLink>
        </div>
      </article>
    </section>
  </main>
</template>
