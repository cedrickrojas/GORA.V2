import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { uploadStory } from '@/services/stories-api.service';
import { useAuthStore } from '@/stores/auth';
import { useStoriesStore } from '@/stores/stories';
import type { ApiStory, StoryUploadDraft } from '@/types/story';
import { STORY_PHOTO_MAX_BYTES, STORY_VIDEO_MAX_BYTES, validateStoryFile } from '@/utils/story-upload';
import { FakeUpload } from './helpers/fake-upload';

const ME = '11111111-1111-4111-8111-111111111111';
const FRIEND = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const photo = () => new File(['photo bytes'], 'game.png', { type: 'image/png' });
const saved: ApiStory = {
  id: ID,
  author: { id: ME, username: 'player', firstName: 'Play', lastName: 'Er', profileImageUrl: null },
  mediaType: 'IMAGE',
  mediaUrl: `/api/v1/stories/${ID}/media?token=scoped-token`,
  thumbnailUrl: null,
  caption: 'Game day',
  visibility: 'CUSTOM',
  music: null,
  createdAt: '2026-10-10T00:00:00Z',
  expiresAt: '2026-10-11T00:00:00Z',
};
const draft = (): StoryUploadDraft => ({
  media: photo(),
  caption: ' Game day ',
  visibility: 'CUSTOM',
  customViewerIds: [FRIEND],
});
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

test('uploads a photo as multipart with audience, auth and progress', async () => {
  const onProgress = vi.fn();
  const result = uploadStory(
    'private-token',
    photo(),
    {
      mediaType: 'IMAGE',
      visibility: 'CUSTOM',
      caption: 'Game day',
      customViewerIds: [FRIEND],
    },
    { onProgress },
  );
  const request = FakeUpload.instances[0];
  expect(request.url).toBe('http://localhost:3000/api/v1/stories/upload');
  expect(request.method).toBe('POST');
  expect(request.headers.Authorization).toBe('Bearer private-token');
  expect(request.headers['Content-Type']).toBeUndefined();
  expect(request.body?.get('media')).toBeInstanceOf(File);
  expect(request.body?.get('mediaType')).toBe('IMAGE');
  expect(request.body?.get('customViewerIds')).toBe(JSON.stringify([FRIEND]));
  request.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 10 });
  expect(onProgress).toHaveBeenCalledWith(30);
  request.respond(201, saved);
  expect(await result).toEqual(saved);
});

test.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])(
  'accepts supported %s files',
  (type) => {
    expect(validateStoryFile(new File(['bytes'], 'media', { type }))).toBeNull();
  },
);

test('rejects empty, oversized and unsupported files', () => {
  expect(validateStoryFile(new File([], 'empty.png', { type: 'image/png' }))).toContain('empty');
  expect(validateStoryFile(new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }))).toContain('Choose');
  for (const [type, limit, expected] of [
    ['image/png', STORY_PHOTO_MAX_BYTES, '10 MB'],
    ['video/mp4', STORY_VIDEO_MAX_BYTES, '50 MB'],
  ] as const) {
    const file = new File(['bytes'], 'media', { type });
    Object.defineProperty(file, 'size', { value: limit + 1 });
    expect(validateStoryFile(file)).toContain(expected);
  }
});

test.each(['IMAGE', 'VIDEO'] as const)(
  'saves uploaded %s to the story rail and archive with a usable URL',
  async (mediaType) => {
    signIn();
    const store = useStoriesStore();
    const input = draft();
    if (mediaType === 'VIDEO') input.media = new File(['bytes'], 'game.webm', { type: 'video/webm' });
    const result = store.uploadStory(input);
    const request = FakeUpload.instances[0];
    expect(request.body?.get('mediaType')).toBe(mediaType);
    expect(request.body?.get('caption')).toBe('Game day');
    expect(request.body?.has('senderId')).toBe(false);
    request.respond(201, { ...saved, mediaType });
    expect(await result).toHaveProperty('story');
    expect(store.serverStories[0].media.url).toBe(`http://localhost:3000${saved.mediaUrl}`);
    expect(store.myStories[0].id).toBe(ID);
  },
);

test.each([201, 401])('an old upload response (%s) cannot modify another account', async (status) => {
  signIn();
  const store = useStoriesStore();
  const result = store.uploadStory(draft());
  signIn(FRIEND, 'new-token');
  FakeUpload.instances[0].respond(status, status === 201 ? saved : { message: 'Expired.' });
  expect(await result).toHaveProperty('error');
  expect(store.serverStories).toEqual([]);
  expect(store.myStories).toEqual([]);
  expect(useAuthStore().accessToken).toBe('new-token');
});

test('cancels the upload and keeps failed stories out of the rail', async () => {
  signIn();
  const store = useStoriesStore();
  const controller = new AbortController();
  const result = store.uploadStory(draft(), { signal: controller.signal });
  controller.abort();
  expect(await result).toEqual({ error: 'Upload canceled.' });
  expect(store.serverStories).toEqual([]);
});

test('requires login and valid custom viewers before sending a file', async () => {
  const store = useStoriesStore();
  expect(await store.uploadStory(draft())).toEqual({ error: 'Log in to add a story.' });
  signIn();
  expect(await store.uploadStory({ ...draft(), customViewerIds: ['sample-player'] })).toHaveProperty('error');
  expect(FakeUpload.instances).toHaveLength(0);
});
