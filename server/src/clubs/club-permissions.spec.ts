import {
  canAssignRole,
  canManageMember,
  clubChatPermissions,
  hasClubPermission,
  type ClubMembershipLike,
  type ClubRole,
} from './club-permissions';

const club = { isPublic: true, isActive: true };
const active = (role: ClubRole): ClubMembershipLike => ({
  role,
  status: 'ACTIVE',
});

describe('club permissions', () => {
  it('gives each role its own abilities plus those of lower roles', () => {
    expect(hasClubPermission(active('OWNER'), 'DISABLE_CLUB', club)).toBe(true);
    expect(hasClubPermission(active('ADMIN'), 'DISABLE_CLUB', club)).toBe(
      false,
    );
    expect(hasClubPermission(active('ADMIN'), 'MANAGE_GAMES', club)).toBe(true);
    expect(hasClubPermission(active('MODERATOR'), 'REVIEW_REPORTS', club)).toBe(
      true,
    );
    expect(hasClubPermission(active('MODERATOR'), 'MANAGE_MEMBERS', club)).toBe(
      false,
    );
    expect(hasClubPermission(active('MEMBER'), 'HOST_CLUB_GAMES', club)).toBe(
      true,
    );
    expect(
      hasClubPermission(
        { role: 'MEMBER', status: 'PENDING' },
        'HOST_CLUB_GAMES',
        club,
      ),
    ).toBe(false);
    expect(hasClubPermission(active('MEMBER'), 'JOIN_CLUB_GAMES', club)).toBe(
      true,
    );
    expect(hasClubPermission(active('MEMBER'), 'MODERATE_CONTENT', club)).toBe(
      false,
    );
  });

  it('gives pending, removed, and banned members nothing beyond public viewing', () => {
    for (const status of ['PENDING', 'REMOVED', 'BANNED'] as const) {
      const membership: ClubMembershipLike = { role: 'ADMIN', status };

      expect(hasClubPermission(membership, 'POST', club)).toBe(false);
      expect(hasClubPermission(membership, 'VIEW_CLUB', club)).toBe(true);
      expect(
        hasClubPermission(membership, 'VIEW_CLUB', {
          ...club,
          isPublic: false,
        }),
      ).toBe(false);
    }
  });

  it('a disabled club allows nothing, even for its owner', () => {
    expect(
      hasClubPermission(active('OWNER'), 'VIEW_CLUB', {
        ...club,
        isActive: false,
      }),
    ).toBe(false);
  });

  it('owners manage everyone but themselves; admins manage only lower roles', () => {
    expect(canManageMember(active('OWNER'), active('ADMIN'))).toBe(true);
    expect(canManageMember(active('OWNER'), active('OWNER'))).toBe(false);
    expect(canManageMember(active('ADMIN'), active('MEMBER'))).toBe(true);
    expect(canManageMember(active('ADMIN'), active('MODERATOR'))).toBe(true);
    expect(canManageMember(active('ADMIN'), active('ADMIN'))).toBe(false);
    expect(canManageMember(active('MODERATOR'), active('MEMBER'))).toBe(false);
    expect(
      canManageMember({ role: 'OWNER', status: 'BANNED' }, active('MEMBER')),
    ).toBe(false);
  });

  it('club chat: members read and send, moderators moderate, admins and owners manage', () => {
    const none = {
      canRead: false,
      canSend: false,
      canModerate: false,
      canManage: false,
    };

    expect(clubChatPermissions(active('OWNER'), club)).toEqual({
      canRead: true,
      canSend: true,
      canModerate: true,
      canManage: true,
    });
    expect(clubChatPermissions(active('ADMIN'), club)).toEqual({
      canRead: true,
      canSend: true,
      canModerate: true,
      canManage: true,
    });
    expect(clubChatPermissions(active('MODERATOR'), club)).toEqual({
      canRead: true,
      canSend: true,
      canModerate: true,
      canManage: false,
    });
    expect(clubChatPermissions(active('MEMBER'), club)).toEqual({
      canRead: true,
      canSend: true,
      canModerate: false,
      canManage: false,
    });

    for (const status of ['PENDING', 'REMOVED', 'BANNED'] as const) {
      expect(clubChatPermissions({ role: 'ADMIN', status }, club)).toEqual(
        none,
      );
    }
    expect(clubChatPermissions(null, club)).toEqual(none);
    expect(
      clubChatPermissions(active('OWNER'), { ...club, isActive: false }),
    ).toEqual(none);
  });

  it('only the owner appoints admins, and nobody assigns OWNER', () => {
    expect(canAssignRole(active('OWNER'), 'ADMIN')).toBe(true);
    expect(canAssignRole(active('ADMIN'), 'ADMIN')).toBe(false);
    expect(canAssignRole(active('ADMIN'), 'MODERATOR')).toBe(true);
    expect(canAssignRole(active('MODERATOR'), 'MEMBER')).toBe(false);
    expect(canAssignRole(active('OWNER'), 'OWNER')).toBe(false);
  });
});
