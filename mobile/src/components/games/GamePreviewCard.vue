<template>
  <article
    class="game-preview"
    :class="{
      'game-preview--cancelled': game.status === 'CANCELLED',
      'game-preview--successful': game.status === 'COMPLETED',
    }"
  >
    <div
      class="game-preview__banner"
      :class="{
        'game-preview__banner--basketball':
          game.sport.name.toLowerCase() === 'basketball',
      }"
      :style="{ backgroundColor: visual.gradient }"
    >
      <span class="game-preview__sport">
        <SportIcon
          :name="game.sport.name"
          :icon-url="game.sport.iconUrl"
          :size="20"
        />
        {{ game.sport.name }}
      </span>
      <GameStatusBadge :status="game.status" />
    </div>

    <div class="game-preview__body">
      <h3 class="game-preview__title">{{ game.title }}</h3>
      <p
        v-if="showDescription && game.description"
        class="game-preview__description"
      >
        {{ game.description }}
      </p>

      <p class="game-preview__meta">
        <ion-icon :icon="calendarOutline" aria-hidden="true" />
        {{ formatGameDay(game.gameDate) }}
      </p>
      <p class="game-preview__meta">
        <ion-icon :icon="timeOutline" aria-hidden="true" />
        {{ formatGameTimeRange(game.startTime, game.endTime) }}
      </p>
      <p class="game-preview__meta">
        <ion-icon :icon="locationOutline" aria-hidden="true" />
        {{ game.locationName }}
      </p>

      <p class="game-preview__players">
        <span class="game-preview__players-label">Players</span>
        <strong>{{ game.currentPlayers }}/{{ game.requiredPlayers }}</strong>
      </p>
      <div
        class="game-preview__bar"
        role="progressbar"
        :aria-valuenow="game.currentPlayers"
        aria-valuemin="0"
        :aria-valuemax="game.requiredPlayers"
      >
        <span
          :style="{
            width: `${(game.currentPlayers / game.requiredPlayers) * 100}%`,
          }"
        />
      </div>

      <p class="game-preview__host">
        Hosted by
        <router-link :to="`/profile/${game.host.username}`"
          >@{{ game.host.username }}</router-link
        >
      </p>
      <router-link
        v-if="game.club"
        :to="`/clubs/${game.club.id}`"
        class="game-preview__club"
      >
        <ion-icon :icon="peopleCircleOutline" aria-hidden="true" />
        {{ game.club.name }}
      </router-link>

      <router-link :to="`/games/${game.id}`" class="game-preview__view"
        >View Game</router-link
      >
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import {
  calendarOutline,
  locationOutline,
  peopleCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import SportIcon from '@/components/sports/SportIcon.vue';
import type { ApiGame } from '@/types/game';
import { formatGameDay, formatGameTimeRange } from '@/utils/game-form';
import { getSportVisual } from '@/utils/sports';
import GameStatusBadge from './GameStatusBadge.vue';

const props = withDefaults(
  defineProps<{ game: ApiGame; showDescription?: boolean }>(),
  {
    showDescription: true,
  },
);

const visual = computed(() => getSportVisual(props.game.sport.name));
</script>

<style scoped>
.game-preview {
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  box-shadow: var(--gora-shadow);
}

.game-preview--cancelled {
  filter: grayscale(0.78);
  opacity: 0.72;
}

.game-preview--successful {
  border: 2px solid #d8ad43;
  box-shadow: 0 0 0 2px rgb(216 173 67 / 16%), 0 8px 24px rgb(216 173 67 / 16%);
}

.game-preview__banner {
  display: flex;
  height: 120px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 10px 12px;
}

.game-preview__banner--basketball {
  background-image:
    linear-gradient(0deg, rgba(0, 0, 0, 0.68), rgba(0, 0, 0, 0.12)),
    url('/images/gora-court-small.webp');
  background-size: cover;
  background-position: center 55%;
}

.game-preview__sport {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.72rem;
  font-weight: 700;
}

.game-preview__body {
  padding: 16px;
}

.game-preview__title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 700;
}

.game-preview__description {
  margin: 0 0 8px;
  color: var(--gora-muted);
  font-size: 0.85rem;
  white-space: pre-line;
}

.game-preview__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
  color: var(--gora-muted);
  font-size: 0.82rem;
}

.game-preview__players {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 10px 0 6px;
}

.game-preview__players-label {
  color: var(--gora-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.game-preview__players strong {
  font-size: 0.95rem;
}

.game-preview__bar {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--gora-line);
}

.game-preview__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ion-color-primary);
}

.game-preview__host {
  margin: 10px 0 0;
  color: #7d8a93;
  font-size: 0.74rem;
}

.game-preview__host a {
  color: var(--ion-text-color);
  font-weight: 600;
  text-decoration: none;
}

.game-preview__club {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: var(--ion-color-primary);
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
}

.game-preview__view {
  display: block;
  margin-top: 12px;
  padding: 9px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: var(--gora-radius-control);
  color: var(--ion-text-color);
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}
</style>
