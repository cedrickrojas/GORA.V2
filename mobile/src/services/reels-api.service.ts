import type { PostVisibility } from '@/types/post';
import type { ApiReel, ApiReelPage, CreateReelInput, UpdateReelInput } from '@/types/reel';
import type { ApiPostCommentPage, ApiPostComment } from '@/types/post';
import { apiRequest } from './api-client';
import { uploadMedia, type MediaUploadOptions } from './media-upload.service';

/**
 * Reels REST calls. The author comes from the JWT and the server decides who may see each
 * reel (visibleReelsWhere); the client never filters real reels for privacy.
 */

const FEED_PAGE_SIZE = 50;
const reel = (reelId: string) => `/reels/${encodeURIComponent(reelId)}`;

export function listReelFeed(token: string): Promise<ApiReelPage> {
  return apiRequest<ApiReelPage>(`/reels?limit=${FEED_PAGE_SIZE}`, { token });
}

export function listUserReels(token: string, username: string): Promise<ApiReelPage> {
  return apiRequest<ApiReelPage>(`/users/${encodeURIComponent(username)}/reels?limit=${FEED_PAGE_SIZE}`, { token });
}

export function createReel(token: string, input: CreateReelInput): Promise<ApiReel> {
  return apiRequest<ApiReel>('/reels', { method: 'POST', body: input, token });
}

export type { MediaUploadOptions as ReelUploadOptions } from './media-upload.service';

export function uploadReel(
  token: string,
  video: File,
  input: Omit<CreateReelInput, 'videoUrl' | 'thumbnailUrl'>,
  options: MediaUploadOptions = {},
): Promise<ApiReel> {
  return uploadMedia<ApiReel>(
    '/reels/upload',
    token,
    'video',
    video,
    input,
    options,
    'Videos must be 50 MB or smaller.',
  );
}

export function updateReel(token: string, reelId: string, input: UpdateReelInput): Promise<ApiReel> {
  return apiRequest<ApiReel>(reel(reelId), {
    method: 'PATCH',
    body: input,
    token,
  });
}

export function updateReelVisibility(
  token: string,
  reelId: string,
  visibility: PostVisibility,
  customViewerIds: string[],
): Promise<ApiReel> {
  const body = visibility === 'CUSTOM' ? { visibility, customViewerIds } : { visibility };
  return apiRequest<ApiReel>(`${reel(reelId)}/visibility`, {
    method: 'PATCH',
    body,
    token,
  });
}

export function deleteReel(token: string, reelId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest<{ id: string; deleted: true }>(reel(reelId), {
    method: 'DELETE',
    token,
  });
}

export function setReelLike(token: string, reelId: string, liked: boolean): Promise<ApiReel> {
  return apiRequest<ApiReel>(`${reel(reelId)}/like`, {
    method: liked ? 'PUT' : 'DELETE',
    token,
  });
}

export function listReelComments(token: string, reelId: string): Promise<ApiPostCommentPage> {
  return apiRequest<ApiPostCommentPage>(`${reel(reelId)}/comments?limit=50`, { token });
}

export function addReelComment(token: string, reelId: string, content: string): Promise<{ comment: ApiPostComment; reel: ApiReel }> {
  return apiRequest(`${reel(reelId)}/comments`, { method: 'POST', body: { content }, token });
}

export function recordReelShare(token: string, reelId: string): Promise<ApiReel> {
  return apiRequest<ApiReel>(`${reel(reelId)}/shares`, { method: 'POST', token });
}
