import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { CREATE_ACTIONS } from '@/composables/useCreateMenu';
import {
  buildMockGames,
  buildMockPosts,
  buildMockReels,
  mockLocations,
  mockPlayers,
  mockSports,
} from '@/services/mock/mock-catalog';
import { buildMockClubs } from '@/services/mock/mock-clubs';
import { mockActivityStats, mockBadges } from '@/services/mock/mock-profile';
import { useFiltersStore } from '@/stores/filters';
import { useGamesStore } from '@/stores/games';
import { useNotificationsStore } from '@/stores/notifications';
import { toActivityStatItems } from '@/utils/activity';
import {
  buildDiscoverFeed,
  getNearbyRadiusKm,
  NEARBY_RADIUS_KM,
  pickGamesNearYou,
} from '@/utils/discover';
import { canRequestToJoin, groupMyGames } from '@/utils/games';
import { PROFILE_DROPDOWN_LINKS } from '@/utils/navigation';
import { DISTANCE_FILTERS, formatDistanceFilter, searchCatalog, type SearchCatalog } from '@/utils/search';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');

function catalog(): SearchCatalog {
  return {
    players: mockPlayers,
    sports: mockSports,
    games: buildMockGames(NOW),
    locations: mockLocations,
    posts: buildMockPosts(NOW),
    reels: buildMockReels(NOW),
    clubs: buildMockClubs(NOW),
  };
}

describe('locked design lists', () => {
  test('has exactly the 13 locked badges', () => {
    expect(mockBadges.map((badge) => badge.name).sort()).toEqual(
      [
        'First Game',
        'Getting Started',
        'Active Player',
        'Dedicated Player',
        'Veteran',
        'Game Host',
        'Organizer',
        'Team Player',
        'Highlight Creator',
        'Highlight Maker',
        'Social Player',
        'Community Player',
        'Storyteller',
      ].sort(),
    );
  });

  test('has exactly the 7 locked activity stats', () => {
    expect(toActivityStatItems(mockActivityStats).map((item) => item.label)).toEqual([
      'Games Joined',
      'Games Completed',
      'Games Hosted',
      'Highlights Uploaded',
      'Stories Posted',
      'Friends',
      'Sports Participated',
    ]);
  });

  test('Create offers the 5 locked actions', () => {
    expect(CREATE_ACTIONS.map((action) => action.label)).toEqual([
      'Create Post',
      'Create Game',
      'Upload Reel',
      'Add Story',
      'Go Live',
    ]);
  });

  test('the avatar dropdown lists Profile and the 7 profile sections in order', () => {
    expect(PROFILE_DROPDOWN_LINKS.map((link) => link.label)).toEqual([
      'Profile',
      'My Games',
      'My Reels',
      'My Stories',
      'Friends',
      'Badges',
      'Activity',
      'Settings',
    ]);
  });

  test('distance filters are 1 to 100 km plus Any', () => {
    expect(DISTANCE_FILTERS.map(formatDistanceFilter)).toEqual([
      '1 km',
      '5 km',
      '10 km',
      '25 km',
      '50 km',
      '100 km',
      'Any',
    ]);
  });
});

describe('searchCatalog', () => {
  test('matches across players, sports, games, locations, posts, and reels', () => {
    const results = searchCatalog(catalog(), { query: 'volleyball', category: 'ALL', maxDistanceKm: null });

    expect(results.players.map((player) => player.username)).toContain('maria');
    expect(results.sports.map((sport) => sport.name)).toEqual(['Volleyball']);
    expect(results.games.map((game) => game.id)).toContain('game-volley-sat');
    expect(results.locations.length).toBeGreaterThan(0);
    expect(results.posts.length).toBeGreaterThan(0);
    expect(results.reels.length).toBeGreaterThan(0);
  });

  test('leaves completed games out of search', () => {
    const results = searchCatalog(catalog(), { query: 'beach', category: 'GAMES', maxDistanceKm: null });

    expect(results.games).toEqual([]);
  });

  test('distance filters places but not sports or reels', () => {
    const results = searchCatalog(catalog(), { query: '', category: 'ALL', maxDistanceKm: 5 });

    expect(results.players.every((player) => player.distanceKm <= 5)).toBe(true);
    expect(results.games.every((game) => game.location.distanceKm <= 5)).toBe(true);
    expect(results.locations.every((location) => location.distanceKm <= 5)).toBe(true);
    expect(results.sports).toHaveLength(mockSports.length);
    expect(results.reels.length).toBe(buildMockReels(NOW).length);
  });

  test('the header sport filter narrows every result type to that sport', () => {
    const results = searchCatalog(catalog(), {
      query: '',
      category: 'ALL',
      maxDistanceKm: null,
      sport: 'Basketball',
    });

    expect(results.players.every((player) => player.primarySport === 'Basketball')).toBe(true);
    expect(results.sports.map((sport) => sport.name)).toEqual(['Basketball']);
    expect(results.games.every((game) => game.sport === 'Basketball')).toBe(true);
    expect(results.locations.every((location) => location.sports.includes('Basketball'))).toBe(true);
    expect(results.reels.every((reel) => reel.sport === 'Basketball')).toBe(true);
  });

  test('a category limits results to that type', () => {
    const results = searchCatalog(catalog(), { query: '', category: 'PLAYERS', maxDistanceKm: null });

    expect(results.players).toHaveLength(mockPlayers.length);
    expect(results.games).toEqual([]);
    expect(results.sports).toEqual([]);
  });
});

