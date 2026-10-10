import type { FeedPost, PostVisibility } from '@/types/post';

export interface PostPrivacyOption {
  id: PostVisibility;
  emoji: string;
  label: string;
  description: string;
}

/** Same order as the Create Post selector. */
export const POST_PRIVACY_OPTIONS: readonly PostPrivacyOption[] = [
  { id: 'PUBLIC', emoji: '🌎', label: 'Public', description: 'Anyone on GORA' },
  { id: 'FRIENDS', emoji: '👥', label: 'Friends', description: 'Your accepted friends' },
  { id: 'CUSTOM', emoji: '⚙️', label: 'Custom', description: 'Only the people you choose' },
  { id: 'ONLY_ME', emoji: '🔒', label: 'Only Me', description: 'Only you' },
];

/** Matches CUSTOM_VIEWERS_MAX on the server. */
export const CUSTOM_VIEWERS_MAX = 100;

export function getPrivacyOption(visibility: PostVisibility): PostPrivacyOption {
  return POST_PRIVACY_OPTIONS.find((option) => option.id === visibility) ?? POST_PRIVACY_OPTIONS[0];
}

/** Who is looking, as far as post privacy is concerned. */
export interface PostViewer {
  id: string;
  friendIds: ReadonlySet<string>;
  /** Blocks in either direction. */
  blockedIds: ReadonlySet<string>;
}

/**
 * Client mirror of the server's visiblePostsWhere, used for mock data only. The API is the
 * real gate: it never sends a post the viewer may not see.
 */
export function canViewPost(post: FeedPost, viewer: PostViewer): boolean {
  if (post.author.id === viewer.id) {
    return true;
  }

  if (viewer.blockedIds.has(post.author.id)) {
    return false;
  }

  switch (post.visibility) {
    case 'PUBLIC':
      return true;
    case 'FRIENDS':
      return viewer.friendIds.has(post.author.id);
    case 'CUSTOM':
      return post.customViewerIds?.includes(viewer.id) ?? false;
    case 'ONLY_ME':
      return false;
  }
}

/**
 * The same audience rules the server applies to posts, stories, and reels; returns an error
 * message or null.
 */
export function validatePostAudience(
  visibility: PostVisibility,
  customViewerIds: readonly string[],
  authorId: string | null,
  subject: 'post' | 'story' | 'reel' = 'post',
): string | null {
  if (visibility !== 'CUSTOM') {
    return customViewerIds.length > 0 ? `Custom viewers can only be chosen for CUSTOM ${subject}s.` : null;
  }

  if (customViewerIds.length === 0) {
    return `Choose at least one person who can see this ${subject}.`;
  }

  if (customViewerIds.length > CUSTOM_VIEWERS_MAX) {
    return `Choose at most ${CUSTOM_VIEWERS_MAX} people.`;
  }

  if (authorId && customViewerIds.includes(authorId)) {
    return `You can always see your own ${subject}; do not add yourself.`;
  }

  return null;
}
