<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const levels = {
  easy: { label: "入门", min: 1, max: 50, attempts: 8 },
  normal: { label: "标准", min: 1, max: 100, attempts: 10 },
  hard: { label: "硬核", min: 1, max: 500, attempts: 12 },
};

const level = ref("normal");
const secret = ref(0);
const guess = ref("");
const attempts = ref(0);
const history = ref([]);
const historyId = ref(0);
const status = ref("");
const finished = ref(false);
const best = ref(getBestScore("guess-number"));

const config = computed(() => levels[level.value]);
const remaining = computed(() => Math.max(config.value.attempts - attempts.value, 0));
const score = computed(() => (finished.value && status.value.includes("解码成功") ? Math.max(1, remaining.value + 1) : 0));

function restart() {
  const { min, max } = config.value;
  secret.value = Math.floor(Math.random() * (max - min + 1)) + min;
  guess.value = "";
  attempts.value = 0;
  history.value = [];
  historyId.value = 0;
  finished.value = false;
  status.value = `目标范围 ${min}-${max}`;
}

function submitGuess() {
  if (finished.value) return;
  const value = Number(guess.value);
  if (!Number.isInteger(value) || value < config.value.min || value > config.value.max) {
    status.value = "请输入有效范围内的整数";
    return;
  }

  attempts.value += 1;
  let hint = "命中";
  if (value > secret.value) hint = "偏大";
  if (value < secret.value) hint = "偏小";
  history.value.unshift({ id: historyId.value, value, hint });
  historyId.value += 1;

  if (value === secret.value) {
    finished.value = true;
    status.value = `解码成功，用了 ${attempts.value} 次`;
    best.value = setBestScore("guess-number", score.value);
  } else if (attempts.value >= config.value.attempts) {
    finished.value = true;
    status.value = `次数耗尽，答案是 ${secret.value}`;
  } else {
    status.value = `${hint}，还剩 ${remaining.value} 次`;
  }
  guess.value = "";
}

restart();
</script>

<template>
  <GameLayout
    game-id="guess-number"
    :score="score"
    :best="best"
    :moves="attempts"
    :status="status"
    @restart="restart"
  >
    <section class="game-panel split-panel">
      <div class="guess-console">
        <div class="target-ring">
          <span>{{ config.min }}</span>
          <strong>?</strong>
          <span>{{ config.max }}</span>
        </div>
        <form class="guess-form" @submit.prevent="submitGuess">
          <label class="field">
            <span>输入你的数字</span>
            <input
              v-model.number="guess"
              inputmode="numeric"
              type="number"
              :min="config.min"
              :max="config.max"
              :disabled="finished"
              placeholder="锁定目标"
            />
          </label>
          <button class="pill-button primary" type="submit" :disabled="finished">确认解码</button>
        </form>
      </div>

      <aside class="control-panel">
        <h2>难度</h2>
        <div class="segmented">
          <button
            v-for="(item, key) in levels"
            :key="key"
            type="button"
            :class="{ active: level === key }"
            @click="level = key; restart()"
          >
            {{ item.label }}
          </button>
        </div>
        <p>剩余次数：{{ remaining }}</p>
        <div class="history-list">
          <div v-for="item in history" :key="item.id">
            <strong>{{ item.value }}</strong>
            <span>{{ item.hint }}</span>
          </div>
        </div>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.guess-console {
  display: grid;
  gap: 14px;
  align-content: center;
  height: 100%;
  min-height: 0;
  padding: 14px;
  border: 1px solid rgba(145, 235, 255, 0.16);
  border-radius: var(--radius);
  background: radial-gradient(circle at center, rgba(83, 243, 255, 0.14), rgba(5, 10, 22, 0.78) 52%);
}

.target-ring {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  justify-items: center;
}

.target-ring strong {
  display: grid;
  width: min(52vw, 42cqh, 260px);
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgba(83, 243, 255, 0.42);
  border-radius: 50%;
  color: var(--cyan);
  font-size: 6rem;
  line-height: 1;
  text-shadow: 0 0 24px rgba(83, 243, 255, 0.8);
}

.target-ring span {
  color: var(--muted);
  font-weight: 900;
}

.guess-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}

.history-list {
  display: grid;
  gap: 6px;
  max-height: min(220px, 34svh);
  overflow: auto;
}

.history-list div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(145, 235, 255, 0.16);
  border-radius: var(--radius);
  background: rgba(5, 10, 22, 0.6);
}

.history-list span {
  color: var(--yellow);
}

@media (max-width: 640px) {
  .guess-console {
    height: 100%;
    min-height: 0;
    gap: 12px;
    padding: 14px;
  }

  .guess-form {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .target-ring {
    gap: 10px;
  }

  .target-ring strong {
    width: min(42vw, 34svh, 170px);
    font-size: 4rem;
  }

  .history-list {
    max-height: 120px;
  }
}
</style>
