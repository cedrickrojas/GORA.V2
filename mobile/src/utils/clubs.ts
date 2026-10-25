import type {
  Club,
  ClubApiInvite,
  ClubApiJoinRequest,
  ClubApiMember,
  ClubApiPerson,
  ClubApiView,
  ClubInvite,
  ClubJoinRequest,
  ClubMemberEntry,
  ClubMemberRole,
} from '@/types/club';
import type { UserSummary } from '@/types/user';
import { type FeedFilters, NO_FILTERS, isWithinDistance, matchesSport } from './filters';

export const CLUB_ROLE_LABELS: Record<ClubMemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  MEMBER: 'Member',
};

export const CLUB_FULL_MESSAGE = 'Club is currently full.';

/** ACTIVE members never exceed maxMembers; PENDING requests take no slot. */
export function clubAvailableSlots(club: Pick<Club, 'memberCount' | 'maxMembers'>): number {
  return Math.max(0, club.maxMembers - club.memberCount);
}

export function isClubFull(club: Pick<Club, 'memberCount' | 'maxMembers'>): boolean {
  return clubAvailableSlots(club) === 0;
}

/** "24 / 50 Members". */
export function formatClubCapacity(club: Pick<Club, 'memberCount' | 'maxMembers'>): string {
  return `${club.memberCount} / ${club.maxMembers} Members`;
}

/** "26 slots available", "1 slot available", or "FULL". */
export function formatClubSlots(club: Pick<Club, 'memberCount' | 'maxMembers'>): string {
  const slots = clubAvailableSlots(club);
  return slots === 0 ? 'FULL' : `${slots} ${slots === 1 ? 'slot' : 'slots'} available`;
}

function toPerson(person: ClubApiPerson): UserSummary {
  return {
    id: person.id,
    username: person.username,
    displayName: person.displayName,
    avatarUrl: person.profileImageUrl,
  };
}

/** A server club (GET /clubs/:id) in the shape every club screen uses. */
export function toClub(view: ClubApiView): Club {
  return {
    id: view.id,
    slug: view.username,
    name: view.name,
    sport: view.primarySport?.name ?? null,
    sportId: view.primarySport?.id ?? null,
    additionalSports: view.additionalSports,
    description: view.description,
    about: view.about,
    profileImageUrl: view.profileImageUrl,
    coverImageUrl: view.coverImageUrl,
    country: view.location.country,
    city: view.location.city,
    barangay: view.location.barangay,
    homeCourt: view.location.homeCourt,
    locationName: view.location.locationName,
    latitude: view.location.latitude,
    longitude: view.location.longitude,
    distanceKm: null,
    isPublic: view.isPublic,
    membershipType: view.membershipType,
    owner: toPerson(view.owner),
    memberCount: view.currentMembers,
    maxMembers: view.maxMembers,
    rules: view.rules,
    tags: view.tags,
    schedule: view.schedule,
    contact: view.contact,
    viewerMembership: view.viewer.membership,
    viewerFollows: view.viewer.follows,
    viewerHasInvite: view.viewer.hasInvite,
    viewerCanManageClub: view.viewer.canManageClub,
    viewerCanManageMembers: view.viewer.canManageMembers,
    contentVisible: view.contentVisible,
    createdAt: view.createdAt,
  };
}

export function toClubMember(member: ClubApiMember): ClubMemberEntry {
  return { user: toPerson(member.user), role: member.role, joinedAt: member.joinedAt };
}

export function toClubJoinRequest(request: ClubApiJoinRequest): ClubJoinRequest {
  return { user: toPerson(request.user), requestedAt: request.requestedAt };
}

export function toClubInvite(invite: ClubApiInvite): ClubInvite {
  return { id: invite.id, invitee: toPerson(invite.invitee), createdAt: invite.createdAt };
}

export function isActiveMember(club: Club): boolean {
  return club.viewerMembership?.status === 'ACTIVE';
}

/** Owners, admins, and moderators run the club day to day. */
export function isClubStaff(club: Club): boolean {
  return isActiveMember(club) && club.viewerMembership?.role !== 'MEMBER';
}

/** The main button on a club page. */
export type ClubJoinState =
  | 'JOIN'
  | 'REQUEST'
  | 'REQUESTED'
  | 'MEMBER'
  | 'OWNER'
  | 'BANNED'
  | 'FULL'
  | 'INVITE_ONLY';

