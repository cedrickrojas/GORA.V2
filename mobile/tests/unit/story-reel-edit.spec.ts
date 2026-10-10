import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CREATE_ACTIONS } from '@/composables/useCreateMenu';
import { useAuthStore } from '@/stores/auth';
import { DEMO_PEOPLE_MESSAGE } from '@/stores/posts';
import { REEL_SIGN_IN_MESSAGE, useReelsStore } from '@/stores/reels';
import { STORY_SIGN_IN_MESSAGE, useStoriesStore } from '@/stores/stories';
import type { ApiReel, ReelDraft } from '@/types/reel';
import type { ApiStory, StoryDraft } from '@/types/story';
import { isMediaUrl, toHighlight, toReel, toStory, validateReelDraft, validateStoryDraft } from '@/utils/media-api';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MY_STORY = '33333333-3333-4333-8333-333333333333';
const OTHER_STORY = '44444444-4444-4444-8444-444444444444';
const MY_REEL = '55555555-5555-4555-8555-555555555555';
const OTHER_REEL = '66666666-6666-4666-8666-666666666666';
const BASKETBALL = '77777777-7777-4777-8777-777777777777';

const me = { id: ME, username: 'banana', firstName: 'Ban', lastName: 'Ana', profileImageUrl: null };
const other = { id: OTHER, username: 'mango', firstName: 'Man', lastName: 'Go', profileImageUrl: null };

function apiStory(overrides: Partial<ApiStory> = {}): ApiStory {
  const createdAt = new Date(Date.now() - 60_000).toISOString();

  return {
    id: MY_STORY,
    author: me,
    mediaType: 'IMAGE',
    mediaUrl: 'https://cdn.example.test/story.jpg',
    thumbnailUrl: null,
    caption: 'Game day',
    visibility: 'PUBLIC',
    music: null,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString(),
    customViewers: [],
    ...overrides,
  };
}

function apiReel(overrides: Partial<ApiReel> = {}): ApiReel {
  return {
    id: MY_REEL,
    author: me,
    caption: 'Buzzer beater',
    videoUrl: 'https://cdn.example.test/reel.mp4',
    thumbnailUrl: null,
    durationSeconds: 15,
    sport: { id: BASKETBALL, name: 'Basketball' },
    club: null,
    visibility: 'FRIENDS',
    viewCount: 12,
    likeCount: 3,
    commentCount: 1,
    shareCount: 0,
    likedByViewer: false,
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    customViewers: [],
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** A tiny fake of the stories and reels API; every request is recorded. */
function fakeApi(handlers: Partial<Record<string, (body: unknown) => Response>> = {}) {
  const calls: Call[] = [];
  const myStory = apiStory();
  const otherStory = apiStory({ id: OTHER_STORY, author: other, customViewers: undefined });
  const myReel = apiReel();
  const otherReel = apiReel({ id: OTHER_REEL, author: other, customViewers: undefined });

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://test');
      const path = url.pathname.replace('/api/v1', '');
      const method = init.method ?? 'GET';
      const body: unknown = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });

      const custom = handlers[`${method} ${path}`];
      if (custom) {
        return Promise.resolve(custom(body));
      }

      if (method === 'GET' && path === '/stories') {
        return Promise.resolve(jsonResponse(200, [otherStory, myStory]));
      }
      if (method === 'GET' && path === '/stories/mine') {
        return Promise.resolve(jsonResponse(200, [myStory]));
      }
      if (method === 'GET' && path === '/reels') {
        return Promise.resolve(jsonResponse(200, { reels: [otherReel, myReel], nextCursor: null }));
      }
      if (method === 'GET' && path === '/users/banana/reels') {
        return Promise.resolve(jsonResponse(200, { reels: [myReel], nextCursor: null }));
      }
      if (method === 'GET' && path === '/sports') {
        return Promise.resolve(
          jsonResponse(200, [{ id: BASKETBALL, name: 'Basketball', description: null, iconUrl: null, isActive: true }]),
        );
      }
      return Promise.resolve(jsonResponse(404, { success: false, message: 'Not found.' }));
    }),
  );

  return calls;
}

function signIn(): void {
  const auth = useAuthStore();
  auth.accessToken = 'test-token';
  auth.currentUser = {
    id: ME,
    username: 'banana',
    email: 'banana@example.com',
    firstName: 'Ban',
    lastName: 'Ana',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: 'Manila',
  };
}

function storyDraft(overrides: Partial<StoryDraft> = {}): StoryDraft {
  return {
    mediaType: 'IMAGE',
    mediaUrl: 'https://cdn.example.test/new.jpg',
    caption: '',
    visibility: 'PUBLIC',
    customViewerIds: [],
    ...overrides,
  };
}

