import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  fetchActivities,
  fetchFriends,
  fetchLocations,
  fetchPlayers,
} from '@/services/catalog.service';
import type { FeedActivity } from '@/types/feed';
import type { PlayerSummary } from '@/types/player';
import type { SportCategory, SportsLocation } from '@/types/sport';
import { useSportsStore } from './sports';

export const useCatalogStore = defineStore('catalog', () => {
  const players = ref<PlayerSummary[]>([]);
  const sports = ref<SportCategory[]>([]);
  const locations = ref<SportsLocation[]>([]);
  const activities = ref<FeedActivity[]>([]);
  const friends = ref<PlayerSummary[]>([]);
  const isLoaded = ref(false);
  const sportsApi = useSportsStore();

  function syncSports(): void {
    sports.value = sportsApi.activeSports.map((sport) => {
      const activePlayers = sport.activePlayers ?? 0;
      const openGames = sport.openGames ?? 0;
      return {
        id: sport.id,
        name: sport.name,
        activePlayers,
        openGames,
        trendingScore: activePlayers + openGames,
      };
    });
  }

  async function refreshSports(): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await sportsApi.fetchSports({ force: true });
    if (result.ok) syncSports();
    return result;
  }

  async function load(): Promise<void> {
    if (isLoaded.value) {
      return;
    }

    const [loadedPlayers, sportsResult, loadedLocations, loadedActivities, loadedFriends] = await Promise.all([
      fetchPlayers(),
      sportsApi.fetchSports(),
      fetchLocations(),
      fetchActivities(),
      fetchFriends(),
    ]);
    players.value = loadedPlayers;
    locations.value = loadedLocations;
    activities.value = loadedActivities;
    friends.value = loadedFriends;
    if (sportsResult.ok) syncSports();
    isLoaded.value = sportsResult.ok;
  }

  return { players, sports, locations, activities, friends, isLoaded, load, refreshSports };
});
