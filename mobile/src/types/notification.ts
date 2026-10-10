import type { UserSummary } from './user';

export type NotificationType =
  | 'JOIN_REQUEST'
  | 'REQUEST_ACCEPTED'
  | 'GAME_COMPLETED'
  | 'BADGE_UNLOCKED'
  | 'FRIEND_REQUEST'
  | 'REEL_LIKED';

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
