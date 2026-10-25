/**
 * What each ClubMember role may do. Only ACTIVE memberships carry
 * permissions; PENDING, REMOVED, and BANNED members get none. The future
 * Clubs service checks these before every club write.
 */

export type ClubRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type ClubMembershipStatus = 'PENDING' | 'ACTIVE' | 'REMOVED' | 'BANNED';

export type ClubPermission =
  // Owner
  | 'MANAGE_CLUB'
  | 'MANAGE_ADMINS'
  | 'DISABLE_CLUB'
  // Admin
  | 'MANAGE_POSTS'
  | 'MANAGE_GAMES'
  | 'MANAGE_MEMBERS'
  | 'MANAGE_CONTENT'
  | 'POST_ANNOUNCEMENTS'
  | 'MANAGE_CLUB_CHAT'
  // Moderator
  | 'MODERATE_CONTENT'
  | 'REVIEW_REPORTS'
  | 'MANAGE_COMMENTS'
  | 'MODERATE_CLUB_CHAT'
  // Member
  | 'VIEW_CLUB'
  | 'PARTICIPATE'
  | 'JOIN_CLUB_GAMES'
  | 'HOST_CLUB_GAMES'
  | 'POST'
  | 'COMMENT'
  | 'READ_CLUB_CHAT'
  | 'SEND_CLUB_CHAT';

const MEMBER: readonly ClubPermission[] = [
  'VIEW_CLUB',
  'PARTICIPATE',
  'JOIN_CLUB_GAMES',
  'HOST_CLUB_GAMES',
  'POST',
  'COMMENT',
  'READ_CLUB_CHAT',
  'SEND_CLUB_CHAT',
];
const MODERATOR: readonly ClubPermission[] = [
  ...MEMBER,
  'MODERATE_CONTENT',
  'REVIEW_REPORTS',
  'MANAGE_COMMENTS',
  'MODERATE_CLUB_CHAT',
];
const ADMIN: readonly ClubPermission[] = [
  ...MODERATOR,
  'MANAGE_POSTS',
  'MANAGE_GAMES',
  'MANAGE_MEMBERS',
  'MANAGE_CONTENT',
  'POST_ANNOUNCEMENTS',
  'MANAGE_CLUB_CHAT',
];
const OWNER: readonly ClubPermission[] = [
  ...ADMIN,
  'MANAGE_CLUB',
  'MANAGE_ADMINS',
  'DISABLE_CLUB',
];

export const CLUB_ROLE_PERMISSIONS: Record<
  ClubRole,
  readonly ClubPermission[]
> = {
  OWNER,
  ADMIN,
  MODERATOR,
  MEMBER,
};

/** Higher rank outranks lower; used for member management. */
const ROLE_RANK: Record<ClubRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MODERATOR: 1,
  MEMBER: 0,
};

export interface ClubMembershipLike {
  role: ClubRole;
  status: ClubMembershipStatus;
}

export function hasClubPermission(
  membership: ClubMembershipLike | null,
  permission: ClubPermission,
  club: { isPublic: boolean; isActive: boolean },
): boolean {
  if (!club.isActive) {
    return false;
  }

  if (!membership || membership.status !== 'ACTIVE') {
    return permission === 'VIEW_CLUB' && club.isPublic;
  }

  return CLUB_ROLE_PERMISSIONS[membership.role].includes(permission);
}

export interface ClubChatPermissions {
  canRead: boolean;
  canSend: boolean;
  /** Moderator tools (later: delete messages, mute). */
  canModerate: boolean;
  /** Admin tools (later: pin, announcements, chat settings). */
  canManage: boolean;
}

/**
 * The official club chat: ACTIVE members read and send, moderators also moderate,
 * admins and the owner also manage. Everyone else, and every disabled club, gets nothing.
 */
export function clubChatPermissions(
  membership: ClubMembershipLike | null,
  club: { isPublic: boolean; isActive: boolean },
): ClubChatPermissions {
  return {
    canRead: hasClubPermission(membership, 'READ_CLUB_CHAT', club),
    canSend: hasClubPermission(membership, 'SEND_CLUB_CHAT', club),
    canModerate: hasClubPermission(membership, 'MODERATE_CLUB_CHAT', club),
    canManage: hasClubPermission(membership, 'MANAGE_CLUB_CHAT', club),
  };
}

/**
 * Removing, banning, or changing a member's role. Owners manage everyone
 * but themselves (ownership is transferred instead); admins manage
 * moderators and members; moderators manage content, not people.
 */
export function canManageMember(
  actor: ClubMembershipLike,
  target: ClubMembershipLike,
): boolean {
  if (actor.status !== 'ACTIVE' || target.role === 'OWNER') {
    return false;
  }

  const needed: ClubPermission =
    target.role === 'ADMIN' ? 'MANAGE_ADMINS' : 'MANAGE_MEMBERS';

  return (
    CLUB_ROLE_PERMISSIONS[actor.role].includes(needed) &&
    ROLE_RANK[actor.role] > ROLE_RANK[target.role]
  );
}

/** Only the owner hands out ADMIN; admins may appoint moderators and members. */
export function canAssignRole(
  actor: ClubMembershipLike,
  role: ClubRole,
): boolean {
  if (actor.status !== 'ACTIVE' || role === 'OWNER') {
    return false;
  }

  if (role === 'ADMIN') {
    return CLUB_ROLE_PERMISSIONS[actor.role].includes('MANAGE_ADMINS');
  }

  return CLUB_ROLE_PERMISSIONS[actor.role].includes('MANAGE_MEMBERS');
}
