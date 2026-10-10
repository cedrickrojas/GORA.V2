import type { FeedPost, PostDraft, PostVisibility } from '@/types/post';
import type { UserSummary } from '@/types/user';
import { buildMockPosts } from './mock/mock-catalog';
import { mockCurrentUser, mockUsers } from './mock/mock-users';

export async function fetchPosts(): Promise<FeedPost[]> {
  return buildMockPosts(Date.now());
}

/** The API returns tagged people as user summaries; the mock looks them up in the same order. */
function mockPeople(ids: readonly string[]): UserSummary[] {
  const people = new Map([mockCurrentUser, ...Object.values(mockUsers)].map((person) => [person.id, person]));

  return ids.flatMap((id) => people.get(id) ?? []);
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
  return { ...post, tags: mockPeople(taggedUserIds) };
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
    tags: mockPeople(draft.taggedUserIds),
    location: draft.location ? { ...draft.location, name: draft.location.name.trim() } : null,
    createdAt: new Date().toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    likedByViewer: false,
  };
}
