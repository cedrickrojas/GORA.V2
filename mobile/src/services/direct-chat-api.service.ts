import type {
  ChatMessage,
  ConversationSummary,
  MessageReactionEmoji,
  MessageRequest,
  OutgoingMessageRequest,
} from '@/types/chat';
import type { UserSummary } from '@/types/user';
import { apiRequest } from './api-client';
import { getApiBaseUrl } from './api-config';

export function normalizeMessage(message: ChatMessage): ChatMessage {
  return message.attachment?.url.startsWith('/')
    ? { ...message, attachment: { ...message.attachment, url: `${getApiBaseUrl()}${message.attachment.url}` } }
    : message;
}
export const sendAttachment = async (token: string, id: string, data: string) =>
  normalizeMessage(
    await apiRequest<ChatMessage>(`${thread(id)}/attachments`, { token, method: 'POST', body: { data } }),
  );
export const unsendMessage = (token: string, id: string, messageId: string) =>
  apiRequest<ChatMessage>(`${thread(id)}/messages/${messageId}`, { token, method: 'DELETE' });
export const pinMessage = async (token: string, id: string, messageId: string, pinned: boolean) =>
  normalizeMessage(
    await apiRequest<ChatMessage>(`${thread(id)}/messages/${messageId}/pin`, {
      token,
      method: 'PUT',
      body: { pinned },
    }),
  );
export const forwardMessage = async (token: string, id: string, messageId: string, conversationId: string) =>
  normalizeMessage(
    await apiRequest<ChatMessage>(`${thread(id)}/messages/${messageId}/forward`, {
      token,
      method: 'POST',
      body: { conversationId },
    }),
  );
export const reportMessage = (token: string, id: string, messageId: string, reason: string, description: string) =>
  apiRequest(`${thread(id)}/messages/${messageId}/report`, { token, method: 'POST', body: { reason, description } });
export const getPins = async (token: string, id: string) =>
  (await apiRequest<ChatMessage[]>(`${thread(id)}/pins`, { token })).map(normalizeMessage);

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
export const getDirectMessages = async (token: string, id: string, before?: string) => {
  const page = await apiRequest<DirectMessagePage>(
    `${thread(id)}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    {
      token,
    },
  );
  return { ...page, messages: page.messages.map(normalizeMessage) };
};
export const sendDirectMessage = (token: string, id: string, body: string) =>
  apiRequest<ChatMessage>(`${thread(id)}/messages`, { token, method: 'POST', body: { body } });
export const reactToDirectMessage = (
  token: string,
  id: string,
  messageId: string,
  emoji: MessageReactionEmoji | null,
) =>
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
