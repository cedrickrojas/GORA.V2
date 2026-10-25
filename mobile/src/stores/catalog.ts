import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  fetchActivities,
  fetchFriends,
  fetchLocations,
  fetchPlayers,
  fetchSports,
} from '@/services/catalog.service';
import type { FeedActivity } from '@/types/feed';
import type { PlayerSummary } from '@/types/player';
import type { SportCategory, SportsLocation } from '@/types/sport';

export const useCatalogStore = defineStore('catalog', () => {
  const players = ref<PlayerSummary[]>([]);
  const sports = ref<SportCategory[]>([]);
  const locations = ref<SportsLocation[]>([]);
  const activities = ref<FeedActivity[]>([]);
  const friends = ref<PlayerSummary[]>([]);
  const isLoaded = ref(false);

  async function load(): Promise<void> {
    if (isLoaded.value) {
      return;
    }

    [players.value, sports.value, locations.value, activities.value, friends.value] = await Promise.all([
      fetchPlayers(),
      fetchSports(),
      fetchLocations(),
      fetchActivities(),
      fetchFriends(),
    ]);
    isLoaded.value = true;
  }

  return { players, sports, locations, activities, friends, isLoaded, load };
});
