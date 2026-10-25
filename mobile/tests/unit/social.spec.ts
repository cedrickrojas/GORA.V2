import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { routes } from '@/router';
import { buildMockConversations, buildMockMessageRequests } from '@/services/mock/mock-social';
import { useChatStore } from '@/stores/chat';
import { useFriendsStore } from '@/stores/friends';
import { conversationFromRequest, countUnread, sortByRecent } from '@/utils/chat';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('routes', () => {
  test('the 7 bottom-navigation pages are top-level routes', () => {
    const tabChildren = routes.find((route) => route.path === '/' && route.meta?.requiresAuth)?.children ?? [];
    const paths = tabChildren.map((route) => route.path);

    for (const path of ['home', 'search', 'discover', 'create', 'reels', 'chat', 'profile']) {
      expect(paths).toContain(path);
    }
    expect(paths).toContain('chat/:conversationId');
  });
});

describe('chat utils', () => {
  test('sorts conversations newest first and totals unread', () => {
    const conversations = buildMockConversations(NOW);
    const reversed = [...conversations].reverse();

    expect(sortByRecent(reversed).map((conversation) => conversation.id)).toEqual(['conv-john', 'conv-maria', 'conv-kim']);
    expect(countUnread(conversations)).toBe(2);
  });

  test('an accepted request becomes a conversation that starts with its message', () => {
    const [request] = buildMockMessageRequests(NOW);
    const { conversation, firstMessage } = conversationFromRequest(request);

    expect(conversation.partner.id).toBe(request.sender.id);
    expect(conversation.lastMessage).toBe(request.initialMessage);
    expect(firstMessage.conversationId).toBe(conversation.id);
    expect(firstMessage.senderId).toBe(request.sender.id);
  });
});

describe('chat store', () => {
  test('accepting a message request moves it into Friends conversations', async () => {
    const chat = useChatStore();
    await chat.load();
    const requestCount = chat.requests.length;

    const conversationId = await chat.acceptRequest('msg-req-paolo');

    expect(conversationId).not.toBeNull();
    expect(chat.requests).toHaveLength(requestCount - 1);
    expect(chat.getConversation(conversationId ?? '')?.partner.username).toBe('paolo');
    expect(chat.getMessages(conversationId ?? '')).toHaveLength(1);
  });

  test('deleting a message request removes it without opening a conversation', async () => {
    const chat = useChatStore();
    await chat.load();
    const conversationCount = chat.conversations.length;

    await chat.deleteRequest('msg-req-carlo');

    expect(chat.requests.some((request) => request.id === 'msg-req-carlo')).toBe(false);
    expect(chat.conversations).toHaveLength(conversationCount);
  });

  test('sending updates the thread and the conversation preview; blank messages are ignored', async () => {
    const chat = useChatStore();
    await chat.load();
    const before = chat.getMessages('conv-maria').length;

    await chat.sendMessage('conv-maria', '   ', Date.now());
    await chat.sendMessage('conv-maria', ' See you at 5! ', Date.now());

    expect(chat.getMessages('conv-maria')).toHaveLength(before + 1);
    expect(chat.getConversation('conv-maria')?.lastMessage).toBe('See you at 5!');
    expect(chat.sortedConversations[0].id).toBe('conv-maria');
  });

  test('opening a conversation clears its unread count', async () => {
    const chat = useChatStore();
    await chat.load();

    chat.markRead('conv-john');

    expect(chat.unreadCount).toBe(0);
    expect(chat.badgeCount).toBe(chat.requests.length);
  });
});

describe('friends store', () => {
  test('splits friend requests into received and sent', async () => {
    const friends = useFriendsStore();
    await friends.load();

    expect(friends.received.map((request) => request.player.username)).toEqual(['bea', 'carlo']);
    expect(friends.sent.map((request) => request.player.username)).toEqual(['paolo']);
  });

  test('accepting a received request adds the player to friends', async () => {
    const friends = useFriendsStore();
    await friends.load();
    const count = friends.friends.length;

    friends.accept('friend-req-bea');

    expect(friends.friends).toHaveLength(count + 1);
    expect(friends.friends[0].username).toBe('bea');
    expect(friends.received).toHaveLength(1);
  });

  test('declining or cancelling removes the request without adding a friend', async () => {
    const friends = useFriendsStore();
    await friends.load();
    const count = friends.friends.length;

    friends.dismiss('friend-req-carlo');
    friends.dismiss('friend-req-paolo');

    expect(friends.requests.map((request) => request.id)).toEqual(['friend-req-bea']);
    expect(friends.friends).toHaveLength(count);
  });
});
