import type { ClubChatApiMessage, ClubChatApiPage, ClubChatApiView } from '@/types/chat';
import { apiRequest } from './api-client';

/**
 * Official club chat REST calls. The server checks the club, that it is active, and that
 * the signed-in user is an ACTIVE member on every request. There is no call to create a
 * group chat or add people to one: membership alone decides who is in a club chat.
 */

export function getMyClubChats(token: string): Promise<ClubChatApiView[]> {
  return apiRequest<ClubChatApiView[]>('/chat/clubs', { token });
}

export function getClubChat(token: string, clubId: string): Promise<ClubChatApiView> {
  return apiRequest<ClubChatApiView>(`/clubs/${encodeURIComponent(clubId)}/chat`, { token });
}

/** The first page (no cursor) also marks the chat as read. */
export function getClubChatMessages(token: string, clubId: string, before?: string): Promise<ClubChatApiPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return apiRequest<ClubChatApiPage>(`/clubs/${encodeURIComponent(clubId)}/chat/messages${query}`, { token });
}

export function sendClubChatMessage(token: string, clubId: string, content: string): Promise<ClubChatApiMessage> {
  return apiRequest<ClubChatApiMessage>(`/clubs/${encodeURIComponent(clubId)}/chat/messages`, {
    method: 'POST',
    body: { content },
    token,
  });
}
