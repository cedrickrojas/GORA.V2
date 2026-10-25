<template>
  <router-link to="/reels" class="reel-thumb" :style="{ background: getSportVisual(reel.sport).gradient }">
    <ion-icon :icon="playCircle" class="reel-thumb__play" aria-hidden="true" />
    <span class="reel-thumb__info">
      <strong>{{ reel.author.displayName }}</strong>
      <span>
        <ion-icon :icon="eyeOutline" aria-hidden="true" />
        {{ formatCompactNumber(reel.views) }} · {{ reel.sport }}
      </span>
    </span>
  </router-link>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { eyeOutline, playCircle } from 'ionicons/icons';
import type { Reel } from '@/types/reel';
import { getSportVisual } from '@/utils/sports';
import { formatCompactNumber } from '@/utils/time';

defineProps<{ reel: Reel }>();
</script>

<style scoped>
.reel-thumb {
  position: relative;
  display: flex;
  aspect-ratio: 9 / 14;
  align-items: flex-end;
  overflow: hidden;
  border-radius: 14px;
  color: #fff;
  text-decoration: none;
}

.reel-thumb__play {
  position: absolute;
  top: 45%;
  left: 50%;
  color: rgba(255, 255, 255, 0.85);
  font-size: 34px;
  transform: translate(-50%, -50%);
}

.reel-thumb__info {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 2px;
  padding: 24px 8px 8px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.65), transparent);
  font-size: 0.72rem;
}

.reel-thumb__info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reel-thumb__info span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.66rem;
}
</style>
