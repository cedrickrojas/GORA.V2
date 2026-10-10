import { FakeUpload } from './helpers/fake-upload';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '@/services/api-client';
import { uploadReel } from '@/services/reels-api.service';
import { useAuthStore } from '@/stores/auth';
import { useReelsStore } from '@/stores/reels';
import type { ApiReel } from '@/types/reel';
import { toHighlight, toReel } from '@/utils/media-api';
import { REEL_VIDEO_MAX_BYTES, validateReelVideo } from '@/utils/reel-upload';

const ME = '11111111-1111-4111-8111-111111111111';
const FRIEND = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const file = () => new File(['video bytes'], 'game.webm', { type: 'video/webm' });
const saved: ApiReel = {
  id: ID,
  author: { id: ME, username: 'player', firstName: 'Play', lastName: 'Er', profileImageUrl: null },
  videoUrl: `/api/v1/reels/${ID}/video?token=scoped-token`,
  thumbnailUrl: null,
  caption: 'Game winner',
  visibility: 'CUSTOM',
  durationSeconds: 13,
  sport: null,
  club: null,
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  likedByViewer: false,
  createdAt: '2026-10-10T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z',
};

function signIn(id = ME, token = 'token') {
  const auth = useAuthStore();
  auth.accessToken = token;
  auth.currentUser = {
    id,
    username: 'player',
    firstName: 'Play',
    lastName: 'Er',
    profileImageUrl: null,
    email: 'player@example.test',
    role: 'USER',
    bio: null,
    city: null,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  FakeUpload.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeUpload);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('video upload transport', () => {
  test('sends a real multipart file with auth, audience and actual progress', async () => {
    const onProgress = vi.fn();
    const result = uploadReel(
      'private-token',
      file(),
      { visibility: 'CUSTOM', customViewerIds: [FRIEND], caption: 'Game winner', durationSeconds: 13 },
      { onProgress },
    );
    const request = FakeUpload.instances[0];
    expect(request.url).toBe('/api/v1/reels/upload');
    expect(request.method).toBe('POST');
    expect(request.headers.Authorization).toBe('Bearer private-token');
    expect(request.headers['Content-Type']).toBeUndefined();
    expect(request.body?.get('video')).toBeInstanceOf(File);
    expect(request.body?.get('customViewerIds')).toBe(JSON.stringify([FRIEND]));
    expect(request.body?.get('durationSeconds')).toBe('13');
    request.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 10 });
    expect(onProgress).toHaveBeenCalledWith(40);
    request.respond(201, saved);
    expect(await result).toEqual(saved);
  });

  test.each([400, 401, 413, 500])('propagates HTTP %s instead of treating it as success', async (status) => {
    const result = uploadReel('token', file(), { visibility: 'PUBLIC' });
    const assertion = expect(result).rejects.toMatchObject({ status });
    FakeUpload.instances[0].respond(status, { message: 'Upload rejected.' });
    await assertion;
  });

  test('cancels an upload and skips requests with an already aborted signal', async () => {
    const controller = new AbortController();
    const result = uploadReel('token', file(), { visibility: 'PUBLIC' }, { signal: controller.signal });
    const assertion = expect(result).rejects.toThrow('Upload canceled.');
    controller.abort();
    await assertion;
    await expect(uploadReel('token', file(), { visibility: 'PUBLIC' }, { signal: controller.signal })).rejects.toThrow(
      'Upload canceled.',
    );
    expect(FakeUpload.instances.filter((request) => request.body)).toHaveLength(1);
  });

  test('handles connection errors, timeouts and malformed responses', async () => {
    for (const action of ['onerror', 'ontimeout', 'onload'] as const) {
      const result = uploadReel('token', file(), { visibility: 'PUBLIC' });
      const assertion = expect(result).rejects.toBeInstanceOf(ApiError);
      const request = FakeUpload.instances.at(-1)!;
      request.status = 200;
      request.responseText = '<html>bad gateway</html>';
      request[action]?.();
      await assertion;
    }
  });
});

describe('upload validation and account boundaries', () => {
  test('rejects empty, oversized and unsupported files before uploading', () => {
    expect(validateReelVideo(new File([], 'empty.mp4', { type: 'video/mp4' }))).toContain('empty');
    expect(validateReelVideo(new File(['text'], 'pretend.mp4', { type: 'text/plain' }))).toContain('MP4');
    const oversized = file();
    Object.defineProperty(oversized, 'size', { value: REEL_VIDEO_MAX_BYTES + 1 });
    expect(validateReelVideo(oversized)).toContain('50 MB');
    expect(validateReelVideo(file())).toBeNull();
  });

  test('saves the uploaded reel to Highlights with a playable API URL', async () => {
    signIn();
    const store = useReelsStore();
    const result = store.uploadReel({
      video: file(),
      caption: ' Game winner ',
      sport: '',
      visibility: 'CUSTOM',
      customViewerIds: [FRIEND],
      durationSeconds: 12.5,
    });
    await vi.waitFor(() => expect(FakeUpload.instances).toHaveLength(1));
    expect(FakeUpload.instances[0].body?.get('durationSeconds')).toBe('13');
    expect(FakeUpload.instances[0].body?.get('caption')).toBe('Game winner');
    FakeUpload.instances[0].respond(201, saved);
    expect(await result).toHaveProperty('reel');
    expect(store.myReels[0].videoUrl).toBe(saved.videoUrl);
    expect(toHighlight(toReel(saved)).videoUrl).toBe(store.myReels[0].videoUrl);
  });

  test.each([201, 401])('an old upload response (%s) cannot affect a new account', async (status) => {
    signIn();
    const store = useReelsStore();
    const result = store.uploadReel({
      video: file(),
      caption: '',
      sport: '',
      visibility: 'PUBLIC',
      customViewerIds: [],
      durationSeconds: 1,
    });
    await vi.waitFor(() => expect(FakeUpload.instances).toHaveLength(1));
    signIn(FRIEND, 'new-token');
    FakeUpload.instances[0].respond(status, status === 201 ? saved : { message: 'Expired.' });
    expect(await result).toHaveProperty('error');
    expect(useAuthStore().accessToken).toBe('new-token');
    expect(store.serverReels).toEqual([]);
  });

  test('requires sign in and a video of at most 10 minutes', async () => {
    const draft = {
      video: file(),
      caption: '',
      sport: '',
      visibility: 'PUBLIC' as const,
      customViewerIds: [],
      durationSeconds: 1,
    };
    expect(await useReelsStore().uploadReel(draft)).toEqual({ error: 'Log in to upload a reel.' });
    signIn();
    expect(await useReelsStore().uploadReel({ ...draft, durationSeconds: 601 })).toHaveProperty('error');
    expect(FakeUpload.instances).toHaveLength(0);
  });
});
