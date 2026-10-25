import { visibleClubContentWhere } from '../social/club-visibility';
import type { Prisma, PostVisibility } from '../generated/prisma/client';

export const POST_VISIBILITIES = [
  'PUBLIC',
  'FRIENDS',
  'CUSTOM',
  'ONLY_ME',
] as const satisfies readonly PostVisibility[];

export function friendshipWithViewer(
  viewerId: string,
  status: 'ACCEPTED' | 'BLOCKED',
): Prisma.UserWhereInput {
  return {
    OR: [
      { sentFriendships: { some: { receiverId: viewerId, status } } },
      { receivedFriendships: { some: { requesterId: viewerId, status } } },
    ],
  };
}

/**
 * Which tagged people a viewer sees on a post they can already see: deactivated users
 * and anyone with a block in either direction are left out of "with ...".
 */
export function visibleTaggedUserWhere(
  viewerId: string,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
  };
}

/**
 * The only definition of "posts this viewer may see". Every post read goes through it,
 * so privacy is enforced by the query itself rather than by filtering afterwards.
 *
 * - The author always sees their own posts, whatever the visibility.
 * - Anyone else never sees ONLY_ME posts; sees PUBLIC posts; sees FRIENDS posts only as an
 *   accepted friend; sees CUSTOM posts only when listed in PostCustomViewer.
 * - A block in either direction hides every post, as do deactivated authors and posts in
 *   private clubs the viewer is not an ACTIVE member of.
 * - Deleted posts (deletedAt set) are hidden from everyone, the author included.
 */
export function visiblePostsWhere(viewerId: string): Prisma.PostWhereInput {
  return {
    deletedAt: null,
    OR: [
      { userId: viewerId },
      {
        AND: [
          {
            user: {
              isActive: true,
              NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
            },
          },
          {
            OR: [{ clubId: null }, { club: visibleClubContentWhere(viewerId) }],
          },
          {
            OR: [
              { visibility: 'PUBLIC' },
              {
                visibility: 'FRIENDS',
                user: friendshipWithViewer(viewerId, 'ACCEPTED'),
              },
              {
                visibility: 'CUSTOM',
                customViewers: { some: { userId: viewerId } },
              },
            ],
          },
        ],
      },
    ],
  };
}
