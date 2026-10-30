import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { routerKey } from 'vue-router';
import NearbyGamesSection from '@/components/discover/NearbyGamesSection.vue';
import GameDiscoveryMap from '@/components/map/GameDiscoveryMap.vue';
import {
  LOCATION_UNAVAILABLE_MESSAGE,
  checkPermission,
  getCurrentLocation,
} from '@/services/location.service';
import { resolveMapProvider } from '@/services/map-provider';
import { useAuthStore } from '@/stores/auth';
import { useDiscoveryStore } from '@/stores/discovery';
import { useFiltersStore } from '@/stores/filters';
import type { DiscoveredGame, GameDiscoveryResponse } from '@/types/discovery';
import {
  discoveryJoinAction,
  formatDiscoveryWhen,
  formatDistanceAway,
  formatPlayersLine,
} from '@/utils/discovery-display';
import { addDays, deviceMoment } from '@/utils/game-form';
import { buildDiscoveryQuery, toDiscoveryDateParam } from '@/utils/map-discovery';

vi.mock('@/utils/notice', () => ({ showNotice: vi.fn(async () => undefined) }));

const VOLLEYBALL = '77777777-7777-4777-8777-777777777777';
const BASKETBALL = '88888888-8888-4888-8888-888888888888';
const GAME_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GAME_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GAME_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HERE = { latitude: 14.551, longitude: 121.05 };
const today = deviceMoment().date;

function game(overrides: Partial<DiscoveredGame> = {}): DiscoveredGame {
  return {
    id: GAME_A,
    title: 'Sunset Volleyball',
    sport: { id: VOLLEYBALL, name: 'Volleyball', iconUrl: null },
    host: {
      id: 'host-1',
      username: 'juan',
      firstName: 'Juan',
      lastName: 'Cruz',
      displayName: 'Juan Cruz',
      profileImageUrl: null,
    },
    club: null,
    gameDate: today,
    startTime: '18:00',
    endTime: '20:00',
    locationName: 'BGC Court',
    latitude: 14.5618,
    longitude: 121.05,
    distanceKm: 1.2,
    currentPlayers: 8,
    requiredPlayers: 12,
    remainingSlots: 4,
    status: 'OPEN',
    isHost: false,
    isPlayer: false,
    myJoinRequestStatus: null,
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Fake API: /sports and /games/discover. Every discovery query is recorded. */
function fakeApi(respond: (query: URLSearchParams) => Response | Promise<Response>) {
  const queries: URLSearchParams[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://test');
      const path = url.pathname.replace('/api/v1', '');

      if (path === '/sports') {
        return Promise.resolve(
          jsonResponse(200, [
            { id: BASKETBALL, name: 'Basketball', description: null, iconUrl: null, isActive: true },
            { id: VOLLEYBALL, name: 'Volleyball', description: null, iconUrl: null, isActive: true },
          ]),
        );
      }

      if (path === '/games/discover') {
        queries.push(url.searchParams);
        return Promise.resolve(respond(url.searchParams));
      }

      return Promise.resolve(jsonResponse(404, { success: false, message: 'Not found.' }));
    }),
  );

  return queries;
}

const found = (games: DiscoveredGame[]): Response =>
  jsonResponse(200, { games, dateFrom: today, dateTo: null, distanceKm: null } satisfies GameDiscoveryResponse);

function signIn(): void {
  const auth = useAuthStore();
  auth.accessToken = 'test-token';
  auth.currentUser = {
    id: 'viewer-1',
    username: 'banana',
    email: 'banana@example.com',
    firstName: 'Ban',
    lastName: 'Ana',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: 'Manila',
  };
}

type Geo = { granted: boolean; code?: number };

/** Device location: granted at HERE, or refused with a W3C error code. */
function stubGeolocation(geo: Geo): void {
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) =>
        geo.granted
          ? ok({ coords: { latitude: 14.55123, longitude: 121.05049 } } as GeolocationPosition)
          : fail({ code: geo.code ?? 1 } as GeolocationPositionError),
    },
  });
  Object.defineProperty(window.navigator, 'permissions', {
    configurable: true,
    value: { query: () => Promise.resolve({ state: geo.granted ? 'granted' : 'denied' }) },
  });
}

function removeGeolocation(): void {
  Reflect.deleteProperty(window.navigator, 'geolocation');
  Reflect.deleteProperty(window.navigator, 'permissions');
}

