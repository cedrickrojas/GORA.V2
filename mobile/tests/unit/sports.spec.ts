import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MySportsSection from '@/components/profile/MySportsSection.vue';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';
import { useSportsStore } from '@/stores/sports';
import type { OwnProfile, SportOption, UserSportEntry } from '@/types/profile';

const BASKETBALL_ID = '11111111-1111-4111-8111-111111111111';
const RUNNING_ID = '22222222-2222-4222-8222-222222222222';
const RETIRED_ID = '33333333-3333-4333-8333-333333333333';

const SPORTS: SportOption[] = [
  { id: BASKETBALL_ID, name: 'Basketball', description: 'Hoops', iconUrl: null, isActive: true },
  { id: RUNNING_ID, name: 'Running', description: null, iconUrl: null, isActive: true },
  { id: RETIRED_ID, name: 'Retired', description: null, iconUrl: null, isActive: false },
];

const BASKETBALL: UserSportEntry = {
  sportId: BASKETBALL_ID,
  name: 'Basketball',
  iconUrl: null,
  skillLevel: 'ADVANCED',
  position: 'Point Guard',
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockApi(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function signIn(): void {
  const auth = useAuthStore();
  auth.accessToken = 'test-token';
  auth.currentUser = {
    id: 'u-1',
    username: 'louis_ray',
    email: 'louis@example.com',
    firstName: 'Louis',
    lastName: 'Ray',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: 'Manila',
  };
}

function ownProfile(sports: UserSportEntry[] = []): OwnProfile {
  return {
    id: 'u-1',
    username: 'louis_ray',
    firstName: 'Louis',
    lastName: 'Ray',
    displayName: 'Louis Ray',
    profileImageUrl: null,
    coverImageUrl: null,
    bio: null,
    city: 'Manila',
    dateOfBirth: null,
    sports,
    stats: { friends: 0, followers: 0, following: 0 },
    sections: { posts: 0, games: 0, reels: 0, stories: 0, clubs: 0, activity: 0, badges: 0 },
    isOwnProfile: true,
    createdAt: '2026-09-30T09:00:00.000Z',
  };
}

describe('sports store (REST API)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('loads the sport list once with the JWT, shares concurrent calls, and offers only active sports', async () => {
    signIn();
    const fetchMock = mockApi(() => jsonResponse(200, SPORTS));
    const store = useSportsStore();

    const [first, second] = await Promise.all([store.fetchSports(), store.fetchSports()]);
    await store.fetchSports();

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/sports$/);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(store.sportsStatus).toBe('ready');
    expect(store.activeSports.map((sport) => sport.name)).toEqual(['Basketball', 'Running']);
    expect(store.addable.map((sport) => sport.name)).toEqual(['Basketball', 'Running']);

    await store.fetchSports({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('reports an empty sport list as ready with nothing to add', async () => {
    signIn();
    mockApi(() => jsonResponse(200, []));
    const store = useSportsStore();

    expect(await store.fetchSports()).toEqual({ ok: true });
    expect(store.sportsStatus).toBe('ready');
    expect(store.activeSports).toEqual([]);
    expect(store.addable).toEqual([]);
  });

  test('adds, updates, and removes through /users/me/sports and keeps the profile in step', async () => {
    signIn();
    const calls: string[] = [];
    mockApi((url, init) => {
      const method = init.method ?? 'GET';
      calls.push(`${method} ${url.replace(/^.*\/api\/v1/, '')}`);
      if (url.endsWith('/profiles/me')) return jsonResponse(200, ownProfile());
      if (url.endsWith('/sports') && method === 'GET') return jsonResponse(200, SPORTS);
      if (method === 'POST') return jsonResponse(201, BASKETBALL);
      if (method === 'PATCH') return jsonResponse(200, { ...BASKETBALL, skillLevel: 'PROFESSIONAL', position: null });
      if (method === 'DELETE') return jsonResponse(204, null);
      return jsonResponse(404, { message: 'Not found' });
    });
    const profile = useProfileStore();
    const store = useSportsStore();
    await profile.fetchMyProfile();
    await store.fetchSports();
    expect(store.mySportsStatus).toBe('ready');

    const add = await store.addSport({ sportId: BASKETBALL_ID, skillLevel: 'ADVANCED', position: 'Point Guard' });
    expect(add).toEqual({ ok: true });
    expect(store.mySports.map((sport) => sport.name)).toEqual(['Basketball']);
    expect(profile.currentProfile?.sports.map((sport) => sport.name)).toEqual(['Basketball']);
    expect(store.addable.map((sport) => sport.name)).toEqual(['Running']);

    expect(await store.updateSport(BASKETBALL_ID, { skillLevel: 'PROFESSIONAL', position: null })).toEqual({ ok: true });
    expect(store.mySports[0]).toMatchObject({ skillLevel: 'PROFESSIONAL', position: null });
    expect(profile.currentProfile?.sports[0].skillLevel).toBe('PROFESSIONAL');

    expect(await store.removeSport(BASKETBALL_ID)).toEqual({ ok: true });
    expect(store.mySports).toEqual([]);
    expect(profile.currentProfile?.sports).toEqual([]);
    expect(store.busyId).toBeNull();

    expect(calls).toEqual([
      'GET /profiles/me',
      'GET /sports',
      'POST /users/me/sports',
      `PATCH /users/me/sports/${BASKETBALL_ID}`,
      `DELETE /users/me/sports/${BASKETBALL_ID}`,
    ]);
  });

  test('never sends a user id: the owner comes from the JWT', async () => {
    signIn();
    const fetchMock = mockApi(() => jsonResponse(201, BASKETBALL));
    const store = useSportsStore();

    await store.addSport({ sportId: BASKETBALL_ID, skillLevel: 'ADVANCED', position: null });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['position', 'skillLevel', 'sportId']);
  });

  test('shows the duplicate message and refreshes the list instead of adding twice', async () => {
    signIn();
    mockApi((url, init) => {
      if (init.method === 'POST') {
        return jsonResponse(409, { message: 'Basketball is already on your profile. Edit it instead.' });
      }
      return jsonResponse(200, [BASKETBALL]);
    });
    const store = useSportsStore();

    const result = await store.addSport({ sportId: BASKETBALL_ID, skillLevel: 'BEGINNER', position: null });
    await vi.waitFor(() => expect(store.mySports).toHaveLength(1));

    expect(result).toEqual({ ok: false, message: 'Basketball is already on your profile. Edit it instead.' });
    expect(store.mySports[0].skillLevel).toBe('ADVANCED');
  });

  test('turns a retired sport (404) into a friendly message and reloads the sport list', async () => {
    signIn();
    const fetchMock = mockApi((url, init) =>
      init.method === 'POST' ? jsonResponse(404, { message: 'Sport not found.' }) : jsonResponse(200, SPORTS),
    );
    const store = useSportsStore();

    const result = await store.addSport({ sportId: RETIRED_ID, skillLevel: 'BEGINNER', position: null });

    expect(result).toEqual({ ok: false, message: 'That sport is no longer available.' });
    await vi.waitFor(() => expect(store.sportsStatus).toBe('ready'));
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/v1\/sports$/);
  });

  test('passes validation messages through and hides server internals', async () => {
    signIn();
    let status = 400;
    mockApi(() =>
      jsonResponse(status, {
        message: status === 400 ? 'Skill level must be one of BEGINNER, INTERMEDIATE, ADVANCED, PROFESSIONAL.' : 'PrismaClientKnownRequestError at /src/x.ts',
      }),
    );
    const store = useSportsStore();

    const invalid = await store.updateSport(BASKETBALL_ID, { skillLevel: 'BEGINNER' });
    expect(invalid).toEqual({
      ok: false,
      message: 'Skill level must be one of BEGINNER, INTERMEDIATE, ADVANCED, PROFESSIONAL.',
    });

    status = 403;
    expect(await store.removeSport(BASKETBALL_ID)).toEqual({ ok: false, message: "You don't have permission to do that." });

    status = 500;
    const failed = await store.fetchSports();
    expect(failed.ok).toBe(false);
    expect(store.sportsStatus).toBe('error');
    expect(store.sportsError).toBe('Something went wrong on our side. Please try again in a moment.');
    expect(store.sportsError).not.toContain('Prisma');
  });

  test('treats removing an already-removed sport as done', async () => {
    signIn();
    mockApi((url, init) =>
      init.method === 'DELETE'
        ? jsonResponse(404, { message: "You haven't added this sport to your profile." })
        : jsonResponse(200, [BASKETBALL]),
    );
    const store = useSportsStore();
    await store.fetchMySports();

    expect(await store.removeSport(BASKETBALL_ID)).toEqual({ ok: true });
    expect(store.mySports).toEqual([]);
  });

  test('an expired session logs out instead of showing sports', async () => {
    signIn();
    mockApi(() => jsonResponse(401, { message: 'Unauthorized' }));
    const store = useSportsStore();

    expect(await store.fetchMySports()).toEqual({
      ok: false,
      message: 'Your session has expired. Please log in again.',
    });
    expect(useAuthStore().isAuthenticated).toBe(false);
    expect(store.mySportsStatus).toBe('error');
  });
});

