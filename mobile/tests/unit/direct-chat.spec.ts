import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useSessionStore } from '@/stores/session';
import type { ChatMessage, ConversationSummary } from '@/types/chat';
import { directChatPreview } from '@/utils/chat';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CHAT = '33333333-3333-4333-8333-333333333333';
const REQUEST = '44444444-4444-4444-8444-444444444444';
const alice = { id: ALICE, username: 'alice', displayName: 'Alice Player', avatarUrl: null };
const bob = { id: BOB, username: 'bob', displayName: 'Bob Player', avatarUrl: null };
const incoming: ChatMessage = {
  id: 'incoming',
  conversationId: CHAT,
  senderId: ALICE,
  sender: alice,
  body: 'Hello Bob',
  sentAt: '2026-10-10T01:00:00Z',
};
const outgoing: ChatMessage = {
  id: 'reply',
  conversationId: CHAT,
  senderId: BOB,
  sender: bob,
  body: 'Hi Alice',
  sentAt: '2026-10-10T01:01:00Z',
};
const conversation = (viewer = BOB): ConversationSummary => ({
  id: CHAT,
  type: 'DIRECT',
  partner: viewer === BOB ? alice : bob,
  lastMessage: incoming.body,
  lastMessageSenderId: ALICE,
  lastMessageAt: incoming.sentAt,
  unreadCount: viewer === BOB ? 1 : 0,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function signIn(id = BOB) {
  const auth = useAuthStore();
  auth.accessToken = id;
  auth.currentUser = {
    id,
    username: id === BOB ? 'bob' : 'alice',
    firstName: id === BOB ? 'Bob' : 'Alice',
    lastName: 'Player',
    email: 'private@example.test',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: null,
  };
  // Deliberately different: the old implementation sent messages as this sample account.
  useSessionStore().currentUser = { id: 'demo-louis', username: 'louis', displayName: 'Louis Demo', avatarUrl: null };
}

function fakeApi() {
  const calls: { path: string; method: string; token?: string; body?: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname.replace('/api/v1', '');
      const method = init.method ?? 'GET';
      const token = (init.headers as Record<string, string>)?.Authorization?.replace('Bearer ', '');
      calls.push({ path, method, token, body: init.body ? (JSON.parse(String(init.body)) as unknown) : undefined });
      const viewer = token === ALICE ? ALICE : BOB;
      if (path === '/chat/direct') return Promise.resolve(json([conversation(viewer)]));
      if (path === '/chat/requests' && method === 'GET') return Promise.resolve(json({ received: [], sent: [] }));
      if (path === `/chat/direct/${CHAT}`) return Promise.resolve(json(conversation(viewer)));
      if (path === `/chat/direct/${CHAT}/messages`)
        return Promise.resolve(json(method === 'POST' ? outgoing : { messages: [incoming], nextCursor: null }));
      if (path === `/chat/direct/${ALICE}`) return Promise.resolve(json(conversation(viewer)));
      if (path === `/chat/requests/${ALICE}`)
        return Promise.resolve(
          json({ id: REQUEST, recipient: alice, initialMessage: 'Hi Alice', createdAt: incoming.sentAt }),
        );
      if (path === `/chat/requests/${REQUEST}/accept`) return Promise.resolve(json(conversation(viewer)));
      if (path === `/chat/recipients/${ALICE}`) return Promise.resolve(json(alice));
      return Promise.resolve(json({ message: 'Not found.' }, 404));
    }),
  );
  return calls;
}

beforeEach(() => {
  setActivePinia(createPinia());
  signIn();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('direct chat identity', () => {
  test('receivers see the real sender in the inbox and message data', async () => {
    fakeApi();
    const chat = useChatStore();
    await chat.load();
    expect(chat.conversations).toHaveLength(1);
    expect(chat.conversations[0].partner.displayName).toBe('Alice Player');
    expect(directChatPreview(chat.conversations[0], BOB)).toBe('Alice Player: Hello Bob');
    await chat.loadThread(CHAT);
    expect(chat.getMessages(CHAT)[0].sender?.displayName).toBe('Alice Player');
    expect(chat.getMessages(CHAT)[0].senderId).toBe(ALICE);
  });

  test('sending uses the JWT and no client-selected sender id', async () => {
    const calls = fakeApi();
    const chat = useChatStore();
    await chat.load();
    expect(await chat.sendMessage(CHAT, ' Hi Alice ')).toBeNull();
    expect(calls.find((call) => call.method === 'POST')).toEqual({
      path: `/chat/direct/${CHAT}/messages`,
      method: 'POST',
      token: BOB,
      body: { body: 'Hi Alice' },
    });
    expect(chat.getMessages(CHAT)[0].sender?.displayName).toBe('Bob Player');
    expect(directChatPreview(chat.conversations[0], BOB)).toBe('You: Hi Alice');
    expect(useSessionStore().me?.id).toBe(BOB);
  });

  test('account switches clear all chat, request and recipient caches before loading the new perspective', async () => {
    fakeApi();
    const chat = useChatStore();
    await chat.load();
    await chat.loadThread(CHAT);
    chat.openRequest(alice);
    await chat.sendMessageRequest(alice, 'Hi Alice', Date.now());
    signIn(ALICE);
    expect(chat.conversations).toEqual([]);
    expect(chat.getMessages(CHAT)).toEqual([]);
    expect(chat.requests).toEqual([]);
    expect(chat.outgoingRequests).toEqual([]);
    expect(chat.requestRecipient(ALICE)).toBeUndefined();
    await chat.load();
    expect(chat.conversations[0].partner.id).toBe(BOB);
    expect(directChatPreview(chat.conversations[0], ALICE)).toBe('You: Hello Bob');
  });

  test.each([200, 401])(
    'late responses (%s) cannot restore another account’s inbox or log out the current account',
    async (status) => {
      let resolve!: (value: Response) => void;
      const pending = new Promise<Response>((yes) => {
        resolve = yes;
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(() => pending),
      );
      const chat = useChatStore();
      const request = chat.refresh();
      signIn(ALICE);
      resolve(json(status === 200 ? [conversation()] : { message: 'Expired' }, status));
      await request;
      expect(chat.conversations).toEqual([]);
      expect(useAuthStore().accessToken).toBe(ALICE);
      expect(chat.error).toBeNull();
    },
  );

  test('request recipients survive refresh without becoming the message sender', async () => {
    fakeApi();
    const chat = useChatStore();
    await chat.loadRecipient(ALICE);
    expect(chat.requestRecipient(ALICE)?.displayName).toBe('Alice Player');
    expect(await chat.sendMessageRequest(alice, 'Hi Alice', Date.now())).toBe('SENT');
    expect(chat.outgoingRequests[0].recipient.id).toBe(ALICE);
    expect(useSessionStore().me?.displayName).toBe('Bob Player');
  });

  test('accepted requests use the receiver’s conversation perspective', async () => {
    fakeApi();
    const chat = useChatStore();
    chat.requests = [{ id: REQUEST, sender: alice, initialMessage: 'Hello Bob', createdAt: incoming.sentAt }];
    expect(await chat.acceptRequest(REQUEST)).toBe(CHAT);
    expect(chat.conversations[0].partner.id).toBe(ALICE);
    expect(chat.requests).toEqual([]);
  });

  test('sample profiles cannot receive real account messages', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const chat = useChatStore();
    expect(await chat.openDirect({ ...alice, id: 'demo-alice' }, Date.now())).toBeNull();
    expect(chat.error).toContain('sample profile');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
