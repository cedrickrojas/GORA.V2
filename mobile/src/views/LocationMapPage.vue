<template>
  <ion-page>
    <SubPageHeader title="Map" back-href="/home" />

    <ion-content :fullscreen="true">
      <p v-if="!parsed" class="map__missing">This location could not be opened.</p>

      <div v-else class="map">
        <header class="map__heading">
          <h1 class="map__title"><span aria-hidden="true">📍</span> {{ parsed.center.name }}</h1>
          <p class="map__subtitle">GORA games within {{ NEARBY_ACTIVITY_RADIUS_KM }} km</p>
        </header>

        <GameDiscoveryMap
          :games="games"
          :center="parsed.center"
          :radius-km="NEARBY_ACTIVITY_RADIUS_KM"
          :selected-game-id="selectedGameId"
          :loading="status === 'loading'"
          :error="error"
          :busy-game-id="busyGameId"
          :badge-game-id="parsed.selectedGameId"
          badge-text="Selected game"
          :join-action-of="joinActionOf"
          @select="selectedGameId = $event"
          @view="viewGame"
          @join="openJoin"
        />

        <section class="map__nearby" aria-label="Nearby GORA Games">
          <h2 class="map__nearby-title">Nearby GORA Games</h2>
          <div v-if="status === 'loading'" class="map__skeleton" aria-hidden="true">
            <ion-skeleton-text :animated="true" class="map__skeleton-line" />
            <ion-skeleton-text :animated="true" class="map__skeleton-line map__skeleton-line--short" />
          </div>
          <p v-else-if="status === 'ready' && games.length === 0" class="map__empty">
            No GORA games found nearby. Markers only show games created on GORA, not every venue.
          </p>
          <DiscoveredGameCard
            v-for="game in status === 'loading' ? [] : games"
            :key="game.id"
            :game="game"
            :join-action="joinActionOf(game)"
            :busy="busyGameId === game.id"
            :highlighted="game.id === selectedGameId"
            :badge="game.id === parsed.selectedGameId ? 'Selected game' : null"
            @view="viewGame"
            @join="openJoin"
          />
        </section>
      </div>

      <JoinRequestModal
        :is-open="joiningGame !== null"
        :game-title="joiningGame?.title ?? ''"
        :host-name="joiningGame?.host.displayName ?? ''"
        :is-submitting="busyGameId !== null"
        :error="joinError"
        @close="closeJoin"
        @send="sendJoin"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonPage, IonSkeletonText } from '@ionic/vue';
import JoinRequestModal from '@/components/games/JoinRequestModal.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import DiscoveredGameCard from '@/components/map/DiscoveredGameCard.vue';
import GameDiscoveryMap from '@/components/map/GameDiscoveryMap.vue';
import { useDiscoveryJoin } from '@/composables/useDiscoveryJoin';
import { useDiscoveryStore } from '@/stores/discovery';
import { useGamesStore } from '@/stores/games';
import type { LoadStatus } from '@/stores/sports';
import type { DiscoveredGame } from '@/types/discovery';
import type { ApiGame } from '@/types/game';
import { isServerGameId } from '@/utils/game-form';
import { NEARBY_ACTIVITY_RADIUS_KM, SAME_PLACE_KM, distanceBetweenKm, gamePoint, parseLocationMapRoute } from '@/utils/location-map';

const route = useRoute();
const router = useRouter();
const discovery = useDiscoveryStore();
const gamesStore = useGamesStore();

// Ionic keeps one page per path; only query changes on this page's own path are applied here.
const ownPath = route.path;
const parsed = ref(parseLocationMapRoute(route.params, route.query));
const games = ref<DiscoveredGame[]>([]);
const status = ref<LoadStatus>('idle');
const error = ref<string | null>(null);
const selectedGameId = ref<string | null>(null);

const { joiningGame, joinError, busyGameId, joinActionOf, openJoin, closeJoin, sendJoin } = useDiscoveryJoin(
  games,
  (gameId) => {
    games.value = games.value.map((game) => (game.id === gameId ? { ...game, myJoinRequestStatus: 'PENDING' } : game));
  },
);

/** The game the user came from, as a map result. Its distance is not measured here. */
function fromApiGame(game: ApiGame): DiscoveredGame {
  return {
    id: game.id,
    title: game.title,
    sport: game.sport,
    host: game.host,
    club: game.club ? { id: game.club.id, name: game.club.name } : null,
    gameDate: game.gameDate,
    startTime: game.startTime,
    endTime: game.endTime,
    locationName: game.locationName,
    latitude: game.latitude,
    longitude: game.longitude,
    distanceKm: null,
    currentPlayers: game.currentPlayers,
    requiredPlayers: game.requiredPlayers,
    remainingSlots: game.remainingSlots,
    status: game.status,
    isHost: game.isHost,
    isPlayer: game.isPlayer,
    myJoinRequestStatus: null,
  };
}

/** The selected game's place first, otherwise the nearest game at the tapped location. */
function defaultSelection(list: readonly DiscoveredGame[]): string | null {
  const center = parsed.value?.center;
  const fromRoute = list.find((game) => game.id === parsed.value?.selectedGameId);
  const here = list.find((game) => {
    const point = gamePoint(game);
    return center && point ? distanceBetweenKm(center, point) <= SAME_PLACE_KM : false;
  });

  return (fromRoute ?? here)?.id ?? null;
}

async function load(): Promise<void> {
  const target = parsed.value;

  if (!target) {
    return;
  }

  status.value = 'loading';
  error.value = null;
  const result = await discovery.discoverAround(target.center, NEARBY_ACTIVITY_RADIUS_KM);

  if (!result.ok) {
    games.value = [];
    status.value = 'error';
    error.value = result.message;
    return;
  }

  let list = result.games;
  const selectedId = target.selectedGameId;

  // The game the user came from is always shown, even if it is cancelled, completed, or just outside the radius.
  if (selectedId && isServerGameId(selectedId) && !list.some((game) => game.id === selectedId)) {
    const found = await gamesStore.fetchGame(selectedId);
    const game = found.ok ? gamesStore.gamesById[selectedId] : undefined;

    if (game && game.latitude !== null && game.longitude !== null) {
      list = [fromApiGame(game), ...list];
    }
  }

  games.value = list;
  status.value = 'ready';
  selectedGameId.value = defaultSelection(list);
}

function viewGame(gameId: string): void {
  void router.push(`/games/${gameId}`);
}

watch(
  () => route.fullPath,
  () => {
    if (route.path === ownPath) {
      parsed.value = parseLocationMapRoute(route.params, route.query);
      void load();
    }
  },
);

onMounted(() => {
  void load();
});
</script>

<style scoped>
.map {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 16px 32px;
}

.map__missing {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.map__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
}

.map__subtitle {
  margin: 4px 0 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.map__nearby {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.map__nearby-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.map__empty {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.82rem;
}

.map__skeleton {
  padding: 14px;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
}

.map__skeleton-line {
  width: 70%;
  height: 12px;
  margin: 0 0 8px;
}

.map__skeleton-line--short {
  width: 40%;
}
</style>
