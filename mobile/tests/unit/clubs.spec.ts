import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  buildMockActivities,
  buildMockGames,
  buildMockPosts,
  buildMockReels,
  mockLocations,
  mockPlayers,
  mockSports,
} from '@/services/mock/mock-catalog';
import { buildMockClubMembers, buildMockClubs, mockClubSummaries } from '@/services/mock/mock-clubs';
import { mockCurrentUser, mockUsers } from '@/services/mock/mock-users';
import { useAuthStore } from '@/stores/auth';
import { useClubsStore } from '@/stores/clubs';
import type { Club, ClubApiView } from '@/types/club';
import {
  checkMaxMembers,
  clubToForm,
  emptyClubForm,
  normalizeClubTag,
  normalizeClubUsername,
  suggestClubUsername,
  toClubCreateInput,
  toClubUpdateInput,
  validateClubForm,
} from '@/utils/club-form';
import {
  applyJoin,
  applyLeave,
  formatClubCapacity,
  formatClubSlots,
  getClubJoinState,
  groupMyClubs,
  rankPopularClubs,
  selectFeedClubIds,
  toClub,
} from '@/utils/clubs';
import { DISCOVER_TABS, buildDiscoverFeed } from '@/utils/discover';
import { buildClubsFeed, buildFriendsFeed, type HomeFeedSources } from '@/utils/feed';
import {
  MAIN_TAB_LINKS,
  PROFILE_DROPDOWN_LINKS,
  PROFILE_SECTION_LINKS,
  isTabActive,
} from '@/utils/navigation';
import { SEARCH_CATEGORIES, searchCatalog } from '@/utils/search';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const ANY = { maxDistanceKm: null, sport: null };

function clubs(): Club[] {
  return buildMockClubs(NOW);
}

function club(id: string): Club {
  const found = clubs().find((candidate) => candidate.id === id);

  if (!found) {
    throw new Error(`missing mock club ${id}`);
  }

  return found;
}

function sources(): HomeFeedSources {
  return {
    posts: buildMockPosts(NOW),
    games: buildMockGames(NOW),
    reels: buildMockReels(NOW),
    activities: buildMockActivities(NOW),
  };
}

const SPORT_ID = '0b9f4a4e-8f39-4c55-9f5e-1f7c1f1d2a3b';
const SERVER_CLUB = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

function validForm() {
  return {
    ...emptyClubForm(),
    name: 'Manila Volleyball Club',
    username: 'manila-volleyball',
    description: 'Weekend volleyball in Manila.',
    primarySportId: SPORT_ID,
    maxMembers: '50',
  };
}

function apiClub(fields: Partial<ClubApiView> = {}): ClubApiView {
  return {
    id: SERVER_CLUB,
    name: 'Manila Volleyball Club',
    username: 'manila-volleyball',
    description: 'Weekend volleyball in Manila.',
    about: null,
    profileImageUrl: null,
    coverImageUrl: null,
    primarySport: { id: SPORT_ID, name: 'Volleyball' },
    additionalSports: [],
    location: {
      country: 'Philippines',
      city: 'Manila',
      barangay: null,
      homeCourt: null,
      locationName: null,
      latitude: null,
      longitude: null,
    },
    maxMembers: 50,
    currentMembers: 1,
    availableSlots: 49,
    isFull: false,
    membershipType: 'OPEN',
    isPublic: true,
    isActive: true,
    rules: [],
    tags: [],
    schedule: { day: null, startTime: null, endTime: null, trainingSchedule: null },
    contact: { email: null, websiteUrl: null, facebookUrl: null, instagramUrl: null, tiktokUrl: null },
    owner: { id: 'u-1', username: 'louis_ray', displayName: 'Louis Ray', profileImageUrl: null },
    viewer: {
      membership: { role: 'OWNER', status: 'ACTIVE' },
      hasInvite: false,
      follows: false,
      canManageClub: true,
      canManageMembers: true,
      canChat: true,
    },
    contentVisible: true,
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    ...fields,
  };
}

