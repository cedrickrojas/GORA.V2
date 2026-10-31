import type { ClubChatMessage } from '@/types/chat';
import type { Club, ClubMemberEntry } from '@/types/club';

/** Clubs are shown only when loaded from the database-backed clubs API. */
export async function fetchClubs(): Promise<Club[]> {
  return [];
}

/** No demo chat history; real club chats use club-chat-api.service. */
export async function fetchDemoClubChats(): Promise<{
  messages: Record<string, ClubChatMessage[]>;
  unread: Record<string, number>;
}> {
  return { messages: {}, unread: {} };
}

/** Active members, as GET /clubs/:id/members will return them. */
export async function fetchClubMembers(clubId: string): Promise<ClubMemberEntry[]> {
  void clubId;
  return [];
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
