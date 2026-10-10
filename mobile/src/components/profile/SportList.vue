<template>
  <ul class="sport-list">
    <li v-for="sport in sports" :key="sport.id" class="sport-list__item">
      <span
        class="sport-list__icon"
        :style="{ background: getSportVisual(sport.name).gradient }"
      >
        <ion-icon :icon="getSportVisual(sport.name).icon" aria-hidden="true" />
      </span>
      <span class="sport-list__text">
        <strong>{{ sport.name }}</strong>
        <span>{{ sport.role }}</span>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import type { SportProfile } from '@/types/profile';
import { getSportVisual } from '@/utils/sports';

defineProps<{ sports: readonly SportProfile[] }>();
</script>

<style scoped>
.sport-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sport-list__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}

.sport-list__icon {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: var(--gora-radius-card);
  font-size: 20px;
  color: var(--ion-color-primary);
}

.sport-list__text {
  display: flex;
  flex-direction: column;
  font-size: 0.95rem;
}

.sport-list__text span {
  color: var(--gora-muted);
  font-size: 0.78rem;
}
</style>