describe('Create Club form', () => {
  test('requires a positive whole maximum within the platform limit', () => {
    expect(checkMaxMembers('')).toBe('Maximum members is required.');
    expect(checkMaxMembers('0')).toBe('Maximum members must be at least 1.');
    expect(checkMaxMembers('-3')).toBe('Maximum members must be at least 1.');
    expect(checkMaxMembers('10.5')).toBe('Maximum members must be a whole number.');
    expect(checkMaxMembers('fifty')).toBe('Maximum members must be a whole number.');
    expect(checkMaxMembers('1001')).toBe('Maximum members cannot be more than 1000.');
    expect(checkMaxMembers('50')).toBeNull();
    expect(checkMaxMembers('20', 1000, 40)).toBe('Maximum members cannot be lower than the current 40 active members.');
    expect(checkMaxMembers('100', 1000, 40)).toBeNull();
  });

  test('validates the required fields and formats inline', () => {
    expect(validateClubForm(validForm())).toEqual({});
    expect(validateClubForm(emptyClubForm())).toMatchObject({
      name: 'Club name must be at least 2 characters.',
      username: 'Club username must be at least 3 characters.',
      description: 'Add a short description.',
      primarySportId: 'Choose a primary sport.',
    });
    expect(validateClubForm({ ...validForm(), username: 'Bad Name!' }).username).toContain('lowercase letters');
    expect(validateClubForm({ ...validForm(), maxMembers: '0' }).maxMembers).toBe('Maximum members must be at least 1.');
    expect(validateClubForm({ ...validForm(), latitude: '14.5' }).location).toBe(
      'Give both latitude and longitude, or neither.',
    );
    expect(validateClubForm({ ...validForm(), facebookUrl: 'https://evil.example/x' }).facebookUrl).toBe(
      'Facebook link must be an https://facebook.com/ address.',
    );
    expect(
      validateClubForm({ ...validForm(), activityStartTime: '18:00', activityEndTime: '17:00' }).activityEndTime,
    ).toBe('End time must be after the start time.');
    expect(validateClubForm({ ...validForm(), rules: [' '] }).rules).toBe('Rules cannot be empty.');
  });

  test('normalizes usernames and tags like the server', () => {
    expect(normalizeClubUsername(' @Manila-VB ')).toBe('manila-vb');
    expect(suggestClubUsername('Café -- Runners!')).toBe('cafe-runners');
    expect(normalizeClubTag('#Weekend Games')).toBe('weekendgames');
  });

  test('builds the POST body and a PATCH with only the changed fields', () => {
    const input = toClubCreateInput({ ...validForm(), username: '@Manila-Volleyball', rules: [' Be on time '] });

    expect(input).toMatchObject({
      username: 'manila-volleyball',
      maxMembers: 50,
      membershipType: 'OPEN',
      isPublic: true,
      rules: ['Be on time'],
      about: null,
      latitude: null,
    });

    const original = clubToForm(toClub(apiClub()));
    expect(toClubUpdateInput({ ...original, maxMembers: '100' }, original)).toEqual({ maxMembers: 100 });
  });
});

describe('club capacity and join states', () => {
  test('shows current / max members and the free slots', () => {
    const club = toClub(apiClub({ currentMembers: 24, maxMembers: 50 }));

    expect(formatClubCapacity(club)).toBe('24 / 50 Members');
    expect(formatClubSlots(club)).toBe('26 slots available');
    expect(formatClubSlots({ memberCount: 50, maxMembers: 50 })).toBe('FULL');
  });

  test('a full club offers no join, an invite-only club needs an invitation', () => {
    const outsider = { membership: null, hasInvite: false, follows: false, canManageClub: false, canManageMembers: false, canChat: false };

    expect(getClubJoinState(toClub(apiClub({ viewer: outsider, currentMembers: 50 })))).toBe('FULL');
    expect(getClubJoinState(toClub(apiClub({ viewer: outsider, membershipType: 'INVITE_ONLY' })))).toBe('INVITE_ONLY');
    expect(
      getClubJoinState(toClub(apiClub({ viewer: { ...outsider, hasInvite: true }, membershipType: 'INVITE_ONLY' }))),
    ).toBe('JOIN');
    expect(getClubJoinState(toClub(apiClub({ viewer: outsider, membershipType: 'APPROVAL_REQUIRED' })))).toBe('REQUEST');
    expect(getClubJoinState(toClub(apiClub()))).toBe('OWNER');
  });
});

