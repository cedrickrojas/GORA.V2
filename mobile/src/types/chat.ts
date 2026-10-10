import type { ClubMemberRole, ClubSummary } from './club';
import type { UserSummary } from './user';

/** Group chats exist only as a club's official chat (CLUB); users never create them. */
export type ConversationType = 'DIRECT' | 'GAME' | 'CLUB';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  /** Actual message author returned by the API, independent of the conversation partner. */
  sender?: UserSummary;
  body: string;
  /** ISO 8601 timestamp. */
  sentAt: string;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  partner: UserSummary;
  lastMessage: string;
  lastMessageSenderId?: string | null;
  /** ISO 8601 timestamp. */
  lastMessageAt: string;
  unreadCount: number;
}

/** A message request the viewer sent to someone who is not a friend (waiting for Accept). */
export interface OutgoingMessageRequest {
  id: string;
  recipient: UserSummary;
  initialMessage: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** What happened when the viewer tried to start a message request. */
export type MessageRequestResult = 'SENT' | 'ALREADY_SENT' | 'THEY_ALREADY_ASKED' | 'EMPTY' | 'ERROR';

/** A first message from someone who is not a friend yet. */
export interface MessageRequest {
  id: string;
  sender: UserSummary;
  initialMessage: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** What the viewer may do in a club chat; derived by the server from their ClubMember role. */
export interface ClubChatPermissions {
  canRead: boolean;
  canSend: boolean;
  canModerate: boolean;
  canManage: boolean;
}

export interface ClubChatClub extends ClubSummary {
  profileImageUrl: string | null;
  isPublic: boolean;
}

export interface ClubChatMessage {
  id: string;
  conversationId: string;
  sender: UserSummary;
  content: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** A club's official chat, as one ACTIVE member sees it. */
export interface ClubChatSummary {
  id: string;
  club: ClubChatClub;
  /** ACTIVE members, counted by the server. */
  memberCount: number;
  role: ClubMemberRole;
  permissions: ClubChatPermissions;
  lastMessage: ClubChatMessage | null;
  unreadCount: number;
  /** ISO 8601 timestamp of the latest activity. */
  updatedAt: string;
}

/** GET /chat/clubs and GET /clubs/:clubId/chat. */
export interface ClubChatApiView {
  id: string;
  type: 'CLUB';
  club: ClubChatClub;
  memberCount: number;
  viewer: { role: ClubMemberRole; permissions: ClubChatPermissions };
  lastMessage: ClubChatApiMessage | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClubChatApiMessage {
  id: string;
  conversationId: string;
  sender: { id: string; username: string; displayName: string; profileImageUrl: string | null };
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';
  createdAt: string;
}

/** GET /clubs/:clubId/chat/messages: oldest to newest; nextCursor loads the page before. */
export interface ClubChatApiPage {
  messages: ClubChatApiMessage[];
  nextCursor: string | null;
}
