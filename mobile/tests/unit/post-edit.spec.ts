import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { DEMO_PEOPLE_MESSAGE, PHOTOS_LATER_MESSAGE, usePostsStore } from '@/stores/posts';
import type { ApiPost, PostDraft } from '@/types/post';
import { toFeedPost, validatePostEdit } from '@/utils/post-api';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MY_POST = '33333333-3333-4333-8333-333333333333';
const OTHER_POST = '44444444-4444-4444-8444-444444444444';
const BASKETBALL = '55555555-5555-4555-8555-555555555555';
const TENNIS = '66666666-6666-4666-8666-666666666666';

function apiPost(overrides: Partial<ApiPost> = {}): ApiPost {
  return {
    id: MY_POST,
    author: { id: ME, username: 'banana', firstName: 'Ban', lastName: 'Ana', profileImageUrl: null },
    caption: 'First run',
    location: null,
    tags: [],
    visibility: 'PUBLIC',
    sportId: BASKETBALL,
    sport: { id: BASKETBALL, name: 'Basketball' },
    clubId: null,
    isAnnouncement: false,
    media: [],
    likeCount: 2,
    commentCount: 1,
    shareCount: 0,
    likedByViewer: false,
    editedAt: null,
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    ...overrides,
  };
}

const SPORTS = [
  { id: BASKETBALL, name: 'Basketball', description: null, iconUrl: null, isActive: true },
  { id: TENNIS, name: 'Tennis', description: null, iconUrl: null, isActive: true },
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** A tiny fake of the posts API; every request is recorded. */
function fakeApi(handlers: Partial<Record<string, (body: unknown) => Response>> = {}) {
  const calls: Call[] = [];
  const own = apiPost();
  const other = apiPost({
    id: OTHER_POST,
    author: { id: OTHER, username: 'mango', firstName: 'Man', lastName: 'Go', profileImageUrl: null },
    createdAt: '2026-09-30T11:00:00.000Z',
  });

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

      if (method === 'GET' && path === '/posts') {
        return Promise.resolve(jsonResponse(200, { posts: [other, own], nextCursor: null }));
      }
      if (method === 'GET' && path === '/users/banana/posts') {
        return Promise.resolve(jsonResponse(200, { posts: [own], nextCursor: null }));
      }
      if (method === 'GET' && path === '/sports') {
        return Promise.resolve(jsonResponse(200, SPORTS));
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

function draft(overrides: Partial<PostDraft> = {}): PostDraft {
  return {
    body: 'Won 21-19',
    sport: 'Tennis',
    visibility: 'PUBLIC',
    customViewerIds: [],
    taggedUserIds: [],
    location: null,
    photoUrls: [],
    ...overrides,
  };
}

describe('post edit helpers', () => {
  test('maps an API post to a feed card', () => {
    const card = toFeedPost(apiPost({ sport: null, sportId: null, editedAt: '2026-09-30T12:00:00.000Z' }));

    expect(card).toMatchObject({
      id: MY_POST,
      author: { id: ME, username: 'banana', displayName: 'Ban Ana' },
      body: 'First run',
      sport: 'Other',
      likes: 2,
      comments: 1,
      editedAt: '2026-09-30T12:00:00.000Z',
      fromServer: true,
    });
  });

  test('validates an edit like the server does', () => {
    expect(validatePostEdit({ body: '   ', sport: 'Tennis', location: null })).toMatch(/Write something/);
    expect(validatePostEdit({ body: 'x'.repeat(2201), sport: 'Tennis', location: null })).toMatch(/2200/);
    expect(validatePostEdit({ body: 'ok', sport: 'Tennis', location: { name: 'Court', latitude: 95, longitude: 1 } }))
      .not.toBeNull();
    expect(validatePostEdit({ body: 'ok', sport: 'Tennis', location: null })).toBeNull();
  });
});

describe('posts stored in the database', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    signIn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('loads real posts into Home and only the account’s own into My Feed', async () => {
    fakeApi();
    const store = usePostsStore();
    await store.load();

    expect(store.serverPosts.map((post) => post.id)).toEqual([OTHER_POST, MY_POST]);
    expect(store.visiblePosts.slice(0, 2).every((post) => post.fromServer)).toBe(true);
    expect(store.myPosts.map((post) => post.id)).toEqual([MY_POST]);
  });

  test('Edit post sends only what changed and updates the card', async () => {
    const calls = fakeApi({
      [`PATCH /posts/${MY_POST}`]: () =>
        jsonResponse(200, apiPost({
          caption: 'Second run',
          sportId: TENNIS,
          sport: { id: TENNIS, name: 'Tennis' },
          editedAt: '2026-09-30T12:00:00.000Z',
        })),
    });
    const store = usePostsStore();
    await store.load();

    expect(await store.editPost(MY_POST, { body: '  Second run ', sport: 'Tennis', location: null })).toBeNull();

    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toEqual({ caption: 'Second run', sportId: TENNIS });
    expect(store.myPosts[0]).toMatchObject({ body: 'Second run', sport: 'Tennis', editedAt: '2026-09-30T12:00:00.000Z' });
  });

  test('profile-only posts share saved reactions without being inserted into Home', async () => {
    const target = apiPost({ id: OTHER_POST, author: { ...apiPost().author, id: OTHER } });
    const calls = fakeApi({
      [`PUT /posts/${OTHER_POST}/like`]: () => jsonResponse(200, { ...target, likedByViewer: true, likeCount: 1 }),
      [`DELETE /posts/${OTHER_POST}/like`]: () => jsonResponse(200, target),
    });
    const store = usePostsStore();
    store.rememberProfilePosts([toFeedPost(target)]);
    expect(await store.toggleLike(OTHER_POST)).toBeNull();
    expect(store.findPost(OTHER_POST)?.likedByViewer).toBe(true);
    expect(store.serverPosts).toEqual([]);
    expect(await store.toggleLike(OTHER_POST)).toBeNull();
    expect(store.findPost(OTHER_POST)?.likedByViewer).toBe(false);
    expect(calls.map((call) => call.method)).toEqual(['PUT', 'DELETE']);
  });

  test('a failed like leaves the displayed reaction unchanged', async () => {
    fakeApi({ [`PUT /posts/${MY_POST}/like`]: () => jsonResponse(500, { message: 'Database details' }) });
    const store = usePostsStore();
    store.rememberProfilePosts([toFeedPost(apiPost())]);
    expect(await store.toggleLike(MY_POST)).toBe('Something went wrong on our side. Please try again in a moment.');
    expect(store.findPost(MY_POST)?.likedByViewer).toBe(false);
  });

  test('refresh releases an obsolete pagination request and discards its late page', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('cursor=')) return new Promise<Response>((resolve) => { finish = resolve; });
      return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
    }));
    const store = usePostsStore();
    store.nextCursor = MY_POST;
    const page = store.loadMore('ALL');
    expect(store.loadingMore).toBe(true);
    await store.refresh();
    expect(store.loadingMore).toBe(false);
    finish(jsonResponse(200, { posts: [apiPost()], nextCursor: null }));
    await page;
    expect(store.serverPosts).toEqual([]);
    expect(store.nextCursor).toBeNull();
  });

  test('Edit post refuses an empty caption and other people’s posts without calling the API', async () => {
    const calls = fakeApi();
    const store = usePostsStore();
    await store.load();

    expect(await store.editPost(MY_POST, { body: '  ', sport: 'Tennis', location: null })).toMatch(/Write something/);
    expect(await store.editPost(OTHER_POST, { body: 'hijack', sport: 'Tennis', location: null }))
      .toBe('Only the author can edit this post.');
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
  });

  test('Delete post removes it everywhere after the server confirms', async () => {
    const calls = fakeApi({
      [`DELETE /posts/${MY_POST}`]: () => jsonResponse(200, { id: MY_POST, deleted: true }),
    });
    const store = usePostsStore();
    await store.load();

    expect(await store.deletePost(OTHER_POST)).toBe('Only the author can delete this post.');
    expect(await store.deletePost(MY_POST)).toBeNull();

    expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toEqual([`/posts/${MY_POST}`]);
    expect(store.myPosts).toEqual([]);
    expect(store.visiblePosts.some((post) => post.id === MY_POST)).toBe(false);
  });

  test('a failed delete keeps the post and explains why', async () => {
    fakeApi({
      [`DELETE /posts/${MY_POST}`]: () => jsonResponse(404, { success: false, message: 'Post not found.' }),
    });
    const store = usePostsStore();
    await store.load();

    expect(await store.deletePost(MY_POST)).toBe('This post is no longer available.');
    expect(store.myPosts.map((post) => post.id)).toEqual([MY_POST]);
  });

  test('Create Post saves to the database with the sport id', async () => {
    const calls = fakeApi({
      'POST /posts': () =>
        jsonResponse(201, apiPost({
          id: '77777777-7777-4777-8777-777777777777',
          caption: 'Won 21-19',
          sport: { id: TENNIS, name: 'Tennis' },
          createdAt: '2026-09-30T13:00:00.000Z',
        })),
    });
    const store = usePostsStore();
    await store.load();

    const post = await store.publish(store.me!, draft());

    expect(post).toMatchObject({ body: 'Won 21-19', fromServer: true });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      caption: 'Won 21-19',
      visibility: 'PUBLIC',
      sportId: TENNIS,
    });
    expect(store.myPosts[0].id).toBe('77777777-7777-4777-8777-777777777777');
  });

  test('photos and demo people are refused before anything is sent', async () => {
    const calls = fakeApi();
    const store = usePostsStore();
    await store.load();

    expect(await store.publish(store.me!, draft({ photoUrls: ['blob:photo'] }))).toBeNull();
    expect(store.publishError).toBe(PHOTOS_LATER_MESSAGE);
    expect(await store.publish(store.me!, draft({ taggedUserIds: ['user-maria'] }))).toBeNull();
    expect(store.publishError).toBe(DEMO_PEOPLE_MESSAGE);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
});

describe('demo posts (no session token)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('the author can edit and delete their own demo post locally', async () => {
    const store = usePostsStore();
    await store.load();
    const post = await store.publish(store.me!, draft({ sport: 'Basketball' }));

    expect(await store.editPost(post!.id, { body: 'Edited', sport: 'Basketball', location: null })).toBeNull();
    expect(store.myPosts[0]).toMatchObject({ body: 'Edited' });
    expect(store.myPosts[0].editedAt).toBeTruthy();

    expect(await store.deletePost(post!.id)).toBeNull();
    expect(store.myPosts.some((candidate) => candidate.id === post!.id)).toBe(false);
  });
});
