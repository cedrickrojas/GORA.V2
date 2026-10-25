import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import * as api from '@/services/direct-chat-api.service';
import type { ChatMessage, ConversationSummary } from '@/types/chat';
import { ApiError } from '@/services/api-client';
vi.mock('@/services/direct-chat-api.service', () => ({
  getDirectChat: vi.fn(),
  getDirectMessages: vi.fn(),
  getPins: vi.fn(() => Promise.resolve([])),
  unsendMessage: vi.fn(),
  pinMessage: vi.fn(),
  forwardMessage: vi.fn(),
  sendAttachment: vi.fn(),
  reportMessage: vi.fn(),
}));
const old: ChatMessage = {
  id: 'message',
  conversationId: 'chat',
  senderId: 'alice',
  body: 'Photo',
  sentAt: '2026-10-10T01:00:00Z',
  updatedAt: '2026-10-10T01:00:00Z',
  attachment: { kind: 'image', url: '/private-photo' },
  unsent: false,
  reactions: [{ emoji: '❤️', count: 1, reacted: true }],
};
const removed: ChatMessage = {
  ...old,
  body: 'Message unsent',
  unsent: true,
  attachment: null,
  reactions: [],
  updatedAt: '2026-10-10T02:00:00Z',
};
const summary: ConversationSummary = {
  id: 'chat',
  type: 'DIRECT',
  partner: { id: 'bob', username: 'bob', displayName: 'Bob', avatarUrl: null },
  lastMessage: old.body,
  lastMessageAt: old.sentAt,
  lastMessageSenderId: 'alice',
  unreadCount: 0,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
describe('chat tool persistence and response races', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
    const auth = useAuthStore();
    auth.accessToken = 'alice-token';
    auth.currentUser = {
      id: 'alice',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'QA',
      email: 'alice@example.test',
      role: 'USER',
      profileImageUrl: null,
      bio: null,
      city: null,
    };
    vi.mocked(api.getDirectChat).mockResolvedValue(summary);
    vi.mocked(api.getDirectMessages).mockResolvedValue({
      messages: [old],
      nextCursor: null,
    });
    vi.mocked(api.unsendMessage).mockResolvedValue(removed);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  test('a stale polling response cannot restore an unsent message or its attachment', async () => {
    const pending = deferred<api.DirectMessagePage>();
    const store = useChatStore();
    await store.loadThread('chat');
    vi.mocked(api.getDirectMessages).mockReturnValue(pending.promise);
    const load = store.loadThread('chat');
    await Promise.resolve();
    expect(await store.unsendMessage('chat', 'message')).toBeNull();
    pending.resolve({ messages: [old], nextCursor: null });
    await load;
    expect(store.getMessages('chat')[0]).toMatchObject({
      body: 'Message unsent',
      unsent: true,
      attachment: null,
      reactions: [],
    });
    expect(store.getConversation('chat')?.lastMessage).toBe('Message unsent');
  });
  test('a failed unsend retains the message and attachment', async () => {
    vi.mocked(api.unsendMessage).mockRejectedValue(new ApiError(500, 'Internal server error'));
    const store = useChatStore();
    await store.loadThread('chat');
    expect(await store.unsendMessage('chat', 'message')).toBeTruthy();
    expect(store.getMessages('chat')[0]).toEqual(old);
  });
  test('forwarding caches the new message in its destination without rewriting the source author', async () => {
    const forwarded = {
      ...old,
      id: 'forwarded',
      conversationId: 'destination',
      forwarded: true,
    };
    vi.mocked(api.forwardMessage).mockResolvedValue(forwarded);
    const store = useChatStore();
    await store.loadThread('chat');
    expect(await store.forwardMessage('chat', 'message', 'destination')).toBeNull();
    expect(api.forwardMessage).toHaveBeenCalledWith('alice-token', 'chat', 'message', 'destination');
    expect(store.getMessages('destination')[0]).toEqual(forwarded);
    expect(store.getMessages('chat')[0]).toEqual(old);
  });
  test('does not cache another account’s delayed upload response', async () => {
    const pending = deferred<ChatMessage>();
    vi.mocked(api.sendAttachment).mockReturnValue(pending.promise);
    const store = useChatStore();
    const sending = store.sendAttachment('chat', 'data:image/png;base64,payload');
    useAuthStore().accessToken = 'bob-token';
    pending.resolve(old);
    await sending;
    expect(store.getMessages('chat')).toEqual([]);
    expect(store.pins).toEqual({});
  });
});
