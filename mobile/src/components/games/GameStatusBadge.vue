<template>
  <span class="game-status" :class="`game-status--${status.toLowerCase()}`">
    <ion-icon v-if="status === 'COMPLETED'" :icon="checkmarkCircle" aria-hidden="true" />
    {{ status === 'COMPLETED' ? 'Successful' : GAME_STATUS_LABELS[status] }}
  </span>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkCircle } from 'ionicons/icons';
import type { GameStatus } from '@/types/game';
import { GAME_STATUS_LABELS } from '@/utils/game-form';

defineProps<{ status: GameStatus }>();
</script>

<style scoped>
.game-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
  border: 1px solid #f4ca62;
  background: rgb(82 57 10 / 92%);
  color: #ffda72;
  box-shadow: 0 0 12px rgb(255 204 72 / 28%);
}

.game-status--completed ion-icon {
  font-size: 17px;
}
</style>
