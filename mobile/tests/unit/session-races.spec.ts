import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '@/services/api-client';
import { tokenStorage } from '@/services/token-storage';
import { useAuthStore } from '@/stores/auth';
import { createAuthorizedCall, SessionChangedError } from '@/stores/authorized';
import { useProfileStore } from '@/stores/profile';
import { useDiscoveryStore } from '@/stores/discovery';
import { useStoriesStore } from '@/stores/stories';
import { useReelsStore } from '@/stores/reels';
import { useSportsStore } from '@/stores/sports';

const user = (id: string) => ({
  id,
  username: id,
  firstName: id,
  lastName: 'Test',
  email: `${id}@example.test`,
  role: 'USER',
  profileImageUrl: null,
  bio: null,
  city: null,
});
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('session isolation', () => {
  test('an old mutation cannot clear the new account\'s busy state', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));
    const auth = useAuthStore();
    auth.accessToken = 'alice';
    auth.currentUser = user('alice');
    const sports = useSportsStore();
    const request = sports.removeSport('old-sport');
    await auth.logout();
    auth.accessToken = 'bob';
    auth.currentUser = user('bob');
    sports.busyId = 'new-sport';
    pending.resolve(json({}));
    await request;
    expect(sports.busyId).toBe('new-sport');
    expect(sports.mySports).toEqual([]);
  });
  test('a late auth/me response cannot restore a logged-out account', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise),
    );
    const auth = useAuthStore();
    auth.accessToken = 'alice';
    auth.currentUser = user('alice');
    const refresh = auth.loadCurrentUser();
    await auth.logout();
    pending.resolve(json(user('alice')));
    await refresh;
    expect(auth.currentUser).toBeNull();
    expect(auth.accessToken).toBeNull();
  });

  test('logout cancels an unfinished login', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise),
    );
    const auth = useAuthStore();
    const login = auth.login({ email: 'alice@example.test', password: 'password123' });
    await auth.logout();
    pending.resolve(json({ accessToken: 'alice', user: user('alice') }));
    await login;
    expect(auth.isAuthenticated).toBe(false);
    expect(await tokenStorage.get()).toBeNull();
  });

  test.each([false, true])(
    'rejects an old response without logging out the new account (401: %s)',
    async (unauthorized) => {
      const auth = useAuthStore();
      auth.accessToken = 'alice';
      auth.currentUser = user('alice');
      const pending = deferred<string>();
      const request = createAuthorizedCall(auth)(() => pending.promise);
      await auth.logout();
      auth.accessToken = 'bob';
      auth.currentUser = user('bob');
      const rejected = expect(request).rejects.toBeInstanceOf(SessionChangedError);
      if (unauthorized) pending.reject(new ApiError(401, 'Expired'));
      else pending.resolve('private data');
      await rejected;
      expect(auth.currentUser?.id).toBe('bob');
      expect(auth.accessToken).toBe('bob');
    },
  );

  test('a late own-profile response cannot refill cleared account caches', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise),
    );
    const auth = useAuthStore();
    auth.accessToken = 'alice';
    auth.currentUser = user('alice');
    const profiles = useProfileStore();
    const request = profiles.fetchMyProfile();
    await auth.logout();
    auth.accessToken = 'bob';
    auth.currentUser = user('bob');
    pending.resolve(json({ ...user('alice'), isOwnProfile: true, sports: [] }));
    await request;
    expect(profiles.currentProfile).toBeNull();
    expect(profiles.account?.id).toBe('bob');
    expect(profiles.error).toBeNull();
  });

  test('discovery clears cached results and ignores the previous account search', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise),
    );
    const auth = useAuthStore();
    auth.accessToken = 'alice';
    auth.currentUser = user('alice');
    const discovery = useDiscoveryStore();
    const request = discovery.fetchNearbyGames();
    await auth.logout();
    pending.resolve(json({ games: [{ id: 'private-game' }] }));
    await request;
    expect(discovery.games).toEqual([]);
    expect(discovery.status).toBe('idle');
    expect(discovery.error).toBeNull();
  });

  test.each(['stories', 'reels'])('a late %s refresh cannot repopulate the next account', async (kind) => {
    const pending = deferred<void>();
    const author = { ...user('alice'), profileImageUrl: null };
    const createdAt = new Date().toISOString();
    const story = {
      id: 'private-story',
      author,
      mediaType: 'IMAGE',
      mediaUrl: 'https://example.test/a.jpg',
      thumbnailUrl: null,
      caption: 'Private',
      visibility: 'ONLY_ME',
      music: null,
      createdAt,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const reel = {
      id: 'private-reel',
      author,
      caption: 'Private',
      videoUrl: 'https://example.test/a.mp4',
      thumbnailUrl: null,
      durationSeconds: 10,
      sport: null,
      club: null,
      visibility: 'ONLY_ME',
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      likedByViewer: false,
      createdAt,
      updatedAt: createdAt,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise.then(() => json(kind === 'stories' ? [story] : { reels: [reel], nextCursor: null }))),
    );
    const auth = useAuthStore();
    auth.accessToken = 'alice';
    auth.currentUser = user('alice');
    const store = kind === 'stories' ? useStoriesStore() : useReelsStore();
    const request = store.refresh();
    await auth.logout();
    auth.accessToken = 'bob';
    auth.currentUser = user('bob');
    pending.resolve();
    await request;
    expect(store.serverStatus).toBe('idle');
    expect(store.serverError).toBeNull();
    expect(useStoriesStore().serverStories).toEqual([]);
    expect(useReelsStore().serverReels).toEqual([]);
  });

  test('blocked browser storage still permits an in-memory login and logout', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          json(url.endsWith('/auth/login') ? { accessToken: 'alice', user: user('alice') } : user('alice')),
        ),
      ),
    );
    const auth = useAuthStore();
    await auth.login({ email: 'alice@example.test', password: 'password123' });
    expect(auth.isAuthenticated).toBe(true);
    await auth.logout();
    expect(auth.isAuthenticated).toBe(false);
    expect(await tokenStorage.get()).toBeNull();
  });
});
