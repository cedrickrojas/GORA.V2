import type { MessageAccess, RelationshipState } from '../social/relationship';
import type { UserSportView } from '../sports/sport.types';

/** Counted from ACCEPTED friendships and UserFollow rows with active accounts. */
export interface ProfileStats {
  friends: number;
  followers: number;
  following: number;
}

/**
 * Counted from real rows only, limited to what the viewer may see. A system without data
 * yet simply counts 0; nothing is estimated.
 */
export interface ProfileSections {
  posts: number;
  games: number;
  reels: number;
  stories: number;
  clubs: number;
  /** Completed games the user was credited for. */
  activity: number;
  badges: number;
}

interface ProfileBase {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  bio: string | null;
  city: string | null;
  sports: UserSportView[];
  createdAt: string;
}

export interface OwnProfileView extends ProfileBase {
  isOwnProfile: true;
  /** YYYY-MM-DD. Private: only in the owner's own profile. */
  dateOfBirth: string | null;
  stats: ProfileStats;
  sections: ProfileSections;
}

export interface ProfileRelationship {
  state: Exclude<RelationshipState, 'BLOCKED_BY_THEM' | 'SELF'>;
  messageAccess: MessageAccess;
  canSendFriendRequest: boolean;
}

/**
 * Another user's profile. When the viewer blocked them, only the identity is returned
 * (bio, city, sports, stats, and sections are withheld) so the Unblock button can show.
 */
export interface PublicProfileView extends ProfileBase {
  isOwnProfile: false;
  relationship: ProfileRelationship;
  stats: ProfileStats | null;
  sections: ProfileSections | null;
}
