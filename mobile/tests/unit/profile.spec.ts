import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { routes } from '@/router';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';
import { validateRegisterInput } from '@/utils/auth';
import type { OwnProfile, ProfileSections, ProfileStats, UserSportEntry } from '@/types/profile';
import { describeApiError } from '@/utils/api-errors';
import { formatDisplayName } from '@/utils/display-name';
import {
  PROFILE_BIO_MAX_LENGTH,
  isBioTooLong,
  isImageUrl,
  normalizeBio,
  profileFormFrom,
  profileUpdateFrom,
  validateProfileForm,
} from '@/utils/profile';
import { buildProfileSections, splitProfileSections } from '@/utils/profile-sections';
import {
  POSITION_MAX_LENGTH,
  SKILL_LEVELS,
  addableSports,
  describeUserSport,
  normalizePosition,
  positionError,
  positionSuggestionsFor,
} from '@/utils/sports-profile';
import { ApiError } from '@/services/api-client';

const NO_STATS: ProfileStats = { friends: 0, followers: 0, following: 0 };
const NO_SECTIONS: ProfileSections = { posts: 0, games: 0, reels: 0, stories: 0, clubs: 0, activity: 0, badges: 0 };

const BASKETBALL: UserSportEntry = {
  sportId: 'sport-basketball',
  name: 'Basketball',
  iconUrl: null,
  skillLevel: 'ADVANCED',
  position: 'Point Guard',
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
};

function ownProfile(overrides: Partial<OwnProfile> = {}): OwnProfile {
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
    sports: [],
    stats: NO_STATS,
    sections: NO_SECTIONS,
    isOwnProfile: true,
    createdAt: '2026-09-30T09:00:00.000Z',
    ...overrides,
  };
}

describe('profile routes', () => {
  const router = createRouter({ history: createMemoryHistory(), routes });

  test('keeps the static profile pages ahead of /profile/:username', () => {
    expect(router.resolve('/profile').name).toBe('profile');
    expect(router.resolve('/profile/edit').name).toBe('edit-profile');
    expect(router.resolve('/profile/followers').name).toBe('followers');
    expect(router.resolve('/profile/following').name).toBe('following');
    expect(router.resolve('/profile/settings').name).toBe('settings');
    expect(router.resolve('/profile/maria').name).toBe('user-profile');
    expect(router.resolve('/profile/maria').matched.some((record) => record.meta.requiresAuth)).toBe(true);
  });

  test('sends old /users/:username links to /profile/:username', async () => {
    await router.push('/users/maria');
    expect(router.currentRoute.value.fullPath).toBe('/profile/maria');
  });

  test('reserves usernames that would collide with those pages', () => {
    const input = { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'long-enough-1', confirmPassword: 'long-enough-1' };

    expect(validateRegisterInput({ ...input, username: 'edit' }).username).toBe('That username is reserved. Choose another one.');
    expect(validateRegisterInput({ ...input, username: 'followers' }).username).toBeDefined();
    expect(validateRegisterInput({ ...input, username: 'maria' }).username).toBeUndefined();
  });
});

describe('display name', () => {
  test('uses first and last name, then either one, then the username', () => {
    expect(formatDisplayName({ username: 'louis', firstName: 'Louis', lastName: 'Ray' })).toBe('Louis Ray');
    expect(formatDisplayName({ username: 'louis', firstName: ' Louis ', lastName: '' })).toBe('Louis');
    expect(formatDisplayName({ username: 'louis', firstName: null, lastName: 'Ray' })).toBe('Ray');
    expect(formatDisplayName({ username: 'louis', firstName: '', lastName: ' ' })).toBe('louis');
  });
});

describe('profile bio', () => {
  test('trims the bio and treats a blank one as removed', () => {
    expect(normalizeBio('  Outside hitter.  ')).toBe('Outside hitter.');
    expect(normalizeBio('   \n ')).toBeNull();
    expect(normalizeBio('Line one\n\n\n\nLine two')).toBe('Line one\n\nLine two');
  });

  test('allows up to 160 characters, like the database', () => {
    expect(PROFILE_BIO_MAX_LENGTH).toBe(160);
    expect(isBioTooLong('a'.repeat(160))).toBe(false);
    expect(isBioTooLong(` ${'a'.repeat(160)} `)).toBe(false);
    expect(isBioTooLong('a'.repeat(161))).toBe(true);
  });
});

