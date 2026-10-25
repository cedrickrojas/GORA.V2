import type {
  ClubChatApiMessage,
  ClubChatApiView,
  ClubChatMessage,
  ClubChatPermissions,
  ClubChatSummary,
} from '@/types/chat';
import type { ClubMemberRole, ClubMembership } from '@/types/club';

/** Same limit as the server's SendClubChatMessageDto. */
export const CLUB_CHAT_MESSAGE_MAX_LENGTH = 2000;

/** The server's wording, so demo clubs and real clubs explain access the same way. */
export const CLUB_CHAT_MEMBERS_ONLY_MESSAGE = "Only active club members can use this club's chat.";
export const CLUB_CHAT_PENDING_MESSAGE = "Your request to join hasn't been approved yet. The club chat opens once it is.";
export const CLUB_CHAT_CLOSED_MESSAGE = 'This club is no longer active, so its chat is closed.';
export const CLUB_CHAT_MISSING_MESSAGE = "This club chat isn't available.";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clubs stored in PostgreSQL have UUID ids; the demo clubs use readable ids like "club-imus-volleyball". */
export function isServerClubId(clubId: string): boolean {
  return UUID_PATTERN.test(clubId);
}

export type ClubChatAccess = 'OPEN' | 'PENDING' | 'DENIED';

/** Only an ACTIVE membership opens the chat; PENDING, REMOVED, BANNED, and non-members stay out. */
export function getClubChatAccess(membership: ClubMembership | null | undefined): ClubChatAccess {
  if (membership?.status === 'ACTIVE') {
    return 'OPEN';
  }

  return membership?.status === 'PENDING' ? 'PENDING' : 'DENIED';
}

export function clubChatAccessMessage(access: Exclude<ClubChatAccess, 'OPEN'>): string {
  return access === 'PENDING' ? CLUB_CHAT_PENDING_MESSAGE : CLUB_CHAT_MEMBERS_ONLY_MESSAGE;
}

/** Mirrors server/src/clubs/club-permissions.ts clubChatPermissions for an ACTIVE member. */
export function clubChatPermissionsForRole(role: ClubMemberRole): ClubChatPermissions {
  return {
    canRead: true,
    canSend: true,
    canModerate: role !== 'MEMBER',
    canManage: role === 'OWNER' || role === 'ADMIN',
  };
}

export function toClubChatMessage(message: ClubChatApiMessage): ClubChatMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: {
      id: message.sender.id,
      username: message.sender.username,
      displayName: message.sender.displayName,
      avatarUrl: message.sender.profileImageUrl,
    },
    content: message.content,
    createdAt: message.createdAt,
  };
}

export function toClubChatSummary(view: ClubChatApiView): ClubChatSummary {
  return {
    id: view.id,
    club: view.club,
    memberCount: view.memberCount,
    role: view.viewer.role,
    permissions: view.viewer.permissions,
    lastMessage: view.lastMessage ? toClubChatMessage(view.lastMessage) : null,
    unreadCount: view.unreadCount,
    updatedAt: view.updatedAt,
  };
}

export function clubChatActivityAt(chat: ClubChatSummary): string {
  return chat.lastMessage?.createdAt ?? chat.updatedAt;
}

export function sortClubChats(chats: readonly ClubChatSummary[]): ClubChatSummary[] {
  return [...chats].sort((a, b) => Date.parse(clubChatActivityAt(b)) - Date.parse(clubChatActivityAt(a)));
}

export function countClubChatUnread(chats: readonly ClubChatSummary[]): number {
  return chats.reduce((total, chat) => total + chat.unreadCount, 0);
}

/** "Maria: Training starts at 6 PM today." or "You: See you guys!" */
export function clubChatPreview(chat: ClubChatSummary, viewerId: string | null): string {
  const last = chat.lastMessage;

  if (!last) {
    return 'No messages yet. Say hi to the club!';
  }

  const who = last.sender.id === viewerId ? 'You' : last.sender.displayName.split(' ')[0];
  return `${who}: ${last.content}`;
}