describe('MySportsSection.vue', () => {
  test('shows the empty state with an Add Sport button', async () => {
    const wrapper = mount(MySportsSection, { props: { sports: [], editable: true } });

    expect(wrapper.text()).toContain('No sports added yet.');
    const add = wrapper.findAll('button').find((button) => button.text().includes('Add Sport'));
    expect(add).toBeDefined();
    await add!.trigger('click');
    expect(wrapper.emitted('add')).toHaveLength(1);
  });

  test('shows a skeleton while loading and a retry on errors', async () => {
    const loading = mount(MySportsSection, { props: { sports: [], editable: true, loading: true } });
    expect(loading.find('[aria-label="Loading sports"]').exists()).toBe(true);
    expect(loading.text()).not.toContain('No sports added yet.');

    const failed = mount(MySportsSection, {
      props: { sports: [], editable: true, error: 'Something went wrong on our side. Please try again in a moment.' },
    });
    expect(failed.text()).toContain('Something went wrong on our side.');
    await failed.find('button').trigger('click');
    expect(failed.emitted('retry')).toHaveLength(1);
  });

  test('lists real sports with level, position, Edit, and Remove', async () => {
    const wrapper = mount(MySportsSection, { props: { sports: [BASKETBALL], editable: true } });

    expect(wrapper.text()).toContain('Basketball');
    expect(wrapper.text()).toContain('Advanced · Point Guard');
    await wrapper.find('[aria-label="Edit Basketball"]').trigger('click');
    await wrapper.find('[aria-label="Remove Basketball"]').trigger('click');
    expect(wrapper.emitted('edit')?.[0]).toEqual([BASKETBALL]);
    expect(wrapper.emitted('remove')?.[0]).toEqual([BASKETBALL]);
  });

  test('is read-only on other profiles', () => {
    const wrapper = mount(MySportsSection, { props: { sports: [BASKETBALL] } });

    expect(wrapper.find('[aria-label="Edit Basketball"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Remove Basketball"]').exists()).toBe(false);
  });
});