function mountSection() {
  const push = vi.fn();
  const wrapper = mount(NearbyGamesSection, {
    global: {
      provide: { [routerKey as symbol]: { push, replace: vi.fn() } },
      stubs: {
        JoinRequestModal: true,
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        IonSkeletonText: { template: '<span class="skeleton" />' },
      },
    },
  });

  return { wrapper, push };
}

describe('discovery rules', () => {
  test('date filters become server presets; custom sends its date', () => {
    expect(toDiscoveryDateParam('ALL', null)).toBeUndefined();
    expect(toDiscoveryDateParam('TODAY', null)).toBe('today');
    expect(toDiscoveryDateParam('TOMORROW', null)).toBe('tomorrow');
    expect(toDiscoveryDateParam('THIS_WEEK', null)).toBe('this-week');
    expect(toDiscoveryDateParam('CUSTOM', '2026-10-04')).toBe('2026-10-04');
    expect(toDiscoveryDateParam('CUSTOM', null)).toBeUndefined();
  });

  test('the center and radius only go together; Any sends no radius', () => {
    const base = { sportId: VOLLEYBALL, dateFilter: 'TODAY' as const, customDate: null };

    expect(buildDiscoveryQuery({ ...base, distanceKm: 10, userLocation: HERE })).toEqual({
      limit: 50,
      sportId: VOLLEYBALL,
      date: 'today',
      latitude: HERE.latitude,
      longitude: HERE.longitude,
      distanceKm: 10,
    });
    expect(buildDiscoveryQuery({ ...base, distanceKm: null, userLocation: HERE }).distanceKm).toBeUndefined();
    expect(buildDiscoveryQuery({ ...base, distanceKm: 10, userLocation: null })).toEqual({
      limit: 50,
      sportId: VOLLEYBALL,
      date: 'today',
    });
  });

  test('preview text uses the server numbers', () => {
    expect(formatDiscoveryWhen(game())).toBe('Today • 6:00 PM');
    expect(formatDiscoveryWhen(game({ gameDate: addDays(today, 1), startTime: '07:30' }))).toBe('Tomorrow • 7:30 AM');
    expect(formatDistanceAway(1.2)).toBe('1.2 km away');
    expect(formatDistanceAway(null)).toBeNull();
    expect(formatPlayersLine(game())).toBe('Players: 8/12');
  });

  test('Request to Join follows the join request rules', () => {
    expect(discoveryJoinAction(game(), undefined)).toEqual({ kind: 'request' });
    expect(discoveryJoinAction(game({ myJoinRequestStatus: 'PENDING' }), undefined)).toEqual({ kind: 'pending' });
    expect(discoveryJoinAction(game({ myJoinRequestStatus: 'PENDING' }), null)).toEqual({ kind: 'request' });
    expect(discoveryJoinAction(game({ isHost: true }), undefined)).toEqual({ kind: 'host' });
    expect(discoveryJoinAction(game({ isPlayer: true }), undefined)).toEqual({ kind: 'player' });
    expect(discoveryJoinAction(game({ status: 'FULL' }), undefined)).toEqual({ kind: 'closed', label: 'Game is full' });
  });

  test('the map works without a provider or key and never exposes one', () => {
    expect(resolveMapProvider({})).toEqual(expect.objectContaining({ id: 'placeholder', hasApiKey: false }));
    const google = resolveMapProvider({ VITE_MAP_PROVIDER: 'google', VITE_MAP_API_KEY: 'secret-key' });
    expect(google.id).toBe('placeholder');
    expect(google.requested).toBe('google');
    expect(JSON.stringify(google)).not.toContain('secret-key');
    expect(resolveMapProvider({ VITE_MAP_PROVIDER: 'mapbox' }).notice).toMatch(/needs VITE_MAP_API_KEY/);
  });
});

describe('location service', () => {
  afterEach(removeGeolocation);

  test('a reading is rounded and never throws', async () => {
    stubGeolocation({ granted: true });
    expect(await getCurrentLocation()).toEqual({ ok: true, point: { latitude: 14.551, longitude: 121.05 } });
    expect(await checkPermission()).toBe('granted');
  });

  test('denied, timeout, and unsupported are answers, not errors', async () => {
    stubGeolocation({ granted: false, code: 1 });
    expect(await getCurrentLocation()).toEqual({ ok: false, reason: 'DENIED' });
    stubGeolocation({ granted: false, code: 3 });
    expect(await getCurrentLocation()).toEqual({ ok: false, reason: 'TIMEOUT' });
    removeGeolocation();
    expect(await getCurrentLocation()).toEqual({ ok: false, reason: 'UNSUPPORTED' });
    expect(await checkPermission()).toBe('unsupported');
  });
});

