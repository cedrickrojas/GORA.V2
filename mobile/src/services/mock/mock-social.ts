import type { ChatMessage, ConversationSummary, MessageRequest } from '@/types/chat';
import type { FriendRequest } from '@/types/friend';
import type { PlayerSummary } from '@/types/player';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/utils/time';
import { mockPlayers } from './mock-catalog';
import { mockCurrentUser, mockUsers } from './mock-users';

const carlo: PlayerSummary = {
  ...mockUsers.carlo,
  primarySport: 'Volleyball',
  city: 'San Juan',
  distanceKm: 5.4,
  followers: 410,
  gamesCompleted: 17,
  featured: false,
};

function player(id: string): PlayerSummary {
  const found = mockPlayers.find((candidate) => candidate.id === id);

  if (!found) {
    throw new Error(`Unknown mock player: ${id}`);
  }

  return { ...found };
}

export function buildMockFriendRequests(referenceMs: number): FriendRequest[] {
  const ago = (offsetMs: number): string => new Date(referenceMs - offsetMs).toISOString();

  return [
    { id: 'friend-req-bea', direction: 'RECEIVED', player: player('user-bea'), mutualFriends: 4, createdAt: ago(2 * DAY_MS) },
    { id: 'friend-req-carlo', direction: 'RECEIVED', player: { ...carlo }, mutualFriends: 1, createdAt: ago(5 * HOUR_MS) },
    { id: 'friend-req-paolo', direction: 'SENT', player: player('user-paolo'), mutualFriends: 2, createdAt: ago(DAY_MS) },
  ];
}

export function buildMockConversations(referenceMs: number): ConversationSummary[] {
  const ago = (offsetMs: number): string => new Date(referenceMs - offsetMs).toISOString();

  return [
    {
      id: 'conv-john',
      type: 'DIRECT',
      partner: mockUsers.john,
      lastMessage: 'See you at 6PM!',
      lastMessageAt: ago(2 * MINUTE_MS),
      unreadCount: 2,
    },
    {
      id: 'conv-maria',
      type: 'DIRECT',
      partner: mockUsers.maria,
      lastMessage: "Let's play tomorrow",
      lastMessageAt: ago(HOUR_MS),
      unreadCount: 0,
    },
    {
      id: 'conv-kim',
      type: 'DIRECT',
      partner: mockUsers.kim,
      lastMessage: 'Sunrise run is still on for Friday.',
      lastMessageAt: ago(DAY_MS),
      unreadCount: 0,
    },
  ];
}

export function buildMockMessages(referenceMs: number): Record<string, ChatMessage[]> {
  const at = (conversationId: string, id: string, senderId: string, body: string, offsetMs: number): ChatMessage => ({
    id,
    conversationId,
    senderId,
    body,
    sentAt: new Date(referenceMs - offsetMs).toISOString(),
  });
  const me = mockCurrentUser.id;

  return {
    'conv-john': [
      at('conv-john', 'msg-john-1', mockUsers.john.id, 'Hi! Are you playing later?', 20 * MINUTE_MS),
      at('conv-john', 'msg-john-2', me, 'Yes, 6PM at Riverside Court.', 15 * MINUTE_MS),
      at('conv-john', 'msg-john-3', mockUsers.john.id, 'Nice, I will bring an extra ball.', 3 * MINUTE_MS),
      at('conv-john', 'msg-john-4', mockUsers.john.id, 'See you at 6PM!', 2 * MINUTE_MS),
    ],
    'conv-maria': [
      at('conv-maria', 'msg-maria-1', me, 'Beach volleyball this weekend?', 2 * HOUR_MS),
      at('conv-maria', 'msg-maria-2', mockUsers.maria.id, "Let's play tomorrow", HOUR_MS),
    ],
    'conv-kim': [at('conv-kim', 'msg-kim-1', mockUsers.kim.id, 'Sunrise run is still on for Friday.', DAY_MS)],
  };
}

export function buildMockMessageRequests(referenceMs: number): MessageRequest[] {
  const ago = (offsetMs: number): string => new Date(referenceMs - offsetMs).toISOString();

  return [
    {
      id: 'msg-req-paolo',
      sender: mockUsers.paolo,
      initialMessage: 'Hi! Can I join your volleyball game?',
      createdAt: ago(30 * MINUTE_MS),
    },
    {
      id: 'msg-req-carlo',
      sender: mockUsers.carlo,
      initialMessage: 'Saw your cross-court highlight. Do you train anywhere near San Juan?',
      createdAt: ago(6 * HOUR_MS),
    },
  ];
}
