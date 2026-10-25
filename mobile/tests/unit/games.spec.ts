import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CREATE_ACTIONS } from '@/composables/useCreateMenu';
import { useAuthStore } from '@/stores/auth';
import { useGamesStore } from '@/stores/games';
import type { ApiGame } from '@/types/game';
import {
  deviceMoment,
  diffGameInput,
  emptyGameForm,
  formatClockTime,
  formatGameDay,
  formatGameTimeRange,
  gameToForm,
  isServerGameId,
  splitHostedGames,
  toCreateGameInput,
  validateGameForm,
  type GameForm,
} from '@/utils/game-form';

const GAME_ID = '44444444-4444-4444-8444-444444444444';
const SPORT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = { date: '2026-09-30', time: '14:05' };

function apiGame(overrides: Partial<ApiGame> = {}): ApiGame {
  return {
    id: GAME_ID,
    title: 'Sunday Pickup Basketball',
    description: 'Friendly 5v5.',
    sport: { id: SPORT_ID, name: 'Basketball', iconUrl: null },
    host: {
      id: 'u-1',
      username: 'louis_ray',
      firstName: 'Louis',
      lastName: 'Ray',
      displayName: 'Louis Ray',
      profileImageUrl: null,
    },
    club: null,
    requiredPlayers: 12,
    currentPlayers: 0,
    remainingSlots: 12,
    status: 'OPEN',
    gameDate: '2026-10-04',
    startTime: '18:00',
    endTime: '20:00',
    locationName: 'BGC Court',
    latitude: null,
    longitude: null,
    isHost: true,
    isPlayer: false,
    pendingRequestCount: 0,
    canEdit: true,
    canCancel: true,
    createdAt: '2026-09-30T06:00:00.000Z',
    updatedAt: '2026-09-30T06:00:00.000Z',
    ...overrides,
  };
}

