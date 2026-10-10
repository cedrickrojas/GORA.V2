import type { PostVisibility } from '@/types/post';
import type { ApiStory, CreateStoryInput } from '@/types/story';
import { apiRequest } from './api-client';
import { uploadMedia, type MediaUploadOptions } from './media-upload.service';

export function uploadStory(
  token: string,
  media: File,
  input: Omit<CreateStoryInput, 'mediaUrl'>,
  options: MediaUploadOptions = {},
): Promise<ApiStory> {
  return uploadMedia<ApiStory>(
    '/stories/upload',
    token,
    'media',
    media,
    input,
    options,
    'Videos must be 50 MB or smaller.',
  );
}

/**
 * Stories REST calls. The author comes from the JWT and the server decides who may see each
 * story (visibleStoriesWhere); the client never filters real stories for privacy.
 */

const story = (storyId: string) => `/stories/${encodeURIComponent(storyId)}`;

export function listActiveStories(token: string): Promise<ApiStory[]> {
  return apiRequest<ApiStory[]>('/stories', { token });
}

export function listMyStories(token: string): Promise<ApiStory[]> {
  return apiRequest<ApiStory[]>('/stories/mine', { token });
}

export function createStory(token: string, input: CreateStoryInput): Promise<ApiStory> {
  return apiRequest<ApiStory>('/stories', {
    method: 'POST',
    body: input,
    token,
  });
}

export function updateStory(token: string, storyId: string, caption: string | null): Promise<ApiStory> {
  return apiRequest<ApiStory>(story(storyId), {
    method: 'PATCH',
    body: { caption },
    token,
  });
}

export function updateStoryVisibility(
  token: string,
  storyId: string,
  visibility: PostVisibility,
  customViewerIds: string[],
): Promise<ApiStory> {
  const body = visibility === 'CUSTOM' ? { visibility, customViewerIds } : { visibility };
  return apiRequest<ApiStory>(`${story(storyId)}/visibility`, {
    method: 'PATCH',
    body,
    token,
  });
}

export function deleteStory(token: string, storyId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest<{ id: string; deleted: true }>(story(storyId), {
    method: 'DELETE',
    token,
  });
}