function reelDraft(overrides: Partial<ReelDraft> = {}): ReelDraft {
  return {
    videoUrl: 'https://cdn.example.test/new.mp4',
    thumbnailUrl: '',
    caption: '',
    sport: '',
    visibility: 'PUBLIC',
    customViewerIds: [],
    ...overrides,
  };
}

describe('story and reel helpers', () => {
  test('Add Story and Upload Reel open their own screens', () => {
    expect(CREATE_ACTIONS.find((action) => action.id === 'STORY')?.route).toBe('/create/story');
    expect(CREATE_ACTIONS.find((action) => action.id === 'REEL')?.route).toBe('/create/reel');
  });

  test('maps API stories and reels to the app shapes', () => {
    expect(toStory(apiStory({ caption: null, visibility: 'ONLY_ME' }))).toMatchObject({
      id: MY_STORY,
      user: { id: ME, displayName: 'Ban Ana' },
      media: { type: 'image', caption: '' },
      visibility: 'ONLY_ME',
      customViewerIds: [],
      fromServer: true,
    });

    const reel = toReel(apiReel({ sport: null, caption: null }));
    expect(reel).toMatchObject({ sport: 'Other', caption: '', views: 12, likes: 3, visibility: 'FRIENDS' });
    expect(toHighlight(reel)).toMatchObject({ id: MY_REEL, title: 'Other highlight', visibility: 'FRIENDS' });
  });

  test('validates drafts like the server does', () => {
    expect(isMediaUrl('https://cdn.example.test/a.jpg')).toBe(true);
    expect(isMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isMediaUrl('ftp://cdn.example.test/a.jpg')).toBe(false);

    expect(validateStoryDraft(storyDraft({ mediaUrl: 'nope' }), ME)).toMatch(/photo/);
    expect(validateStoryDraft(storyDraft({ caption: 'x'.repeat(501) }), ME)).toMatch(/500/);
    expect(validateStoryDraft(storyDraft({ visibility: 'CUSTOM' }), ME)).toMatch(/see this story/);
    expect(validateStoryDraft(storyDraft(), ME)).toBeNull();

    expect(validateReelDraft(reelDraft({ thumbnailUrl: 'nope' }), ME)).toMatch(/thumbnail/);
    expect(validateReelDraft(reelDraft({ visibility: 'CUSTOM', customViewerIds: [ME] }), ME)).toMatch(/own reel/);
    expect(validateReelDraft(reelDraft(), ME)).toBeNull();
  });
});

describe('stories stored in the database', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    signIn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('loads real stories into the rail and only your own into My Stories', async () => {
    fakeApi();
    const store = useStoriesStore();
    await store.load();

    const feed = store.getFeedAt(Date.now());
    expect(feed.own?.stories.map((story) => story.id)).toEqual([MY_STORY]);
    expect(feed.others.some((group) => group.user.id === OTHER)).toBe(true);
    expect(store.myStories.map((story) => story.id)).toEqual([MY_STORY]);
  });

  test('Add Story saves to the database and shows in the rail', async () => {
    const created = apiStory({ id: '88888888-8888-4888-8888-888888888888', caption: 'Warm-up' });
    const calls = fakeApi({ 'POST /stories': () => jsonResponse(201, created) });
    const store = useStoriesStore();
    await store.load();

    const result = await store.createStory(storyDraft({ caption: ' Warm-up ', visibility: 'FRIENDS' }));

    expect('story' in result).toBe(true);
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      mediaType: 'IMAGE',
      mediaUrl: 'https://cdn.example.test/new.jpg',
      visibility: 'FRIENDS',
      caption: 'Warm-up',
    });
    expect(store.myStories[0].id).toBe(created.id);
  });

  test('Edit caption, change privacy, and delete only your own story', async () => {
    const calls = fakeApi({
      [`PATCH /stories/${MY_STORY}`]: () => jsonResponse(200, apiStory({ caption: null })),
      [`PATCH /stories/${MY_STORY}/visibility`]: () => jsonResponse(200, apiStory({ visibility: 'ONLY_ME' })),
      [`DELETE /stories/${MY_STORY}`]: () => jsonResponse(200, { id: MY_STORY, deleted: true }),
    });
    const store = useStoriesStore();
    await store.load();

    expect(await store.editStory(OTHER_STORY, 'hijack')).toBe('Only the author can edit this story.');
    expect(await store.deleteStory(OTHER_STORY)).toBe('Only the author can delete this story.');

    expect(await store.editStory(MY_STORY, '   ')).toBeNull();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ caption: null });
    expect(store.myStories[0].media.caption).toBe('');

    expect(await store.updateStoryVisibility(MY_STORY, 'CUSTOM', ['user-maria'])).toBe(DEMO_PEOPLE_MESSAGE);
    expect(await store.updateStoryVisibility(MY_STORY, 'ONLY_ME', [])).toBeNull();
    expect(store.myStories[0].visibility).toBe('ONLY_ME');

    expect(await store.deleteStory(MY_STORY)).toBeNull();
    expect(store.myStories).toEqual([]);
    expect(store.getFeedAt(Date.now()).own).toBeNull();
    expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toEqual([`/stories/${MY_STORY}`]);
  });

  test('a failed delete keeps the story and explains why', async () => {
    fakeApi({
      [`DELETE /stories/${MY_STORY}`]: () => jsonResponse(404, { success: false, message: 'Story not found.' }),
    });
    const store = useStoriesStore();
    await store.load();

    expect(await store.deleteStory(MY_STORY)).toBe('This story is no longer available.');
    expect(store.myStories.map((story) => story.id)).toEqual([MY_STORY]);
  });
});