describe('club membership', () => {
  test('member counts come from the members list, with one owner per club', () => {
    for (const candidate of clubs()) {
      const members = buildMockClubMembers(candidate.id, NOW);

      expect(candidate.memberCount).toBe(members.length);
      expect(members.filter((member) => member.role === 'OWNER')).toHaveLength(1);
      expect(new Set(members.map((member) => member.user.id)).size).toBe(members.length);
    }
  });

  test('public clubs let you straight in; private clubs take a request', () => {
    const running = club(mockClubSummaries.imusRunning.id);
    const pickleball = club(mockClubSummaries.manilaPickleball.id);

    expect(getClubJoinState(running)).toBe('JOIN');
    const joined = applyJoin(running);
    expect(getClubJoinState(joined)).toBe('MEMBER');
    expect(joined.memberCount).toBe(running.memberCount + 1);

    expect(getClubJoinState(pickleball)).toBe('REQUEST');
    const requested = applyJoin(pickleball);
    expect(getClubJoinState(requested)).toBe('REQUESTED');
    expect(requested.memberCount).toBe(pickleball.memberCount);
    expect(getClubJoinState(applyLeave(requested))).toBe('REQUEST');
  });

  test('members can leave but the owner cannot', () => {
    const cavite = club(mockClubSummaries.caviteBasketball.id);
    const imus = club(mockClubSummaries.imusVolleyball.id);

    expect(getClubJoinState(cavite)).toBe('MEMBER');
    expect(applyLeave(cavite).memberCount).toBe(cavite.memberCount - 1);
    expect(getClubJoinState(imus)).toBe('OWNER');
    expect(applyLeave(imus)).toBe(imus);
    expect(applyJoin(imus)).toBe(imus);
  });

  test('My Clubs groups joined, requested, and followed clubs', () => {
    const list = clubs().map((candidate) =>
      candidate.id === mockClubSummaries.manilaPickleball.id ? applyJoin(candidate) : candidate,
    );
    const sections = groupMyClubs(list);

    expect(sections.joined.map((candidate) => candidate.id)).toEqual([
      mockClubSummaries.imusVolleyball.id,
      mockClubSummaries.caviteBasketball.id,
    ]);
    expect(sections.requested.map((candidate) => candidate.id)).toEqual([mockClubSummaries.manilaPickleball.id]);
    expect(sections.following.map((candidate) => candidate.id)).toEqual([mockClubSummaries.imusRunning.id]);
  });
});

