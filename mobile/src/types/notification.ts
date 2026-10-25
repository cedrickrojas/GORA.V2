import type { UserSummary } from "./user";

export type NotificationType =
  | "GAME_JOIN_REQUEST"
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
  | "NEW_FOLLOWER";

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
}

export interface NotificationsPage {
  items: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
  nextOffset: number;
}
