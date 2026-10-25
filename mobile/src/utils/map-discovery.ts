import type { DiscoveryDateFilter, DiscoveryDateParam, GameDiscoveryQuery } from '@/types/discovery';
import type { Game, GameStatus } from '@/types/game';
import { isWithinDistance, matchesSport } from './filters';
import type { MapPoint } from './location-map';
import type { DistanceFilter } from './search';
import { DAY_MS } from './time';

/** One page of map/list results; the server allows up to 100. */
export const DISCOVERY_RESULT_LIMIT = 50;

/**
 * Rules for the Sport-Based Live Activity Map (docs/features/sport-map-discovery.md).
 * Real games are filtered by the server (GET /api/v1/games/discover); the local
 * selection below only runs on the demo games of the sport page.
 */

/** Cancelled games never show; completed games are left off the active map. */
export const MAP_DISCOVERY_STATUSES: readonly GameStatus[] = ['OPEN', 'FULL', 'ACTIVE'];

export type DiscoveryDate = 'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK';

/** All is the default; the day chips are optional narrowing. */
export const DISCOVERY_DATES: readonly { id: DiscoveryDate; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'TODAY', label: 'Today' },
  { id: 'TOMORROW', label: 'Tomorrow' },
  { id: 'THIS_WEEK', label: 'This Week' },
];

/** The discovery date filter: the same chips plus a custom date. */
export const DISCOVERY_DATE_FILTERS: readonly { id: DiscoveryDateFilter; label: string }[] = [
  ...DISCOVERY_DATES,
  { id: 'CUSTOM', label: 'Custom Date' },
];

const CUSTOM_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The server's date value. Today/Tomorrow/This Week are sent as presets so the server
 * decides them on the game clock; Custom sends its YYYY-MM-DD date. Undefined = every
 * upcoming date (also for a custom filter with no date picked yet).
 */
export function toDiscoveryDateParam(
  filter: DiscoveryDateFilter,
  customDate: string | null,
): DiscoveryDateParam | undefined {
  switch (filter) {
    case 'ALL':
      return undefined;
    case 'TODAY':
      return 'today';
    case 'TOMORROW':
      return 'tomorrow';
    case 'THIS_WEEK':
      return 'this-week';
    case 'CUSTOM':
      return customDate && CUSTOM_DATE_PATTERN.test(customDate) ? customDate : undefined;
  }
}

export interface DiscoverySearch {
  sportId: string | null;
  dateFilter: DiscoveryDateFilter;
  customDate: string | null;
  distanceKm: DistanceFilter;
  userLocation: MapPoint | null;
}

/**
 * The GET /games/discover query. The center and radius are only sent together: without a
 * location there is no distance to filter by, so Any applies and games are listed by date.
 */
export function buildDiscoveryQuery(search: DiscoverySearch): GameDiscoveryQuery {
  const query: GameDiscoveryQuery = { limit: DISCOVERY_RESULT_LIMIT };
  const date = toDiscoveryDateParam(search.dateFilter, search.customDate);

  if (search.sportId) {
    query.sportId = search.sportId;
  }

  if (date) {
    query.date = date;
  }

  if (search.userLocation) {
    query.latitude = search.userLocation.latitude;
    query.longitude = search.userLocation.longitude;

    if (search.distanceKm !== null) {
      query.distanceKm = search.distanceKm;
    }
  }

  return query;
}

export interface SportDiscoveryFilters {
  sport: string;
  date: DiscoveryDate;
  maxDistanceKm: DistanceFilter;
}

/**
 * Local-day range [startMs, endMs). "This Week" is today plus the next 6 days; "All" is
 * everything from today on, so games from earlier days never linger.
 */
export function getDiscoveryDateRange(date: DiscoveryDate, nowMs: number): { startMs: number; endMs: number } {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const startOfToday = today.getTime();

  switch (date) {
    case 'ALL':
      return { startMs: startOfToday, endMs: Number.POSITIVE_INFINITY };
    case 'TODAY':
      return { startMs: startOfToday, endMs: startOfToday + DAY_MS };
    case 'TOMORROW':
      return { startMs: startOfToday + DAY_MS, endMs: startOfToday + 2 * DAY_MS };
    case 'THIS_WEEK':
      return { startMs: startOfToday, endMs: startOfToday + 7 * DAY_MS };
  }
}

/** Games for one sport and date that belong on the map, earliest first, then closest. */
export function selectSportDiscoveryGames(
  games: readonly Game[],
  filters: SportDiscoveryFilters,
  nowMs: number,
): Game[] {
  const { startMs, endMs } = getDiscoveryDateRange(filters.date, nowMs);

  return games
    .filter((game) => {
      const startsAtMs = Date.parse(game.startsAt);

      return (
        matchesSport(game.sport, filters.sport) &&
        MAP_DISCOVERY_STATUSES.includes(game.status) &&
        startsAtMs >= startMs &&
        startsAtMs < endMs &&
        Number.isFinite(game.location.latitude) &&
        Number.isFinite(game.location.longitude) &&
        isWithinDistance(game.location.distanceKm, filters.maxDistanceKm)
      );
    })
    .sort(
      (a, b) =>
        Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.location.distanceKm - b.location.distanceKm,
    );
}
