import type { ChatMessage, ConversationSummary, MessageRequest } from '@/types/chat';
import type { FriendRequest } from '@/types/friend';
import {
  buildMockConversations,
  buildMockFriendRequests,
  buildMockMessageRequests,
  buildMockMessages,
} from './mock/mock-social';

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  return buildMockFriendRequests(Date.now());
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  return buildMockConversations(Date.now());
}

export async function fetchMessages(): Promise<Record<string, ChatMessage[]>> {
  return buildMockMessages(Date.now());
}

export async function fetchMessageRequests(): Promise<MessageRequest[]> {
  return buildMockMessageRequests(Date.now());
}
