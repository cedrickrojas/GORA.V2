import type { Reel } from '@/types/reel';

export type ReelsTab = 'FOLLOWING' | 'FOR_YOU';

export const REELS_TABS: readonly { id: ReelsTab; label: string }[] = [
  { id: 'FOLLOWING', label: 'Following' },
  { id: 'FOR_YOU', label: 'For You' },
];

export const DEFAULT_REELS_TAB: ReelsTab = 'FOR_YOU';

/** Reels from accounts the viewer follows (UserFollow), newest first. */
export function selectFollowingReels(reels: readonly Reel[], followingIds: readonly string[]): Reel[] {
  const followed = new Set(followingIds);

  return reels
    .filter((reel) => followed.has(reel.author.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/**
 * Placeholder order until the recommendation service exists: most viewed
 * first. The server will rank For You from ReelView, likes, shares, follows,
 * and sports; the client only displays the order it receives.
 */
export function selectForYouReels(reels: readonly Reel[]): Reel[] {
  return [...reels].sort((a, b) => b.views - a.views);
}
