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
});

const starSummary = computed(() => getGameStarSummary(props.game.id));
const dailyVariant = computed(() => getDailyVariantForGame(props.game.id));
</script>

<template>
  <RouterLink
    class="game-card"
    :to="game.route"
    :style="{ '--accent': game.accent, '--delay': `${index * 55}ms` }"
  >
    <div class="card-orbit" aria-hidden="true"></div>
    <div class="card-head">
      <img class="card-icon" :src="game.icon" alt="" />
      <span class="card-tag">{{ game.tag }}</span>
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
