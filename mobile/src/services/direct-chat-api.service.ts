import type { ChatMessage, ConversationSummary, MessageReactionEmoji, MessageRequest, OutgoingMessageRequest } from '@/types/chat';
import type { UserSummary } from '@/types/user';
import { apiRequest } from './api-client';

export interface DirectMessagePage {
  messages: ChatMessage[];
  nextCursor: string | null;
}
export interface DirectRequestSnapshot {
  received: MessageRequest[];
  sent: OutgoingMessageRequest[];
}
const thread = (id: string) => `/chat/direct/${encodeURIComponent(id)}`;

export const listDirectChats = (token: string) => apiRequest<ConversationSummary[]>('/chat/direct', { token });
export const listDirectRequests = (token: string) => apiRequest<DirectRequestSnapshot>('/chat/requests', { token });
export const openDirectChat = (token: string, userId: string) =>
  apiRequest<ConversationSummary>(thread(userId), { token, method: 'POST' });
export const getDirectChat = (token: string, id: string) => apiRequest<ConversationSummary>(thread(id), { token });
export const getDirectMessages = (token: string, id: string, before?: string) =>
  apiRequest<DirectMessagePage>(`${thread(id)}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`, {
    token,
  });
export const sendDirectMessage = (token: string, id: string, body: string) =>
  apiRequest<ChatMessage>(`${thread(id)}/messages`, { token, method: 'POST', body: { body } });
export const reactToDirectMessage = (token: string, id: string, messageId: string, emoji: MessageReactionEmoji | null) =>
  apiRequest<ChatMessage>(`${thread(id)}/messages/${encodeURIComponent(messageId)}/reaction`, {
    token,
    method: emoji === null ? 'DELETE' : 'PUT',
    ...(emoji === null ? {} : { body: { emoji } }),
  });
export const readDirectChat = (token: string, id: string) => apiRequest(`${thread(id)}/read`, { token, method: 'PUT' });
export const getDirectRecipient = (token: string, id: string) =>
  apiRequest<UserSummary>(`/chat/recipients/${encodeURIComponent(id)}`, { token });
export const sendDirectRequest = (token: string, id: string, body: string) =>
  apiRequest<OutgoingMessageRequest>(`/chat/requests/${encodeURIComponent(id)}`, {
    token,
    method: 'POST',
    body: { body },
  });
export const acceptDirectRequest = (token: string, id: string) =>
  apiRequest<ConversationSummary>(`/chat/requests/${encodeURIComponent(id)}/accept`, { token, method: 'POST' });
export const rejectDirectRequest = (token: string, id: string) =>
  apiRequest(`/chat/requests/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