describe('edit profile form', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  test('accepts a valid form and reports each invalid field', () => {
    const form = profileFormFrom(ownProfile());
    expect(validateProfileForm(form, now)).toEqual({});

    expect(
      validateProfileForm(
        {
          ...form,
          firstName: ' ',
          lastName: 'x'.repeat(51),
          bio: 'x'.repeat(161),
          city: 'x'.repeat(101),
          dateOfBirth: '2030-01-01',
          profileImageUrl: 'javascript:alert(1)',
          coverImageUrl: 'not a url',
        },
        now,
      ),
    ).toEqual({
      firstName: 'First name is required.',
      lastName: 'Last name must be at most 50 characters.',
      bio: 'Bio must be at most 160 characters.',
      city: 'City must be at most 100 characters.',
      dateOfBirth: 'Enter a real date in the past.',
      profileImageUrl: 'Use a link that starts with https:// (or http://).',
      coverImageUrl: 'Use a link that starts with https:// (or http://).',
    });
  });

  test('only allows http(s) image links, never data or script URLs', () => {
    expect(isImageUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isImageUrl('http://images.example.org/p.png')).toBe(true);
    expect(isImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isImageUrl('javascript:alert(1)')).toBe(false);
    expect(isImageUrl('https://localhost/a.jpg')).toBe(false);
    expect(isImageUrl('https://cdn.example.com/a b.jpg')).toBe(false);
  });

  test('sends only changed fields, with cleared optional fields as null', () => {
    const original = ownProfile({ bio: 'Setter.', profileImageUrl: 'https://cdn.example.com/a.jpg' });
    const form = profileFormFrom(original);

    expect(profileUpdateFrom(form, original)).toEqual({});
    expect(
      profileUpdateFrom(
        { ...form, firstName: ' Luis ', city: '  ', bio: '', profileImageUrl: '', dateOfBirth: '2000-05-17' },
        original,
      ),
    ).toEqual({ firstName: 'Luis', city: null, bio: null, profileImageUrl: null, dateOfBirth: '2000-05-17' });
  });
});

