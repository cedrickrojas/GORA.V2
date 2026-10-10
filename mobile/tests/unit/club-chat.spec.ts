import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { routes } from '@/router';
import { mockClubSummaries } from '@/services/mock/mock-clubs';
import { mockCurrentUser } from '@/services/mock/mock-users';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useClubChatStore } from '@/stores/club-chat';
import { useClubsStore } from '@/stores/clubs';
import type { ClubChatApiMessage, ClubChatApiView } from '@/types/chat';
import {
  CLUB_CHAT_MEMBERS_ONLY_MESSAGE,
  CLUB_CHAT_PENDING_MESSAGE,
  clubChatPermissionsForRole,
  clubChatPreview,
  countClubChatUnread,
  getClubChatAccess,
  isServerClubId,
  sortClubChats,
  toClubChatSummary,
} from '@/utils/club-chat';

const SERVER_CLUB = '0b6f1e36-9a51-4f0e-8d0c-2f3b6f7f1a11';
const OTHER_SERVER_CLUB = '5d1c2b7a-3e4f-4a5b-9c6d-7e8f9a0b1c22';

function apiMessage(overrides: Partial<ClubChatApiMessage> = {}): ClubChatApiMessage {
  return {
    id: 'm-1',
    conversationId: 'conv-1',
    sender: { id: 'u-2', username: 'maria', displayName: 'Maria Santos', profileImageUrl: null },
    content: 'Training starts at 6 PM today.',
    messageType: 'TEXT',
    createdAt: '2026-09-30T10:00:00.000Z',
    ...overrides,
  };
}

function apiView(overrides: Partial<ClubChatApiView> = {}): ClubChatApiView {
  return {
    id: 'conv-1',
    type: 'CLUB',
    club: {
      id: SERVER_CLUB,
      slug: 'imus-volley',
      name: 'Imus Volley',
      sport: 'Volleyball',
      profileImageUrl: null,
      isPublic: true,
    },
    memberCount: 12,
    viewer: { role: 'MEMBER', permissions: clubChatPermissionsForRole('MEMBER') },
    lastMessage: apiMessage(),
    unreadCount: 3,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    ...overrides,
  };
}

describe('club chat access rules', () => {
  test('only an ACTIVE membership opens the chat, for every role', () => {
    for (const role of ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'] as const) {
      expect(getClubChatAccess({ role, status: 'ACTIVE' })).toBe('OPEN');
    }
    expect(getClubChatAccess({ role: 'MEMBER', status: 'PENDING' })).toBe('PENDING');
    expect(getClubChatAccess({ role: 'MEMBER', status: 'REMOVED' })).toBe('DENIED');
    expect(getClubChatAccess({ role: 'MEMBER', status: 'BANNED' })).toBe('DENIED');
    expect(getClubChatAccess(null)).toBe('DENIED');
  });

  test('owners and admins manage, moderators moderate, members read and send', () => {
    expect(clubChatPermissionsForRole('OWNER')).toEqual({ canRead: true, canSend: true, canModerate: true, canManage: true });
    expect(clubChatPermissionsForRole('ADMIN')).toMatchObject({ canModerate: true, canManage: true });
    expect(clubChatPermissionsForRole('MODERATOR')).toMatchObject({ canModerate: true, canManage: false });
    expect(clubChatPermissionsForRole('MEMBER')).toEqual({ canRead: true, canSend: true, canModerate: false, canManage: false });
  });

  test('server clubs have UUID ids; demo clubs do not', () => {
    expect(isServerClubId(SERVER_CLUB)).toBe(true);
    expect(isServerClubId(mockClubSummaries.imusVolleyball.id)).toBe(false);
  });

  test('maps API chats, previews the last message, sorts by activity, and totals unread', () => {
    const newer = toClubChatSummary(apiView());
    const older = toClubChatSummary(
      apiView({
        id: 'conv-2',
        club: { ...apiView().club, id: OTHER_SERVER_CLUB, name: 'Other' },
        lastMessage: null,
        unreadCount: 0,
        updatedAt: '2026-09-29T08:00:00.000Z',
      }),
    );

    expect(newer).toMatchObject({ role: 'MEMBER', memberCount: 12, lastMessage: { sender: { displayName: 'Maria Santos' } } });
    expect(clubChatPreview(newer, 'u-9')).toBe('Maria: Training starts at 6 PM today.');
    expect(clubChatPreview(newer, 'u-2')).toBe('You: Training starts at 6 PM today.');
    expect(clubChatPreview(older, 'u-9')).toMatch(/No messages yet/);
    expect(sortClubChats([older, newer]).map((chat) => chat.id)).toEqual(['conv-1', 'conv-2']);
    expect(countClubChatUnread([older, newer])).toBe(3);
  });
});

