import type { FeedPost, PostDraft, PostVisibility } from '@/types/post';
import type { UserSummary } from '@/types/user';

export async function fetchPosts(): Promise<FeedPost[]> {
  // Feed posts must come from the database-backed posts API, never seeded sample content.
  return [];
}

/** Stands in for PATCH /posts/:id/visibility, which only the author may call. */
export async function updatePostVisibility(
  post: FeedPost,
  visibility: PostVisibility,
  customViewerIds: string[],
): Promise<FeedPost> {
  return {
    ...post,
    visibility,
    customViewerIds: visibility === 'CUSTOM' ? [...customViewerIds] : undefined,
  };
}

/** Stands in for PUT /posts/:id/tags, which only the author may call. The list replaces the tags. */
export async function updatePostTags(post: FeedPost, taggedUserIds: string[]): Promise<FeedPost> {
  return { ...post, tags: (post.tags ?? []).filter((person) => taggedUserIds.includes(person.id)) };
}

/**
 * Stands in for POST /posts. Photos stay as local preview URLs until the
 * upload service stores them externally; the database keeps only their URLs.
 */
export async function publishPost(author: UserSummary, draft: PostDraft): Promise<FeedPost> {
  const id = `post-local-${Date.now()}`;

  return {
    id,
    author,
    body: draft.body.trim(),
    sport: draft.sport,
    media: draft.photoUrls.map((url, index) => ({ id: `${id}-media-${index + 1}`, type: 'image', url })),
    visibility: draft.visibility,
    customViewerIds: draft.visibility === 'CUSTOM' ? [...draft.customViewerIds] : undefined,
    tags: [],
    location: draft.location ? { ...draft.location, name: draft.location.name.trim() } : null,
    createdAt: new Date().toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    likedByViewer: false,
  };
}
