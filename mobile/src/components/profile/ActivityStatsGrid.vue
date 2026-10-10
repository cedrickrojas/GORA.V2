<template>
  <ul class="activity-stats">
    <li v-for="item in items" :key="item.metric" class="activity-stats__item">
      <ion-icon :icon="item.icon" class="activity-stats__icon" aria-hidden="true" />
      <span class="activity-stats__value">{{ item.value }}</span>
      <span class="activity-stats__label">{{ item.label }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import type { ActivityStats } from '@/types/activity';
import { toActivityStatItems } from '@/utils/activity';

const props = defineProps<{ stats: ActivityStats }>();

const items = computed(() => toActivityStatItems(props.stats));
</script>

<style scoped>
.activity-stats {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
}

.activity-stats__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 12px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}

.activity-stats__item:last-child:nth-child(3n + 1) {
  grid-column: 1 / -1;
}

.activity-stats__icon {
  margin-bottom: 6px;
  color: var(--ion-color-primary);
  font-size: 18px;
}

.activity-stats__value {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.activity-stats__label {
  color: var(--gora-muted);
  font-size: 0.72rem;
}
</style>
