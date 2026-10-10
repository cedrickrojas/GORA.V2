import type { ClubChatMessage } from '@/types/chat';
import type { Club, ClubMemberEntry } from '@/types/club';
import { MOCK_CLUB_CHAT_UNREAD, buildMockClubChatMessages } from './mock/mock-club-chats';
import { buildMockClubMembers, buildMockClubs } from './mock/mock-clubs';

/** The demo clubs; clubs created in GORA come from the server (club-api.service). */
export async function fetchClubs(): Promise<Club[]> {
  return buildMockClubs(Date.now());
}

/** Demo club chat history; clubs stored on the server use club-chat-api.service instead. */
export async function fetchDemoClubChats(): Promise<{
  messages: Record<string, ClubChatMessage[]>;
  unread: Record<string, number>;
}> {
  return { messages: buildMockClubChatMessages(Date.now()), unread: { ...MOCK_CLUB_CHAT_UNREAD } };
}

/** Active members, as GET /clubs/:id/members will return them. */
export async function fetchClubMembers(clubId: string): Promise<ClubMemberEntry[]> {
  return buildMockClubMembers(clubId, Date.now());
}

/** Demo clubs only; server clubs join through club-api.service. */
export async function setClubMembership(clubId: string, join: boolean): Promise<void> {
  void clubId;
  void join;
}

/** Creates or removes a ClubFollow row. */
export async function setClubFollow(clubId: string, follow: boolean): Promise<void> {
  void clubId;
  void follow;
}
