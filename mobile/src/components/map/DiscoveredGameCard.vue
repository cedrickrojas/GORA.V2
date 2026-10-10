<template>
  <article class="found-game" :class="{ 'found-game--selected': highlighted }" :aria-label="game.title">
    <p class="found-game__sport">
      <span aria-hidden="true">{{ getSportMarker(game.sport.name) }}</span>
      {{ game.sport.name }}
      <GameStatusBadge :status="game.status" />
      <span v-if="badge" class="found-game__badge">{{ badge }}</span>
    </p>
    <h3 class="found-game__title">{{ game.title }}</h3>
    <p class="found-game__line"><span aria-hidden="true">🕕</span> {{ formatDiscoveryWhen(game) }}</p>
    <p class="found-game__line"><span aria-hidden="true">📍</span> {{ game.locationName }}</p>
    <p v-if="distanceText" class="found-game__line found-game__distance">{{ distanceText }}</p>
    <p class="found-game__line"><span aria-hidden="true">👥</span> {{ formatPlayersLine(game) }}</p>
    <p class="found-game__host">
      Hosted by
      <router-link :to="`/profile/${game.host.username}`">@{{ game.host.username }}</router-link>
      <span v-if="game.club"> · {{ game.club.name }}</span>
    </p>

    <div class="found-game__actions">
      <button type="button" class="found-game__button" @click="emit('view', game.id)">View Game</button>
      <button
        type="button"
        class="found-game__button found-game__button--primary"
        :disabled="joinAction.kind !== 'request' || busy"
        @click="emit('join', game.id)"
      >
        {{ joinLabel }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import GameStatusBadge from '@/components/games/GameStatusBadge.vue';
import type { DiscoveredGame } from '@/types/discovery';
import { formatDiscoveryWhen, formatDistanceAway, formatPlayersLine } from '@/utils/discovery-display';
import type { JoinRequestAction } from '@/utils/join-requests';
import { getSportMarker } from '@/utils/sports';

/** One discovered game: the map marker preview and the list row are the same card. */
const props = withDefaults(
  defineProps<{
    game: DiscoveredGame;
    joinAction: JoinRequestAction;
    busy?: boolean;
    highlighted?: boolean;
    badge?: string | null;
  }>(),
  { busy: false, highlighted: false, badge: null },
);
const emit = defineEmits<{ view: [gameId: string]; join: [gameId: string] }>();

const distanceText = computed(() => formatDistanceAway(props.game.distanceKm));

const JOIN_LABELS: Record<Exclude<JoinRequestAction['kind'], 'closed'>, string> = {
  request: 'Request to Join',
  pending: 'Request Pending',
  player: "You're playing",
  host: "You're hosting",
  declined: 'Request declined',
};

const joinLabel = computed(() => {
  if (props.busy) {
    return 'Sending…';
  }

  const action = props.joinAction;
  return action.kind === 'closed' ? action.label : JOIN_LABELS[action.kind];
});
</script>

<style scoped>
.found-game {
  padding: 14px;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
}

.found-game--selected {
  border-color: var(--ion-color-primary);
}

.found-game__sport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
}

.found-game__badge {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--ion-color-primary);
  border-radius: 999px;
  color: var(--ion-color-primary);
  font-size: 0.66rem;
  font-weight: 700;
}

.found-game__title {
  margin: 8px 0 6px;
  font-size: 1rem;
  font-weight: 700;
}

.found-game__line {
  margin: 0 0 3px;
  color: var(--gora-muted);
  font-size: 0.82rem;
}

.found-game__distance {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.found-game__host {
  margin: 8px 0 10px;
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.found-game__host a {
  color: var(--ion-text-color);
  font-weight: 600;
  text-decoration: none;
}

.found-game__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.found-game__button {
  padding: 9px 12px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
}

.found-game__button--primary {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.found-game__button:disabled {
  border-color: var(--gora-line);
  background: var(--gora-line);
  color: var(--gora-muted);
  cursor: default;
}
</style>
