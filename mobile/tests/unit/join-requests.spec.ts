import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useGamesStore } from '@/stores/games';
import { useGamePlayersStore } from '@/stores/game-players';
import { useJoinRequestsStore } from '@/stores/join-requests';
import type { HostJoinRequest, JoinRequest } from '@/types/join-request';
import {
  joinRequestAction,
  pastParticipationNote,
  requesterSummary,
  splitHostJoinRequests,
} from '@/utils/join-requests';

const GAME_ID = '44444444-4444-4444-8444-444444444444';
const REQUEST_ID = '55555555-5555-4555-8555-555555555555';

function joinRequest(overrides: Partial<JoinRequest> = {}): JoinRequest {
  return {
    id: REQUEST_ID,
    gameId: GAME_ID,
    userId: 'u-2',
    message: null,
    status: 'PENDING',
    createdAt: '2026-09-30T06:00:00.000Z',
    updatedAt: '2026-09-30T06:00:00.000Z',
    respondedAt: null,
    ...overrides,
  };
}

function hostRequest(overrides: Partial<HostJoinRequest> = {}): HostJoinRequest {
  return {
    ...joinRequest(),
    user: {
      id: 'u-2',
      username: 'mika_d',
      firstName: 'Mika',
      lastName: 'Dela Cruz',
      displayName: 'Mika Dela Cruz',
      profileImageUrl: null,
    },
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
    id: 'u-2',
    username: 'mika_d',
    email: 'mika@example.com',
    firstName: 'Mika',
    lastName: 'Dela Cruz',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: 'Manila',
  };
}

describe('join request button state', () => {
  const open = { isHost: false, isPlayer: false, status: 'OPEN' as const };
  const viewer = (status: 'OPEN' | 'FULL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => ({
    isHost: false,
    isPlayer: false,
    status,
  });

  test('the host never gets a join button', () => {
    expect(joinRequestAction({ isHost: true, isPlayer: false, status: 'OPEN' }, null)).toEqual({ kind: 'host' });
  });

  test('an open game without a request (or after cancelling) offers Request to Join', () => {
    expect(joinRequestAction(open, null)).toEqual({ kind: 'request' });
    expect(joinRequestAction(open, { status: 'CANCELLED' })).toEqual({ kind: 'request' });
  });

  test('the request status decides pending and declined', () => {
    expect(joinRequestAction(open, { status: 'PENDING' })).toEqual({ kind: 'pending' });
    expect(joinRequestAction(open, { status: 'REJECTED' })).toEqual({ kind: 'declined' });
    expect(joinRequestAction(viewer('FULL'), { status: 'PENDING' })).toEqual({ kind: 'pending' });
  });

  test('an ACTIVE player gets the player actions, whatever the request says', () => {
    expect(joinRequestAction({ ...open, isPlayer: true }, { status: 'ACCEPTED' })).toEqual({ kind: 'player' });
    expect(joinRequestAction(viewer('FULL'), { status: 'ACCEPTED' }, { status: 'ACTIVE' })).toEqual({ kind: 'player' });
  });

  test('a player who left or was removed can ask again; fresh participation beats a stale game', () => {
    expect(joinRequestAction({ ...open, isPlayer: true }, { status: 'ACCEPTED' }, { status: 'LEFT' })).toEqual({
      kind: 'request',
    });
    expect(joinRequestAction(open, { status: 'ACCEPTED' }, { status: 'REMOVED' })).toEqual({ kind: 'request' });
    expect(pastParticipationNote({ status: 'LEFT' })).toBe('You left this game.');
    expect(pastParticipationNote({ status: 'REMOVED' })).toBe('The host removed you from this game.');
    expect(pastParticipationNote({ status: 'NOT_A_PLAYER' })).toBeNull();
  });

  test('games that are not OPEN take no new requests', () => {
    expect(joinRequestAction(viewer('FULL'), null)).toEqual({ kind: 'closed', label: 'Game is full' });
    expect(joinRequestAction(viewer('CANCELLED'), { status: 'CANCELLED' })).toEqual({
      kind: 'closed',
      label: 'Game cancelled',
    });
    expect(joinRequestAction(viewer('COMPLETED'), null).kind).toBe('closed');
    expect(joinRequestAction(viewer('ACTIVE'), null).kind).toBe('closed');
  });
});

