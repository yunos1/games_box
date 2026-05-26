<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Play, Sparkles, Star } from "lucide-vue-next";
import { getDailyVariantForGame, getGameStarSummary } from "../utils/progress";

const props = defineProps({
  game: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    default: 0,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  status: {
    type: Object,
    default: null,
  },
  fromTab: {
    type: String,
    default: "",
  },
});

const starSummary = computed(() => getGameStarSummary(props.game.id));
const dailyVariant = computed(() => getDailyVariantForGame(props.game.id));
const linkTarget = computed(() =>
  props.fromTab
    ? {
        path: props.game.route,
        query: { fromTab: props.fromTab },
      }
    : props.game.route,
);
</script>

<template>
  <RouterLink
    class="game-card"
    :class="{ compact }"
    :to="linkTarget"
    :style="{ '--accent': game.accent, '--delay': `${index * 55}ms` }"
  >
    <div class="card-orbit" aria-hidden="true"></div>
    <div class="card-head">
      <img class="card-icon" :src="game.icon" alt="" />
      <div class="card-badges">
        <span v-if="status" class="card-status" :class="status.tone">{{ status.label }}</span>
        <span class="card-tag">{{ game.tag }}</span>
      </div>
    </div>
    <div class="card-body">
      <p>{{ game.subtitle }}</p>
      <h2>{{ game.title }}</h2>
      <span>{{ game.description }}</span>
    </div>
    <div class="card-progress-row">
      <span class="card-stars">
        <Star :size="15" />
        {{ starSummary.stars }}/{{ starSummary.total }}
      </span>
      <span v-if="dailyVariant" class="card-rule">
        <Sparkles :size="15" />
        今日
      </span>
    </div>
    <div class="card-foot">
      <span>{{ game.difficulty }}</span>
      <Play :size="18" />
    </div>
  </RouterLink>
</template>
