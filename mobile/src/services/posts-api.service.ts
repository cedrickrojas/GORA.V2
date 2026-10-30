import type {
  ApiPost,
  ApiPostPage,
  ApiPostComment,
  ApiPostCommentPage,
  CreatePostInput,
  PostVisibility,
  UpdatePostInput,
} from '@/types/post';
import { apiRequest } from './api-client';

/**
 * Posts REST calls. The author always comes from the JWT, and the server decides who may
 * see each post (visiblePostsWhere); the client never filters real posts for privacy.
 */

const FEED_PAGE_SIZE = 50;
const post = (postId: string) => `/posts/${encodeURIComponent(postId)}`;

export function getPost(token: string, postId: string): Promise<ApiPost> {
  return apiRequest<ApiPost>(post(postId), { token });
}

export function listPostComments(token: string, postId: string, cursor?: string): Promise<ApiPostCommentPage> {
  const query = new URLSearchParams({ limit: '30' });
  if (cursor) query.set('cursor', cursor);
  return apiRequest<ApiPostCommentPage>(`${post(postId)}/comments?${query}`, { token });
}

export function addPostComment(
  token: string,
  postId: string,
  content: string,
): Promise<{ comment: ApiPostComment; post: ApiPost }> {
  return apiRequest(`${post(postId)}/comments`, { method: 'POST', body: { content }, token });
}

export function deletePostComment(token: string, postId: string, commentId: string): Promise<ApiPost> {
  return apiRequest(`${post(postId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', token });
}

export function recordPostShare(token: string, postId: string): Promise<ApiPost> {
  return apiRequest(`${post(postId)}/shares`, { method: 'POST', token });
}

export function listFeed(token: string, scope: 'ALL' | 'FRIENDS' = 'ALL', cursor?: string): Promise<ApiPostPage> {
  const query = new URLSearchParams({ limit: String(FEED_PAGE_SIZE), scope });
  if (cursor) query.set('cursor', cursor);
  return apiRequest<ApiPostPage>(`/posts?${query}`, { token });
}

export function listUserPosts(token: string, username: string, cursor?: string): Promise<ApiPostPage> {
  const query = new URLSearchParams({ limit: String(FEED_PAGE_SIZE) });
  if (cursor) query.set('cursor', cursor);
  return apiRequest<ApiPostPage>(`/users/${encodeURIComponent(username)}/posts?${query}`, { token });
}

export function createPost(token: string, input: CreatePostInput): Promise<ApiPost> {
  return apiRequest<ApiPost>('/posts', { method: 'POST', body: input, token });
}

export function updatePost(token: string, postId: string, input: UpdatePostInput): Promise<ApiPost> {
  return apiRequest<ApiPost>(post(postId), { method: 'PATCH', body: input, token });
}

export function updatePostVisibility(
  token: string,
  postId: string,
  visibility: PostVisibility,
  customViewerIds: string[],
): Promise<ApiPost> {
  const body = visibility === 'CUSTOM' ? { visibility, customViewerIds } : { visibility };
  return apiRequest<ApiPost>(`${post(postId)}/visibility`, { method: 'PATCH', body, token });
}

export function updatePostTags(token: string, postId: string, userIds: string[]): Promise<ApiPost> {
  return apiRequest<ApiPost>(`${post(postId)}/tags`, { method: 'PUT', body: { userIds }, token });
}

export function deletePost(token: string, postId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest<{ id: string; deleted: true }>(post(postId), { method: 'DELETE', token });
}

export function setPostLike(token: string, postId: string, liked: boolean): Promise<ApiPost> {
  return apiRequest<ApiPost>(`${post(postId)}/like`, { method: liked ? 'PUT' : 'DELETE', token });
}

export function setPostFeedback(
  token: string,
  postId: string,
  feedback: 'INTERESTED' | 'NOT_INTERESTED' | null,
): Promise<ApiPost> {
  return apiRequest<ApiPost>(`${post(postId)}/feedback`, {
    method: feedback ? 'POST' : 'DELETE',
    ...(feedback ? { body: { feedback } } : {}),
    token,
  });
}

export function setPostSaved(token: string, postId: string, saved: boolean): Promise<ApiPost> {
  return apiRequest<ApiPost>(`${post(postId)}/save`, { method: saved ? 'PUT' : 'DELETE', token });
}

export function listSavedPosts(token: string): Promise<ApiPostPage> {
  return apiRequest<ApiPostPage>('/posts/saved', { token });
}

export function listArchivedPosts(token: string): Promise<ApiPostPage> {
  return apiRequest<ApiPostPage>('/posts/archived', { token });
}

export function setPostArchived(token: string, postId: string, archived: boolean): Promise<ApiPost> {
  return apiRequest<ApiPost>(`${post(postId)}/archive`, { method: archived ? 'PUT' : 'DELETE', token });
}

export function reportPost(token: string, postId: string, reason: string, description: string): Promise<void> {
  return apiRequest(`${post(postId)}/report`, { method: 'POST', body: { reason, description }, token });
}
