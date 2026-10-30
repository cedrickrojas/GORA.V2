<template>
  <section class="nearby" aria-label="Nearby GORA Games">
    <SectionHeader title="Nearby GORA Games">
      <span class="nearby__accent">{{ scopeLabel }}</span>
    </SectionHeader>

    <div class="nearby__filters">
      <label class="nearby__field">
        <span>Sport</span>
        <select v-model="sportModel" aria-label="Sport">
          <option :value="null">All Sports</option>
          <option v-for="sport in sportsStore.activeSports" :key="sport.id" :value="sport.name">{{ sport.name }}</option>
          <option v-if="unlistedSport" :value="unlistedSport">{{ unlistedSport }}</option>
        </select>
      </label>
      <label class="nearby__field">
        <span>Distance</span>
        <select v-model="distanceModel" aria-label="Distance">
          <option v-for="option in DISTANCE_FILTERS" :key="String(option)" :value="option">
            {{ formatDistanceFilter(option) }}
          </option>
        </select>
      </label>
    </div>

    <div class="nearby__dates" role="group" aria-label="Date">
      <button
        v-for="option in DISCOVERY_DATE_FILTERS"
        :key="option.id"
        type="button"
        class="nearby__chip"
        :class="{ 'nearby__chip--active': discovery.selectedDate === option.id }"
        :aria-pressed="discovery.selectedDate === option.id"
        @click="chooseDate(option.id)"
      >
        {{ option.label }}
      </button>
      <input
        v-if="discovery.selectedDate === 'CUSTOM'"
        type="date"
        class="nearby__date-input"
        aria-label="Custom date"
        :value="discovery.customDate ?? ''"
        @change="chooseCustomDate"
      />
    </div>

    <div class="nearby__location">
      <template v-if="discovery.locationStatus === 'granted'">
        <span v-if="mapProvider.id === 'google'">📍 Google Maps receives your current coordinates to center the map; GORA does not save them.</span>
        <span v-else>📍 Distances are from your current location (not saved by GORA).</span>
      </template>
      <template v-else-if="!settings.values.useDeviceLocation">
        <span>Device location is turned off in your settings.</span>
      </template>
      <template v-else-if="discovery.locationStatus === 'locating'">
        <span>Finding your location…</span>
      </template>
      <template v-else-if="discovery.locationMessage">
        <span role="status">{{ discovery.locationMessage }}</span>
      </template>
      <template v-else>
        <span>Share your location to see distances and games near you.</span>
        <button type="button" class="nearby__locate" @click="useMyLocation">📍 Use my location</button>
      </template>
      <span v-if="distanceNeedsLocation" class="nearby__hint">
        Distance needs your location, so games at any distance are shown.
      </span>
    </div>

    <SegmentTabs v-model="viewModel" :options="VIEW_OPTIONS" aria-label="Map or list" />
    <button type="button" class="nearby__all-map" @click="router.push('/map/games')">
      View all games on map
      <span aria-hidden="true">→</span>
    </button>

    <div v-if="discovery.error" class="nearby__error" role="alert">
      <span>{{ discovery.error }}</span>
      <button type="button" class="nearby__retry" @click="refresh">Try again</button>
    </div>
    <p v-else-if="discovery.sportNotice" class="nearby__empty">{{ discovery.sportNotice }}</p>
    <div v-else-if="isEmpty" class="nearby__empty">
      <strong>No GORA games found nearby.</strong>
      <span>Try increasing the distance or selecting another date.</span>
    </div>

    <GameDiscoveryMap
      v-if="discovery.viewMode === 'MAP' && !discovery.error && !isEmpty && !discovery.sportNotice"
      :games="discovery.games"
      :center="discovery.userLocation"
      :radius-km="discovery.isDistanceApplied ? discovery.distance : null"
      :selected-game-id="discovery.selectedGameId"
      :loading="discovery.loading"
      :user-location="discovery.userLocation"
      :busy-game-id="busyGameId"
      :join-action-of="joinActionOf"
      @select="discovery.selectGame"
      @view="viewGame"
      @join="openJoin"
    />

    <div v-else-if="discovery.viewMode === 'LIST' && !discovery.error" class="nearby__list">
      <template v-if="discovery.loading">
        <div v-for="index in 3" :key="index" class="nearby__skeleton" aria-hidden="true">
          <ion-skeleton-text :animated="true" class="nearby__skeleton-line" />
          <ion-skeleton-text :animated="true" class="nearby__skeleton-line nearby__skeleton-line--short" />
        </div>
      </template>
      <DiscoveredGameCard
        v-for="game in discovery.loading ? [] : discovery.games"
        :key="game.id"
        :game="game"
        :join-action="joinActionOf(game)"
        :busy="busyGameId === game.id"
        @view="viewGame"
        @join="openJoin"
      />
    </div>

    <JoinRequestModal
      :is-open="joiningGame !== null"
      :game-title="joiningGame?.title ?? ''"
      :host-name="joiningGame?.host.displayName ?? ''"
      :auto-accept="joiningGame?.autoAccept"
      :is-submitting="busyGameId !== null"
      :error="joinError"
      @close="closeJoin"
      @send="sendJoin"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IonSkeletonText } from '@ionic/vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import JoinRequestModal from '@/components/games/JoinRequestModal.vue';
