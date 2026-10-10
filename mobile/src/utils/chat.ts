import type { ChatMessage, ConversationSummary, MessageRequest } from '@/types/chat';

export type ChatSection = 'FRIENDS' | 'CLUBS' | 'REQUESTS';

/** The conversation title is the other participant; the preview identifies who spoke. */
export function directChatPreview(conversation: ConversationSummary, viewerId: string | null): string {
  if (!conversation.lastMessage) return 'No messages yet.';
  if (!conversation.lastMessageSenderId) return conversation.lastMessage;
  const sender = conversation.lastMessageSenderId === viewerId ? 'You' : conversation.partner.displayName;
  return `${sender}: ${conversation.lastMessage}`;
}

export function sortByRecent(conversations: readonly ConversationSummary[]): ConversationSummary[] {
  return [...conversations].sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
}

export function countUnread(conversations: readonly ConversationSummary[]): number {
  return conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
}

/** Accepting a request opens a normal conversation that starts with the request's message. */
export function conversationFromRequest(request: MessageRequest): {
  conversation: ConversationSummary;
  firstMessage: ChatMessage;
} {
  const conversationId = `conv-${request.sender.id}`;

  return {
    conversation: {
      id: conversationId,
      type: 'DIRECT',
      partner: request.sender,
      lastMessage: request.initialMessage,
      lastMessageAt: request.createdAt,
      unreadCount: 0,
    },
    firstMessage: {
      id: `${request.id}-first`,
      conversationId,
      senderId: request.sender.id,
      body: request.initialMessage,
      sentAt: request.createdAt,
    },
  };
}
