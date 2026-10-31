import type { FeedActivity } from '@/types/feed';
import type { PlayerSummary } from '@/types/player';
import type { SportCategory, SportsLocation } from '@/types/sport';
import {
  buildMockActivities,
  mockLocations,
  mockSports,
} from './mock/mock-catalog';

export async function fetchPlayers(): Promise<PlayerSummary[]> {
  // Real accounts are loaded through the authenticated player search API.
  return [];
}

export async function fetchSports(): Promise<SportCategory[]> {
  return mockSports.map((sport) => ({ ...sport }));
}

export async function fetchLocations(): Promise<SportsLocation[]> {
  return mockLocations.map((location) => ({ ...location }));
}

/** Game completions, joins, and badge unlocks from people the viewer follows or is friends with. */
export async function fetchActivities(): Promise<FeedActivity[]> {
  return buildMockActivities(Date.now());
}

export async function fetchFriends(): Promise<PlayerSummary[]> {
  return [];
}
