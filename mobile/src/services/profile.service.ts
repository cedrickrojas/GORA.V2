import type { Badge } from '@/types/achievement';
import type { ActivityStats } from '@/types/activity';
import type { FollowSummary, PublicProfile, UserProfile } from '@/types/profile';
import { mockActivityStats, mockBadges } from './mock/mock-profile';
import { apiRequest } from './api-client';

/**
 * Profiles are only loaded from the authenticated profiles API. Never substitute a sample
 * profile when a username is missing from the database.
 */
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  void username;
  return null;
}

/** No static account profile; account data comes from GET /profiles/me. */
export async function fetchCurrentProfile(): Promise<UserProfile | null> {
  return null;
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
  return { followersCount: 0, followingCount: 0, followingIds: [] };
}

/** Creates or removes a UserFollow row. The server rejects following yourself. */
export async function setFollowing(userId: string, following: boolean, token: string | null): Promise<boolean> {
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return following;
  const path = `/profiles/id/${encodeURIComponent(userId)}/follow`;
  await apiRequest(path, { method: following ? 'PUT' : 'DELETE', token });
  return following;
}
