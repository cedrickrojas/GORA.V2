import type {
  ClubActivityDay,
  ClubMemberRole,
  ClubMemberStatus,
  ClubMembershipType,
} from '../generated/prisma/client';

export interface ClubSportView {
  id: string;
  name: string;
}

export interface ClubPersonView {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
}

/** ACTIVE members only; PENDING, REMOVED, and BANNED rows never take a slot. */
export interface ClubCapacityView {
  maxMembers: number;
  currentMembers: number;
  availableSlots: number;
  isFull: boolean;
}

export interface ClubViewerState {
  membership: { role: ClubMemberRole; status: ClubMemberStatus } | null;
  /** A PENDING invitation the viewer can accept by joining. */
  hasInvite: boolean;
  follows: boolean;
  canManageClub: boolean;
  canManageMembers: boolean;
  canChat: boolean;
}

/**
 * A club as the viewer may see it. For a private club seen by a non-member, the
 * detailed fields (about, rules, schedule, contact links, barangay, home court,
 * coordinates) are null or empty. contact.email is only sent to ACTIVE members.
 */
export interface ClubView extends ClubCapacityView {
  id: string;
  name: string;
  username: string;
  description: string | null;
  about: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  primarySport: ClubSportView | null;
  additionalSports: ClubSportView[];
  location: {
    country: string | null;
    city: string | null;
    barangay: string | null;
    homeCourt: string | null;
    locationName: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  membershipType: ClubMembershipType;
  isPublic: boolean;
  isActive: boolean;
  rules: string[];
  tags: string[];
  schedule: {
    day: ClubActivityDay | null;
    startTime: string | null;
    endTime: string | null;
    trainingSchedule: string | null;
  };
  contact: {
    email: string | null;
    websiteUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
  };
  owner: ClubPersonView;
  viewer: ClubViewerState;
  /** False when the club is private and the viewer is not an ACTIVE member. */
  contentVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClubMemberView {
  user: ClubPersonView;
  role: ClubMemberRole;
  joinedAt: Date;
}

export interface ClubJoinRequestView {
  user: ClubPersonView;
  requestedAt: Date;
}

export interface ClubInviteView {
  id: string;
  invitee: ClubPersonView;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';
  createdAt: Date;
}

export type ClubJoinResult =
  | { status: 'JOINED'; club: ClubView }
  | { status: 'REQUESTED'; club: ClubView };
