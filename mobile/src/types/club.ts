import type { UserSummary } from './user';

/** Mirror the server's ClubMemberRole and ClubMemberStatus enums. */
export type ClubMemberRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type ClubMemberStatus = 'PENDING' | 'ACTIVE' | 'REMOVED' | 'BANNED';
/** Who can join: straight in, after an admin approves, or only with an invitation. */
export type ClubMembershipType = 'OPEN' | 'APPROVAL_REQUIRED' | 'INVITE_ONLY';
export type ClubActivityDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/** Enough to label a post, game, or reel with the club it belongs to. */
export interface ClubSummary {
  id: string;
  slug: string;
  name: string;
  /** Primary sport name, or null for multi-sport clubs. */
  sport: string | null;
}

export interface ClubMembership {
  role: ClubMemberRole;
  status: ClubMemberStatus;
}

export interface ClubSportRef {
  id: string;
  name: string;
}

/** Informational only; a schedule never creates games. Times are "HH:MM". */
export interface ClubSchedule {
  day: ClubActivityDay | null;
  startTime: string | null;
  endTime: string | null;
  trainingSchedule: string | null;
}

/** The email is only sent to ACTIVE members. */
export interface ClubContact {
  email: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
}

export interface Club extends ClubSummary {
  description: string | null;
  about: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  /** Primary sport id (Sport table), null for multi-sport demo clubs. */
  sportId: string | null;
  additionalSports: ClubSportRef[];
  country: string | null;
  city: string | null;
  barangay: string | null;
  homeCourt: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  /** From the viewer; null when the club has no coordinates. */
  distanceKm: number | null;
  isPublic: boolean;
  membershipType: ClubMembershipType;
  owner: UserSummary;
  /** ACTIVE members, counted by the server; never stored. The owner is the first. */
  memberCount: number;
  /** Capacity: ACTIVE members never exceed it. */
  maxMembers: number;
  rules: string[];
  tags: string[];
  schedule: ClubSchedule;
  contact: ClubContact;
  /** The viewer's ClubMember row, or null when they never joined or left. */
  viewerMembership: ClubMembership | null;
  /** ClubFollow: see the club's content without joining. */
  viewerFollows: boolean;
  /** A PENDING invitation; joining accepts it. */
  viewerHasInvite: boolean;
  /** Owner only: edit the club settings. */
  viewerCanManageClub: boolean;
  /** Owner and admins: requests, invitations, members. */
  viewerCanManageMembers: boolean;
  /** False when a private club hides its details from the viewer. */
  contentVisible: boolean;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface ClubMemberEntry {
  user: UserSummary;
  role: ClubMemberRole;
  /** ISO 8601 timestamp. */
  joinedAt: string;
}

export interface ClubJoinRequest {
  user: UserSummary;
  /** ISO 8601 timestamp. */
  requestedAt: string;
}

export interface ClubInvite {
  id: string;
  invitee: UserSummary;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** The Create Club / Manage Club form. Blank strings mean "not set". */
export interface ClubForm {
  name: string;
  username: string;
  profileImageUrl: string;
  coverImageUrl: string;
  description: string;
  about: string;
  primarySportId: string;
  additionalSportIds: string[];
  country: string;
  city: string;
  barangay: string;
  homeCourt: string;
  locationName: string;
  latitude: string;
  longitude: string;
  /** Kept as typed so the form can explain what is wrong with it. */
  maxMembers: string;
  membershipType: ClubMembershipType;
  isPublic: boolean;
  rules: string[];
  tags: string[];
  activityDay: ClubActivityDay | '';
  activityStartTime: string;
  activityEndTime: string;
  trainingSchedule: string;
  contactEmail: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
}

/** Exactly what POST /clubs accepts. */
export interface ClubCreateInput {
  name: string;
  username: string;
  description: string;
  about: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  primarySportId: string;
  additionalSportIds: string[];
  country: string | null;
  city: string | null;
  barangay: string | null;
  homeCourt: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  maxMembers: number;
  membershipType: ClubMembershipType;
  isPublic: boolean;
  rules: string[];
  tags: string[];
  activityDay: ClubActivityDay | null;
  activityStartTime: string | null;
  activityEndTime: string | null;
  trainingSchedule: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
}

export type ClubUpdateInput = Partial<ClubCreateInput>;

// ----- API response shapes (server/src/clubs/clubs.types.ts) -----

export interface ClubApiPerson {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface ClubApiView {
  id: string;
  name: string;
  username: string;
  description: string | null;
  about: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  primarySport: ClubSportRef | null;
  additionalSports: ClubSportRef[];
  location: {
    country: string | null;
    city: string | null;
    barangay: string | null;
    homeCourt: string | null;
    locationName: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  maxMembers: number;
  currentMembers: number;
  availableSlots: number;
  isFull: boolean;
  membershipType: ClubMembershipType;
  isPublic: boolean;
  isActive: boolean;
  rules: string[];
  tags: string[];
  schedule: ClubSchedule;
  contact: ClubContact;
  owner: ClubApiPerson;
  viewer: {
    membership: ClubMembership | null;
    hasInvite: boolean;
    follows: boolean;
    canManageClub: boolean;
    canManageMembers: boolean;
    canChat: boolean;
  };
  contentVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClubApiJoinResult {
  status: 'JOINED' | 'REQUESTED';
  club: ClubApiView;
}

export interface ClubApiMember {
  user: ClubApiPerson;
  role: ClubMemberRole;
  joinedAt: string;
}

export interface ClubApiJoinRequest {
  user: ClubApiPerson;
  requestedAt: string;
}

export interface ClubApiInvite {
  id: string;
  invitee: ClubApiPerson;
  status: string;
  createdAt: string;
}