function validForm(overrides: Partial<GameForm> = {}): GameForm {
  return {
    ...emptyGameForm(),
    sportId: SPORT_ID,
    title: 'Sunday Pickup Basketball',
    requiredPlayers: 12,
    gameDate: '2026-10-04',
    startTime: '18:00',
    endTime: '20:00',
    locationName: 'BGC Court',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockApi(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function signIn(): void {
  const auth = useAuthStore();
  auth.accessToken = 'test-token';
  auth.currentUser = {
    id: 'u-1',
    username: 'louis_ray',
    email: 'louis@example.com',
    firstName: 'Louis',
    lastName: 'Ray',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: 'Manila',
  };
}

describe('game form rules', () => {
  test('a complete form is valid and becomes the create payload', () => {
    const form = validForm({ description: '  ', latitude: '14.55', longitude: '121.05' });

    expect(validateGameForm(form, NOW)).toEqual({});
    expect(toCreateGameInput(form)).toEqual({
      sportId: SPORT_ID,
      clubId: null,
      title: 'Sunday Pickup Basketball',
      description: null,
      requiredPlayers: 12,
      gameDate: '2026-10-04',
      startTime: '18:00',
      endTime: '20:00',
      locationName: 'BGC Court',
      latitude: 14.55,
      longitude: 121.05,
    });
  });

  test('flags every required field on an empty form', () => {
    const errors = validateGameForm(emptyGameForm(), NOW);

    expect(Object.keys(errors).sort()).toEqual(
      ['endTime', 'gameDate', 'locationName', 'requiredPlayers', 'sportId', 'startTime', 'title'].sort(),
    );
  });

  test('required players must be a whole number from 1 to 100', () => {
    for (const requiredPlayers of [0, -2, 1.5, 101, 'ten']) {
      expect(validateGameForm(validForm({ requiredPlayers }), NOW).requiredPlayers).toBeDefined();
    }
    expect(validateGameForm(validForm({ requiredPlayers: 1 }), NOW).requiredPlayers).toBeUndefined();
  });

  test('rejects past dates, equal or reversed times, and a start that already passed today', () => {
    expect(validateGameForm(validForm({ gameDate: '2026-09-29' }), NOW).gameDate).toBe(
      'Choose today or a future date.',
    );
    expect(validateGameForm(validForm({ endTime: '18:00' }), NOW).endTime).toBe(
      'End time must be after the start time.',
    );
    expect(validateGameForm(validForm({ endTime: '17:00' }), NOW).endTime).toBeDefined();
    expect(validateGameForm(validForm({ gameDate: '2026-09-30', startTime: '14:00' }), NOW).startTime).toContain(
      'already passed',
    );
    expect(validateGameForm(validForm({ gameDate: '2026-09-30', startTime: '15:00', endTime: '16:00' }), NOW)).toEqual(
      {},
    );
    expect(validateGameForm(validForm({ gameDate: '2027-10-01' }), NOW).gameDate).toContain('365 days');
  });

  test('coordinates are optional, in range, and both or neither', () => {
    expect(validateGameForm(validForm({ latitude: '91', longitude: '121' }), NOW).latitude).toBeDefined();
    expect(validateGameForm(validForm({ latitude: '14', longitude: '-181' }), NOW).longitude).toBeDefined();
    expect(validateGameForm(validForm({ latitude: 'abc', longitude: '121' }), NOW).latitude).toBeDefined();
    expect(validateGameForm(validForm({ latitude: '14.5' }), NOW).longitude).toBe(
      'Give both latitude and longitude, or neither.',
    );
  });

  test('an unchanged schedule is not re-checked against the clock when editing', () => {
    const today = apiGame({ gameDate: '2026-09-30', startTime: '13:00', endTime: '15:00' });
    const form = gameToForm(today);

    expect(validateGameForm(form, NOW, today)).toEqual({});
    expect(validateGameForm({ ...form, startTime: '13:30' }, NOW, today).startTime).toContain('already passed');
  });

  test('an edit sends only what changed, and the schedule as a whole', () => {
    const game = apiGame();
    const same = toCreateGameInput(gameToForm(game));

    expect(diffGameInput(game, same)).toEqual({});
    expect(diffGameInput(game, { ...same, title: 'Evening Hoops' })).toEqual({ title: 'Evening Hoops' });
    expect(diffGameInput(game, { ...same, endTime: '21:00' })).toEqual({
      gameDate: '2026-10-04',
      startTime: '18:00',
      endTime: '21:00',
    });
    expect(diffGameInput(game, { ...same, latitude: 14.5, longitude: 121 })).toEqual({
      latitude: 14.5,
      longitude: 121,
    });
  });

  test('formats the date and times exactly as entered, with no time zone shift', () => {
    expect(formatGameDay('2026-10-04', '2026-09-30')).toBe('Sunday, October 4');
    expect(formatGameDay('2027-01-02', '2026-09-30')).toBe('Saturday, January 2, 2027');
    expect(formatClockTime('00:15')).toBe('12:15 AM');
    expect(formatClockTime('12:00')).toBe('12:00 PM');
    expect(formatGameTimeRange('18:00', '20:00')).toBe('6:00 PM – 8:00 PM');
  });

  test('splits hosted games into upcoming (soonest first) and past or cancelled (newest first)', () => {
    const soon = apiGame({ id: 'a', gameDate: '2026-10-01' });
    const later = apiGame({ id: 'b', gameDate: '2026-10-09' });
    const cancelled = apiGame({ id: 'c', gameDate: '2026-10-05', status: 'CANCELLED' });
    const past = apiGame({ id: 'd', gameDate: '2026-09-20' });

    const sections = splitHostedGames([later, cancelled, past, soon], '2026-09-30');
    expect(sections.upcoming.map((game) => game.id)).toEqual(['a', 'b']);
    expect(sections.past.map((game) => game.id)).toEqual(['c', 'd']);
  });

  test('only UUID ids are GORA games; the device clock gives YYYY-MM-DD and HH:mm', () => {
    expect(isServerGameId(GAME_ID)).toBe(true);
    expect(isServerGameId('game-bgc-1')).toBe(false);
    expect(deviceMoment(new Date(2026, 8, 30, 7, 5))).toEqual({ date: '2026-09-30', time: '07:05' });
  });

  test('the Create menu opens the Create Game form', () => {
    expect(CREATE_ACTIONS.find((action) => action.id === 'GAME')?.route).toBe('/create/game');
  });
});

describe('games store (REST API)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('createGame posts only form fields and adds the game to My Games', async () => {
    signIn();
    const fetchMock = mockApi(() => jsonResponse(201, apiGame()));
    const store = useGamesStore();
    const input = toCreateGameInput(validForm());

    const result = await store.createGame(input);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/games');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual(input);
    expect(body).not.toHaveProperty('hostId');
    expect(body).not.toHaveProperty('status');
    expect(store.hostedGames.map((game) => game.id)).toEqual([GAME_ID]);
    expect(store.gameById(GAME_ID)?.currentPlayers).toBe(0);
  });

  test('createGame shows the server message on a validation or club error', async () => {
    signIn();
    mockApi(() => jsonResponse(403, { message: 'Only active members of this club can host club games.' }));
    const store = useGamesStore();

    const result = await store.createGame(toCreateGameInput(validForm()));

    expect(result).toEqual({ ok: false, message: 'Only active members of this club can host club games.' });
    expect(store.hostedGames).toEqual([]);
  });

  test('fetchGame caches the game and reports a missing one', async () => {
    signIn();
    mockApi((url) =>
      url.endsWith(`/games/${GAME_ID}`) ? jsonResponse(200, apiGame()) : jsonResponse(404, { message: 'Game not found.' }),
    );
    const store = useGamesStore();

    await store.fetchGame(GAME_ID);
    expect(store.detailStatus[GAME_ID]).toBe('ready');
    expect(store.gameById(GAME_ID)?.title).toBe('Sunday Pickup Basketball');

    const missingId = '55555555-5555-4555-8555-555555555555';
    const missing = await store.fetchGame(missingId);
    expect(missing).toEqual({ ok: false, message: 'This game is not available.' });
    expect(store.detailStatus[missingId]).toBe('error');
  });

  test('fetchGames sends the filters as query parameters', async () => {
    signIn();
    const fetchMock = mockApi(() => jsonResponse(200, [apiGame()]));
    const store = useGamesStore();

    await store.fetchGames({ sportId: SPORT_ID, gameDate: 'today' });

    expect(String(fetchMock.mock.calls[0][0])).toContain(`/games?sportId=${SPORT_ID}&gameDate=today`);
    expect(store.listStatus).toBe('ready');
    expect(store.listedGames).toHaveLength(1);
  });

  test('updateGame and cancelGame replace the cached game; cancelling keeps it', async () => {
    signIn();
    mockApi((url, init) => {
      if (url.endsWith('/cancel')) {
        return jsonResponse(200, apiGame({ title: 'Evening Hoops', status: 'CANCELLED', canEdit: false, canCancel: false }));
      }
      if (init.method === 'PATCH') {
        return jsonResponse(200, apiGame({ title: 'Evening Hoops' }));
      }
      return jsonResponse(200, [apiGame()]);
    });
    const store = useGamesStore();
    await store.fetchMyGames();

    const updated = await store.updateGame(GAME_ID, { title: 'Evening Hoops' });
    expect(updated.ok).toBe(true);
    expect(store.hostedGames[0].title).toBe('Evening Hoops');

    const cancelled = await store.cancelGame(GAME_ID);
    expect(cancelled.ok).toBe(true);
    expect(store.hostedGames).toHaveLength(1);
    expect(store.hostedGames[0].status).toBe('CANCELLED');
  });

  test('a 401 ends the session', async () => {
    signIn();
    mockApi(() => jsonResponse(401, { message: 'Unauthorized' }));
    const store = useGamesStore();
    const auth = useAuthStore();

    const result = await store.fetchMyGames();

    expect(result.ok).toBe(false);
    expect(auth.accessToken).toBeNull();
  });
});