import DiscoveredGameCard from '@/components/map/DiscoveredGameCard.vue';
import GameDiscoveryMap from '@/components/map/GameDiscoveryMap.vue';
import { useDiscoveryJoin } from '@/composables/useDiscoveryJoin';
import { useDiscoveryStore } from '@/stores/discovery';
import { useFiltersStore } from '@/stores/filters';
import { useSportsStore } from '@/stores/sports';
import { useSettingsStore } from '@/stores/settings';
import { resolveMapProvider } from '@/services/map-provider';
import type { DiscoveryDateFilter, DiscoveryViewMode } from '@/types/discovery';
import { DISCOVERY_DATE_FILTERS } from '@/utils/map-discovery';
import { DISTANCE_FILTERS, type DistanceFilter, formatDistanceFilter } from '@/utils/search';

const VIEW_OPTIONS: readonly { id: DiscoveryViewMode; label: string }[] = [
  { id: 'MAP', label: 'Map' },
  { id: 'LIST', label: 'List' },
];

const router = useRouter();
const discovery = useDiscoveryStore();
const filters = useFiltersStore();
const sportsStore = useSportsStore();
const settings = useSettingsStore();
const mapProvider = resolveMapProvider();
const { joiningGame, joinError, busyGameId, joinActionOf, openJoin, closeJoin, sendJoin } = useDiscoveryJoin(
  computed(() => discovery.games),
  (gameId, status, game) => discovery.applyJoinRequest(gameId, status, game),
);

// Sport and distance are the header filter; a change from here or from the header refetches once.
const sportModel = computed<string | null>({
  get: () => filters.sport,
  set: (value) => {
    filters.sport = value;
  },
});
const distanceModel = computed<DistanceFilter>({
  get: () => filters.maxDistanceKm,
  set: (value) => {
    filters.maxDistanceKm = value;
  },
});
const viewModel = computed<DiscoveryViewMode>({
  get: () => discovery.viewMode,
  set: (value) => discovery.setViewMode(value),
});

const unlistedSport = computed(() =>
  filters.sport && !sportsStore.activeSports.some((sport) => sport.name === filters.sport) ? filters.sport : null,
);
const distanceNeedsLocation = computed(
  () => filters.maxDistanceKm !== null && discovery.userLocation === null && discovery.locationStatus !== 'locating',
);
const isEmpty = computed(() => discovery.status === 'ready' && discovery.games.length === 0);
const scopeLabel = computed(() =>
  discovery.isDistanceApplied ? `Within ${formatDistanceFilter(discovery.distance)}` : 'Any distance',
);

function refresh(): void {
  void discovery.fetchNearbyGames();
}

function chooseDate(date: DiscoveryDateFilter): void {
  void discovery.fetchGamesByDate(date, date === 'CUSTOM' ? discovery.customDate : null);
}

function chooseCustomDate(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  void discovery.fetchGamesByDate('CUSTOM', value || null);
}

async function useMyLocation(): Promise<void> {
  await discovery.locate();
  refresh();
}

function viewGame(gameId: string): void {
  void router.push(`/games/${gameId}`);
}

watch(() => [filters.sport, filters.maxDistanceKm], refresh);

onMounted(async () => {
  void sportsStore.fetchSports();
  await discovery.initLocation();
  refresh();

  if (discovery.userLocation) {
    refresh();
  }
});
</script>

<style scoped>
.nearby {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.nearby__accent {
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.nearby__filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.nearby__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--gora-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.nearby__field select,
.nearby__date-input {
  padding: 9px 10px;
  border: 1px solid var(--gora-line);
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.86rem;
}

.nearby__dates {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.nearby__all-map {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--gora-line);
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
}

.nearby__chip {
  padding: 7px 12px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
}

.nearby__chip--active {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.nearby__location {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.nearby__hint {
  width: 100%;
  font-size: 0.72rem;
}

.nearby__locate,
.nearby__retry {
  padding: 6px 12px;
  border: 1px solid var(--ion-color-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
}

.nearby__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #ef5b5b;
  font-size: 0.84rem;
}

.nearby__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 18px 12px;
  border: 1px dashed var(--gora-line);
  border-radius: 16px;
  color: var(--gora-muted);
  font-size: 0.84rem;
  text-align: center;
}

.nearby__empty strong {
  color: var(--ion-text-color);
}

.nearby__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nearby__skeleton {
  padding: 14px;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
}

.nearby__skeleton-line {
  width: 70%;
  height: 12px;
  margin: 0 0 8px;
}

.nearby__skeleton-line--short {
  width: 40%;
}
</style>