describe('discover feed', () => {
  test('ranks each section and keeps nearby activities inside the radius', () => {
    const feed = buildDiscoverFeed(catalog());

    expect(feed.popularPlayers[0]?.username).toBe('maria');
    expect(feed.trendingSports[0]?.name).toBe('Basketball');
    expect(feed.trendingReels[0]?.id).toBe('reel-2');
    expect(feed.featuredAthletes.every((player) => player.featured)).toBe(true);
    expect(feed.popularGames.some((game) => game.status === 'COMPLETED')).toBe(false);
    expect(
      feed.nearbyActivities.every(
        (game) => game.status === 'OPEN' && game.location.distanceKm <= NEARBY_RADIUS_KM,
      ),
    ).toBe(true);
  });
});

describe('header filters on Home and Discover', () => {
  test('without a distance, nearby means 10 km', () => {
    expect(getNearbyRadiusKm({ maxDistanceKm: null, sport: null })).toBe(NEARBY_RADIUS_KM);
    expect(getNearbyRadiusKm({ maxDistanceKm: 50, sport: null })).toBe(50);
  });

  test('Home games near you respect distance and sport, closest first', () => {
    const games = buildMockGames(NOW);
    const nearby = pickGamesNearYou(games, { maxDistanceKm: 5, sport: null }, 3);

    expect(nearby.map((game) => game.id)).toEqual([
      'game-volley-sat',
      'game-hoops-night',
      'game-volley-riverside-evening',
    ]);
    expect(pickGamesNearYou(games, { maxDistanceKm: 100, sport: 'Pickleball' }, 3).map((game) => game.id)).toEqual([
      'game-pickleball',
    ]);
  });

  test('Discover applies distance and sport to every section', () => {
    const feed = buildDiscoverFeed(catalog(), { maxDistanceKm: 25, sport: 'Volleyball' });

    expect(feed.popularPlayers.map((player) => player.username)).toEqual(['maria']);
    expect(feed.trendingSports.map((sport) => sport.name)).toEqual(['Volleyball']);
    expect(feed.popularGames.every((game) => game.sport === 'Volleyball')).toBe(true);
    expect(feed.trendingReels.every((reel) => reel.sport === 'Volleyball')).toBe(true);
    expect(feed.nearbyActivities.every((game) => game.location.distanceKm <= 25)).toBe(true);
  });

  test('the filter store reports when it is active and resets', () => {
    setActivePinia(createPinia());
    const filters = useFiltersStore();

    expect(filters.isActive).toBe(false);
    filters.maxDistanceKm = 25;
    expect(filters.isActive).toBe(true);
    filters.reset();
    expect(filters.isActive).toBe(false);
  });
});

describe('game join flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('joining sends a request instead of making the viewer a participant', async () => {
    const store = useGamesStore();
    await store.load();

    const sent = await store.requestToJoin('game-futsal');
    const game = store.games.find((candidate) => candidate.id === 'game-futsal');

    expect(sent).toBe(true);
    expect(game?.participation).toBe('REQUESTED');
    expect(await store.requestToJoin('game-futsal')).toBe(false);
  });

  test('full, hosted, and completed games cannot take a request', () => {
    const games = buildMockGames(NOW);
    const byId = (id: string) => games.find((game) => game.id === id)!;

    expect(canRequestToJoin(byId('game-tennis-full'))).toBe(false);
    expect(canRequestToJoin(byId('game-volley-sat'))).toBe(false);
    expect(canRequestToJoin(byId('game-volley-last-week'))).toBe(false);
    expect(canRequestToJoin(byId('game-futsal'))).toBe(true);
  });

  test('My Games only counts completed games the viewer took part in', () => {
    const groups = groupMyGames(buildMockGames(NOW));

    expect(groups.hosting.map((game) => game.id)).toEqual(['game-volley-sat']);
    expect(groups.upcoming.map((game) => game.id)).toEqual(['game-hoops-night']);
    expect(groups.requested.map((game) => game.id)).toEqual(['game-badminton-doubles']);
    expect(groups.completed.map((game) => game.id)).toEqual(['game-volley-last-week']);
  });
});

describe('notifications store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('keeps the signed-out inbox empty instead of showing sample notifications', async () => {
    const store = useNotificationsStore();
    expect(await store.load()).toBe(false);
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
    expect(store.isLoaded).toBe(false);
  });
});