describe('club chat routes and UI', () => {
  const tabChildren = routes.find((route) => route.path === '/' && route.meta?.requiresAuth)?.children ?? [];
  const paths = tabChildren.map((route) => route.path);

  test('club chats open at /chat/clubs/:clubId next to direct chats', () => {
    expect(paths).toContain('chat/clubs/:clubId');
    expect(paths).toContain('chat/:conversationId');
    expect(paths.filter((path) => /group/i.test(path))).toEqual([]);
  });

  test('nothing in the app offers to create a group chat', () => {
    const sources = import.meta.glob('/src/**/*.{vue,ts}', { query: '?raw', import: 'default', eager: true });
    const offenders = Object.entries(sources)
      .filter(([, text]) => /Create Group|New Group|conversations\/group|chat\/groups/.test(String(text)))
      .map(([file]) => file);

    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});

describe('club chat store (demo clubs)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('lists a chat for every club the viewer is an ACTIVE member of, and none for others', async () => {
    const store = useClubChatStore();
    await store.load();

    const ids = store.chats.map((chat) => chat.club.id);
    expect(ids).toContain(mockClubSummaries.imusVolleyball.id);
    expect(ids).toContain(mockClubSummaries.caviteBasketball.id);
    expect(ids).not.toContain(mockClubSummaries.manilaPickleball.id);
    expect(ids).not.toContain(mockClubSummaries.imusRunning.id);
    expect(store.getChat(mockClubSummaries.imusVolleyball.id)).toMatchObject({ role: 'OWNER', memberCount: 6 });
    expect(store.unreadCount).toBeGreaterThan(0);
  });

  test('opening marks the chat read; members send with their own name', async () => {
    const store = useClubChatStore();
    const clubId = mockClubSummaries.caviteBasketball.id;
    await store.load();

    expect(await store.open(clubId)).toEqual({ status: 'open' });
    expect(store.getChat(clubId)?.unreadCount).toBe(0);
    expect(await store.send(clubId, '   ')).toMatchObject({ ok: false, denied: false });
    expect(await store.send(clubId, '  See you guys!  ')).toEqual({ ok: true });

    const last = store.getMessages(clubId).at(-1);
    expect(last).toMatchObject({ content: 'See you guys!', sender: { id: mockCurrentUser.id } });
    expect(clubChatPreview(store.getChat(clubId)!, store.viewerId(clubId))).toBe('You: See you guys!');
  });

  test('non-members, pending requests, and members who left are kept out', async () => {
    const store = useClubChatStore();
    const clubs = useClubsStore();
    await store.load();

    expect(await store.open(mockClubSummaries.imusRunning.id)).toEqual({
      status: 'denied',
      message: CLUB_CHAT_MEMBERS_ONLY_MESSAGE,
    });

    await clubs.join(mockClubSummaries.manilaPickleball.id, mockCurrentUser);
    expect(clubs.byId(mockClubSummaries.manilaPickleball.id)?.viewerMembership?.status).toBe('PENDING');
    expect(await store.open(mockClubSummaries.manilaPickleball.id)).toEqual({
      status: 'denied',
      message: CLUB_CHAT_PENDING_MESSAGE,
    });

    const cavite = mockClubSummaries.caviteBasketball.id;
    await clubs.leave(cavite, mockCurrentUser);
    expect(store.chats.map((chat) => chat.club.id)).not.toContain(cavite);
    expect(await store.send(cavite, 'Still here?')).toMatchObject({ ok: false, denied: true });
    expect(await store.open('club-does-not-exist')).toEqual({ status: 'missing' });
  });

  test('joining a public club adds its chat', async () => {
    const store = useClubChatStore();
    await store.load();
    await useClubsStore().join(mockClubSummaries.imusRunning.id, mockCurrentUser);

    expect(store.chats.map((chat) => chat.club.id)).toContain(mockClubSummaries.imusRunning.id);
    expect(await store.open(mockClubSummaries.imusRunning.id)).toEqual({ status: 'open' });
  });

  test('the Chat tab badge includes unread club messages', async () => {
    const chat = useChatStore();
    const clubChats = useClubChatStore();
    await Promise.all([chat.load(), clubChats.load()]);

    expect(chat.badgeCount).toBe(chat.unreadCount + chat.requests.length + clubChats.unreadCount);
    expect(clubChats.unreadCount).toBeGreaterThan(0);
  });
});