describe('sports profile', () => {
  test('offers the four skill levels in order', () => {
    expect(SKILL_LEVELS.map((level) => level.value)).toEqual(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL']);
  });

  test('suggests positions only where a sport has them', () => {
    expect(positionSuggestionsFor('Basketball')).toEqual([
      'Point Guard',
      'Shooting Guard',
      'Small Forward',
      'Power Forward',
      'Center',
    ]);
    expect(positionSuggestionsFor('Volleyball')).toContain('Libero');
    expect(positionSuggestionsFor('Football')).toEqual(['Goalkeeper', 'Defender', 'Midfielder', 'Forward']);
    expect(positionSuggestionsFor('Running')).toEqual([]);
    expect(positionSuggestionsFor('Swimming')).toEqual([]);
  });

  test('keeps positions optional and short', () => {
    expect(normalizePosition('  ')).toBeNull();
    expect(normalizePosition(' Setter ')).toBe('Setter');
    expect(positionError('x'.repeat(POSITION_MAX_LENGTH))).toBeNull();
    expect(positionError('x'.repeat(POSITION_MAX_LENGTH + 1))).toContain('at most 40');
  });

  test('never offers a sport that is already on the profile or no longer active', () => {
    const options = [
      { id: 'sport-basketball', name: 'Basketball', description: null, iconUrl: null, isActive: true },
      { id: 'sport-running', name: 'Running', description: null, iconUrl: null, isActive: true },
      { id: 'sport-retired', name: 'Retired', description: null, iconUrl: null, isActive: false },
    ];

    expect(addableSports(options, [BASKETBALL]).map((option) => option.name)).toEqual(['Running']);
  });

  test('describes a sport card with level and optional position', () => {
    expect(describeUserSport(BASKETBALL)).toBe('Advanced · Point Guard');
    expect(describeUserSport({ skillLevel: 'BEGINNER', position: null })).toBe('Beginner');
  });
});

describe('profile sections', () => {
  test('lists every section in order with real counts or the empty state', () => {
    const empty = buildProfileSections(NO_STATS, NO_SECTIONS);

    expect(empty.map((row) => row.title)).toEqual([
      'My Games',
      'My Reels',
      'My Stories',
      'Friends',
      'Followers',
      'Following',
      'Badges',
      'Activity',
      'My Clubs',
      'Settings',
    ]);
    expect(empty[0]).toMatchObject({
      summary: "You haven't joined any games yet.",
      actionLabel: 'Discover Games',
      actionTo: '/discover',
    });
    expect(empty[1].summary).toBe('No reels yet.');
    expect(empty[8]).toMatchObject({
      summary: "You haven't joined any clubs yet.",
      actionLabel: 'Find Clubs',
      actionTo: '/search',
    });
    expect(empty[9]).toMatchObject({ actionLabel: 'Open Settings', actionTo: '/profile/settings' });

    const busy = buildProfileSections(
      { friends: 1, followers: 12, following: 3 },
      { ...NO_SECTIONS, games: 4, clubs: 2, badges: 1 },
    );
    expect(busy[0]).toMatchObject({ summary: '4 games', actionLabel: 'View My Games', actionTo: '/profile/games' });
    expect(busy[3].summary).toBe('1 friend');
    expect(busy[4].summary).toBe('12 followers');
    expect(busy[6].summary).toBe('1 badge unlocked');
    expect(busy[8]).toMatchObject({ summary: '2 clubs', actionTo: '/profile/clubs' });
  });

  test('shows the first 4 sections as links and the rest under More, each opening its own page', () => {
    const { visible, more } = splitProfileSections(buildProfileSections(NO_STATS, NO_SECTIONS));

    expect(visible.map((row) => row.title)).toEqual(['My Games', 'My Reels', 'My Stories', 'Friends']);
    expect(more.map((row) => row.title)).toEqual(['Followers', 'Following', 'Badges', 'Activity', 'My Clubs', 'Settings']);
    expect(visible[0].to).toBe('/profile/games');
    expect(more[4].to).toBe('/profile/clubs');
  });
});

describe('api error messages', () => {
  test('shows friendly messages and never raw server errors', () => {
    expect(describeApiError(new ApiError(0, "Can't reach GORA right now."))).toContain("Can't reach GORA");
    expect(describeApiError(new ApiError(401, 'Unauthorized'))).toBe('Your session has expired. Please log in again.');
    expect(describeApiError(new ApiError(409, 'Basketball is already on your profile. Edit it instead.'))).toBe(
      'Basketball is already on your profile. Edit it instead.',
    );
    expect(describeApiError(new ApiError(500, 'Internal server error'))).not.toContain('Internal');
    expect(describeApiError(new Error('select * from "User"'))).not.toContain('select');
  });
});

describe('profile store (REST API)', () => {
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

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('loads and updates the profile through the API with the JWT', async () => {
    signIn();
    const fetchMock = mockApi((url, init) =>
      init.method === 'PATCH'
        ? jsonResponse(200, ownProfile({ bio: 'Point guard.', displayName: 'Louis Ray' }))
        : jsonResponse(200, ownProfile()),
    );
    const store = useProfileStore();

    expect(await store.fetchMyProfile()).toMatchObject({ username: 'louis_ray' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/profiles\/me$/);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');

    expect(await store.updateProfile({ bio: 'Point guard.' })).toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ bio: 'Point guard.' }) });
    expect(store.currentProfile?.bio).toBe('Point guard.');
    expect(useAuthStore().currentUser?.bio).toBe('Point guard.');
    expect(store.account).toMatchObject({ username: 'louis_ray', displayName: 'Louis Ray' });
  });

  test('treats a missing profile as not found and an expired token as a logout', async () => {
    signIn();
    mockApi((url) =>
      url.includes('/profiles/ghost')
        ? jsonResponse(404, { message: 'User not found.' })
        : jsonResponse(401, { message: 'Unauthorized' }),
    );
    const store = useProfileStore();

    expect(await store.fetchProfile('ghost')).toEqual({ status: 'missing' });
    expect(await store.fetchMyProfile()).toBeNull();
    expect(store.error).toBe('Your session has expired. Please log in again.');
    expect(useAuthStore().isAuthenticated).toBe(false);
  });

  test('reports a network failure without logging out', async () => {
    signIn();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const store = useProfileStore();

    expect(await store.fetchMyProfile()).toBeNull();
    expect(store.error).toContain("Can't reach GORA");
    expect(useAuthStore().isAuthenticated).toBe(true);
  });
});
