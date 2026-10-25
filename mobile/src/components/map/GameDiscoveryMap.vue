<template>
  <section class="discovery-map" aria-label="GORA games map">
    <div class="discovery-map__frame">
      <component
        :is="canvas"
        v-if="mapCenter && !loading"
        :center="mapCenter"
        :radius-km="visibleRadiusKm"
        :show-radius="radiusKm !== null"
        :markers="markers"
        :selected-key="selectedPlace?.key ?? null"
        :user-location="userLocation"
        @select="selectPlace"
      />
      <div v-else-if="loading" class="discovery-map__loading" aria-busy="true" aria-label="Loading games">
        <ion-skeleton-text :animated="true" class="discovery-map__skeleton" />
      </div>
      <p v-else class="discovery-map__blank">No game on this list has a map position yet.</p>
    </div>

    <p v-if="error" class="discovery-map__error" role="alert">{{ error }}</p>
    <p v-if="provider.notice" class="discovery-map__notice">{{ provider.notice }}</p>
    <p v-if="!loading && unlocatedCount > 0" class="discovery-map__notice">
      {{ unlocatedCount === 1 ? '1 game has' : `${unlocatedCount} games have` }} no map position. See the List.
    </p>

    <div v-if="selectedPlace && selectedGame" class="discovery-map__preview">
      <div v-if="selectedPlace.games.length > 1" class="discovery-map__place-games" role="tablist">
        <button
          v-for="game in selectedPlace.games"
          :key="game.id"
          type="button"
          role="tab"
          class="discovery-map__place-game"
          :class="{ 'discovery-map__place-game--active': game.id === selectedGame.id }"
          :aria-selected="game.id === selectedGame.id"
          @click="emit('select', game.id)"
        >
          {{ getSportMarker(game.sport.name) }} {{ formatClockTime(game.startTime) }}
        </button>
      </div>
      <DiscoveredGameCard
        :game="selectedGame"
        :join-action="joinActionOf(selectedGame)"
        :busy="busyGameId === selectedGame.id"
        :badge="selectedBadge"
        highlighted
        @view="emit('view', $event)"
        @join="emit('join', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';
import { IonSkeletonText } from '@ionic/vue';
import { type MapMarker, type MapProviderId, resolveMapProvider } from '@/services/map-provider';
import type { DiscoveredGame } from '@/types/discovery';
import { discoveryJoinAction, mapRadiusKm } from '@/utils/discovery-display';
import { formatClockTime } from '@/utils/game-form';
import type { JoinRequestAction } from '@/utils/join-requests';
import { type MapPoint, gamePoint, groupGamesByPlace, placeMarkers } from '@/utils/location-map';
import { getSportMarker } from '@/utils/sports';
import DiscoveredGameCard from './DiscoveredGameCard.vue';
import PlaceholderMapCanvas from './PlaceholderMapCanvas.vue';

/** Provider adapters. A Google, Mapbox, or OpenStreetMap canvas plugs in here with the same props. */
const CANVASES: Partial<Record<MapProviderId, Component>> = {
  placeholder: PlaceholderMapCanvas,
};

const props = withDefaults(
  defineProps<{
    games: DiscoveredGame[];
    /** The search center (the user's location or a place); null = fit the games. */
    center: MapPoint | null;
    /** The distance filter, or null for any distance. */
    radiusKm: number | null;
    selectedGameId: string | null;
    loading?: boolean;
    error?: string | null;
    userLocation?: MapPoint | null;
    busyGameId?: string | null;
    /** A badge for one game ("Selected game" on the location view). */
    badgeGameId?: string | null;
    badgeText?: string | null;
    joinActionOf?: (game: DiscoveredGame) => JoinRequestAction;
  }>(),
  {
    loading: false,
    error: null,
    userLocation: null,
    busyGameId: null,
    badgeGameId: null,
    badgeText: null,
    joinActionOf: (game: DiscoveredGame) => discoveryJoinAction(game, undefined),
  },
);

const emit = defineEmits<{ select: [gameId: string | null]; view: [gameId: string]; join: [gameId: string] }>();

const provider = resolveMapProvider();
const canvas = CANVASES[provider.id] ?? PlaceholderMapCanvas;

const places = computed(() => groupGamesByPlace(props.games));
const unlocatedCount = computed(() => props.games.filter((game) => gamePoint(game) === null).length);
const mapCenter = computed<MapPoint | null>(() => {
  if (props.center) {
    return props.center;
  }

  const first = places.value[0];
  return first ? { latitude: first.latitude, longitude: first.longitude } : null;
});
const visibleRadiusKm = computed(() =>
  mapCenter.value ? mapRadiusKm(props.games, mapCenter.value, props.radiusKm) : 1,
);
const markers = computed<MapMarker[]>(() =>
  places.value.map((place) => ({
    key: place.key,
    label: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    symbols: placeMarkers(place),
    gameCount: place.games.length,
  })),
);
const selectedPlace = computed(
  () => places.value.find((place) => place.games.some((game) => game.id === props.selectedGameId)) ?? null,
);
const selectedGame = computed(
  () => selectedPlace.value?.games.find((game) => game.id === props.selectedGameId) ?? null,
);
const selectedBadge = computed(() =>
  selectedGame.value && selectedGame.value.id === props.badgeGameId ? props.badgeText : null,
);

function selectPlace(key: string): void {
  const place = places.value.find((candidate) => candidate.key === key);
  emit('select', place?.games[0]?.id ?? null);
}
</script>

<style scoped>
.discovery-map {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.discovery-map__frame {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: 18px;
  aspect-ratio: 4 / 3;
  background: #0b1824;
}

.discovery-map__loading {
  position: absolute;
  inset: 0;
}

.discovery-map__skeleton {
  width: 100%;
  height: 100%;
  margin: 0;
}

.discovery-map__blank {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 16px;
  color: var(--gora-muted);
  font-size: 0.84rem;
  text-align: center;
}

.discovery-map__error {
  margin: 0;
  color: #ef5b5b;
  font-size: 0.82rem;
}

.discovery-map__notice {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.discovery-map__preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.discovery-map__place-games {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.discovery-map__place-game {
  padding: 6px 10px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}

.discovery-map__place-game--active {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}
</style>
