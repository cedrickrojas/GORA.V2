import type { Club, ClubMemberEntry, ClubMembership, ClubSummary } from '@/types/club';
import type { UserSummary } from '@/types/user';
import { DAY_MS } from '@/utils/time';
import { mockCurrentUser, mockUsers } from './mock-users';

export const mockClubSummaries = {
  imusVolleyball: {
    id: 'club-imus-volleyball',
    slug: 'imus-volleyball-club',
    name: 'Imus Volleyball Club',
    sport: 'Volleyball',
  },
  caviteBasketball: {
    id: 'club-cavite-basketball',
    slug: 'cavite-basketball-community',
    name: 'Cavite Basketball Community',
    sport: 'Basketball',
  },
  imusRunning: {
    id: 'club-imus-running',
    slug: 'imus-running-club',
    name: 'Imus Running Club',
    sport: 'Running',
  },
  manilaPickleball: {
    id: 'club-manila-pickleball',
    slug: 'manila-pickleball-collective',
    name: 'Manila Pickleball Collective',
    sport: 'Pickleball',
  },
} satisfies Record<string, ClubSummary>;

type MemberSeed = [user: UserSummary, role: ClubMemberEntry['role'], daysAgo: number];

/** ACTIVE members only; the count on each club is taken from these lists. */
const MEMBER_SEEDS: Record<string, MemberSeed[]> = {
  [mockClubSummaries.imusVolleyball.id]: [
    [mockCurrentUser, 'OWNER', 240],
    [mockUsers.maria, 'ADMIN', 230],
    [mockUsers.carlo, 'MODERATOR', 180],
    [mockUsers.kim, 'MEMBER', 90],
    [mockUsers.bea, 'MEMBER', 40],
    [mockUsers.sam, 'MEMBER', 12],
  ],
  [mockClubSummaries.caviteBasketball.id]: [
    [mockUsers.john, 'OWNER', 400],
    [mockUsers.mark, 'ADMIN', 380],
    [mockCurrentUser, 'MEMBER', 150],
    [mockUsers.alex, 'MEMBER', 60],
  ],
  [mockClubSummaries.imusRunning.id]: [
    [mockUsers.kim, 'OWNER', 300],
    [mockUsers.sam, 'MEMBER', 100],
    [mockUsers.bea, 'MEMBER', 20],
  ],
  [mockClubSummaries.manilaPickleball.id]: [
    [mockUsers.paolo, 'OWNER', 120],
    [mockUsers.bea, 'MEMBER', 30],
  ],
};

export function buildMockClubMembers(clubId: string, referenceMs: number): ClubMemberEntry[] {
  return (MEMBER_SEEDS[clubId] ?? []).map(([user, role, daysAgo]) => ({
    user,
    role,
    joinedAt: new Date(referenceMs - daysAgo * DAY_MS).toISOString(),
  }));
}

function viewerMembership(clubId: string): ClubMembership | null {
  const seed = (MEMBER_SEEDS[clubId] ?? []).find(([user]) => user.id === mockCurrentUser.id);

  return seed ? { role: seed[1], status: 'ACTIVE' } : null;
}

type DemoClubFields = Pick<
  Club,
  | 'description'
  | 'profileImageUrl'
  | 'coverImageUrl'
  | 'city'
  | 'locationName'
  | 'distanceKm'
  | 'isPublic'
  | 'owner'
  | 'viewerFollows'
  | 'maxMembers'
  | 'membershipType'
> &
  Partial<Pick<Club, 'rules' | 'tags' | 'schedule'>> & { createdDaysAgo: number };

export function buildMockClubs(referenceMs: number): Club[] {
  const club = (summary: ClubSummary, fields: DemoClubFields): Club => {
    const { createdDaysAgo, ...rest } = fields;
    const membership = viewerMembership(summary.id);
    const isMember = membership?.status === 'ACTIVE';
    const isOwner = isMember && membership?.role === 'OWNER';

    return {
      ...summary,
      sportId: null,
      additionalSports: [],
      about: null,
      country: 'Philippines',
      barangay: null,
      homeCourt: rest.locationName,
      latitude: null,
      longitude: null,
      rules: [],
      tags: [],
      schedule: { day: null, startTime: null, endTime: null, trainingSchedule: null },
      contact: { email: null, websiteUrl: null, facebookUrl: null, instagramUrl: null, tiktokUrl: null },
      ...rest,
      memberCount: (MEMBER_SEEDS[summary.id] ?? []).length,
      viewerMembership: membership,
      viewerHasInvite: false,
      viewerCanManageClub: isOwner,
      viewerCanManageMembers: isMember && (membership?.role === 'OWNER' || membership?.role === 'ADMIN'),
      contentVisible: rest.isPublic || isMember,
      createdAt: new Date(referenceMs - createdDaysAgo * DAY_MS).toISOString(),
    };
  };

  return [
    club(mockClubSummaries.imusVolleyball, {
      description: 'Weekly 6v6 runs and beach sessions for every level. Newcomers welcome every Thursday.',
      profileImageUrl: null,
      coverImageUrl: null,
      city: 'Imus, Cavite',
      locationName: 'Imus Sports Complex',
      distanceKm: 18.5,
      isPublic: true,
      owner: mockCurrentUser,
      viewerFollows: false,
      maxMembers: 30,
      membershipType: 'OPEN',
      rules: ['Be on time', 'Respect every level'],
      tags: ['volleyball', 'beginners'],
      schedule: { day: 'THURSDAY', startTime: '18:00', endTime: '21:00', trainingSchedule: null },
      createdDaysAgo: 240,
    }),
    club(mockClubSummaries.caviteBasketball, {
      description: 'Pickup runs, weekend leagues, and court-sharing across Cavite.',
      profileImageUrl: null,
      coverImageUrl: null,
      city: 'Bacoor, Cavite',
      locationName: 'Bacoor Covered Court',
      distanceKm: 14.2,
      isPublic: true,
      owner: mockUsers.john,
      viewerFollows: false,
      maxMembers: 50,
      membershipType: 'OPEN',
      createdDaysAgo: 400,
    }),
    club(mockClubSummaries.imusRunning, {
      description: 'Sunday long runs and Wednesday tempo sessions from Imus Plaza.',
      profileImageUrl: null,
      coverImageUrl: null,
      city: 'Imus, Cavite',
      locationName: 'Imus Plaza',
      distanceKm: 19.1,
      isPublic: true,
      owner: mockUsers.kim,
      viewerFollows: true,
      maxMembers: 100,
      membershipType: 'OPEN',
      createdDaysAgo: 300,
    }),
    club(mockClubSummaries.manilaPickleball, {
      description: 'Invite-only ladder play. Request to join and a moderator will review.',
      profileImageUrl: null,
      coverImageUrl: null,
      city: 'Muntinlupa',
      locationName: 'Alabang Pickleball Hub',
      distanceKm: 32.4,
      isPublic: false,
      owner: mockUsers.paolo,
      viewerFollows: false,
      maxMembers: 20,
      membershipType: 'APPROVAL_REQUIRED',
      createdDaysAgo: 120,
    }),
  ];
}
