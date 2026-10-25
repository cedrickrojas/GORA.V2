import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { discoverGames } from '@/services/games-api.service';
import {
  type LocationFailure,
  checkPermission,
  describeLocationFailure,
  requestPermission,
} from '@/services/location.service';
import type {
  DiscoveredGame,
  DiscoveryDateFilter,
  DiscoveryViewMode,
  GameDiscoveryQuery,
} from '@/types/discovery';
import type { JoinRequestStatus } from '@/types/join-request';
import { describeApiError } from '@/utils/api-errors';
import type { MapPoint } from '@/utils/location-map';
import { buildDiscoveryQuery } from '@/utils/map-discovery';
import type { DistanceFilter } from '@/utils/search';
import { useAuthStore } from './auth';
import { createAuthorizedCall } from './authorized';
import { useFiltersStore } from './filters';
import type { LoadStatus } from './sports';
import { useSportsStore } from './sports';

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export type DiscoveryResult = { ok: true; games: DiscoveredGame[] } | { ok: false; message: string };

const LOCATION_STATUS_BY_FAILURE: Record<LocationFailure, LocationStatus> = {
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
  UNSUPPORTED: 'unsupported',
};

export const SPORT_NOT_ON_GORA_MESSAGE = 'That sport has no GORA games yet.';
const INVALID_SPORT_MESSAGE = 'That sport is not available. Choose another sport.';

/**
 * Real GORA games for the Discover map and list (GET /games/discover). Sport and distance
 * are the header filter (filters store), so Home, Search, and Discover never disagree;
 * the date, view, selection, and the device location live here. The location is kept in
 * memory for this session only and is sent only as the center of a discovery search.
 */