describe('host request list', () => {
  test('pending oldest first, answered newest answer first', () => {
    const list = [
      hostRequest({ id: 'late', createdAt: '2026-09-30T08:00:00.000Z' }),
      hostRequest({ id: 'old-answer', status: 'REJECTED', respondedAt: '2026-09-30T07:00:00.000Z' }),
      hostRequest({ id: 'early', createdAt: '2026-09-30T05:00:00.000Z' }),
      hostRequest({ id: 'new-answer', status: 'ACCEPTED', respondedAt: '2026-09-30T09:00:00.000Z' }),
    ];

    const sections = splitHostJoinRequests(list);
    expect(sections.pending.map((item) => item.id)).toEqual(['early', 'late']);
    expect(sections.history.map((item) => item.id)).toEqual(['new-answer', 'old-answer']);
  });

  test('the avatar summary uses public profile fields', () => {
    expect(requesterSummary(hostRequest())).toEqual({
      id: 'u-2',
      username: 'mika_d',
      displayName: 'Mika Dela Cruz',
      avatarUrl: null,
    });
  });
});

describe('join requests store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('sends only the message and remembers the server answer', async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith(`/games/${GAME_ID}/join-requests`) && init.method === 'POST') {
        return jsonResponse(201, joinRequest({ message: 'Point guard' }));
      }

      return jsonResponse(404, { message: 'Not found' });
    });
    signIn();
    const store = useJoinRequestsStore();

    const result = await store.createJoinRequest(GAME_ID, '  Point guard  ');

    expect(result).toEqual({ ok: true });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ message: 'Point guard' });
    expect(store.myJoinRequest(GAME_ID)?.status).toBe('PENDING');
    expect(store.submittingGameId).toBeNull();
  });

  test('automatic acceptance refreshes the seated player and server capacity', async () => {
    mockApi((url, init) => {
      if (init.method === 'POST') return jsonResponse(201, joinRequest({ status: 'ACCEPTED' }));
      if (url.endsWith('/players/me')) return jsonResponse(200, { gameId: GAME_ID, status: 'ACTIVE', joinedAt: '2026-10-30T00:00:00Z', completedAt: null });
      if (url.endsWith('/players')) return jsonResponse(200, { gameId: GAME_ID, players: [], currentPlayers: 12 });
      return jsonResponse(200, { id: GAME_ID, isPlayer: true, currentPlayers: 12, remainingSlots: 0, status: 'FULL' });
    });
    signIn();
    const store = useJoinRequestsStore();
    expect(await store.createJoinRequest(GAME_ID, null)).toEqual({ ok: true });
    expect(store.myJoinRequest(GAME_ID)?.status).toBe('ACCEPTED');
    expect(useGamePlayersStore().participationOf(GAME_ID)?.status).toBe('ACTIVE');
    expect(useGamesStore().gameById(GAME_ID)).toMatchObject({ isPlayer: true, currentPlayers: 12, remainingSlots: 0 });
  });

  test('a blank message sends an empty body', async () => {
    const fetchMock = mockApi(() => jsonResponse(201, joinRequest()));
    signIn();

    await useJoinRequestsStore().createJoinRequest(GAME_ID, '   ');

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({});
  });

  test('a second tap while sending is ignored, so only one request goes out', async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    signIn();
    const store = useJoinRequestsStore();

    const first = store.createJoinRequest(GAME_ID, null);
    const second = await store.createJoinRequest(GAME_ID, null);
    release(jsonResponse(201, joinRequest()));

    expect(second.ok).toBe(false);
    expect(await first).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('a duplicate (409) shows the server message and reloads the real state', async () => {
    const fetchMock = mockApi((url, init) => {
      if (init.method === 'POST') {
        return jsonResponse(409, { success: false, message: 'You already asked to join this game.' });
      }

      if (url.endsWith('/join-requests/me')) {
        return jsonResponse(200, { joinRequest: joinRequest() });
      }

      return jsonResponse(404, { message: 'Game not found.' });
    });
    signIn();
    const store = useJoinRequestsStore();

    const result = await store.createJoinRequest(GAME_ID, null);

    expect(result).toEqual({ ok: false, message: 'You already asked to join this game.' });
    await vi.waitFor(() => expect(store.myJoinRequest(GAME_ID)?.status).toBe('PENDING'));
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/join-requests/me'))).toBe(true);
  });

  test('fetches the viewer request, including "none yet"', async () => {
    mockApi(() => jsonResponse(200, { joinRequest: null }));
    signIn();
    const store = useJoinRequestsStore();

    expect(await store.fetchMyJoinRequest(GAME_ID)).toEqual({ ok: true });
    expect(store.myJoinRequest(GAME_ID)).toBeNull();
    expect(store.mineStatus[GAME_ID]).toBe('ready');
  });

  test('cancelling stores the CANCELLED row from the server', async () => {
    const fetchMock = mockApi(() => jsonResponse(200, joinRequest({ status: 'CANCELLED' })));
    signIn();
    const store = useJoinRequestsStore();

    expect(await store.cancelJoinRequest(GAME_ID)).toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/games/${GAME_ID}/join-requests/me/cancel`);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH');
    expect(store.myJoinRequest(GAME_ID)?.status).toBe('CANCELLED');
  });

  test('the host list loads, and a 403 shows the server message', async () => {
    mockApi(() => jsonResponse(200, [hostRequest()]));
    signIn();
    const store = useJoinRequestsStore();

    expect(await store.fetchGameJoinRequests(GAME_ID)).toEqual({ ok: true });
    expect(store.gameJoinRequests(GAME_ID)).toHaveLength(1);

    mockApi(() =>
      jsonResponse(403, { success: false, message: 'Only the host can manage join requests for this game.' }),
    );
    const denied = await store.fetchGameJoinRequests(GAME_ID);
    expect(denied).toEqual({ ok: false, message: 'Only the host can manage join requests for this game.' });
    expect(store.hostStatus[GAME_ID]).toBe('error');
  });

  test('accept and reject replace the row and block overlapping answers', async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);

      if (url.endsWith('/accept') && init.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }

      if (url.endsWith('/reject')) {
        return Promise.resolve(jsonResponse(200, hostRequest({ status: 'REJECTED' })));
      }

      return Promise.resolve(jsonResponse(200, [hostRequest()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    signIn();
    const store = useJoinRequestsStore();
    await store.fetchGameJoinRequests(GAME_ID);

    const accepting = store.acceptJoinRequest(GAME_ID, REQUEST_ID);
    expect(store.actingRequestId).toBe(REQUEST_ID);
    const overlapping = await store.rejectJoinRequest(GAME_ID, REQUEST_ID);
    expect(overlapping.ok).toBe(false);

    release(jsonResponse(200, hostRequest({ status: 'ACCEPTED', respondedAt: '2026-09-30T07:00:00.000Z' })));
    expect(await accepting).toEqual({ ok: true });
    expect(store.gameJoinRequests(GAME_ID)[0].status).toBe('ACCEPTED');
    expect(store.actingRequestId).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/reject'))).toHaveLength(0);
  });

  test('an answer that lost a race (409) reloads the list', async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith('/reject') && init.method === 'PATCH') {
        return jsonResponse(409, { success: false, message: 'This request was cancelled.' });
      }

      return jsonResponse(200, [hostRequest({ status: 'CANCELLED' })]);
    });
    signIn();
    const store = useJoinRequestsStore();

    const result = await store.rejectJoinRequest(GAME_ID, REQUEST_ID);

    expect(result).toEqual({ ok: false, message: 'This request was cancelled.' });
    await vi.waitFor(() => expect(store.gameJoinRequests(GAME_ID)[0]?.status).toBe('CANCELLED'));
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/games/${GAME_ID}/join-requests`))).toBe(true);
  });
});
