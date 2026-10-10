import type { FollowSummary } from '@/types/profile';

/** Mirrors UserFollow_not_self_check: nobody follows themselves. */
export function canFollow(viewerId: string | null, targetId: string): boolean {
  return viewerId !== null && viewerId !== targetId;
}

/** Following someone never touches Friendship; the two are separate relationships. */
export function applyFollowChange(summary: FollowSummary, userId: string, following: boolean): FollowSummary {
  const isFollowing = summary.followingIds.includes(userId);

  if (isFollowing === following) {
    return summary;
  }

  return {
    ...summary,
    followingCount: summary.followingCount + (following ? 1 : -1),
    followingIds: following
      ? [...summary.followingIds, userId]
      : summary.followingIds.filter((id) => id !== userId),
  };
}
