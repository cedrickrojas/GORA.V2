import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';
import { preparePostPhoto } from '@/utils/post-photos';
import type { OwnProfile } from '@/types/profile';

vi.mock('@/utils/post-photos', () => ({ preparePostPhoto: vi.fn() }));

const cover = '/api/v1/profiles/u-1/cover/revision?token=signed';
function own(coverImageUrl: string | null): OwnProfile {
  return {
    id: 'u-1',
    username: 'alice',
    firstName: 'Alice',
    lastName: 'QA',
    displayName: 'Alice QA',
    bio: null,
    city: null,
    profileImageUrl: null,
    coverImageUrl,
    dateOfBirth: null,
    sports: [],
    stats: { friends: 0, followers: 0, following: 0 },
    sections: { posts: 0, games: 0, reels: 0, stories: 0, clubs: 0, activity: 0, badges: 0 },
    isOwnProfile: true,
    createdAt: '2026-10-10T00:00:00Z',
  };
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('profile cover uploads', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.mocked(preparePostPhoto).mockReset();
    const auth = useAuthStore();
    auth.accessToken = 'alice-token';
    auth.currentUser = {
      id: 'u-1',
      username: 'alice',
      email: 'alice@example.test',
      firstName: 'Alice',
      lastName: 'QA',
      role: 'USER',
      bio: null,
      city: null,
      profileImageUrl: null,
    };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('optimizes the photo, uses the owner token, normalizes the saved cover URL, and removes it', async () => {
    const photo = 'data:image/jpeg;base64,photo';
    vi.mocked(preparePostPhoto).mockResolvedValue(photo);
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      Promise.resolve(response(own(init.method === 'DELETE' ? null : cover))),
    );
    vi.stubGlobal('fetch', fetchMock);
    const store = useProfileStore();
    const file = new File(['source'], 'cover.jpg', { type: 'image/jpeg' });
    expect(await store.updateCover(file)).toEqual({ ok: true });
    expect(preparePostPhoto).toHaveBeenCalledWith(file);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ photo }),
      headers: { Authorization: 'Bearer alice-token' },
    });
    expect(store.currentProfile?.coverImageUrl).toBe(new URL(cover, window.location.origin).href);
    expect(await store.updateCover(null)).toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(store.currentProfile?.coverImageUrl).toBeNull();
    expect(store.saving).toBe(false);
  });

  test('retains the existing cover on a failed upload', async () => {
    vi.mocked(preparePostPhoto).mockResolvedValue('data:image/jpeg;base64,photo');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response({ message: 'Internal server error' }, 500))),
    );
    const store = useProfileStore();
    store.currentProfile = own(cover);
    const result = await store.updateCover(new File(['source'], 'cover.jpg'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain('Internal server');
    expect(store.currentProfile.coverImageUrl).toBe(cover);
    expect(store.saving).toBe(false);
  });

  test('does not upload into a different account if the account changes during image optimization', async () => {
    const pending = deferred<string>();
    vi.mocked(preparePostPhoto).mockReturnValue(pending.promise);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const store = useProfileStore();
    const upload = store.updateCover(new File(['source'], 'cover.jpg'));
    useAuthStore().accessToken = 'bob-token';
    pending.resolve('data:image/jpeg;base64,photo');
    expect((await upload).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.currentProfile).toBeNull();
    expect(store.saving).toBe(false);
  });

  test('ignores a delayed response from the previous account and prevents duplicate uploads', async () => {
    vi.mocked(preparePostPhoto).mockResolvedValue('data:image/jpeg;base64,photo');
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const store = useProfileStore();
    const upload = store.updateCover(new File(['source'], 'cover.jpg'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect((await store.updateCover(null)).ok).toBe(false);
    useAuthStore().accessToken = 'bob-token';
    pending.resolve(response(own(cover)));
    expect((await upload).ok).toBe(false);
    expect(store.currentProfile).toBeNull();
    expect(store.saving).toBe(false);
  });
});
