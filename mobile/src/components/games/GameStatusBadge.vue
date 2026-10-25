<template>
  <span class="game-status" :class="`game-status--${status.toLowerCase()}`">{{ GAME_STATUS_LABELS[status] }}</span>
</template>

<script setup lang="ts">
import type { GameStatus } from '@/types/game';
import { GAME_STATUS_LABELS } from '@/utils/game-form';

defineProps<{ status: GameStatus }>();
</script>

<style scoped>
.game-status {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.game-status--open {
  color: var(--ion-color-primary);
}

.game-status--full {
  color: #f5b942;
}

.game-status--active {
  color: #5bd1ef;
}

.game-status--cancelled {
  color: #ef5b5b;
}

.game-status--completed {
  color: #b7c1c8;
}
</style>
