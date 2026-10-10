import type { Badge } from '@/types/achievement';
import type { ActivityStats } from '@/types/activity';
import type { FollowSummary, PublicProfile, UserProfile } from '@/types/profile';
import { buildMockFollowSummary, buildMockProfile, mockActivityStats, mockBadges } from './mock/mock-profile';
import { buildMockPublicProfiles } from './mock/mock-public-profiles';

/**
 * Stands in for GET /users/:username (plus /relationship). Null means "not found", which is
 * also what the server answers when that user blocked the viewer.
 */
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  const key = username.trim().toLowerCase();

  return buildMockPublicProfiles().find((profile) => profile.username === key) ?? null;
}

/** Demo profile (highlights) for the pages whose server data does not exist yet. */
export async function fetchCurrentProfile(): Promise<UserProfile> {
  return buildMockProfile();
}

export async function fetchActivityStats(): Promise<ActivityStats> {
  return { ...mockActivityStats };
}

/** Badge progress and unlock state come precomputed, as the API will send them. */
export async function fetchBadges(): Promise<Badge[]> {
  return mockBadges.map((badge) => ({ ...badge }));
}

export async function fetchFollowSummary(): Promise<FollowSummary> {
  return buildMockFollowSummary();
}

/** Creates or removes a UserFollow row. The server rejects following yourself. */
export async function setFollowing(userId: string, following: boolean): Promise<boolean> {
  void userId;
  return following;
}
