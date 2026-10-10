import type { PostVisibility } from '@/types/post';
import type { ApiReel, ApiReelPage, CreateReelInput, UpdateReelInput } from '@/types/reel';
import { ApiError, API_PREFIX, NETWORK_ERROR_MESSAGE, apiRequest } from './api-client';
import { getApiBaseUrl } from './api-config';

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

export interface ReelUploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** XMLHttpRequest exposes actual upload progress; the browser sets the multipart boundary. */
export function uploadReel(
  token: string,
  video: File,
  input: Omit<CreateReelInput, 'videoUrl' | 'thumbnailUrl'>,
  options: ReelUploadOptions = {},
): Promise<ApiReel> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const finish = () => options.signal?.removeEventListener('abort', abort);
    if (options.signal?.aborted) {
      reject(new ApiError(0, 'Upload canceled.'));
      return;
    }
    const body = new FormData();
    body.append('video', video);
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) body.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    }
    request.open('POST', `${getApiBaseUrl()}${API_PREFIX}/reels/upload`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Accept', 'application/json');
    request.timeout = 10 * 60 * 1000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      finish();
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new ApiError(request.status || 502, 'Upload failed. Please try again.'));
        return;
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload as ApiReel);
      } else {
        const message =
          typeof payload === 'object' && payload !== null && 'message' in payload
            ? (payload as { message: unknown }).message
            : null;
        reject(
          new ApiError(
            request.status,
            request.status === 413
              ? 'Videos must be 50 MB or smaller.'
              : typeof message === 'string'
                ? message
                : Array.isArray(message)
                  ? message.join(' ')
                  : 'Upload failed. Please try again.',
          ),
        );
      }
    };
    request.onerror = request.ontimeout = () => {
      finish();
      reject(new ApiError(0, NETWORK_ERROR_MESSAGE));
    };
    request.onabort = () => {
      finish();
      reject(new ApiError(0, 'Upload canceled.'));
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    request.send(body);
  });
}

export function updateReel(token: string, reelId: string, input: UpdateReelInput): Promise<ApiReel> {
  return apiRequest<ApiReel>(reel(reelId), { method: 'PATCH', body: input, token });
}

export function updateReelVisibility(
  token: string,
  reelId: string,
  visibility: PostVisibility,
  customViewerIds: string[],
): Promise<ApiReel> {
  const body = visibility === 'CUSTOM' ? { visibility, customViewerIds } : { visibility };
  return apiRequest<ApiReel>(`${reel(reelId)}/visibility`, { method: 'PATCH', body, token });
}

export function deleteReel(token: string, reelId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest<{ id: string; deleted: true }>(reel(reelId), { method: 'DELETE', token });
}

export function setReelLike(token: string, reelId: string, liked: boolean): Promise<ApiReel> {
  return apiRequest<ApiReel>(`${reel(reelId)}/like`, { method: liked ? 'PUT' : 'DELETE', token });
}
