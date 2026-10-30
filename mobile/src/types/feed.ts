import type { ApiGame, Game } from './game';
import type { Club } from './club';
import type { FeedPost } from './post';
import type { Reel } from './reel';
import type { UserSummary } from './user';

/**
 * Activity updates are derived on the server from existing rows
 * (GameParticipant.completedAt, UserBadge.unlockedAt, Game.createdAt), not
 * stored as a separate table.
 */
export type FeedActivityKind = 'GAME_COMPLETED' | 'BADGE_UNLOCKED' | 'GAME_JOINED';

export interface FeedActivity {
  id: string;
  actor: UserSummary;
  kind: FeedActivityKind;
  /** "completed Beach Volleyball Cup", "unlocked Social Player". */
  summary: string;
  sport: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** The four Home feed content types. */
export type HomeFeedItem =
  | { type: 'POST'; id: string; at: number; post: FeedPost }
  | { type: 'GAME'; id: string; at: number; game: Game }
  | { type: 'SERVER_GAME'; id: string; at: number; game: ApiGame }
  | { type: 'CLUB'; id: string; at: number; club: Club }
  | { type: 'REEL'; id: string; at: number; reel: Reel }
  | { type: 'ACTIVITY'; id: string; at: number; activity: FeedActivity };

export type HomeFeedItemType = HomeFeedItem['type'];
