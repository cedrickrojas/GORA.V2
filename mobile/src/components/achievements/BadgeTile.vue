<template>
  <button
    type="button"
    class="badge-tile"
    :class="{ 'badge-tile--locked': !unlocked }"
    :aria-label="`${badge.name}, ${unlocked ? 'unlocked' : `${badge.progress} of ${badge.target}`}`"
    @click="emit('select', badge)"
  >
    <span class="badge-tile__medal">
      <ion-icon :icon="BADGE_ICONS[badge.icon]" aria-hidden="true" />
      <span v-if="!unlocked" class="badge-tile__lock" aria-hidden="true">
        <ion-icon :icon="lockClosed" />
      </span>
    </span>
    <span class="badge-tile__name">{{ badge.name }}</span>
    <span class="badge-tile__status">
      {{ unlocked ? 'Unlocked' : `${badge.progress} / ${badge.target}` }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { lockClosed } from 'ionicons/icons';
import type { Badge } from '@/types/achievement';
import { BADGE_ICONS, isBadgeUnlocked } from '@/utils/badges';

const props = defineProps<{ badge: Badge }>();
const emit = defineEmits<{ select: [badge: Badge] }>();

const unlocked = computed(() => isBadgeUnlocked(props.badge));
</script>

<style scoped>
.badge-tile {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
}

.badge-tile__medal {
  position: relative;
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ion-color-primary);
  box-shadow: 0 0 0 4px rgba(var(--ion-color-primary-rgb), 0.16);
  color: var(--ion-color-primary-contrast);
  font-size: 24px;
}

.badge-tile__lock {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--gora-surface);
  border-radius: 50%;
  background: #33414d;
  color: var(--gora-muted);
  font-size: 10px;
}

.badge-tile__name {
  overflow: hidden;
  max-width: 100%;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-tile__status {
  color: var(--ion-color-primary);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.badge-tile--locked {
  background: transparent;
}

.badge-tile--locked .badge-tile__medal {
  background: #1b2a37;
  box-shadow: none;
  color: #6d7b86;
}

.badge-tile--locked .badge-tile__name {
  color: var(--gora-muted);
}

.badge-tile--locked .badge-tile__status {
  color: #7d8a93;
  text-transform: none;
}
</style>
