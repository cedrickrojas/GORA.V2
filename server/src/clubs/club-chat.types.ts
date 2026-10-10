import type { ClubMemberRole, MessageType } from '../generated/prisma/client';
import type { ClubChatPermissions } from './club-permissions';

export interface ClubChatSender {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface ClubChatMessageView {
  id: string;
  conversationId: string;
  sender: ClubChatSender;
  content: string;
  messageType: MessageType;
  createdAt: Date;
}

export interface ClubChatClubView {
  id: string;
  slug: string;
  name: string;
  sport: string | null;
  profileImageUrl: string | null;
  isPublic: boolean;
}

/** The official club chat as one ACTIVE member sees it. */
export interface ClubChatView {
  id: string;
  type: 'CLUB';
  club: ClubChatClubView;
  /** ACTIVE members of the club, counted, never stored. */
  memberCount: number;
  viewer: {
    role: ClubMemberRole;
    permissions: ClubChatPermissions;
  };
  lastMessage: ClubChatMessageView | null;
  /** Messages from others since the viewer last read the chat (or joined the club). */
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Oldest to newest. nextCursor fetches the page before this one. */
export interface ClubChatMessagePage {
  messages: ClubChatMessageView[];
  nextCursor: string | null;
}