describe('Discover feed filters', () => {
  test('has All, Friends, and Clubs, with All first', () => {
    expect(DISCOVER_TABS.map((tab) => tab.label)).toEqual(['All', 'Friends', 'Clubs']);
  });

  test('All adds popular clubs and public posts', () => {
    const feed = buildDiscoverFeed(
      {
        players: mockPlayers,
        sports: mockSports,
        games: buildMockGames(NOW),
        reels: buildMockReels(NOW),
        clubs: clubs(),
        posts: buildMockPosts(NOW),
      },
      ANY,
    );

    expect(feed.popularClubs[0].id).toBe(mockClubSummaries.imusVolleyball.id);
    expect(feed.popularClubs.every((candidate, index) => index === 0 || feed.popularClubs[index - 1].memberCount >= candidate.memberCount)).toBe(true);
    expect(feed.publicPosts.length).toBeGreaterThan(0);
    expect(feed.publicPosts.every((post) => post.visibility === 'PUBLIC')).toBe(true);
  });

  test('Friends shows only people in the viewer’s circle', () => {
    const circle = [mockUsers.john.id, mockUsers.kim.id];
    const feed = buildFriendsFeed(sources(), circle, ANY);
    const people = feed.map((item) => {
      switch (item.type) {
        case 'POST':
          return item.post.author.id;
        case 'GAME':
          return item.game.host.id;
        case 'REEL':
          return item.reel.author.id;
        default:
          return item.activity.actor.id;
      }
    });

    expect(feed.length).toBeGreaterThan(0);
    expect(people.every((id) => circle.includes(id))).toBe(true);
    expect(buildFriendsFeed(sources(), [], ANY)).toEqual([]);
  });

  test('Clubs shows content from clubs the viewer joined or follows', () => {
    const clubIds = selectFeedClubIds(clubs());

    expect(clubIds).not.toContain(mockClubSummaries.manilaPickleball.id);
    const feed = buildClubsFeed(sources(), clubIds, ANY);
    const ids = feed.map((item) => {
      switch (item.type) {
        case 'POST':
          return item.post.club?.id;
        case 'GAME':
          return item.game.club?.id;
        case 'REEL':
          return item.reel.club?.id;
        default:
          return undefined;
      }
    });

    expect(new Set(feed.map((item) => item.type))).toEqual(new Set(['POST', 'GAME', 'REEL']));
    expect(ids.every((id) => id !== undefined && clubIds.includes(id))).toBe(true);
    expect(buildClubsFeed(sources(), clubIds, { maxDistanceKm: null, sport: 'Running' }).every(
      (item) => item.type === 'POST' && item.post.club?.id === mockClubSummaries.imusRunning.id,
    )).toBe(true);
  });

  test('popular clubs respect the header sport filter', () => {
    expect(rankPopularClubs(clubs(), { maxDistanceKm: null, sport: 'Basketball' }).map((candidate) => candidate.id)).toEqual([
      mockClubSummaries.caviteBasketball.id,
    ]);
    expect(rankPopularClubs(clubs(), { maxDistanceKm: 10, sport: null })).toEqual([]);
  });
});

describe('club search and navigation', () => {
  test('Search has a Clubs category and finds clubs by name, city, or sport', () => {
    expect(SEARCH_CATEGORIES.map((category) => category.id)).toContain('CLUBS');
    const catalog = {
      players: mockPlayers,
      sports: mockSports,
      games: buildMockGames(NOW),
      locations: mockLocations,
      posts: buildMockPosts(NOW),
      reels: buildMockReels(NOW),
      clubs: clubs(),
    };

    expect(searchCatalog(catalog, { query: 'volleyball club', category: 'CLUBS', maxDistanceKm: null }).clubs.map((candidate) => candidate.id)).toEqual([
      mockClubSummaries.imusVolleyball.id,
    ]);
    expect(searchCatalog(catalog, { query: 'imus', category: 'ALL', maxDistanceKm: null }).clubs.map((candidate) => candidate.id)).toEqual([
      mockClubSummaries.imusVolleyball.id,
      mockClubSummaries.imusRunning.id,
    ]);
    expect(searchCatalog(catalog, { query: 'pickleball', category: 'ALL', maxDistanceKm: null }).clubs).toHaveLength(1);
  });

  test('My Clubs lives in Profile after Friends; the avatar dropdown is unchanged', () => {
    const sections = PROFILE_SECTION_LINKS.map((link) => link.label);

    expect(sections).toEqual([
      'My Games',
      'My Reels',
      'My Stories',
      'Friends',
      'My Clubs',
      'Badges',
      'Activity',
      'Settings',
    ]);
    expect(PROFILE_DROPDOWN_LINKS.map((link) => link.label)).not.toContain('My Clubs');
  });

  test('the desktop top bar keeps the 7 locked tabs and has no Clubs tab', () => {
    expect(MAIN_TAB_LINKS.map((link) => link.label)).toEqual([
      'Home',
      'Search',
      'Discover',
      'Create',
      'Reels',
      'Chat',
      'Profile',
    ]);
    const profile = MAIN_TAB_LINKS[6];

    expect(isTabActive(profile, '/profile/clubs')).toBe(true);
    expect(isTabActive(profile, '/profiles')).toBe(false);
    expect(isTabActive(MAIN_TAB_LINKS[0], '/profile')).toBe(false);
  });
});

