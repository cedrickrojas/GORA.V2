import type { Badge } from '@/types/achievement';
import type { ActivityStats } from '@/types/activity';
import type { FollowSummary, PublicProfile, UserProfile } from '@/types/profile';
import { buildMockFollowSummary, buildMockProfile, mockActivityStats, mockBadges } from './mock/mock-profile';
import { buildMockPublicProfiles } from './mock/mock-public-profiles';
import { apiRequest } from './api-client';

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
export async function fetchBadges(goraPoints = 0): Promise<Badge[]> {
  return mockBadges.map((badge) => {
    const progress = badge.requirement.metric === 'goraPoints' ? goraPoints : badge.progress;
    return { ...badge, progress, unlocked: progress >= badge.target };
  });
}

export async function fetchFollowSummary(): Promise<FollowSummary> {
  return buildMockFollowSummary();
}

/** Creates or removes a UserFollow row. The server rejects following yourself. */
export async function setFollowing(userId: string, following: boolean, token: string | null): Promise<boolean> {
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return following;
  const path = `/profiles/id/${encodeURIComponent(userId)}/follow`;
  await apiRequest(path, { method: following ? 'PUT' : 'DELETE', token });
  return following;
}
