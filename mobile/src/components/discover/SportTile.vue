<template>
  <button
    type="button"
    class="sport-tile"
    :style="{ background: visual.gradient }"
    @click="emit('select', sport)"
  >
    <span class="sport-tile__name">{{ sport.name }}</span>
    <span v-if="showStats" class="sport-tile__stats"
      >{{ sport.openGames }} open games</span
    >
    <ion-icon :icon="visual.icon" class="sport-tile__icon" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import type { SportCategory } from '@/types/sport';
import { getSportVisual } from '@/utils/sports';

const props = withDefaults(
  defineProps<{ sport: SportCategory; showStats?: boolean }>(),
  {
    showStats: false,
  },
);
const emit = defineEmits<{ select: [sport: SportCategory] }>();

const visual = computed(() => getSportVisual(props.sport.name));
</script>

<style scoped>
.sport-tile {
  position: relative;
  display: flex;
  min-height: 92px;
  flex-direction: column;
  align-items: flex-start;
  overflow: hidden;
  padding: 16px;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  color: #fff;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.sport-tile__name {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.sport-tile__stats {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.72rem;
}

.sport-tile__icon {
  position: absolute;
  right: 14px;
  bottom: 14px;
  color: var(--ion-color-primary);
  font-size: 27px;
}

@media (hover: hover) {
  .sport-tile:hover {
    border-color: var(--gora-accent-line);
    box-shadow: var(--gora-shadow);
  }
}
</style>
