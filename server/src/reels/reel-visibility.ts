import { visibleClubContentWhere } from '../social/club-visibility';
import type { Prisma } from '../generated/prisma/client';
import { friendshipWithViewer } from '../posts/post-visibility';

/**
 * The only definition of "reels this viewer may see" (Reels tab, Highlights, My Reels,
 * profile counts). Same rules as posts:
 *
 * - The author always sees their own reels, whatever the visibility.
 * - Anyone else never sees ONLY_ME reels; sees PUBLIC; FRIENDS only as an accepted friend;
 *   CUSTOM only when listed. A block in either direction, a deactivated author, or a private
 *   club the viewer is not an ACTIVE member of hides the reel.
 * - Deleted reels (deletedAt set) are hidden from everyone, the author included.
 */
export function visibleReelsWhere(viewerId: string): Prisma.ReelWhereInput {
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
