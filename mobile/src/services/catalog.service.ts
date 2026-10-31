import type { FeedActivity } from '@/types/feed';
import type { PlayerSummary } from '@/types/player';
import type { SportsLocation } from '@/types/sport';
import { mockLocations } from './mock/mock-catalog';

export async function fetchPlayers(): Promise<PlayerSummary[]> {
  // Real accounts are loaded through the authenticated player search API.
  return [];
}

export async function fetchLocations(): Promise<SportsLocation[]> {
  const hiddenLocationIds = new Set(['loc-qmc', 'loc-ultra']);
  return mockLocations
    .filter((location) => !hiddenLocationIds.has(location.id))
    .map((location) => ({ ...location }));
}

/** Game completions, joins, and badge unlocks from people the viewer follows or is friends with. */
export async function fetchActivities(): Promise<FeedActivity[]> {
  return [];
}

export async function fetchFriends(): Promise<PlayerSummary[]> {
  return [];
}
