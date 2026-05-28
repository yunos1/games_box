<script setup>
import BackToTopButton from "./components/BackToTopButton.vue";
</script>

<template>
  <RouterView v-slot="{ Component }">
    <KeepAlive include="HomeView">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>
  <BackToTopButton />
</template>