describe('Nearby GORA Games', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    signIn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    removeGeolocation();
  });

  test('auto acceptance updates the discovery card to a confirmed player with fresh capacity', async () => {
    fakeApi(() => found([game({ autoAccept: true })]));
    const previousFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (init?.method === 'POST') return jsonResponse(201, { id: 'request', gameId: GAME_A, status: 'ACCEPTED' });
      if (path.endsWith('/players/me')) return jsonResponse(200, { gameId: GAME_A, status: 'ACTIVE' });
      if (path.endsWith('/players')) return jsonResponse(200, { gameId: GAME_A, players: [], currentPlayers: 9 });
      if (path.endsWith(`/games/${GAME_A}`)) return jsonResponse(200, game({ autoAccept: true, isPlayer: true, currentPlayers: 9, remainingSlots: 3 }));
      return previousFetch(url, init);
    });
    const { wrapper } = mountSection();
    await flushPromises();
    useDiscoveryStore().setViewMode('LIST');
    await flushPromises();
    await wrapper.get('.found-game__button--primary').trigger('click');
    const modal = wrapper.findComponent({ name: 'JoinRequestModal' });
    expect(modal.props('autoAccept')).toBe(true);
    modal.vm.$emit('send', null);
    await flushPromises();
    expect(wrapper.get('.found-game__button--primary').text()).toBe("You're playing");
    expect(wrapper.text()).toContain('Players: 9/12');
    expect(useDiscoveryStore().games[0].myJoinRequestStatus).toBe('ACCEPTED');
  });

  test('loads real games from the discovery API', async () => {
    const queries = fakeApi(() => found([game(), game({ id: GAME_B, title: 'Morning Hoops' })]));
    const { wrapper } = mountSection();
    await flushPromises();

    expect(wrapper.text()).toContain('Nearby GORA Games');
    expect(queries).toHaveLength(1);
    expect(queries[0].get('latitude')).toBeNull();
    expect(wrapper.findAll('.map-canvas__marker')).toHaveLength(1);
    expect(wrapper.find('.map-canvas__count').text()).toBe('2');
  });

  test('the sport filter sends the sport id', async () => {
    const queries = fakeApi(() => found([game()]));
    const { wrapper } = mountSection();
    await flushPromises();

    await wrapper.find('select[aria-label="Sport"]').setValue('Volleyball');
    await flushPromises();

    expect(useFiltersStore().sport).toBe('Volleyball');
    expect(queries.at(-1)?.get('sportId')).toBe(VOLLEYBALL);
  });

  test('the date filter sends presets and a custom date', async () => {
    const queries = fakeApi(() => found([game()]));
    const { wrapper } = mountSection();
    await flushPromises();

    const chip = (label: string) => wrapper.findAll('.nearby__chip').find((button) => button.text() === label)!;
    await chip('Tomorrow').trigger('click');
    await flushPromises();
    expect(queries.at(-1)?.get('date')).toBe('tomorrow');

    await chip('This Week').trigger('click');
    await flushPromises();
    expect(queries.at(-1)?.get('date')).toBe('this-week');

    await chip('Custom Date').trigger('click');
    await flushPromises();
    await wrapper.find('input[type="date"]').setValue('2026-10-10');
    await flushPromises();
    expect(queries.at(-1)?.get('date')).toBe('2026-10-10');
  });

  test('the distance filter sends a radius around the device location', async () => {
    stubGeolocation({ granted: true });
    const queries = fakeApi(() => found([game()]));
    const { wrapper } = mountSection();
    await flushPromises();

    await wrapper.find('select[aria-label="Distance"]').setValue('10');
    await flushPromises();

    const last = queries.at(-1)!;
    expect(last.get('distanceKm')).toBe('10');
    expect(last.get('latitude')).toBe('14.551');
    expect(last.get('longitude')).toBe('121.05');
    expect(wrapper.text()).toContain('Within 10 km');
  });

  test('Map and List show the same results', async () => {
    fakeApi(() => found([game(), game({ id: GAME_C, title: 'No Pin Game', latitude: null, longitude: null, distanceKm: null })]));
    const { wrapper } = mountSection();
    await flushPromises();

    expect(wrapper.findAll('.map-canvas__marker')).toHaveLength(1);
    expect(wrapper.text()).toContain('1 game has no map position');

    const listTab = wrapper.findAll('.segment-tabs__tab').find((tab) => tab.text() === 'List')!;
    await listTab.trigger('click');

    const titles = wrapper.findAll('.found-game__title').map((title) => title.text());
    expect(titles).toEqual(['Sunset Volleyball', 'No Pin Game']);
  });

  test('tapping a marker shows its preview, and View Game opens Game Details', async () => {
    fakeApi(() => found([game()]));
    const { wrapper, push } = mountSection();
    await flushPromises();

    await wrapper.find('.map-canvas__marker').trigger('click');
    const preview = wrapper.find('.discovery-map__preview');
    expect(preview.text()).toContain('Today • 6:00 PM');
    expect(preview.text()).toContain('BGC Court');
    expect(preview.text()).toContain('1.2 km away');
    expect(preview.text()).toContain('Players: 8/12');
    expect(preview.text()).toContain('Hosted by @juan');

    const view = preview.findAll('button').find((button) => button.text() === 'View Game')!;
    await view.trigger('click');
    expect(push).toHaveBeenCalledWith(`/games/${GAME_A}`);
  });

  test('Request to Join reflects the viewer state', async () => {
    fakeApi(() =>
      found([
        game(),
        game({ id: GAME_B, title: 'Pending One', myJoinRequestStatus: 'PENDING' }),
        game({ id: GAME_C, title: 'My Own', isHost: true }),
      ]),
    );
    const { wrapper } = mountSection();
    await flushPromises();
    useDiscoveryStore().setViewMode('LIST');
    await flushPromises();

    const joinButtons = wrapper.findAll('.found-game__button--primary');
    expect(joinButtons.map((button) => button.text())).toEqual(['Request to Join', 'Request Pending', "You're hosting"]);
    expect(joinButtons.map((button) => button.attributes('disabled') !== undefined)).toEqual([false, true, true]);
  });

  test('a denied location keeps sport and date browsing working', async () => {
    stubGeolocation({ granted: false, code: 1 });
    const queries = fakeApi(() => found([game()]));
    const { wrapper } = mountSection();
    await flushPromises();

    expect(wrapper.text()).toContain(LOCATION_UNAVAILABLE_MESSAGE);
    expect(wrapper.text()).not.toContain('Use my location');
    expect(queries.every((query) => query.get('latitude') === null)).toBe(true);
    expect(wrapper.findAll('.map-canvas__marker')).toHaveLength(1);

    await wrapper.find('select[aria-label="Distance"]').setValue('5');
    await flushPromises();
    expect(queries.at(-1)?.get('distanceKm')).toBeNull();
    expect(wrapper.text()).toContain('Distance needs your location');
  });

  test('shows the empty state', async () => {
    fakeApi(() => found([]));
    const { wrapper } = mountSection();
    await flushPromises();

    expect(wrapper.text()).toContain('No GORA games found nearby.');
    expect(wrapper.text()).toContain('Try increasing the distance or selecting another date.');
  });

  test('shows a loading state while the search runs', async () => {
    let release: (response: Response) => void = () => undefined;
    fakeApi(() => new Promise<Response>((resolve) => (release = resolve)));
    const { wrapper } = mountSection();
    await flushPromises();

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);

    release(found([game()]));
    await flushPromises();
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false);
  });

  test('a server error shows a safe message with Try again', async () => {
    fakeApi(() => jsonResponse(500, { success: false, message: 'PrismaClientKnownRequestError at line 12' }));
    const { wrapper } = mountSection();
    await flushPromises();

    const alert = wrapper.find('.nearby__error');
    expect(alert.text()).toContain('Something went wrong on our side');
    expect(alert.text()).not.toContain('Prisma');
  });
});

describe('GameDiscoveryMap', () => {
  test('several sports at one place share a marker and switch in the preview', async () => {
    const volleyball = game();
    const basketball = game({
      id: GAME_B,
      title: 'Hoops',
      sport: { id: BASKETBALL, name: 'Basketball', iconUrl: null },
      startTime: '19:00',
    });
    const wrapper = mount(GameDiscoveryMap, {
      props: { games: [volleyball, basketball], center: HERE, radiusKm: 5, selectedGameId: GAME_A },
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    });

    expect(wrapper.find('.map-canvas__marker').text()).toContain('🏐');
    expect(wrapper.find('.map-canvas__marker').text()).toContain('🏀');
    expect(wrapper.find('.map-canvas__ring').exists()).toBe(true);

    const tabs = wrapper.findAll('.discovery-map__place-game');
    expect(tabs).toHaveLength(2);
    await tabs[1].trigger('click');
    expect(wrapper.emitted('select')?.at(-1)).toEqual([GAME_B]);
  });
});
