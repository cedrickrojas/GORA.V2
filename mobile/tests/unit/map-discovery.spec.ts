import { describe, expect, test } from 'vitest';
import { buildMockGames, mockSports } from '@/services/mock/mock-catalog';
import type { Game } from '@/types/game';
import {
  DISCOVERY_DATES,
  MAP_DISCOVERY_STATUSES,
  getDiscoveryDateRange,
  selectSportDiscoveryGames,
} from '@/utils/map-discovery';
import { matchesSearchQuery } from '@/utils/search';
import { getSportMarker, toSportSlug } from '@/utils/sports';
import { DAY_MS } from '@/utils/time';

const NOW = new Date(2026, 8, 29, 12, 0, 0).getTime();

describe('sport map discovery rules', () => {
  test('the active map shows OPEN, FULL and ACTIVE games only', () => {
    expect(MAP_DISCOVERY_STATUSES).toEqual(['OPEN', 'FULL', 'ACTIVE']);
  });

  test('date filters are All (the default), Today, Tomorrow and This Week', () => {
    expect(DISCOVERY_DATES.map((option) => option.label)).toEqual(['All', 'Today', 'Tomorrow', 'This Week']);

    const today = getDiscoveryDateRange('TODAY', NOW);
    expect(today.endMs - today.startMs).toBe(DAY_MS);
    expect(getDiscoveryDateRange('TOMORROW', NOW).startMs).toBe(today.endMs);
    expect(getDiscoveryDateRange('THIS_WEEK', NOW).endMs - today.startMs).toBe(7 * DAY_MS);
    expect(getDiscoveryDateRange('ALL', NOW)).toEqual({ startMs: today.startMs, endMs: Number.POSITIVE_INFINITY });
  });

  test('All shows every upcoming game of the sport, including the ones a day chip would hide', () => {
    const games = buildMockGames(NOW);
    const all = selectSportDiscoveryGames(games, { sport: 'Volleyball', date: 'ALL', maxDistanceKm: null }, NOW);
    const week = selectSportDiscoveryGames(games, { sport: 'Volleyball', date: 'THIS_WEEK', maxDistanceKm: null }, NOW);
    const today = selectSportDiscoveryGames(games, { sport: 'Volleyball', date: 'TODAY', maxDistanceKm: null }, NOW);

    expect(all.length).toBeGreaterThanOrEqual(week.length);
    expect(week.length).toBeGreaterThanOrEqual(today.length);
    expect(all.every((game) => game.sport === 'Volleyball' && game.status !== 'CANCELLED')).toBe(true);
  });

  test("today's volleyball games skip cancelled games and are sorted by start time", () => {
    const games = selectSportDiscoveryGames(
      buildMockGames(NOW),
      { sport: 'Volleyball', date: 'TODAY', maxDistanceKm: null },
      NOW,
    );

    expect(games.map((game) => game.title)).toEqual(['Riverside Evening Volleyball', 'Late 6v6 Run']);
  });

  test('completed games and other sports are left out; distance is respected', () => {
    const games = buildMockGames(NOW);
    const week = selectSportDiscoveryGames(games, { sport: 'Volleyball', date: 'THIS_WEEK', maxDistanceKm: null }, NOW);

    expect(week.every((game) => game.sport === 'Volleyball' && game.status !== 'COMPLETED')).toBe(true);
    expect(selectSportDiscoveryGames(games, { sport: 'Volleyball', date: 'TODAY', maxDistanceKm: 1 }, NOW)).toEqual([]);
  });

  test('games without venue coordinates are not placed on the map', () => {
    const [game] = buildMockGames(NOW);
    const noCoordinates: Game = { ...game, location: { ...game.location, latitude: Number.NaN } };

    expect(
      selectSportDiscoveryGames([noCoordinates], { sport: 'Volleyball', date: 'TODAY', maxDistanceKm: null }, NOW),
    ).toEqual([]);
  });

  test('searching inside a sport matches every word, in any field, ignoring case', () => {
    expect(matchesSearchQuery('', 'anything')).toBe(true);
    expect(matchesSearchQuery('riverside VOLLEY', 'Riverside Evening Volleyball', 'Quezon City')).toBe(true);
    expect(matchesSearchQuery('riverside quezon', 'Riverside Evening Volleyball', 'Quezon City')).toBe(true);
    expect(matchesSearchQuery('riverside imus', 'Riverside Evening Volleyball', 'Quezon City')).toBe(false);
  });

  test('sports have map markers and URL slugs', () => {
    expect(getSportMarker('Volleyball')).toBe('🏐');
    expect(getSportMarker('Basketball')).toBe('🏀');
    expect(getSportMarker('Unknown')).toBe('📍');
    expect(toSportSlug('Table Tennis')).toBe('table-tennis');
    expect(new Set(mockSports.map((sport) => toSportSlug(sport.name))).size).toBe(mockSports.length);
  });
});
