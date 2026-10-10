<template>
  <article class="game-card">
    <div
      class="game-card__banner"
      :class="{
        'game-card__banner--basketball':
          game.sport.toLowerCase() === 'basketball',
      }"
      :style="{ backgroundColor: visual.gradient }"
    >
      <span class="game-card__sport">
        <ion-icon :icon="visual.icon" aria-hidden="true" />
        {{ game.sport }}
      </span>
      <span v-if="game.status !== 'OPEN'" class="game-card__flag">{{
        GAME_STATUS_FLAGS[game.status]
      }}</span>
    </div>

    <div class="game-card__body">
      <h3 class="game-card__title">{{ game.title }}</h3>
      <p class="game-card__meta">
        <ion-icon :icon="timeOutline" aria-hidden="true" />
        {{ formatStartTime(Date.parse(game.startsAt), nowMs) }}
      </p>
      <router-link
        :to="locationMapPath(game.location, game.id)"
        class="game-card__meta game-card__location"
        :aria-label="`Location: ${game.location.name}. Open map`"
      >
        <ion-icon :icon="locationOutline" aria-hidden="true" />
        {{ game.location.name }} ·
        {{ formatDistanceKm(game.location.distanceKm) }}
      </router-link>

      <p class="game-card__players">
        <span class="game-card__players-label">Players</span>
        <strong>{{ formatPlayerCount(game) }}</strong>
        <template v-if="game.status === 'OPEN'">
          · {{ getSpotsLeft(game) }} left</template
        >
      </p>

      <div class="game-card__footer">
        <router-link :to="`/games/${game.id}`" class="game-card__view"
          >View Game</router-link
        >
        <button
          v-if="game.status !== 'COMPLETED' && game.status !== 'CANCELLED'"
          type="button"
          class="game-card__action"
          :class="`game-card__action--${game.participation.toLowerCase()}`"
          :disabled="!canRequestToJoin(game)"
          @click="emit('join', game)"
        >
          {{
            game.status === 'FULL' && game.participation === 'NONE'
              ? 'Full'
              : PARTICIPATION_LABELS[game.participation]
          }}
        </button>
      </div>
      <p class="game-card__host">
        Hosted by {{ game.host.displayName }} · {{ game.skillLevel }}
      </p>
      <router-link
        v-if="game.club"
        :to="`/clubs/${game.club.id}`"
        class="game-card__club"
      >
        <ion-icon :icon="peopleCircleOutline" aria-hidden="true" />
        {{ game.club.name }}
      </router-link>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import {
  locationOutline,
  peopleCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import type { Game, GameStatus } from '@/types/game';
import {
  PARTICIPATION_LABELS,
  canRequestToJoin,
  formatPlayerCount,
  getSpotsLeft,
} from '@/utils/games';
import { locationMapPath } from '@/utils/location-map';
import { getSportVisual } from '@/utils/sports';
import { formatDistanceKm, formatStartTime } from '@/utils/time';

const GAME_STATUS_FLAGS: Record<GameStatus, string> = {
  OPEN: 'Open',
  FULL: 'Full',
  ACTIVE: 'Live now',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const props = defineProps<{ game: Game; nowMs: number }>();
const emit = defineEmits<{ join: [game: Game] }>();

const visual = computed(() => getSportVisual(props.game.sport));
</script>

<style scoped>
.game-card {
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  box-shadow: var(--gora-shadow);
}

.game-card__banner {
  display: flex;
  height: 120px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 10px 12px;
}

.game-card__banner--basketball {
  background-image:
    linear-gradient(0deg, rgba(0, 0, 0, 0.68), rgba(0, 0, 0, 0.12)),
    url('/images/gora-court-small.webp');
  background-size: cover;
  background-position: center 55%;
}

.game-card__sport,
.game-card__flag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--gora-radius-control);
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.72rem;
  font-weight: 700;
}

.game-card__body {
  padding: 16px;
}

.game-card__title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 700;
}

.game-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.game-card__location {
  width: fit-content;
  text-decoration: none;
}

.game-card__location:hover {
  color: var(--ion-text-color);
  text-decoration: underline;
}

.game-card__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.game-card__players {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 10px 0 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.game-card__players-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.game-card__players strong {
  color: var(--ion-text-color);
  font-size: 0.95rem;
}

.game-card__view {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: var(--gora-radius-control);
  color: var(--ion-text-color);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.game-card__action {
  flex: 1;
  padding: 8px 12px;
  border: 0;
  border-radius: var(--gora-radius-control);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
}

.game-card__action:disabled {
  cursor: default;
}

.game-card__action--requested {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--gora-muted);
}

.game-card__action--participant,
.game-card__action--host {
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.4);
  background: transparent;
  color: var(--ion-color-primary);
}

.game-card__action--none:disabled {
  background: #1b2a37;
  color: #7d8a93;
}

.game-card__host {
  margin: 10px 0 0;
  color: #7d8a93;
  font-size: 0.72rem;
}

.game-card__club {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: var(--ion-color-primary);
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
}
</style>
