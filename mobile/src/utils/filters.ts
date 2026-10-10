import type { DistanceFilter } from './search';

export interface FeedFilters {
  maxDistanceKm: DistanceFilter;
  /** Sport name, or null for every sport. */
  sport: string | null;
}

export const NO_FILTERS: FeedFilters = { maxDistanceKm: null, sport: null };

export function isWithinDistance(distanceKm: number, maxDistanceKm: DistanceFilter): boolean {
  return maxDistanceKm === null || distanceKm <= maxDistanceKm;
}

export function matchesSport(sports: string | readonly string[], sport: string | null): boolean {
  if (sport === null) {
    return true;
  }

  const wanted = sport.toLowerCase();
  const list = typeof sports === 'string' ? [sports] : sports;

  return list.some((candidate) => candidate.toLowerCase() === wanted);
}
