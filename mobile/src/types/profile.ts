import type { MessageAccess, RelationshipState } from '@/utils/relationship';
import type { PostVisibility } from './post';
import type { UserSummary } from './user';

export interface SportProfile {
  id: string;
  name: string;
  role: string;
}

export interface Highlight {
  id: string;
  videoUrl?: string | null;
  title: string;
  sport: string;
  durationSeconds: number;
  views: number;
  /** Set for reels stored in PostgreSQL; demo highlights have neither. */
  visibility?: PostVisibility;
  fromServer?: boolean;
}

export interface UserProfile extends UserSummary {
  headline: string;
  /** Short intro under the name (User.bio, up to 160 characters). */
  bio: string | null;
  /** Uploaded cover link or external image URL; null shows the default cover. */
  coverImageUrl: string | null;
  sports: SportProfile[];
  highlights: Highlight[];
}

/**
 * Another user's profile as the viewer may see it. Counts come from the server; profile
 * privacy settings are separate and not built yet, so every field here is public.
 */
export interface PublicProfile extends UserSummary {
  firstName: string;
  lastName: string;
  bio: string | null;
  city: string | null;
  coverImageUrl: string | null;
  sports: SportProfile[];
  friendsCount: number;
  followersCount: number;
  followingCount: number;
  gamesCompleted: number;
  badgesUnlocked: number;
}

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL';

/** An active sport from GET /sports. */
/** A row of the server's central Sport table (GET /sports). The id is the identity, never the name or icon. */
export interface SportOption {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
}

/** A UserSport row as the API returns it. */
export interface UserSportEntry {
  sportId: string;
  name: string;
  iconUrl: string | null;
  skillLevel: SkillLevel;
  position: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Counted by the server from ACCEPTED friendships and UserFollow rows. */
export interface ProfileStats {
  friends: number;
  followers: number;
  following: number;
}

/** Real counts limited to what the viewer may see; 0 where a system has no data yet. */
export interface ProfileSections {
  posts: number;
  games: number;
  reels: number;
  stories: number;
  clubs: number;
  activity: number;
  badges: number;
}

interface ProfileDetailsBase {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  bio: string | null;
  city: string | null;
  sports: UserSportEntry[];
  createdAt: string;
}

/** What a profile header shows. */
export type ProfileIdentity = Pick<
  ProfileDetailsBase,
  'id' | 'username' | 'firstName' | 'lastName' | 'displayName' | 'profileImageUrl' | 'coverImageUrl' | 'bio' | 'city'
>;

/** GET /profiles/me. */
export interface OwnProfile extends ProfileDetailsBase {
  isOwnProfile: true;
  /** YYYY-MM-DD; private to the owner. */
  dateOfBirth: string | null;
  stats: ProfileStats;
  sections: ProfileSections;
}

export interface ProfileRelationship {
  state: Exclude<RelationshipState, 'SELF'>;
  messageAccess: MessageAccess;
  canSendFriendRequest: boolean;
}

/** GET /profiles/:username for someone else. Stats and sections are null when the viewer blocked them. */
export interface OtherProfile extends ProfileDetailsBase {
  isOwnProfile: false;
  relationship: ProfileRelationship;
  stats: ProfileStats | null;
  sections: ProfileSections | null;
}

/** PATCH /profiles/me. Omitted fields are unchanged; null clears an optional field. */
export interface ProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  bio?: string | null;
  city?: string | null;
  dateOfBirth?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
}

export interface AddSportInput {
  sportId: string;
  skillLevel: SkillLevel;
  position?: string | null;
}

export interface UpdateSportInput {
  skillLevel?: SkillLevel;
  position?: string | null;
}

/** Counted by the server from UserFollow rows. */
export interface FollowSummary {
  followersCount: number;
  followingCount: number;
  /** Ids of accounts the viewer follows; drives the Following reels tab. */
  followingIds: string[];
}
