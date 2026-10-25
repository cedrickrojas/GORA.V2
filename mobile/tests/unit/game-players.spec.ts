import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useGamePlayersStore } from '@/stores/game-players';
import { useGamesStore } from '@/stores/games';
import type { GameRoster, RosterPlayer } from '@/types/game-player';
import { buildRosterSlots } from '@/utils/games';
import { rosterPlayerSummary } from '@/utils/join-requests';

const GAME_ID = '44444444-4444-4444-8444-444444444444';

function player(index: number): RosterPlayer {
  return {
    id: `u-${index}`,
    username: `player_${index}`,
    firstName: 'Player',
    lastName: String(index),
    displayName: `Player ${index}`,
    profileImageUrl: null,
    joinedAt: `2026-09-30T0${index}:00:00.000Z`,
  };
}

function roster(players: RosterPlayer[], requiredPlayers = 12): GameRoster {
  return {
    gameId: GAME_ID,
    requiredPlayers,
    currentPlayers: players.length,
    availableSlots: requiredPlayers - players.length,
    status: players.length >= requiredPlayers ? 'FULL' : 'OPEN',
    players,
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
    username: 'player_1',
    email: 'p1@example.com',
    firstName: 'Player',
    lastName: '1',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: 'Manila',
  };
}

describe('roster slots', () => {
  test('3/12: three players, then nine generated Open slots', () => {
    const slots = buildRosterSlots(12, [player(1), player(2), player(3)]);

    expect(slots).toHaveLength(12);
    expect(slots.slice(0, 3).map((slot) => slot.player?.displayName)).toEqual(['Player 1', 'Player 2', 'Player 3']);
    expect(slots.slice(3).every((slot) => slot.player === null)).toBe(true);
    expect(slots.map((slot) => slot.label)).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
    ]);
  });

  test('12/12: no Open slots', () => {
    const players = Array.from({ length: 12 }, (_, index) => player(index + 1));
    expect(buildRosterSlots(12, players).filter((slot) => slot.player === null)).toHaveLength(0);
  });

  test('a player row links with public fields only', () => {
    expect(rosterPlayerSummary(player(1))).toEqual({
      id: 'u-1',
      username: 'player_1',
      displayName: 'Player 1',
      avatarUrl: null,
    });
  });
});

describe('game players store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('loads the roster and the viewer participation from the server', async () => {
    mockApi((url) =>
      url.endsWith('/players/me')
        ? jsonResponse(200, { gameId: GAME_ID, status: 'ACTIVE', joinedAt: '2026-09-30T01:00:00.000Z', completedAt: null })
        : jsonResponse(200, roster([player(1), player(2), player(3)])),
    );
    signIn();
    const store = useGamePlayersStore();

    expect(await store.fetchPlayers(GAME_ID)).toEqual({ ok: true });
    expect(await store.fetchMyParticipation(GAME_ID)).toEqual({ ok: true });
    expect(store.rosterOf(GAME_ID)).toMatchObject({ currentPlayers: 3, availableSlots: 9 });
    expect(store.participationOf(GAME_ID)?.status).toBe('ACTIVE');
  });

  test('leaving sends no body, stores LEFT, and refreshes the count and roster', async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith('/players/me/leave') && init.method === 'PATCH') {
        return jsonResponse(200, { gameId: GAME_ID, status: 'LEFT', joinedAt: null, completedAt: null });
      }

      if (url.endsWith('/players')) {
        return jsonResponse(200, roster([player(2)]));
      }

      return jsonResponse(404, { message: 'Game not found.' });
    });
    signIn();
    const store = useGamePlayersStore();

    expect(await store.leaveGame(GAME_ID)).toEqual({ ok: true });
    const leaveCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/me/leave'));
    expect(leaveCall?.[1]?.body).toBeUndefined();
    expect(store.participationOf(GAME_ID)?.status).toBe('LEFT');
    expect(store.rosterOf(GAME_ID)?.currentPlayers).toBe(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/games/${GAME_ID}`))).toBe(true);
    expect(store.leavingGameId).toBeNull();
  });

  test('a second leave tap while leaving is ignored', async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/me/leave')
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(jsonResponse(200, roster([]))),
    );
    vi.stubGlobal('fetch', fetchMock);
    signIn();
    const store = useGamePlayersStore();

    const first = store.leaveGame(GAME_ID);
    const second = await store.leaveGame(GAME_ID);
    release(jsonResponse(200, { gameId: GAME_ID, status: 'LEFT', joinedAt: null, completedAt: null }));

    expect(second.ok).toBe(false);
    expect(await first).toEqual({ ok: true });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/me/leave'))).toHaveLength(1);
  });

  test('removing stores the roster the server returns and refreshes the game', async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith('/players/u-2/remove') && init.method === 'PATCH') {
        return jsonResponse(200, roster([player(1)], 2));
      }

      return jsonResponse(404, { message: 'Game not found.' });
    });
    signIn();
    const store = useGamePlayersStore();

    expect(await store.removePlayer(GAME_ID, 'u-2')).toEqual({ ok: true });
    expect(store.rosterOf(GAME_ID)).toMatchObject({ currentPlayers: 1, availableSlots: 1, status: 'OPEN' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/games/${GAME_ID}`))).toBe(true);
    expect(store.removingUserId).toBeNull();
  });

  test('a refused removal shows the server message', async () => {
    mockApi((url, init) =>
      init.method === 'PATCH'
        ? jsonResponse(403, { success: false, message: 'Only the host can manage players in this game.' })
        : jsonResponse(200, roster([player(1)])),
    );
    signIn();

    const result = await useGamePlayersStore().removePlayer(GAME_ID, 'u-1');

    expect(result).toEqual({ ok: false, message: 'Only the host can manage players in this game.' });
  });

  test('My Games loads the games you play in', async () => {
    mockApi((url) =>
      url.endsWith('/games/playing') ? jsonResponse(200, []) : jsonResponse(404, { message: 'Not found' }),
    );
    signIn();
    const games = useGamesStore();

    expect(await games.fetchPlayingGames()).toEqual({ ok: true });
    expect(games.playingStatus).toBe('ready');
    expect(games.playingGames).toEqual([]);
  });
});