describe('clubs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('creates clubs through POST /clubs; the creator is the owner and first member', async () => {
    const auth = useAuthStore();
    auth.accessToken = 'test-token';
    const calls: { url: string; method: string; body: unknown; auth: string | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({
          url,
          method: init.method ?? 'GET',
          body: init.body ? JSON.parse(String(init.body)) : null,
          auth: new Headers(init.headers).get('Authorization'),
        });

        if (url.endsWith('/clubs') && init.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { username: string };
          const status = body.username === 'taken-club' ? 409 : 201;
          const payload = status === 409 ? { success: false, message: 'That club username is already taken.' } : apiClub();
          return Promise.resolve(new Response(JSON.stringify(payload), { status }));
        }

        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }),
    );
    const store = useClubsStore();

    const created = await store.create(toClubCreateInput(validForm()));

    expect(created.ok).toBe(true);
    const club = created.ok ? created.club : null;
    expect(club).toMatchObject({
      id: SERVER_CLUB,
      memberCount: 1,
      maxMembers: 50,
      viewerMembership: { role: 'OWNER', status: 'ACTIVE' },
    });
    expect(store.byId(SERVER_CLUB)).toBeDefined();
    expect(calls[0]).toMatchObject({ method: 'POST', auth: 'Bearer test-token', body: { maxMembers: 50 } });

    const taken = await store.create(toClubCreateInput({ ...validForm(), username: 'taken-club' }));
    expect(taken).toEqual({ ok: false, message: 'That club username is already taken.' });
  });

  test('a full server club answers the join with the server message', async () => {
    const auth = useAuthStore();
    auth.accessToken = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = String(input);

        if (url.endsWith('/join') && init.method === 'POST') {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, message: 'Club is currently full.' }), { status: 409 }),
          );
        }

        return Promise.resolve(new Response(JSON.stringify(apiClub({ currentMembers: 50 })), { status: 200 }));
      }),
    );
    const store = useClubsStore();

    expect(await store.join(SERVER_CLUB, null)).toEqual({ ok: false, message: 'Club is currently full.' });
    expect(store.byId(SERVER_CLUB)?.memberCount).toBe(50);
  });

  test('join, leave, and follow update the club', async () => {
    const store = useClubsStore();
    await store.load();
    const runningId = mockClubSummaries.imusRunning.id;
    await store.loadMembers(runningId);
    const before = store.byId(runningId)!.memberCount;

    await store.join(runningId, mockCurrentUser);
    expect(store.byId(runningId)?.memberCount).toBe(before + 1);
    expect(store.members[runningId].some((member) => member.user.id === mockCurrentUser.id)).toBe(true);

    await store.leave(runningId, mockCurrentUser);
    expect(store.byId(runningId)?.memberCount).toBe(before);
    expect(store.members[runningId].some((member) => member.user.id === mockCurrentUser.id)).toBe(false);

    await store.toggleFollow(runningId);
    expect(store.byId(runningId)?.viewerFollows).toBe(false);
    expect(store.feedClubIds).not.toContain(runningId);
  });

  test('a signed-in account starts outside every demo club; only clubs it joins become its own', async () => {
    const auth = useAuthStore();
    auth.accessToken = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))),
    );
    const store = useClubsStore();
    await store.load();

    expect(store.clubs.length).toBeGreaterThan(0);
    expect(groupMyClubs(store.clubs)).toEqual({ joined: [], requested: [], following: [] });
    expect(store.clubs.some((club) => club.viewerCanManageClub || club.viewerCanManageMembers)).toBe(false);
    expect(store.feedClubIds).toEqual([]);

    const runningId = mockClubSummaries.imusRunning.id;
    const count = store.byId(runningId)!.memberCount;
    expect(await store.join(runningId, mockUsers.maria)).toEqual({ ok: true, status: 'JOINED' });
    expect(groupMyClubs(store.clubs).joined.map((club) => club.id)).toEqual([runningId]);
    expect(store.byId(runningId)?.memberCount).toBe(count + 1);
  });
});
