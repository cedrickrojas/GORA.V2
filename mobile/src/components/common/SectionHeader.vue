<template>
  <header class="section-header">
    <h2 class="section-header__title">{{ title }}</h2>
    <slot />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-header__title {
  margin: 0;
  color: var(--ion-text-color);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