/**
 * Mirrors the server's join rules: a full club takes nobody; OPEN clubs let you straight
 * in; APPROVAL_REQUIRED takes a request; INVITE_ONLY needs an invitation (which also lets
 * an invitee straight into the other kinds).
 */
export function getClubJoinState(club: Club): ClubJoinState {
  const membership = club.viewerMembership;

  if (membership?.status === 'BANNED') {
    return 'BANNED';
  }

  if (membership?.status === 'ACTIVE') {
    return membership.role === 'OWNER' ? 'OWNER' : 'MEMBER';
  }

  if (membership?.status === 'PENDING' && !club.viewerHasInvite) {
    return 'REQUESTED';
  }

  if (isClubFull(club)) {
    return 'FULL';
  }

  if (club.viewerHasInvite || club.membershipType === 'OPEN') {
    return 'JOIN';
  }

  return club.membershipType === 'APPROVAL_REQUIRED' ? 'REQUEST' : 'INVITE_ONLY';
}

/** Demo clubs only: the local copy of what the server does on POST /clubs/:id/join. */
export function applyJoin(club: Club): Club {
  const state = getClubJoinState(club);

  if (state === 'JOIN') {
    return {
      ...club,
      viewerMembership: { role: 'MEMBER', status: 'ACTIVE' },
      viewerHasInvite: false,
      contentVisible: true,
      memberCount: club.memberCount + 1,
    };
  }

  if (state === 'REQUEST') {
    return { ...club, viewerMembership: { role: 'MEMBER', status: 'PENDING' } };
  }

  return club;
}

/** Leave a club or cancel a request. The owner has to transfer ownership first. */
export function applyLeave(club: Club): Club {
  const state = getClubJoinState(club);

  if (state === 'MEMBER') {
    return {
      ...club,
      viewerMembership: null,
      contentVisible: club.isPublic,
      memberCount: Math.max(0, club.memberCount - 1),
    };
  }

  if (state === 'REQUESTED') {
    return { ...club, viewerMembership: null };
  }

  return club;
}

/**
 * A demo club as a signed-in account first sees it: the demo memberships and follows belong to
 * the demo user, so the account starts with none and only clubs it joins become its own.
 */
export function asNonMember(club: Club): Club {
  return {
    ...club,
    viewerMembership: null,
    viewerFollows: false,
    viewerHasInvite: false,
    viewerCanManageClub: false,
    viewerCanManageMembers: false,
    contentVisible: club.isPublic,
  };
}

/** Clubs whose content fills the Discover Clubs tab: joined (active) or followed. */
export function selectFeedClubIds(clubs: readonly Club[]): string[] {
  return clubs.filter((club) => isActiveMember(club) || club.viewerFollows).map((club) => club.id);
}

export function matchesClubFilters(club: Club, filters: FeedFilters): boolean {
  const near =
    filters.maxDistanceKm === null ||
    (club.distanceKm !== null && isWithinDistance(club.distanceKm, filters.maxDistanceKm));

  return near && (filters.sport === null || (club.sport !== null && matchesSport(club.sport, filters.sport)));
}

/** Active-member count as popularity until the server ranks clubs. */
export function rankPopularClubs(clubs: readonly Club[], filters: FeedFilters = NO_FILTERS, limit = 5): Club[] {
  return clubs
    .filter((club) => matchesClubFilters(club, filters))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, limit);
}

export interface MyClubsSections {
  joined: Club[];
  requested: Club[];
  following: Club[];
}

export function groupMyClubs(clubs: readonly Club[]): MyClubsSections {
  const byName = [...clubs].sort((a, b) => a.name.localeCompare(b.name));
  const roleOrder: Record<ClubMemberRole, number> = { OWNER: 0, ADMIN: 1, MODERATOR: 2, MEMBER: 3 };

  return {
    joined: byName
      .filter(isActiveMember)
      .sort((a, b) => roleOrder[a.viewerMembership!.role] - roleOrder[b.viewerMembership!.role]),
    requested: byName.filter((club) => club.viewerMembership?.status === 'PENDING'),
    following: byName.filter((club) => club.viewerFollows && !isActiveMember(club)),
  };
}