describe('reels stored in the database', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    signIn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('real reels lead the Reels tab; Highlights are only your own', async () => {
    fakeApi();
    const store = useReelsStore();
    await store.load();

    expect(store.serverReels.map((reel) => reel.id).sort()).toEqual([MY_REEL, OTHER_REEL].sort());
    expect(store.feedReels.slice(0, 2).every((reel) => reel.fromServer)).toBe(true);
    expect(store.myReels.map((reel) => reel.id)).toEqual([MY_REEL]);
  });

  test('signed-in feeds contain saved media, and reel reactions use the API', async () => {
    const calls = fakeApi({
      [`PUT /reels/${MY_REEL}/like`]: () => jsonResponse(200, apiReel({ likedByViewer: true, likeCount: 4 })),
    });
    const reels = useReelsStore();
    const stories = useStoriesStore();
    await Promise.all([reels.load(), stories.load()]);
    expect(reels.reels.length).toBeGreaterThan(0);
    expect(reels.feedReels.every((item) => item.fromServer)).toBe(true);
    const rail = stories.getFeedAt(Date.now());
    expect(rail.others.every((group) => group.stories.every((item) => item.fromServer))).toBe(true);
    expect(await reels.toggleLike(MY_REEL)).toBeNull();
    expect(reels.myReels[0].likedByViewer).toBe(true);
    expect(calls).toContainEqual({ method: 'PUT', path: `/reels/${MY_REEL}/like`, body: undefined });
  });

  test('Upload Reel sends the sport id and adds it to My Reels', async () => {
    const created = apiReel({ id: '99999999-9999-4999-8999-999999999999', createdAt: '2026-09-30T12:00:00.000Z' });
    const calls = fakeApi({ 'POST /reels': () => jsonResponse(201, created) });
    const store = useReelsStore();
    await store.load();

    const result = await store.createReel(reelDraft({ caption: 'Buzzer beater', sport: 'Basketball' }));

    expect('reel' in result).toBe(true);
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      videoUrl: 'https://cdn.example.test/new.mp4',
      visibility: 'PUBLIC',
      caption: 'Buzzer beater',
      sportId: BASKETBALL,
    });
    expect(store.myReels[0].id).toBe(created.id);
  });

  test('Edit reel sends only what changed; privacy and delete are author only', async () => {
    const calls = fakeApi({
      [`PATCH /reels/${MY_REEL}`]: () => jsonResponse(200, apiReel({ caption: 'Game winner', sport: null })),
      [`PATCH /reels/${MY_REEL}/visibility`]: () => jsonResponse(200, apiReel({ visibility: 'PUBLIC' })),
      [`DELETE /reels/${MY_REEL}`]: () => jsonResponse(200, { id: MY_REEL, deleted: true }),
    });
    const store = useReelsStore();
    await store.load();

    expect(await store.editReel(OTHER_REEL, { caption: 'hijack', sport: '' })).toBe('Only the author can edit this reel.');
    expect(await store.updateReelVisibility(OTHER_REEL, 'PUBLIC', [])).toBe(
      'Only the author can change who can see this reel.',
    );

    expect(await store.editReel(MY_REEL, { caption: ' Game winner ', sport: '' })).toBeNull();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ caption: 'Game winner', sportId: null });
    expect(store.myReels[0]).toMatchObject({ caption: 'Game winner', sport: 'Other' });

    expect(await store.updateReelVisibility(MY_REEL, 'PUBLIC', [])).toBeNull();
    expect(store.myReels[0].visibility).toBe('PUBLIC');

    expect(await store.deleteReel(OTHER_REEL)).toBe('Only the author can delete this reel.');
    expect(await store.deleteReel(MY_REEL)).toBeNull();
    expect(store.myReels).toEqual([]);
    expect(store.feedReels.some((reel) => reel.id === MY_REEL)).toBe(false);
  });
});

describe('without a session token', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('stories and reels are not saved anywhere', async () => {
    expect(await useStoriesStore().createStory(storyDraft())).toEqual({ error: STORY_SIGN_IN_MESSAGE });
    expect(await useReelsStore().createReel(reelDraft())).toEqual({ error: REEL_SIGN_IN_MESSAGE });
  });
});
