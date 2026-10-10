import type { PlayerSummary } from './player';

export type FriendRequestDirection = 'RECEIVED' | 'SENT';

export interface FriendRequest {
  id: string;
  direction: FriendRequestDirection;
  /** The other person: the sender for RECEIVED, the recipient for SENT. */
  player: PlayerSummary;
  mutualFriends: number;
  /** ISO 8601 timestamp. */
  createdAt: string;
}
