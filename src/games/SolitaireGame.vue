<script setup>
import { computed, ref } from "vue";
import GameLayout from "../components/GameLayout.vue";
import { getBestScore, setBestScore } from "../utils/storage";

const suits = ["♠", "♥", "♣", "♦"];
const deck = ref([]);
const waste = ref(null);
const foundations = ref({ "♠": 0, "♥": 0, "♣": 0, "♦": 0 });
const moves = ref(0);
const best = ref(getBestScore("solitaire"));
const status = ref("抽牌并收集到基座");
const score = computed(() => Object.values(foundations.value).reduce((sum, value) => sum + value, 0) * 10);

function makeDeck() {
  return suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ suit, rank: index + 1 })));
}

function shuffle(cards) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function restart() {
  deck.value = shuffle(makeDeck());
  waste.value = null;
  foundations.value = { "♠": 0, "♥": 0, "♣": 0, "♦": 0 };
  moves.value = 0;
  status.value = "抽牌并收集到基座";
}

function draw() {
  if (!deck.value.length) {
    status.value = "牌堆已空";
    return;
  }
  waste.value = deck.value.pop();
  moves.value += 1;
}

function collect(suit) {
  if (!waste.value || waste.value.suit !== suit || waste.value.rank !== foundations.value[suit] + 1) {
    status.value = "这张牌还不能放入基座";
    return;
  }
  foundations.value[suit] += 1;
  waste.value = null;
  moves.value += 1;
  best.value = setBestScore("solitaire", score.value);
  if (score.value >= 520) status.value = "全部收集完成";
  else status.value = "继续接龙";
}

restart();
</script>

<template>
  <GameLayout game-id="solitaire" :score="score" :best="best" :moves="moves" :status="status" @restart="restart">
    <section class="game-panel split-panel">
      <div class="board-shell">
        <div class="solitaire-table">
          <button class="card pile" type="button" @click="draw">{{ deck.length ? deck.length : "空" }}</button>
          <div class="card waste">{{ waste ? `${waste.suit}${waste.rank}` : "抽牌" }}</div>
          <button v-for="suit in suits" :key="suit" class="card foundation" type="button" @click="collect(suit)">
            {{ suit }} {{ foundations[suit] || "" }}
          </button>
        </div>
      </div>
      <aside class="control-panel">
        <h2>规则</h2>
        <p>点击牌堆抽牌。废牌只能按 A 到 K 的顺序放入对应花色基座。</p>
      </aside>
    </section>
  </GameLayout>
</template>

<style scoped>
.solitaire-table {
  display: grid;
  width: min(92vw, 620px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.card {
  display: grid;
  min-height: 140px;
  place-items: center;
  border: 1px solid rgba(145, 235, 255, 0.22);
  border-radius: var(--radius);
  background: rgba(12, 25, 49, 0.76);
  color: #ecfeff;
  font-size: clamp(1.4rem, 6vw, 2.5rem);
  font-weight: 900;
}

.pile {
  background: linear-gradient(135deg, rgba(83, 243, 255, 0.2), rgba(255, 79, 216, 0.18));
  cursor: pointer;
}

.foundation {
  cursor: pointer;
}

.waste {
  color: var(--yellow);
}
</style>