describe('club chat store (REST API)', () => {
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

  beforeEach(() => {
    setActivePinia(createPinia());
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('lists, opens, and sends through the club chat endpoints with the JWT', async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith('/chat/clubs')) {
        return jsonResponse(200, [apiView()]);
      }

      if (url.endsWith(`/clubs/${SERVER_CLUB}/chat`)) {
        return jsonResponse(200, apiView());
      }

      if (url.endsWith(`/clubs/${SERVER_CLUB}/chat/messages`) && init.method === 'POST') {
        const { content } = JSON.parse(String(init.body)) as { content: string };
        return jsonResponse(201, apiMessage({
          id: 'm-2',
          content,
          sender: { id: 'u-1', username: 'louis_ray', displayName: 'Louis Ray', profileImageUrl: null },
          createdAt: '2026-09-30T11:00:00.000Z',
        }));
      }

      if (url.endsWith(`/clubs/${SERVER_CLUB}/chat/messages`)) {
        return jsonResponse(200, { messages: [apiMessage()], nextCursor: null });
      }

      return jsonResponse(404, { message: 'Not found' });
    });
    const store = useClubChatStore();

    await store.load();
    expect(store.getChat(SERVER_CLUB)).toMatchObject({ unreadCount: 3, memberCount: 12 });

    expect(await store.open(SERVER_CLUB)).toEqual({ status: 'open' });
    expect(store.getChat(SERVER_CLUB)?.unreadCount).toBe(0);
    expect(store.getMessages(SERVER_CLUB)).toHaveLength(1);

    expect(await store.send(SERVER_CLUB, " I'll be there. ")).toEqual({ ok: true });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[1]).toMatchObject({ body: JSON.stringify({ content: "I'll be there." }) });
    expect(new Headers(post?.[1]?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(store.viewerId(SERVER_CLUB)).toBe('u-1');
    expect(store.getChat(SERVER_CLUB)?.lastMessage?.content).toBe("I'll be there.");

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((url) => !/group/i.test(url))).toBe(true);
  });

  test("a 403 from the server shows the server's reason and removes the chat from the list", async () => {
    mockApi((url) =>
      url.endsWith('/chat/clubs')
        ? jsonResponse(200, [apiView()])
        : jsonResponse(403, { message: CLUB_CHAT_MEMBERS_ONLY_MESSAGE }),
    );
    const store = useClubChatStore();
    await store.load();

    expect(await store.open(SERVER_CLUB)).toEqual({ status: 'denied', message: CLUB_CHAT_MEMBERS_ONLY_MESSAGE });
    expect(store.getChat(SERVER_CLUB)).toBeUndefined();
    expect(await store.open(OTHER_SERVER_CLUB)).toMatchObject({ status: 'denied' });
  });

  test('a missing club is a 404, and an oversized message never reaches the server', async () => {
    const fetchMock = mockApi((url) =>
      url.endsWith('/chat/clubs') ? jsonResponse(200, []) : jsonResponse(404, { message: 'Club not found.' }),
    );
    const store = useClubChatStore();
    await store.load();

    expect(await store.open(OTHER_SERVER_CLUB)).toEqual({ status: 'missing' });
    const calls = fetchMock.mock.calls.length;
    expect(await store.send(SERVER_CLUB, 'x'.repeat(2001))).toMatchObject({ ok: false, denied: false });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
