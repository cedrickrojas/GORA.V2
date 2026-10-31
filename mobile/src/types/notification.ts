import type { UserSummary } from "./user";

export type NotificationType =
  | "GAME_JOIN_REQUEST"
  | "GAME_LEAVE_REQUEST"
  | "GAME_LEAVE_APPROVED"
  | "GAME_LEAVE_REJECTED"
  | "GAME_ATTENDANCE_CONFIRMED"
  | "GAME_NO_SHOW_REPORTED"
  | "GAME_JOIN_ACCEPTED"
  | "GAME_JOIN_REJECTED"
  | "GAME_FULL"
  | "GAME_CANCELLED"
  | "GAME_COMPLETED"
  | "BADGE_UNLOCKED"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "NEW_MESSAGE"
  | "MESSAGE_REQUEST"
  | "POST_LIKE"
  | "POST_COMMENT"
  | "REEL_LIKE"
  | "REEL_COMMENT"
  | "STORY_REPLY"
  | "LIVE_STARTED"
  | "NEW_FOLLOWER"
  | "HELP_REQUEST_RECEIVED"
  | "HELP_REQUEST_UPDATED";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: UserSummary | null;
  title: string;
  body: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  read: boolean;
  /** In-app route to open, when there is one. */
  link: string | null;
  /** Current server-side state for actionable game requests, if applicable. */
  actionStatus?:
    | "join-accepted"
    | "join-rejected"
    | "join-cancelled"
    | "leave-approved"
    | "leave-rejected"
    | "leave-cancelled"
    | "resolved"
    | null;
}

export interface NotificationsPage {
  items: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
  nextOffset: number;
}