export const useDiscoveryStore = defineStore('discovery', () => {
  const auth = useAuthStore();
  const filters = useFiltersStore();
  const sportsStore = useSportsStore();
  const authorized = createAuthorizedCall(auth);

  const games = ref<DiscoveredGame[]>([]);
  const selectedDate = ref<DiscoveryDateFilter>('ALL');
  const customDate = ref<string | null>(null);
  const userLocation = ref<MapPoint | null>(null);
  const locationStatus = ref<LocationStatus>('idle');
  const selectedGameId = ref<string | null>(null);
  const viewMode = ref<DiscoveryViewMode>('MAP');
  const status = ref<LoadStatus>('idle');
  const error = ref<string | null>(null);

  let requestSeq = 0;
  let permissionChecked = false;

  watch([() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id], () => {
    requestSeq++;
    games.value = [];
    selectedGameId.value = null;
    userLocation.value = null;
    locationStatus.value = 'idle';
    permissionChecked = false;
    status.value = 'idle';
    error.value = null;
  }, { flush: 'sync' });

  /** The header filter's sport name, resolved to the central Sport id. */
  const selectedSport = computed(() => {
    const name = filters.sport?.toLowerCase();
    return name ? (sportsStore.activeSports.find((sport) => sport.name.toLowerCase() === name) ?? null) : null;
  });
  /** The header filter can hold a demo-only sport (no Sport row): nothing to search then. */
  const sportNotice = computed(() =>
    filters.sport && sportsStore.sportsStatus === 'ready' && !selectedSport.value ? SPORT_NOT_ON_GORA_MESSAGE : null,
  );
  const distance = computed<DistanceFilter>(() => filters.maxDistanceKm);
  /** A radius only applies around a known location. */
  const isDistanceApplied = computed(() => userLocation.value !== null && distance.value !== null);
  const selectedGame = computed(() => games.value.find((game) => game.id === selectedGameId.value) ?? null);
  const loading = computed(() => status.value === 'loading');
  const locationMessage = computed(() => {
    const failure = (Object.keys(LOCATION_STATUS_BY_FAILURE) as LocationFailure[]).find(
      (reason) => LOCATION_STATUS_BY_FAILURE[reason] === locationStatus.value,
    );
    return failure ? describeLocationFailure(failure) : null;
  });

  function currentQuery(): GameDiscoveryQuery | null {
    if (filters.sport && !selectedSport.value) {
      return null;
    }

    return buildDiscoveryQuery({
      sportId: selectedSport.value?.id ?? null,
      dateFilter: selectedDate.value,
      customDate: customDate.value,
      distanceKm: distance.value,
      userLocation: userLocation.value,
    });
  }

  async function fetchNearbyGames(): Promise<DiscoveryResult> {
    const seq = ++requestSeq;

    if (filters.sport && sportsStore.sportsStatus !== 'ready') {
      await sportsStore.fetchSports();
    }

    if (seq !== requestSeq) return { ok: false, message: 'The account or search changed. Try again.' };

    const query = currentQuery();

    if (!query) {
      games.value = [];
      selectedGameId.value = null;
      status.value = 'ready';
      error.value = null;
      return { ok: true, games: [] };
    }

    status.value = 'loading';
    error.value = null;

    try {
      const response = await authorized((token) => discoverGames(token, query));

      if (seq === requestSeq) {
        games.value = response.games;
        status.value = 'ready';

        if (!response.games.some((game) => game.id === selectedGameId.value)) {
          selectedGameId.value = null;
        }
      }

      return { ok: true, games: response.games };
    } catch (caught) {
      const message = describeApiError(caught, INVALID_SPORT_MESSAGE);

      if (seq === requestSeq) {
        status.value = 'error';
        error.value = message;
      }

      return { ok: false, message };
    }
  }

  function fetchGamesBySport(sportName: string | null): Promise<DiscoveryResult> {
    filters.sport = sportName;
    return fetchNearbyGames();
  }

  function fetchGamesByDate(date: DiscoveryDateFilter, custom: string | null = null): Promise<DiscoveryResult> {
    selectedDate.value = date;
    customDate.value = date === 'CUSTOM' ? custom : null;
    return fetchNearbyGames();
  }

  function fetchGamesByDistance(km: DistanceFilter): Promise<DiscoveryResult> {
    filters.maxDistanceKm = km;
    return fetchNearbyGames();
  }

  function clearFilters(): Promise<DiscoveryResult> {
    filters.reset();
    selectedDate.value = 'ALL';
    customDate.value = null;
    selectedGameId.value = null;
    return fetchNearbyGames();
  }

  function selectGame(gameId: string | null): void {
    selectedGameId.value = gameId;
  }

  function setViewMode(mode: DiscoveryViewMode): void {
    viewMode.value = mode;
  }

  /** Asks for the location (from a tap). A denial is remembered; the app never asks again on its own. */
  async function locate(): Promise<void> {
    if (locationStatus.value === 'locating') {
      return;
    }

    locationStatus.value = 'locating';
    const result = await requestPermission();

    if (result.ok) {
      userLocation.value = result.point;
      locationStatus.value = 'granted';
    } else {
      userLocation.value = null;
      locationStatus.value = LOCATION_STATUS_BY_FAILURE[result.reason];
    }
  }

  /**
   * Once per session: use the location if it was already allowed, remember a denial, and
   * otherwise wait for the user to tap "Use my location". Never prompts by itself.
   */
  async function initLocation(): Promise<void> {
    if (permissionChecked) {
      return;
    }

    permissionChecked = true;
    const permission = await checkPermission();

    if (permission === 'granted') {
      await locate();
    } else if (permission === 'denied') {
      locationStatus.value = 'denied';
    } else if (permission === 'unsupported') {
      locationStatus.value = 'unsupported';
    }
  }

  /** Games around one place (the location view). Returns them without touching the Discover state. */
  async function discoverAround(center: MapPoint, radiusKm: number): Promise<DiscoveryResult> {
    try {
      const response = await authorized((token) =>
        discoverGames(token, { latitude: center.latitude, longitude: center.longitude, distanceKm: radiusKm }),
      );
      return { ok: true, games: response.games };
    } catch (caught) {
      return { ok: false, message: describeApiError(caught) };
    }
  }

  /** Keeps a result in step after the viewer sends or cancels a join request from the map. */
  function applyJoinRequest(gameId: string, requestStatus: JoinRequestStatus | null): void {
    games.value = games.value.map((game) =>
      game.id === gameId ? { ...game, myJoinRequestStatus: requestStatus } : game,
    );
  }

  return {
    games,
    selectedSport,
    sportNotice,
    selectedDate,
    customDate,
    distance,
    isDistanceApplied,
    userLocation,
    locationStatus,
    locationMessage,
    selectedGameId,
    selectedGame,
    viewMode,
    status,
    loading,
    error,
    fetchNearbyGames,
    fetchGamesBySport,
    fetchGamesByDate,
    fetchGamesByDistance,
    clearFilters,
    selectGame,
    setViewMode,
    locate,
    initLocation,
    discoverAround,
    applyJoinRequest,
  };
});
