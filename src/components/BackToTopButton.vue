<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { ArrowUp } from "lucide-vue-next";

const isVisible = ref(false);
let ticking = false;

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function updateVisibility() {
  isVisible.value = getScrollTop() > 420;
  ticking = false;
}

function handleScroll() {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(updateVisibility);
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

onMounted(() => {
  updateVisibility();
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <Transition name="back-to-top">
    <button
      v-show="isVisible"
      class="back-to-top-button"
      type="button"
      aria-label="返回顶部"
      title="返回顶部"
      @click="scrollToTop"
    >
      <ArrowUp :size="22" stroke-width="2.8" />
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top-button {
  position: fixed;
  right: max(18px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 40;
  display: inline-flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(83, 243, 255, 0.46);
  border-radius: var(--radius);
  background:
    linear-gradient(145deg, rgba(10, 24, 48, 0.92), rgba(6, 11, 24, 0.82)),
    radial-gradient(circle at 28% 18%, rgba(83, 243, 255, 0.22), transparent 48%);
  color: var(--cyan);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.36),
    0 0 22px rgba(83, 243, 255, 0.16),
    inset 0 0 18px rgba(83, 243, 255, 0.08);
  cursor: pointer;
  backdrop-filter: blur(14px);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.back-to-top-button:hover {
  border-color: rgba(255, 79, 216, 0.6);
  color: var(--text);
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.4),
    0 0 28px rgba(255, 79, 216, 0.22),
    inset 0 0 20px rgba(83, 243, 255, 0.12);
  transform: translateY(-3px);
}

.back-to-top-button:focus-visible {
  outline: 2px solid var(--yellow);
  outline-offset: 3px;
}

.back-to-top-enter-active,
.back-to-top-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

@media (max-width: 720px) {
  .back-to-top-button {
    right: max(14px, env(safe-area-inset-right));
    bottom: max(14px, env(safe-area-inset-bottom));
    width: 44px;
    height: 44px;
  }
}
</style>
