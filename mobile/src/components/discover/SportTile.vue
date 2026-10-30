<template>
  <button
    type="button"
    class="sport-tile"
    @click="emit('select', sport)"
  >
    <img :src="imageUrl" alt="" class="sport-tile__image" loading="lazy" decoding="async" />
    <span class="sport-tile__name">{{ sport.name }}</span>
    <span v-if="showStats" class="sport-tile__stats"
      >{{ sport.openGames }} open games</span
    >
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SportCategory } from '@/types/sport';
import { getSportImage } from '@/utils/sports';

const props = withDefaults(
  defineProps<{ sport: SportCategory; showStats?: boolean }>(),
  {
    showStats: false,
  },
);
const emit = defineEmits<{ select: [sport: SportCategory] }>();

const imageUrl = computed(() => getSportImage(props.sport.name));
</script>

<style scoped>
.sport-tile {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 128px;
  aspect-ratio: 4 / 3;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  overflow: hidden;
  padding: 16px;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface-raised);
  color: #fff;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.sport-tile::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.02) 20%, rgba(0, 0, 0, 0.82) 100%);
  content: '';
  pointer-events: none;
}

.sport-tile__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 65% center;
}

.sport-tile__name {
  position: relative;
  z-index: 1;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.sport-tile__stats {
  position: relative;
  z-index: 1;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.72rem;
}

@media (hover: hover) {
  .sport-tile:hover {
    border-color: var(--gora-accent-line);
    box-shadow: var(--gora-shadow);
  }
}
</style>
